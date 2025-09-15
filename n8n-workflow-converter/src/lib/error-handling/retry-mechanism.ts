import { errorLogger } from '@/lib/logging/error-logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
  context?: Record<string, any>;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

export class RetryMechanism {
  private static defaultOptions: Required<Omit<RetryOptions, 'retryCondition' | 'onRetry' | 'context'>> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2
  };

  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: any;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Log the error
        await errorLogger.logError(error as Error, {
          ...options.context,
          component: 'retry_mechanism',
          attempt,
          maxRetries: config.maxRetries
        }, attempt === config.maxRetries + 1 ? 'high' : 'low');

        // Check if we should retry
        if (attempt > config.maxRetries) {
          break;
        }

        if (options.retryCondition && !options.retryCondition(error)) {
          throw error;
        }

        // Call retry callback
        options.onRetry?.(error, attempt);

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
          config.maxDelay
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  static shouldRetryHttpError(error: any): boolean {
    const status = error?.response?.status || error?.status;
    
    // Retry on network errors or 5xx server errors
    if (!status || status >= 500) {
      return true;
    }

    // Retry on specific 4xx errors
    if (status === 408 || status === 429) {
      return true;
    }

    return false;
  }

  static shouldRetryDatabaseError(error: any): boolean {
    const code = error?.code || error?.error?.code;
    
    // Retry on connection errors
    if (code === 'PGRST301' || code === 'PGRST302') {
      return true;
    }

    // Retry on timeout errors
    if (error?.message?.includes('timeout')) {
      return true;
    }

    return false;
  }
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000,
      ...options
    };
  }

  async execute<T>(operation: () => Promise<T>, context: Record<string, any> = {}): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'half-open';
      } else {
        const error = new Error('Circuit breaker is open');
        await errorLogger.logError(error, {
          ...context,
          component: 'circuit_breaker',
          state: this.state,
          failures: this.failures
        }, 'medium');
        throw error;
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      
      await errorLogger.logError(error as Error, {
        ...context,
        component: 'circuit_breaker',
        state: this.state,
        failures: this.failures
      }, 'high');
      
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Global circuit breakers for common services
export const supabaseCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000
});

export const aiProviderCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000
});

// Utility functions for common retry scenarios
export const retryApiCall = <T>(
  apiCall: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> => {
  return RetryMechanism.withRetry(apiCall, {
    maxRetries: 3,
    retryCondition: RetryMechanism.shouldRetryHttpError,
    context: { ...context, operation: 'api_call' }
  });
};

export const retryDatabaseOperation = <T>(
  dbOperation: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> => {
  return supabaseCircuitBreaker.execute(
    () => RetryMechanism.withRetry(dbOperation, {
      maxRetries: 2,
      retryCondition: RetryMechanism.shouldRetryDatabaseError,
      context: { ...context, operation: 'database' }
    }),
    context
  );
};

export const retryFileOperation = <T>(
  fileOperation: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> => {
  return RetryMechanism.withRetry(fileOperation, {
    maxRetries: 3,
    baseDelay: 500,
    retryCondition: (error) => {
      // Retry on network errors or temporary file system errors
      return error?.code === 'ENOENT' || 
             error?.code === 'EBUSY' || 
             error?.message?.includes('timeout');
    },
    context: { ...context, operation: 'file_system' }
  });
};