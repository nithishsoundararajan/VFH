import { NextRequest, NextResponse } from 'next/server';
import { InputValidator } from './input-validator';
import { virusScanner, fileQuarantine } from './virus-scanner';
import { rateLimiters, abuseDetector } from './rate-limiter';
import { sessionManager, SecurityHeadersManager, CSRFProtection } from './session-manager';
import { createClient } from '@/lib/supabase/server';

export interface SecurityConfig {
  enableRateLimit?: boolean;
  enableVirusScanning?: boolean;
  enableCSRFProtection?: boolean;
  enableAbuseDetection?: boolean;
  enableInputValidation?: boolean;
  requireAuth?: boolean;
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  rateLimitResult?: any;
  securityHeaders: Record<string, string>;
}

/**
 * Comprehensive security middleware for API routes
 */
export class SecurityMiddleware {
  /**
   * Apply security measures to API routes
   */
  static async secure(
    req: NextRequest,
    config: SecurityConfig = {}
  ): Promise<{ 
    allowed: boolean; 
    response?: NextResponse; 
    context?: SecurityContext 
  }> {
    const {
      enableRateLimit = true,
      enableVirusScanning = true,
      enableCSRFProtection = true,
      enableAbuseDetection = true,
      enableInputValidation = true,
      requireAuth = true
    } = config;

    const context: SecurityContext = {
      ipAddress: this.getClientIP(req),
      userAgent: req.headers.get('user-agent') || '',
      securityHeaders: SecurityHeadersManager.getSecurityHeaders()
    };

    try {
      // 1. Rate limiting check
      if (enableRateLimit) {
        const rateLimitResult = await this.checkRateLimit(req);
        context.rateLimitResult = rateLimitResult;
        
        if (!rateLimitResult.allowed) {
          return {
            allowed: false,
            response: this.createErrorResponse(
              'Rate limit exceeded',
              429,
              {
                'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
              }
            )
          };
        }
      }

      // 2. Abuse detection
      if (enableAbuseDetection) {
        const abuseCheck = abuseDetector.checkForAbuse(req, req.nextUrl.pathname);
        
        if (abuseCheck.suspicious) {
          await this.logSecurityEvent(
            context.userId,
            'suspicious_activity',
            context.ipAddress,
            context.userAgent,
            { reason: abuseCheck.reason, severity: abuseCheck.severity }
          );

          if (abuseCheck.severity === 'high') {
            return {
              allowed: false,
              response: this.createErrorResponse('Suspicious activity detected', 403)
            };
          }
        }
      }

      // 3. Authentication check
      if (requireAuth) {
        const authResult = await this.checkAuthentication(req);
        
        if (!authResult.authenticated) {
          return {
            allowed: false,
            response: this.createErrorResponse('Authentication required', 401)
          };
        }
        
        context.userId = authResult.userId;
        context.sessionId = authResult.sessionId;
      }

      // 4. CSRF protection for state-changing operations
      if (enableCSRFProtection && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const csrfValid = await this.validateCSRF(req, context.sessionId);
        
        if (!csrfValid) {
          await this.logSecurityEvent(
            context.userId,
            'csrf_violation',
            context.ipAddress,
            context.userAgent
          );

          return {
            allowed: false,
            response: this.createErrorResponse('CSRF token validation failed', 403)
          };
        }
      }

      // 5. Input validation for file uploads
      if (enableInputValidation && req.method === 'POST') {
        const contentType = req.headers.get('content-type');
        
        if (contentType?.includes('multipart/form-data')) {
          const validationResult = await this.validateFileUpload(req);
          
          if (!validationResult.valid) {
            return {
              allowed: false,
              response: this.createErrorResponse(validationResult.error || 'Invalid file upload', 400)
            };
          }
        }
      }

      return { allowed: true, context };

    } catch (error) {
      console.error('Security middleware error:', error);
      
      return {
        allowed: false,
        response: this.createErrorResponse('Security check failed', 500)
      };
    }
  }

