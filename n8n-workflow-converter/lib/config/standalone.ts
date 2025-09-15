/**
 * Standalone configuration for n8n Workflow Converter
 * This configuration enables running without Supabase dependency
 */

export interface StandaloneConfig {
  database: {
    type: 'sqlite' | 'postgresql';
    url?: string;
    path?: string;
    options?: Record<string, any>;
  };
  storage: {
    type: 'local' | 's3' | 'gcs';
    path?: string;
    bucket?: string;
    options?: Record<string, any>;
  };
  auth: {
    type: 'simple' | 'jwt' | 'oauth';
    secret: string;
    providers?: string[];
    options?: Record<string, any>;
  };
  server: {
    port: number;
    host: string;
    cors: {
      origin: string | string[];
      credentials: boolean;
    };
  };
  features: {
    analytics: boolean;
    monitoring: boolean;
    realtime: boolean;
    fileUpload: boolean;
  };
}

export const defaultStandaloneConfig: StandaloneConfig = {
  database: {
    type: 'sqlite',
    path: './data/app.db',
    options: {
      enableWAL: true,
      busyTimeout: 30000,
    },
  },
  storage: {
    type: 'local',
    path: './storage',
    options: {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: ['application/json', 'application/zip'],
    },
  },
  auth: {
    type: 'simple',
    secret: process.env.AUTH_SECRET || 'change-me-in-production',
    options: {
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      bcryptRounds: 12,
    },
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  },
  features: {
    analytics: process.env.ENABLE_ANALYTICS === 'true',
    monitoring: process.env.ENABLE_MONITORING === 'true',
    realtime: process.env.ENABLE_REALTIME === 'true',
    fileUpload: process.env.ENABLE_FILE_UPLOAD !== 'false',
  },
};

export function loadStandaloneConfig(): StandaloneConfig {
  const config = { ...defaultStandaloneConfig };

  // Override with environment variables
  if (process.env.DATABASE_TYPE) {
    config.database.type = process.env.DATABASE_TYPE as 'sqlite' | 'postgresql';
  }

  if (process.env.DATABASE_URL) {
    config.database.url = process.env.DATABASE_URL;
  }

  if (process.env.DATABASE_PATH) {
    config.database.path = process.env.DATABASE_PATH;
  }

  if (process.env.STORAGE_TYPE) {
    config.storage.type = process.env.STORAGE_TYPE as 'local' | 's3' | 'gcs';
  }

  if (process.env.STORAGE_PATH) {
    config.storage.path = process.env.STORAGE_PATH;
  }

  if (process.env.AUTH_TYPE) {
    config.auth.type = process.env.AUTH_TYPE as 'simple' | 'jwt' | 'oauth';
  }

  if (process.env.AUTH_SECRET) {
    config.auth.secret = process.env.AUTH_SECRET;
  }

  return config;
}

export function validateStandaloneConfig(config: StandaloneConfig): string[] {
  const errors: string[] = [];

  // Validate database configuration
  if (config.database.type === 'sqlite' && !config.database.path) {
    errors.push('SQLite database path is required');
  }

  if (config.database.type === 'postgresql' && !config.database.url) {
    errors.push('PostgreSQL database URL is required');
  }

  // Validate storage configuration
  if (config.storage.type === 'local' && !config.storage.path) {
    errors.push('Local storage path is required');
  }

  if ((config.storage.type === 's3' || config.storage.type === 'gcs') && !config.storage.bucket) {
    errors.push('Cloud storage bucket is required');
  }

  // Validate auth configuration
  if (!config.auth.secret || config.auth.secret === 'change-me-in-production') {
    errors.push('AUTH_SECRET must be set to a secure value');
  }

  if (config.auth.secret.length < 32) {
    errors.push('AUTH_SECRET must be at least 32 characters long');
  }

  // Validate server configuration
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Server port must be between 1 and 65535');
  }

  return errors;
}