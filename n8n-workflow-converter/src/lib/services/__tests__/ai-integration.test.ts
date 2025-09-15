/**
 * Integration test for AI code generation in projects API
 * This test verifies that the AI integration works correctly
 */

import { AICodeGenerator } from '../ai-code-generator';

// Mock the Supabase client
const mockSupabaseClient = {
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
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient
}));

describe('AI Integration Tests', () => {
  let aiCodeGenerator: AICodeGenerator;

  beforeEach(() => {
    aiCodeGenerator = new AICodeGenerator();
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  describe('AI Code Generation Flow', () => {
    it('should handle complete AI generation workflow', async () => {
      // Mock user settings - system default
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'system_default', ai_api_key_valid: true },
        error: null
      });

      // Set up system API key
      process.env.OPENROUTER_API_KEY = 'test-system-key';

      // Mock successful AI API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: `
export class HttpRequestNode {
  constructor() {
    this.nodeType = 'n8n-nodes-base.httpRequest';
    this.nodeName = 'HTTP Request';
    this.parameters = {
      url: 'https://api.example.com',
      method: 'GET'
    };
  }

  async execute(inputData, context) {
    try {
      console.log('Executing HTTP Request node...');
      
      const url = this.parameters.url;
      const method = this.parameters.method;
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      return {
        success: true,
        data: data,
        statusCode: response.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('HTTP Request failed:', error);
      throw new Error(\`HTTP Request failed: \${error.message}\`);
    }
  }
}
              `.trim()
            }
          }]
        })
      });

      const context = {
        nodeType: 'n8n-nodes-base.httpRequest',
        nodeName: 'HTTP Request',
        parameters: {
          url: 'https://api.example.com',
          method: 'GET'
        },
        workflowName: 'Test Workflow',
        projectName: 'Test Project'
      };

      const prompt = `Generate a Node.js implementation for HTTP Request node`;

      const result = await aiCodeGenerator.generateCode('user-123', prompt, context);

      // Verify successful generation
      expect(result.success).toBe(true);
      expect(result.provider).toBe('system_default');
      expect(result.fallbackUsed).toBe(false);
      expect(result.code).toContain('HttpRequestNode');
      expect(result.code).toContain('async execute');
      expect(result.code).toContain('fetch(url');

      // Verify API was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-system-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should fallback to template when AI fails', async () => {
      // Mock user settings
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'system_default', ai_api_key_valid: true },
        error: null
      });

      // Mock failed AI API response
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const context = {
        nodeType: 'n8n-nodes-base.set',
        nodeName: 'Set Values',
        parameters: {
          values: {
            string: [{ name: 'test', value: 'value' }]
          }
        }
      };

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate set node', context);

      // Verify fallback was used
      expect(result.success).toBe(true);
      expect(result.provider).toBe('system_default');
      expect(result.fallbackUsed).toBe(true);
      expect(result.code).toContain('Template-generated Node');
      expect(result.code).toContain('SetValuesNode');
      expect(result.code).toContain('async execute(inputData, context)');
    });

    it('should handle user-specific OpenAI provider', async () => {
      // Mock user settings - OpenAI
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'openai', ai_api_key_valid: true },
        error: null
      });

      // Mock API key decryption
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { apiKey: 'sk-user-openai-key' },
        error: null
      });

      // Mock OpenAI API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: `
export class SetNode {
  constructor() {
    this.nodeType = 'n8n-nodes-base.set';
    this.nodeName = 'Set';
  }

  async execute(inputData, context) {
    // OpenAI generated implementation
    const values = this.parameters.values;
    const result = { ...inputData };
    
    if (values.string) {
      values.string.forEach(item => {
        result[item.name] = item.value;
      });
    }
    
    return result;
  }
}
              `.trim()
            }
          }]
        })
      });

      const context = {
        nodeType: 'n8n-nodes-base.set',
        nodeName: 'Set',
        parameters: {
          values: {
            string: [{ name: 'key', value: 'value' }]
          }
        }
      };

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate set node', context);

      // Verify OpenAI was used
      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.fallbackUsed).toBe(false);
      expect(result.code).toContain('OpenAI generated implementation');

      // Verify OpenAI API was called
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-user-openai-key'
          })
        })
      );
    });

    it('should validate generated code structure', async () => {
      // Mock system default with template fallback
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'system_default', ai_api_key_valid: true },
        error: null
      });

      const context = {
        nodeType: 'n8n-nodes-base.httpRequest',
        nodeName: 'HTTP Request Test',
        parameters: { url: 'test' }
      };

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate node', context);

      // Verify code structure
      expect(result.code).toContain('export class');
      expect(result.code).toContain('constructor()');
      expect(result.code).toContain('async execute(inputData, context)');
      expect(result.code).toContain('processInput');
      expect(result.code).toContain('validateParameters');
      
      // Verify proper error handling
      expect(result.code).toContain('try {');
      expect(result.code).toContain('} catch (error) {');
      expect(result.code).toContain('throw new Error');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Mock database error
      mockSupabaseClient.from().select().eq().single.mockRejectedValue(
        new Error('Database connection failed')
      );

      const context = {
        nodeType: 'n8n-nodes-base.test',
        nodeName: 'Test Node',
        parameters: {}
      };

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate node', context);

      // Should fallback to template generation
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.code).toContain('Template-generated Node');
    });

    it('should handle API key decryption failures', async () => {
      // Mock user with OpenAI but decryption fails
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { ai_provider: 'openai', ai_api_key_valid: true },
        error: null
      });

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Decryption failed')
      });

      // Set system key for fallback
      process.env.OPENROUTER_API_KEY = 'system-fallback-key';

      // Mock system API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: 'export class TestNode { async execute() { return {}; } }' }
          }]
        })
      });

      const context = {
        nodeType: 'n8n-nodes-base.test',
        nodeName: 'Test Node',
        parameters: {}
      };

      const result = await aiCodeGenerator.generateCode('user-123', 'Generate node', context);

      // Should fallback to system default
      expect(result.success).toBe(true);
      expect(result.provider).toBe('system_default');
      expect(result.fallbackUsed).toBe(false);
    });
  });
});