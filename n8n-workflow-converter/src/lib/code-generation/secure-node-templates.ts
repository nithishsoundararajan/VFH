/**
 * Secure Node Templates
 * Provides secure, working templates for common n8n nodes
 */

export class SecureNodeTemplates {
  
  /**
   * Generate a secure Code node template
   */
  static generateCodeNodeTemplate(config: any): string {
    return `import { BaseNode } from '../base/BaseNode.js';
import { vm } from 'node:vm';
import crypto from 'node:crypto';

/**
 * ${config.nodeName} - Secure Code Node Implementation
 * Generated from n8n node: ${config.nodeType}
 */
class ${this.generateClassName(config.nodeName)} extends BaseNode {
  constructor(parameters = {}) {
    super();
    
    // Node identification
    this.nodeType = '${config.nodeType}';
    this.nodeName = '${config.nodeName}';
    this.nodeId = '${config.nodeId}';
    
    // Configured parameters
    this.executionMode = ${this.formatValue(config.mode)} || 'runOnceForAllItems';
    this.userCode = ${this.formatValue(config.jsCode)} || 'return $json;';
    
    // Override with runtime parameters
    Object.assign(this, parameters);
  }

  /**
   * Execute the code node
   */
  async execute(inputData, context = {}) {
    try {
      this.startExecution();
      
      let userCode = this.userCode;
      
      // Resolve dynamic code if it's a function
      if (typeof userCode === 'function') {
        userCode = userCode(inputData, context);
      }
      
      // Clean and prepare the code for execution
      const cleanedCode = this.prepareCodeForExecution(userCode);
      
      let result;
      
      if (this.executionMode === 'runOnceForEachItem') {
        const results = [];
        const items = Array.isArray(inputData) ? inputData : [inputData];
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemResult = await this.executeCodeSecurely(cleanedCode, {
            inputData: item,
            context: context,
            $json: item,
            $items: () => items,
            itemIndex: i
          });
          results.push(itemResult);
        }
        
        result = results;
      } else {
        // Run once for all items
        const items = Array.isArray(inputData) ? inputData : [inputData];
        result = await this.executeCodeSecurely(cleanedCode, {
          inputData: inputData,
          context: context,
          $json: items[0] || {},
          $items: () => items
        });
      }
      
      this.endExecution();
      return this.formatOutputData(result);
      
    } catch (error) {
      this.handleError(error, 'Code execution');
    }
  }

  /**
   * Prepare user code for secure execution
   */
  prepareCodeForExecution(userCode) {
    if (!userCode || typeof userCode !== 'string') {
      return 'return {};';
    }

    // Remove any dangerous patterns
    let cleanedCode = userCode
      .replace(/require\\s*\\(/g, '// require(') // Disable require
      .replace(/import\\s+/g, '// import ') // Disable import
      .replace(/process\\./g, '// process.') // Disable process access
      .replace(/global\\./g, '// global.') // Disable global access
      .replace(/eval\\s*\\(/g, '// eval(') // Disable eval
      .replace(/Function\\s*\\(/g, '// Function('); // Disable Function constructor

    // Handle return statements properly
    if (!cleanedCode.includes('return')) {
      // If it's a simple expression, wrap it in return
      if (!cleanedCode.includes(';') && !cleanedCode.includes('\\n') && cleanedCode.trim().length > 0) {
        cleanedCode = \`return \${cleanedCode.trim()};\`;
      } else if (cleanedCode.trim().length > 0) {
        // For complex code, ensure it has a return statement
        cleanedCode = \`\${cleanedCode}\\nif (typeof result !== 'undefined') return result; else return $json;\`;
      }
    }

    // Wrap in async function if it contains await
    if (cleanedCode.includes('await')) {
      cleanedCode = \`(async () => { \${cleanedCode} })();\`;
    }

    return cleanedCode;
  }

  /**
   * Execute code securely using Node.js built-in vm
   */
  async executeCodeSecurely(code, executionContext) {
    try {
      // Create secure sandbox
      const sandbox = {
        // Input data and context
        inputData: executionContext.inputData,
        context: executionContext.context,
        $json: executionContext.$json,
        $items: executionContext.$items,
        itemIndex: executionContext.itemIndex,
        
        // Safe built-ins
        console: {
          log: (...args) => console.log('[User Code]', ...args),
          warn: (...args) => console.warn('[User Code]', ...args),
          error: (...args) => console.error('[User Code]', ...args)
        },
        Math: Math,
        Date: Date,
        JSON: JSON,
        Buffer: Buffer,
        
        // Utility functions
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        
        // Result variable for user code
        result: undefined,
        
        // Helper functions
        $: (path) => this.getValueByPath(executionContext.$json, path),
        $node: (nodeName) => executionContext.context.getNodeOutput?.(nodeName) || {},
        
        // Common n8n functions
        $now: () => new Date(),
        $today: () => new Date().toISOString().split('T')[0],
        $uuid: () => crypto.randomUUID?.() || Math.random().toString(36),
        
        // Promise support
        Promise: Promise
      };

      // Create VM context
      const vmContext = vm.createContext(sandbox);
      
      // Set timeout for execution
      const timeout = 30000; // 30 seconds
      
      // Execute the code
      const result = vm.runInContext(code, vmContext, {
        timeout: timeout,
        displayErrors: true,
        breakOnSigint: true
      });

      // Handle async results
      if (result && typeof result.then === 'function') {
        return await result;
      }

      return result || sandbox.result || executionContext.$json || {};
      
    } catch (error) {
      this.log('error', 'Code execution error', error);
      throw new Error(\`Code execution failed: \${error.message}\`);
    }
  }

  /**
   * Get value by path (lodash-like functionality)
   */
  getValueByPath(obj, path) {
    if (!path || !obj) return undefined;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    
    return current;
  }
}

export default ${this.generateClassName(config.nodeName)};`;
  }

