/**
 * Node Source Extractor
 * Extracts and analyzes n8n node source code for AI generation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';

export interface NodeParameter {
  name: string;
  type: string;
  required: boolean;
  default?: any;
  description?: string;
  options?: any[];
}

export interface CredentialInfo {
  name: string;
  type: string;
  required: boolean;
}

export interface NodeMethod {
  name: string;
  code: string;
  parameters: string[];
  returnType: string;
}

export interface NodeAnalysis {
  nodeType: string;
  sourceCode: string;
  executeMethod: string;
  parameters: NodeParameter[];
  credentials: CredentialInfo[];
  dependencies: string[];
  interfaces: string[];
  methods: NodeMethod[];
  description?: string;
  displayName?: string;
}

export class NodeSourceExtractor {
  /**
   * Extract complete node analysis from source file
   */
  async extractNodeAnalysis(sourcePath: string, nodeType: string): Promise<NodeAnalysis> {
    try {
      const sourceCode = await fs.readFile(sourcePath, 'utf-8');
      
      // Create TypeScript AST
      const sourceFile = ts.createSourceFile(
        path.basename(sourcePath),
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const analysis: NodeAnalysis = {
        nodeType,
        sourceCode,
        executeMethod: '',
        parameters: [],
        credentials: [],
        dependencies: [],
        interfaces: [],
        methods: [],
        description: '',
        displayName: ''
      };

      // Extract different components
      this.extractNodeClass(sourceFile, analysis);
      this.extractDependencies(sourceFile, analysis);
      this.extractInterfaces(sourceFile, analysis);

      return analysis;
    } catch (error) {
      console.error(`Error extracting node analysis for ${nodeType}:`, error);
      throw new Error(`Failed to extract node analysis: ${error.message}`);
    }
  }

  /**
   * Extract the main node class and its methods
   */
  private extractNodeClass(sourceFile: ts.SourceFile, analysis: NodeAnalysis): void {
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && this.isNodeClass(node)) {
        // Extract class-level properties
        this.extractNodeProperties(node, analysis);
        
        // Extract methods
        node.members.forEach(member => {
          if (ts.isMethodDeclaration(member)) {
            const methodName = member.name?.getText() || '';
            
            if (methodName === 'execute') {
              analysis.executeMethod = this.extractMethodCode(member);
            }
            
            analysis.methods.push({
              name: methodName,
              code: this.extractMethodCode(member),
              parameters: this.extractMethodParameters(member),
              returnType: this.extractReturnType(member)
            });
          }
        });
      }
      
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Check if a class is a node class
   */
  private isNodeClass(node: ts.ClassDeclaration): boolean {
    // Check if class implements INodeType or extends a node base class
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        for (const type of clause.types) {
          const typeName = type.expression.getText();
          if (typeName.includes('INodeType') || typeName.includes('NodeBase')) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Extract node properties (description, parameters, credentials)
   */
  private extractNodeProperties(classNode: ts.ClassDeclaration, analysis: NodeAnalysis): void {
    classNode.members.forEach(member => {
      if (ts.isPropertyDeclaration(member)) {
        const propertyName = member.name?.getText() || '';
        
        switch (propertyName) {
          case 'description':
            analysis.description = this.extractPropertyValue(member, 'description');
            analysis.displayName = this.extractPropertyValue(member, 'displayName');
            break;
          case 'properties':
            analysis.parameters = this.extractParameters(member);
            break;
          case 'credentials':
            analysis.credentials = this.extractCredentials(member);
            break;
        }
      }
    });
  }

  /**
   * Extract method code as string
   */
  private extractMethodCode(method: ts.MethodDeclaration): string {
    return method.getText();
  }

  /**
   * Extract method parameters
   */
  private extractMethodParameters(method: ts.MethodDeclaration): string[] {
    return method.parameters.map(param => param.name.getText());
  }

  /**
   * Extract return type
   */
  private extractReturnType(method: ts.MethodDeclaration): string {
    return method.type?.getText() || 'any';
  }

  /**
   * Extract property value from object literal
   */
  private extractPropertyValue(property: ts.PropertyDeclaration, key: string): string {
    if (property.initializer && ts.isObjectLiteralExpression(property.initializer)) {
      for (const prop of property.initializer.properties) {
        if (ts.isPropertyAssignment(prop)) {
          const propName = prop.name?.getText().replace(/['"]/g, '');
          if (propName === key && ts.isStringLiteral(prop.initializer)) {
            return prop.initializer.text;
          }
        }
      }
    }
    return '';
  }

  /**
   * Extract node parameters from properties definition
   */
  private extractParameters(property: ts.PropertyDeclaration): NodeParameter[] {
    const parameters: NodeParameter[] = [];
    
    if (property.initializer && ts.isArrayLiteralExpression(property.initializer)) {
      property.initializer.elements.forEach(element => {
        if (ts.isObjectLiteralExpression(element)) {
          const param = this.parseParameterObject(element);
          if (param) {
            parameters.push(param);
          }
        }
      });
    }
    
    return parameters;
  }

  /**
   * Parse individual parameter object
   */
  private parseParameterObject(obj: ts.ObjectLiteralExpression): NodeParameter | null {
    const param: Partial<NodeParameter> = {};
    
    obj.properties.forEach(prop => {
      if (ts.isPropertyAssignment(prop)) {
        const key = prop.name?.getText().replace(/['"]/g, '');
        const value = this.extractLiteralValue(prop.initializer);
        
        switch (key) {
          case 'displayName':
          case 'name':
            param.name = value as string;
            break;
          case 'type':
            param.type = value as string;
            break;
          case 'required':
            param.required = value as boolean;
            break;
          case 'default':
            param.default = value;
            break;
          case 'description':
            param.description = value as string;
            break;
          case 'options':
            param.options = value as any[];
            break;
        }
      }
    });
    
    return param.name ? param as NodeParameter : null;
  }

  /**
   * Extract credentials from credentials property
   */
  private extractCredentials(property: ts.PropertyDeclaration): CredentialInfo[] {
    const credentials: CredentialInfo[] = [];
    
    if (property.initializer && ts.isArrayLiteralExpression(property.initializer)) {
      property.initializer.elements.forEach(element => {
        if (ts.isObjectLiteralExpression(element)) {
          const cred = this.parseCredentialObject(element);
          if (cred) {
            credentials.push(cred);
          }
        }
      });
    }
    
    return credentials;
  }

  /**
   * Parse individual credential object
   */
  private parseCredentialObject(obj: ts.ObjectLiteralExpression): CredentialInfo | null {
    const cred: Partial<CredentialInfo> = {};
    
    obj.properties.forEach(prop => {
      if (ts.isPropertyAssignment(prop)) {
        const key = prop.name?.getText().replace(/['"]/g, '');
        const value = this.extractLiteralValue(prop.initializer);
        
        switch (key) {
          case 'name':
            cred.name = value as string;
            break;
          case 'type':
            cred.type = value as string;
            break;
          case 'required':
            cred.required = value as boolean;
            break;
        }
      }
    });
    
    return cred.name ? cred as CredentialInfo : null;
  }

  /**
   * Extract literal values from AST nodes
   */
  private extractLiteralValue(node: ts.Expression): any {
    if (ts.isStringLiteral(node)) {
      return node.text;
    }
    if (ts.isNumericLiteral(node)) {
      return parseFloat(node.text);
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    }
    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map(el => this.extractLiteralValue(el));
    }
    if (ts.isObjectLiteralExpression(node)) {
      const obj: any = {};
      node.properties.forEach(prop => {
        if (ts.isPropertyAssignment(prop)) {
          const key = prop.name?.getText().replace(/['"]/g, '');
          obj[key] = this.extractLiteralValue(prop.initializer);
        }
      });
      return obj;
    }
    return node.getText();
  }

  /**
   * Extract import dependencies
   */
  private extractDependencies(sourceFile: ts.SourceFile, analysis: NodeAnalysis): void {
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, '');
        analysis.dependencies.push(moduleSpecifier);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Extract interface definitions
   */
  private extractInterfaces(sourceFile: ts.SourceFile, analysis: NodeAnalysis): void {
    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node)) {
        analysis.interfaces.push(node.getText());
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Extract just the execute method for quick analysis
   */
  async extractExecuteMethod(sourcePath: string): Promise<string> {
    try {
      const sourceCode = await fs.readFile(sourcePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        path.basename(sourcePath),
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      let executeMethod = '';

      const visit = (node: ts.Node) => {
        if (ts.isMethodDeclaration(node)) {
          const methodName = node.name?.getText() || '';
          if (methodName === 'execute') {
            executeMethod = node.getText();
            return;
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
      return executeMethod;
    } catch (error) {
      console.error(`Error extracting execute method from ${sourcePath}:`, error);
      return '';
    }
  }

  /**
   * Get a simplified node summary for quick reference
   */
  async getNodeSummary(sourcePath: string, nodeType: string): Promise<{
    nodeType: string;
    displayName: string;
    description: string;
    parameterCount: number;
    credentialCount: number;
    hasExecuteMethod: boolean;
  }> {
    try {
      const analysis = await this.extractNodeAnalysis(sourcePath, nodeType);
      
      return {
        nodeType: analysis.nodeType,
        displayName: analysis.displayName || nodeType,
        description: analysis.description || '',
        parameterCount: analysis.parameters.length,
        credentialCount: analysis.credentials.length,
        hasExecuteMethod: analysis.executeMethod.length > 0
      };
    } catch (error) {
      console.error(`Error getting node summary for ${nodeType}:`, error);
      return {
        nodeType,
        displayName: nodeType,
        description: '',
        parameterCount: 0,
        credentialCount: 0,
        hasExecuteMethod: false
      };
    }
  }
}

export default NodeSourceExtractor;