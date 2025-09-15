/**
 * Secure Code Generator
 * Replaces vm2 with Node.js built-in vm module and fixes code execution issues
 */

import { vm } from 'node:vm';
import { ExtractedConfig, ConfiguredParameter } from '../node-configuration/config-extractor';

export interface SecureCodeExecutionContext {
  inputData: any;
  context: any;
  $json: any;
  $items: () => any[];
  console: typeof console;
  Math: typeof Math;
  Date: typeof Date;
  JSON: typeof JSON;
  Buffer: typeof Buffer;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

export class SecureCodeGenerator {
  
  /**
   * Generate secure Code node execution logic without vm2
   */
  generateCodeNodeExecution(config: ExtractedConfig): string {
    const modeParam = config.configuredParameters.find(p => p.name === 'mode');
    const codeParam = config.configuredParameters.find(p => p.name === 'jsCode');

    return `      // Execute JavaScript code with configured mode (secure implementation)
      const executionMode = ${this.formatParameterValue(modeParam) || "'runOnceForAllItems'"};
      let userCode = ${this.formatParameterValue(codeParam) || "''"}; 
      
      // Resolve dynamic code if it's a function
      if (typeof userCode === 'function') {
        userCode = userCode(inputData, context);
      }
      
      // Clean and prepare the code for execution
      const cleanedCode = this.prepareCodeForExecution(userCode);
      
      if (executionMode === 'runOnceForEachItem') {
        const results = [];
        const items = Array.isArray(inputData) ? inputData : [inputData];
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const result = await this.executeCodeSecurely(cleanedCode, {
            inputData: item,
            context: context,
            $json: item,
            $items: () => items,
            itemIndex: i
          });
          results.push(result);
        }
        
        return results;
      } else {
        // Run once for all items
        const items = Array.isArray(inputData) ? inputData : [inputData];
        return await this.executeCodeSecurely(cleanedCode, {
          inputData: inputData,
          context: context,
          $json: items[0] || {},
          $items: () => items
        });
      }`;
  }

  /**
   * Generate secure code execution methods
   */
  generateSecureExecutionMethods(): string {
    return `  /**
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

    // Ensure code returns a value if it doesn't already
    if (!cleanedCode.includes('return')) {
      // If it's a simple expression, wrap it in return
      if (!cleanedCode.includes(';') && !cleanedCode.includes('\\n')) {
        cleanedCode = \`return \${cleanedCode};\`;
      } else {
        // For complex code, ensure it has a return statement
        cleanedCode = \`\${cleanedCode}\\nif (typeof result !== 'undefined') return result;\`;
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
        $node: (nodeName) => context.getNodeOutput?.(nodeName) || {},
        
        // Promise support
        Promise: Promise
      };

      // Create VM context
      const vmContext = vm.createContext(sandbox);
      
      // Set timeout for execution
      const timeout = 30000; // 30 seconds
      
      // Execute the code
      const result = await vm.runInContext(code, vmContext, {
        timeout: timeout,
        displayErrors: true,
        breakOnSigint: true
      });

      // Handle async results
      if (result && typeof result.then === 'function') {
        return await result;
      }

      return result || sandbox.result || {};
      
    } catch (error) {
      console.error('Code execution error:', error);
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
  }`;
  }

  /**
   * Generate secure Set node execution logic
   */
  generateSetNodeExecution(config: ExtractedConfig): string {
    const assignmentsParam = config.configuredParameters.find(p => p.name === 'assignments');
    
    return `      // Apply configured assignments (secure implementation)
      const assignments = ${this.formatParameterValue(assignmentsParam) || '{ assignments: [] }'};
      let result = { ...inputData };
      
      if (assignments && assignments.assignments) {
        for (const assignment of assignments.assignments) {
          try {
            const value = await this.processAssignmentValue(assignment.value, inputData, context);
            this.setValueByPath(result, assignment.name, value);
          } catch (error) {
            console.warn(\`Assignment failed for \${assignment.name}:\`, error.message);
            // Continue with other assignments
          }
        }
      }
      
      return result;`;
  }

  /**
   * Generate secure assignment processing methods
   */
  generateSecureAssignmentMethods(): string {
    return `  /**
   * Process assignment values with secure expression support
   */
  async processAssignmentValue(value, inputData, context) {
    if (typeof value === 'string' && value.startsWith('=')) {
      // Handle n8n expressions securely
      const expression = value.substring(1);
      try {
        return await this.evaluateExpressionSecurely(expression, inputData, context);
      } catch (error) {
        console.warn('Expression evaluation failed:', error.message);
        return value; // Return original value as fallback
      }
    }
    
    // Handle function values
    if (typeof value === 'function') {
      try {
        return await value(inputData, context);
      } catch (error) {
        console.warn('Function evaluation failed:', error.message);
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
      const result = await vm.runInContext(cleanExpression, vmContext, {
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
  }`;
  }

  /**
   * Format parameter value for code generation
   */
  private formatParameterValue(param?: ConfiguredParameter): string {
    if (!param) return 'undefined';

    if (param.isExpression) {
      return `(inputData, context) => { 
        try { 
          return this.evaluateExpressionSecurely('${param.value.replace(/'/g, "\\'")}', inputData, context); 
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
}

export const secureCodeGenerator = new SecureCodeGenerator();