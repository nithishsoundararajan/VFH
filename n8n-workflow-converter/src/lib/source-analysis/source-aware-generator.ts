/**
 * Source-Aware AI Code Generator
 * Generates standalone code using actual n8n source code as reference
 */

import { AIProviderHelper } from '../../supabase/functions/_shared/ai-provider-helper';
import { NodeAnalysis } from './node-extractor';
import N8nRepositoryManager from './repository-manager';
import NodeSourceExtractor from './node-extractor';

export interface GenerationContext {
  workflowData: any;
  nodeParameters: Record<string, any>;
  nodeConnections: any[];
  projectName: string;
}

export interface SourceAwareGenerationResult {
  success: boolean;
  generatedCode: string;
  sourceAnalysis: NodeAnalysis | null;
  fallbackUsed: boolean;
  error?: string;
}

export class SourceAwareAIGenerator {
  private repoManager: N8nRepositoryManager;
  private nodeExtractor: NodeSourceExtractor;
  private aiHelper: AIProviderHelper;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    repoPath?: string
  ) {
    this.repoManager = new N8nRepositoryManager(repoPath);
    this.nodeExtractor = new NodeSourceExtractor();
    this.aiHelper = new AIProviderHelper(supabaseUrl, supabaseKey);
  }

  /**
   * Generate standalone code using n8n source analysis
   */
  async generateFromSource(
    userId: string,
    nodeType: string,
    context: GenerationContext
  ): Promise<SourceAwareGenerationResult> {
    try {
      console.log(`Generating source-aware code for node: ${nodeType}`);

      // Step 1: Ensure repository is up to date
      await this.repoManager.initializeRepository();

      // Step 2: Check if node exists in source
      const nodeExists = await this.repoManager.nodeExists(nodeType);
      
      if (!nodeExists) {
        console.warn(`Node ${nodeType} not found in n8n source, using fallback`);
        return await this.generateFallback(userId, nodeType, context);
      }

      // Step 3: Extract source code analysis
      const sourcePath = await this.repoManager.getNodeSourcePath(nodeType);
      if (!sourcePath) {
        console.warn(`Source path not found for ${nodeType}, using fallback`);
        return await this.generateFallback(userId, nodeType, context);
      }

      const sourceAnalysis = await this.nodeExtractor.extractNodeAnalysis(sourcePath, nodeType);

      // Step 4: Generate enhanced prompt with source code
      const prompt = this.buildSourceAwarePrompt(sourceAnalysis, context);

      // Step 5: Generate code using AI with source context
      const generatedCode = await this.aiHelper.generateCode(userId, prompt, {
        sourceCode: sourceAnalysis.sourceCode,
        nodeType: sourceAnalysis.nodeType,
        hasSourceReference: true,
        executeMethod: sourceAnalysis.executeMethod,
        parameters: sourceAnalysis.parameters
      });

      return {
        success: true,
        generatedCode,
        sourceAnalysis,
        fallbackUsed: false
      };

    } catch (error) {
      console.error(`Source-aware generation failed for ${nodeType}:`, error);
      
      // Fallback to template-based generation
      return await this.generateFallback(userId, nodeType, context, error.message);
    }
  }

  /**
   * Build enhanced prompt with source code context
   */
  private buildSourceAwarePrompt(
    analysis: NodeAnalysis,
    context: GenerationContext
  ): string {
    const { workflowData, nodeParameters, projectName } = context;

    return `
You are generating a standalone Node.js implementation based on the actual n8n source code.

=== PROJECT CONTEXT ===
Project Name: ${projectName}
Node Type: ${analysis.nodeType}
Display Name: ${analysis.displayName || analysis.nodeType}
Description: ${analysis.description || 'No description available'}

=== ORIGINAL N8N SOURCE CODE ===
${this.truncateSourceCode(analysis.sourceCode)}

=== EXECUTE METHOD (CORE LOGIC) ===
${analysis.executeMethod}

=== NODE PARAMETERS ===
${JSON.stringify(analysis.parameters, null, 2)}

=== CONFIGURED PARAMETERS ===
${JSON.stringify(nodeParameters, null, 2)}

=== CREDENTIALS ===
${JSON.stringify(analysis.credentials, null, 2)}

=== DEPENDENCIES ===
${analysis.dependencies.join('\n')}

=== WORKFLOW CONTEXT ===
${JSON.stringify(workflowData, null, 2)}

=== GENERATION REQUIREMENTS ===

Generate a standalone Node.js class that:

1. **EXACT LOGIC REPLICATION**: 
   - Replicate the exact business logic from the execute() method
   - Preserve all conditional branches and error handling
   - Maintain the same data transformation patterns

2. **PARAMETER HANDLING**:
   - Support all parameters defined in the source
   - Use the configured parameter values from the workflow
   - Implement proper parameter validation and defaults

3. **CREDENTIAL MANAGEMENT**:
   - Handle credentials securely using environment variables
   - Support all credential types defined in the source
   - Implement proper authentication flows

4. **DEPENDENCY REMOVAL**:
   - Remove n8n-specific imports and dependencies
   - Replace n8n helper functions with standalone equivalents
   - Convert n8n data structures to standard JavaScript objects

5. **ERROR HANDLING**:
   - Preserve the same error messages and error types
   - Implement proper try-catch blocks
   - Handle edge cases as in the original code

6. **DATA COMPATIBILITY**:
   - Maintain input/output data structure compatibility
   - Handle n8n's item-based data flow
   - Preserve data transformation logic

7. **PERFORMANCE**:
   - Implement the same optimizations as the source
   - Handle batch processing if present in original
   - Maintain async/await patterns

=== OUTPUT FORMAT ===

Return ONLY the standalone JavaScript class implementation. The class should:
- Be named after the node type (e.g., HttpRequestNode, SetNode)
- Have a constructor that accepts configuration
- Have an execute() method that replicates the n8n logic
- Include proper JSDoc documentation
- Be ready to run without any n8n dependencies

Example structure:
\`\`\`javascript
/**
 * Standalone implementation of ${analysis.nodeType}
 * Generated from n8n source code
 */
class ${this.getClassName(analysis.nodeType)} {
  constructor(config) {
    this.config = config;
    // Initialize based on source analysis
  }

  async execute(inputData, context) {
    // Replicated logic from n8n source
  }
}

export default ${this.getClassName(analysis.nodeType)};
\`\`\`

Generate the complete implementation now:
`;
  }

  /**
   * Truncate source code for prompt (keep it under token limits)
   */
  private truncateSourceCode(sourceCode: string, maxLines: number = 200): string {
    const lines = sourceCode.split('\n');
    if (lines.length <= maxLines) {
      return sourceCode;
    }

    const truncated = lines.slice(0, maxLines).join('\n');
    return `${truncated}\n\n// ... [Source code truncated for brevity - ${lines.length - maxLines} more lines] ...`;
  }

  /**
   * Get class name from node type
   */
  private getClassName(nodeType: string): string {
    // Remove prefixes and convert to PascalCase
    const cleaned = nodeType.replace(/^n8n-nodes-base\./, '');
    const pascalCase = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return `${pascalCase}Node`;
  }

  /**
   * Fallback to template-based generation
   */
  private async generateFallback(
    userId: string,
    nodeType: string,
    context: GenerationContext,
    error?: string
  ): Promise<SourceAwareGenerationResult> {
    console.log(`Using fallback generation for ${nodeType}`);

    const fallbackPrompt = this.buildFallbackPrompt(nodeType, context);
    
    try {
      const generatedCode = await this.aiHelper.generateCode(userId, fallbackPrompt, {
        nodeType,
        hasSourceReference: false,
        fallbackReason: error || 'Source not available'
      });

      return {
        success: true,
        generatedCode,
        sourceAnalysis: null,
        fallbackUsed: true,
        error: error ? `Source analysis failed: ${error}` : undefined
      };
    } catch (fallbackError) {
      return {
        success: false,
        generatedCode: this.generateTemplateCode(nodeType, context),
        sourceAnalysis: null,
        fallbackUsed: true,
        error: `Both source-aware and AI fallback failed: ${fallbackError.message}`
      };
    }
  }

  /**
   * Build fallback prompt for template-based generation
   */
  private buildFallbackPrompt(nodeType: string, context: GenerationContext): string {
    return `
Generate a standalone Node.js implementation for n8n node type: ${nodeType}

Project: ${context.projectName}
Parameters: ${JSON.stringify(context.nodeParameters, null, 2)}
Workflow Context: ${JSON.stringify(context.workflowData, null, 2)}

Create a functional implementation that handles the basic functionality of this node type.
Include proper error handling, parameter validation, and async/await patterns.

Return a complete JavaScript class implementation.
`;
  }

  /**
   * Generate basic template code as last resort
   */
  private generateTemplateCode(nodeType: string, context: GenerationContext): string {
    const className = this.getClassName(nodeType);
    
    return `
/**
 * Template implementation of ${nodeType}
 * Generated as fallback when source analysis was not available
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
      // This is a template implementation
      
      return {
        success: true,
        data: inputData,
        timestamp: new Date().toISOString(),
        nodeType: this.nodeType
      };
    } catch (error) {
      console.error(\`\${this.nodeType} execution failed:\`, error);
      throw error;
    }
  }
}

export default ${className};
`;
  }

  /**
   * Batch generate multiple nodes
   */
  async generateMultipleNodes(
    userId: string,
    nodeTypes: string[],
    contexts: Record<string, GenerationContext>
  ): Promise<Record<string, SourceAwareGenerationResult>> {
    const results: Record<string, SourceAwareGenerationResult> = {};

    // Initialize repository once for batch operation
    await this.repoManager.initializeRepository();

    // Generate nodes in parallel (but limit concurrency)
    const batchSize = 3;
    for (let i = 0; i < nodeTypes.length; i += batchSize) {
      const batch = nodeTypes.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (nodeType) => {
        const context = contexts[nodeType];
        if (!context) {
          results[nodeType] = {
            success: false,
            generatedCode: '',
            sourceAnalysis: null,
            fallbackUsed: true,
            error: 'No context provided for node'
          };
          return;
        }

        results[nodeType] = await this.generateFromSource(userId, nodeType, context);
      });

      await Promise.all(batchPromises);
    }

    return results;
  }

  /**
   * Get repository status and statistics
   */
  async getRepositoryStatus(): Promise<{
    isInitialized: boolean;
    info?: any;
    stats?: any;
  }> {
    try {
      const info = await this.repoManager.getRepositoryInfo();
      const stats = await this.repoManager.getRepositoryStats();
      
      return {
        isInitialized: true,
        info,
        stats
      };
    } catch (error) {
      return {
        isInitialized: false
      };
    }
  }
}

export default SourceAwareAIGenerator;