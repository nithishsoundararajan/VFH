import { AICodeGenerator } from '../ai-code-generator';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    functions: {
      invoke: jest.fn()
    }
  }))
}));

// Mock fetch for AI API calls
global.fetch = jest.fn();

describe('AICodeGenerator', () => {
  let aiCodeGenerator: AICodeGenerator;
  
  beforeEach(() => {
    aiCodeGenerator = new AICodeGenerator();
    jest.clearAllMocks();
  });

  describe('generateCode', () => {
    const mockContext = {
      nodeType: 'n8n-nodes-base.httpRequest',
      nodeName: 'HTTP Request',
      parameters: {
        url: 'https://api.example.com',
        method: 'GET'
      },
      workflowName: 'Test Workflow',
      projectName: 'Test Project'
    };

    it('should generate code using system default when no user settings', async () => {
      // Mock getUserAISettings to return null
      const mockSupabase = require('@/lib/supabase/server').createClient();
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: new Error('No settings found')
      });

      // Mock system default API call
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'export class HttpRequestNode { async execute() { return {}; } }'
            }
          }]
        })
      });

      // Mock environment variable
      process.env.OPENROUTER_API_KEY = 'test-key';

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate HTTP request node', mockContext);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('system_default');
      expect(result.code).toContain('HttpRequestNode');
      expect(result.fallbackUsed).toBe(false);
    });

    it('should use template fallback when all AI providers fail', async () => {
      // Mock getUserAISettings to return system_default
      const mockSupabase = require('@/lib/supabase/server').createClient();
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'system_default', ai_api_key_valid: true },
        error: null
      });

      // Mock failed API calls
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Clear environment variables to force template fallback
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate HTTP request node', mockContext);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('system_default');
      expect(result.fallbackUsed).toBe(true);
      expect(result.code).toContain('Template-generated Node');
      expect(result.code).toContain('HttpRequestNode');
    });

    it('should handle OpenAI provider with valid API key', async () => {
      // Mock getUserAISettings to return OpenAI
      const mockSupabase = require('@/lib/supabase/server').createClient();
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'openai', ai_api_key_valid: true },
        error: null
      });

      // Mock API key decryption
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { apiKey: 'sk-test-key' },
        error: null
      });

      // Mock OpenAI API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'export class HttpRequestNode { async execute(inputData, context) { /* AI generated code */ return { success: true }; } }'
            }
          }]
        })
      });

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate HTTP request node', mockContext);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.fallbackUsed).toBe(false);
      expect(result.code).toContain('AI generated code');
    });

    it('should fallback to system default when user API key is invalid', async () => {
      // Mock getUserAISettings to return OpenAI with invalid key
      const mockSupabase = require('@/lib/supabase/server').createClient();
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'openai', ai_api_key_valid: false },
        error: null
      });

      // Mock failed API key decryption
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Decryption failed')
      });

      // Mock system default API call
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'export class HttpRequestNode { async execute() { return {}; } }'
            }
          }]
        })
      });

      process.env.OPENROUTER_API_KEY = 'system-key';

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate HTTP request node', mockContext);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('system_default');
      expect(result.fallbackUsed).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      // Mock getUserAISettings to return OpenAI
      const mockSupabase = require('@/lib/supabase/server').createClient();
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'openai', ai_api_key_valid: true },
        error: null
      });

      // Mock API key decryption
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { apiKey: 'sk-test-key' },
        error: null
      });

      // Mock API error response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded')
      });

      // Clear system keys to force template fallback
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate HTTP request node', mockContext);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('system_default');
      expect(result.fallbackUsed).toBe(true);
      expect(result.code).toContain('Template-generated Node');
    });
  });

  describe('template generation', () => {
    it('should generate valid template code', async () => {
      const mockContext = {
        nodeType: 'n8n-nodes-base.set',
        nodeName: 'Set Values',
        parameters: {
          values: {
            string: [
              { name: 'test', value: 'value' }
            ]
          }
        }
      };

      // Force template generation by clearing environment variables
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate set node', mockContext);

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.code).toContain('export class SetValuesNode');
      expect(result.code).toContain('async execute(inputData, context)');
      expect(result.code).toContain('processInput');
      expect(result.code).toContain('validateParameters');
    });
  });
});