  /**
   * Generate a secure Set node template
   */
  static generateSetNodeTemplate(config: any): string {
    return `import { BaseNode } from '../base/BaseNode.js';
import { vm } from 'node:vm';
import crypto from 'node:crypto';

/**
 * ${config.nodeName} - Secure Set Node Implementation
 * Generated from n8n node: ${config.nodeType}
 */
class ${this.generateClassName(config.nodeName)} extends BaseNode {
  constructor(parameters = {}) {
    super();
    
    // Node identification
    this.nodeType = '${config.nodeType}';
    this.nodeName = '${config.nodeName}';
    this.nodeId = '${config.nodeId}';
    
    // Configured parameters
    this.assignments = ${this.formatValue(config.assignments)} || { assignments: [] };
    
    // Override with runtime parameters
    Object.assign(this, parameters);
  }

  /**
   * Execute the set node
   */
  async execute(inputData, context = {}) {
    try {
      this.startExecution();
      
      let result = { ...inputData };
      
      if (this.assignments && this.assignments.assignments) {
        for (const assignment of this.assignments.assignments) {
          try {
            const value = await this.processAssignmentValue(assignment.value, inputData, context);
            this.setValueByPath(result, assignment.name, value);
          } catch (error) {
            this.log('warn', \`Assignment failed for \${assignment.name}\`, error.message);
            // Continue with other assignments
          }
        }
      }
      
      this.endExecution();
      return this.formatOutputData(result);
      
    } catch (error) {
      this.handleError(error, 'Set node execution');
    }
  }

  /**
   * Process assignment values with secure expression support
   */
  async processAssignmentValue(value, inputData, context) {
    if (typeof value === 'string' && value.startsWith('=')) {
      // Handle n8n expressions securely
      const expression = value.substring(1);
      try {
        return await this.evaluateExpressionSecurely(expression, inputData, context);
      } catch (error) {
        this.log('warn', 'Expression evaluation failed', error.message);
        return value; // Return original value as fallback
      }
    }
    
    // Handle function values
    if (typeof value === 'function') {
      try {
        return await value(inputData, context);
      } catch (error) {
        this.log('warn', 'Function evaluation failed', error.message);
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Evaluate n8n-style expressions securely
   */
  async evaluateExpressionSecurely(expression, inputData, context) {
    // Create secure sandbox for expression evaluation
    const sandbox = {
      $json: inputData,
      inputData: inputData,
      context: context,
      Math: Math,
      Date: Date,
      JSON: JSON,
      
      // Helper functions
      $: (path) => this.getValueByPath(inputData, path),
      $node: (nodeName) => context.getNodeOutput?.(nodeName) || {},
      
      // Common n8n functions
      $now: () => new Date(),
      $today: () => new Date().toISOString().split('T')[0],
      $uuid: () => crypto.randomUUID?.() || Math.random().toString(36)
    };

    // Clean the expression
    let cleanExpression = expression
      .replace(/require\\s*\\(/g, '// require(')
      .replace(/process\\./g, '// process.')
      .replace(/global\\./g, '// global.');

    // Ensure expression returns a value
    if (!cleanExpression.includes('return')) {
      cleanExpression = \`return \${cleanExpression};\`;
    }

    try {
      const vmContext = vm.createContext(sandbox);
      const result = vm.runInContext(cleanExpression, vmContext, {
        timeout: 5000,
        displayErrors: true
      });

      return result;
    } catch (error) {
      throw new Error(\`Expression evaluation failed: \${error.message}\`);
    }
  }

  /**
   * Set value by path (lodash-like functionality)
   */
  setValueByPath(obj, path, value) {
    if (!path || !obj) return;
    
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get value by path (lodash-like functionality)
   */
  getValueByPath(obj, path) {
    if (!path || !obj) return undefined;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    
    return current;
  }
}

export default ${this.generateClassName(config.nodeName)};`;
  }

