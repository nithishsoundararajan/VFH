import { InputValidator } from '../input-validator';

describe('InputValidator', () => {
  describe('sanitizeFileName', () => {
    it('should remove dangerous characters', () => {
      const dangerous = '../../../etc/passwd';
      const sanitized = InputValidator.sanitizeFileName(dangerous);
      expect(sanitized).toBe('______etc_passwd');
    });

    it('should handle null bytes and control characters', () => {
      const malicious = 'file\x00name\x1f.txt';
      const sanitized = InputValidator.sanitizeFileName(malicious);
      expect(sanitized).toBe('filename.txt');
    });

    it('should limit file name length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = InputValidator.sanitizeFileName(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.txt')).toBe(true);
    });

    it('should handle empty file names', () => {
      const sanitized = InputValidator.sanitizeFileName('');
      expect(sanitized).toBe('unnamed_file');
    });
  });

  describe('validateWorkflowJson', () => {
    it('should validate correct n8n workflow structure', () => {
      const validWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'HttpRequest',
            typeVersion: 1,
            parameters: { url: 'https://api.example.com' }
          }
        ],
        connections: {}
      };

      const result = InputValidator.validateWorkflowJson(JSON.stringify(validWorkflow));
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid JSON', () => {
      const result = InputValidator.validateWorkflowJson('invalid json');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON format');
    });

    it('should reject missing nodes array', () => {
      const invalidWorkflow = { connections: {} };
      const result = InputValidator.validateWorkflowJson(JSON.stringify(invalidWorkflow));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing or invalid nodes array');
    });

    it('should sanitize node parameters', () => {
      const workflowWithScript = {
        nodes: [
          {
            id: 'node1',
            type: 'HttpRequest',
            typeVersion: 1,
            parameters: {
              url: 'https://api.example.com',
              malicious: '<script>alert("xss")</script>'
            }
          }
        ],
        connections: {}
      };

      const result = InputValidator.validateWorkflowJson(JSON.stringify(workflowWithScript));
      expect(result.valid).toBe(true);
      expect(result.data.nodes[0].parameters.malicious).not.toContain('<script>');
    });

    it('should reject oversized JSON', () => {
      const largeJson = JSON.stringify({ data: 'x'.repeat(11 * 1024 * 1024) });
      const result = InputValidator.validateWorkflowJson(largeJson);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('JSON file too large');
    });
  });

  describe('validateApiKey', () => {
    it('should validate OpenAI API keys', () => {
      const validKey = 'sk-' + 'a'.repeat(48);
      expect(InputValidator.validateApiKey(validKey, 'openai')).toBe(true);
      
      const invalidKey = 'invalid-key';
      expect(InputValidator.validateApiKey(invalidKey, 'openai')).toBe(false);
    });

    it('should validate Anthropic API keys', () => {
      const validKey = 'sk-ant-' + 'a'.repeat(95);
      expect(InputValidator.validateApiKey(validKey, 'anthropic')).toBe(true);
      
      const invalidKey = 'sk-ant-short';
      expect(InputValidator.validateApiKey(invalidKey, 'anthropic')).toBe(false);
    });

    it('should validate Google API keys', () => {
      const validKey = 'a'.repeat(39);
      expect(InputValidator.validateApiKey(validKey, 'google')).toBe(true);
      
      const invalidKey = 'short';
      expect(InputValidator.validateApiKey(invalidKey, 'google')).toBe(false);
    });

    it('should handle unknown providers with generic validation', () => {
      const validKey = 'a'.repeat(25);
      expect(InputValidator.validateApiKey(validKey, 'unknown')).toBe(true);
      
      const invalidKey = 'short';
      expect(InputValidator.validateApiKey(invalidKey, 'unknown')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should allow valid HTTP/HTTPS URLs', () => {
      expect(InputValidator.validateUrl('https://api.example.com')).toBe(true);
      expect(InputValidator.validateUrl('http://api.example.com')).toBe(true);
    });

    it('should reject non-HTTP protocols', () => {
      expect(InputValidator.validateUrl('ftp://example.com')).toBe(false);
      expect(InputValidator.validateUrl('file:///etc/passwd')).toBe(false);
      expect(InputValidator.validateUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject private IP addresses', () => {
      expect(InputValidator.validateUrl('http://192.168.1.1')).toBe(false);
      expect(InputValidator.validateUrl('http://10.0.0.1')).toBe(false);
      expect(InputValidator.validateUrl('http://172.16.0.1')).toBe(false);
      expect(InputValidator.validateUrl('http://127.0.0.1')).toBe(false);
    });

    it('should reject localhost', () => {
      expect(InputValidator.validateUrl('http://localhost')).toBe(false);
      expect(InputValidator.validateUrl('https://localhost:3000')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(InputValidator.validateUrl('not-a-url')).toBe(false);
      expect(InputValidator.validateUrl('')).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove all HTML tags', () => {
      const html = '<div>Hello <script>alert("xss")</script> World</div>';
      const sanitized = InputValidator.sanitizeHtml(html);
      expect(sanitized).toBe('Hello  World');
    });

    it('should handle empty input', () => {
      expect(InputValidator.sanitizeHtml('')).toBe('');
    });
  });

  describe('validateEnvVarName', () => {
    it('should validate correct environment variable names', () => {
      expect(InputValidator.validateEnvVarName('API_KEY')).toBe(true);
      expect(InputValidator.validateEnvVarName('DATABASE_URL')).toBe(true);
      expect(InputValidator.validateEnvVarName('NODE_ENV')).toBe(true);
    });

    it('should reject invalid environment variable names', () => {
      expect(InputValidator.validateEnvVarName('api_key')).toBe(false); // lowercase
      expect(InputValidator.validateEnvVarName('123_KEY')).toBe(false); // starts with number
      expect(InputValidator.validateEnvVarName('API-KEY')).toBe(false); // contains dash
      expect(InputValidator.validateEnvVarName('')).toBe(false); // empty
    });
  });

  describe('sanitizeEnvVarValue', () => {
    it('should remove control characters', () => {
      const value = 'value\x00with\x1fnull\x02bytes';
      const sanitized = InputValidator.sanitizeEnvVarValue(value);
      expect(sanitized).toBe('valuewithnullbytes');
    });

    it('should preserve normal characters', () => {
      const value = 'normal-value_123';
      const sanitized = InputValidator.sanitizeEnvVarValue(value);
      expect(sanitized).toBe(value);
    });
  });
});