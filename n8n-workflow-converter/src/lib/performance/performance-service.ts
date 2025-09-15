/**
 * Performance optimization service
 * Coordinates all performance-related functionality
 */

import { createClient } from '@supabase/supabase-js';
import { memoryCache, SupabaseCacheManager, CacheInvalidation } from './caching';
import { DatabaseOptimizer, QueryPerformanceMonitor } from './database-optimization';
import { EdgeFunctionMonitor } from './edge-function-optimization';

export class PerformanceService {
  private supabase: ReturnType<typeof createClient>;
  private cacheManager: SupabaseCacheManager;
  private dbOptimizer: DatabaseOptimizer;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
    this.cacheManager = new SupabaseCacheManager(supabase);
    this.dbOptimizer = new DatabaseOptimizer(supabase);
  }

  // Initialize performance monitoring
  async initialize() {
    // Set up periodic cache cleanup
    if (typeof window !== 'undefined') {
      setInterval(() => {
        memoryCache.cleanup();
      }, 5 * 60 * 1000); // Every 5 minutes
    }

    // Refresh materialized views periodically
    if (typeof window === 'undefined') { // Server-side only
      setInterval(async () => {
        try {
          await this.supabase.rpc('refresh_user_analytics');
        } catch (error) {
          console.error('Failed to refresh analytics:', error);
        }
      }, 10 * 60 * 1000); // Every 10 minutes
    }
  }

  // Optimized project queries
  async getProjects(userId: string, options?: {
    useCache?: boolean;
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
  }) {
    const { useCache = true, ...queryOptions } = options || {};
    
    const endTimer = QueryPerformanceMonitor.startTimer('getProjects');
    
    try {
      if (queryOptions.search) {
        // Use full-text search for search queries
        const { data, error } = await this.supabase.rpc('search_projects_fts', {
          target_user_id: userId,
          search_term: queryOptions.search,
          result_limit: queryOptions.limit || 20,
          result_offset: queryOptions.offset || 0,
        });
        
        if (error) throw error;
        return data;
      }

      // Use cached results for simple queries
      if (useCache && !queryOptions.status && !queryOptions.limit) {
        return this.cacheManager.getProjects(userId, true);
      }

      // Use optimized query for complex queries
      const query = await this.dbOptimizer.getProjectsOptimized(userId, queryOptions);
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    } finally {
      endTimer();
    }
  }

  // Optimized analytics queries
  async getAnalytics(userId: string, options?: {
    useCache?: boolean;
    timeRange?: { start: string; end: string };
  }) {
    const { useCache = true, timeRange } = options || {};
    
    const endTimer = QueryPerformanceMonitor.startTimer('getAnalytics');
    
    try {
      // Use materialized view for summary analytics
      if (!timeRange) {
        const { data, error } = await this.supabase
          .from('user_analytics_summary')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error; // Ignore not found
        return data;
      }

      // Use cached results for time-range queries
      if (useCache) {
        return this.cacheManager.getAnalytics(userId, true);
      }

      // Use optimized query for time-range analytics
      const query = await this.dbOptimizer.getAnalyticsOptimized(userId, timeRange);
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    } finally {
      endTimer();
    }
  }

  // Batch operations for better performance
  async batchUpdateProjects(updates: Array<{ id: string; data: any }>) {
    const endTimer = QueryPerformanceMonitor.startTimer('batchUpdateProjects');
    
    try {
      const results = await this.dbOptimizer.batchUpdateProjects(updates);
      
      // Invalidate cache for affected users
      const userIds = new Set<string>();
      updates.forEach(update => {
        if (update.data.user_id) {
          userIds.add(update.data.user_id);
        }
      });
      
      userIds.forEach(userId => {
        CacheInvalidation.invalidateUser(userId);
      });
      
      return results;
    } finally {
      endTimer();
    }
  }

  // Performance monitoring and metrics
  getPerformanceMetrics() {
    return {
      cache: {
        size: memoryCache['cache'].size,
        // Add more cache metrics
      },
      queries: QueryPerformanceMonitor.getAllStats(),
      edgeFunctions: EdgeFunctionMonitor.getMetrics(),
    };
  }

  // Cache management
  invalidateUserCache(userId: string) {
    CacheInvalidation.invalidateUser(userId);
  }

  invalidateProjectCache(projectId: string, userId: string) {
    CacheInvalidation.invalidateProject(projectId, userId);
  }

  clearAllCaches() {
    CacheInvalidation.clearAll();
  }

  // Database optimization
  async optimizeDatabase() {
    try {
      // Analyze tables for better query planning
      await this.supabase.rpc('analyze_tables');
      
      // Refresh materialized views
      await this.supabase.rpc('refresh_user_analytics');
      
      return { success: true };
    } catch (error) {
      console.error('Database optimization failed:', error);
      return { success: false, error };
    }
  }

  // Performance recommendations
  async getPerformanceRecommendations(userId: string) {
    const recommendations: string[] = [];
    
    try {
      // Check project count
      const projectCount = await this.dbOptimizer.getProjectCount(userId);
      if (projectCount > 1000) {
        recommendations.push('Consider archiving old projects to improve performance');
      }

      // Check cache hit rate
      const metrics = this.getPerformanceMetrics();
      if (metrics.queries) {
        Object.entries(metrics.queries).forEach(([query, stats]) => {
          if (stats && stats.avg > 1000) {
            recommendations.push(`Query "${query}" is slow (${stats.avg.toFixed(0)}ms average)`);
          }
        });
      }

      // Check memory usage
      if (typeof window !== 'undefined' && 'memory' in window.performance) {
        const memory = (window.performance as any).memory;
        const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        if (usage > 0.8) {
          recommendations.push('High memory usage detected. Consider refreshing the page.');
        }
      }

      return recommendations;
    } catch (error) {
      console.error('Failed to get performance recommendations:', error);
      return [];
    }
  }

  // Preload critical data
  async preloadCriticalData(userId: string) {
    try {
      // Preload user projects
      this.getProjects(userId, { limit: 10 });
      
      // Preload analytics summary
      this.getAnalytics(userId);
      
      // Preload user profile if needed
      // Add other critical data preloading here
      
    } catch (error) {
      console.error('Failed to preload critical data:', error);
    }
  }
}

// Singleton instance
let performanceService: PerformanceService | null = null;

export function getPerformanceService(supabase?: ReturnType<typeof createClient>) {
  if (!performanceService && supabase) {
    performanceService = new PerformanceService(supabase);
    performanceService.initialize();
  }
  return performanceService;
}

// Performance monitoring hooks for React
export function usePerformanceOptimization() {
  const [metrics, setMetrics] = React.useState<any>(null);
  const [recommendations, setRecommendations] = React.useState<string[]>([]);

  React.useEffect(() => {
    const service = getPerformanceService();
    if (!service) return;

    const updateMetrics = () => {
      setMetrics(service.getPerformanceMetrics());
    };

    // Update metrics every 30 seconds
    const interval = setInterval(updateMetrics, 30000);
    updateMetrics(); // Initial update

    return () => clearInterval(interval);
  }, []);

  const getRecommendations = React.useCallback(async (userId: string) => {
    const service = getPerformanceService();
    if (service) {
      const recs = await service.getPerformanceRecommendations(userId);
      setRecommendations(recs);
    }
  }, []);

  return {
    metrics,
    recommendations,
    getRecommendations,
  };
}

// Add React import for hooks
import React from 'react';