/**
 * Configuration-Aware Code Generator
 * Generates standalone Node.js code with exact n8n node configurations embedded
 */

import { ExtractedConfig, ConfiguredParameter, CredentialConfig } from '../node-configuration/config-extractor';

export interface GeneratedNodeFile {
  filePath: string;
  content: string;
  dependencies: string[];
  environmentVariables: string[];
}

export interface CodeGenerationContext {
  projectName: string;
  workflowName: string;
  nodeConfigs: ExtractedConfig[];
  connections: Record<string, any>;
}

export class ConfigAwareCodeGenerator {

  /**
   * Generate complete standalone implementation for a node with its exact configuration
   */
  generateNodeImplementation(config: ExtractedConfig, context: CodeGenerationContext): GeneratedNodeFile {
    const className = this.generateClassName(config.nodeName);
    const filePath = `src/nodes/${className}.js`;

    let content = this.generateNodeClass(config, className, context);

    return {
      filePath,
      content,
      dependencies: config.dependencies,
      environmentVariables: config.environmentVariables.map(env => env.key)
    };
  }

  /**
   * Generate the complete node class with embedded configuration
   */
  private generateNodeClass(config: ExtractedConfig, className: string, context: CodeGenerationContext): string {
    const imports = this.generateImports(config);
    const classDefinition = this.generateClassDefinition(config, className);
    const constructor = this.generateConstructor(config);
    const configMethods = this.generateConfigurationMethods(config);
    const executionMethod = this.generateExecutionMethod(config);
    const helperMethods = this.generateHelperMethods(config);

    return `${imports}

/**
 * ${config.nodeName} - Standalone Implementation
 * Generated from n8n node: ${config.nodeType}
 * 
 * Original Configuration:
${this.generateConfigurationComment(config)}
 */
${classDefinition} {
${constructor}

${configMethods}

${executionMethod}

${helperMethods}
}

export default ${className};`;
  }

  /**
   * Generate imports based on node dependencies and type
   */
  private generateImports(config: ExtractedConfig): string {
    const imports: string[] = [];

    // Base imports
    imports.push("import { BaseNode } from '../base/BaseNode.js';");

    // Node-specific imports
    switch (config.nodeType) {
      case 'n8n-nodes-base.httpRequest':
        imports.push("import axios from 'axios';");
        imports.push("import FormData from 'form-data';");
        break;
      case 'n8n-nodes-base.code':
        imports.push("import { VM } from 'vm2';");
        break;
      case 'n8n-nodes-base.set':
        imports.push("import _ from 'lodash';");
        break;
      case 'n8n-nodes-base.webhook':
        imports.push("import express from 'express';");
        break;
    }

    // Additional imports based on dependencies
    for (const dep of config.dependencies) {
      if (!imports.some(imp => imp.includes(dep))) {
        imports.push(`import ${dep} from '${dep}';`);
      }
    }

    return imports.join('\n');
  }

  /**
   * Generate class definition
   */
  private generateClassDefinition(config: ExtractedConfig, className: string): string {
    return `class ${className} extends BaseNode`;
  }

  /**
   * Generate constructor with embedded configuration
   */
  private generateConstructor(config: ExtractedConfig): string {
    const configAssignments = config.configuredParameters.map(param => {
      const value = this.formatParameterValue(param);
      return `    this.${param.name} = ${value};`;
    }).join('\n');

    const credentialSetup = config.credentials.map(cred => {
      return `    this.credentials.${cred.type} = this.loadCredentials('${cred.type}');`;
    }).join('\n');

    return `  constructor(parameters = {}) {
    super();
    
    // Node identification
    this.nodeType = '${config.nodeType}';
    this.nodeName = '${config.nodeName}';
    this.nodeId = '${config.nodeId}';
    
    // Configured parameters (from n8n workflow)
${configAssignments}
    
    // Credential setup
    this.credentials = {};
${credentialSetup}
    
    // Override with runtime parameters
    Object.assign(this, parameters);
    
    // Initialize node-specific setup
    this.initialize();
  }`;
  }

