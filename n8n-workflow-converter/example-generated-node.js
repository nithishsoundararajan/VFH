/**
 * EXAMPLE: Generated Node with Embedded Configuration
 * This shows how our system generates actual working code with exact n8n configurations
 */

// Example of generated Telegram node with exact configuration from the workflow
class DownloadVoiceMessageNode extends BaseNode {
  constructor(parameters = {}) {
    super();
    
    // Node identification
    this.nodeType = 'n8n-nodes-base.telegram';
    this.nodeName = 'Download Voice Message';
    this.nodeId = 'c142f5dd-fbeb-4b25-a0fe-f684546e6eff';
    
    // Configured parameters (EXACT from n8n workflow)
    this.fileId = (inputData, context) => { 
      try { 
        return context.getNodeOutput('Telegram Trigger').message.voice.file_id; 
      } catch (error) { 
        console.warn('Expression evaluation failed:', error); 
        return "={{ $('Telegram Trigger').item.json.message.voice.file_id }}"; 
      } 
    };
    this.resource = "file";
    this.additionalFields = {};
    
    // Credential setup
    this.credentials = {};
    this.credentials.telegramApi = this.loadCredentials('telegramApi');
    
    // Override with runtime parameters
    Object.assign(this, parameters);
    
    // Initialize node-specific setup
    this.initialize();
  }

  /**
   * Load telegramApi credentials from environment variables
   */
  loadCredentials(credentialType) {
    if (credentialType === 'telegramApi') {
      return {
        botToken: process.env.TELEGRAM_BOT_TOKEN || (() => { 
          throw new Error('Missing required environment variable: TELEGRAM_BOT_TOKEN'); 
        })()
      };
    }
    throw new Error(`Unknown credential type: ${credentialType}`);
  }

  /**
   * Validate configured parameters
   */
  validateParameters() {
    if (this.fileId === undefined || this.fileId === null) {
      throw new Error('Required parameter "fileId" is missing');
    }
    if (this.resource === undefined || this.resource === null) {
      throw new Error('Required parameter "resource" is missing');
    }
  }

  /**
   * Initialize node-specific configuration
   */
  initialize() {
    this.validateParameters();
    // Configure Telegram API client
    this.telegramConfig = {
      botToken: this.credentials.telegramApi.botToken,
      baseUrl: 'https://api.telegram.org/bot',
      timeout: 30000
    };
  }

  /**
   * Execute the node with configured parameters
   */
  async execute(inputData, context = {}) {
    try {
      console.log(`Executing ${this.nodeName} (${this.nodeType})`);
      
      // Process dynamic file ID from configuration
      const fileId = typeof this.fileId === 'function' 
        ? this.fileId(inputData, context) 
        : this.fileId;
      
      // Make Telegram API request with exact configuration
      const response = await this.downloadTelegramFile(fileId);
      
      return {
        binary: {
          data: {
            data: response.buffer,
            mimeType: response.mimeType,
            fileName: response.fileName,
            fileSize: response.fileSize
          }
        },
        json: {
          fileId: fileId,
          filePath: response.filePath,
          fileSize: response.fileSize
        }
      };
      
    } catch (error) {
      console.error(`Error in ${this.nodeName}:`, error);
      throw new Error(`${this.nodeName} execution failed: ${error.message}`);
    }
  }

  /**
   * Download file from Telegram using configured credentials
   */
  async downloadTelegramFile(fileId) {
    const axios = require('axios');
    
    // Get file info from Telegram
    const fileInfoUrl = `${this.telegramConfig.baseUrl}${this.telegramConfig.botToken}/getFile`;
    const fileInfoResponse = await axios.post(fileInfoUrl, {
      file_id: fileId
    });
    
    if (!fileInfoResponse.data.ok) {
      throw new Error(`Telegram API error: ${fileInfoResponse.data.description}`);
    }
    
    const filePath = fileInfoResponse.data.result.file_path;
    const fileSize = fileInfoResponse.data.result.file_size;
    
    // Download the actual file
    const downloadUrl = `https://api.telegram.org/file/bot${this.telegramConfig.botToken}/${filePath}`;
    const downloadResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: this.telegramConfig.timeout
    });
    
    return {
      buffer: Buffer.from(downloadResponse.data),
      mimeType: this.detectMimeType(filePath),
      fileName: this.extractFileName(filePath),
      fileSize: fileSize,
      filePath: filePath
    };
  }

  detectMimeType(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'ogg': 'audio/ogg',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  extractFileName(filePath) {
    return filePath.split('/').pop() || 'telegram_file';
  }
}

