import { ConfigurationValidator } from '../configuration';
import type { ProjectConfiguration } from '../configuration';

describe('ConfigurationValidator', () => {
  const validConfiguration: ProjectConfiguration = {
    projectName: 'test-project',
    description: 'A test project',
    outputFormat: 'zip',
    includeDocumentation: true,
    includeTests: false,
    nodeVersion: '20',
    packageManager: 'npm',
    environmentVariables: [
      {
        key: 'API_KEY',
        value: 'test-api-key',
        description: 'API key for external service',
        required: true
      }
    ]
  };

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = ConfigurationValidator.sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should limit string length', () => {
      const input = 'a'.repeat(1500);
      const result = ConfigurationValidator.sanitizeString(input, { maxLength: 100 });
      expect(result.length).toBe(100);
    });

    it('should remove dangerous patterns', () => {
      const input = 'javascript:alert("xss")';
      const result = ConfigurationValidator.sanitizeString(input);
      expect(result).toBe('alert("xss")');
    });
  });

  describe('sanitizeEnvKey', () => {
    it('should convert to uppercase', () => {
      const result = ConfigurationValidator.sanitizeEnvKey('');
      expect(result).toBe('API_KEY');
    });

    it('should remove invalid characters', () => {
      const result = ConfigurationValidator.sanitizeEnvKey('api-key@test');
      expect(result).toBe('API_KEY_TEST');
    });

    it('should handle keys starting with numbers', () => {
      const result = ConfigurationValidator.sanitizeEnvKey('123_key');
      expect(result).toBe('_123_KEY');
    });
  });

  describe('sanitizeProjectName', () => {
    it('should convert to lowercase', () => {
      const result = ConfigurationValidator.sanitizeProjectName('TEST-PROJECT');
      expect(result).toBe('test-project');
    });

    it('should remove invalid characters', () => {
      const result = ConfigurationValidator.sanitizeProjectName('test@project!');
      expect(result).toBe('testproject');
    });

    it('should remove leading/trailing hyphens', () => {
      const result = ConfigurationValidator.sanitizeProjectName('-test-project-');
      expect(result).toBe('test-project');
    });

    it('should limit length', () => {
      const longName = 'a'.repeat(100);
      const result = ConfigurationValidator.sanitizeProjectName(longName);
      expect(result.length).toBe(50);
    });
  });

  describe('validateConfiguration', () => {
    it('should pass validation for valid configuration', () => {
      const errors = ConfigurationValidator.validateConfiguration(validConfiguration);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for empty project name', () => {
      const config = { ...validConfiguration, projectName: '' };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'projectName',
        message: 'Project name is required'
      });
    });

    it('should fail validation for short project name', () => {
      const config = { ...validConfiguration, projectName: 'ab' };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'projectName',
        message: 'Project name must be at least 3 characters long'
      });
    });

    it('should fail validation for invalid project name characters', () => {
      const config = { ...validConfiguration, projectName: 'test@project' };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'projectName',
        message: 'Project name can only contain letters, numbers, hyphens, and underscores'
      });
    });

    it('should fail validation for long description', () => {
      const config = { ...validConfiguration, description: 'a'.repeat(600) };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'description',
        message: 'Description must be less than 500 characters'
      });
    });

    it('should fail validation for invalid output format', () => {
      const config = { ...validConfiguration, outputFormat: 'invalid' as any };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'outputFormat',
        message: 'Output format must be either "zip" or "tar.gz"'
      });
    });

    it('should fail validation for invalid Node.js version', () => {
      const config = { ...validConfiguration, nodeVersion: '16' };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'nodeVersion',
        message: 'Node.js version must be 18, 20, or 22'
      });
    });

    it('should fail validation for invalid package manager', () => {
      const config = { ...validConfiguration, packageManager: 'invalid' as any };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'packageManager',
        message: 'Package manager must be npm, yarn, or pnpm'
      });
    });

    it('should fail validation for duplicate environment variable keys', () => {
      const config = {
        ...validConfiguration,
        environmentVariables: [
          { key: 'API_KEY', value: 'value1', required: false },
          { key: 'API_KEY', value: 'value2', required: false }
        ]
      };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'envVar_1_key',
        message: 'Duplicate environment variable name'
      });
    });

    it('should fail validation for reserved environment variable names', () => {
      const config = {
        ...validConfiguration,
        environmentVariables: [
          { key: 'PATH', value: '/usr/bin', required: false }
        ]
      };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'envVar_0_key',
        message: '"PATH" is a reserved environment variable name'
      });
    });

    it('should fail validation for required environment variable without value', () => {
      const config = {
        ...validConfiguration,
        environmentVariables: [
          { key: 'REQUIRED_KEY', value: '', required: true }
        ]
      };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'envVar_0_value',
        message: 'Value is required for this environment variable'
      });
    });

    it('should fail validation for short sensitive values', () => {
      const config = {
        ...validConfiguration,
        environmentVariables: [
          { key: 'API_SECRET', value: '123', required: true }
        ]
      };
      const errors = ConfigurationValidator.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'envVar_0_value',
        message: 'Sensitive values should be at least 8 characters long'
      });
    });
  });

  describe('sanitizeConfiguration', () => {
    it('should sanitize all fields', () => {
      const dirtyConfig: ProjectConfiguration = {
        projectName: 'TEST-PROJECT@',
        description: '<script>alert("xss")</script>Clean description',
        outputFormat: 'zip',
        includeDocumentation: true,
        includeTests: false,
        nodeVersion: '20',
        packageManager: 'npm',
        environmentVariables: [
          {
            key: 'api_key',
            value: '  test-value  ',
            description: '<b>API key</b>',
            required: true
          },
          {
            key: '',
            value: 'should-be-removed',
            required: false
          }
        ]
      };

      const result = ConfigurationValidator.sanitizeConfiguration(dirtyConfig);

      expect(result.projectName).toBe('test-project');
      expect(result.description).toBe('Clean description');
      expect(result.environmentVariables).toHaveLength(1);
      expect(result.environmentVariables[0].key).toBe('API_KEY');
      expect(result.environmentVariables[0].value).toBe('test-value');
      expect(result.environmentVariables[0].description).toBe('API key');
    });
  });
});