/**
 * Workflow Execution Engine
 * Core engine for executing n8n workflows with proper dependency resolution
 */

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, any>;
  position: [number, number];
  disabled?: boolean;
}

export interface WorkflowConnection {
  node: string;
  type: string;
  index: number;
}

export interface WorkflowData {
  id?: string;
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, Record<string, WorkflowConnection[]>>;
  active: boolean;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
}

export interface ExecutionContext {
  workflow: WorkflowData;
  config: ExecutionConfig;
  mode: 'manual' | 'trigger' | 'webhook';
  executionId: string;
  nodeId?: string;
  userId?: string;
}

export interface ExecutionConfig {
  timeout: number;
  retries: number;
  continueOnFailure: boolean;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
  credentials: Record<string, any>;
  nodes: Record<string, any>;
}

export interface NodeExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  timestamp: string;
  outputs?: any[];
}

export interface WorkflowExecutionResult {
  success: boolean;
  executionId: string;
  executionTime: number;
  results: Record<string, NodeExecutionResult>;
  logs: ExecutionLog[];
  nodeExecutionTimes: Record<string, number>;
  error?: string;
  summary: ExecutionSummary;
}

export interface ExecutionLog {
  timestamp: string;
  executionId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  nodeId?: string;
  data?: string;
}

export interface ExecutionSummary {
  executionId: string;
  totalExecutionTime: number;
  nodeExecutionTime: number;
  nodesExecuted: number;
  nodesSucceeded: number;
  nodesFailed: number;
  nodesSkipped: number;
  totalLogs: number;
  errorCount: number;
  warningCount: number;
}

export class WorkflowExecutionEngine {
  private workflow: WorkflowData;
  private config: ExecutionConfig;
  private executionId: string;
  private executionLogs: ExecutionLog[] = [];
  private executionStartTime: number = 0;
  private nodeExecutionTimes: Map<string, number> = new Map();
  private nodeRegistry: Map<string, any> = new Map();

