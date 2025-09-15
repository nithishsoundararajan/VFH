import { createClient } from '@/lib/supabase/server';

export interface AuditLogEntry {
  id?: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string;
  user_agent: string;
  created_at?: string;
}

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  resourceType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogSummary {
  totalEvents: number;
  uniqueUsers: number;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resourceType: string; count: number }>;
  timeRange: {
    earliest: string;
    latest: string;
  };
}

/**
 * Comprehensive audit logging service for compliance and security monitoring
 */
export class AuditLogger {
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'api_key',
    'secret',
    'token',
    'credential',
    'private_key'
  ];

  /**
   * Log an audit event
   */
  static async log(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<string | null> {
    try {
      const supabase = await createClient();
      
      // Sanitize sensitive data from details
      const sanitizedDetails = this.sanitizeDetails(entry.details);
      
      const auditEntry = {
        ...entry,
        details: sanitizedDetails,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('audit_logs')
        .insert(auditEntry)
        .select('id')
        .single();

      if (error) {
        console.error('Failed to log audit event:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Audit logging error:', error);
      return null;
    }
  }

  /**
   * Log user authentication events
   */
  static async logAuth(
    userId: string | null,
    action: 'login_success' | 'login_failure' | 'logout' | 'password_reset' | 'account_created',
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      resource_type: 'authentication',
      resource_id: userId,
      details: details || null,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  /**
   * Log data access events
   */
  static async logDataAccess(
    userId: string,
    action: 'read' | 'create' | 'update' | 'delete',
    resourceType: string,
    resourceId: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action: `${resourceType}_${action}`,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details || null,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  /**
   * Log privacy and compliance events
   */
  static async logPrivacyEvent(
    userId: string,
    action: 'consent_given' | 'consent_withdrawn' | 'data_export' | 'data_deletion' | 'privacy_settings_updated',
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      resource_type: 'privacy',
      resource_id: userId,
      details: details || null,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(
    userId: string | null,
    action: 'suspicious_activity' | 'rate_limit_exceeded' | 'file_quarantined' | 'csrf_violation' | 'session_hijack_attempt',
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      resource_type: 'security',
      resource_id: userId,
      details: details || null,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  /**
   * Log administrative actions
   */
  static async logAdminAction(
    adminUserId: string,
    action: string,
    targetResourceType: string,
    targetResourceId: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: adminUserId,
      action: `admin_${action}`,
      resource_type: targetResourceType,
      resource_id: targetResourceId,
      details: {
        ...details,
        admin_action: true,
        target_resource: {
          type: targetResourceType,
          id: targetResourceId
        }
      },
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  /**
   * Get audit logs with filtering
   */
  static async getLogs(filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    try {
      const supabase = await createClient();
      
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }

      if (filter.action) {
        query = query.eq('action', filter.action);
      }

      if (filter.resourceType) {
        query = query.eq('resource_type', filter.resourceType);
      }

      if (filter.ipAddress) {
        query = query.eq('ip_address', filter.ipAddress);
      }

      if (filter.dateFrom) {
        query = query.gte('created_at', filter.dateFrom.toISOString());
      }

      if (filter.dateTo) {
        query = query.lte('created_at', filter.dateTo.toISOString());
      }

      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      if (filter.offset) {
        query = query.range(filter.offset, filter.offset + (filter.limit || 100) - 1);
      }

      const { data: logs, error } = await query;

      if (error) {
        throw error;
      }

      return logs || [];
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit log summary statistics
   */
  static async getSummary(filter: AuditLogFilter = {}): Promise<AuditLogSummary> {
    try {
      const supabase = await createClient();
      
      // Build base query
      let baseQuery = supabase.from('audit_logs').select('*');
      
      if (filter.dateFrom) {
        baseQuery = baseQuery.gte('created_at', filter.dateFrom.toISOString());
      }
      
      if (filter.dateTo) {
        baseQuery = baseQuery.lte('created_at', filter.dateTo.toISOString());
      }

      const { data: logs, error } = await baseQuery;

      if (error) {
        throw error;
      }

      if (!logs || logs.length === 0) {
        return {
          totalEvents: 0,
          uniqueUsers: 0,
          topActions: [],
          topResources: [],
          timeRange: {
            earliest: new Date().toISOString(),
            latest: new Date().toISOString()
          }
        };
      }

      // Calculate statistics
      const totalEvents = logs.length;
      const uniqueUsers = new Set(logs.map(log => log.user_id).filter(Boolean)).size;
      
      // Top actions
      const actionCounts = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topActions = Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      // Top resource types
      const resourceCounts = logs.reduce((acc, log) => {
        acc[log.resource_type] = (acc[log.resource_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topResources = Object.entries(resourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([resourceType, count]) => ({ resourceType, count }));

      // Time range
      const timestamps = logs.map(log => new Date(log.created_at!).getTime());
      const earliest = new Date(Math.min(...timestamps)).toISOString();
      const latest = new Date(Math.max(...timestamps)).toISOString();

      return {
        totalEvents,
        uniqueUsers,
        topActions,
        topResources,
        timeRange: { earliest, latest }
      };
    } catch (error) {
      console.error('Failed to get audit log summary:', error);
      return {
        totalEvents: 0,
        uniqueUsers: 0,
        topActions: [],
        topResources: [],
        timeRange: {
          earliest: new Date().toISOString(),
          latest: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Export audit logs for compliance reporting
   */
  static async exportLogs(
    filter: AuditLogFilter = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const logs = await this.getLogs(filter);
      
      if (format === 'csv') {
        return this.convertLogsToCSV(logs);
      }
      
      return JSON.stringify(logs, null, 2);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  static async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const supabase = await createClient();
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const { count, error } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
      return 0;
    }
  }

  /**
   * Sanitize sensitive data from audit log details
   */
  private static sanitizeDetails(details: Record<string, any> | null): Record<string, any> | null {
    if (!details || typeof details !== 'object') {
      return details;
    }

    const sanitized = { ...details };

    // Recursively sanitize nested objects
    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }
      
      if (obj && typeof obj === 'object') {
        const sanitizedObj: any = {};
        
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          
          // Check if key contains sensitive field names
          const isSensitive = this.SENSITIVE_FIELDS.some(field => 
            lowerKey.includes(field)
          );
          
          if (isSensitive) {
            sanitizedObj[key] = '[REDACTED]';
          } else if (value && typeof value === 'object') {
            sanitizedObj[key] = sanitizeObject(value);
          } else {
            sanitizedObj[key] = value;
          }
        }
        
        return sanitizedObj;
      }
      
      return obj;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Convert audit logs to CSV format
   */
  private static convertLogsToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) {
      return 'id,user_id,action,resource_type,resource_id,ip_address,user_agent,created_at,details\n';
    }

    const headers = ['id', 'user_id', 'action', 'resource_type', 'resource_id', 'ip_address', 'user_agent', 'created_at', 'details'];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const values = headers.map(header => {
        let value = log[header as keyof AuditLogEntry];
        
        if (value === null || value === undefined) {
          return '';
        }
        
        if (header === 'details' && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

/**
 * Audit log middleware for automatic logging
 */
export class AuditMiddleware {
  /**
   * Create audit log middleware for API routes
   */
  static createMiddleware() {
    return async (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const originalSend = res.send;
      
      // Capture response
      res.send = function(data: any) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // Log API access
        AuditLogger.log({
          user_id: req.user?.id || null,
          action: 'api_access',
          resource_type: 'api_endpoint',
          resource_id: req.path,
          details: {
            method: req.method,
            statusCode,
            duration,
            query: req.query,
            params: req.params
          },
          ip_address: req.ip || req.connection.remoteAddress || 'unknown',
          user_agent: req.get('User-Agent') || 'unknown'
        }).catch(console.error);
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
}