/**
 * Node Configuration Extractor
 * Extracts detailed configuration from n8n workflow JSON and prepares it for code generation
 */

export interface NodeConfiguration {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
  disabled?: boolean;
}

export interface ExtractedConfig {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  configuredParameters: ConfiguredParameter[];
  credentials: CredentialConfig[];
  executionMode?: string;
  customCode?: string;
  dependencies: string[];
  environmentVariables: EnvironmentVariable[];
}

export interface ConfiguredParameter {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'expression';
  isExpression: boolean;
  defaultValue?: any;
  required: boolean;
  description?: string;
}

export interface CredentialConfig {
  type: string;
  name: string;
  fields: Record<string, string>;
  environmentVariables: Record<string, string>;
}

export interface EnvironmentVariable {
  key: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  example?: string;
}

export class NodeConfigurationExtractor {
  
  /**
   * Extract configuration from all nodes in a workflow
   */
  extractWorkflowConfiguration(workflowJson: any): ExtractedConfig[] {
    const nodes = workflowJson.nodes || [];
    return nodes.map(node => this.extractNodeConfiguration(node));
  }

  /**
   * Extract detailed configuration from a single node
   */
  extractNodeConfiguration(node: NodeConfiguration): ExtractedConfig {
    const config: ExtractedConfig = {
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name,
      configuredParameters: [],
      credentials: [],
      dependencies: [],
      environmentVariables: []
    };

    // Extract parameters with detailed analysis
    if (node.parameters) {
      config.configuredParameters = this.extractParameters(node.parameters, node.type);
    }

    // Extract credentials
    if (node.credentials) {
      config.credentials = this.extractCredentials(node.credentials, node.type);
    }

    // Extract node-specific configurations
    this.extractNodeSpecificConfig(node, config);

    // Determine dependencies based on node type and configuration
    config.dependencies = this.determineDependencies(node.type, node.parameters);

    // Generate environment variables
    config.environmentVariables = this.generateEnvironmentVariables(config);

    return config;
  }

  /**
   * Extract and analyze parameters with type detection
   */
  private extractParameters(parameters: Record<string, any>, nodeType: string): ConfiguredParameter[] {
    const configuredParams: ConfiguredParameter[] = [];

    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const param: ConfiguredParameter = {
        name: paramName,
        value: paramValue,
        type: this.detectParameterType(paramValue),
        isExpression: this.isExpression(paramValue),
        required: this.isParameterRequired(paramName, nodeType),
        description: this.getParameterDescription(paramName, nodeType)
      };

      // Handle special parameter types
      if (param.isExpression) {
        param.value = this.convertExpression(paramValue);
      }

      configuredParams.push(param);
    }

