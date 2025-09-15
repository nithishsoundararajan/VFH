import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logging/structured-logger';
import { toast } from 'sonner';

export interface ErrorNotification {
  id: string;
  errorId: string;
  userId?: string;
  type: 'email' | 'push' | 'in_app' | 'webhook';
  recipient: string;
  subject: string;
  message: string;
  sent: boolean;
  sentAt?: string;
  error?: string;
}

export interface ErrorPattern {
  id: string;
  pattern: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolve: boolean;
  notificationEnabled: boolean;
  occurrences: number;
  lastSeen: string;
}

export interface ErrorResolution {
  errorId: string;
  resolvedBy: string;
  resolution: string;
  preventionSteps?: string;
  resolvedAt: string;
}

class ErrorTracker {
  private supabase = createClient();
  private notificationQueue: ErrorNotification[] = [];
  private processingQueue = false;

  constructor() {
    this.startNotificationProcessor();
  }

  async trackError(
    error: Error | string,
    context: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<string | null> {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const errorStack = typeof error === 'string' ? undefined : error.stack;
      
      // Check for existing patterns
      const pattern = await this.findMatchingPattern(errorMessage);
      
      const errorEntry = {
        error_type: typeof error === 'string' ? 'manual' : error.constructor.name,
        error_message: errorMessage,
        error_stack: errorStack,
        context,
        severity,
        pattern_id: pattern?.id,
        user_id: context.userId,
        project_id: context.projectId,
        resolved: false
      };

      const { data, error: supabaseError } = await this.supabase
        .from('error_logs')
        .insert(errorEntry)
        .select('id')
        .single();

      if (supabaseError) {
        console.error('Failed to track error:', supabaseError);
        return null;
      }

      const errorId = data.id;

      // Update pattern occurrence count
      if (pattern) {
        await this.updatePatternOccurrence(pattern.id);
      } else {
        // Create new pattern if this is a recurring error
        await this.createPatternIfRecurring(errorMessage, severity);
      }

      // Check if notification should be sent
      await this.checkNotificationRules(errorId, errorMessage, severity, context);

      // Auto-resolve if pattern allows it
      if (pattern?.autoResolve && severity === 'low') {
        await this.autoResolveError(errorId, 'Auto-resolved based on pattern configuration');
      }

      return errorId;
    } catch (trackingError) {
      console.error('Error tracking failed:', trackingError);
      return null;
    }
  }

