/**
 * Configuration validation utilities for workflow projects
 */

export interface EnvironmentVariable {
  key: string;
  value: string;
  description?: string;
  required: boolean;
}

export interface ProjectConfiguration {
  projectName: string;
  description: string;
  outputFormat: 'zip' | 'tar.gz';
  includeDocumentation: boolean;
  includeTests: boolean;
  nodeVersion: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  environmentVariables: EnvironmentVariable[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ConfigurationValidator {
  private static readonly RESERVED_ENV_NAMES = [
    'PATH', 'HOME', 'USER', 'PWD', 'SHELL', 'TERM', 'NODE_ENV'
  ];

  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi
  ];

  /**
   * Sanitize a string by removing potentially dangerous content
   */
  static sanitizeString(input: string, options: {
    maxLength?: number;
    allowHtml?: boolean;
    removeScripts?: boolean;
  } = {}): string {
    const {
      maxLength = 1000,
      allowHtml = false,
      removeScripts = true
    } = options;

    let sanitized = input.trim();

    // Remove dangerous patterns first
    if (removeScripts) {
      this.DANGEROUS_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });
    }

    // Remove HTML tags if not allowed
    if (!allowHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Sanitize environment variable key
   */
  static sanitizeEnvKey(key: string): string {
    let sanitized = key
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_') // Replace invalid chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    
    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }
    
    return sanitized;
  }

  /**
   * Sanitize project name
   */
  static sanitizeProjectName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '')
      .replace(/^[-_]+|[-_]+$/g, '') // Remove leading/trailing hyphens and underscores
      .substring(0, 50);
  }

  /**
   * Validate project configuration
   */
  static validateConfiguration(config: ProjectConfiguration): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate project name
    const projectNameErrors = this.validateProjectName(config.projectName);
    errors.push(...projectNameErrors);

    // Validate description
    if (config.description.length > 500) {
      errors.push({
        field: 'description',
        message: 'Description must be less than 500 characters'
      });
    }

    // Validate environment variables
    const envErrors = this.validateEnvironmentVariables(config.environmentVariables);
    errors.push(...envErrors);

    // Validate output format
    if (!['zip', 'tar.gz'].includes(config.outputFormat)) {
      errors.push({
        field: 'outputFormat',
        message: 'Output format must be either "zip" or "tar.gz"'
      });
    }

    // Validate Node.js version
    if (!['18', '20', '22'].includes(config.nodeVersion)) {
      errors.push({
        field: 'nodeVersion',
        message: 'Node.js version must be 18, 20, or 22'
      });
    }

    // Validate package manager
    if (!['npm', 'yarn', 'pnpm'].includes(config.packageManager)) {
      errors.push({
        field: 'packageManager',
        message: 'Package manager must be npm, yarn, or pnpm'
      });
    }

    return errors;
  }

  /**
   * Validate project name
   */
  private static validateProjectName(name: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const trimmed = name.trim();

    if (!trimmed) {
      errors.push({
        field: 'projectName',
        message: 'Project name is required'
      });
      return errors;
    }

    if (trimmed.length < 3) {
      errors.push({
        field: 'projectName',
        message: 'Project name must be at least 3 characters long'
      });
    }

    if (trimmed.length > 50) {
      errors.push({
        field: 'projectName',
        message: 'Project name must be less than 50 characters'
      });
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
      errors.push({
        field: 'projectName',
        message: 'Project name can only contain letters, numbers, hyphens, and underscores'
      });
    }

    if (/^[-_]|[-_]$/.test(trimmed)) {
      errors.push({
        field: 'projectName',
        message: 'Project name cannot start or end with hyphens or underscores'
      });
    }

    return errors;
  }

  /**
   * Validate environment variables
   */
  private static validateEnvironmentVariables(envVars: EnvironmentVariable[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const seenKeys = new Set<string>();

    envVars.forEach((envVar, index) => {
      const key = envVar.key.trim().toUpperCase();
      const value = envVar.value.trim();

      // Key validation
      if (!key) {
        errors.push({
          field: `envVar_${index}_key`,
          message: 'Environment variable name is required'
        });
      } else {
        if (key.length > 100) {
          errors.push({
            field: `envVar_${index}_key`,
            message: 'Environment variable name must be less than 100 characters'
          });
        }

        if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
          errors.push({
            field: `envVar_${index}_key`,
            message: 'Environment variable name must be uppercase with underscores'
          });
        }

        if (seenKeys.has(key)) {
          errors.push({
            field: `envVar_${index}_key`,
            message: 'Duplicate environment variable name'
          });
        } else {
          seenKeys.add(key);
        }

        if (this.RESERVED_ENV_NAMES.includes(key)) {
          errors.push({
            field: `envVar_${index}_key`,
            message: `"${key}" is a reserved environment variable name`
          });
        }
      }

      // Value validation
      if (envVar.required && !value) {
        errors.push({
          field: `envVar_${index}_value`,
          message: 'Value is required for this environment variable'
        });
      }

      if (value.length > 1000) {
        errors.push({
          field: `envVar_${index}_value`,
          message: 'Environment variable value must be less than 1000 characters'
        });
      }

      // Security checks for sensitive values
      if (value && (key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY'))) {
        if (value.length < 8) {
          errors.push({
            field: `envVar_${index}_value`,
            message: 'Sensitive values should be at least 8 characters long'
          });
        }
      }

      // Description validation
      if (envVar.description && envVar.description.length > 200) {
        errors.push({
          field: `envVar_${index}_description`,
          message: 'Description must be less than 200 characters'
        });
      }
    });

    return errors;
  }

  /**
   * Sanitize entire configuration object
   */
  static sanitizeConfiguration(config: ProjectConfiguration): ProjectConfiguration {
    return {
      projectName: this.sanitizeProjectName(config.projectName),
      description: this.sanitizeString(config.description, { maxLength: 500 }),
      outputFormat: config.outputFormat,
      includeDocumentation: Boolean(config.includeDocumentation),
      includeTests: Boolean(config.includeTests),
      nodeVersion: config.nodeVersion,
      packageManager: config.packageManager,
      environmentVariables: config.environmentVariables
        .filter(env => env.key.trim()) // Remove empty keys
        .map(env => ({
          key: this.sanitizeEnvKey(env.key),
          value: env.value.trim(),
          description: env.description ? this.sanitizeString(env.description, { maxLength: 200 }) : '',
          required: Boolean(env.required)
        }))
    };
  }
}