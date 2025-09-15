/**
 * Configuration mode switcher for n8n Workflow Converter
 * Handles switching between Supabase and standalone modes
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type DeploymentMode = 'supabase' | 'standalone';

export interface ModeConfig {
  mode: DeploymentMode;
  database: {
    type: 'supabase' | 'postgresql' | 'sqlite';
    config: Record<string, any>;
  };
  storage: {
    type: 'supabase' | 'local' | 's3' | 'gcs';
    config: Record<string, any>;
  };
  auth: {
    type: 'supabase' | 'simple' | 'jwt' | 'oauth';
    config: Record<string, any>;
  };
  features: {
    realtime: boolean;
    analytics: boolean;
    monitoring: boolean;
  };
}

export class ModeSwitcher {
  private configPath: string;
  private currentConfig: ModeConfig | null = null;

  constructor(configPath: string = './.mode-config.json') {
    this.configPath = configPath;
    this.loadConfig();
  }

  private loadConfig(): void {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf8');
        this.currentConfig = JSON.parse(content);
      } catch (error) {
        console.warn('Failed to load mode configuration, using defaults');
        this.currentConfig = null;
      }
    }
  }

  private saveConfig(): void {
    if (this.currentConfig) {
      writeFileSync(this.configPath, JSON.stringify(this.currentConfig, null, 2));
    }
  }

  public detectCurrentMode(): DeploymentMode {
    // Check environment variables first
    if (process.env.STANDALONE_MODE === 'true') {
      return 'standalone';
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return 'supabase';
    }

    // Check configuration file
    if (this.currentConfig) {
      return this.currentConfig.mode;
    }

    // Check for standalone indicators
    if (process.env.DATABASE_TYPE === 'sqlite' || 
        process.env.STORAGE_TYPE === 'local' ||
        process.env.AUTH_TYPE === 'simple') {
      return 'standalone';
    }

    // Default to Supabase mode
    return 'supabase';
  }

  public getCurrentConfig(): ModeConfig {
    const mode = this.detectCurrentMode();

    if (mode === 'standalone') {
      return this.getStandaloneConfig();
    } else {
      return this.getSupabaseConfig();
    }
  }

  private getSupabaseConfig(): ModeConfig {
    return {
      mode: 'supabase',
      database: {
        type: 'supabase',
        config: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
      },
      storage: {
        type: 'supabase',
        config: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
      },
      auth: {
        type: 'supabase',
        config: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
      },
      features: {
        realtime: true,
        analytics: true,
        monitoring: true,
      },
    };
  }

  private getStandaloneConfig(): ModeConfig {
    return {
      mode: 'standalone',
      database: {
        type: (process.env.DATABASE_TYPE as any) || 'sqlite',
        config: {
          path: process.env.DATABASE_PATH || './data/app.db',
          url: process.env.DATABASE_URL,
        },
      },
      storage: {
        type: (process.env.STORAGE_TYPE as any) || 'local',
        config: {
          path: process.env.STORAGE_PATH || './storage',
          bucket: process.env.STORAGE_BUCKET,
        },
      },
      auth: {
        type: (process.env.AUTH_TYPE as any) || 'simple',
        config: {
          secret: process.env.AUTH_SECRET,
          sessionTimeout: parseInt(process.env.AUTH_SESSION_TIMEOUT || '86400000'),
        },
      },
      features: {
        realtime: process.env.ENABLE_REALTIME === 'true',
        analytics: process.env.ENABLE_ANALYTICS !== 'false',
        monitoring: process.env.ENABLE_MONITORING === 'true',
      },
    };
  }

  public switchToMode(mode: DeploymentMode, config?: Partial<ModeConfig>): void {
    let newConfig: ModeConfig;

    if (mode === 'standalone') {
      newConfig = this.getStandaloneConfig();
    } else {
      newConfig = this.getSupabaseConfig();
    }

    // Apply any overrides
    if (config) {
      newConfig = { ...newConfig, ...config };
    }

    this.currentConfig = newConfig;
    this.saveConfig();

    console.log(`✅ Switched to ${mode} mode`);
  }

  public validateCurrentMode(): { valid: boolean; errors: string[] } {
    const config = this.getCurrentConfig();
    const errors: string[] = [];

    if (config.mode === 'supabase') {
      if (!config.database.config.url) {
        errors.push('NEXT_PUBLIC_SUPABASE_URL is required for Supabase mode');
      }
      if (!config.database.config.anonKey) {
        errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for Supabase mode');
      }
      if (!config.database.config.serviceKey) {
        errors.push('SUPABASE_SERVICE_ROLE_KEY is required for Supabase mode');
      }
    } else {
      if (!config.auth.config.secret) {
        errors.push('AUTH_SECRET is required for standalone mode');
      }
      if (config.auth.config.secret && config.auth.config.secret.length < 32) {
        errors.push('AUTH_SECRET must be at least 32 characters long');
      }
      if (config.database.type === 'postgresql' && !config.database.config.url) {
        errors.push('DATABASE_URL is required for PostgreSQL database');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public generateEnvironmentFile(mode: DeploymentMode): string {
    const config = mode === 'standalone' ? this.getStandaloneConfig() : this.getSupabaseConfig();
    
    let envContent = `# Environment configuration for ${mode} mode\n`;
    envContent += `# Generated on ${new Date().toISOString()}\n\n`;

    if (mode === 'standalone') {
      envContent += `# Standalone Mode Configuration\n`;
      envContent += `STANDALONE_MODE=true\n`;
      envContent += `DATABASE_TYPE=${config.database.type}\n`;
      envContent += `STORAGE_TYPE=${config.storage.type}\n`;
      envContent += `AUTH_TYPE=${config.auth.type}\n\n`;

      if (config.database.type === 'sqlite') {
        envContent += `DATABASE_PATH=${config.database.config.path}\n`;
      } else if (config.database.type === 'postgresql') {
        envContent += `DATABASE_URL=${config.database.config.url || 'postgresql://user:password@localhost:5432/n8n_converter'}\n`;
      }

      if (config.storage.type === 'local') {
        envContent += `STORAGE_PATH=${config.storage.config.path}\n`;
      }

      envContent += `AUTH_SECRET=${config.auth.config.secret || 'CHANGE_ME_TO_SECURE_VALUE'}\n`;
      envContent += `ENABLE_REALTIME=${config.features.realtime}\n`;
      envContent += `ENABLE_ANALYTICS=${config.features.analytics}\n`;
      envContent += `ENABLE_MONITORING=${config.features.monitoring}\n`;
    } else {
      envContent += `# Supabase Mode Configuration\n`;
      envContent += `NEXT_PUBLIC_SUPABASE_URL=${config.database.config.url || 'https://your-project.supabase.co'}\n`;
      envContent += `NEXT_PUBLIC_SUPABASE_ANON_KEY=${config.database.config.anonKey || 'your-anon-key'}\n`;
      envContent += `SUPABASE_SERVICE_ROLE_KEY=${config.database.config.serviceKey || 'your-service-key'}\n`;
    }

    envContent += `\n# Common Configuration\n`;
    envContent += `NODE_ENV=production\n`;
    envContent += `NEXTAUTH_SECRET=CHANGE_ME_TO_SECURE_VALUE\n`;
    envContent += `OPENAI_API_KEY=sk-your-openai-key\n`;
    envContent += `# ANTHROPIC_API_KEY=sk-ant-your-anthropic-key\n`;
    envContent += `# GOOGLE_AI_API_KEY=your-google-ai-key\n`;

    return envContent;
  }

  public createMigrationPlan(fromMode: DeploymentMode, toMode: DeploymentMode): {
    steps: string[];
    warnings: string[];
    dataLoss: boolean;
  } {
    const steps: string[] = [];
    const warnings: string[] = [];
    let dataLoss = false;

    if (fromMode === toMode) {
      return { steps: ['No migration needed - already in target mode'], warnings: [], dataLoss: false };
    }

    if (fromMode === 'supabase' && toMode === 'standalone') {
      steps.push('1. Export data from Supabase');
      steps.push('2. Set up SQLite database');
      steps.push('3. Migrate user accounts and projects');
      steps.push('4. Download files from Supabase Storage to local storage');
      steps.push('5. Update environment configuration');
      steps.push('6. Test standalone server');
      
      warnings.push('Real-time features will be disabled');
      warnings.push('Advanced Supabase features will not be available');
      warnings.push('Manual data export/import required');
    } else if (fromMode === 'standalone' && toMode === 'supabase') {
      steps.push('1. Set up Supabase project');
      steps.push('2. Run database migrations');
      steps.push('3. Export data from SQLite');
      steps.push('4. Import data to Supabase');
      steps.push('5. Upload files to Supabase Storage');
      steps.push('6. Update environment configuration');
      steps.push('7. Test Supabase integration');
      
      warnings.push('Supabase project setup required');
      warnings.push('Manual data migration required');
      warnings.push('Authentication tokens will be invalidated');
    }

    return { steps, warnings, dataLoss };
  }

  public getFeatureComparison(): {
    feature: string;
    supabase: boolean;
    standalone: boolean;
    notes?: string;
  }[] {
    return [
      {
        feature: 'User Authentication',
        supabase: true,
        standalone: true,
        notes: 'Supabase: Full OAuth support, Standalone: Simple email/password',
      },
      {
        feature: 'Database',
        supabase: true,
        standalone: true,
        notes: 'Supabase: PostgreSQL, Standalone: SQLite or PostgreSQL',
      },
      {
        feature: 'File Storage',
        supabase: true,
        standalone: true,
        notes: 'Supabase: Cloud storage, Standalone: Local filesystem',
      },
      {
        feature: 'Real-time Updates',
        supabase: true,
        standalone: false,
        notes: 'Requires Supabase real-time subscriptions',
      },
      {
        feature: 'Row Level Security',
        supabase: true,
        standalone: false,
        notes: 'Built into Supabase PostgreSQL',
      },
      {
        feature: 'Edge Functions',
        supabase: true,
        standalone: false,
        notes: 'Supabase serverless functions',
      },
      {
        feature: 'Analytics',
        supabase: true,
        standalone: true,
        notes: 'Both support basic analytics',
      },
      {
        feature: 'Self-hosting',
        supabase: true,
        standalone: true,
        notes: 'Both can be self-hosted',
      },
      {
        feature: 'Setup Complexity',
        supabase: false,
        standalone: true,
        notes: 'Standalone: Simpler setup, Supabase: More configuration',
      },
      {
        feature: 'Scalability',
        supabase: true,
        standalone: false,
        notes: 'Supabase: Cloud-scale, Standalone: Single server',
      },
    ];
  }
}

// Singleton instance
let modeSwitcher: ModeSwitcher | null = null;

export function getModeSwitcher(): ModeSwitcher {
  if (!modeSwitcher) {
    modeSwitcher = new ModeSwitcher();
  }
  return modeSwitcher;
}

// Utility functions
export function isStandaloneMode(): boolean {
  return getModeSwitcher().detectCurrentMode() === 'standalone';
}

export function isSupabaseMode(): boolean {
  return getModeSwitcher().detectCurrentMode() === 'supabase';
}

export function getCurrentModeConfig(): ModeConfig {
  return getModeSwitcher().getCurrentConfig();
}