import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logging/structured-logger';

export interface LogQuery {
  level?: string[];
  component?: string[];
  userId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LogAnalysis {
  totalLogs: number;
  errorRate: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurrence: string;
  }>;
  componentBreakdown: Array<{
    component: string;
    count: number;
    errorCount: number;
  }>;
  timeSeriesData: Array<{
    timestamp: string;
    count: number;
    errorCount: number;
  }>;
  performanceMetrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    slowestEndpoints: Array<{
      endpoint: string;
      averageTime: number;
      count: number;
    }>;
  };
}

export interface AlertCondition {
  id: string;
  name: string;
  description: string;
  query: LogQuery;
  threshold: number;
  timeWindow: number; // minutes
  enabled: boolean;
  lastTriggered?: string;
  notificationChannels: string[];
}

class LogAggregator {
  private supabase = createClient();

  async queryLogs(query: LogQuery): Promise<any[]> {
    try {
      let supabaseQuery = this.supabase
        .from('application_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply filters
      if (query.level && query.level.length > 0) {
        supabaseQuery = supabaseQuery.in('level', query.level);
      }

      if (query.component && query.component.length > 0) {
        supabaseQuery = supabaseQuery.in('component', query.component);
      }

      if (query.userId) {
        supabaseQuery = supabaseQuery.eq('user_id', query.userId);
      }

      if (query.projectId) {
        supabaseQuery = supabaseQuery.eq('project_id', query.projectId);
      }

      if (query.startDate) {
        supabaseQuery = supabaseQuery.gte('timestamp', query.startDate);
      }

      if (query.endDate) {
        supabaseQuery = supabaseQuery.lte('timestamp', query.endDate);
      }

      if (query.search) {
        supabaseQuery = supabaseQuery.ilike('message', `%${query.search}%`);
      }

      if (query.limit) {
        supabaseQuery = supabaseQuery.limit(query.limit);
      }

      if (query.offset) {
        supabaseQuery = supabaseQuery.range(query.offset, query.offset + (query.limit || 50) - 1);
      }

      const { data, error } = await supabaseQuery;

      if (error) {
        logger.error('Failed to query logs', error as Error, {
          component: 'log_aggregator',
          query
        });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error querying logs', error as Error, {
        component: 'log_aggregator',
        query
      });
      return [];
    }
  }

