import { createClient } from '@supabase/supabase-js'

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
   * Generate code using system default (OpenAI GPT-4o-mini via OpenRouter)
   */
  private async generateWithSystemDefault(prompt: string, context?: any): Promise<string> {
    // Use OpenRouter with OpenAI GPT-4o-mini as system default AI service
    const systemApiKey = Deno.env.get('OPENROUTER_API_KEY')

    if (systemApiKey) {
      // Use system OpenRouter key with GPT-4o-mini model
      try {
        console.log('Using system OpenRouter API key with GPT-4o-mini for code generation')
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${systemApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://n8n-workflow-converter.com',
            'X-Title': 'n8n Workflow Converter (System Default)',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini', // Use GPT-4o-mini via OpenRouter
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

        if (response.ok) {
          const data = await response.json()
          return data.choices[0]?.message?.content || ''
        } else {
          console.error('System OpenRouter API error:', response.status, await response.text())
        }
      } catch (error) {
        console.error('System AI generation failed:', error)
      }
    } else {
      console.warn('No OPENROUTER_API_KEY found in system secrets')
    }

    // Fallback to template-based generation
    console.log('Falling back to template-based generation')
    return this.generateWithTemplate(prompt, context)
  }

  /**
   * Template-based code generation (fallback)
   */
  private generateWithTemplate(prompt: string, context?: any): string {
    // Simple template-based generation as ultimate fallback
    return `
/**
 * Generated Node.js code
 * Based on: ${prompt.substring(0, 100)}...
 */

export class GeneratedNode {
  constructor(config) {
    this.config = config;
  }

  async execute(inputData, context) {
    try {
      // TODO: Implement node logic based on requirements
      console.log('Executing node with input:', inputData);
      
      // Return processed data
      return {
        success: true,
        data: inputData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Node execution failed:', error);
      throw error;
    }
  }
}
`
  }
}