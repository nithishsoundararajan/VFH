import { createClient } from '@/lib/supabase/server';
import { AIProvider, AIProviderSettings } from '@/lib/ai-providers';

export interface CodeGenerationContext {
  nodeType: string;
  nodeName: string;
  parameters: Record<string, any>;
  workflowName?: string;
  projectName?: string;
}

export interface CodeGenerationResult {
  success: boolean;
  code?: string;
  provider: AIProvider;
  error?: string;
  fallbackUsed: boolean;
}

export class AICodeGenerator {
  private supabase = createClient();

  /**
   * Generate code using the user's configured AI provider
   */
  async generateCode(
    userId: string,
    prompt: string,
    context: CodeGenerationContext
  ): Promise<CodeGenerationResult> {
    try {
      // Get user's AI provider settings
      const aiSettings = await this.getUserAISettings(userId);
      
      if (!aiSettings) {
        return this.generateWithSystemDefault(prompt, context);
      }

      // Call appropriate AI provider
      switch (aiSettings.provider) {
        case 'openai':
          return await this.generateWithOpenAI(userId, prompt, context);
        case 'anthropic':
          return await this.generateWithAnthropic(userId, prompt, context);
        case 'gemini':
          return await this.generateWithGemini(userId, prompt, context);
        case 'openrouter':
          return await this.generateWithOpenRouter(userId, prompt, context);
        case 'system_default':
        default:
          return this.generateWithSystemDefault(prompt, context);
      }
    } catch (error) {
      console.error('Code generation failed:', error);
      return {
        success: false,
        provider: 'system_default',
        error: error.message,
        fallbackUsed: true
      };
    }
  }

  /**
   * Get user's AI provider settings
   */
  private async getUserAISettings(userId: string): Promise<AIProviderSettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('ai_provider, ai_api_key_valid')
        .eq('id', userId)
        .single();

      if (error || !data?.ai_provider) {
        return { provider: 'system_default', isValid: true };
      }