  /**
   * Generate configuration methods for credentials and parameters
   */
  private generateConfigurationMethods(config: ExtractedConfig): string {
    const methods: string[] = [];

    // Generate credential loading methods
    for (const cred of config.credentials) {
      methods.push(this.generateCredentialMethod(cred));
    }

    // Generate parameter validation method
    methods.push(this.generateParameterValidation(config));

    // Generate initialization method
    methods.push(this.generateInitializationMethod(config));

    return methods.join('\n\n');
  }

  /**
   * Generate credential loading method
   */
  private generateCredentialMethod(cred: CredentialConfig): string {
    const fieldLoading = Object.entries(cred.environmentVariables).map(([field, envVar]) => {
      return `      ${field}: process.env.${envVar} || (() => { 
        throw new Error('Missing required environment variable: ${envVar}'); 
      })()`;
    }).join(',\n');

    return `  /**
   * Load ${cred.type} credentials from environment variables
   */
  loadCredentials(credentialType) {
    if (credentialType === '${cred.type}') {
      return {
${fieldLoading}
      };
    }
    throw new Error(\`Unknown credential type: \${credentialType}\`);
  }`;
  }

  /**
   * Generate parameter validation method
   */
  private generateParameterValidation(config: ExtractedConfig): string {
    const validations = config.configuredParameters
      .filter(param => param.required)
      .map(param => {
        return `    if (this.${param.name} === undefined || this.${param.name} === null) {
      throw new Error('Required parameter "${param.name}" is missing');
    }`;
      }).join('\n');

    return `  /**
   * Validate configured parameters
   */
  validateParameters() {
${validations}
  }`;
  }

  /**
   * Generate node-specific initialization method
   */
  private generateInitializationMethod(config: ExtractedConfig): string {
    let initCode = '';

    switch (config.nodeType) {
      case 'n8n-nodes-base.httpRequest':
        initCode = this.generateHttpRequestInit(config);
        break;
      case 'n8n-nodes-base.code':
        initCode = this.generateCodeNodeInit(config);
        break;
      case 'n8n-nodes-base.webhook':
        initCode = this.generateWebhookInit(config);
        break;
      default:
        initCode = '    // Node-specific initialization';
    }

    return `  /**
   * Initialize node-specific configuration
   */
  initialize() {
    this.validateParameters();
${initCode}
  }`;
  }

  /**
   * Generate HTTP Request node initialization
   */
  private generateHttpRequestInit(config: ExtractedConfig): string {
    const urlParam = config.configuredParameters.find(p => p.name === 'url');
    const methodParam = config.configuredParameters.find(p => p.name === 'method');
    const headersParam = config.configuredParameters.find(p => p.name === 'headers');

    return `    // Configure HTTP client
    this.httpConfig = {
      url: ${this.formatParameterValue(urlParam)},
      method: ${this.formatParameterValue(methodParam) || "'GET'"},
      headers: ${this.formatParameterValue(headersParam) || '{}'},
      timeout: this.timeout || 30000,
      validateStatus: (status) => status < 400
    };
    
    // Setup authentication if configured
    if (this.credentials.httpBasicAuth) {
      this.httpConfig.auth = {
        username: this.credentials.httpBasicAuth.user,
        password: this.credentials.httpBasicAuth.password
      };
    }`;
  }

  /**
   * Generate Code node initialization
   */
  private generateCodeNodeInit(config: ExtractedConfig): string {
    const modeParam = config.configuredParameters.find(p => p.name === 'mode');
    const codeParam = config.configuredParameters.find(p => p.name === 'jsCode');

    return `    // Configure JavaScript execution
    this.executionMode = ${this.formatParameterValue(modeParam) || "'runOnceForAllItems'"};
    this.userCode = ${this.formatParameterValue(codeParam) || "''"}; 
    
    // Setup VM for secure code execution
    this.vm = new VM({
      timeout: 30000,
      sandbox: {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Buffer: Buffer,
        Date: Date,
        Math: Math,
        JSON: JSON
      }
    });`;
  }

