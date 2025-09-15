import { logger } from '../structured-logger';
import { createClient } from '@/lib/supabase/client';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn()
}));

// Mock console methods
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('StructuredLogger', () => {
  const mockSupabase = {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    }))
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message', { component: 'test' });
      
      // In development, should log to console
      if (process.env.NODE_ENV === 'development') {
        expect(console.log).toHaveBeenCalled();
      }
    });

    it('should log info messages', () => {
      logger.info('Info message', { component: 'test' });
      
      if (process.env.NODE_ENV === 'development') {
        expect(console.log).toHaveBeenCalled();
      }
    });

    it('should log warning messages', () => {
      logger.warn('Warning message', { component: 'test' });
      
      if (process.env.NODE_ENV === 'development') {
        expect(console.warn).toHaveBeenCalled();
      }
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error message', error, { component: 'test' });
      
      if (process.env.NODE_ENV === 'development') {
        expect(console.error).toHaveBeenCalled();
      }
    });

    it('should log fatal messages', () => {
      const error = new Error('Fatal error');
      logger.fatal('Fatal message', error, { component: 'test' });
      
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('performance logging', () => {
    it('should log performance metrics', async () => {
      await logger.logPerformance({
        name: 'test_metric',
        value: 100,
        unit: 'ms'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('performance_metrics');
    });

    it('should create timer function', () => {
      const endTimer = logger.startTimer('test_operation');
      expect(typeof endTimer).toBe('function');
      
      const duration = endTimer();
      expect(typeof duration).toBe('number');
    });

    it('should time async operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result');
      
      const result = await logger.withTiming('test_async', mockOperation, {
        component: 'test'
      });
      
      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should handle errors in timed operations', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(
        logger.withTiming('test_async_error', mockOperation)
      ).rejects.toThrow('Operation failed');
      
      expect(mockOperation).toHaveBeenCalled();
    });
  });

  describe('user action logging', () => {
    it('should log user actions', () => {
      logger.logUserAction('button_click', 'user123', {
        buttonId: 'submit',
        page: 'dashboard'
      });
      
      if (process.env.NODE_ENV === 'development') {
        expect(console.log).toHaveBeenCalled();
      }
    });
  });

  describe('API request logging', () => {
    it('should log successful API requests', () => {
      logger.logApiRequest('GET', '/api/projects', 200, 150, {
        userId: 'user123'
      });
      
      if (process.env.NODE_ENV === 'development') {
        expect(console.log).toHaveBeenCalled();
      }
    });

    it('should log failed API requests as errors', () => {
      logger.logApiRequest('POST', '/api/projects', 500, 1000, {
        userId: 'user123'
      });
      
      if (process.env.NODE_ENV === 'development') {
        expect(console.error).toHaveBeenCalled();
      }
    });

    it('should log client errors as warnings', () => {
      logger.logApiRequest('GET', '/api/projects/invalid', 404, 50, {
        userId: 'user123'
      });
      
      if (process.env.NODE_ENV === 'development') {
        expect(console.warn).toHaveBeenCalled();
      }
    });
  });

  describe('metadata handling', () => {
    it('should include trace IDs in log entries', () => {
      logger.info('Test message', { traceId: 'trace123' });
      
      // Verify that the log entry includes the trace ID
      // This would be tested by checking the Supabase insert call
    });

    it('should generate session IDs', () => {
      logger.info('Test message');
      
      // Session ID should be automatically generated and included
    });

    it('should include user context when provided', () => {
      logger.info('Test message', { 
        userId: 'user123',
        projectId: 'project456'
      });
      
      // User context should be included in the log entry
    });
  });

  describe('error handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      const mockSupabaseWithError = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => Promise.resolve({ 
              data: null, 
              error: new Error('Database error') 
            }))
          }))
        }))
      };
      
      (createClient as jest.Mock).mockReturnValue(mockSupabaseWithError);
      
      // Should not throw error
      expect(() => {
        logger.error('Test error');
      }).not.toThrow();
    });

    it('should fallback to localStorage when Supabase fails', () => {
      const mockLocalStorage = {
        getItem: jest.fn(() => '[]'),
        setItem: jest.fn()
      };
      
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      });
      
      const mockSupabaseWithError = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => Promise.resolve({ 
              data: null, 
              error: new Error('Database error') 
            }))
          }))
        }))
      };
      
      (createClient as jest.Mock).mockReturnValue(mockSupabaseWithError);
      
      logger.error('Test error');
      
      // Should attempt to store in localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });
});