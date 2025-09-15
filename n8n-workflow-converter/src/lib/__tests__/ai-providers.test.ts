import { AI_PROVIDERS, AIProvider } from '../ai-providers';

describe('AI Providers', () => {
  it('should include all expected providers', () => {
    const expectedProviders: AIProvider[] = ['openai', 'anthropic', 'gemini', 'openrouter', 'system_default'];
    
    expectedProviders.forEach(provider => {
      expect(AI_PROVIDERS[provider]).toBeDefined();
      expect(AI_PROVIDERS[provider].id).toBe(provider);
      expect(AI_PROVIDERS[provider].name).toBeTruthy();
      expect(AI_PROVIDERS[provider].description).toBeTruthy();
    });
  });

  it('should have correct Gemini configuration', () => {
    const gemini = AI_PROVIDERS.gemini;
    
    expect(gemini.id).toBe('gemini');
    expect(gemini.name).toBe('Google Gemini');
    expect(gemini.description).toContain('Google Gemini models');
    expect(gemini.keyLabel).toBe('Google AI API Key');
    expect(gemini.keyPlaceholder).toBe('AIza...');
    expect(gemini.testEndpoint).toBe('https://generativelanguage.googleapis.com/v1beta/models');
    expect(gemini.requiresKey).toBe(true);
  });

  it('should have system_default as fallback', () => {
    const systemDefault = AI_PROVIDERS.system_default;
    
    expect(systemDefault.requiresKey).toBe(false);
    expect(systemDefault.keyLabel).toBe('');
    expect(systemDefault.keyPlaceholder).toBe('');
  });

  it('should have valid test endpoints for providers that require keys', () => {
    Object.values(AI_PROVIDERS).forEach(provider => {
      if (provider.requiresKey) {
        expect(provider.testEndpoint).toBeTruthy();
        expect(provider.testEndpoint).toMatch(/^https?:\/\//);
      }
    });
  });
});