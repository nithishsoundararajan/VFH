/**
 * Base Node Class
 * Provides common functionality for all generated n8n nodes
 */

export interface NodeExecutionContext {
  workflow?: any;
  executionId?: string;
  nodeId?: string;
  mode?: string;
  getNodeOutput?: (nodeId: string) => any;
  setNodeOutput?: (nodeId: string, data: any) => void;
}

export interface NodeExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
  metadata?: Record<string, any>;
}

export abstract class BaseNode {
  public nodeType: string = '';
  public nodeName: string = '';
  public nodeId: string = '';
  public credentials: Record<string, any> = {};
  
  protected executionStartTime: number = 0;
  protected executionLogs: string[] = [];

  constructor() {
    // Base initialization
  }

  /**
   * Abstract execute method - must be implemented by each node
   */
  abstract execute(inputData: any, context?: NodeExecutionContext): Promise<any>;

  /**
   * Log execution information
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()} [${this.nodeName}]: ${message}`;
    
    this.executionLogs.push(logMessage);
    
    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }

  /**
   * Start execution timing
   */
  protected startExecution(): void {
    this.executionStartTime = Date.now();
    this.log('info', `Starting execution`);
  }

  /**
   * End execution timing
   */
  protected endExecution(): number {
    const executionTime = Date.now() - this.executionStartTime;
    this.log('info', `Execution completed in ${executionTime}ms`);
    return executionTime;
  }

  /**
   * Get parameter value with fallback
   */
  protected getParameter(name: string, defaultValue?: any): any {
    return (this as any)[name] !== undefined ? (this as any)[name] : defaultValue;
  }

  /**
   * Validate required parameters
   */
  protected validateRequiredParameters(requiredParams: string[]): void {
    const missing = requiredParams.filter(param => 
      (this as any)[param] === undefined || (this as any)[param] === null
    );

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Process input data consistently
   */
  protected processInputData(inputData: any): any[] {
    if (!inputData) return [{}];
    if (Array.isArray(inputData)) return inputData;
    return [inputData];
  }

  /**
   * Format output data consistently
   */
  protected formatOutputData(data: any): any {
    if (data === null || data === undefined) return {};
    return data;
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: Error, context?: string): never {
    const errorMessage = context 
      ? `${context}: ${error.message}`
      : error.message;
    
    this.log('error', errorMessage, { stack: error.stack });
    throw new Error(`${this.nodeName} execution failed: ${errorMessage}`);
  }

  /**
   * Get execution summary
   */
  public getExecutionSummary(): {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    executionTime: number;
    logs: string[];
  } {
    return {
      nodeId: this.nodeId,
      nodeName: this.nodeName,
      nodeType: this.nodeType,
      executionTime: this.executionStartTime ? Date.now() - this.executionStartTime : 0,
      logs: [...this.executionLogs]
    };
  }
}