  private async findMatchingPattern(errorMessage: string): Promise<ErrorPattern | null> {
    try {
      const { data: patterns, error } = await this.supabase
        .from('error_patterns')
        .select('*')
        .order('occurrences', { ascending: false });

      if (error || !patterns) return null;

      // Simple pattern matching - in production, you might use more sophisticated matching
      for (const pattern of patterns) {
        if (errorMessage.includes(pattern.pattern) || 
            new RegExp(pattern.pattern, 'i').test(errorMessage)) {
          return pattern;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding pattern:', error);
      return null;
    }
  }

  private async updatePatternOccurrence(patternId: string): Promise<void> {
    try {
      await this.supabase
        .from('error_patterns')
        .update({ 
          occurrences: this.supabase.rpc('increment_occurrences'),
          last_seen: new Date().toISOString()
        })
        .eq('id', patternId);
    } catch (error) {
      console.error('Error updating pattern occurrence:', error);
    }
  }

  private async createPatternIfRecurring(
    errorMessage: string, 
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    try {
      // Check if this error has occurred multiple times recently
      const { data: recentErrors, error } = await this.supabase
        .from('error_logs')
        .select('id')
        .eq('error_message', errorMessage)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error || !recentErrors || recentErrors.length < 3) return;

      // Create new pattern
      await this.supabase
        .from('error_patterns')
        .insert({
          pattern: errorMessage,
          description: `Auto-generated pattern for recurring error: ${errorMessage.substring(0, 100)}`,
          severity,
          auto_resolve: severity === 'low',
          notification_enabled: severity !== 'low',
          occurrences: recentErrors.length,
          last_seen: new Date().toISOString()
        });

      logger.info('Created new error pattern', {
        component: 'error_tracker',
        pattern: errorMessage,
        occurrences: recentErrors.length
      });
    } catch (error) {
      console.error('Error creating pattern:', error);
    }
  }

  private async checkNotificationRules(
    errorId: string,
    errorMessage: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: Record<string, any>
  ): Promise<void> {
    // Don't notify for low severity errors unless they're critical patterns
    if (severity === 'low') return;

    // Check if we've already notified about this error recently
    const recentNotification = await this.hasRecentNotification(errorMessage);
    if (recentNotification) return;

    // Create notification
    const notification: Omit<ErrorNotification, 'id'> = {
      errorId,
      userId: context.userId,
      type: 'in_app',
      recipient: context.userId || 'system',
      subject: `${severity.toUpperCase()} Error Detected`,
      message: `Error: ${errorMessage}`,
      sent: false
    };

    this.queueNotification(notification);

    // For critical errors, also send immediate notification
    if (severity === 'critical') {
      await this.sendImmediateNotification(notification);
    }
  }

  private async hasRecentNotification(errorMessage: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('error_notifications')
        .select('id')
        .eq('message', `Error: ${errorMessage}`)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .limit(1);

      return !error && data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  private queueNotification(notification: Omit<ErrorNotification, 'id'>): void {
    this.notificationQueue.push({
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }

  private async sendImmediateNotification(notification: Omit<ErrorNotification, 'id'>): Promise<void> {
    try {
      // For in-app notifications, show toast
      if (notification.type === 'in_app') {
        toast.error(notification.message, {
          description: notification.subject,
          duration: 10000
        });
      }

      // Store notification in database
      await this.supabase
        .from('error_notifications')
        .insert({
          error_id: notification.errorId,
          user_id: notification.userId,
          type: notification.type,
          recipient: notification.recipient,
          subject: notification.subject,
          message: notification.message,
          sent: true,
          sent_at: new Date().toISOString()
        });

      logger.info('Sent immediate error notification', {
        component: 'error_tracker',
        errorId: notification.errorId,
        type: notification.type
      });
    } catch (error) {
      logger.error('Failed to send immediate notification', error as Error, {
        component: 'error_tracker',
        errorId: notification.errorId
      });
    }
  }

  private startNotificationProcessor(): void {
    setInterval(async () => {
      if (this.processingQueue || this.notificationQueue.length === 0) return;

      this.processingQueue = true;
      
      try {
        const notifications = [...this.notificationQueue];
        this.notificationQueue = [];

        for (const notification of notifications) {
          await this.processNotification(notification);
        }
      } catch (error) {
        logger.error('Error processing notification queue', error as Error);
      } finally {
        this.processingQueue = false;
      }
    }, 5000); // Process every 5 seconds
  }

  private async processNotification(notification: ErrorNotification): Promise<void> {
    try {
      // Store notification in database
      const { error } = await this.supabase
        .from('error_notifications')
        .insert({
          error_id: notification.errorId,
          user_id: notification.userId,
          type: notification.type,
          recipient: notification.recipient,
          subject: notification.subject,
          message: notification.message,
          sent: true,
          sent_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Failed to store notification', error as Error);
        return;
      }

      // Send notification based on type
      switch (notification.type) {
        case 'in_app':
          toast.error(notification.message, {
            description: notification.subject
          });
          break;
        case 'email':
          // Integrate with email service
          break;
        case 'push':
          // Integrate with push notification service
          break;
        case 'webhook':
          // Send webhook
          break;
      }

      logger.info('Processed error notification', {
        component: 'error_tracker',
        notificationId: notification.id,
        type: notification.type
      });
    } catch (error) {
      logger.error('Failed to process notification', error as Error, {
        component: 'error_tracker',
        notificationId: notification.id
      });
    }
  }

  async resolveError(
    errorId: string,
    resolvedBy: string,
    resolution: string,
    preventionSteps?: string
  ): Promise<boolean> {
    try {
      // Update error as resolved
      const { error: updateError } = await this.supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          resolution_notes: resolution
        })
        .eq('id', errorId);

      if (updateError) {
        logger.error('Failed to resolve error', updateError as Error);
        return false;
      }

      // Store resolution details
      await this.supabase
        .from('error_resolutions')
        .insert({
          error_id: errorId,
          resolved_by: resolvedBy,
          resolution,
          prevention_steps: preventionSteps,
          resolved_at: new Date().toISOString()
        });

      logger.info('Error resolved', {
        component: 'error_tracker',
        errorId,
        resolvedBy
      });

      return true;
    } catch (error) {
      logger.error('Error resolving error', error as Error, {
        component: 'error_tracker',
        errorId
      });
      return false;
    }
  }

  private async autoResolveError(errorId: string, reason: string): Promise<void> {
    await this.resolveError(errorId, 'system', reason);
  }

  async getErrorStats(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<{
    totalErrors: number;
    resolvedErrors: number;
    criticalErrors: number;
    errorRate: number;
    topErrors: Array<{ message: string; count: number }>;
  }> {
    try {
      const timeRanges = {
        hour: 1,
        day: 24,
        week: 24 * 7,
        month: 24 * 30
      };

      const startTime = new Date(Date.now() - timeRanges[timeRange] * 60 * 60 * 1000);

      const { data: errors, error } = await this.supabase
        .from('error_logs')
        .select('*')
        .gte('created_at', startTime.toISOString());

      if (error || !errors) {
        return {
          totalErrors: 0,
          resolvedErrors: 0,
          criticalErrors: 0,
          errorRate: 0,
          topErrors: []
        };
      }

      const totalErrors = errors.length;
      const resolvedErrors = errors.filter(e => e.resolved).length;
      const criticalErrors = errors.filter(e => e.severity === 'critical').length;
      
      // Calculate error rate (errors per hour)
      const errorRate = totalErrors / timeRanges[timeRange];

      // Top errors
      const errorGroups = new Map<string, number>();
      errors.forEach(error => {
        const count = errorGroups.get(error.error_message) || 0;
        errorGroups.set(error.error_message, count + 1);
      });

      const topErrors = Array.from(errorGroups.entries())
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalErrors,
        resolvedErrors,
        criticalErrors,
        errorRate,
        topErrors
      };
    } catch (error) {
      logger.error('Error getting error stats', error as Error);
      return {
        totalErrors: 0,
        resolvedErrors: 0,
        criticalErrors: 0,
        errorRate: 0,
        topErrors: []
      };
    }
  }
}

export const errorTracker = new ErrorTracker();