  constructor(workflow: WorkflowData, config: ExecutionConfig) {
    this.workflow = workflow;
    this.config = config;
    this.executionId = this.generateExecutionId();
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  registerNode(nodeId: string, nodeInstance: any): void {
    this.nodeRegistry.set(nodeId, nodeInstance);
  }

  private log(level: ExecutionLog['level'], message: string, nodeId?: string, data?: any): void {
    const logEntry: ExecutionLog = {
      timestamp: new Date().toISOString(),
      executionId: this.executionId,
      level,
      message,
      nodeId,
      data: data ? JSON.stringify(data) : undefined
    };

    this.executionLogs.push(logEntry);

    // Console output based on log level
    if (this.shouldLog(level)) {
      const prefix = nodeId ? `[${nodeId}]` : '[WORKFLOW]';
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} ${level.toUpperCase()} ${prefix} ${message}`);

      if (data && this.config.logging.level === 'debug') {
        console.log(`${timestamp} DEBUG ${prefix} Data:`, data);
      }
    }
  }

  private shouldLog(level: ExecutionLog['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logging.level);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }

  async execute(): Promise<WorkflowExecutionResult> {
    this.executionStartTime = Date.now();
    this.log('info', `Starting workflow execution: ${this.workflow.name}`);

    const results = new Map<string, NodeExecutionResult>();
    const nodeStatus = new Map<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>();

    // Initialize node status
    this.workflow.nodes.forEach(node => {
      nodeStatus.set(node.id, 'pending');
    });

    try {
      // Calculate execution order
      const executionOrder = this.calculateExecutionOrder();
      this.log('info', `Execution order determined: ${executionOrder.join(' -> ')}`);

      // Execute nodes in dependency order
      for (const nodeId of executionOrder) {
        const node = this.workflow.nodes.find(n => n.id === nodeId);
        if (!node) {
          this.log('warn', 'Node definition not found', nodeId);
          continue;
        }

        if (node.disabled) {
          this.log('info', 'Node is disabled, skipping', nodeId);
          nodeStatus.set(nodeId, 'skipped');
          continue;
        }

        await this.executeNode(nodeId, results, nodeStatus);
      }

      const executionTime = Date.now() - this.executionStartTime;
      this.log('info', `Workflow execution completed in ${executionTime}ms`);

      return {
        success: true,
        executionId: this.executionId,
        executionTime,
        results: Object.fromEntries(results),
        logs: this.executionLogs,
        nodeExecutionTimes: Object.fromEntries(this.nodeExecutionTimes),
        summary: this.generateExecutionSummary(results, nodeStatus)
      };

    } catch (error) {
      const executionTime = Date.now() - this.executionStartTime;
      this.log('error', `Workflow execution failed: ${error.message}`);

      return {
        success: false,
        executionId: this.executionId,
        executionTime,
        error: error.message,
        results: Object.fromEntries(results),
        logs: this.executionLogs,
        nodeExecutionTimes: Object.fromEntries(this.nodeExecutionTimes),
        summary: this.generateExecutionSummary(results, nodeStatus)
      };
    }
  }

  private async executeNode(
    nodeId: string,
    results: Map<string, NodeExecutionResult>,
    nodeStatus: Map<string, string>
  ): Promise<void> {
    const nodeStartTime = Date.now();
    nodeStatus.set(nodeId, 'running');

    const nodeInstance = this.nodeRegistry.get(nodeId);
    if (!nodeInstance) {
      this.log('warn', 'Node instance not found, skipping', nodeId);
      nodeStatus.set(nodeId, 'skipped');
      return;
    }

    try {
      this.log('info', 'Starting node execution', nodeId);

      // Get input data from connected nodes
      const inputData = this.getInputData(nodeId, results);
      this.log('debug', 'Input data prepared', nodeId, { inputCount: inputData.length });

      // Execute node with retry logic
      const result = await this.executeWithRetry(nodeInstance, inputData, nodeId);

      const executionTime = Date.now() - nodeStartTime;
      const nodeResult: NodeExecutionResult = {
        success: true,
        data: result,
        executionTime,
        timestamp: new Date().toISOString()
      };

      results.set(nodeId, nodeResult);
      nodeStatus.set(nodeId, 'completed');
      this.nodeExecutionTimes.set(nodeId, executionTime);

      this.log('info', `Node execution completed in ${executionTime}ms`, nodeId);

    } catch (error) {
      const executionTime = Date.now() - nodeStartTime;
      this.nodeExecutionTimes.set(nodeId, executionTime);
      nodeStatus.set(nodeId, 'failed');

      this.log('error', `Node execution failed: ${error.message}`, nodeId);

      const nodeResult: NodeExecutionResult = {
        success: false,
        error: error.message,
        executionTime,
        timestamp: new Date().toISOString()
      };

      results.set(nodeId, nodeResult);

      if (!this.config.continueOnFailure) {
        throw new Error(`Node ${nodeId} failed: ${error.message}`);
      } else {
        this.log('warn', 'Continuing execution despite node failure', nodeId);
      }
    }
  }

  private async executeWithRetry(nodeInstance: any, inputData: any[], nodeId: string): Promise<any> {
    const maxRetries = this.config.retries || 3;
    const timeout = this.config.timeout || 300000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log('debug', `Execution attempt ${attempt}/${maxRetries}`, nodeId);

        // Create execution context
        const context: ExecutionContext = {
          workflow: this.workflow,
          config: this.config,
          mode: 'manual',
          executionId: this.executionId,
          nodeId
        };

        // Execute with timeout
        const result = await Promise.race([
          nodeInstance.execute(inputData, context),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Execution timeout')), timeout)
          )
        ]);

        return result;

      } catch (error) {
        this.log('warn', `Attempt ${attempt} failed: ${error.message}`, nodeId);

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.log('debug', `Retrying in ${delay}ms`, nodeId);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private calculateExecutionOrder(): string[] {
    const nodes = this.workflow.nodes;
    const connections = this.workflow.connections;

    // Build dependency graph
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize graph
    nodes.forEach(node => {
      graph.set(node.id, []);
      inDegree.set(node.id, 0);
    });

    // Build edges from connections
    Object.entries(connections).forEach(([targetNodeId, inputConnections]) => {
      Object.values(inputConnections).forEach(connectionList => {
        connectionList.forEach(connection => {
          const sourceNodeId = connection.node;
          if (graph.has(sourceNodeId) && graph.has(targetNodeId)) {
            graph.get(sourceNodeId)!.push(targetNodeId);
            inDegree.set(targetNodeId, inDegree.get(targetNodeId)! + 1);
          }
        });
      });
    });

    // Topological sort using Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    // Find nodes with no incoming edges (start nodes/triggers)
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });

    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      result.push(currentNode);

      // Process all neighbors
      graph.get(currentNode)!.forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Check for cycles
    if (result.length !== nodes.length) {
      this.log('warn', 'Circular dependency detected, using fallback order');
      return nodes.map(node => node.id);
    }

    return result;
  }

  private getInputData(nodeId: string, results: Map<string, NodeExecutionResult>): any[] {
    const connections = this.workflow.connections;
    const inputConnections = connections[nodeId] || {};
    const inputData: any[] = [];

    // Process each input connection
    Object.entries(inputConnections).forEach(([inputIndex, connectionList]) => {
      connectionList.forEach(connection => {
        const sourceNodeId = connection.node;
        const outputIndex = connection.index || 0;
        const sourceResult = results.get(sourceNodeId);

        if (sourceResult && sourceResult.success) {
          let outputData = sourceResult.data;

          // Handle multiple outputs
          if (sourceResult.outputs && sourceResult.outputs[outputIndex] !== undefined) {
            outputData = sourceResult.outputs[outputIndex];
          }

          inputData.push({
            data: outputData,
            source: {
              node: sourceNodeId,
              output: outputIndex
            }
          });
        }
      });
    });

    // Return input data or empty data for trigger nodes
    return inputData.length > 0 ? inputData : [{ data: {} }];
  }

  private generateExecutionSummary(
    results: Map<string, NodeExecutionResult>,
    nodeStatus: Map<string, string>
  ): ExecutionSummary {
    const totalTime = Array.from(this.nodeExecutionTimes.values()).reduce((a, b) => a + b, 0);
    const statusCounts = Array.from(nodeStatus.values()).reduce((acc, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      executionId: this.executionId,
      totalExecutionTime: Date.now() - this.executionStartTime,
      nodeExecutionTime: totalTime,
      nodesExecuted: this.nodeExecutionTimes.size,
      nodesSucceeded: statusCounts.completed || 0,
      nodesFailed: statusCounts.failed || 0,
      nodesSkipped: statusCounts.skipped || 0,
      totalLogs: this.executionLogs.length,
      errorCount: this.executionLogs.filter(log => log.level === 'error').length,
      warningCount: this.executionLogs.filter(log => log.level === 'warn').length
    };
  }

  getExecutionLogs(): ExecutionLog[] {
    return [...this.executionLogs];
  }

  getExecutionId(): string {
    return this.executionId;
  }
}