/**
 * Node Mapping System - Main exports
 * Comprehensive system for mapping n8n nodes to standalone implementations
 */

// Core classes
export { NodeRegistry, nodeRegistry } from './node-registry';
export { ParameterTransformer } from './parameter-transformer';
export { CredentialMapper, credentialMapper } from './credential-mapper';
export { DependencyGenerator, dependencyGenerator } from './dependency-generator';
export { NodeMapper, nodeMapper } from './node-mapper';

// Type definitions
export type {
  NodeTypeDefinition,
  ParameterDefinition,
  CredentialDefinition,
  ImportDefinition,
  OutputDefinition,
  InputDefinition
} from './node-registry';

export type {
  TransformationContext,
  ValidationResult,
  TransformationResult
} from './parameter-transformer';

export type {
  CredentialMapping,
  FieldMapping,
  EnvironmentVariableMapping,
  CredentialValidation,
  MappedCredential
} from './credential-mapper';

export type {
  DependencyInfo,
  ImportInfo,
  GeneratedDependencies
} from './dependency-generator';

export type {
  WorkflowNode,
  WorkflowConnection,
  WorkflowData,
  MappedNode,
  MappingResult
} from './node-mapper';

// Utility functions
export const NodeMappingUtils = {
  /**
   * Quick check if a workflow is fully supported
   */
  isWorkflowSupported(workflowData: WorkflowData): boolean {
    return workflowData.nodes.every(node => 
      nodeRegistry.isNodeTypeSupported(node.type)
    );
  },

  /**
   * Get unsupported node types in a workflow
   */
  getUnsupportedNodeTypes(workflowData: WorkflowData): string[] {
    return workflowData.nodes
      .filter(node => !nodeRegistry.isNodeTypeSupported(node.type))
      .map(node => node.type)
      .filter((type, index, arr) => arr.indexOf(type) === index); // unique
  },

  /**
   * Calculate workflow complexity score
   */
  calculateComplexityScore(workflowData: WorkflowData): number {
    const nodeCount = workflowData.nodes.length;
    const connectionCount = Object.values(workflowData.connections || {})
      .reduce((total, nodeConnections) => {
        return total + Object.values(nodeConnections)
          .reduce((nodeTotal, connections) => nodeTotal + connections.length, 0);
      }, 0);
    
    // Simple complexity calculation
    return nodeCount + (connectionCount * 0.5);
  },

  /**
   * Estimate conversion time in minutes
   */
  estimateConversionTime(workflowData: WorkflowData): number {
    const stats = nodeMapper.getWorkflowMappingStats(workflowData);
    const complexity = this.calculateComplexityScore(workflowData);
    
    // Base time: 2 minutes per supported node, 5 minutes per unsupported node
    const supportedTime = stats.supportedNodes * 2;
    const unsupportedTime = (stats.totalNodes - stats.supportedNodes) * 5;
    const complexityMultiplier = Math.max(1, complexity / 10);
    
    return Math.ceil((supportedTime + unsupportedTime) * complexityMultiplier);
  },

  /**
   * Generate conversion summary
   */
  generateConversionSummary(mappingResult: MappingResult): string {
    const { metadata, validation } = mappingResult;
    const supportedPercentage = metadata.totalNodes > 0 
      ? Math.round((metadata.supportedNodes / metadata.totalNodes) * 100)
      : 0;

    const lines = [
      `# Workflow Conversion Summary`,
      ``,
      `## Overview`,
      `- **Total Nodes**: ${metadata.totalNodes}`,
      `- **Supported Nodes**: ${metadata.supportedNodes} (${supportedPercentage}%)`,
      `- **Trigger Nodes**: ${metadata.triggerNodes}`,
      `- **Action Nodes**: ${metadata.actionNodes}`,
      `- **Transform Nodes**: ${metadata.transformNodes}`,
      ``
    ];

    if (validation.errors.length > 0) {
      lines.push(`## Errors (${validation.errors.length})`);
      validation.errors.forEach(error => lines.push(`- ${error}`));
      lines.push(``);
    }

    if (validation.warnings.length > 0) {
      lines.push(`## Warnings (${validation.warnings.length})`);
      validation.warnings.forEach(warning => lines.push(`- ${warning}`));
      lines.push(``);
    }

    if (validation.unsupportedNodes.length > 0) {
      lines.push(`## Unsupported Node Types`);
      validation.unsupportedNodes.forEach(nodeType => lines.push(`- ${nodeType}`));
      lines.push(``);
    }

    const envVarCount = Object.keys(mappingResult.environmentVariables).length;
    const credCount = Object.keys(mappingResult.credentialTemplates).length;

    if (envVarCount > 0 || credCount > 0) {
      lines.push(`## Configuration Required`);
      if (envVarCount > 0) {
        lines.push(`- **Environment Variables**: ${envVarCount} variables need to be set`);
      }
      if (credCount > 0) {
        lines.push(`- **Credentials**: ${credCount} credential fields need to be configured`);
      }
      lines.push(``);
    }

    lines.push(`## Status`);
    if (validation.valid) {
      lines.push(`✅ **Ready for conversion** - All nodes are supported and properly configured.`);
    } else {
      lines.push(`❌ **Conversion blocked** - Please resolve the errors above before proceeding.`);
    }

    return lines.join('\n');
  }
};

// Default export for convenience
export default {
  nodeRegistry,
  nodeMapper,
  credentialMapper,
  dependencyGenerator,
  utils: NodeMappingUtils
};