'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { errorLogger } from '@/lib/logging/error-logger';
import { RetryMechanism } from '@/lib/error-handling/retry-mechanism';
import { useAuth } from '@/hooks/use-auth';

export interface UseErrorHandlerOptions {
  showToast?: boolean;
  redirectOnAuth?: boolean;
  logErrors?: boolean;
  component?: string;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    showToast = true,
    redirectOnAuth = true,
    logErrors = true,
    component
  } = options;

  const router = useRouter();
  const { user } = useAuth();

  const handleError = useCallback(async (
    error: any,
    context: Record<string, any> = {},
    customMessage?: string
  ) => {
    // Log error if enabled
    if (logErrors) {
      await errorLogger.logError(error, {
        userId: user?.id,
        component,
        ...context
      });
    }

    // Handle authentication errors
    if (error?.response?.status === 401 || error?.code === 'UNAUTHORIZED') {
      if (redirectOnAuth) {
        toast.error('Please log in to continue');
        router.push('/auth/login');
        return;
      }
    }

    // Handle forbidden errors
    if (error?.response?.status === 403 || error?.code === 'FORBIDDEN') {
      toast.error('You don\'t have permission to perform this action');
      return;
    }

    // Show user-friendly error message
    if (showToast) {
      const message = customMessage || 
                    error?.response?.data?.message || 
                    error?.message || 
                    'An unexpected error occurred';
      
      toast.error(message);
    }
  }, [user?.id, component, logErrors, showToast, redirectOnAuth, router]);

  const handleApiError = useCallback(async (
    error: any,
    endpoint: string,
    method: string = 'GET',
    customMessage?: string
  ) => {
    await errorLogger.logApiError(error, endpoint, method, {
      userId: user?.id,
      component
    });

    handleError(error, { endpoint, method }, customMessage);
  }, [user?.id, component, handleError]);

  const withErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    errorContext: Record<string, any> = {}
  ) => {
    return async (...args: T): Promise<R | undefined> => {
      try {
        return await fn(...args);
      } catch (error) {
        await handleError(error, errorContext);
        return undefined;
      }
    };
  }, [handleError]);

  const withRetry = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    retryOptions: {
      maxRetries?: number;
      retryCondition?: (error: any) => boolean;
      onRetry?: (error: any, attempt: number) => void;
    } = {}
  ) => {
    return async (...args: T): Promise<R> => {
      return RetryMechanism.withRetry(
        () => fn(...args),
        {
          ...retryOptions,
          context: {
            userId: user?.id,
            component,
            operation: fn.name || 'anonymous'
          },
          onRetry: (error, attempt) => {
            retryOptions.onRetry?.(error, attempt);
            if (showToast && attempt === 1) {
              toast.info(`Retrying... (attempt ${attempt})`);
            }
          }
        }
      );
    };
  }, [user?.id, component, showToast]);

  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(event.reason, { 
        type: 'unhandled_promise_rejection',
        promise: event.promise 
      });
    };

    const handleError = (event: ErrorEvent) => {
      errorLogger.logError(event.error, {
        userId: user?.id,
        component: 'global_error_handler',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [user?.id]);

  return {
    handleError,
    handleApiError,
    withErrorHandling,
    withRetry
  };
}