/**
 * Edge Function performance optimization utilities
 */

// Edge Function response caching
export class EdgeFunctionCache {
  private static cache = new Map<string, { data: any; expires: number }>();
  private static defaultTTL = 5 * 60 * 1000; // 5 minutes

  static set(key: string, data: any, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expires });
  }

  static get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  static delete(key: string): void {
    this.cache.delete(key);
  }

  static clear(): void {
    this.cache.clear();
  }

  static cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Request deduplication for Edge Functions
export class RequestDeduplicator {
  private static pendingRequests = new Map<string, Promise<any>>();

  static async deduplicate<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const promise = fn().finally(() => {
      // Clean up after completion
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  static clear(): void {
    this.pendingRequests.clear();
  }
}

// Edge Function performance monitoring
export class EdgeFunctionMonitor {
  private static metrics = new Map<string, {
    calls: number;
    totalTime: number;
    errors: number;
    lastCall: number;
  }>();

  static startTimer(functionName: string): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      
      if (!this.metrics.has(functionName)) {
        this.metrics.set(functionName, {
          calls: 0,
          totalTime: 0,
          errors: 0,
          lastCall: 0,
        });
      }
      
      const metric = this.metrics.get(functionName)!;
      metric.calls++;
      metric.totalTime += duration;
      metric.lastCall = Date.now();
    };
  }

  static recordError(functionName: string): void {
    if (!this.metrics.has(functionName)) {
      this.metrics.set(functionName, {
        calls: 0,
        totalTime: 0,
        errors: 0,
        lastCall: 0,
      });
    }
    
    this.metrics.get(functionName)!.errors++;
  }

  static getMetrics(functionName?: string) {
    if (functionName) {
      const metric = this.metrics.get(functionName);
      if (!metric) return null;
      
      return {
        ...metric,
        avgTime: metric.calls > 0 ? metric.totalTime / metric.calls : 0,
        errorRate: metric.calls > 0 ? metric.errors / metric.calls : 0,
      };
    }
    
    const allMetrics: Record<string, any> = {};
    for (const [name, metric] of this.metrics) {
      allMetrics[name] = {
        ...metric,
        avgTime: metric.calls > 0 ? metric.totalTime / metric.calls : 0,
        errorRate: metric.calls > 0 ? metric.errors / metric.calls : 0,
      };
    }
    return allMetrics;
  }
}

// Optimized Edge Function utilities
export const EdgeFunctionUtils = {
  // Create optimized response with caching headers
  createResponse: (
    data: any,
    options?: {
      status?: number;
      headers?: Record<string, string>;
      cache?: {
        maxAge?: number;
        staleWhileRevalidate?: number;
      };
    }
  ) => {
    const headers = new Headers(options?.headers || {});
    
    // Set content type
    headers.set('Content-Type', 'application/json');
    
    // Set caching headers
    if (options?.cache) {
      const { maxAge = 300, staleWhileRevalidate = 60 } = options.cache;
      headers.set(
        'Cache-Control',
        `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
      );
    }
    
    // Set performance headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    
    return new Response(JSON.stringify(data), {
      status: options?.status || 200,
      headers,
    });
  },

  // Create error response with proper headers
  createErrorResponse: (
    error: string | Error,
    status = 500,
    headers?: Record<string, string>
  ) => {
    const responseHeaders = new Headers(headers || {});
    responseHeaders.set('Content-Type', 'application/json');
    
    const errorMessage = error instanceof Error ? error.message : error;
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: responseHeaders,
      }
    );
  },

  // Validate and parse request body with size limits
  parseRequestBody: async (
    request: Request,
    options?: {
      maxSize?: number;
      required?: boolean;
    }
  ) => {
    const { maxSize = 10 * 1024 * 1024, required = true } = options || {}; // 10MB default
    
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new Error(`Request body too large. Maximum size: ${maxSize} bytes`);
    }
    
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (required) {
        throw new Error('Content-Type must be application/json');
      }
      return null;
    }
    
    try {
      const text = await request.text();
      if (!text && required) {
        throw new Error('Request body is required');
      }
      
      return text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  },

  // Rate limiting for Edge Functions
  rateLimiter: (() => {
    const requests = new Map<string, number[]>();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100; // per window
    
    return (identifier: string): boolean => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requests.has(identifier)) {
        requests.set(identifier, []);
      }
      
      const userRequests = requests.get(identifier)!;
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(time => time > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return false; // Rate limit exceeded
      }
      
      // Add current request
      validRequests.push(now);
      requests.set(identifier, validRequests);
      
      return true; // Request allowed
    };
  })(),

  // Batch processing for Edge Functions
  batchProcessor: <T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize = 10
  ): Promise<R[]> => {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return Promise.all(
      batches.map(batch => processor(batch))
    ).then(results => results.flat());
  },

  // Memory usage monitoring
  getMemoryUsage: () => {
    if (typeof Deno !== 'undefined') {
      return Deno.memoryUsage();
    }
    
    // Fallback for other environments
    return {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
    };
  },

  // Performance timing
  withTiming: async <T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      // Log performance in development
      if (Deno.env.get('DENO_ENV') === 'development') {
        console.log(`${name} took ${duration.toFixed(2)}ms`);
      }
      
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  },
};

// Edge Function optimization middleware
export const createOptimizedHandler = (
  handler: (request: Request) => Promise<Response>,
  options?: {
    cache?: boolean;
    rateLimit?: boolean;
    monitor?: boolean;
  }
) => {
  return async (request: Request): Promise<Response> => {
    const { cache = true, rateLimit = true, monitor = true } = options || {};
    
    // Start monitoring
    const endTimer = monitor ? EdgeFunctionMonitor.startTimer('handler') : () => {};
    
    try {
      // Rate limiting
      if (rateLimit) {
        const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
        if (!EdgeFunctionUtils.rateLimiter(clientIP)) {
          return EdgeFunctionUtils.createErrorResponse(
            'Rate limit exceeded',
            429
          );
        }
      }
      
      // Caching for GET requests
      if (cache && request.method === 'GET') {
        const cacheKey = `${request.url}_${request.headers.get('authorization') || ''}`;
        const cached = EdgeFunctionCache.get(cacheKey);
        
        if (cached) {
          return EdgeFunctionUtils.createResponse(cached, {
            headers: { 'X-Cache': 'HIT' },
          });
        }
        
        const response = await handler(request);
        
        // Cache successful responses
        if (response.ok) {
          const data = await response.clone().json();
          EdgeFunctionCache.set(cacheKey, data);
        }
        
        return response;
      }
      
      return await handler(request);
    } catch (error) {
      if (monitor) {
        EdgeFunctionMonitor.recordError('handler');
      }
      
      console.error('Edge Function error:', error);
      return EdgeFunctionUtils.createErrorResponse(error as Error);
    } finally {
      endTimer();
    }
  };
};