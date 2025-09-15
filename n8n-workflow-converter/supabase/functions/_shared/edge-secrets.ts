/**
 * Supabase Edge Function Secrets Manager
 * Uses native Supabase Edge Function secrets instead of .env.local
 * 
 * Secrets are managed via Supabase CLI:
 * supabase secrets set VIRUSTOTAL_API_KEY=your_key
 * supabase secrets list
 */

interface SecretCache {
  [key: string]: {
    value: string;
    timestamp: number;
    ttl: number;
  };
}

class EdgeFunctionSecrets {
  private cache: SecretCache = {};
  private defaultTTL = 10 * 60 * 1000; // 10 minutes cache

  /**
   * Get a secret from Supabase Edge Function environment
   * Falls back to regular Deno.env if secret not found
   */
  async getSecret(secretName: string, fallbackEnvVar?: string): Promise<string | null> {
    try {
      // Check cache first
      const cached = this.getCachedSecret(secretName);
      if (cached) {
        return cached;
      }

      // Get from Edge Function secrets (these are set via Supabase CLI)
      let secretValue = Deno.env.get(secretName);

      // If not found, try fallback environment variable
      if (!secretValue && fallbackEnvVar) {
        secretValue = Deno.env.get(fallbackEnvVar);
        if (secretValue) {
          console.warn(`Using fallback env var ${fallbackEnvVar} for ${secretName}`);
        }
      }

      if (secretValue) {
        // Cache the secret
        this.cacheSecret(secretName, secretValue);
        return secretValue;
      }

      console.warn(`Secret ${secretName} not found in Edge Function environment`);
      return null;

    } catch (error) {
      console.error(`Error getting secret ${secretName}:`, error);
      return null;
    }
  }

  /**
   * Get multiple secrets at once
   */
  async getSecrets(secretNames: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    
    // Process all secrets in parallel
    const promises = secretNames.map(async (name) => {
      const value = await this.getSecret(name);
      return { name, value };
    });
    
    const secretResults = await Promise.all(promises);
    
    secretResults.forEach(({ name, value }) => {
      results[name] = value;
    });
    
    return results;
  }

  /**
   * Get all converter-specific secrets
   */
  async getConverterSecrets(): Promise<{
    virusTotalKey: string | null;
    webhookSecret: string | null;
    encryptionKey: string | null;
    openAiKey: string | null;
    githubToken: string | null;
  }> {
    const secrets = await this.getSecrets([
      'VIRUSTOTAL_API_KEY',
      'WEBHOOK_SECRET',
      'ENCRYPTION_KEY', 
      'OPENAI_API_KEY',
      'GITHUB_TOKEN'
    ]);

    return {
      virusTotalKey: secrets.VIRUSTOTAL_API_KEY,
      webhookSecret: secrets.WEBHOOK_SECRET,
      encryptionKey: secrets.ENCRYPTION_KEY,
      openAiKey: secrets.OPENAI_API_KEY,
      githubToken: secrets.GITHUB_TOKEN
    };
  }

  /**
   * Validate that required secrets are present
   */
  async validateRequiredSecrets(requiredSecrets: string[]): Promise<{
    valid: boolean;
    missing: string[];
    configured: string[];
  }> {
    const secrets = await this.getSecrets(requiredSecrets);
    const missing: string[] = [];
    const configured: string[] = [];

    Object.entries(secrets).forEach(([name, value]) => {
      if (value) {
        configured.push(name);
      } else {
        missing.push(name);
      }
    });

    return {
      valid: missing.length === 0,
      missing,
      configured
    };
  }

  /**
   * Cache a secret value
   */
  private cacheSecret(secretName: string, value: string, ttl?: number): void {
    this.cache[secretName] = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };
  }

  /**
   * Get cached secret if still valid
   */
  private getCachedSecret(secretName: string): string | null {
    const cached = this.cache[secretName];
    
    if (!cached) {
      return null;
    }
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    
    if (isExpired) {
      delete this.cache[secretName];
      return null;
    }
    
    return cached.value;
  }

  /**
   * Clear cache for specific secret or all secrets
   */
  clearCache(secretName?: string): void {
    if (secretName) {
      delete this.cache[secretName];
    } else {
      this.cache = {};
    }
  }

  /**
   * Log secret configuration status (without exposing values)
   */
  async logSecretStatus(secretNames: string[]): Promise<void> {
    const secrets = await this.getSecrets(secretNames);
    
    console.log('=== Edge Function Secrets Status ===');
    Object.entries(secrets).forEach(([name, value]) => {
      const status = value ? '✅ CONFIGURED' : '❌ MISSING';
      console.log(`${name}: ${status}`);
    });
    console.log('=====================================');
  }
}

// Singleton instance
export const edgeFunctionSecrets = new EdgeFunctionSecrets();

// Convenience functions
export const getSecret = (secretName: string, fallbackEnvVar?: string) => 
  edgeFunctionSecrets.getSecret(secretName, fallbackEnvVar);

export const getSecrets = (secretNames: string[]) => 
  edgeFunctionSecrets.getSecrets(secretNames);

export const getConverterSecrets = () => 
  edgeFunctionSecrets.getConverterSecrets();

export const validateRequiredSecrets = (requiredSecrets: string[]) =>
  edgeFunctionSecrets.validateRequiredSecrets(requiredSecrets);

export const logSecretStatus = (secretNames: string[]) =>
  edgeFunctionSecrets.logSecretStatus(secretNames);

// Default export
export default edgeFunctionSecrets;