/**
 * Workflow Parser
 * Parses and validates n8n workflow JSON files
 */

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
  disabled?: boolean;
}

export interface WorkflowConnection {
  node: string;
  type: string;
  index: number;
}

export interface WorkflowData {
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, Record<string, WorkflowConnection[]>>;
  active?: boolean;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
}

export interface WorkflowMetadata {
  nodeCount: number;
  triggerCount: number;
  actionCount: number;
  nodeTypes: string[];
  credentialTypes: string[];
  requiresCredentials: boolean;
  environmentVariables: string[];
  complexity: number;
}

export interface ParseResult {
  isValid: boolean;
  workflow: WorkflowData | null;
  metadata: WorkflowMetadata;
  errors: string[];
  warnings: string[];
}

export interface NodeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class WorkflowParser {
  private readonly triggerNodeTypes = [
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.cron',
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.emailTrigger',
    'n8n-nodes-base.fileTrigger'
  ];

  private readonly supportedNodeTypes = [
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.cron',
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.httpRequest',
    'n8n-nodes-base.set',
    'n8n-nodes-base.code',
    'n8n-nodes-base.if',
    'n8n-nodes-base.switch',
    'n8n-nodes-base.merge',
    'n8n-nodes-base.function',
    'n8n-nodes-base.executeWorkflow'
  ];

  private readonly nodeParameterSchemas: Record<string, any> = {
    'n8n-nodes-base.httpRequest': {
      required: ['url'],
      optional: ['method', 'headers', 'body', 'timeout', 'followRedirect']
    },
    'n8n-nodes-base.set': {
      required: [],
      optional: ['operations', 'options']
    },
    'n8n-nodes-base.webhook': {
      required: [],
      optional: ['path', 'httpMethod', 'responseMode', 'responseData']
    },
    'n8n-nodes-base.cron': {
      required: ['triggerTimes'],
      optional: ['timezone']
    }
  };

  parseWorkflow(jsonString: string): ParseResult {
    const result: ParseResult = {
      isValid: false,
      workflow: null,
      metadata: this.createEmptyMetadata(),
      errors: [],
      warnings: []
    };

    // Handle null/undefined input
    if (!jsonString) {
      result.errors.push('Input is null or undefined');
      return result;
    }

    try {
      // Parse JSON
      const workflowData = JSON.parse(jsonString);
      
      // Validate basic structure
      const structureValidation = this.validateWorkflowStructure(workflowData);
      if (!structureValidation.isValid) {
        result.errors.push(...structureValidation.errors);
        result.warnings.push(...structureValidation.warnings);
        return result;
      }

      // Validate nodes
      const nodeValidation = this.validateNodes(workflowData.nodes);
      if (!nodeValidation.isValid) {
        result.errors.push(...nodeValidation.errors);
        result.warnings.push(...nodeValidation.warnings);
      }

      // Validate connections
      const connectionValidation = this.validateConnections(workflowData.nodes, workflowData.connections);
      if (!connectionValidation.isValid) {
        result.errors.push(...connectionValidation.errors);
        result.warnings.push(...connectionValidation.warnings);
      }

      // Check for circular dependencies
      const circularCheck = this.checkCircularDependencies(workflowData.connections);
      if (!circularCheck.isValid) {
        result.errors.push(...circularCheck.errors);
      }

      // Generate metadata
      result.metadata = this.generateMetadata(workflowData);
      result.workflow = workflowData;
      result.isValid = result.errors.length === 0;

      return result;

    } catch (error) {
      result.errors.push('Invalid JSON format');
      return result;
    }
  }

  validateNodeParameters(node: WorkflowNode): NodeValidationResult {
    const result: NodeValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const schema = this.nodeParameterSchemas[node.type];
    if (!schema) {
      result.warnings.push(`No parameter schema available for node type: ${node.type}`);
      return result;
    }

    // Check required parameters
    for (const requiredParam of schema.required) {
      if (!node.parameters || !(requiredParam in node.parameters)) {
        result.errors.push(`Missing required parameter '${requiredParam}' for node '${node.name}'`);
        result.isValid = false;
      }
    }

    // Validate parameter types based on node type
    if (node.type === 'n8n-nodes-base.httpRequest') {
      this.validateHttpRequestParameters(node, result);
    } else if (node.type === 'n8n-nodes-base.set') {
      this.validateSetNodeParameters(node, result);
    }

    return result;
  }

