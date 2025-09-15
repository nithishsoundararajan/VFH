/**
 * Node Mapper - Main orchestrator for node mapping and transformation
 * Coordinates between registry, parameter transformer, credential mapper, and dependency generator
 */

import { nodeRegistry, NodeTypeDefinition } from './node-registry';
import { ParameterTransformer, TransformationContext, TransformationResult } from './parameter-transformer';
import { credentialMapper, MappedCredential } from './credential-mapper';
import { dependencyGenerator, GeneratedDependencies } from './dependency-generator';

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
}

export interface WorkflowConnection {
  node: string;
  type: string;
  index: number;
}

export interface WorkflowData {
  nodes: WorkflowNode[];
  connections: Record<string, Record<string, WorkflowConnection[]>>;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
}

export interface MappedNode {
  id: string;
  name: string;
  type: string;
  nodeDefinition: NodeTypeDefinition;
  transformedParameters: TransformationResult;
  mappedCredentials: MappedCredential[];
  implementation: {
    className: string;
    filePath: string;
    imports: string[];
  };
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface MappingResult {
  nodes: MappedNode[];
  dependencies: GeneratedDependencies;
  environmentVariables: Record<string, string>;
  credentialTemplates: Record<string, any>;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    unsupportedNodes: string[];
  };
  metadata: {
    totalNodes: number;
    supportedNodes: number;
    triggerNodes: number;
    actionNodes: number;
    transformNodes: number;
  };
}

/**
 * Node Mapper - Main class for mapping n8n workflows to standalone implementations
 */
export class NodeMapper {
  private parameterTransformer: ParameterTransformer;

  constructor() {
    this.parameterTransformer = new ParameterTransformer();
  }

  /**
   * Map an entire n8n workflow to standalone format
   */
  mapWorkflow(
    workflowData: WorkflowData,
    context: Partial<TransformationContext> = {}
  ): MappingResult {
    const result: MappingResult = {
      nodes: [],
      dependencies: {
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        imports: { npm: [], builtin: [], local: [] },
        packageJsonUpdates: {}
      },
      environmentVariables: {},
      credentialTemplates: {},
      validation: {
        valid: true,
        errors: [],
        warnings: [],
        unsupportedNodes: []
      },
      metadata: {
        totalNodes: workflowData.nodes.length,
        supportedNodes: 0,
        triggerNodes: 0,
        actionNodes: 0,
        transformNodes: 0
      }
    };

    const mappedNodes: MappedNode[] = [];
    const nodeDefinitions: NodeTypeDefinition[] = [];

    // Map each node
    workflowData.nodes.forEach(node => {
      try {
        const mappedNode = this.mapSingleNode(node, workflowData, context);
        mappedNodes.push(mappedNode);
        
        if (mappedNode.validation.valid) {
          result.metadata.supportedNodes++;
          nodeDefinitions.push(mappedNode.nodeDefinition);
          
          // Count by category
          switch (mappedNode.nodeDefinition.category) {
            case 'trigger':
              result.metadata.triggerNodes++;
              break;
            case 'action':
              result.metadata.actionNodes++;
              break;
            case 'transform':
              result.metadata.transformNodes++;
              break;
          }
        } else {
          result.validation.valid = false;
          result.validation.errors.push(...mappedNode.validation.errors);
          result.validation.warnings.push(...mappedNode.validation.warnings);
        }

        // Collect environment variables
        mappedNode.transformedParameters.environmentVariables.forEach(envVar => {
          result.environmentVariables[envVar] = `your_${envVar.toLowerCase()}_here`;
        });

        // Collect credential templates
        mappedNode.mappedCredentials.forEach(cred => {
          Object.entries(cred.environmentVariables).forEach(([key, value]) => {
            result.credentialTemplates[key] = value;
          });
        });

      } catch (error) {
        result.validation.valid = false;
        result.validation.errors.push(`Failed to map node ${node.name}: ${error.message}`);
        result.validation.unsupportedNodes.push(node.type);
      }
    });

    result.nodes = mappedNodes;

    // Generate dependencies
    if (nodeDefinitions.length > 0) {
      result.dependencies = dependencyGenerator.generateDependencies(nodeDefinitions);
    }

    // Final validation
    this.validateMappingResult(result);

    return result;
  }