      return {
        provider: data.ai_provider as AIProvider,
        isValid: data.ai_api_key_valid ?? false,
      };
    } catch (error) {
      console.warn('Failed to get AI settings, using system default:', error);
      return { provider: 'system_default', isValid: true };
    }
  }

  /**
   * Get decrypted API key for user
   */
  private async getDecryptedApiKey(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.functions
        .invoke('decrypt-api-key', {
          body: { userId }
        });

      if (error) {
        console.warn('Failed to decrypt API key:', error);
        return null;
      }

      return data?.apiKey || null;
    } catch (error) {
      console.warn('API key decryption failed:', error);
      return null;
    }
  }

  /**
   * Generate code using OpenAI
   */
  private async generateWithOpenAI(
    userId: string,
    prompt: string,
    context: CodeGenerationContext
  ): Promise<CodeGenerationResult> {
    const apiKey = await this.getDecryptedApiKey(userId);

    if (!apiKey) {
      console.warn('OpenAI API key not available, falling back to system default');
      return this.generateWithSystemDefault(prompt, context);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert Node.js developer specializing in n8n workflow automation. Generate clean, production-ready, well-documented code that follows best practices.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.1,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const generatedCode = data.choices[0]?.message?.content || '';

      if (!generatedCode.trim()) {
        throw new Error('OpenAI returned empty response');
      }

      return {
        success: true,
        code: generatedCode,
        provider: 'openai',
        fallbackUsed: false
      };
    } catch (error) {
      console.error('OpenAI generation failed:', error);
      return this.generateWithSystemDefault(prompt, context);
    }
  }

  /**
   * Generate code using Anthropic Claude
   */
  private async generateWithAnthropic(
    userId: string,
    prompt: string,
    context: CodeGenerationContext
  ): Promise<CodeGenerationResult> {
    const apiKey = await this.getDecryptedApiKey(userId);

    if (!apiKey) {
      console.warn('Anthropic API key not available, falling back to system default');
      return this.generateWithSystemDefault(prompt, context);
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: `You are an expert Node.js developer specializing in n8n workflow automation. Generate clean, production-ready, well-documented code that follows best practices.\n\n${prompt}`
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const generatedCode = data.content[0]?.text || '';

      if (!generatedCode.trim()) {
        throw new Error('Anthropic returned empty response');
      }

      return {
        success: true,
        code: generatedCode,
        provider: 'anthropic',
        fallbackUsed: false
      };
    } catch (error) {
      console.error('Anthropic generation failed:', error);
      return this.generateWithSystemDefault(prompt, context);
    }
  }

  /**
   * Generate code using Google Gemini
   */
  private async generateWithGemini(
    userId: string,
    prompt: string,
    context: CodeGenerationContext
  ): Promise<CodeGenerationResult> {
    const apiKey = await this.getDecryptedApiKey(userId);

    if (!apiKey) {
      console.warn('Gemini API key not available, falling back to system default');
      return this.generateWithSystemDefault(prompt, context);
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert Node.js developer specializing in n8n workflow automation. Generate clean, production-ready, well-documented code that follows best practices.\n\n${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 4000,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const generatedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!generatedCode.trim()) {
        throw new Error('Gemini returned empty response');
      }

      return {
        success: true,
        code: generatedCode,
        provider: 'gemini',
        fallbackUsed: false
      };
    } catch (error) {
      console.error('Gemini generation failed:', error);
      return this.generateWithSystemDefault(prompt, context);
    }
  }

  /**
   * Generate code using OpenRouter
   */
  private async generateWithOpenRouter(
    userId: string,
    prompt: string,
    context: CodeGenerationContext
  ): Promise<CodeGenerationResult> {
    const apiKey = await this.getDecryptedApiKey(userId);

    if (!apiKey) {
      console.warn('OpenRouter API key not available, falling back to system default');
      return this.generateWithSystemDefault(prompt, context);
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://n8n-workflow-converter.com',
          'X-Title': 'n8n Workflow Converter',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert Node.js developer specializing in n8n workflow automation. Generate clean, production-ready, well-documented code that follows best practices.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const generatedCode = data.choices[0]?.message?.content || '';

      if (!generatedCode.trim()) {
        throw new Error('OpenRouter returned empty response');
      }

      return {
        success: true,
        code: generatedCode,
        provider: 'openrouter',
        fallbackUsed: false
      };
    } catch (error) {
      console.error('OpenRouter generation failed:', error);
      return this.generateWithSystemDefault(prompt, context);
    }
  }

  /**
   * Generate code using system default (environment-based)
   */
  private async generateWithSystemDefault(
    prompt: string,
    context: CodeGenerationContext
  ): Promise<CodeGenerationResult> {
    // Try multiple system API keys in order of preference
    const apiKeys = {
      openrouter: process.env.OPENROUTER_API_KEY,
      gemini: process.env.GOOGLE_AI_API_KEY || process.env.Gemini_API,
      openai: process.env.OPENAI_API_KEY
    };

    console.log('System API Keys Status:', {
      openrouter: apiKeys.openrouter ? '✅ Available' : '❌ Missing',
      gemini: apiKeys.gemini ? '✅ Available' : '❌ Missing', 
      openai: apiKeys.openai ? '✅ Available' : '❌ Missing'
    });

    // Try OpenRouter first (most reliable)
    if (apiKeys.openrouter) {
      try {
        console.log('Using system OpenRouter API key with GPT-4o-mini');
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKeys.openrouter}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://n8n-workflow-converter.com',
            'X-Title': 'n8n Workflow Converter (System Default)',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an expert Node.js developer specializing in n8n workflow automation. Generate clean, production-ready, well-documented code that follows best practices.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 4000,
            temperature: 0.1
          })
        });

        if (response.ok) {
          const data = await response.json();
          const generatedCode = data.choices[0]?.message?.content || '';

          if (generatedCode.trim()) {
            console.log('✅ OpenRouter generation successful');
            return {
              success: true,
              code: generatedCode,
              provider: 'system_default',
              fallbackUsed: false
            };
          }
        } else {
          console.error('OpenRouter API error:', response.status, await response.text());
        }
      } catch (error) {
        console.warn('System OpenRouter failed:', error);
      }
    }

    // Try Gemini as fallback
    if (apiKeys.gemini) {
      try {
        console.log('Trying Gemini API as fallback');
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKeys.gemini}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an expert Node.js developer specializing in n8n workflow automation. Generate clean, production-ready, well-documented code that follows best practices.\n\n${prompt}`
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              topK: 1,
              topP: 1,
              maxOutputTokens: 4000,
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              }
            ]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const generatedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

          if (generatedCode.trim()) {
            console.log('✅ Gemini generation successful');
            return {
              success: true,
              code: generatedCode,
              provider: 'system_default',
              fallbackUsed: false
            };
          }
        } else {
          console.error('Gemini API error:', response.status, await response.text());
        }
      } catch (error) {
        console.warn('System Gemini failed:', error);
      }
    }

    // Try OpenAI as last resort
    if (apiKeys.openai) {
      try {
        console.log('Trying OpenAI API as last resort');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKeys.openai}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an expert Node.js developer specializing in n8n workflow automation. Generate clean, production-ready, well-documented code that follows best practices.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 4000,
            temperature: 0.1
          })
        });

        if (response.ok) {
          const data = await response.json();
          const generatedCode = data.choices[0]?.message?.content || '';

          if (generatedCode.trim()) {
            console.log('✅ OpenAI generation successful');
            return {
              success: true,
              code: generatedCode,
              provider: 'system_default',
              fallbackUsed: false
            };
          }
        } else {
          console.error('OpenAI API error:', response.status, await response.text());
        }
      } catch (error) {
        console.warn('System OpenAI failed:', error);
      }
    }

    // Ultimate fallback to enhanced template-based generation
    console.warn('❌ All AI providers failed, using enhanced template fallback');
    return {
      success: true,
      code: this.generateTemplateCode(context),
      provider: 'system_default',
      fallbackUsed: true
    };
  }

  /**
   * Template-based code generation (ultimate fallback)
   */
  private generateTemplateCode(context: CodeGenerationContext): string {
    const className = context.nodeName.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d/, 'Node') + 'Node';
    
    return `/**
 * Template-generated Node: ${context.nodeName}
 * Type: ${context.nodeType}
 * 
 * This is a basic template implementation.
 * Manual customization may be required for full functionality.
 */

export class ${className} {
  constructor() {
    this.nodeType = '${context.nodeType}';
    this.nodeName = '${context.nodeName}';
    this.parameters = ${JSON.stringify(context.parameters, null, 4)};
  }

  /**
   * Execute the node with the given input data
   * @param {Array} inputData - Input data from previous nodes
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Processed output data
   */
  async execute(inputData, context) {
    try {
      console.log(\`Executing \${this.nodeName} node...\`);
      
      // Process input data
      const processedData = this.processInput(inputData);
      
      // TODO: Implement specific node logic based on type: ${context.nodeType}
      // This is a template implementation that needs customization
      
      const result = {
        success: true,
        data: processedData,
        nodeType: this.nodeType,
        nodeName: this.nodeName,
        timestamp: new Date().toISOString(),
        executionId: context.executionId
      };
      
      console.log(\`\${this.nodeName} execution completed successfully\`);
      return result;
      
    } catch (error) {
      console.error(\`\${this.nodeName} execution failed:\`, error);
      throw new Error(\`Node \${this.nodeName} failed: \${error.message}\`);
    }
  }

  /**
   * Process input data
   * @param {Array} inputData - Raw input data
   * @returns {Object} - Processed data
   */
  processInput(inputData) {
    if (!inputData || inputData.length === 0) {
      return {};
    }
    
    // Handle single input
    if (inputData.length === 1) {
      return inputData[0].data || inputData[0];
    }
    
    // Handle multiple inputs
    return {
      inputs: inputData.map(input => input.data || input),
      count: inputData.length
    };
  }

  /**
   * Validate required parameters
   * @param {Array} requiredParams - List of required parameter names
   */
  validateParameters(requiredParams = []) {
    const missing = requiredParams.filter(param => 
      this.parameters[param] === undefined || this.parameters[param] === null
    );
    
    if (missing.length > 0) {
      throw new Error(\`Missing required parameters: \${missing.join(', ')}\`);
    }
  }
}`;
  }
}