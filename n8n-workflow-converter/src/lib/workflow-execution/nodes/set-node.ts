/**
 * Set Node Implementation
 * Transforms and sets data values in the workflow
 */

import { BaseTransformNode, NodeInputData } from '../base-node';
import { ExecutionContext } from '../workflow-engine';

export interface SetOperation {
  name: string;
  value: any;
  type: 'set' | 'unset';
}

export interface SetParameters {
  operations: SetOperation[];
  options?: {
    dotNotation?: boolean;
    keepOnlySet?: boolean;
  };
}

export class SetNode extends BaseTransformNode {
  constructor(parameters: SetParameters = { operations: [] }) {
    super(
      'Set',
      'Set',
      'Set values in the data object',
      parameters
    );
  }

  protected validateParameters(): void {
    const operations = this.getParameter('operations', []);
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('At least one operation is required');
    }

    operations.forEach((op, index) => {
      if (!op.name) {
        throw new Error(`Operation ${index + 1}: name is required`);
      }
      if (!['set', 'unset'].includes(op.type)) {
        throw new Error(`Operation ${index + 1}: type must be 'set' or 'unset'`);
      }
    });
  }

  async execute(inputData: NodeInputData[], context: ExecutionContext): Promise<any> {
    await this.preExecute(inputData, context);

    const processedData = this.processInputData(inputData);
    const results = [];

    for (const data of processedData) {
      try {
        const result = this.transform(data, context);
        results.push(result);
      } catch (error) {
        if (!context.config.continueOnFailure) {
          throw error;
        }
        results.push({ error: error.message });
      }
    }

    return this.formatOutput(results, true);
  }

  protected transform(data: any, context: ExecutionContext): any {
    const operations = this.getParameter('operations', []);
    const options = this.getParameter('options', {});
    
    // Start with existing data or empty object
    let result = options.keepOnlySet ? {} : { ...data };

    this.log('debug', `Applying ${operations.length} operations`);

    operations.forEach((operation, index) => {
      try {
        this.applyOperation(result, operation, data, context);
      } catch (error) {
        throw new Error(`Operation ${index + 1} failed: ${error.message}`);
      }
    });

    return result;
  }

  private applyOperation(
    result: any, 
    operation: SetOperation, 
    originalData: any, 
    context: ExecutionContext
  ): void {
    const { name, value, type } = operation;
    const options = this.getParameter('options', {});

    if (type === 'unset') {
      this.unsetValue(result, name, options.dotNotation);
      this.log('debug', `Unset value: ${name}`);
      return;
    }

    // Resolve value (handle expressions and references)
    const resolvedValue = this.resolveValue(value, originalData, context);
    
    // Set the value
    this.setValue(result, name, resolvedValue, options.dotNotation);
    this.log('debug', `Set value: ${name} = ${JSON.stringify(resolvedValue)}`);
  }

  private resolveValue(value: any, data: any, context: ExecutionContext): any {
    if (typeof value !== 'string') {
      return value;
    }

    // Handle expressions like {{ $json.field }}
    const expressionRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    let resolvedValue = value;
    let match;

    while ((match = expressionRegex.exec(value)) !== null) {
      const expression = match[1].trim();
      const expressionValue = this.evaluateExpression(expression, data, context);
      resolvedValue = resolvedValue.replace(match[0], String(expressionValue));
    }

    // If the entire value was an expression, try to parse it as JSON
    if (value.match(/^\{\{.*\}\}$/)) {
      try {
        return JSON.parse(resolvedValue);
      } catch {
        return resolvedValue;
      }
    }

    return resolvedValue;
  }

  private evaluateExpression(expression: string, data: any, context: ExecutionContext): any {
    // Handle common n8n expressions
    if (expression.startsWith('$json')) {
      const path = expression.substring(5); // Remove '$json'
      if (path === '' || path === '.') {
        return data;
      }
      return this.getValueByPath(data, path.substring(1)); // Remove leading dot
    }

    if (expression.startsWith('$node')) {
      // Handle node references (simplified)
      this.log('warn', 'Node references not fully supported in standalone mode');
      return null;
    }

    if (expression.startsWith('$parameter')) {
      const paramPath = expression.substring(10); // Remove '$parameter'
      if (paramPath.startsWith('.')) {
        return this.getValueByPath(this.parameters, paramPath.substring(1));
      }
      return this.parameters;
    }

    // Handle literals
    if (expression === 'true') return true;
    if (expression === 'false') return false;
    if (expression === 'null') return null;
    if (expression === 'undefined') return undefined;

    // Handle numbers
    if (/^-?\d+(\.\d+)?$/.test(expression)) {
      return parseFloat(expression);
    }

    // Handle strings (remove quotes)
    if ((expression.startsWith('"') && expression.endsWith('"')) ||
        (expression.startsWith("'") && expression.endsWith("'"))) {
      return expression.slice(1, -1);
    }

    // Default: return as string
    return expression;
  }

  private setValue(obj: any, path: string, value: any, useDotNotation: boolean = true): void {
    if (!useDotNotation || !path.includes('.')) {
      obj[path] = value;
      return;
    }

    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  private unsetValue(obj: any, path: string, useDotNotation: boolean = true): void {
    if (!useDotNotation || !path.includes('.')) {
      delete obj[path];
      return;
    }

    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        return; // Path doesn't exist
      }
      current = current[key];
    }

    delete current[keys[keys.length - 1]];
  }

  private getValueByPath(obj: any, path: string): any {
    if (!path) return obj;

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }
}