  /**
   * Generate Webhook node initialization
   */
  private generateWebhookInit(config: ExtractedConfig): string {
    const pathParam = config.configuredParameters.find(p => p.name === 'path');
    const methodParam = config.configuredParameters.find(p => p.name === 'httpMethod');

    return `    // Configure webhook endpoint
    this.webhookPath = ${this.formatParameterValue(pathParam) || "'/webhook'"};
    this.webhookMethod = ${this.formatParameterValue(methodParam) || "'POST'"};
    
    // Setup Express server if not already running
    if (!global.webhookServer) {
      global.webhookServer = express();
      global.webhookServer.use(express.json());
      global.webhookServer.use(express.urlencoded({ extended: true }));
    }`;
  }

  /**
   * Generate the main execution method with configuration-specific logic
   */
  private generateExecutionMethod(config: ExtractedConfig): string {
    let executionLogic = '';

    switch (config.nodeType) {
      case 'n8n-nodes-base.httpRequest':
        executionLogic = this.generateHttpRequestExecution(config);
        break;
      case 'n8n-nodes-base.code':
        executionLogic = this.generateCodeNodeExecution(config);
        break;
      case 'n8n-nodes-base.set':
        executionLogic = this.generateSetNodeExecution(config);
        break;
      case 'n8n-nodes-base.webhook':
        executionLogic = this.generateWebhookExecution(config);
        break;
      case 'n8n-nodes-base.telegram':
        executionLogic = this.generateTelegramExecution(config);
        break;
      case 'n8n-nodes-base.switch':
        executionLogic = this.generateSwitchExecution(config);
        break;
      case 'n8n-nodes-base.googleSheets':
        executionLogic = this.generateGoogleSheetsExecution(config);
        break;
      case '@n8n/n8n-nodes-langchain.googleGemini':
        executionLogic = this.generateGoogleGeminiExecution(config);
        break;
      case '@n8n/n8n-nodes-langchain.agent':
        executionLogic = this.generateLangChainAgentExecution(config);
        break;
      default:
        executionLogic = this.generateGenericExecution(config);
    }

    return `  /**
   * Execute the node with configured parameters
   */
  async execute(inputData, context = {}) {
    try {
      console.log(\`Executing \${this.nodeName} (\${this.nodeType})\`);
      
${executionLogic}
      
    } catch (error) {
      console.error(\`Error in \${this.nodeName}:\`, error);
      throw new Error(\`\${this.nodeName} execution failed: \${error.message}\`);
    }
  }`;
  }

  /**
   * Generate HTTP Request execution logic
   */
  private generateHttpRequestExecution(config: ExtractedConfig): string {
    return `      // Prepare HTTP request with configured parameters
      const requestConfig = { ...this.httpConfig };
      
      // Process dynamic values
      if (typeof requestConfig.url === 'function') {
        requestConfig.url = requestConfig.url(inputData, context);
      }
      
      // Add request body if configured
      if (this.body) {
        requestConfig.data = typeof this.body === 'function' 
          ? this.body(inputData, context) 
          : this.body;
      }
      
      // Make HTTP request
      console.log(\`Making \${requestConfig.method} request to \${requestConfig.url}\`);
      const response = await axios(requestConfig);
      
      return {
        json: response.data,
        headers: response.headers,
        statusCode: response.status,
        statusMessage: response.statusText
      };`;
  }

  /**
   * Generate Code node execution logic
   */
  private generateCodeNodeExecution(config: ExtractedConfig): string {
    return `      // Execute JavaScript code with configured mode
      if (this.executionMode === 'runOnceForEachItem') {
        const results = [];
        const items = Array.isArray(inputData) ? inputData : [inputData];
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const sandbox = {
            ...this.vm.sandbox,
            $input: { item: { json: item } },
            $items: () => items,
            $json: item,
            inputData: item,
            context: context
          };
          
          const result = this.vm.run(this.userCode, { sandbox });
          results.push(result);
        }
        
        return results;
      } else {
        // Run once for all items
        const sandbox = {
          ...this.vm.sandbox,
          $items: () => Array.isArray(inputData) ? inputData : [inputData],
          inputData: inputData,
          context: context
        };
        
        return this.vm.run(this.userCode, { sandbox });
      }`;
  }