  /**
   * Secure file upload with virus scanning
   */
  static async secureFileUpload(
    file: File,
    userId: string,
    options: { skipVirusScanning?: boolean } = {}
  ): Promise<{
    safe: boolean;
    quarantined?: boolean;
    scanResult?: any;
    error?: string;
  }> {
    try {
      // 1. Basic file validation
      const validation = InputValidator.fileUploadSchema.safeParse({
        name: file.name,
        size: file.size,
        type: file.type
      });

      if (!validation.success) {
        return {
          safe: false,
          error: validation.error.errors[0].message
        };
      }

      // 2. Virus scanning (if enabled)
      if (!options.skipVirusScanning) {
        const scanResult = await virusScanner.scanFile(file, file.name);
        
        if (!scanResult.safe) {
          // Quarantine the file
          const fileId = crypto.randomUUID();
          await fileQuarantine.quarantineFile(
            fileId,
            file.name,
            userId,
            scanResult,
            scanResult.message || 'Virus scan failed'
          );

          // Log security event
          await this.logSecurityEvent(
            userId,
            'file_quarantined',
            'system',
            '',
            { fileName: file.name, scanResult }
          );

          return {
            safe: false,
            quarantined: true,
            scanResult,
            error: 'File failed security scan and has been quarantined'
          };
        }

        return {
          safe: true,
          scanResult
        };
      }

      return { safe: true };

    } catch (error) {
      console.error('Secure file upload error:', error);
      return {
        safe: false,
        error: 'File security check failed'
      };
    }
  }

  /**
   * Check rate limits for the request
   */
  private static async checkRateLimit(req: NextRequest) {
    const path = req.nextUrl.pathname;
    
    if (path.includes('/upload')) {
      return rateLimiters.fileUpload.middleware(req);
    } else if (path.includes('/auth')) {
      return rateLimiters.auth.middleware(req);
    } else if (path.includes('/projects') && req.method === 'POST') {
      return rateLimiters.projectCreation.middleware(req);
    } else if (path.includes('/download')) {
      return rateLimiters.download.middleware(req);
    } else {
      return rateLimiters.api.middleware(req);
    }
  }

  /**
   * Check user authentication
   */
  private static async checkAuthentication(req: NextRequest): Promise<{
    authenticated: boolean;
    userId?: string;
    sessionId?: string;
  }> {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return { authenticated: false };
      }

      // Additional session validation
      const sessionId = req.headers.get('x-session-id');
      if (sessionId) {
        const sessionInfo = await sessionManager.validateSession(sessionId, req);
        if (!sessionInfo || sessionInfo.userId !== user.id) {
          return { authenticated: false };
        }
      }

      return {
        authenticated: true,
        userId: user.id,
        sessionId: sessionId || undefined
      };

    } catch (error) {
      console.error('Authentication check error:', error);
      return { authenticated: false };
    }
  }

  /**
   * Validate CSRF token
   */
  private static async validateCSRF(req: NextRequest, sessionId?: string): Promise<boolean> {
    if (!sessionId) {
      return false; // No session, can't validate CSRF
    }

    const csrfToken = CSRFProtection.extractToken(req);
    const sessionToken = req.headers.get('x-csrf-token');

    if (!csrfToken || !sessionToken) {
      return false;
    }

    return CSRFProtection.validateToken(csrfToken, sessionToken);
  }

  /**
   * Validate file upload request
   */
  private static async validateFileUpload(req: NextRequest): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const contentLength = req.headers.get('content-length');
      
      if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
        return { valid: false, error: 'File too large (max 50MB)' };
      }

      // Additional validation can be added here
      return { valid: true };

    } catch (error) {
      return { valid: false, error: 'File validation failed' };
    }
  }

  /**
   * Log security events
   */
  private static async logSecurityEvent(
    userId: string | undefined,
    eventType: string,
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    try {
      const supabase = await createClient();
      
      await supabase.from('security_events').insert({
        user_id: userId || null,
        event_type: eventType,
        ip_address: ipAddress,
        user_agent: userAgent,
        details: details || null,
        severity: this.getEventSeverity(eventType)
      });

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Get event severity based on type
   */
  private static getEventSeverity(eventType: string): string {
    const severityMap: Record<string, string> = {
      'login_failure': 'medium',
      'suspicious_activity': 'high',
      'rate_limit_exceeded': 'medium',
      'file_quarantined': 'high',
      'csrf_violation': 'high',
      'invalid_session': 'medium',
      'concurrent_session_limit': 'low'
    };

    return severityMap[eventType] || 'low';
  }

  /**
   * Create error response with security headers
   */
  private static createErrorResponse(
    message: string,
    status: number,
    additionalHeaders: Record<string, string> = {}
  ): NextResponse {
    const response = NextResponse.json(
      { error: message },
      { status }
    );

    // Apply security headers
    SecurityHeadersManager.applySecurityHeaders(response);

    // Apply additional headers
    Object.entries(additionalHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  /**
   * Get client IP address
   */
  private static getClientIP(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return req.ip || 'unknown';
  }
}

/**
 * Convenience function for applying security to API routes
 */
export function withSecurity(
  handler: (req: NextRequest, context: SecurityContext) => Promise<NextResponse>,
  config: SecurityConfig = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const securityResult = await SecurityMiddleware.secure(req, config);
    
    if (!securityResult.allowed) {
      return securityResult.response!;
    }
    
    return handler(req, securityResult.context!);
  };
}