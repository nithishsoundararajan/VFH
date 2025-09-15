/**
 * Production Monitoring and Alerting Configuration
 * Handles error tracking, performance monitoring, and alerting
 */

import { createClient } from '@supabase/supabase-js'

export interface MonitoringConfig {
  errorTracking: {
    enabled: boolean
    sentryDsn?: string
    sampleRate: number
    environment: string
  }
  performance: {
    enabled: boolean
    sampleRate: number
    thresholds: {
      pageLoad: number
      apiResponse: number
      databaseQuery: number
    }
  }
  healthChecks: {
    enabled: boolean
    interval: number
    endpoints: string[]
  }
  alerts: {
    enabled: boolean
    channels: {
      email?: string[]
      webhook?: string
      slack?: string
    }
    thresholds: {
      errorRate: number
      responseTime: number
      uptime: number
    }
  }
}

/**
 * Production monitoring configuration
 */
export const monitoringConfig: MonitoringConfig = {
  errorTracking: {
    enabled: !!process.env.SENTRY_DSN,
    sentryDsn: process.env.SENTRY_DSN,
    sampleRate: Number(process.env.SENTRY_SAMPLE_RATE) || 0.1,
    environment: process.env.NODE_ENV || 'production'
  },
  
  performance: {
    enabled: true,
    sampleRate: Number(process.env.PERFORMANCE_SAMPLE_RATE) || 0.1,
    thresholds: {
      pageLoad: Number(process.env.PERF_THRESHOLD_PAGE_LOAD) || 3000, // 3 seconds
      apiResponse: Number(process.env.PERF_THRESHOLD_API) || 1000, // 1 second
      databaseQuery: Number(process.env.PERF_THRESHOLD_DB) || 500 // 500ms
    }
  },
  
  healthChecks: {
    enabled: true,
    interval: Number(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
    endpoints: [
      '/api/health',
      '/api/health/database',
      '/api/health/storage',
      '/api/health/external-services'
    ]
  },
  
  alerts: {
    enabled: !!process.env.ALERT_WEBHOOK_URL || !!process.env.ALERT_EMAIL,
    channels: {
      email: process.env.ALERT_EMAIL?.split(','),
      webhook: process.env.ALERT_WEBHOOK_URL,
      slack: process.env.SLACK_WEBHOOK_URL
    },
    thresholds: {
      errorRate: Number(process.env.ALERT_ERROR_RATE) || 0.05, // 5%
      responseTime: Number(process.env.ALERT_RESPONSE_TIME) || 5000, // 5 seconds
      uptime: Number(process.env.ALERT_UPTIME) || 0.99 // 99%
    }
  }
}

/**
 * Error tracking and reporting
 */
export class ErrorTracker {
  private static instance: ErrorTracker
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
    }
    return ErrorTracker.instance
  }
  
  /**
   * Track application error
   */
  async trackError(error: Error, context: {
    userId?: string
    endpoint?: string
    userAgent?: string
    ip?: string
    additionalData?: Record<string, any>
  } = {}) {
    try {
      // Log to Supabase
      await this.supabase.from('error_logs').insert({
        error_message: error.message,
        error_stack: error.stack,
        user_id: context.userId,
        endpoint: context.endpoint,
        user_agent: context.userAgent,
        ip_address: context.ip,
        additional_data: context.additionalData,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      })
      
      // Send to external error tracking (Sentry, etc.)
      if (monitoringConfig.errorTracking.enabled) {
        // This would integrate with Sentry or other error tracking service
        console.error('Error tracked:', {
          message: error.message,
          stack: error.stack,
          context
        })
      }
      
      // Check if error rate threshold is exceeded
      await this.checkErrorRateThreshold()
      
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError)
    }
  }
  
  /**
   * Check if error rate exceeds threshold and send alert
   */
  private async checkErrorRateThreshold() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      
      const { data: errorCount } = await this.supabase
        .from('error_logs')
        .select('id', { count: 'exact' })
        .gte('timestamp', oneHourAgo)
      
      const { data: totalRequests } = await this.supabase
        .from('api_metrics')
        .select('id', { count: 'exact' })
        .gte('timestamp', oneHourAgo)
      
      if (errorCount && totalRequests && totalRequests > 0) {
        const errorRate = errorCount / totalRequests
        
        if (errorRate > monitoringConfig.alerts.thresholds.errorRate) {
          await this.sendAlert({
            type: 'error_rate',
            message: `Error rate exceeded threshold: ${(errorRate * 100).toFixed(2)}%`,
            severity: 'high',
            data: { errorRate, errorCount, totalRequests }
          })
        }
      }
    } catch (error) {
      console.error('Failed to check error rate threshold:', error)
    }
  }
  
  /**
   * Send alert to configured channels
   */
  private async sendAlert(alert: {
    type: string
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    data?: any
  }) {
    if (!monitoringConfig.alerts.enabled) return
    
    const alertPayload = {
      ...alert,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      service: 'n8n-workflow-converter'
    }
    
    // Send to webhook
    if (monitoringConfig.alerts.channels.webhook) {
      try {
        await fetch(monitoringConfig.alerts.channels.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertPayload)
        })
      } catch (error) {
        console.error('Failed to send webhook alert:', error)
      }
    }
    
    // Send to Slack
    if (monitoringConfig.alerts.channels.slack) {
      try {
        await fetch(monitoringConfig.alerts.channels.slack, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}`,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 
                     alert.severity === 'high' ? 'warning' : 'good',
              fields: [
                { title: 'Service', value: 'n8n-workflow-converter', short: true },
                { title: 'Environment', value: process.env.NODE_ENV, short: true },
                { title: 'Type', value: alert.type, short: true },
                { title: 'Timestamp', value: alertPayload.timestamp, short: true }
              ]
            }]
          })
        })
      } catch (error) {
        console.error('Failed to send Slack alert:', error)
      }
    }
    
    // Log alert to database
    try {
      await this.supabase.from('system_alerts').insert({
        alert_type: alert.type,
        message: alert.message,
        severity: alert.severity,
        data: alert.data,
        timestamp: alertPayload.timestamp
      })
    } catch (error) {
      console.error('Failed to log alert to database:', error)
    }
  }
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map()
  
  /**
   * Track performance metric
   */
  static track(metric: string, value: number, tags: Record<string, string> = {}) {
    if (!monitoringConfig.performance.enabled) return
    
    // Sample based on configuration
    if (Math.random() > monitoringConfig.performance.sampleRate) return
    
    const key = `${metric}:${JSON.stringify(tags)}`
    const values = this.metrics.get(key) || []
    values.push(value)
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift()
    }
    
    this.metrics.set(key, values)
    
    // Check thresholds
    this.checkThresholds(metric, value)
  }
  
  /**
   * Check if performance thresholds are exceeded
   */
  private static checkThresholds(metric: string, value: number) {
    const thresholds = monitoringConfig.performance.thresholds
    let threshold: number | undefined
    
    if (metric.includes('page_load')) threshold = thresholds.pageLoad
    else if (metric.includes('api_response')) threshold = thresholds.apiResponse
    else if (metric.includes('db_query')) threshold = thresholds.databaseQuery
    
    if (threshold && value > threshold) {
      ErrorTracker.getInstance().sendAlert({
        type: 'performance',
        message: `Performance threshold exceeded: ${metric} took ${value}ms (threshold: ${threshold}ms)`,
        severity: value > threshold * 2 ? 'high' : 'medium',
        data: { metric, value, threshold }
      } as any)
    }
  }
  
  /**
   * Get performance statistics
   */
  static getStats(metric?: string) {
    const stats: Record<string, {
      count: number
      avg: number
      min: number
      max: number
      p95: number
    }> = {}
    
    for (const [key, values] of this.metrics.entries()) {
      if (metric && !key.startsWith(metric)) continue
      
      const sorted = [...values].sort((a, b) => a - b)
      const p95Index = Math.floor(sorted.length * 0.95)
      
      stats[key] = {
        count: values.length,
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[p95Index] || 0
      }
    }
    
    return stats
  }
}

/**
 * Health check system
 */
export class HealthChecker {
  private static checks: Map<string, {
    status: 'healthy' | 'unhealthy' | 'degraded'
    lastCheck: Date
    message?: string
  }> = new Map()
  
  /**
   * Register a health check
   */
  static async runCheck(name: string, checkFn: () => Promise<boolean>, message?: string) {
    try {
      const isHealthy = await checkFn()
      this.checks.set(name, {
        status: isHealthy ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        message
      })
      return isHealthy
    } catch (error) {
      this.checks.set(name, {
        status: 'unhealthy',
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }
  
  /**
   * Get overall health status
   */
  static getHealthStatus() {
    const checks = Array.from(this.checks.entries()).map(([name, check]) => ({
      name,
      ...check
    }))
    
    const unhealthyChecks = checks.filter(check => check.status === 'unhealthy')
    const degradedChecks = checks.filter(check => check.status === 'degraded')
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    
    if (unhealthyChecks.length > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedChecks.length > 0) {
      overallStatus = 'degraded'
    }
    
    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Initialize monitoring system
 */
export function initializeMonitoring() {
  console.log('🔍 Initializing production monitoring...')
  
  // Set up error tracking
  if (monitoringConfig.errorTracking.enabled) {
    console.log('✅ Error tracking enabled')
  }
  
  // Set up performance monitoring
  if (monitoringConfig.performance.enabled) {
    console.log('✅ Performance monitoring enabled')
  }
  
  // Set up health checks
  if (monitoringConfig.healthChecks.enabled) {
    console.log('✅ Health checks enabled')
    
    // Start health check interval
    setInterval(async () => {
      // Check database
      await HealthChecker.runCheck('database', async () => {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { error } = await supabase.from('profiles').select('count').limit(1)
        return !error
      })
      
      // Check external services
      if (process.env.VIRUSTOTAL_API_KEY) {
        await HealthChecker.runCheck('virustotal', async () => {
          const response = await fetch('https://www.virustotal.com/vtapi/v2/file/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `apikey=${process.env.VIRUSTOTAL_API_KEY}&resource=test`
          })
          return response.status !== 403
        })
      }
    }, monitoringConfig.healthChecks.interval)
  }
  
  // Set up alerts
  if (monitoringConfig.alerts.enabled) {
    console.log('✅ Alerting enabled')
  }
  
  console.log('🎯 Monitoring system initialized')
}