    return configuredParams;
  }

  /**
   * Extract credential configurations
   */
  private extractCredentials(credentials: Record<string, string>, nodeType: string): CredentialConfig[] {
    const credentialConfigs: CredentialConfig[] = [];

    for (const [credType, credName] of Object.entries(credentials)) {
      const credConfig: CredentialConfig = {
        type: credType,
        name: credName,
        fields: this.getCredentialFields(credType),
        environmentVariables: this.generateCredentialEnvVars(credType, credName)
      };

      credentialConfigs.push(credConfig);
    }

    return credentialConfigs;
  }

  /**
   * Extract node-specific configurations
   */
  private extractNodeSpecificConfig(node: NodeConfiguration, config: ExtractedConfig): void {
    switch (node.type) {
      case 'n8n-nodes-base.code':
        config.executionMode = node.parameters?.mode || 'runOnceForAllItems';
        config.customCode = node.parameters?.jsCode || '';
        break;

      case 'n8n-nodes-base.httpRequest':
        // Extract HTTP-specific configurations
        config.executionMode = 'http';
        break;

      case 'n8n-nodes-base.set':
        // Extract Set node assignments with detailed structure
        if (node.parameters?.assignments?.assignments) {
          config.customCode = JSON.stringify(node.parameters.assignments.assignments, null, 2);
        }
        break;

      case 'n8n-nodes-base.webhook':
        // Extract webhook configurations
        config.executionMode = 'webhook';
        break;

      case 'n8n-nodes-base.telegram':
        // Extract Telegram-specific configurations
        config.executionMode = node.parameters?.operation || 'sendMessage';
        break;

      case 'n8n-nodes-base.switch':
        // Extract Switch node rules and conditions
        if (node.parameters?.rules?.values) {
          config.customCode = JSON.stringify(node.parameters.rules.values, null, 2);
        }
        break;

      case 'n8n-nodes-base.googleSheets':
        // Extract Google Sheets configurations
        config.executionMode = node.parameters?.operation || 'read';
        break;

      case '@n8n/n8n-nodes-langchain.googleGemini':
        // Extract Google Gemini AI configurations
        config.executionMode = node.parameters?.operation || 'analyze';
        if (node.parameters?.text) {
          config.customCode = node.parameters.text;
        }
        break;

      case '@n8n/n8n-nodes-langchain.agent':
        // Extract LangChain Agent configurations
        config.executionMode = 'agent';
        if (node.parameters?.options?.systemMessage) {
          config.customCode = node.parameters.options.systemMessage;
        }
        break;
    }
  }

  /**
   * Detect parameter type
   */
  private detectParameterType(value: any): ConfiguredParameter['type'] {
    if (typeof value === 'string') {
      if (this.isExpression(value)) return 'expression';
      return 'string';
    }
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  /**
   * Check if value is an n8n expression
   */
  private isExpression(value: any): boolean {
    if (typeof value !== 'string') return false;
    return value.includes('{{') && value.includes('}}') || 
           value.startsWith('=') ||
           value.includes('$json') ||
           value.includes('$node') ||
           value.includes('$parameter');
  }

  /**
   * Convert n8n expressions to standalone code
   */
  private convertExpression(expression: string): string {
    let converted = expression;

    // Convert n8n expressions to JavaScript
    converted = converted.replace(/\{\{\s*([^}]+)\s*\}\}/g, '${$1}');
    converted = converted.replace(/\$json/g, 'inputData');
    converted = converted.replace(/\$node\["([^"]+)"\]/g, 'context.getNodeOutput("$1")');
    converted = converted.replace(/\$parameter\["([^"]+)"\]/g, 'this.getParameter("$1")');

    return converted;
  }

  /**
   * Determine if parameter is required for the node type
   */
  private isParameterRequired(paramName: string, nodeType: string): boolean {
    const requiredParams: Record<string, string[]> = {
      'n8n-nodes-base.httpRequest': ['url'],
      'n8n-nodes-base.webhook': ['path'],
      'n8n-nodes-base.set': ['assignments'],
      'n8n-nodes-base.code': ['jsCode']
    };

    return requiredParams[nodeType]?.includes(paramName) || false;
  }

  /**
   * Get parameter description
   */
  private getParameterDescription(paramName: string, nodeType: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      'n8n-nodes-base.httpRequest': {
        'url': 'The URL to make the HTTP request to',
        'method': 'HTTP method (GET, POST, PUT, DELETE, etc.)',
        'headers': 'HTTP headers to send with the request',
        'body': 'Request body data',
        'timeout': 'Request timeout in milliseconds'
      },
      'n8n-nodes-base.set': {
        'assignments': 'Data assignments to set on the output',
        'options': 'Additional options for the Set node'
      },
      'n8n-nodes-base.code': {
        'jsCode': 'JavaScript code to execute',
        'mode': 'Execution mode (runOnceForAllItems or runOnceForEachItem)'
      }
    };

    return descriptions[nodeType]?.[paramName] || `Configuration for ${paramName}`;
  }

  /**
   * Determine dependencies based on node type and configuration
   */
  private determineDependencies(nodeType: string, parameters: Record<string, any>): string[] {
    const baseDependencies: Record<string, string[]> = {
      'n8n-nodes-base.httpRequest': ['axios', 'form-data'],
      'n8n-nodes-base.webhook': ['express', 'body-parser'],
      'n8n-nodes-base.code': ['vm2'],
      'n8n-nodes-base.set': ['lodash'],
      'n8n-nodes-base.mysql': ['mysql2'],
      'n8n-nodes-base.postgres': ['pg'],
      'n8n-nodes-base.mongodb': ['mongodb'],
      'n8n-nodes-base.redis': ['redis']
    };

    let dependencies = baseDependencies[nodeType] || [];

    // Add conditional dependencies based on parameters
    if (nodeType === 'n8n-nodes-base.httpRequest') {
      if (parameters?.authentication === 'oAuth2') {
        dependencies.push('oauth2-server');
      }
      if (parameters?.responseFormat === 'file') {
        dependencies.push('fs-extra');
      }
    }

    return dependencies;
  }

  /**
   * Get credential fields for a credential type
   */
  private getCredentialFields(credType: string): Record<string, string> {
    const credentialFields: Record<string, Record<string, string>> = {
      'httpBasicAuth': {
        'user': 'Username for basic authentication',
        'password': 'Password for basic authentication'
      },
      'httpHeaderAuth': {
        'name': 'Header name',
        'value': 'Header value'
      },
      'oAuth2Api': {
        'clientId': 'OAuth2 Client ID',
        'clientSecret': 'OAuth2 Client Secret',
        'accessToken': 'OAuth2 Access Token',
        'refreshToken': 'OAuth2 Refresh Token'
      },
      'googleApi': {
        'email': 'Google service account email',
        'privateKey': 'Google service account private key'
      }
    };

    return credentialFields[credType] || {};
  }

  /**
   * Generate environment variables for credentials
   */
  private generateCredentialEnvVars(credType: string, credName: string): Record<string, string> {
    const fields = this.getCredentialFields(credType);
    const envVars: Record<string, string> = {};

    for (const fieldName of Object.keys(fields)) {
      const envVarName = `${credType.toUpperCase()}_${fieldName.toUpperCase()}`;
      envVars[fieldName] = envVarName;
    }

    return envVars;
  }

  /**
   * Generate environment variables from configuration
   */
  private generateEnvironmentVariables(config: ExtractedConfig): EnvironmentVariable[] {
    const envVars: EnvironmentVariable[] = [];

    // Add credential environment variables
    for (const cred of config.credentials) {
      for (const [field, envVar] of Object.entries(cred.environmentVariables)) {
        envVars.push({
          key: envVar,
          description: `${cred.type} ${field}`,
          required: true,
          example: `your_${field}_here`
        });
      }
    }

    // Add parameter-based environment variables
    for (const param of config.configuredParameters) {
      if (param.isExpression && param.value.includes('process.env')) {
        const envVarMatch = param.value.match(/process\.env\.([A-Z_]+)/g);
        if (envVarMatch) {
          for (const envVar of envVarMatch) {
            const varName = envVar.replace('process.env.', '');
            envVars.push({
              key: varName,
              description: `Environment variable for ${param.name}`,
              required: param.required,
              example: `your_${varName.toLowerCase()}_here`
            });
          }
        }
      }
    }

    return envVars;
  }
}

export const nodeConfigExtractor = new NodeConfigurationExtractor();