  /**
   * Map a single node
   */
  private mapSingleNode(
    node: WorkflowNode,
    workflowData: WorkflowData,
    context: Partial<TransformationContext>
  ): MappedNode {
    // Get node type definition
    const nodeDefinition = nodeRegistry.getNodeType(node.type);
    
    if (!nodeDefinition) {
      throw new Error(`Unsupported node type: ${node.type}`);
    }

    if (!nodeDefinition.supported) {
      throw new Error(`Node type not yet supported: ${node.type}`);
    }

    // Build transformation context
    const transformationContext: TransformationContext = {
      nodeId: node.id,
      nodeType: node.type,
      workflowData,
      environmentVariables: context.environmentVariables || {},
      credentials: context.credentials || {}
    };

    // Transform parameters
    const transformedParameters = this.parameterTransformer.transformParameters(
      nodeDefinition,
      node.parameters,
      transformationContext
    );

    // Map credentials
    const mappedCredentials: MappedCredential[] = [];
    if (node.credentials && nodeDefinition.credentials) {
      Object.entries(node.credentials).forEach(([credType, credName]) => {
        const credentialData = transformationContext.credentials[credName] || {};
        const mappedCred = credentialMapper.mapCredential(credType, credentialData);
        mappedCredentials.push(mappedCred);
      });
    }

    // Generate imports for this node
    const imports = dependencyGenerator.generateImportStatements(
      nodeDefinition.imports,
      'js'
    );

    // Create mapped node
    const mappedNode: MappedNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      nodeDefinition,
      transformedParameters,
      mappedCredentials,
      implementation: {
        className: nodeDefinition.implementation.className,
        filePath: nodeDefinition.implementation.filePath,
        imports
      },
      validation: {
        valid: transformedParameters.validation.valid,
        errors: [...transformedParameters.validation.errors],
        warnings: [...transformedParameters.validation.warnings]
      }
    };

    // Add credential validation errors
    mappedCredentials.forEach(cred => {
      if (!cred.validation.valid) {
        mappedNode.validation.valid = false;
        mappedNode.validation.errors.push(...cred.validation.errors);
      }
      mappedNode.validation.warnings.push(...cred.validation.warnings);
    });

