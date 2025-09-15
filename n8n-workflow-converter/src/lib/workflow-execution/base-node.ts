/**
 * Base Node Class
 * Abstract base class for all workflow nodes with common functionality
 */

import { ExecutionContext, NodeExecutionResult } from './workflow-engine';

export interface NodeParameters {
  [key: string]: any;
}

export interface NodeCredentials {
  [key: string]: any;
}

export interface NodeInputData {
  data: any;
  source?: {
    node: string;
    output: number;
  };
}

export abstract class BaseNode {
  protected nodeType: string;
  protected displayName: string;
  protected description: string;
  protected parameters: NodeParameters;
  protected credentials: NodeCredentials;

  constructor(
    nodeType: string,
    displayName: string,
    description: string = '',
    parameters: NodeParameters = {},
    credentials: NodeCredentials = {}
  ) {
    this.nodeType = nodeType;
    this.displayName = displayName;
    this.description = description;
    this.parameters = parameters;
    this.credentials = credentials;
  }

  /**
   * Abstract method that must be implemented by each node type
   */
  abstract execute(inputData: NodeInputData[], context: ExecutionContext): Promise<any>;

  /**
   * Validate node parameters before execution
   */
  protected validateParameters(): void {
    // Override in subclasses for specific validation
  }

  /**
   * Validate required credentials
   */
  protected validateCredentials(): void {
    // Override in subclasses for specific validation
  }

  /**
   * Get parameter value with default fallback
   */
  protected getParameter(key: string, defaultValue?: any): any {
    return this.parameters[key] !== undefined ? this.parameters[key] : defaultValue;
  }

  /**
   * Get credential value
   */
  protected getCredential(key: string): any {
    return this.credentials[key];
  }

  /**
   * Log message with node context
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${this.nodeType}]`;
    console.log(`${timestamp} ${level.toUpperCase()} ${prefix} ${message}`);
    
    if (data) {
      console.log(`${timestamp} DEBUG ${prefix} Data:`, data);
    }
  }

  /**
   * Handle errors with consistent formatting
   */
  protected handleError(error: Error, context?: string): never {
    const message = context ? `${context}: ${error.message}` : error.message;
    this.log('error', message);
    throw new Error(`[${this.nodeType}] ${message}`);
  }

  /**
   * Process input data and extract values
   */
  protected processInputData(inputData: NodeInputData[]): any[] {
    if (!inputData || inputData.length === 0) {
      return [{}]; // Return empty object for trigger nodes
    }

    return inputData.map(input => input.data || {});
  }

  /**
   * Format output data consistently
   */
  protected formatOutput(data: any, multiple: boolean = false): any {
    if (multiple && !Array.isArray(data)) {
      return [data];
    }
    return data;
  }

  /**
   * Execute HTTP request with error handling
   */
  protected async makeHttpRequest(
    url: string,
    options: RequestInit = {},
    timeout: number = 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`HTTP request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.log('warn', `Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
        await this.sleep(delay);
      }
    }

    throw new Error('Retry operation failed'); // Should never reach here
  }

  /**
   * Get node information
   */
  getNodeInfo(): {
    type: string;
    displayName: string;
    description: string;
    parameters: NodeParameters;
  } {
    return {
      type: this.nodeType,
      displayName: this.displayName,
      description: this.description,
      parameters: this.parameters
    };
  }
}

/**
 * Trigger Node Base Class
 * Base class for trigger nodes (webhook, cron, etc.)
 */
export abstract class BaseTriggerNode extends BaseNode {
  protected isActive: boolean = false;

  constructor(
    nodeType: string,
    displayName: string,
    description: string = '',
    parameters: NodeParameters = {},
    credentials: NodeCredentials = {}
  ) {
    super(nodeType, displayName, description, parameters, credentials);
  }

  /**
   * Start the trigger
   */
  abstract start(callback: (data: any) => void): Promise<void>;

  /**
   * Stop the trigger
   */
  abstract stop(): Promise<void>;

  /**
   * Check if trigger is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Execute method for triggers (called when triggered)
   */
  async execute(inputData: NodeInputData[], context: ExecutionContext): Promise<any> {
    // Triggers typically don't process input data, they generate output
    return this.generateTriggerOutput(context);
  }

  /**
   * Generate output data when trigger fires
   */
  protected abstract generateTriggerOutput(context: ExecutionContext): any;
}

/**
 * Action Node Base Class
 * Base class for action nodes (HTTP request, database operations, etc.)
 */
export abstract class BaseActionNode extends BaseNode {
  constructor(
    nodeType: string,
    displayName: string,
    description: string = '',
    parameters: NodeParameters = {},
    credentials: NodeCredentials = {}
  ) {
    super(nodeType, displayName, description, parameters, credentials);
  }

  /**
   * Execute the action with input data
   */
  abstract execute(inputData: NodeInputData[], context: ExecutionContext): Promise<any>;

  /**
   * Pre-execution validation
   */
  protected async preExecute(inputData: NodeInputData[], context: ExecutionContext): Promise<void> {
    this.validateParameters();
    this.validateCredentials();
  }

  /**
   * Post-execution cleanup
   */
  protected async postExecute(result: any, context: ExecutionContext): Promise<any> {
    return result;
  }
}

/**
 * Transform Node Base Class
 * Base class for data transformation nodes (Set, Code, etc.)
 */
export abstract class BaseTransformNode extends BaseNode {
  constructor(
    nodeType: string,
    displayName: string,
    description: string = '',
    parameters: NodeParameters = {},
    credentials: NodeCredentials = {}
  ) {
    super(nodeType, displayName, description, parameters, credentials);
  }

  /**
   * Transform input data
   */
  abstract execute(inputData: NodeInputData[], context: ExecutionContext): Promise<any>;

  /**
   * Apply transformation to data
   */
  protected abstract transform(data: any, context: ExecutionContext): any;
}