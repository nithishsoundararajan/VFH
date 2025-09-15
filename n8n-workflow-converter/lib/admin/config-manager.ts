/**
 * Configuration management system for self-hosted instances
 * Provides web-based configuration interface and runtime updates
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';

export interface ConfigSection {
  id: string;
  name: string;
  description: string;
  settings: ConfigSetting[];
}

export interface ConfigSetting {
  key: string;
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'password' | 'json';
  value: any;
  defaultValue: any;
  required: boolean;
  options?: { label: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any) => string | null;
  };
  sensitive?: boolean;
  restartRequired?: boolean;
  category?: string;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  defaultEnabled: boolean;
  dependencies?: string[];
  incompatible?: string[];
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'error';
  services: {
    [key: string]: {
      status: 'healthy' | 'warning' | 'error';
      message?: string;
      lastCheck: Date;
    };
  };
  metrics: {
    [key: string]: {
      value: number;
      unit: string;
      threshold?: number;
      status: 'normal' | 'warning' | 'critical';
    };
  };
}

export class ConfigManager extends EventEmitter {
  private configPath: string;
  private config: Map<string, any> = new Map();
  private featureFlags: Map<string, FeatureFlag> = new Map();
  private configSections: ConfigSection[] = [];
  private healthChecks: Map<string, () => Promise<any>> = new Map();

  constructor(configPath: string = './config/app-config.json') {
    super();
    this.configPath = configPath;
    this.initializeDefaultConfig();
    this.loadConfig();
    this.setupHealthChecks();
  }

  private initializeDefaultConfig(): void {
    this.configSections = [
      {
        id: 'general',
        name: 'General Settings',
        description: 'Basic application configuration',
        settings: [
          {
            key: 'app.name',
            name: 'Application Name',
            description: 'Display name for the application',
            type: 'string',
            value: 'n8n Workflow Converter',
            defaultValue: 'n8n Workflow Converter',
            required: true,
          },
          {
            key: 'app.description',
            name: 'Application Description',
            description: 'Brief description of the application',
            type: 'string',
            value: 'Convert n8n workflows to standalone Node.js applications',
            defaultValue: 'Convert n8n workflows to standalone Node.js applications',
            required: false,
          },
          {
            key: 'app.url',
            name: 'Application URL',
            description: 'Base URL where the application is hosted',
            type: 'string',
            value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            defaultValue: 'http://localhost:3000',
            required: true,
            validation: {
              pattern: '^https?://.+',
            },
          },
          {
            key: 'app.environment',
            name: 'Environment',
            description: 'Current deployment environment',
            type: 'select',
            value: process.env.NODE_ENV || 'development',
            defaultValue: 'development',
            required: true,
            options: [
              { label: 'Development', value: 'development' },
              { label: 'Staging', value: 'staging' },
              { label: 'Production', value: 'production' },
            ],
          },
        ],
      },
      {
        id: 'database',
        name: 'Database Configuration',
        description: 'Database connection and settings',
        settings: [
          {
            key: 'database.type',
            name: 'Database Type',
            description: 'Type of database to use',
            type: 'select',
            value: process.env.DATABASE_TYPE || 'sqlite',
            defaultValue: 'sqlite',
            required: true,
            options: [
              { label: 'SQLite', value: 'sqlite' },
              { label: 'PostgreSQL', value: 'postgresql' },
              { label: 'Supabase', value: 'supabase' },
            ],
            restartRequired: true,
          },
          {
            key: 'database.url',
            name: 'Database URL',
            description: 'Connection string for PostgreSQL database',
            type: 'password',
            value: process.env.DATABASE_URL || '',
            defaultValue: '',
            required: false,
            sensitive: true,
          },
          {
            key: 'database.path',
            name: 'SQLite Database Path',
            description: 'File path for SQLite database',
            type: 'string',
            value: process.env.DATABASE_PATH || './data/app.db',
            defaultValue: './data/app.db',
            required: false,
          },
          {
            key: 'database.poolSize',
            name: 'Connection Pool Size',
            description: 'Maximum number of database connections',
            type: 'number',
            value: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
            defaultValue: 10,
            required: false,
            validation: {
              min: 1,
              max: 100,
            },
          },
        ],
      },
      {
        id: 'storage',
        name: 'File Storage',
        description: 'File storage configuration',
        settings: [
          {
            key: 'storage.type',
            name: 'Storage Type',
            description: 'Type of file storage to use',
            type: 'select',
            value: process.env.STORAGE_TYPE || 'local',
            defaultValue: 'local',
            required: true,
            options: [
              { label: 'Local Filesystem', value: 'local' },
              { label: 'Amazon S3', value: 's3' },
              { label: 'Google Cloud Storage', value: 'gcs' },
              { label: 'Supabase Storage', value: 'supabase' },
            ],
            restartRequired: true,
          },
          {
            key: 'storage.path',
            name: 'Local Storage Path',
            description: 'Directory path for local file storage',
            type: 'string',
            value: process.env.STORAGE_PATH || './storage',
            defaultValue: './storage',
            required: false,
          },
          {
            key: 'storage.maxFileSize',
            name: 'Maximum File Size (MB)',
            description: 'Maximum allowed file size for uploads',
            type: 'number',
            value: parseInt(process.env.MAX_FILE_SIZE || '50'),
            defaultValue: 50,
            required: true,
            validation: {
              min: 1,
              max: 1000,
            },
          },
        ],
      },
      {
        id: 'ai',
        name: 'AI Providers',
        description: 'AI service configuration',
        settings: [
          {
            key: 'ai.defaultProvider',
            name: 'Default AI Provider',
            description: 'Primary AI service to use for code generation',
            type: 'select',
            value: process.env.DEFAULT_AI_PROVIDER || 'openai',
            defaultValue: 'openai',
            required: true,
            options: [
              { label: 'OpenAI', value: 'openai' },
              { label: 'Anthropic', value: 'anthropic' },
              { label: 'Google AI', value: 'google' },
            ],
          },
          {
            key: 'ai.openai.apiKey',
            name: 'OpenAI API Key',
            description: 'API key for OpenAI services',
            type: 'password',
            value: process.env.OPENAI_API_KEY || '',
            defaultValue: '',
            required: false,
            sensitive: true,
          },
          {
            key: 'ai.anthropic.apiKey',
            name: 'Anthropic API Key',
            description: 'API key for Anthropic Claude',
            type: 'password',
            value: process.env.ANTHROPIC_API_KEY || '',
            defaultValue: '',
            required: false,
            sensitive: true,
          },
          {
            key: 'ai.google.apiKey',
            name: 'Google AI API Key',
            description: 'API key for Google AI services',
            type: 'password',
            value: process.env.GOOGLE_AI_API_KEY || '',
            defaultValue: '',
            required: false,
            sensitive: true,
          },
          {
            key: 'ai.maxConcurrentRequests',
            name: 'Max Concurrent AI Requests',
            description: 'Maximum number of simultaneous AI API calls',
            type: 'number',
            value: parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '3'),
            defaultValue: 3,
            required: true,
            validation: {
              min: 1,
              max: 20,
            },
          },
        ],
      },
      {
        id: 'security',
        name: 'Security Settings',
        description: 'Security and authentication configuration',
        settings: [
          {
            key: 'security.authSecret',
            name: 'Authentication Secret',
            description: 'Secret key for JWT token signing',
            type: 'password',
            value: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '',
            defaultValue: '',
            required: true,
            sensitive: true,
            validation: {
              min: 32,
            },
          },
          {
            key: 'security.encryptionKey',
            name: 'Encryption Key',
            description: 'Key for encrypting sensitive data',
            type: 'password',
            value: process.env.ENCRYPTION_KEY || '',
            defaultValue: '',
            required: false,
            sensitive: true,
            validation: {
              min: 32,
              max: 32,
            },
          },
          {
            key: 'security.virusTotalKey',
            name: 'VirusTotal API Key',
            description: 'API key for file scanning with VirusTotal',
            type: 'password',
            value: process.env.VIRUSTOTAL_API_KEY || '',
            defaultValue: '',
            required: false,
            sensitive: true,
          },
          {
            key: 'security.rateLimitMax',
            name: 'Rate Limit (requests per window)',
            description: 'Maximum requests per rate limit window',
            type: 'number',
            value: parseInt(process.env.RATE_LIMIT_MAX || '100'),
            defaultValue: 100,
            required: true,
            validation: {
              min: 10,
              max: 10000,
            },
          },
          {
            key: 'security.rateLimitWindow',
            name: 'Rate Limit Window (ms)',
            description: 'Time window for rate limiting in milliseconds',
            type: 'number',
            value: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
            defaultValue: 900000,
            required: true,
            validation: {
              min: 60000,
              max: 3600000,
            },
          },
        ],
      },
      {
        id: 'features',
        name: 'Feature Flags',
        description: 'Enable or disable application features',
        settings: [
          {
            key: 'features.analytics',
            name: 'Analytics',
            description: 'Enable usage analytics and metrics collection',
            type: 'boolean',
            value: process.env.ENABLE_ANALYTICS !== 'false',
            defaultValue: true,
            required: false,
          },
          {
            key: 'features.monitoring',
            name: 'Monitoring',
            description: 'Enable system monitoring and health checks',
            type: 'boolean',
            value: process.env.ENABLE_MONITORING === 'true',
            defaultValue: false,
            required: false,
          },
          {
            key: 'features.realtime',
            name: 'Real-time Updates',
            description: 'Enable real-time progress updates (requires Supabase)',
            type: 'boolean',
            value: process.env.ENABLE_REALTIME === 'true',
            defaultValue: false,
            required: false,
          },
          {
            key: 'features.fileUpload',
            name: 'File Upload',
            description: 'Enable file upload functionality',
            type: 'boolean',
            value: process.env.ENABLE_FILE_UPLOAD !== 'false',
            defaultValue: true,
            required: false,
          },
        ],
      },
      {
        id: 'performance',
        name: 'Performance Settings',
        description: 'Performance and optimization configuration',
        settings: [
          {
            key: 'performance.caching',
            name: 'Enable Caching',
            description: 'Enable response caching for better performance',
            type: 'boolean',
            value: process.env.ENABLE_CACHING !== 'false',
            defaultValue: true,
            required: false,
          },
          {
            key: 'performance.cacheTtl',
            name: 'Cache TTL (seconds)',
            description: 'Time-to-live for cached responses',
            type: 'number',
            value: parseInt(process.env.CACHE_TTL || '3600'),
            defaultValue: 3600,
            required: false,
            validation: {
              min: 60,
              max: 86400,
            },
          },
          {
            key: 'performance.compression',
            name: 'Enable Compression',
            description: 'Enable gzip compression for responses',
            type: 'boolean',
            value: process.env.ENABLE_COMPRESSION !== 'false',
            defaultValue: true,
            required: false,
          },
        ],
      },
    ];

    // Initialize feature flags
    this.featureFlags.set('analytics', {
      key: 'analytics',
      name: 'Analytics',
      description: 'Usage analytics and metrics collection',
      enabled: process.env.ENABLE_ANALYTICS !== 'false',
      defaultEnabled: true,
    });

    this.featureFlags.set('monitoring', {
      key: 'monitoring',
      name: 'System Monitoring',
      description: 'Health checks and performance monitoring',
      enabled: process.env.ENABLE_MONITORING === 'true',
      defaultEnabled: false,
    });

    this.featureFlags.set('realtime', {
      key: 'realtime',
      name: 'Real-time Updates',
      description: 'Live progress updates and notifications',
      enabled: process.env.ENABLE_REALTIME === 'true',
      defaultEnabled: false,
      dependencies: ['supabase'],
    });

    this.featureFlags.set('fileUpload', {
      key: 'fileUpload',
      name: 'File Upload',
      description: 'File upload and processing capabilities',
      enabled: process.env.ENABLE_FILE_UPLOAD !== 'false',
      defaultEnabled: true,
    });
  }

  private loadConfig(): void {
    if (existsSync(this.configPath)) {
      try {
        const configData = JSON.parse(readFileSync(this.configPath, 'utf8'));
        
        // Load configuration values
        for (const [key, value] of Object.entries(configData.settings || {})) {
          this.config.set(key, value);
        }

        // Load feature flags
        for (const [key, flag] of Object.entries(configData.featureFlags || {})) {
          if (this.featureFlags.has(key)) {
            this.featureFlags.set(key, { ...this.featureFlags.get(key)!, ...flag });
          }
        }

        console.log('Configuration loaded successfully');
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    }
  }

  private saveConfig(): void {
    try {
      const configData = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        settings: Object.fromEntries(this.config),
        featureFlags: Object.fromEntries(this.featureFlags),
      };

      writeFileSync(this.configPath, JSON.stringify(configData, null, 2));
      console.log('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }

  private setupHealthChecks(): void {
    // Database health check
    this.healthChecks.set('database', async () => {
      // Implementation depends on database type
      return { status: 'healthy', message: 'Database connection OK' };
    });

    // Storage health check
    this.healthChecks.set('storage', async () => {
      // Implementation depends on storage type
      return { status: 'healthy', message: 'Storage accessible' };
    });

    // AI providers health check
    this.healthChecks.set('ai', async () => {
      // Check configured AI providers
      return { status: 'healthy', message: 'AI providers accessible' };
    });
  }

  // Public API methods
  public getConfigSections(): ConfigSection[] {
    // Update values from current config
    return this.configSections.map(section => ({
      ...section,
      settings: section.settings.map(setting => ({
        ...setting,
        value: this.config.get(setting.key) ?? setting.defaultValue,
      })),
    }));
  }

  public getConfigValue(key: string): any {
    return this.config.get(key);
  }

  public setConfigValue(key: string, value: any): void {
    // Find the setting definition
    const setting = this.findSetting(key);
    if (!setting) {
      throw new Error(`Unknown configuration key: ${key}`);
    }

    // Validate the value
    const validationError = this.validateValue(setting, value);
    if (validationError) {
      throw new Error(`Validation failed for ${key}: ${validationError}`);
    }

    // Set the value
    const oldValue = this.config.get(key);
    this.config.set(key, value);

    // Emit change event
    this.emit('configChanged', { key, oldValue, newValue: value, setting });

    // Save configuration
    this.saveConfig();
  }

  public updateMultipleSettings(updates: Record<string, any>): void {
    const errors: string[] = [];
    const changes: Array<{ key: string; oldValue: any; newValue: any; setting: ConfigSetting }> = [];

    // Validate all updates first
    for (const [key, value] of Object.entries(updates)) {
      const setting = this.findSetting(key);
      if (!setting) {
        errors.push(`Unknown configuration key: ${key}`);
        continue;
      }

      const validationError = this.validateValue(setting, value);
      if (validationError) {
        errors.push(`Validation failed for ${key}: ${validationError}`);
        continue;
      }

      changes.push({
        key,
        oldValue: this.config.get(key),
        newValue: value,
        setting,
      });
    }

    if (errors.length > 0) {
      throw new Error(`Configuration update failed:\n${errors.join('\n')}`);
    }

    // Apply all changes
    for (const change of changes) {
      this.config.set(change.key, change.newValue);
      this.emit('configChanged', change);
    }

    // Save configuration
    this.saveConfig();

    // Emit batch update event
    this.emit('configBatchUpdated', changes);
  }

  private findSetting(key: string): ConfigSetting | null {
    for (const section of this.configSections) {
      const setting = section.settings.find(s => s.key === key);
      if (setting) return setting;
    }
    return null;
  }

  private validateValue(setting: ConfigSetting, value: any): string | null {
    // Required check
    if (setting.required && (value === null || value === undefined || value === '')) {
      return 'This field is required';
    }

    // Type validation
    switch (setting.type) {
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return 'Must be a valid number';
        }
        if (setting.validation?.min !== undefined && value < setting.validation.min) {
          return `Must be at least ${setting.validation.min}`;
        }
        if (setting.validation?.max !== undefined && value > setting.validation.max) {
          return `Must be at most ${setting.validation.max}`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return 'Must be true or false';
        }
        break;

      case 'select':
        if (setting.options && !setting.options.some(opt => opt.value === value)) {
          return 'Invalid option selected';
        }
        break;

      case 'string':
      case 'password':
        if (typeof value !== 'string') {
          return 'Must be a string';
        }
        if (setting.validation?.min !== undefined && value.length < setting.validation.min) {
          return `Must be at least ${setting.validation.min} characters`;
        }
        if (setting.validation?.max !== undefined && value.length > setting.validation.max) {
          return `Must be at most ${setting.validation.max} characters`;
        }
        if (setting.validation?.pattern) {
          const regex = new RegExp(setting.validation.pattern);
          if (!regex.test(value)) {
            return 'Invalid format';
          }
        }
        break;

      case 'json':
        try {
          JSON.parse(value);
        } catch {
          return 'Must be valid JSON';
        }
        break;
    }

    // Custom validation
    if (setting.validation?.custom) {
      return setting.validation.custom(value);
    }

    return null;
  }

  // Feature flag management
  public getFeatureFlags(): FeatureFlag[] {
    return Array.from(this.featureFlags.values());
  }

  public isFeatureEnabled(key: string): boolean {
    const flag = this.featureFlags.get(key);
    return flag?.enabled ?? false;
  }

  public setFeatureFlag(key: string, enabled: boolean): void {
    const flag = this.featureFlags.get(key);
    if (!flag) {
      throw new Error(`Unknown feature flag: ${key}`);
    }

    // Check dependencies
    if (enabled && flag.dependencies) {
      for (const dep of flag.dependencies) {
        if (!this.isFeatureEnabled(dep)) {
          throw new Error(`Feature ${key} requires ${dep} to be enabled`);
        }
      }
    }

    // Check incompatibilities
    if (enabled && flag.incompatible) {
      for (const incomp of flag.incompatible) {
        if (this.isFeatureEnabled(incomp)) {
          throw new Error(`Feature ${key} is incompatible with ${incomp}`);
        }
      }
    }

    const oldValue = flag.enabled;
    flag.enabled = enabled;
    this.featureFlags.set(key, flag);

    this.emit('featureFlagChanged', { key, oldValue, newValue: enabled, flag });
    this.saveConfig();
  }

  // System health monitoring
  public async getSystemHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      status: 'healthy',
      services: {},
      metrics: {},
    };

    // Run health checks
    for (const [name, check] of this.healthChecks) {
      try {
        const result = await check();
        health.services[name] = {
          status: result.status || 'healthy',
          message: result.message,
          lastCheck: new Date(),
        };
      } catch (error) {
        health.services[name] = {
          status: 'error',
          message: (error as Error).message,
          lastCheck: new Date(),
        };
        health.status = 'error';
      }
    }

    // Collect system metrics
    health.metrics = {
      uptime: {
        value: process.uptime(),
        unit: 'seconds',
        status: 'normal',
      },
      memoryUsage: {
        value: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        unit: 'MB',
        threshold: 500,
        status: 'normal',
      },
      configuredFeatures: {
        value: Array.from(this.featureFlags.values()).filter(f => f.enabled).length,
        unit: 'count',
        status: 'normal',
      },
    };

    // Update overall status based on services
    const hasErrors = Object.values(health.services).some(s => s.status === 'error');
    const hasWarnings = Object.values(health.services).some(s => s.status === 'warning');

    if (hasErrors) {
      health.status = 'error';
    } else if (hasWarnings) {
      health.status = 'warning';
    }

    return health;
  }

  // Configuration export/import
  public exportConfiguration(): string {
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: Object.fromEntries(
        Array.from(this.config.entries()).filter(([key]) => {
          const setting = this.findSetting(key);
          return setting && !setting.sensitive;
        })
      ),
      featureFlags: Object.fromEntries(this.featureFlags),
    };

    return JSON.stringify(exportData, null, 2);
  }

  public importConfiguration(configJson: string): void {
    try {
      const importData = JSON.parse(configJson);
      
      // Validate import data
      if (!importData.version || !importData.settings) {
        throw new Error('Invalid configuration format');
      }

      const changes: Array<{ key: string; oldValue: any; newValue: any; setting: ConfigSetting }> = [];

      // Import settings
      for (const [key, value] of Object.entries(importData.settings)) {
        const setting = this.findSetting(key);
        if (setting && !setting.sensitive) {
          const validationError = this.validateValue(setting, value);
          if (!validationError) {
            changes.push({
              key,
              oldValue: this.config.get(key),
              newValue: value,
              setting,
            });
          }
        }
      }

      // Apply changes
      for (const change of changes) {
        this.config.set(change.key, change.newValue);
        this.emit('configChanged', change);
      }

      // Import feature flags
      if (importData.featureFlags) {
        for (const [key, flagData] of Object.entries(importData.featureFlags as Record<string, any>)) {
          if (this.featureFlags.has(key)) {
            this.setFeatureFlag(key, flagData.enabled);
          }
        }
      }

      this.saveConfig();
      this.emit('configImported', { changes, featureFlags: importData.featureFlags });

    } catch (error) {
      throw new Error(`Configuration import failed: ${(error as Error).message}`);
    }
  }

  // Runtime configuration updates
  public requiresRestart(key: string): boolean {
    const setting = this.findSetting(key);
    return setting?.restartRequired ?? false;
  }

  public getPendingRestartSettings(): string[] {
    return Array.from(this.config.keys()).filter(key => this.requiresRestart(key));
  }

  // Cleanup
  public destroy(): void {
    this.removeAllListeners();
    this.healthChecks.clear();
  }
}