  async analyzeLogs(query: LogQuery): Promise<LogAnalysis> {
    try {
      const logs = await this.queryLogs({ ...query, limit: 10000 });
      
      // Calculate basic metrics
      const totalLogs = logs.length;
      const errorLogs = logs.filter(log => log.level === 'error' || log.level === 'fatal');
      const errorRate = totalLogs > 0 ? (errorLogs.length / totalLogs) * 100 : 0;

      // Top errors analysis
      const errorGroups = new Map<string, { count: number; lastOccurrence: string }>();
      errorLogs.forEach(log => {
        const key = log.message;
        const existing = errorGroups.get(key);
        if (existing) {
          existing.count++;
          if (log.timestamp > existing.lastOccurrence) {
            existing.lastOccurrence = log.timestamp;
          }
        } else {
          errorGroups.set(key, { count: 1, lastOccurrence: log.timestamp });
        }
      });

      const topErrors = Array.from(errorGroups.entries())
        .map(([message, data]) => ({ message, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Component breakdown
      const componentGroups = new Map<string, { count: number; errorCount: number }>();
      logs.forEach(log => {
        const component = log.component || 'unknown';
        const existing = componentGroups.get(component);
        const isError = log.level === 'error' || log.level === 'fatal';
        
        if (existing) {
          existing.count++;
          if (isError) existing.errorCount++;
        } else {
          componentGroups.set(component, { count: 1, errorCount: isError ? 1 : 0 });
        }
      });

      const componentBreakdown = Array.from(componentGroups.entries())
        .map(([component, data]) => ({ component, ...data }))
        .sort((a, b) => b.count - a.count);

      // Time series data (hourly buckets)
      const timeSeriesMap = new Map<string, { count: number; errorCount: number }>();
      logs.forEach(log => {
        const hour = new Date(log.timestamp).toISOString().slice(0, 13) + ':00:00.000Z';
        const existing = timeSeriesMap.get(hour);
        const isError = log.level === 'error' || log.level === 'fatal';
        
        if (existing) {
          existing.count++;
          if (isError) existing.errorCount++;
        } else {
          timeSeriesMap.set(hour, { count: 1, errorCount: isError ? 1 : 0 });
        }
      });

      const timeSeriesData = Array.from(timeSeriesMap.entries())
        .map(([timestamp, data]) => ({ timestamp, ...data }))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Performance metrics
      const performanceMetrics = await this.analyzePerformanceMetrics(query);

      return {
        totalLogs,
        errorRate,
        topErrors,
        componentBreakdown,
        timeSeriesData,
        performanceMetrics
      };
    } catch (error) {
      logger.error('Error analyzing logs', error as Error, {
        component: 'log_aggregator',
        query
      });
      
      return {
        totalLogs: 0,
        errorRate: 0,
        topErrors: [],
        componentBreakdown: [],
        timeSeriesData: [],
        performanceMetrics: {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          slowestEndpoints: []
        }
      };
    }
  }

  private async analyzePerformanceMetrics(query: LogQuery): Promise<LogAnalysis['performanceMetrics']> {
    try {
      let metricsQuery = this.supabase
        .from('performance_metrics')
        .select('*')
        .eq('metric_name', 'api_response_time');

      if (query.startDate) {
        metricsQuery = metricsQuery.gte('created_at', query.startDate);
      }

      if (query.endDate) {
        metricsQuery = metricsQuery.lte('created_at', query.endDate);
      }

      if (query.userId) {
        metricsQuery = metricsQuery.eq('user_id', query.userId);
      }

      const { data: metrics, error } = await metricsQuery;

      if (error || !metrics) {
        return {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          slowestEndpoints: []
        };
      }

      // Calculate average response time
      const responseTimes = metrics.map(m => m.metric_value);
      const averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0;

      // Calculate P95 response time
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95ResponseTime = sortedTimes.length > 0 ? sortedTimes[p95Index] || 0 : 0;

      // Analyze slowest endpoints
      const endpointGroups = new Map<string, { times: number[]; count: number }>();
      metrics.forEach(metric => {
        const endpoint = metric.context?.tags?.endpoint || 'unknown';
        const existing = endpointGroups.get(endpoint);
        
        if (existing) {
          existing.times.push(metric.metric_value);
          existing.count++;
        } else {
          endpointGroups.set(endpoint, { times: [metric.metric_value], count: 1 });
        }
      });

      const slowestEndpoints = Array.from(endpointGroups.entries())
        .map(([endpoint, data]) => ({
          endpoint,
          averageTime: data.times.reduce((sum, time) => sum + time, 0) / data.times.length,
          count: data.count
        }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10);

      return {
        averageResponseTime,
        p95ResponseTime,
        slowestEndpoints
      };
    } catch (error) {
      logger.error('Error analyzing performance metrics', error as Error);
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        slowestEndpoints: []
      };
    }
  }

  async createAlert(condition: Omit<AlertCondition, 'id'>): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('alert_conditions')
        .insert({
          name: condition.name,
          description: condition.description,
          query_config: condition.query,
          threshold: condition.threshold,
          time_window_minutes: condition.timeWindow,
          enabled: condition.enabled,
          notification_channels: condition.notificationChannels
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to create alert condition', error as Error);
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Error creating alert condition', error as Error);
      return null;
    }
  }

  async checkAlerts(): Promise<void> {
    try {
      const { data: conditions, error } = await this.supabase
        .from('alert_conditions')
        .select('*')
        .eq('enabled', true);

      if (error || !conditions) {
        logger.error('Failed to fetch alert conditions', error as Error);
        return;
      }

      for (const condition of conditions) {
        await this.evaluateAlert(condition);
      }
    } catch (error) {
      logger.error('Error checking alerts', error as Error);
    }
  }

  private async evaluateAlert(condition: any): Promise<void> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - condition.time_window_minutes * 60 * 1000);

      const query: LogQuery = {
        ...condition.query_config,
        startDate: startTime.toISOString(),
        endDate: endTime.toISOString()
      };

      const logs = await this.queryLogs(query);
      const count = logs.length;

      if (count >= condition.threshold) {
        await this.triggerAlert(condition, count);
      }
    } catch (error) {
      logger.error('Error evaluating alert', error as Error, {
        alertId: condition.id,
        alertName: condition.name
      });
    }
  }

  private async triggerAlert(condition: any, actualValue: number): Promise<void> {
    try {
      // Update last triggered time
      await this.supabase
        .from('alert_conditions')
        .update({ last_triggered: new Date().toISOString() })
        .eq('id', condition.id);

      // Log the alert
      logger.warn(`Alert triggered: ${condition.name}`, {
        component: 'alert_system',
        alertId: condition.id,
        alertName: condition.name,
        threshold: condition.threshold,
        actualValue,
        timeWindow: condition.time_window_minutes
      });

      // Here you would integrate with notification services
      // For now, we'll just log it
      console.warn(`🚨 Alert: ${condition.name} - Value: ${actualValue}, Threshold: ${condition.threshold}`);
    } catch (error) {
      logger.error('Error triggering alert', error as Error, {
        alertId: condition.id
      });
    }
  }

  async exportLogs(query: LogQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.queryLogs(query);

    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'message', 'component', 'user_id', 'project_id'];
      const csvRows = [
        headers.join(','),
        ...logs.map(log => 
          headers.map(header => 
            JSON.stringify(log[header] || '')
          ).join(',')
        )
      ];
      return csvRows.join('\n');
    }

    return JSON.stringify(logs, null, 2);
  }
}

export const logAggregator = new LogAggregator();