// Example of generated Set node with exact assignments configuration
class GetMessageTextNode extends BaseNode {
  constructor(parameters = {}) {
    super();
    
    // Node identification
    this.nodeType = 'n8n-nodes-base.set';
    this.nodeName = 'get_message (text)';
    this.nodeId = '68f15a08-cbe2-4ad9-9cfe-8b7a7c60787c';
    
    // Configured parameters (EXACT from n8n workflow)
    this.options = {};
    this.assignments = {
      "assignments": [
        {
          "id": "801ec600-22ad-4a94-a2b4-ae72eb271df0",
          "name": "message",
          "type": "string",
          "value": "={{ $('Telegram Trigger').item.json.message.text }}"
        },
        {
          "id": "263071fb-bcdf-42b0-bb46-71b75fa0bf2a",
          "name": "chat_id",
          "type": "string",
          "value": "={{ $('Telegram Trigger').item.json.message.chat.id }}"
        }
      ]
    };
    
    // Credential setup
    this.credentials = {};
    
    // Override with runtime parameters
    Object.assign(this, parameters);
    
    // Initialize node-specific setup
    this.initialize();
  }

  /**
   * Validate configured parameters
   */
  validateParameters() {
    // Set node doesn't have required parameters, but we validate structure
    if (!this.assignments || !this.assignments.assignments) {
      throw new Error('Set node requires assignments configuration');
    }
  }

  /**
   * Initialize node-specific configuration
   */
  initialize() {
    this.validateParameters();
    // No special initialization needed for Set node
  }

  /**
   * Execute the node with configured parameters
   */
  async execute(inputData, context = {}) {
    try {
      console.log(`Executing ${this.nodeName} (${this.nodeType})`);
      
      // Apply configured assignments EXACTLY as defined in n8n
      const result = { ...inputData };
      
      if (this.assignments && this.assignments.assignments) {
        for (const assignment of this.assignments.assignments) {
          const value = this.processAssignmentValue(assignment.value, inputData, context);
          
          // Use lodash set for nested property assignment
          const _ = require('lodash');
          _.set(result, assignment.name, value);
        }
      }
      
      return result;
      
    } catch (error) {
      console.error(`Error in ${this.nodeName}:`, error);
      throw new Error(`${this.nodeName} execution failed: ${error.message}`);
    }
  }

  /**
   * Process assignment values with expression support (EXACT n8n behavior)
   */
  processAssignmentValue(value, inputData, context) {
    if (typeof value === 'string' && value.startsWith('={{') && value.endsWith('}}')) {
      // Handle n8n expressions EXACTLY as configured
      const expression = value.slice(3, -2).trim(); // Remove ={{ and }}
      
      try {
        // Convert n8n expression to JavaScript
        let jsExpression = expression;
        
        // Handle $('Telegram Trigger').item.json.message.text
        jsExpression = jsExpression.replace(
          /\$\('([^']+)'\)\.item\.json/g, 
          (match, nodeName) => `context.getNodeOutput('${nodeName}')`
        );
        
        // Evaluate the converted expression
        return this.evaluateExpression(jsExpression, inputData, context);
      } catch (error) {
        console.warn('Expression evaluation failed:', error);
        return value; // Return original value if evaluation fails
      }
    }
    return value;
  }

  /**
   * Evaluate n8n-style expressions (converted to JavaScript)
   */
  evaluateExpression(expression, inputData, context) {
    // Create a safe evaluation context
    const sandbox = {
      context: context,
      inputData: inputData,
      $json: inputData,
      Math: Math,
      Date: Date,
      JSON: JSON
    };
    
    // Simple expression evaluator (in production, use vm2 for security)
    try {
      const func = new Function(...Object.keys(sandbox), `return ${expression}`);
      return func(...Object.values(sandbox));
    } catch (error) {
      console.warn('Expression evaluation error:', error);
      return expression; // Fallback to original
    }
  }
}

module.exports = { DownloadVoiceMessageNode, GetMessageTextNode };