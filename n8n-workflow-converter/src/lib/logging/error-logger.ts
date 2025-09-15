import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface ErrorContext {
  userId?: string;
  projectId?: string;
  component?: string;
  action?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  errorId?: string;
  componentStack?: string;
  errorBoundary?: boolean;
  [key: string]: any;
}

export interface ErrorLogEntry {
  id?: string;
  user_id?: string;
  project_id?: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  created_at?: string;
}

class ErrorLogger {
  private supabase = createClient();
  private maxRetries = 3;
  private retryDelay = 1000;

  async logError(
    error: Error | string,
    context: ErrorContext = {},
    severity: ErrorLogEntry['severity'] = 'medium'
  ): Promise<string | null> {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const errorStack = typeof error === 'string' ? undefined : error.stack;
      
      const logEntry: Omit<ErrorLogEntry, 'id' | 'created_at'> = {
        user_id: context.userId,
        project_id: context.projectId,
        error_type: typeof error === 'string' ? 'manual' : error.constructor.name,
        error_message: errorMessage,
        error_stack: errorStack,
        context: {
          ...context,
          url: window?.location?.href,
          userAgent: navigator?.userAgent,
          timestamp: new Date().toISOString()
        },
        severity,
        resolved: false
      };

      const { data, error: supabaseError } = await this.supabase
        .from('error_logs')
        .insert(logEntry)
        .select('id')
        .single();

      if (supabaseError) {
        console.error('Failed to log error to Supabase:', supabaseError);
        // Fallback to local storage for offline scenarios
        this.logToLocalStorage(logEntry);
        return null;
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error logged:', {
          id: data.id,
          message: errorMessage,
          context,
          severity
        });
      }

      return data.id;
    } catch (loggingError) {
      console.error('Error logging failed:', loggingError);
      this.logToLocalStorage({
        error_type: 'logging_failure',
        error_message: `Failed to log error: ${loggingError}`,
        context,
        severity: 'high',
        resolved: false
      });
      return null;
    }
  }

  async logApiError(
    error: any,
    endpoint: string,
    method: string,
    context: ErrorContext = {}
  ): Promise<string | null> {
    const errorMessage = error?.response?.data?.message || error?.message || 'Unknown API error';
    const statusCode = error?.response?.status;
    
    return this.logError(error, {
      ...context,
      component: 'api',
      action: `${method} ${endpoint}`,
      statusCode,
      responseData: error?.response?.data
    }, statusCode >= 500 ? 'high' : 'medium');
  }

  async logUserAction(
    action: string,
    context: ErrorContext = {},
    success: boolean = true
  ): Promise<void> {
    if (!success) {
      await this.logError(`User action failed: ${action}`, {
        ...context,
        component: 'user_action',
        action
      }, 'low');
    }
  }

  private logToLocalStorage(logEntry: Omit<ErrorLogEntry, 'id' | 'created_at'>): void {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      const newLog = {
        ...logEntry,
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString()
      };
      
      existingLogs.push(newLog);
      
      // Keep only last 50 logs to prevent storage overflow
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      
      localStorage.setItem('error_logs', JSON.stringify(existingLogs));
    } catch (storageError) {
      console.error('Failed to log to localStorage:', storageError);
    }
  }

  async syncLocalLogs(): Promise<void> {
    try {
      const localLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      
      if (localLogs.length === 0) return;

      const { error } = await this.supabase
        .from('error_logs')
        .insert(localLogs.map((log: any) => ({
          ...log,
          id: undefined, // Let Supabase generate new IDs
          context: {
            ...log.context,
            synced_from_local: true
          }
        })));

      if (!error) {
        localStorage.removeItem('error_logs');
        console.log(`Synced ${localLogs.length} local error logs to Supabase`);
      }
    } catch (syncError) {
      console.error('Failed to sync local logs:', syncError);
    }
  }

  async retryFailedOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        await this.logError(error as Error, {
          ...context,
          attempt,
          maxRetries,
          component: 'retry_mechanism'
        }, attempt === maxRetries ? 'high' : 'low');

        if (attempt < maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
          );
        }
      }
    }
    
    throw lastError!;
  }

  showUserFriendlyError(error: any, fallbackMessage: string = 'An unexpected error occurred'): void {
    let message = fallbackMessage;
    
    if (error?.response?.data?.message) {
      message = error.response.data.message;
    } else if (error?.message) {
      message = error.message;
    }
    
    // Show user-friendly messages for common errors
    if (error?.response?.status === 401) {
      message = 'Please log in to continue';
    } else if (error?.response?.status === 403) {
      message = 'You don\'t have permission to perform this action';
    } else if (error?.response?.status === 404) {
      message = 'The requested resource was not found';
    } else if (error?.response?.status >= 500) {
      message = 'Server error. Please try again later';
    }
    
    toast.error(message);
  }
}

export const errorLogger = new ErrorLogger();

// Initialize sync on app start
if (typeof window !== 'undefined') {
  errorLogger.syncLocalLogs();
}