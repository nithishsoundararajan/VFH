import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/use-user';
import { AIProviderService } from '@/lib/services/ai-provider-service';
import { AIProvider, AIProviderSettings, AIProviderError } from '@/lib/ai-providers';

export function useAIProvider() {
  const { user } = useUser();
  const [settings, setSettings] = useState<AIProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [available, setAvailable] = useState(true);

  const aiProviderService = new AIProviderService();

  // Load user's AI provider settings
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // Check if functionality is available
      const isAvailable = await aiProviderService.isAvailable();
      setAvailable(isAvailable);
      
      const userSettings = await aiProviderService.getUserSettings(user.id);
      setSettings(userSettings);
      
      if (!isAvailable) {
        setError('AI provider functionality is not available yet. Database schema needs to be updated.');
      }
    } catch (err) {
      console.error('Failed to load AI provider settings:', err);
      
      // For schema-related errors, provide a more helpful message
      if (err instanceof AIProviderError && err.message.includes('database schema')) {
        setError('AI provider functionality is not available yet. Please contact your administrator.');
        setAvailable(false);
      } else {
        setError(err instanceof AIProviderError ? err.message : 'Failed to load settings');
      }
      
      // Set fallback settings
      setSettings({
        provider: 'system_default',
        isValid: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProvider = async (provider: AIProvider, apiKey?: string) => {
    if (!user) return;

    try {
      setUpdating(true);
      setError(null);
      
      await aiProviderService.updateUserSettings(user.id, provider, apiKey);
      
      // For system_default, update local state directly since no DB update is needed
      if (provider === 'system_default') {
        setSettings({
          provider: 'system_default',
          isValid: true,
        });
      } else {
        // Reload settings to get updated state for other providers
        await loadSettings();
      }
    } catch (err) {
      console.error('Failed to update AI provider:', err);
      setError(err instanceof AIProviderError ? err.message : 'Failed to update provider');
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  const testApiKey = async (provider: AIProvider, apiKey: string): Promise<boolean> => {
    try {
      setTesting(true);
      setError(null);
      
      const isValid = await aiProviderService.testApiKey(provider, apiKey);
      
      if (user && settings?.provider === provider) {
        // Update validation status in database
        await aiProviderService.updateKeyValidation(user.id, isValid);
        // Reload settings to reflect validation status
        await loadSettings();
      }
      
      return isValid;
    } catch (err) {
      console.error('Failed to test API key:', err);
      setError(err instanceof AIProviderError ? err.message : 'Failed to test API key');
      return false;
    } finally {
      setTesting(false);
    }
  };

  const clearSettings = async () => {
    if (!user) return;

    try {
      setUpdating(true);
      setError(null);
      
      await aiProviderService.clearUserSettings(user.id);
      setSettings(null);
    } catch (err) {
      console.error('Failed to clear AI provider settings:', err);
      setError(err instanceof AIProviderError ? err.message : 'Failed to clear settings');
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  return {
    settings,
    loading,
    error,
    testing,
    updating,
    available,
    updateProvider,
    testApiKey,
    clearSettings,
    refreshSettings: loadSettings,
  };
}