  /**
   * Generate Set node execution logic
   */
  private generateSetNodeExecution(config: ExtractedConfig): string {
    const assignmentsParam = config.configuredParameters.find(p => p.name === 'assignments');
    
    return `      // Apply configured assignments
      const assignments = ${this.formatParameterValue(assignmentsParam) || '[]'};
      const result = { ...inputData };
      
      if (assignments && assignments.assignments) {
        for (const assignment of assignments.assignments) {
          const value = this.processAssignmentValue(assignment.value, inputData, context);
          _.set(result, assignment.name, value);
        }
      }
      
      return result;`;
  }

  /**
   * Generate Webhook execution logic
   */
  private generateWebhookExecution(config: ExtractedConfig): string {
    return `      // Setup webhook endpoint with configured path and method
      return new Promise((resolve, reject) => {
        const method = this.webhookMethod.toLowerCase();
        
        global.webhookServer[method](this.webhookPath, (req, res) => {
          console.log(\`Webhook triggered: \${method.toUpperCase()} \${this.webhookPath}\`);
          
          const webhookData = {
            headers: req.headers,
            params: req.params,
            query: req.query,
            body: req.body,
            method: req.method,
            url: req.url
          };
          
          res.json({ received: true, timestamp: new Date().toISOString() });
          resolve(webhookData);
        });
        
        // Start server if not already running
        if (!global.webhookServerRunning) {
          const port = process.env.WEBHOOK_PORT || 3001;
          global.webhookServer.listen(port, () => {
            console.log(\`Webhook server running on port \${port}\`);
            global.webhookServerRunning = true;
          });
        }
      });`;
  }

  /**
   * Generate generic execution logic for unsupported nodes
   */
  private generateGenericExecution(config: ExtractedConfig): string {
    return `      // Generic execution for ${config.nodeType}
      console.log('Configured parameters:', {
${config.configuredParameters.map(p => `        ${p.name}: this.${p.name}`).join(',\n')}
      });
      
      // TODO: Implement specific logic for ${config.nodeType}
      return inputData;`;
  }

  /**
   * Generate helper methods
   */
  private generateHelperMethods(config: ExtractedConfig): string {
    const methods: string[] = [];

    // Add parameter processing method
    methods.push(`  /**
   * Process assignment values with expression support
   */
  processAssignmentValue(value, inputData, context) {
    if (typeof value === 'string' && value.startsWith('=')) {
      // Handle n8n expressions
      const expression = value.substring(1);
      try {
        return this.evaluateExpression(expression, inputData, context);
      } catch (error) {
        console.warn('Expression evaluation failed:', error);
        return value;
      }
    }
    return value;
  }`);

    // Add expression evaluator
    methods.push(`  /**
   * Evaluate n8n-style expressions
   */
  evaluateExpression(expression, inputData, context) {
    // Simple expression evaluator - can be enhanced
    const sandbox = {
      $json: inputData,
      inputData: inputData,
      context: context,
      Math: Math,
      Date: Date,
      JSON: JSON
    };
    
    const vm = new VM({ sandbox, timeout: 5000 });
    return vm.run(expression);
  }`);

    return methods.join('\n\n');
  }

  /**
   * Format parameter value for code generation
   */
  private formatParameterValue(param?: ConfiguredParameter): string {
    if (!param) return 'undefined';

    if (param.isExpression) {
      return `(inputData, context) => { 
        try { 
          return ${param.value}; 
        } catch (error) { 
          console.warn('Expression evaluation failed:', error); 
          return ${JSON.stringify(param.value)}; 
        } 
      }`;
    }

    if (typeof param.value === 'string') {
      return JSON.stringify(param.value);
    }

    return JSON.stringify(param.value);
  }