  /**
   * Generate a generic secure node template
   */
  static generateGenericNodeTemplate(config: any): string {
    return `import { BaseNode } from '../base/BaseNode.js';

/**
 * ${config.nodeName} - Generic Node Implementation
 * Generated from n8n node: ${config.nodeType}
 */
class ${this.generateClassName(config.nodeName)} extends BaseNode {
  constructor(parameters = {}) {
    super();
    
    // Node identification
    this.nodeType = '${config.nodeType}';
    this.nodeName = '${config.nodeName}';
    this.nodeId = '${config.nodeId}';
    
    // Configured parameters
${this.generateParameterAssignments(config)}
    
    // Override with runtime parameters
    Object.assign(this, parameters);
  }

  /**
   * Execute the node
   */
  async execute(inputData, context = {}) {
    try {
      this.startExecution();
      
      this.log('info', \`Executing \${this.nodeName} (\${this.nodeType})\`);
      this.log('info', 'Configured parameters:', {
${this.generateParameterLogging(config)}
      });
      
      // TODO: Implement specific logic for ${config.nodeType}
      // This is a generic implementation - enhance based on node requirements
      
      const result = this.formatOutputData(inputData);
      
      this.endExecution();
      return result;
      
    } catch (error) {
      this.handleError(error, 'Node execution');
    }
  }
}

export default ${this.generateClassName(config.nodeName)};`;
  }

  /**
   * Generate class name from node name
   */
  private static generateClassName(nodeName: string): string {
    // Clean the node name and ensure it's a valid class name
    let cleanName = nodeName
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
      .replace(/^\d/, 'Node'); // Prefix with 'Node' if starts with digit
    
    // Ensure it starts with uppercase
    if (cleanName.length > 0) {
      cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    } else {
      cleanName = 'Node';
    }
    
    return cleanName + 'Node';
  }

  /**
   * Format parameter value for code generation
   */
  private static formatValue(value: any): string {
    if (value === undefined || value === null) {
      return 'undefined';
    }
    
    if (typeof value === 'string') {
      return JSON.stringify(value);
    }
    
    return JSON.stringify(value);
  }

  /**
   * Generate parameter assignments
   */
  private static generateParameterAssignments(config: any): string {
    const assignments: string[] = [];
    
    if (config.parameters) {
      for (const [key, value] of Object.entries(config.parameters)) {
        assignments.push(`    this.${key} = ${this.formatValue(value)};`);
      }
    }
    
    return assignments.join('\n');
  }

  /**
   * Generate parameter logging
   */
  private static generateParameterLogging(config: any): string {
    const logging: string[] = [];
    
    if (config.parameters) {
      for (const key of Object.keys(config.parameters)) {
        logging.push(`        ${key}: this.${key}`);
      }
    }
    
    return logging.join(',\n');
  }
}

// SecureNodeTemplates is already exported as a class above