  private validateWorkflowStructure(data: any): NodeValidationResult {
    const result: NodeValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check required properties
    if (!data.name || typeof data.name !== 'string') {
      result.errors.push('Missing or invalid workflow name');
      result.isValid = false;
    }

    if (!data.nodes || !Array.isArray(data.nodes)) {
      result.errors.push('Missing required property: nodes');
      result.isValid = false;
    }

    if (!data.connections || typeof data.connections !== 'object') {
      result.errors.push('Missing required property: connections');
      result.isValid = false;
    }

    // Check if workflow has at least one node
    if (data.nodes && Array.isArray(data.nodes) && data.nodes.length === 0) {
      result.errors.push('Workflow must contain at least one node');
      result.isValid = false;
    }

    return result;
  }

  private validateNodes(nodes: WorkflowNode[]): NodeValidationResult {
    const result: NodeValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const nodeIds = new Set<string>();

    for (const node of nodes) {
      // Check required node properties
      if (!node.id || typeof node.id !== 'string') {
        result.errors.push('Node missing required property: id');
        result.isValid = false;
        continue;
      }

      if (!node.name || typeof node.name !== 'string') {
        result.errors.push(`Node '${node.id}' missing required property: name`);
        result.isValid = false;
      }

      if (!node.type || typeof node.type !== 'string') {
        result.errors.push(`Node '${node.id}' missing required property: type`);
        result.isValid = false;
      }

      if (typeof node.typeVersion !== 'number') {
        result.errors.push(`Node '${node.id}' missing required property: typeVersion`);
        result.isValid = false;
      }

      // Check for duplicate node IDs
      if (nodeIds.has(node.id)) {
        result.errors.push(`Duplicate node ID: ${node.id}`);
        result.isValid = false;
      }
      nodeIds.add(node.id);

      // Validate node type version
      if (node.typeVersion && node.typeVersion > 10) {
        result.errors.push(`Unsupported node type version ${node.typeVersion} for node '${node.id}'`);
        result.isValid = false;
      }

      // Validate node parameters
      const paramValidation = this.validateNodeParameters(node);
      if (!paramValidation.isValid) {
        result.errors.push(`Node validation failed for '${node.id}': ${paramValidation.errors.join(', ')}`);
        result.isValid = false;
      }
      result.warnings.push(...paramValidation.warnings);
    }

    return result;
  }

  private validateConnections(nodes: WorkflowNode[], connections: Record<string, Record<string, WorkflowConnection[]>>): NodeValidationResult {
    const result: NodeValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const nodeIds = new Set(nodes.map(node => node.id));

    for (const [sourceNodeId, connectionTypes] of Object.entries(connections)) {
      if (!nodeIds.has(sourceNodeId)) {
        result.errors.push(`Invalid connection source: node '${sourceNodeId}' does not exist`);
        result.isValid = false;
        continue;
      }

      for (const [connectionType, connectionList] of Object.entries(connectionTypes)) {
        for (const connection of connectionList) {
          if (!nodeIds.has(connection.node)) {
            result.errors.push(`Invalid connection reference: node '${connection.node}' does not exist`);
            result.isValid = false;
          }

          if (typeof connection.index !== 'number' || connection.index < 0) {
            result.errors.push(`Invalid connection index for connection from '${sourceNodeId}' to '${connection.node}'`);
            result.isValid = false;
          }
        }
      }
    }

    return result;
  }

