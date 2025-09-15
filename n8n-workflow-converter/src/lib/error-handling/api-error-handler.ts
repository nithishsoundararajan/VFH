import { NextRequest, NextResponse } from 'next/server';
import { errorLogger } from '@/lib/logging/error-logger';
import { createClient } from '@/lib/supabase/server';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ApiErrorHandler {
  static createError(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any
  ): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = statusCode;
    error.code = code;
    error.details = details;
    return error;
  }

  static async handleError(
    error: any,
    request: NextRequest,
    context: { userId?: string; projectId?: string } = {}
  ): Promise<NextResponse> {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    const code = error.code || 'INTERNAL_ERROR';

    // Log error to Supabase
    await errorLogger.logError(error, {
      userId: context.userId,
      projectId: context.projectId,
      component: 'api',
      action: `${request.method} ${request.nextUrl.pathname}`,
      url: request.url,
      userAgent: request.headers.get('user-agent') || undefined,
      requestBody: await this.safeGetRequestBody(request),
      statusCode
    }, this.getSeverityFromStatus(statusCode));

    // Don't expose internal errors in production
    const responseMessage = statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : message;

    const response = {
      error: responseMessage,
      code,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error.details
      })
    };

    return NextResponse.json(response, { status: statusCode });
  }

  private static async safeGetRequestBody(request: NextRequest): Promise<any> {
    try {
      const clonedRequest = request.clone();
      const contentType = request.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        return await clonedRequest.json();
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await clonedRequest.formData();
        return Object.fromEntries(formData.entries());
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private static getSeverityFromStatus(statusCode: number): 'low' | 'medium' | 'high' | 'critical' {
    if (statusCode >= 500) return 'critical';
    if (statusCode >= 400) return 'medium';
    return 'low';
  }

  static validation(message: string, details?: any): ApiError {
    return this.createError(message, 400, 'VALIDATION_ERROR', details);
  }

  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return this.createError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden'): ApiError {
    return this.createError(message, 403, 'FORBIDDEN');
  }

  static notFound(message: string = 'Not found'): ApiError {
    return this.createError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string, details?: any): ApiError {
    return this.createError(message, 409, 'CONFLICT', details);
  }

  static tooManyRequests(message: string = 'Too many requests'): ApiError {
    return this.createError(message, 429, 'TOO_MANY_REQUESTS');
  }

  static internal(message: string = 'Internal server error', details?: any): ApiError {
    return this.createError(message, 500, 'INTERNAL_ERROR', details);
  }

  static serviceUnavailable(message: string = 'Service unavailable'): ApiError {
    return this.createError(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

// Middleware wrapper for API routes
export function withErrorHandling(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Extract user context if available
      let userId: string | undefined;
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      } catch {
        // Ignore auth errors in error handler
      }

      return ApiErrorHandler.handleError(error, request, { userId });
    }
  };
}

// Async error wrapper for API route handlers
export function asyncHandler(
  fn: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return withErrorHandling(fn);
}