import { logger } from '@/lib/logging/structured-logger';
import { createClient } from '@/lib/supabase/client';

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  notificationChannels: string[];
}

export interface SystemHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  errorRate?: number;
  lastCheck: string;
  details?: Record<string, any>;
}

class PerformanceMonitor {
  private supabase = createClient();
  private observers: PerformanceObserver[] = [];
  private thresholds: PerformanceThreshold[] = [
    { metric: 'page_load_time', warning: 3000, critical: 5000, unit: 'ms' },
    { metric: 'api_response_time', warning: 1000, critical: 3000, unit: 'ms' },
    { metric: 'database_query_time', warning: 500, critical: 1000, unit: 'ms' },
    { metric: 'file_upload_time', warning: 10000, critical: 30000, unit: 'ms' },
    { metric: 'code_generation_time', warning: 30000, critical: 60000, unit: 'ms' }
  ];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers(): void {
    if (typeof window === 'undefined') return;

    // Navigation timing observer
    if ('PerformanceObserver' in window) {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordNavigationMetrics(navEntry);
          }
        }
      });

      try {
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (error) {
        console.warn('Navigation timing observer not supported');
      }

      // Resource timing observer
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.recordResourceMetrics(entry as PerformanceResourceTiming);
          }
        }
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (error) {
        console.warn('Resource timing observer not supported');
      }

      // Long task observer
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            this.recordLongTask(entry);
          }
        }
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (error) {
        console.warn('Long task observer not supported');
      }
    }
  }

  private recordNavigationMetrics(entry: PerformanceNavigationTiming): void {
    const metrics = {
      dns_lookup: entry.domainLookupEnd - entry.domainLookupStart,
      tcp_connection: entry.connectEnd - entry.connectStart,
      tls_negotiation: entry.secureConnectionStart > 0 
        ? entry.connectEnd - entry.secureConnectionStart 
        : 0,
      request_time: entry.responseStart - entry.requestStart,
      response_time: entry.responseEnd - entry.responseStart,
      dom_processing: entry.domContentLoadedEventStart - entry.responseEnd,
      page_load_time: entry.loadEventEnd - entry.navigationStart,
      first_paint: 0,
      first_contentful_paint: 0
    };

    // Get paint metrics
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach(paint => {
      if (paint.name === 'first-paint') {
        metrics.first_paint = paint.startTime;
      } else if (paint.name === 'first-contentful-paint') {
        metrics.first_contentful_paint = paint.startTime;
      }
    });

    // Log each metric
    Object.entries(metrics).forEach(([name, value]) => {
      if (value > 0) {
        logger.logPerformance({
          name: `navigation_${name}`,
          value,
          unit: 'ms',
          tags: {
            type: 'navigation',
            url: window.location.href
          }
        });

        this.checkThreshold(name, value);
      }
    });
  }

  private recordResourceMetrics(entry: PerformanceResourceTiming): void {
    const duration = entry.responseEnd - entry.startTime;
    const size = (entry as any).transferSize || 0;

    logger.logPerformance({
      name: 'resource_load_time',
      value: duration,
      unit: 'ms',
      tags: {
        type: 'resource',
        resource_type: this.getResourceType(entry.name),
        url: entry.name,
        size: size.toString()
      }
    });

    if (size > 0) {
      logger.logPerformance({
        name: 'resource_size',
        value: size,
        unit: 'bytes',
        tags: {
          type: 'resource',
          resource_type: this.getResourceType(entry.name),
          url: entry.name
        }
      });
    }
  }

  private recordLongTask(entry: PerformanceEntry): void {
    logger.logPerformance({
      name: 'long_task_duration',
      value: entry.duration,
      unit: 'ms',
      tags: {
        type: 'longtask',
        start_time: entry.startTime.toString()
      }
    });

    // Log warning for long tasks
    logger.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`, {
      component: 'performance_monitor',
      duration: entry.duration,
      startTime: entry.startTime
    });
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  private checkThreshold(metric: string, value: number): void {
    const threshold = this.thresholds.find(t => t.metric === metric);
    if (!threshold) return;

    if (value >= threshold.critical) {
      logger.error(`Critical performance threshold exceeded for ${metric}`, undefined, {
        component: 'performance_monitor',
        metric,
        value,
        threshold: threshold.critical,
        unit: threshold.unit
      });
    } else if (value >= threshold.warning) {
      logger.warn(`Performance warning threshold exceeded for ${metric}`, {
        component: 'performance_monitor',
        metric,
        value,
        threshold: threshold.warning,
        unit: threshold.unit
      });
    }
  }

  async recordCustomMetric(
    name: string,
    value: number,
    unit: string = 'count',
    tags: Record<string, string> = {},
    context: Record<string, any> = {}
  ): Promise<void> {
    await logger.logPerformance({
      name,
      value,
      unit,
      tags
    }, context);

    this.checkThreshold(name, value);
  }

  async recordApiPerformance(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context: Record<string, any> = {}
  ): Promise<void> {
    await logger.logPerformance({
      name: 'api_response_time',
      value: duration,
      unit: 'ms',
      tags: {
        endpoint,
        method,
        status_code: statusCode.toString(),
        status_class: Math.floor(statusCode / 100) + 'xx'
      }
    }, context);

    logger.logApiRequest(method, endpoint, statusCode, duration, context);
    this.checkThreshold('api_response_time', duration);
  }

  async recordDatabasePerformance(
    operation: string,
    table: string,
    duration: number,
    context: Record<string, any> = {}
  ): Promise<void> {
    await logger.logPerformance({
      name: 'database_query_time',
      value: duration,
      unit: 'ms',
      tags: {
        operation,
        table
      }
    }, context);

    this.checkThreshold('database_query_time', duration);
  }

  async checkSystemHealth(): Promise<SystemHealthStatus[]> {
    const healthChecks: SystemHealthStatus[] = [];

    // Check Supabase connectivity
    const supabaseHealth = await this.checkSupabaseHealth();
    healthChecks.push(supabaseHealth);

    // Check API endpoints
    const apiHealth = await this.checkApiHealth();
    healthChecks.push(apiHealth);

    // Store health status
    try {
      await this.supabase
        .from('system_health')
        .insert(healthChecks.map(health => ({
          service_name: health.service,
          status: health.status,
          response_time_ms: health.responseTime,
          error_rate: health.errorRate,
          last_check: health.lastCheck,
          details: health.details || {}
        })));
    } catch (error) {
      logger.error('Failed to store system health status', error as Error);
    }

    return healthChecks;
  }

  private async checkSupabaseHealth(): Promise<SystemHealthStatus> {
    const startTime = performance.now();
    
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('count')
        .limit(1);

      const responseTime = performance.now() - startTime;

      if (error) {
        return {
          service: 'supabase',
          status: 'unhealthy',
          responseTime,
          lastCheck: new Date().toISOString(),
          details: { error: error.message }
        };
      }

      return {
        service: 'supabase',
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'supabase',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkApiHealth(): Promise<SystemHealthStatus> {
    const startTime = performance.now();
    
    try {
      const response = await fetch('/api/health');
      const responseTime = performance.now() - startTime;

      if (!response.ok) {
        return {
          service: 'api',
          status: 'unhealthy',
          responseTime,
          lastCheck: new Date().toISOString(),
          details: { statusCode: response.status }
        };
      }

      return {
        service: 'api',
        status: responseTime > 500 ? 'degraded' : 'healthy',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'api',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: { error: (error as Error).message }
      };
    }
  }

  getWebVitals(): Promise<Record<string, number>> {
    return new Promise((resolve) => {
      const vitals: Record<string, number> = {};

      // Get Core Web Vitals
      if ('web-vitals' in window) {
        // This would require the web-vitals library
        // For now, we'll use basic performance API
      }

      // Fallback to basic metrics
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        vitals.FCP = 0; // First Contentful Paint
        vitals.LCP = 0; // Largest Contentful Paint
        vitals.FID = 0; // First Input Delay
        vitals.CLS = 0; // Cumulative Layout Shift
        vitals.TTFB = navigation.responseStart - navigation.requestStart;
      }

      resolve(vitals);
    });
  }

  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceMonitor.destroy();
  });
}