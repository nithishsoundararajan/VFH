export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'system_default';

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  keyLabel: string;
  keyPlaceholder: string;
  testEndpoint?: string;
  requiresKey: boolean;
}

export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'Use OpenAI GPT models for code generation',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-...',
    testEndpoint: 'https://api.openai.com/v1/models',
    requiresKey: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Use Anthropic Claude models for code generation',
    keyLabel: 'Anthropic API Key',
    keyPlaceholder: 'sk-ant-...',
    testEndpoint: 'https://api.anthropic.com/v1/messages',
    requiresKey: true,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Use Google Gemini models for code generation',
    keyLabel: 'Google AI API Key',
    keyPlaceholder: 'AIza...',
    testEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    requiresKey: true,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Use OpenRouter for access to multiple AI models (GPT, Claude, Llama, etc.)',
    keyLabel: 'OpenRouter API Key',
    keyPlaceholder: 'sk-or-v1-...',
    testEndpoint: 'https://openrouter.ai/api/v1/models',
    requiresKey: true,
  },
  system_default: {
    id: 'system_default',
    name: 'System Default',
    description: 'Use the system default AI service (no API key required)',
    keyLabel: '',
    keyPlaceholder: '',
    requiresKey: false,
  },
};

export interface AIProviderSettings {
  provider: AIProvider;
  apiKey?: string;
  isValid?: boolean;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: AIProvider,
    public code?: string
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}