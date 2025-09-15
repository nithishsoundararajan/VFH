import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export interface SessionInfo {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export interface SecurityHeaders {
  'Content-Security-Policy': string;
  'X-Frame-Options': string;
  'X-Content-Type-Options': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Strict-Transport-Security': string;
  'X-XSS-Protection': string;
}

/**
 * Secure session management with enhanced security features
 */
export class SessionManager {
  private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxConcurrentSessions = 5;
  private activeSessions = new Map<string, SessionInfo>();

  /**
   * Create a new secure session
   */
  async createSession(userId: string, req: NextRequest): Promise<string> {
    const sessionId = this.generateSecureSessionId();
    const now = new Date();
    const ipAddress = this.getClientIP(req);
    const userAgent = req.headers.get('user-agent') || '';

    const sessionInfo: SessionInfo = {
      userId,
      sessionId,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.sessionTimeout)
    };

    // Clean up old sessions for this user
    await this.cleanupUserSessions(userId);

    // Store session
    this.activeSessions.set(sessionId, sessionInfo);

    // Store in database for persistence
    const supabase = await createClient();
    await supabase.from('user_sessions').insert({
      session_id: sessionId,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: sessionInfo.expiresAt.toISOString()
    });

    return sessionId;
  }

  /**
   * Validate and refresh session
   */
  async validateSession(sessionId: string, req: NextRequest): Promise<SessionInfo | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      // Try to load from database
      const dbSession = await this.loadSessionFromDB(sessionId);
      if (dbSession) {
        this.activeSessions.set(sessionId, dbSession);
        return dbSession;
      }
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.destroySession(sessionId);
      return null;
    }

    // Validate IP address (optional - can be disabled for mobile users)
    const currentIP = this.getClientIP(req);
    if (session.ipAddress !== currentIP) {
      console.warn(`Session IP mismatch: ${session.ipAddress} vs ${currentIP}`);
      // In production, you might want to invalidate the session or require re-authentication
    }

    // Update last activity
    session.lastActivity = new Date();
    this.activeSessions.set(sessionId, session);

    // Update database
    const supabase = await createClient();
    await supabase
      .from('user_sessions')
      .update({ last_activity: session.lastActivity.toISOString() })
      .eq('session_id', sessionId);

    return session;
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);

    // Remove from database
    const supabase = await createClient();
    await supabase
      .from('user_sessions')
      .delete()
      .eq('session_id', sessionId);
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    // Remove from memory
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(sessionId);
      }
    }

    // Remove from database
    const supabase = await createClient();
    await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', userId);
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];

    // Get from memory
    for (const session of this.activeSessions.values()) {
      if (session.userId === userId) {
        sessions.push(session);
      }
    }

    // Get from database if not in memory
    const supabase = await createClient();
    const { data: dbSessions } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString());

    if (dbSessions) {
      for (const dbSession of dbSessions) {
        if (!sessions.find(s => s.sessionId === dbSession.session_id)) {
          sessions.push({
            userId: dbSession.user_id,
            sessionId: dbSession.session_id,
            ipAddress: dbSession.ip_address,
            userAgent: dbSession.user_agent,
            createdAt: new Date(dbSession.created_at),
            lastActivity: new Date(dbSession.last_activity || dbSession.created_at),
            expiresAt: new Date(dbSession.expires_at)
          });
        }
      }
    }

    return sessions;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();

    // Clean up memory
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
      }
    }

    // Clean up database
    const supabase = await createClient();
    await supabase
      .from('user_sessions')
      .delete()
      .lt('expires_at', now.toISOString());
  }

  /**
   * Clean up old sessions for a user (keep only the most recent ones)
   */
  private async cleanupUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    if (sessions.length >= this.maxConcurrentSessions) {
      // Sort by last activity and keep only the most recent
      sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      
      const sessionsToRemove = sessions.slice(this.maxConcurrentSessions - 1);
      
      for (const session of sessionsToRemove) {
        await this.destroySession(session.sessionId);
      }
    }
  }

  /**
   * Generate a cryptographically secure session ID
   */
  private generateSecureSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(req: NextRequest): string {
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

  /**
   * Load session from database
   */
  private async loadSessionFromDB(sessionId: string): Promise<SessionInfo | null> {
    const supabase = await createClient();
    const { data: session } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) {
      return null;
    }

    return {
      userId: session.user_id,
      sessionId: session.session_id,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      createdAt: new Date(session.created_at),
      lastActivity: new Date(session.last_activity || session.created_at),
      expiresAt: new Date(session.expires_at)
    };
  }
}

/**
 * Security headers configuration
 */
export class SecurityHeadersManager {
  /**
   * Get comprehensive security headers
   */
  static getSecurityHeaders(): SecurityHeaders {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.virustotal.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; '),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-XSS-Protection': '1; mode=block'
    };
  }

  /**
   * Apply security headers to response
   */
  static applySecurityHeaders(response: NextResponse): NextResponse {
    const headers = this.getSecurityHeaders();
    
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
}

/**
 * CSRF protection
 */
export class CSRFProtection {
  private static readonly tokenLength = 32;

  /**
   * Generate CSRF token
   */
  static generateToken(): string {
    return crypto.randomBytes(this.tokenLength).toString('hex');
  }

  /**
   * Validate CSRF token
   */
  static validateToken(token: string, sessionToken: string): boolean {
    if (!token || !sessionToken) {
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    );
  }

  /**
   * Extract CSRF token from request
   */
  static extractToken(req: NextRequest): string | null {
    // Check header first
    const headerToken = req.headers.get('x-csrf-token');
    if (headerToken) {
      return headerToken;
    }

    // Check form data for POST requests
    const contentType = req.headers.get('content-type');
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      // This would need to be implemented based on your form handling
      // For now, return null as we're using JSON APIs
    }

    return null;
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

// Clean up expired sessions every hour
setInterval(() => {
  sessionManager.cleanupExpiredSessions().catch(console.error);
}, 60 * 60 * 1000);