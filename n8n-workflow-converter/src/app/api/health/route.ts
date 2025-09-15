import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const supabase = createClient();
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {} as Record<string, any>
    };

    // Check Supabase connectivity
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (error) {
        healthStatus.services.supabase = {
          status: 'unhealthy',
          error: error.message,
          responseTime: performance.now() - startTime
        };
        healthStatus.status = 'degraded';
      } else {
        healthStatus.services.supabase = {
          status: 'healthy',
          responseTime: performance.now() - startTime
        };
      }
    } catch (error) {
      healthStatus.services.supabase = {
        status: 'unhealthy',
        error: (error as Error).message,
        responseTime: performance.now() - startTime
      };
      healthStatus.status = 'unhealthy';
    }

    // Check system resources
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      healthStatus.services.system = {
        status: 'healthy',
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        uptime: process.uptime()
      };

      // Check if memory usage is too high
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      if (memoryUsagePercent > 90) {
        healthStatus.services.system.status = 'degraded';
        healthStatus.status = 'degraded';
      }
    }

    // Check Edge Functions (if available)
    try {
      const edgeFunctionResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/parse-workflow`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: true })
        }
      );

      healthStatus.services.edge_functions = {
        status: edgeFunctionResponse.ok ? 'healthy' : 'degraded',
        responseTime: performance.now() - startTime,
        statusCode: edgeFunctionResponse.status
      };

      if (!edgeFunctionResponse.ok && healthStatus.status === 'healthy') {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      healthStatus.services.edge_functions = {
        status: 'unhealthy',
        error: (error as Error).message
      };
      if (healthStatus.status === 'healthy') {
        healthStatus.status = 'degraded';
      }
    }

    const totalResponseTime = performance.now() - startTime;
    
    // Record performance metric
    await performanceMonitor.recordCustomMetric(
      'health_check_response_time',
      totalResponseTime,
      'ms',
      { endpoint: '/api/health' }
    );

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    return NextResponse.json({
      ...healthStatus,
      responseTime: totalResponseTime
    }, { status: statusCode });

  } catch (error) {
    const errorResponseTime = performance.now() - startTime;
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      responseTime: errorResponseTime
    }, { status: 503 });
  }
}