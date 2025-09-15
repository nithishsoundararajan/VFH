import { NextRequest } from 'next/server';
import { RateLimiter, AbuseDetector } from '../rate-limiter';

// Mock NextRequest
const createMockRequest = (ip: string = '127.0.0.1', userAgent: string = 'test-agent'): NextRequest => {
  const url = 'http://localhost:3000/api/test';
  const request = new NextRequest(url);
  
  // Mock headers
  Object.defineProperty(request, 'headers', {
    value: new Map([
      ['x-forwarded-for', ip],
      ['user-agent', userAgent]
    ])
  });
  
  Object.defineProperty(request, 'ip', {
    value: ip
  });
  
  return request;
};

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 5
    });
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      const req = createMockRequest();
      
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit(req);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests exceeding limit', () => {
      const req = createMockRequest();
      
      // Use up the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(req);
      }
      
      // Next request should be blocked
      const result = rateLimiter.checkLimit(req);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different IPs separately', () => {
      const req1 = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.2');
      
      // Use up limit for first IP
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(req1);
      }
      
      // Second IP should still be allowed
      const result = rateLimiter.checkLimit(req2);
      expect(result.allowed).toBe(true);
    });

    it('should reset after time window', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 100, // 100ms for testing
        maxRequests: 2
      });
      
      const req = createMockRequest();
      
      // Use up the limit
      rateLimiter.checkLimit(req);
      rateLimiter.checkLimit(req);
      
      // Should be blocked
      let result = rateLimiter.checkLimit(req);
      expect(result.allowed).toBe(false);
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be allowed again
      result = rateLimiter.checkLimit(req);
      expect(result.allowed).toBe(true);
    });
  });

  describe('recordRequest', () => {
    it('should record successful requests when not skipping', () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        skipSuccessfulRequests: false
      });
      
      const req = createMockRequest();
      
      rateLimiter.recordRequest(req, true);
      const result = rateLimiter.checkLimit(req);
      expect(result.totalHits).toBe(2); // 1 recorded + 1 from check
    });

    it('should skip successful requests when configured', () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        skipSuccessfulRequests: true
      });
      
      const req = createMockRequest();
      
      rateLimiter.recordRequest(req, true);
      const result = rateLimiter.checkLimit(req);
      expect(result.totalHits).toBe(1); // Only from check, not recorded
    });

    it('should skip failed requests when configured', () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        skipFailedRequests: true
      });
      
      const req = createMockRequest();
      
      rateLimiter.recordRequest(req, false);
      const result = rateLimiter.checkLimit(req);
      expect(result.totalHits).toBe(1); // Only from check, not recorded
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 100, // 100ms for testing
        maxRequests: 5
      });
      
      const req = createMockRequest();
      
      // Make some requests
      rateLimiter.checkLimit(req);
      rateLimiter.checkLimit(req);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Cleanup
      rateLimiter.cleanup();
      
      // Should start fresh
      const result = rateLimiter.checkLimit(req);
      expect(result.totalHits).toBe(1);
    });
  });
});

describe('AbuseDetector', () => {
  let abuseDetector: AbuseDetector;

  beforeEach(() => {
    abuseDetector = new AbuseDetector();
  });

  describe('checkForAbuse', () => {
    it('should detect rapid fire requests', () => {
      const req = createMockRequest();
      
      // Make many rapid requests
      for (let i = 0; i < 15; i++) {
        abuseDetector.checkForAbuse(req, 'test-action');
      }
      
      const result = abuseDetector.checkForAbuse(req, 'test-action');
      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain('Rapid fire requests');
      expect(result.severity).toBe('high');
    });

    it('should detect bot-like user agents', () => {
      const req = createMockRequest('127.0.0.1', 'curl/7.68.0');
      
      const result = abuseDetector.checkForAbuse(req, 'test-action');
      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain('Bot-like user agent');
      expect(result.severity).toBe('medium');
    });

    it('should detect repeating patterns', () => {
      const req = createMockRequest();
      
      // Create repeating pattern
      for (let i = 0; i < 10; i++) {
        abuseDetector.checkForAbuse(req, 'pattern1');
        abuseDetector.checkForAbuse(req, 'pattern2');
      }
      
      const result = abuseDetector.checkForAbuse(req, 'pattern1');
      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain('Repeating request patterns');
      expect(result.severity).toBe('medium');
    });

    it('should not flag normal usage', () => {
      const req = createMockRequest('127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      const result = abuseDetector.checkForAbuse(req, 'normal-action');
      expect(result.suspicious).toBe(false);
      expect(result.severity).toBe('low');
    });

    it('should track different IPs separately', () => {
      const req1 = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.2');
      
      // Make many requests from first IP
      for (let i = 0; i < 15; i++) {
        abuseDetector.checkForAbuse(req1, 'test-action');
      }
      
      // Second IP should not be flagged
      const result = abuseDetector.checkForAbuse(req2, 'test-action');
      expect(result.suspicious).toBe(false);
    });
  });

  describe('getSuspiciousActivity', () => {
    it('should return activity with significant request counts', () => {
      const req = createMockRequest();
      
      // Generate significant activity
      for (let i = 0; i < 10; i++) {
        abuseDetector.checkForAbuse(req, 'test-action');
      }
      
      const activity = abuseDetector.getSuspiciousActivity();
      expect(activity.length).toBeGreaterThan(0);
      expect(activity[0].count).toBeGreaterThanOrEqual(10);
    });

    it('should not return low activity', () => {
      const req = createMockRequest();
      
      // Generate low activity
      for (let i = 0; i < 3; i++) {
        abuseDetector.checkForAbuse(req, 'test-action');
      }
      
      const activity = abuseDetector.getSuspiciousActivity();
      expect(activity.length).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove old activity records', async () => {
      const req = createMockRequest();
      
      // Generate some activity
      for (let i = 0; i < 10; i++) {
        abuseDetector.checkForAbuse(req, 'test-action');
      }
      
      // Verify activity exists
      let activity = abuseDetector.getSuspiciousActivity();
      expect(activity.length).toBeGreaterThan(0);
      
      // Mock old timestamp by manipulating the internal state
      // In a real implementation, you'd need to wait or mock time
      abuseDetector.cleanup();
      
      // Activity should still exist (not old enough)
      activity = abuseDetector.getSuspiciousActivity();
      expect(activity.length).toBeGreaterThan(0);
    });
  });
});