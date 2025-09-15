/**
 * Workflow Execution Service
 * Service for managing workflow executions with real-time updates
 */

import { createClient } from '@/lib/supabase/client';
import { WorkflowExecutionEngine, WorkflowData, ExecutionConfig, WorkflowExecutionResult } from './workflow-engine';

export interface ExecutionRequest {
  workflowId: string;
  workflowData: WorkflowData;
  config?: Partial<ExecutionConfig>;
  userId: string;
}

export interface ExecutionStatus {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentNode?: string;
  startTime: string;
  endTime?: string;
  result?: WorkflowExecutionResult;
  error?: string;
}

export class WorkflowExecutionService {
  private supabase = createClient();
  private activeExecutions = new Map<string, WorkflowExecutionEngine>();

  /**
   * Start a new workflow execution
   */
  async startExecution(request: ExecutionRequest): Promise<string> {
    const executionId = this.generateExecutionId();
    
    // Create execution record
    const { error } = await this.supabase
      .from('workflow_executions')
      .insert({
        id: executionId,
        workflow_id: request.workflowId,
        user_id: request.userId,
        status: 'pending',
        progress: 0,
        start_time: new Date().toISOString(),
        workflow_data: request.workflowData,
        config: this.buildExecutionConfig(request.config)
      });

    if (error) {
      throw new Error(`Failed to create execution record: ${error.message}`);
    }

    // Start execution asynchronously
    this.executeWorkflow(executionId, request).catch(error => {
      console.error(`Execution ${executionId} failed:`, error);
      this.updateExecutionStatus(executionId, 'failed', 0, undefined, error.message);
    });

    return executionId;
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus | null> {
    const { data, error } = await this.supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      workflowId: data.workflow_id,
      status: data.status,
      progress: data.progress,
      currentNode: data.current_node,
      startTime: data.start_time,
      endTime: data.end_time,
      result: data.result,
      error: data.error
    };
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const engine = this.activeExecutions.get(executionId);
    if (engine) {
      // Stop the execution (implementation depends on engine capabilities)
      this.activeExecutions.delete(executionId);
    }

    await this.updateExecutionStatus(executionId, 'cancelled', 0);
  }

  /**
   * Get execution logs
   */
  async getExecutionLogs(executionId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('execution_logs')
      .select('*')
      .eq('execution_id', executionId)
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch execution logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Subscribe to execution updates
   */
  subscribeToExecution(executionId: string, callback: (status: ExecutionStatus) => void) {
    return this.supabase
      .channel(`execution:${executionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_executions',
          filter: `id=eq.${executionId}`
        },
        (payload) => {
          const data = payload.new;
          callback({
            id: data.id,
            workflowId: data.workflow_id,
            status: data.status,
            progress: data.progress,
            currentNode: data.current_node,
            startTime: data.start_time,
            endTime: data.end_time,
            result: data.result,
            error: data.error
          });
        }
      )
      .subscribe();
  }

  /**
   * Execute workflow with real-time updates
   */
  private async executeWorkflow(executionId: string, request: ExecutionRequest): Promise<void> {
    const config = this.buildExecutionConfig(request.config);
    const engine = new WorkflowExecutionEngine(request.workflowData, config);
    
    this.activeExecutions.set(executionId, engine);

    try {
      await this.updateExecutionStatus(executionId, 'running', 0);

      // Register nodes (this would be done based on the workflow data)
      await this.registerWorkflowNodes(engine, request.workflowData);

      // Execute workflow
      const result = await engine.execute();

      // Update final status
      if (result.success) {
        await this.updateExecutionStatus(executionId, 'completed', 100, undefined, undefined, result);
      } else {
        await this.updateExecutionStatus(executionId, 'failed', 0, undefined, result.error, result);
      }

      // Store execution logs
      await this.storeExecutionLogs(executionId, result.logs);

    } catch (error) {
      await this.updateExecutionStatus(executionId, 'failed', 0, undefined, error.message);
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Register nodes for the workflow
   */
  private async registerWorkflowNodes(engine: WorkflowExecutionEngine, workflowData: WorkflowData): Promise<void> {
    // This would dynamically load and register node implementations
    // For now, we'll use a simple mapping
    
    for (const node of workflowData.nodes) {
      try {
        const nodeInstance = await this.createNodeInstance(node.type, node.parameters);
        engine.registerNode(node.id, nodeInstance);
      } catch (error) {
        console.warn(`Failed to register node ${node.id} (${node.type}):`, error.message);
      }
    }
  }

  /**
   * Create node instance based on type
   */
  private async createNodeInstance(nodeType: string, parameters: any): Promise<any> {
    // Dynamic node loading based on type
    switch (nodeType) {
      case 'n8n-nodes-base.httpRequest':
        const { HttpRequestNode } = await import('./nodes/http-request-node');
        return new HttpRequestNode(parameters);
        
      case 'n8n-nodes-base.set':
        const { SetNode } = await import('./nodes/set-node');
        return new SetNode(parameters);
        
      default:
        throw new Error(`Unsupported node type: ${nodeType}`);
    }
  }

  /**
   * Update execution status in database
   */
  private async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus['status'],
    progress: number,
    currentNode?: string,
    error?: string,
    result?: WorkflowExecutionResult
  ): Promise<void> {
    const updates: any = {
      status,
      progress,
      current_node: currentNode,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed' || status === 'failed') {
      updates.end_time = new Date().toISOString();
    }

    if (error) {
      updates.error = error;
    }

    if (result) {
      updates.result = result;
    }

    const { error: updateError } = await this.supabase
      .from('workflow_executions')
      .update(updates)
      .eq('id', executionId);

    if (updateError) {
      console.error(`Failed to update execution status:`, updateError);
    }
  }

  /**
   * Store execution logs in database
   */
  private async storeExecutionLogs(executionId: string, logs: any[]): Promise<void> {
    if (!logs || logs.length === 0) return;

    const logEntries = logs.map(log => ({
      execution_id: executionId,
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      node_id: log.nodeId,
      data: log.data
    }));

    const { error } = await this.supabase
      .from('execution_logs')
      .insert(logEntries);

    if (error) {
      console.error(`Failed to store execution logs:`, error);
    }
  }

  /**
   * Build execution configuration
   */
  private buildExecutionConfig(config?: Partial<ExecutionConfig>): ExecutionConfig {
    return {
      timeout: config?.timeout || 300000, // 5 minutes
      retries: config?.retries || 3,
      continueOnFailure: config?.continueOnFailure || false,
      logging: {
        level: config?.logging?.level || 'info',
        format: config?.logging?.format || 'json'
      },
      credentials: config?.credentials || {},
      nodes: config?.nodes || {}
    };
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const workflowExecutionService = new WorkflowExecutionService();