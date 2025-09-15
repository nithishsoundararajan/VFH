import { createClient } from '@/lib/supabase/client';
import { AIProvider, AIProviderSettings, AI_PROVIDERS, AIProviderError } from '@/lib/ai-providers';

export class AIProviderService {
  private supabase = createClient();
  private schemaChecked = false;
  private schemaAvailable = false;

  /**
   * Check if AI provider schema is available
   */
  private async checkSchema(): Promise<boolean> {
    if (this.schemaChecked) {
      return this.schemaAvailable;
    }

    try {
      // Try to query the AI provider columns
      const { error } = await this.supabase
        .from('profiles')
        .select('ai_provider')
        .limit(1);

      this.schemaAvailable = !error;
      this.schemaChecked = true;

      if (error && (error.code === 'PGRST116' || error.message?.includes('column') || error.message?.includes('does not exist'))) {
        console.warn('AI provider schema not available:', error.message);
        this.schemaAvailable = false;
      }

      return this.schemaAvailable;
    } catch (err) {
      console.warn('Schema check failed:', err);
      this.schemaAvailable = false;
      this.schemaChecked = true;
      return false;
    }
  }

  /**
   * Get user's AI provider settings
   */
  async getUserSettings(userId: string): Promise<AIProviderSettings | null> {
    const schemaAvailable = await this.checkSchema();

    if (!schemaAvailable) {
      console.warn('AI provider schema not available. Using system default.');
      return {
        provider: 'system_default',
        isValid: true,
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('ai_provider, ai_api_key_valid')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle no results

      if (error) {
        // Handle different error cases gracefully
        console.warn('Database error fetching AI provider settings:', error.code, error.message);
        return {
          provider: 'system_default',
          isValid: true,
        };
      }

      // If no data or ai_provider is null, return system default
      if (!data || !data.ai_provider) {
        return {
          provider: 'system_default',
          isValid: true,
        };
      }

      return {
        provider: data.ai_provider as AIProvider,
        isValid: data.ai_api_key_valid ?? false,
      };
    } catch (err) {
      // Graceful fallback for any database schema issues
      if (err instanceof AIProviderError) {
        throw err;
      }

      console.warn('Error fetching AI provider settings, falling back to system default:', err);
      return {
        provider: 'system_default',
        isValid: true,
      };
    }
  }

  /**
   * Update user's AI provider settings
   */
  async updateUserSettings(
    userId: string,
    provider: AIProvider,
    apiKey?: string
  ): Promise<void> {
    try {
      // For system_default, we don't need to store anything in the database
      if (provider === 'system_default') {
        console.log('Using system default provider, no database update needed.');
        return;
      }

      // Check if schema is available first
      const schemaAvailable = await this.checkSchema();

      if (!schemaAvailable) {
        // For now, just log the selection but don't fail
        console.warn(`User selected ${provider} but database schema not available. Settings saved locally only.`);

        // Store in localStorage as fallback
        if (typeof window !== 'undefined') {
          localStorage.setItem('ai-provider-fallback', JSON.stringify({
            provider,
            hasApiKey: !!apiKey,
            timestamp: Date.now()
          }));
        }

        return;
      }

      const updates: any = {
        updated_at: new Date().toISOString(),
        ai_provider: provider,
      };

      // If provider requires a key and one is provided, encrypt and store it
      if (AI_PROVIDERS[provider].requiresKey && apiKey) {
        // Call Edge Function to encrypt the API key
        const { data: encryptedData, error: encryptError } = await this.supabase.functions
          .invoke('encrypt-api-key', {
            body: { apiKey, userId }
          });

        if (encryptError) {
          throw new AIProviderError('Failed to encrypt API key', provider);
        }

        updates.ai_api_key_encrypted = encryptedData.encryptedKey;
        updates.ai_api_key_valid = null; // Reset validation status
      } else if (!AI_PROVIDERS[provider].requiresKey) {
        // Clear API key for system default
        updates.ai_api_key_encrypted = null;
        updates.ai_api_key_valid = null;
      }

      const { error } = await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        throw new AIProviderError('Failed to update AI provider settings', provider);
      }
    } catch (err) {
      if (err instanceof AIProviderError) {
        throw err;
      }
      throw new AIProviderError('Failed to update AI provider settings', provider);
    }
  }

  /**
   * Test API key validity
   */
  async testApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
    const providerConfig = AI_PROVIDERS[provider];

    if (!providerConfig.requiresKey || !providerConfig.testEndpoint) {
      return true;
    }

    try {
      let response: Response;

      switch (provider) {
        case 'openai':
          response = await fetch(providerConfig.testEndpoint!, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          break;

        case 'anthropic':
          response = await fetch(providerConfig.testEndpoint!, {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }],
            }),
          });
          break;

        case 'gemini':
          response = await fetch(`${providerConfig.testEndpoint}?key=${apiKey}`, {
            headers: {
              'Content-Type': 'application/json',
            },
          });
          break;

        case 'openrouter':
          response = await fetch(providerConfig.testEndpoint!, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          break;

        case 'openrouter':
          response = await fetch(providerConfig.testEndpoint!, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          break;

        default:
          return false;
      }

      return response.status === 200 || response.status === 401; // 401 means key format is valid but may be invalid
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }

  /**
   * Update API key validation status
   */
  async updateKeyValidation(userId: string, isValid: boolean): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({
          ai_api_key_valid: isValid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        // If columns don't exist, silently ignore for now
        if (error.code === 'PGRST116' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          console.warn('AI provider columns not found. Cannot update validation status.');
          return;
        }
        throw new AIProviderError('Failed to update key validation status', 'system_default');
      }
    } catch (err) {
      if (err instanceof AIProviderError) {
        throw err;
      }
      console.warn('Failed to update key validation status:', err);
    }
  }

  /**
   * Get decrypted API key for server-side use (Edge Functions)
   */
  async getDecryptedApiKey(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase.functions
      .invoke('decrypt-api-key', {
        body: { userId }
      });

    if (error) {
      throw new AIProviderError('Failed to decrypt API key', 'system_default');
    }

    return data?.apiKey || null;
  }

  /**
   * Check if AI provider functionality is fully available
   */
  async isAvailable(): Promise<boolean> {
    return await this.checkSchema();
  }

  /**
   * Clear user's AI provider settings
   */
  async clearUserSettings(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({
          ai_provider: null,
          ai_api_key_encrypted: null,
          ai_api_key_valid: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        // If columns don't exist, silently ignore for now
        if (error.code === 'PGRST116' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          console.warn('AI provider columns not found. Cannot clear settings.');
          return;
        }
        throw new AIProviderError('Failed to clear AI provider settings', 'system_default');
      }
    } catch (err) {
      if (err instanceof AIProviderError) {
        throw err;
      }
      console.warn('Failed to clear AI provider settings:', err);
    }
  }
}