import { createClient } from '@/lib/supabase/client';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  userId?: string;
  projectId?: string;
  component?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, any>;
  traceId?: string;
  sessionId?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp?: string;
}

class StructuredLogger {
  private supabase = createClient();
  private logLevel: LogLevel = 'info';
  private sessionId: string;
  private buffer: LogEntry[] = [];
  private bufferSize = 100;
  private flushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setLogLevel();
    this.startBufferFlush();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setLogLevel(): void {
    const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel;
    if (envLevel && ['debug', 'info', 'warn', 'error', 'fatal'].includes(envLevel)) {
      this.logLevel = envLevel;
    } else {
      this.logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    return levels[level] >= levels[this.logLevel];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata: Record<string, any> = {}
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      traceId: metadata.traceId || this.generateTraceId(),
      ...metadata
    };
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  private startBufferFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        entries.forEach(entry => {
          const logMethod = entry.level === 'error' || entry.level === 'fatal' 
            ? console.error 
            : entry.level === 'warn' 
            ? console.warn 
            : console.log;

          logMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, {
            timestamp: entry.timestamp,
            component: entry.component,
            metadata: entry.metadata
          });
        });
      }

      // Store in Supabase for production logging
      const { error } = await this.supabase
        .from('application_logs')
        .insert(entries.map(entry => ({
          level: entry.level,
          message: entry.message,
          timestamp: entry.timestamp,
          user_id: entry.userId,
          project_id: entry.projectId,
          component: entry.component,
          action: entry.action,
          duration_ms: entry.duration,
          metadata: entry.metadata || {},
          trace_id: entry.traceId,
          session_id: entry.sessionId
        })));

      if (error) {
        console.error('Failed to flush logs to Supabase:', error);
        // Re-add entries to buffer for retry
        this.buffer.unshift(...entries);
      }
    } catch (error) {
      console.error('Error flushing logs:', error);
      // Re-add entries to buffer for retry
      this.buffer.unshift(...entries);
    }
  }

  debug(message: string, metadata: Record<string, any> = {}): void {
    if (!this.shouldLog('debug')) return;
    
    const entry = this.createLogEntry('debug', message, metadata);
    this.addToBuffer(entry);
  }

  info(message: string, metadata: Record<string, any> = {}): void {
    if (!this.shouldLog('info')) return;
    
    const entry = this.createLogEntry('info', message, metadata);
    this.addToBuffer(entry);
  }

  warn(message: string, metadata: Record<string, any> = {}): void {
    if (!this.shouldLog('warn')) return;
    
    const entry = this.createLogEntry('warn', message, metadata);
    this.addToBuffer(entry);
  }

  error(message: string, error?: Error, metadata: Record<string, any> = {}): void {
    if (!this.shouldLog('error')) return;
    
    const entry = this.createLogEntry('error', message, {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
    this.addToBuffer(entry);
  }

  fatal(message: string, error?: Error, metadata: Record<string, any> = {}): void {
    const entry = this.createLogEntry('fatal', message, {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
    this.addToBuffer(entry);
    
    // Immediately flush fatal errors
    this.flush();
  }

  // Performance logging
  async logPerformance(metric: PerformanceMetric, context: Record<string, any> = {}): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('performance_metrics')
        .insert({
          metric_name: metric.name,
          metric_value: metric.value,
          metric_unit: metric.unit,
          context: {
            ...context,
            tags: metric.tags,
            timestamp: metric.timestamp || new Date().toISOString(),
            session_id: this.sessionId
          },
          user_id: context.userId,
          project_id: context.projectId
        });

      if (error) {
        console.error('Failed to log performance metric:', error);
      }
    } catch (error) {
      console.error('Error logging performance metric:', error);
    }
  }

  // Timing utilities
  startTimer(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.logPerformance({
        name,
        value: duration,
        unit: 'ms'
      });
      
      return duration;
    };
  }

  async withTiming<T>(
    name: string,
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const startTime = performance.now();
    const traceId = this.generateTraceId();
    
    this.info(`Starting ${name}`, { ...context, traceId });
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      this.info(`Completed ${name}`, { 
        ...context, 
        traceId, 
        duration: `${duration.toFixed(2)}ms` 
      });
      
      await this.logPerformance({
        name,
        value: duration,
        unit: 'ms'
      }, { ...context, traceId });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.error(`Failed ${name}`, error as Error, { 
        ...context, 
        traceId, 
        duration: `${duration.toFixed(2)}ms` 
      });
      
      throw error;
    }
  }

  // User action logging
  logUserAction(
    action: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): void {
    this.info(`User action: ${action}`, {
      userId,
      component: 'user_action',
      action,
      ...metadata
    });
  }

  // API request logging
  logApiRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    metadata: Record<string, any> = {}
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this[level](`API ${method} ${endpoint} - ${statusCode}`, {
      component: 'api',
      method,
      endpoint,
      statusCode,
      duration,
      ...metadata
    });
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

export const logger = new StructuredLogger();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    logger.destroy();
  });
}