/**
 * Caching strategies for API responses and data
 */

import { createClient } from '@supabase/supabase-js';

// In-memory cache with TTL
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expires });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
export const memoryCache = new MemoryCache();

// Cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => memoryCache.cleanup(), 5 * 60 * 1000);
}

// Cache wrapper for API calls
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    keyGenerator?: (...args: Parameters<T>) => string;
    ttl?: number;
    skipCache?: boolean;
  }
): T {
  return (async (...args: Parameters<T>) => {
    if (options?.skipCache) {
      return fn(...args);
    }

    const key = options?.keyGenerator 
      ? options.keyGenerator(...args)
      : `${fn.name}_${JSON.stringify(args)}`;
    
    // Try to get from cache first
    const cached = memoryCache.get(key);
    if (cached) {
      return cached;
    }

    // Execute function and cache result
    try {
      const result = await fn(...args);
      memoryCache.set(key, result, options?.ttl);
      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  }) as T;
}

// Supabase query caching
export class SupabaseCacheManager {
  private supabase: ReturnType<typeof createClient>;
  
  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  // Cached project queries
  async getProjects(userId: string, useCache = true) {
    const cacheKey = `projects_${userId}`;
    
    if (useCache) {
      const cached = memoryCache.get(cacheKey);
      if (cached) return cached;
    }

    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    if (useCache) {
      memoryCache.set(cacheKey, data, 2 * 60 * 1000); // 2 minutes
    }
    
    return data;
  }

  // Cached analytics queries
  async getAnalytics(userId: string, useCache = true) {
    const cacheKey = `analytics_${userId}`;
    
    if (useCache) {
      const cached = memoryCache.get(cacheKey);
      if (cached) return cached;
    }

    const { data, error } = await this.supabase
      .from('project_analytics')
      .select(`
        *,
        projects!inner(user_id)
      `)
      .eq('projects.user_id', userId);

    if (error) throw error;
    
    if (useCache) {
      memoryCache.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes
    }
    
    return data;
  }

  // Invalidate cache for user
  invalidateUserCache(userId: string) {
    memoryCache.delete(`projects_${userId}`);
    memoryCache.delete(`analytics_${userId}`);
  }

  // Invalidate specific project cache
  invalidateProjectCache(projectId: string, userId: string) {
    memoryCache.delete(`project_${projectId}`);
    memoryCache.delete(`projects_${userId}`);
  }
}

// Browser storage caching
export class BrowserCache {
  private storage: Storage;
  private prefix: string;

  constructor(type: 'localStorage' | 'sessionStorage' = 'localStorage', prefix = 'n8n_cache_') {
    if (typeof window === 'undefined') {
      throw new Error('BrowserCache can only be used in browser environment');
    }
    
    this.storage = window[type];
    this.prefix = prefix;
  }

  set(key: string, data: any, ttl?: number): void {
    const item = {
      data,
      expires: ttl ? Date.now() + ttl : null,
    };
    
    try {
      this.storage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to set cache item:', error);
    }
  }

  get(key: string): any | null {
    try {
      const item = this.storage.getItem(this.prefix + key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      
      if (parsed.expires && Date.now() > parsed.expires) {
        this.storage.removeItem(this.prefix + key);
        return null;
      }
      
      return parsed.data;
    } catch (error) {
      console.warn('Failed to get cache item:', error);
      return null;
    }
  }

  delete(key: string): void {
    this.storage.removeItem(this.prefix + key);
  }

  clear(): void {
    const keys = Object.keys(this.storage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        this.storage.removeItem(key);
      }
    });
  }
}

// HTTP response caching
export const createCachedFetch = (defaultTTL = 5 * 60 * 1000) => {
  return async (url: string, options?: RequestInit & { ttl?: number }) => {
    const { ttl = defaultTTL, ...fetchOptions } = options || {};
    const cacheKey = `fetch_${url}_${JSON.stringify(fetchOptions)}`;
    
    // Only cache GET requests
    if (!fetchOptions.method || fetchOptions.method === 'GET') {
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached.data), {
          status: cached.status,
          headers: cached.headers,
        });
      }
    }

    const response = await fetch(url, fetchOptions);
    
    // Cache successful GET responses
    if (response.ok && (!fetchOptions.method || fetchOptions.method === 'GET')) {
      const data = await response.clone().json();
      memoryCache.set(cacheKey, {
        data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      }, ttl);
    }
    
    return response;
  };
};

// Cache invalidation patterns
export const CacheInvalidation = {
  // Invalidate all user-related caches
  invalidateUser: (userId: string) => {
    const patterns = [
      `projects_${userId}`,
      `analytics_${userId}`,
      `user_stats_${userId}`,
    ];
    
    patterns.forEach(pattern => memoryCache.delete(pattern));
  },

  // Invalidate project-related caches
  invalidateProject: (projectId: string, userId: string) => {
    const patterns = [
      `project_${projectId}`,
      `projects_${userId}`,
      `project_analytics_${projectId}`,
    ];
    
    patterns.forEach(pattern => memoryCache.delete(pattern));
  },

  // Clear all caches
  clearAll: () => {
    memoryCache.clear();
  },
};