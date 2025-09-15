/**
 * Edge Function Service
 * Handles communication with Supabase Edge Functions
 */

export interface EdgeFunctionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WorkflowParseResult {
  workflow: any;
  security: {
    safe: boolean;
    scanId: string;
    threats: string[];
  };
  metadata: {
    nodeCount: number;
    triggerCount: number;
    actionCount: number;
  };
}

export interface NodeMappingResult {
  mappedNodes: Array<{
    id: string;
    type: string;
    supported: boolean;
    implementation: string;
    dependencies: string[];
  }>;
  unsupportedNodes: string[];
  dependencies: Record<string, string>;
}

export interface CodeGenerationResult {
  projectId: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  metadata: {
    totalFiles: number;
    totalSize: number;
    generationTime: number;
  };
}

export interface GenerationOptions {
  outputFormat?: 'nodejs' | 'typescript';
  includeTests?: boolean;
  includeTypes?: boolean;
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
}

export interface ProgressUpdate {
  progress: number;
  message: string;
  stage?: string;
}

export class EdgeFunctionService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries = 3;
  private readonly timeout = 30000; // 30 seconds

  constructor(supabaseUrl: string, apiKey: string) {
    this.baseUrl = `${supabaseUrl}/functions/v1`;
    this.apiKey = apiKey;
  }

  async parseWorkflow(workflowJson: string, userId: string): Promise<EdgeFunctionResult<WorkflowParseResult>> {
    return this.callEdgeFunction('parse-workflow', {
      workflowJson,
      userId
    });
  }

  async mapNodes(workflow: any, userId: string, projectId?: string): Promise<EdgeFunctionResult<NodeMappingResult>> {
    return this.callEdgeFunction('map-nodes', {
      nodes: workflow.nodes || [],
      userId,
      projectId
    });
  }

  async generateCode(
    mappedNodes: any[],
    options: GenerationOptions,
    userId: string,
    projectId: string,
    workflowData?: any,
    projectName?: string
  ): Promise<EdgeFunctionResult<CodeGenerationResult>> {
    return this.callEdgeFunction('generate-code', {
      projectId,
      workflowData: workflowData || {},
      mappedNodes,
      userId,
      projectName: projectName || 'Generated Project'
    });
  }

  async generateCodeWithProgress(
    mappedNodes: any[],
    options: GenerationOptions,
    userId: string,
    projectId: string,
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<EdgeFunctionResult<CodeGenerationResult>> {
    try {
      const url = `${this.baseUrl}/generate-code-stream`;
      const payload = {
        mappedNodes,
        options,
        userId,
        projectId
      };

      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        return {
          success: false,
          error: 'No response body available'
        };
      }

      let finalResult: any = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.progress !== undefined && onProgress) {
                  onProgress(data);
                } else if (data.result) {
                  finalResult = data.result;
                }
              } catch (parseError) {
                // Ignore malformed JSON in stream
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (finalResult) {
        return {
          success: true,
          data: finalResult
        };
      } else {
        return {
          success: false,
          error: 'No final result received from stream'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async callEdgeFunction<T>(
    functionName: string,
    payload: any,
    options?: { timeout?: number }
  ): Promise<EdgeFunctionResult<T>> {
    try {
      const url = `${this.baseUrl}/${functionName}`;
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: this.getHeaders(payload),
        body: this.preparePayload(payload)
      };

      const response = await this.fetchWithRetry(url, requestOptions, options?.timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();

      // Validate response format
      if (!this.isValidResponse(data)) {
        return {
          success: false,
          error: 'Invalid response format from Edge Function'
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    timeout?: number
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout || this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === this.maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private getHeaders(payload?: any): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    // Add compression header for large payloads
    if (payload && JSON.stringify(payload).length > 10000) {
      headers['Content-Encoding'] = 'gzip';
    }

    return headers;
  }

  private preparePayload(payload: any): string {
    const jsonString = JSON.stringify(payload);
    
    // For large payloads, we would compress here
    // This is a simplified version - in practice, you'd use a compression library
    if (jsonString.length > 10000) {
      // Placeholder for compression logic
      return jsonString;
    }

    return jsonString;
  }

  private isValidResponse(data: any): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.success === 'boolean'
    );
  }

  // Utility methods for specific Edge Functions
  async testConnection(): Promise<EdgeFunctionResult<{ status: string; timestamp: string }>> {
    return this.callEdgeFunction('health-check', {}, { timeout: 5000 });
  }

  async validateWorkflowSecurity(workflowJson: string): Promise<EdgeFunctionResult<{
    safe: boolean;
    threats: string[];
    scanId: string;
  }>> {
    return this.callEdgeFunction('validate-security', { workflowJson });
  }

  async getNodeSupport(nodeTypes: string[]): Promise<EdgeFunctionResult<{
    supported: string[];
    unsupported: string[];
    alternatives: Record<string, string[]>;
  }>> {
    return this.callEdgeFunction('check-node-support', { nodeTypes });
  }

  async optimizeWorkflow(workflow: any): Promise<EdgeFunctionResult<{
    optimizedWorkflow: any;
    optimizations: Array<{
      type: string;
      description: string;
      impact: 'low' | 'medium' | 'high';
    }>;
  }>> {
    return this.callEdgeFunction('optimize-workflow', { workflow });
  }

  async generateDocumentation(
    workflow: any,
    options: { format: 'markdown' | 'html'; includeExamples: boolean }
  ): Promise<EdgeFunctionResult<{
    documentation: string;
    format: string;
  }>> {
    return this.callEdgeFunction('generate-docs', { workflow, options });
  }

  // Batch operations
  async batchProcessWorkflows(
    workflows: Array<{ id: string; json: string }>,
    userId: string
  ): Promise<EdgeFunctionResult<Array<{
    id: string;
    success: boolean;
    result?: any;
    error?: string;
  }>>> {
    return this.callEdgeFunction('batch-process', { workflows, userId });
  }

  // Analytics and monitoring
  async getEdgeFunctionMetrics(): Promise<EdgeFunctionResult<{
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  }>> {
    return this.callEdgeFunction('metrics', {});
  }

  async reportError(error: {
    functionName: string;
    errorMessage: string;
    stackTrace?: string;
    userId?: string;
    requestId?: string;
  }): Promise<EdgeFunctionResult<{ reported: boolean }>> {
    return this.callEdgeFunction('report-error', error);
  }

  // Configuration and management
  async updateFunctionConfig(config: {
    timeout?: number;
    memoryLimit?: number;
    concurrency?: number;
  }): Promise<EdgeFunctionResult<{ updated: boolean }>> {
    return this.callEdgeFunction('update-config', config);
  }

  async getFunctionStatus(): Promise<EdgeFunctionResult<{
    functions: Array<{
      name: string;
      status: 'active' | 'inactive' | 'error';
      lastDeployment: string;
      version: string;
    }>;
  }>> {
    return this.callEdgeFunction('function-status', {});
  }

  // Helper methods for error handling
  isRetryableError(error: string): boolean {
    const retryableErrors = [
      'network timeout',
      'connection refused',
      'temporary failure',
      'rate limit exceeded'
    ];

    return retryableErrors.some(retryableError => 
      error.toLowerCase().includes(retryableError)
    );
  }

  getErrorCategory(error: string): 'network' | 'auth' | 'validation' | 'server' | 'unknown' {
    const errorLower = error.toLowerCase();

    if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('connection')) {
      return 'network';
    }
    if (errorLower.includes('unauthorized') || errorLower.includes('forbidden') || errorLower.includes('auth')) {
      return 'auth';
    }
    if (errorLower.includes('validation') || errorLower.includes('invalid') || errorLower.includes('malformed')) {
      return 'validation';
    }
    if (errorLower.includes('internal server') || errorLower.includes('500')) {
      return 'server';
    }

    return 'unknown';
  }

  // Cleanup and resource management
  async cleanup(): Promise<void> {
    // Cleanup any pending requests or resources
    // This would be implemented based on specific needs
  }
}