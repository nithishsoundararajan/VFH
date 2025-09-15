/**
 * Edge Function Secrets Manager
 * Fetch secrets from Supabase database instead of environment variables
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SecretCache {
    [key: string]: {
        value: string;
        timestamp: number;
        ttl: number;
    };
}

class EdgeSecretsManager {
    private cache: SecretCache = {};
    private supabase: any;
    private defaultTTL = 5 * 60 * 1000; // 5 minutes

    constructor() {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        this.supabase = createClient(supabaseUrl, serviceRoleKey);
    }

    async getSecret(secretName: string, fallbackEnvVar?: string): Promise<string | null> {
        try {
            // Check cache first
            const cached = this.getCachedSecret(secretName);
            if (cached) {
                return cached;
            }

            // Fetch from database
            const { data, error } = await this.supabase
                .from('app_secrets')
                .select('value')
                .eq('name', secretName)
                .eq('environment', this.getCurrentEnvironment())
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Secret doesn't exist, try fallback
                    if (fallbackEnvVar) {
                        const envValue = Deno.env.get(fallbackEnvVar);
                        if (envValue) {
                            console.warn(`Using fallback env var for ${secretName}`);
                            return envValue;
                        }
                    }
                    return null;
                }
                throw error;
            }

            const secretValue = data?.value;
            if (secretValue) {
                this.cacheSecret(secretName, secretValue);
            }

            return secretValue || null;

        } catch (error) {
            console.error(`Error fetching secret ${secretName}:`, error);

            // Fallback to environment variable
            if (fallbackEnvVar) {
                const envValue = Deno.env.get(fallbackEnvVar);
                if (envValue) {
                    console.warn(`Using fallback env var for ${secretName} due to error`);
                    return envValue;
                }
            }

            return null;
        }
    }

    async getSecrets(secretNames: string[]): Promise<Record<string, string | null>> {
        const results: Record<string, string | null> = {};

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

    private cacheSecret(secretName: string, value: string, ttl?: number): void {
        this.cache[secretName] = {
            value,
            timestamp: Date.now(),
            ttl: ttl || this.defaultTTL
        };
    }

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

    private getCurrentEnvironment(): string {
        return Deno.env.get('NODE_ENV') || 'development';
    }
}

// Singleton instance for Edge Functions
export const edgeSecretsManager = new EdgeSecretsManager();

// Convenience functions
export const getSecret = (secretName: string, fallbackEnvVar?: string) =>
    edgeSecretsManager.getSecret(secretName, fallbackEnvVar);

export const getSecrets = (secretNames: string[]) =>
    edgeSecretsManager.getSecrets(secretNames);

// Common secrets getter for n8n converter
export const getConverterSecrets = async () => {
    return await getSecrets([
        'VIRUSTOTAL_API_KEY',
        'WEBHOOK_SECRET',
        'ENCRYPTION_KEY',
        'API_KEY_ENCRYPTION_SECRET',
        'OPENAI_API_KEY',
        'OPENROUTER_API_KEY'
    ]);
};