  private checkCircularDependencies(connections: Record<string, Record<string, WorkflowConnection[]>>): NodeValidationResult {
    const result: NodeValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const nodeConnections = connections[nodeId];
      if (nodeConnections) {
        for (const connectionType of Object.values(nodeConnections)) {
          for (const connection of connectionType) {
            if (hasCycle(connection.node)) {
              return true;
            }
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of Object.keys(connections)) {
      if (!visited.has(nodeId) && hasCycle(nodeId)) {
        result.errors.push('Circular dependency detected in workflow connections');
        result.isValid = false;
        break;
      }
    }

    return result;
  }

  private validateHttpRequestParameters(node: WorkflowNode, result: NodeValidationResult): void {
    const params = node.parameters;

    if (params.url && typeof params.url !== 'string') {
      result.errors.push(`Invalid URL parameter type for node '${node.name}'`);
      result.isValid = false;
    }

    if (params.method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(params.method)) {
      result.errors.push(`Invalid HTTP method '${params.method}' for node '${node.name}'`);
      result.isValid = false;
    }

    if (params.timeout && (typeof params.timeout !== 'number' || params.timeout < 0)) {
      result.errors.push(`Invalid timeout value for node '${node.name}'`);
      result.isValid = false;
    }
  }

  private validateSetNodeParameters(node: WorkflowNode, result: NodeValidationResult): void {
    const params = node.parameters;

    if (params.operations && !Array.isArray(params.operations)) {
      result.errors.push(`Parameter 'operations' must be an array for node '${node.name}'`);
      result.isValid = false;
    }
  }

  private generateMetadata(workflow: WorkflowData): WorkflowMetadata {
    const metadata: WorkflowMetadata = {
      nodeCount: workflow.nodes.length,
      triggerCount: 0,
      actionCount: 0,
      nodeTypes: [],
      credentialTypes: [],
      requiresCredentials: false,
      environmentVariables: [],
      complexity: 0
    };

    const nodeTypes = new Set<string>();
    const credentialTypes = new Set<string>();
    const envVars = new Set<string>();

    for (const node of workflow.nodes) {
      nodeTypes.add(node.type);

      // Count triggers vs actions
      if (this.triggerNodeTypes.includes(node.type)) {
        metadata.triggerCount++;
      } else {
        metadata.actionCount++;
      }

      // Extract credentials
      if (node.credentials) {
        Object.keys(node.credentials).forEach(credType => credentialTypes.add(credType));
        metadata.requiresCredentials = true;
      }

      // Extract environment variables
      this.extractEnvironmentVariables(node.parameters, envVars);
    }

    metadata.nodeTypes = Array.from(nodeTypes);
    metadata.credentialTypes = Array.from(credentialTypes);
    metadata.environmentVariables = Array.from(envVars);
    metadata.complexity = this.calculateComplexity(workflow);

    return metadata;
  }

  private extractEnvironmentVariables(obj: any, envVars: Set<string>): void {
    if (typeof obj === 'string') {
      // Match patterns like $env.VAR_NAME or {{ $env.VAR_NAME }}
      const envMatches = obj.match(/\$env\.([A-Z_][A-Z0-9_]*)/gi);
      if (envMatches) {
        envMatches.forEach(match => {
          const varName = match.replace(/\$env\./i, '');
          envVars.add(varName);
        });
      }
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(value => {
        this.extractEnvironmentVariables(value, envVars);
      });
    }
  }

  private calculateComplexity(workflow: WorkflowData): number {
    let complexity = 0;

    // Base complexity from node count
    complexity += workflow.nodes.length;

    // Add complexity for connections
    for (const connections of Object.values(workflow.connections)) {
      for (const connectionList of Object.values(connections)) {
        complexity += connectionList.length;
      }
    }

    // Add complexity for credentials
    const hasCredentials = workflow.nodes.some(node => node.credentials && Object.keys(node.credentials).length > 0);
    if (hasCredentials) {
      complexity += 5;
    }

    // Add complexity for different node types
    const uniqueNodeTypes = new Set(workflow.nodes.map(node => node.type));
    complexity += uniqueNodeTypes.size * 2;

    return complexity;
  }

  private createEmptyMetadata(): WorkflowMetadata {
    return {
      nodeCount: 0,
      triggerCount: 0,
      actionCount: 0,
      nodeTypes: [],
      credentialTypes: [],
      requiresCredentials: false,
      environmentVariables: [],
      complexity: 0
    };
  }
}