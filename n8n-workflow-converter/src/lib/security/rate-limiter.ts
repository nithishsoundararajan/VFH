import { NextRequest } from 'next/server';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextRequest) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

/**
 * In-memory rate limiter with sliding window
 */
export class RateLimiter {
  private requests = new Map<string, number[]>();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: this.defaultKeyGenerator,
      ...config
    };
  }

  /**
   * Check if request is within rate limit
   */
  checkLimit(req: NextRequest): RateLimitResult {
    const key = this.config.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Remove requests outside the current window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Update the requests array
    this.requests.set(key, requests);

    const totalHits = requests.length;
    const allowed = totalHits < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - totalHits);
    const resetTime = requests.length > 0 ? requests[0] + this.config.windowMs : now + this.config.windowMs;

    // If allowed, add this request to the count
    if (allowed) {
      requests.push(now);
      this.requests.set(key, requests);
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      resetTime,
      totalHits: allowed ? totalHits + 1 : totalHits
    };
  }

  /**
   * Record a request (for post-processing rate limiting)
   */
  recordRequest(req: NextRequest, success: boolean): void {
    if (this.config.skipSuccessfulRequests && success) return;
    if (this.config.skipFailedRequests && !success) return;

    const key = this.config.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let requests = this.requests.get(key) || [];
    requests = requests.filter(timestamp => timestamp > windowStart);
    requests.push(now);
    
    this.requests.set(key, requests);
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clean up old entries
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > cutoff);
      
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }

  /**
   * Default key generator using IP address
   */
  private defaultKeyGenerator(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.ip || 'unknown';
    return ip;
  }
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new RateLimiter(config);

  // Clean up old entries every 5 minutes
  setInterval(() => limiter.cleanup(), 5 * 60 * 1000);

  return {
    limiter,
    middleware: (req: NextRequest) => {
      return limiter.checkLimit(req);
    }
  };
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // File upload: 10 uploads per hour
  fileUpload: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req) => {
      const userId = req.headers.get('x-user-id') || req.ip || 'anonymous';
      return `upload:${userId}`;
    }
  }),

  // API requests: 100 requests per 15 minutes
  api: createRateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: (req) => {
      const userId = req.headers.get('x-user-id') || req.ip || 'anonymous';
      return `api:${userId}`;
    }
  }),

  // Authentication: 5 attempts per 15 minutes
  auth: createRateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip || 'unknown';
      return `auth:${ip}`;
    }
  }),

  // Project creation: 5 projects per hour
  projectCreation: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyGenerator: (req) => {
      const userId = req.headers.get('x-user-id') || req.ip || 'anonymous';
      return `project:${userId}`;
    }
  }),

  // Download: 20 downloads per hour
  download: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    keyGenerator: (req) => {
      const userId = req.headers.get('x-user-id') || req.ip || 'anonymous';
      return `download:${userId}`;
    }
  })
};

/**
 * Abuse detection system
 */
export class AbuseDetector {
  private suspiciousActivity = new Map<string, {
    count: number;
    firstSeen: number;
    lastSeen: number;
    patterns: string[];
  }>();

  /**
   * Check for suspicious patterns
   */
  checkForAbuse(req: NextRequest, action: string): {
    suspicious: boolean;
    reason?: string;
    severity: 'low' | 'medium' | 'high';
  } {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const key = `${ip}:${action}`;

    // Check for rapid requests
    const now = Date.now();
    const activity = this.suspiciousActivity.get(key);

    if (activity) {
      activity.count++;
      activity.lastSeen = now;
      activity.patterns.push(action);

      // Check for rapid fire requests (more than 10 in 1 minute)
      if (activity.count > 10 && (now - activity.firstSeen) < 60000) {
        return {
          suspicious: true,
          reason: 'Rapid fire requests detected',
          severity: 'high'
        };
      }

      // Check for bot-like user agent
      if (this.isBotUserAgent(userAgent)) {
        return {
          suspicious: true,
          reason: 'Bot-like user agent detected',
          severity: 'medium'
        };
      }

      // Check for pattern repetition
      if (this.hasRepeatingPatterns(activity.patterns)) {
        return {
          suspicious: true,
          reason: 'Repeating request patterns detected',
          severity: 'medium'
        };
      }
    } else {
      this.suspiciousActivity.set(key, {
        count: 1,
        firstSeen: now,
        lastSeen: now,
        patterns: [action]
      });
    }

    return { suspicious: false, severity: 'low' };
  }

  /**
   * Check if user agent looks like a bot
   */
  private isBotUserAgent(userAgent: string): boolean {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /requests/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Check for repeating patterns in requests
   */
  private hasRepeatingPatterns(patterns: string[]): boolean {
    if (patterns.length < 5) return false;

    const recent = patterns.slice(-10);
    const uniquePatterns = new Set(recent);
    
    // If less than 3 unique patterns in last 10 requests, it's suspicious
    return uniquePatterns.size < 3;
  }

  /**
   * Clean up old activity records
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours

    for (const [key, activity] of this.suspiciousActivity.entries()) {
      if (activity.lastSeen < cutoff) {
        this.suspiciousActivity.delete(key);
      }
    }
  }

  /**
   * Get suspicious activity report
   */
  getSuspiciousActivity(): Array<{
    key: string;
    count: number;
    duration: number;
    patterns: string[];
  }> {
    const now = Date.now();
    return Array.from(this.suspiciousActivity.entries())
      .map(([key, activity]) => ({
        key,
        count: activity.count,
        duration: now - activity.firstSeen,
        patterns: [...new Set(activity.patterns)]
      }))
      .filter(item => item.count > 5); // Only show significant activity
  }
}

export const abuseDetector = new AbuseDetector();

// Clean up abuse detector every hour
setInterval(() => abuseDetector.cleanup(), 60 * 60 * 1000);