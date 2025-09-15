/**
 * Source-Aware AI Code Generator for Edge Functions
 * Simplified version for Supabase Edge Function environment
 */

import { AIProviderHelper } from './ai-provider-helper.ts'

export interface GenerationContext {
  workflowData: any;
  nodeParameters: Record<string, any>;
  nodeConnections: any[];
  projectName: string;
}

export interface SourceAwareGenerationResult {
  success: boolean;
  generatedCode: string;
  sourceAnalysis: any | null;
  fallbackUsed: boolean;
  error?: string;
}

export class SourceAwareAIGenerator {
  private aiHelper: AIProviderHelper;
  private repoPath = '/tmp/n8n-source'; // Edge Function temp directory

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.aiHelper = new AIProviderHelper(supabaseUrl, supabaseKey);
  }

  /**
   * Generate standalone code using n8n source analysis
   * Simplified version for Edge Functions - focuses on AI enhancement
   */
  async generateFromSource(
    userId: string,
    nodeType: string,
    context: GenerationContext
  ): Promise<SourceAwareGenerationResult> {
    try {
      console.log(`Attempting source-aware generation for node: ${nodeType}`);

      // For now, we'll use enhanced AI prompts that simulate source awareness
      // In the future, we can add actual source code fetching
      const prompt = this.buildEnhancedPrompt(nodeType, context);

      const generatedCode = await this.aiHelper.generateCode(userId, prompt, {
        nodeType: nodeType,
        hasSourceReference: false, // Will be true when we add actual source fetching
        enhancedPrompt: true,
        parameters: context.nodeParameters
      });

      return {
        success: true,
        generatedCode,
        sourceAnalysis: null,
        fallbackUsed: false
      };

    } catch (error) {
      console.error(`Enhanced generation failed for ${nodeType}:`, error);
      
      // Fallback to basic generation
      return await this.generateFallback(userId, nodeType, context, error.message);
    }
  }

  /**
   * Build enhanced prompt that simulates source awareness
   */
  private buildEnhancedPrompt(nodeType: string, context: GenerationContext): string {
    const { workflowData, nodeParameters, projectName } = context;

    // Enhanced prompt with n8n knowledge
    return `
You are an expert n8n developer generating a standalone Node.js implementation.

=== PROJECT CONTEXT ===
Project Name: ${projectName}
Node Type: ${nodeType}

=== NODE CONFIGURATION ===
Parameters: ${JSON.stringify(nodeParameters, null, 2)}

=== WORKFLOW CONTEXT ===
${JSON.stringify(workflowData, null, 2)}

=== N8N NODE EXPERTISE ===

Based on your knowledge of n8n nodes, generate a standalone implementation that:

1. **ACCURATE NODE BEHAVIOR**:
   ${this.getNodeSpecificGuidance(nodeType)}

2. **PARAMETER HANDLING**:
   - Support all standard n8n parameter types (string, number, boolean, options, collection)
   - Implement proper parameter validation and type conversion
   - Handle dynamic parameter expressions and variable substitution
   - Use configured parameter values: ${JSON.stringify(nodeParameters, null, 2)}

3. **DATA FLOW COMPATIBILITY**:
   - Accept input data in n8n's item-based format: [{ json: {...}, binary: {...} }]
   - Return data in the same format for compatibility
   - Handle multiple input items and batch processing
   - Preserve data structure and maintain item indexing

4. **CREDENTIAL MANAGEMENT**:
   - Use environment variables for API keys and secrets
   - Implement proper authentication flows (OAuth, API key, basic auth)
   - Handle credential validation and error reporting
   - Support multiple credential types if applicable

5. **ERROR HANDLING**:
   - Implement comprehensive try-catch blocks
   - Provide meaningful error messages matching n8n conventions
   - Handle network timeouts, rate limits, and API errors
   - Support continue-on-fail behavior

6. **PERFORMANCE & RELIABILITY**:
   - Implement proper async/await patterns
   - Handle concurrent requests appropriately
   - Add request timeouts and retry logic
   - Optimize for batch operations when possible

=== OUTPUT REQUIREMENTS ===

Generate a complete, production-ready JavaScript class that:
- Is named ${this.getClassName(nodeType)}
- Has a constructor accepting configuration
- Has an execute(inputData, context) method
- Includes comprehensive JSDoc documentation
- Is ready to run without n8n dependencies

Example structure:
\`\`\`javascript
/**
 * Standalone ${nodeType} Node Implementation
 * Replicates n8n node behavior for standalone execution
 */
class ${this.getClassName(nodeType)} {
  constructor(config) {
    this.config = config;
    this.nodeType = '${nodeType}';
  }

  async execute(inputData, context) {
    // Implementation here
  }
}

export default ${this.getClassName(nodeType)};
\`\`\`

Generate the complete implementation now:
`;
  }

  /**
   * Get node-specific implementation guidance
   */
  private getNodeSpecificGuidance(nodeType: string): string {
    const guidance: Record<string, string> = {
      'n8n-nodes-base.httpRequest': `
   - Make HTTP requests using fetch() or axios
   - Support all HTTP methods (GET, POST, PUT, DELETE, PATCH)
   - Handle request headers, query parameters, and body data
   - Support different authentication methods (None, Basic Auth, Header Auth, OAuth2)
   - Handle response parsing (JSON, XML, text, binary)
   - Implement proper error handling for HTTP status codes
   - Support request timeouts and retry logic`,

      'n8n-nodes-base.set': `
   - Modify item data by setting, updating, or removing properties
   - Support dot notation for nested property access
   - Handle different value types (string, number, boolean, object, array)
   - Support expression evaluation for dynamic values
   - Preserve existing item data while applying changes
   - Handle multiple items in batch operations`,

      'n8n-nodes-base.if': `
   - Implement conditional logic based on item data
   - Support multiple condition types (equal, not equal, contains, regex, etc.)
   - Handle different data types in comparisons
   - Route items to different outputs based on conditions
   - Support AND/OR logic for multiple conditions
   - Preserve item data through conditional routing`,

      'n8n-nodes-base.webhook': `
   - Create HTTP endpoint to receive webhook data
   - Support different HTTP methods and content types
   - Parse incoming request data (JSON, form data, query params)
   - Handle authentication and validation
   - Return appropriate HTTP responses
   - Support CORS headers if needed`,

      'n8n-nodes-base.code': `
   - Execute custom JavaScript code on item data
   - Provide access to item data through \$input variable
   - Support returning modified or new data
   - Handle errors in custom code execution
   - Support async operations in custom code
   - Maintain security by sandboxing execution`,

      'default': `
   - Follow n8n's standard node patterns and conventions
   - Handle input data transformation and validation
   - Implement proper error handling and logging
   - Support the node's specific functionality and parameters
   - Maintain compatibility with n8n's data flow patterns`
    };

    return guidance[nodeType] || guidance['default'];
  }

  /**
   * Get class name from node type
   */
  private getClassName(nodeType: string): string {
    const cleaned = nodeType.replace(/^n8n-nodes-base\./, '');
    const pascalCase = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return `${pascalCase}Node`;
  }

  /**
   * Fallback generation method
   */
  private async generateFallback(
    userId: string,
    nodeType: string,
    context: GenerationContext,
    error?: string
  ): Promise<SourceAwareGenerationResult> {
    console.log(`Using fallback generation for ${nodeType}`);

    const fallbackPrompt = `
Generate a basic standalone Node.js implementation for n8n node: ${nodeType}

Parameters: ${JSON.stringify(context.nodeParameters, null, 2)}
Project: ${context.projectName}

Create a functional class with:
- Constructor accepting configuration
- execute() method handling the node's basic functionality
- Proper error handling and logging
- JSDoc documentation

Return complete JavaScript class implementation.
`;
    
    try {
      const generatedCode = await this.aiHelper.generateCode(userId, fallbackPrompt, {
        nodeType,
        hasSourceReference: false,
        fallbackReason: error || 'Enhanced generation not available'
      });

      return {
        success: true,
        generatedCode,
        sourceAnalysis: null,
        fallbackUsed: true,
        error: error ? `Enhanced generation failed: ${error}` : undefined
      };
    } catch (fallbackError) {
      return {
        success: false,
        generatedCode: this.generateTemplateCode(nodeType, context),
        sourceAnalysis: null,
        fallbackUsed: true,
        error: `All generation methods failed: ${fallbackError.message}`
      };
    }
  }

  /**
   * Generate basic template code as last resort
   */
  private generateTemplateCode(nodeType: string, context: GenerationContext): string {
    const className = this.getClassName(nodeType);
    
    return `
/**
 * Template implementation of ${nodeType}
 * Generated as fallback when enhanced generation was not available
 */
class ${className} {
  constructor(config) {
    this.config = config;
    this.nodeType = '${nodeType}';
  }

  async execute(inputData, context) {
    try {
      console.log(\`Executing \${this.nodeType} with input:\`, inputData);
      
      // TODO: Implement ${nodeType} logic
      // This is a basic template implementation
      
      const results = inputData.map(item => ({
        json: {
          ...item.json,
          nodeType: this.nodeType,
          processed: true,
          timestamp: new Date().toISOString()
        },
        binary: item.binary || {}
      }));
      
      return results;
    } catch (error) {
      console.error(\`\${this.nodeType} execution failed:\`, error);
      throw error;
    }
  }
}

export default ${className};
`;
  }
}

export { SourceAwareAIGenerator };