    return mappedNode;
  }

  /**
   * Validate the overall mapping result
   */
  private validateMappingResult(result: MappingResult): void {
    // Check if we have any supported nodes
    if (result.metadata.supportedNodes === 0) {
      result.validation.valid = false;
      result.validation.errors.push('No supported nodes found in workflow');
    }

    // Check if we have at least one trigger node
    if (result.metadata.triggerNodes === 0) {
      result.validation.warnings.push('No trigger nodes found - workflow may need manual execution');
    }

    // Check for circular dependencies (basic check)
    const nodeIds = result.nodes.map(n => n.id);
    const hasCircularDeps = this.checkCircularDependencies(result.nodes);
    if (hasCircularDeps) {
      result.validation.warnings.push('Potential circular dependencies detected in workflow');
    }

    // Validate environment variables
    const envVarCount = Object.keys(result.environmentVariables).length;
    if (envVarCount > 0) {
      result.validation.warnings.push(
        `${envVarCount} environment variables need to be configured`
      );
    }

    // Validate credentials
    const credCount = Object.keys(result.credentialTemplates).length;
    if (credCount > 0) {
      result.validation.warnings.push(
        `${credCount} credential fields need to be configured`
      );
    }
  }

  /**
   * Basic circular dependency check
   */
  private checkCircularDependencies(nodes: MappedNode[]): boolean {
    // This is a simplified check - in a real implementation,
    // you'd analyze the workflow connections
    return false;
  }

  /**
   * Generate code templates for mapped nodes
   */
  generateNodeImplementations(mappedNodes: MappedNode[]): Record<string, string> {
    const implementations: Record<string, string> = {};

    mappedNodes.forEach(node => {
      if (node.validation.valid) {
        const code = this.generateNodeImplementation(node);
        implementations[node.implementation.filePath] = code;
      }
    });

    return implementations;
  }

  /**
   * Generate implementation code for a single node
   */
  private generateNodeImplementation(node: MappedNode): string {
    const { nodeDefinition, transformedParameters, implementation } = node;
    
    const imports = implementation.imports.join('\n');
    const className = implementation.className;
    const baseClass = nodeDefinition.implementation.baseClass;

    // Generate parameter assignments
    const parameterCode = Object.entries(transformedParameters.parameters)
      .map(([key, value]) => {
        const valueStr = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
        return `    this.${key} = ${valueStr};`;
      })
      .join('\n');

    // Generate credential access methods
    const credentialCode = node.mappedCredentials.length > 0 
      ? this.generateCredentialMethods(node.mappedCredentials)
      : '';

    return `${imports}

/**
 * ${nodeDefinition.displayName} Node Implementation
 * ${nodeDefinition.description}
 */
class ${className} extends ${baseClass} {
  constructor(parameters = {}) {
    super();
    
    // Initialize parameters
${parameterCode}
    
    // Override with provided parameters
    Object.assign(this, parameters);
  }

${credentialCode}

  /**
   * Execute the node
   */
  async execute(inputData, context) {
    try {
      // Implementation will be generated based on node type
      return await this.processData(inputData, context);
    } catch (error) {
      throw new Error(\`\${this.constructor.name} execution failed: \${error.message}\`);
    }
  }

  /**
   * Process data - to be implemented by specific node types
   */
  async processData(inputData, context) {
    throw new Error('processData method must be implemented by subclass');
  }
}

module.exports = ${className};`;
  }

  /**
   * Generate credential access methods
   */
  private generateCredentialMethods(credentials: MappedCredential[]): string {
    const methods = credentials.map(cred => {
      const methodName = `get${cred.type.charAt(0).toUpperCase() + cred.type.slice(1)}Credential`;
      const fields = Object.keys(cred.fields).map(field => 
        `      ${field}: process.env.${cred.environmentVariables[field] || field.toUpperCase()}`
      ).join(',\n');

      return `  /**
   * Get ${cred.type} credential
   */
  ${methodName}() {
    return {
${fields}
    };
  }`;
    });

    return methods.join('\n\n');
  }

  /**
   * Get supported node types
   */
  getSupportedNodeTypes(): NodeTypeDefinition[] {
    return nodeRegistry.getSupportedNodeTypes();
  }

  /**
   * Check if node type is supported
   */
  isNodeTypeSupported(nodeType: string): boolean {
    return nodeRegistry.isNodeTypeSupported(nodeType);
  }

  /**
   * Get mapping statistics for a workflow
   */
  getWorkflowMappingStats(workflowData: WorkflowData): {
    totalNodes: number;
    supportedNodes: number;
    unsupportedNodes: string[];
    supportedPercentage: number;
  } {
    const totalNodes = workflowData.nodes.length;
    const supportedNodes = workflowData.nodes.filter(node => 
      this.isNodeTypeSupported(node.type)
    ).length;
    const unsupportedNodes = workflowData.nodes
      .filter(node => !this.isNodeTypeSupported(node.type))
      .map(node => node.type);

    return {
      totalNodes,
      supportedNodes,
      unsupportedNodes,
      supportedPercentage: totalNodes > 0 ? (supportedNodes / totalNodes) * 100 : 0
    };
  }
}

// Export singleton instance
export const nodeMapper = new NodeMapper();