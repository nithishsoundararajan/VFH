import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'system_default'
  apiKey?: string
  isValid?: boolean
}

export class AIProviderHelper {
  private supabase: ReturnType<typeof createClient>

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  /**
   * Get user's AI provider configuration
   */
  async getUserAIConfig(userId: string): Promise<AIProviderConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('ai_provider, ai_api_key_valid')
        .eq('id', userId)
        .single()

      if (error || !data?.ai_provider) {
        return { provider: 'system_default' }
      }

      return {
        provider: data.ai_provider,
        isValid: data.ai_api_key_valid
      }
    } catch (error) {
      console.error('Failed to get user AI config:', error)
      return { provider: 'system_default' }
    }
  }

  /**
   * Get decrypted API key for the user
   */
  async getDecryptedApiKey(userId: string): Promise<string | null> {
    try {
      // Get encryption key from environment
      const encryptionKey = Deno.env.get('API_KEY_ENCRYPTION_SECRET')
      if (!encryptionKey) {
        return null
      }

      // Get encrypted API key from database
      const { data: profile, error } = await this.supabase
        .from('profiles')
        .select('ai_api_key_encrypted')
        .eq('id', userId)
        .single()

      if (error || !profile?.ai_api_key_encrypted) {
        return null
      }

      // Decrypt the API key
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      // Create decryption key from user ID and secret
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(userId + encryptionKey),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      )

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('supabase-ai-keys'),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      )

      // Decode base64 and extract IV and encrypted data
      const combined = new Uint8Array(
        atob(profile.ai_api_key_encrypted)
          .split('')
          .map(char => char.charCodeAt(0))
      )

      const iv = combined.slice(0, 12)
      const encryptedData = combined.slice(12)

      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      )

      return decoder.decode(decryptedData)
    } catch (error) {
      console.error('Failed to decrypt API key:', error)
      return null
    }
  }

  /**
   * Generate code using the appropriate AI provider
   */
  async generateCode(
    userId: string,
    prompt: string,
    context?: any
  ): Promise<string> {
    const config = await this.getUserAIConfig(userId)

    if (!config) {
      return this.generateWithSystemDefault(prompt, context)
    }

    switch (config.provider) {
      case 'openai':
        return this.generateWithOpenAI(userId, prompt, context)
      case 'anthropic':
        return this.generateWithAnthropic(userId, prompt, context)
      case 'gemini':
        return this.generateWithGemini(userId, prompt, context)
      case 'openrouter':
        return this.generateWithOpenRouter(userId, prompt, context)
      case 'system_default':
      default:
        return this.generateWithSystemDefault(prompt, context)
    }
  }

  /**
   * Generate code using OpenAI
   */
  private async generateWithOpenAI(
    userId: string,
    prompt: string,
    context?: any
  ): Promise<string> {
    const apiKey = await this.getDecryptedApiKey(userId)

    if (!apiKey) {
      console.warn('OpenAI API key not found, falling back to system default')
      return this.generateWithSystemDefault(prompt, context)
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a code generation assistant. Generate clean, well-documented Node.js code based on the provided requirements.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('OpenAI generation failed:', error)
      return this.generateWithSystemDefault(prompt, context)
    }
  }

  /**
   * Generate code using Anthropic
   */
  private async generateWithAnthropic(
    userId: string,
    prompt: string,
    context?: any
  ): Promise<string> {
    const apiKey = await this.getDecryptedApiKey(userId)

    if (!apiKey) {
      console.warn('Anthropic API key not found, falling back to system default')
      return this.generateWithSystemDefault(prompt, context)
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
          model: 'claude-3-sonnet-20240229',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: `You are a code generation assistant. Generate clean, well-documented Node.js code based on the provided requirements.\n\n${prompt}`
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`)
      }

      const data = await response.json()
      return data.content[0]?.text || ''
    } catch (error) {
      console.error('Anthropic generation failed:', error)
      return this.generateWithSystemDefault(prompt, context)
    }
  }

  /**
   * Generate code using Google Gemini
   */
  private async generateWithGemini(
    userId: string,
    prompt: string,
    context?: any
  ): Promise<string> {
    const apiKey = await this.getDecryptedApiKey(userId)

    if (!apiKey) {
      console.warn('Gemini API key not found, falling back to system default')
      return this.generateWithSystemDefault(prompt, context)
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
              text: `You are a code generation assistant. Generate clean, well-documented Node.js code based on the provided requirements.\n\n${prompt}`
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
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data = await response.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (error) {
      console.error('Gemini generation failed:', error)
      return this.generateWithSystemDefault(prompt, context)
    }
  }

  /**
   * Generate code using OpenRouter
   */
  private async generateWithOpenRouter(
    userId: string,
    prompt: string,
    context?: any
  ): Promise<string> {
    const apiKey = await this.getDecryptedApiKey(userId)

    if (!apiKey) {
      console.warn('OpenRouter API key not found, falling back to system default')
      return this.generateWithSystemDefault(prompt, context)
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://n8n-workflow-converter.com', // Replace with your domain
          'X-Title': 'n8n Workflow Converter',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini', // Default to GPT-4o-mini via OpenRouter
          messages: [
            {
              role: 'system',
              content: 'You are a code generation assistant. Generate clean, well-documented Node.js code based on the provided requirements.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        })
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('OpenRouter generation failed:', error)
      return this.generateWithSystemDefault(prompt, context)
    }
  }

  /**
   * Generate code using system default (try multiple providers)
   */
  private async generateWithSystemDefault(prompt: string, context?: any): Promise<string> {
    // Try multiple system API keys in order of preference
    const apiKeys = {
      openrouter: Deno.env.get('OPENROUTER_API_KEY'),
      gemini: Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('Gemini_API'),
      openai: Deno.env.get('OPENAI_API_KEY')
    }

    console.log('System API Keys Status:', {
      openrouter: apiKeys.openrouter ? '✅ Available' : '❌ Missing',
      gemini: apiKeys.gemini ? '✅ Available' : '❌ Missing', 
      openai: apiKeys.openai ? '✅ Available' : '❌ Missing'
    })

    // Try OpenRouter first (most reliable)
    if (apiKeys.openrouter) {
      try {
        console.log('Using system OpenRouter API key with GPT-4o-mini for code generation')
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKeys.openrouter}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://n8n-workflow-converter.com',
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
        })

        if (response.ok) {
          const data = await response.json()
          const generatedCode = data.choices[0]?.message?.content || ''
          if (generatedCode.trim()) {
            console.log('✅ OpenRouter generation successful')
            return generatedCode
          }
        } else {
          console.error('OpenRouter API error:', response.status, await response.text())
        }
      } catch (error) {
        console.error('OpenRouter generation failed:', error)
      }
    }

    // Try Gemini as fallback
    if (apiKeys.gemini) {
      try {
        console.log('Trying Gemini API as fallback')
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
        })

        if (response.ok) {
          const data = await response.json()
          const generatedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (generatedCode.trim()) {
            console.log('✅ Gemini generation successful')
            return generatedCode
          }
        } else {
          console.error('Gemini API error:', response.status, await response.text())
        }
      } catch (error) {
        console.error('Gemini generation failed:', error)
      }
    }

    // Try OpenAI as last resort
    if (apiKeys.openai) {
      try {
        console.log('Trying OpenAI API as last resort')
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
        })

        if (response.ok) {
          const data = await response.json()
          const generatedCode = data.choices[0]?.message?.content || ''
          if (generatedCode.trim()) {
            console.log('✅ OpenAI generation successful')
            return generatedCode
          }
        } else {
          console.error('OpenAI API error:', response.status, await response.text())
        }
      } catch (error) {
        console.error('OpenAI generation failed:', error)
      }
    }

    // All AI providers failed, use enhanced template
    console.warn('❌ All AI providers failed, using enhanced template generation')
    return this.generateWithTemplate(prompt, context)
  }

  /**
   * Enhanced template-based code generation (fallback)
   */
  private generateWithTemplate(prompt: string, context?: any): string {
    // Extract node information from context if available
    const nodeType = context?.nodeType || 'unknown'
    const nodeName = context?.nodeName || 'GeneratedNode'
    const parameters = context?.parameters || {}
    
    // Generate class name
    const className = nodeName.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d/, 'Node') + 'Node'
    
    // Generate node-specific logic based on type
    let nodeLogic = this.generateNodeTypeLogic(nodeType, parameters)
    
    return `/**
 * Generated Node.js code - ${nodeName}
 * Type: ${nodeType}
 * Generated using: Enhanced Template (AI providers unavailable)
 * 
 * This is a template implementation based on n8n node patterns.
 * Manual customization may be required for full functionality.
 */

export class ${className} {
  constructor(config = {}) {
    this.config = config;
    this.nodeType = '${nodeType}';
    this.nodeName = '${nodeName}';
    this.parameters = ${JSON.stringify(parameters, null, 4)};
  }

  /**
   * Execute the node with the given input data
   * @param {Array} inputData - Input data from previous nodes
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Processed output data
   */
  async execute(inputData = [], context = {}) {
    try {
      console.log(\`[\${this.nodeName}] Starting execution...\`);
      
      // Validate input data
      const processedInput = this.processInput(inputData);
      
      // Execute node-specific logic
      const result = await this.executeNodeLogic(processedInput, context);
      
      console.log(\`[\${this.nodeName}] Execution completed successfully\`);
      
      return {
        success: true,
        data: result,
        nodeType: this.nodeType,
        nodeName: this.nodeName,
        timestamp: new Date().toISOString(),
        executionId: context.executionId || 'unknown'
      };
      
    } catch (error) {
      console.error(\`[\${this.nodeName}] Execution failed:\`, error);
      throw new Error(\`Node \${this.nodeName} failed: \${error.message}\`);
    }
  }

  /**
   * Process and validate input data
   */
  processInput(inputData) {
    if (!Array.isArray(inputData)) {
      inputData = [inputData];
    }
    
    if (inputData.length === 0) {
      return {};
    }
    
    // Handle single input
    if (inputData.length === 1) {
      return inputData[0]?.data || inputData[0] || {};
    }
    
    // Handle multiple inputs
    return {
      inputs: inputData.map(input => input?.data || input),
      count: inputData.length
    };
  }

  /**
   * Node-specific execution logic
   */
  async executeNodeLogic(inputData, context) {
${nodeLogic}
  }

  /**
   * Validate required parameters
   */
  validateParameters(requiredParams = []) {
    const missing = requiredParams.filter(param => 
      this.parameters[param] === undefined || this.parameters[param] === null
    );
    
    if (missing.length > 0) {
      throw new Error(\`Missing required parameters: \${missing.join(', ')}\`);
    }
  }
}

export default ${className};`
  }

  /**
   * Generate node-specific logic based on node type
   */
  private generateNodeTypeLogic(nodeType: string, parameters: any): string {
    const type = nodeType.toLowerCase();
    
    if (type.includes('httprequest') || type.includes('webhook')) {
      return `    // HTTP Request Node Logic
    const url = this.parameters.url || 'https://api.example.com';
    const method = this.parameters.method || 'GET';
    const headers = this.parameters.headers || {};
    
    console.log(\`Making \${method} request to \${url}\`);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: method !== 'GET' ? JSON.stringify(inputData) : undefined
    });
    
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
    
    return await response.json();`;
    }
    
    if (type.includes('set') || type.includes('edit')) {
      return `    // Set/Edit Node Logic
    const result = { ...inputData };
    
    // Apply parameter transformations
    Object.entries(this.parameters).forEach(([key, value]) => {
      if (key.startsWith('values.')) {
        const fieldName = key.replace('values.', '');
        result[fieldName] = value;
      }
    });
    
    return result;`;
    }
    
    if (type.includes('if') || type.includes('switch')) {
      return `    // Conditional Node Logic
    const condition = this.parameters.condition || true;
    
    if (condition) {
      return { ...inputData, branch: 'true' };
    } else {
      return { ...inputData, branch: 'false' };
    }`;
    }
    
    if (type.includes('code') || type.includes('function')) {
      return `    // Code/Function Node Logic
    const code = this.parameters.code || 'return items;';
    
    // Execute custom code (simplified)
    try {
      const func = new Function('items', 'context', code);
      return func(inputData, context);
    } catch (error) {
      console.warn('Custom code execution failed, returning input data');
      return inputData;
    }`;
    }
    
    if (type.includes('merge') || type.includes('join')) {
      return `    // Merge/Join Node Logic
    if (Array.isArray(inputData.inputs)) {
      return {
        merged: inputData.inputs,
        count: inputData.inputs.length,
        mergedAt: new Date().toISOString()
      };
    }
    
    return inputData;`;
    }
    
    // Default logic for unknown node types
    return `    // Generic Node Logic (${nodeType})
    console.log('Processing data with generic logic');
    
    // Apply any parameter transformations
    const result = { ...inputData };
    
    // Add node-specific metadata
    result._nodeType = this.nodeType;
    result._processedAt = new Date().toISOString();
    result._parameters = this.parameters;
    
    return result;`;
  }
}