  /**
   * Generate configuration comment
   */
  private generateConfigurationComment(config: ExtractedConfig): string {
    const lines: string[] = [];
    
    lines.push(` * Node ID: ${config.nodeId}`);
    lines.push(` * Node Type: ${config.nodeType}`);
    lines.push(` * Parameters:`);
    
    for (const param of config.configuredParameters) {
      lines.push(` *   - ${param.name}: ${JSON.stringify(param.value)} (${param.type})`);
    }
    
    if (config.credentials.length > 0) {
      lines.push(` * Credentials:`);
      for (const cred of config.credentials) {
        lines.push(` *   - ${cred.type}: ${cred.name}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate class name from node name
   */
  private generateClassName(nodeName: string): string {
    return nodeName
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^\d/, 'Node$&')
      .replace(/^./, str => str.toUpperCase()) + 'Node';
  }
  /**
   * Generate Telegram node execution logic
   */
  private generateTelegramExecution(config: ExtractedConfig): string {
    const resourceParam = config.configuredParameters.find(p => p.name === 'resource');
    const fileIdParam = config.configuredParameters.find(p => p.name === 'fileId');
    const operationParam = config.configuredParameters.find(p => p.name === 'operation');

    if (resourceParam?.value === 'file') {
      return `      // Telegram file download with configured parameters
      const fileId = ${this.formatParameterValue(fileIdParam)};
      const resolvedFileId = typeof fileId === 'function' ? fileId(inputData, context) : fileId;
      
      // Use Telegram Bot API to download file
      const axios = require('axios');
      const botToken = this.credentials.telegramApi.botToken;
      
      // Get file info
      const fileInfoUrl = \`https://api.telegram.org/bot\${botToken}/getFile\`;
      const fileInfoResponse = await axios.post(fileInfoUrl, {
        file_id: resolvedFileId
      });
      
      if (!fileInfoResponse.data.ok) {
        throw new Error(\`Telegram API error: \${fileInfoResponse.data.description}\`);
      }
      
      const filePath = fileInfoResponse.data.result.file_path;
      const fileSize = fileInfoResponse.data.result.file_size;
      
      // Download the file
      const downloadUrl = \`https://api.telegram.org/file/bot\${botToken}/\${filePath}\`;
      const downloadResponse = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      return {
        binary: {
          data: {
            data: Buffer.from(downloadResponse.data),
            mimeType: this.detectMimeType(filePath),
            fileName: filePath.split('/').pop() || 'telegram_file',
            fileSize: fileSize
          }
        },
        json: {
          fileId: resolvedFileId,
          filePath: filePath,
          fileSize: fileSize
        }
      };`;
    } else {
      return `      // Telegram message send with configured parameters
      const axios = require('axios');
      const botToken = this.credentials.telegramApi.botToken;
      
      const telegramData = {
        chat_id: this.chatId || inputData.chat_id,
        text: this.text || inputData.message || inputData.text
      };
      
      const response = await axios.post(\`https://api.telegram.org/bot\${botToken}/sendMessage\`, telegramData);
      
      return response.data;`;
    }
  }

  /**
   * Generate Switch node execution logic
   */
  private generateSwitchExecution(config: ExtractedConfig): string {
    return `      // Switch node with configured rules
      const rules = ${config.customCode || '[]'};
      const results = [];
      
      for (const rule of rules) {
        const conditions = rule.conditions?.conditions || [];
        let conditionsMet = true;
        
        // Evaluate each condition
        for (const condition of conditions) {
          const leftValue = this.evaluateExpression(condition.leftValue, inputData, context);
          const operator = condition.operator;
          
          let conditionResult = false;
          
          switch (operator.operation) {
            case 'exists':
              conditionResult = leftValue !== undefined && leftValue !== null && leftValue !== '';
              break;
            case 'equal':
              conditionResult = leftValue === condition.rightValue;
              break;
            case 'notEqual':
              conditionResult = leftValue !== condition.rightValue;
              break;
            default:
              conditionResult = false;
          }
          
          if (!conditionResult) {
            conditionsMet = false;
            break;
          }
        }
        
        if (conditionsMet) {
          results.push({
            outputKey: rule.outputKey,
            data: inputData
          });
        }
      }
      
      return results.length > 0 ? results : [{ outputKey: 'default', data: inputData }];`;
  }

  /**
   * Generate Google Sheets execution logic
   */
  private generateGoogleSheetsExecution(config: ExtractedConfig): string {
    const operationParam = config.configuredParameters.find(p => p.name === 'operation');
    const documentIdParam = config.configuredParameters.find(p => p.name === 'documentId');
    const sheetNameParam = config.configuredParameters.find(p => p.name === 'sheetName');

    return `      // Google Sheets operation with configured parameters
      const { google } = require('googleapis');
      
      // Setup authentication
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: this.credentials.googleSheetsOAuth2Api.client_email,
          private_key: this.credentials.googleSheetsOAuth2Api.private_key
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      
      const sheets = google.sheets({ version: 'v4', auth });
      
      const spreadsheetId = ${this.formatParameterValue(documentIdParam)};
      const sheetName = ${this.formatParameterValue(sheetNameParam)};
      const operation = ${this.formatParameterValue(operationParam) || "'read'"};
      
      // Execute the configured operation
      if (operation === 'read' || operation === 'lookup') {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: sheetName
        });
        
        return response.data.values || [];
      } else if (operation === 'append') {
        const values = this.prepareSheetValues(inputData);
        const response = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: sheetName,
          valueInputOption: 'RAW',
          resource: { values: [values] }
        });
        
        return response.data;
      }
      
      return inputData;`;
  }

  /**
   * Generate Google Gemini AI execution logic
   */
  private generateGoogleGeminiExecution(config: ExtractedConfig): string {
    const textParam = config.configuredParameters.find(p => p.name === 'text');
    const modelIdParam = config.configuredParameters.find(p => p.name === 'modelId');
    const operationParam = config.configuredParameters.find(p => p.name === 'operation');

    return `      // Google Gemini AI analysis with configured parameters
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      
      const genAI = new GoogleGenerativeAI(this.credentials.googlePalmApi.apiKey);
      const model = genAI.getGenerativeModel({ 
        model: ${this.formatParameterValue(modelIdParam) || "'gemini-2.5-pro'"} 
      });
      
      const prompt = ${this.formatParameterValue(textParam)};
      const resolvedPrompt = typeof prompt === 'function' ? prompt(inputData, context) : prompt;
      
      const operation = ${this.formatParameterValue(operationParam) || "'analyze'"};
      
      if (operation === 'analyze' && inputData.binary) {
        // Handle binary data (image/audio analysis)
        const binaryData = inputData.binary.data;
        const result = await model.generateContent([
          resolvedPrompt,
          {
            inlineData: {
              data: binaryData.data.toString('base64'),
              mimeType: binaryData.mimeType
            }
          }
        ]);
        
        return {
          content: result.response.text(),
          candidates: result.response.candidates
        };
      } else {
        // Handle text analysis
        const result = await model.generateContent(resolvedPrompt);
        return {
          content: result.response.text(),
          candidates: result.response.candidates
        };
      }`;
  }

  /**
   * Generate LangChain Agent execution logic
   */
  private generateLangChainAgentExecution(config: ExtractedConfig): string {
    const textParam = config.configuredParameters.find(p => p.name === 'text');
    const systemMessageParam = config.configuredParameters.find(p => p.name === 'systemMessage');

    return `      // LangChain Agent with configured system message and tools
      const systemMessage = ${this.formatParameterValue(systemMessageParam) || "'You are a helpful assistant.'"};
      const userMessage = ${this.formatParameterValue(textParam)};
      
      const resolvedSystemMessage = typeof systemMessage === 'function' ? systemMessage(inputData, context) : systemMessage;
      const resolvedUserMessage = typeof userMessage === 'function' ? userMessage(inputData, context) : userMessage;
      
      // Simulate agent execution (in production, integrate with actual LangChain)
      console.log('Agent System Message:', resolvedSystemMessage);
      console.log('User Input:', resolvedUserMessage);
      
      // TODO: Implement actual LangChain agent execution
      // This would integrate with the configured tools and memory
      
      return {
        response: \`Agent processed: \${resolvedUserMessage}\`,
        systemMessage: resolvedSystemMessage,
        timestamp: new Date().toISOString()
      };`;
  }

  /**
   * Helper method to detect MIME type from file path
   */
  private generateMimeTypeDetector(): string {
    return `  detectMimeType(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const mimeTypes = {
      'ogg': 'audio/ogg',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'pdf': 'application/pdf',
      'txt': 'text/plain'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }`;
  }

  /**
   * Helper method to prepare Google Sheets values
   */
  private generateSheetsValuePreparator(): string {
    return `  prepareSheetValues(data) {
    // Convert input data to array format for Google Sheets
    if (Array.isArray(data)) {
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      return Object.values(data);
    }
    
    return [data];
  }`;
  }
}

export const configAwareGenerator = new ConfigAwareCodeGenerator();