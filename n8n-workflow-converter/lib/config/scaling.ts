/**
 * Scaling configuration and environment setup
 */

export interface ScalingConfig {
  // Connection pooling
  database: {
    maxConnections: number;
    minConnections: number;
    acquireTimeoutMs: number;
    idleTimeoutMs: number;
  };
  
  // Load balancing
  loadBalancer: {
    instances: Array<{
      id: string;
      url: string;
      weight: number;
    }>;
    algorithm: 'round-robin' | 'least-connections' | 'weighted';
    healthCheckInterval: number;
  };
  
  // Auto-scaling
  autoScaling: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    scaleUpThreshold: {
      cpuUsage: number;
      memoryUsage: number;
      activeConnections: number;
      responseTime: number;
    };
    scaleDownThreshold: {
      cpuUsage: number;
      memoryUsage: number;
      activeConnections: number;
      responseTime: number;
    };
    cooldownPeriod: number;
  };
  
  // Caching
  caching: {
    enabled: boolean;
    defaultTTL: number;
    maxSize: number;
    cleanupInterval: number;
  };
  
  // High availability
  highAvailability: {
    enabled: boolean;
    primaryEndpoint: string;
    fallbackEndpoints: string[];
    healthCheckInterval: number;
    failoverTimeout: number;
  };
  
  // Performance monitoring
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
    };
  };
}

// Default configuration
const defaultConfig: ScalingConfig = {
  database: {
    maxConnections: 20,
    minConnections: 2,
    acquireTimeoutMs: 30000,
    idleTimeoutMs: 300000,
  },
  
  loadBalancer: {
    instances: [],
    algorithm: 'least-connections',
    healthCheckInterval: 30000,
  },
  
  autoScaling: {
    enabled: false,
    minInstances: 1,
    maxInstances: 10,
    scaleUpThreshold: {
      cpuUsage: 80,
      memoryUsage: 85,
      activeConnections: 100,
      responseTime: 2000,
    },
    scaleDownThreshold: {
      cpuUsage: 30,
      memoryUsage: 40,
      activeConnections: 20,
      responseTime: 500,
    },
    cooldownPeriod: 300000, // 5 minutes
  },
  
  caching: {
    enabled: true,
    defaultTTL: 300000, // 5 minutes
    maxSize: 1000,
    cleanupInterval: 300000, // 5 minutes
  },
  
  highAvailability: {
    enabled: false,
    primaryEndpoint: '',
    fallbackEndpoints: [],
    healthCheckInterval: 30000,
    failoverTimeout: 5000,
  },
  
  monitoring: {
    enabled: true,
    metricsInterval: 30000,
    alertThresholds: {
      responseTime: 2000,
      errorRate: 0.05, // 5%
      memoryUsage: 0.9, // 90%
    },
  },
};

// Environment-specific configurations
const environmentConfigs: Record<string, Partial<ScalingConfig>> = {
  development: {
    database: {
      maxConnections: 5,
      minConnections: 1,
    },
    autoScaling: {
      enabled: false,
    },
    highAvailability: {
      enabled: false,
    },
    monitoring: {
      metricsInterval: 60000, // Less frequent in dev
    },
  },
  
  staging: {
    database: {
      maxConnections: 10,
      minConnections: 2,
    },
    autoScaling: {
      enabled: true,
      maxInstances: 3,
    },
    highAvailability: {
      enabled: true,
    },
  },
  
  production: {
    database: {
      maxConnections: 50,
      minConnections: 5,
    },
    autoScaling: {
      enabled: true,
      maxInstances: 20,
    },
    highAvailability: {
      enabled: true,
    },
    monitoring: {
      metricsInterval: 15000, // More frequent in prod
    },
  },
};

// Configuration loader
export function getScalingConfig(): ScalingConfig {
  const environment = process.env.NODE_ENV || 'development';
  const envConfig = environmentConfigs[environment] || {};
  
  // Merge default config with environment-specific config
  const config = mergeDeep(defaultConfig, envConfig);
  
  // Override with environment variables if present
  if (process.env.DB_MAX_CONNECTIONS) {
    config.database.maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS);
  }
  
  if (process.env.DB_MIN_CONNECTIONS) {
    config.database.minConnections = parseInt(process.env.DB_MIN_CONNECTIONS);
  }
  
  if (process.env.AUTO_SCALING_ENABLED) {
    config.autoScaling.enabled = process.env.AUTO_SCALING_ENABLED === 'true';
  }
  
  if (process.env.AUTO_SCALING_MAX_INSTANCES) {
    config.autoScaling.maxInstances = parseInt(process.env.AUTO_SCALING_MAX_INSTANCES);
  }
  
  if (process.env.LOAD_BALANCER_INSTANCES) {
    try {
      config.loadBalancer.instances = JSON.parse(process.env.LOAD_BALANCER_INSTANCES);
    } catch (error) {
      console.warn('Failed to parse LOAD_BALANCER_INSTANCES:', error);
    }
  }
  
  if (process.env.PRIMARY_ENDPOINT) {
    config.highAvailability.primaryEndpoint = process.env.PRIMARY_ENDPOINT;
  }
  
  if (process.env.FALLBACK_ENDPOINTS) {
    try {
      config.highAvailability.fallbackEndpoints = JSON.parse(process.env.FALLBACK_ENDPOINTS);
    } catch (error) {
      console.warn('Failed to parse FALLBACK_ENDPOINTS:', error);
    }
  }
  
  return config;
}

// Deep merge utility
function mergeDeep(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Validation
export function validateScalingConfig(config: ScalingConfig): string[] {
  const errors: string[] = [];
  
  // Database validation
  if (config.database.maxConnections <= config.database.minConnections) {
    errors.push('maxConnections must be greater than minConnections');
  }
  
  if (config.database.maxConnections <= 0) {
    errors.push('maxConnections must be positive');
  }
  
  // Auto-scaling validation
  if (config.autoScaling.enabled) {
    if (config.autoScaling.maxInstances <= config.autoScaling.minInstances) {
      errors.push('maxInstances must be greater than minInstances');
    }
    
    if (config.autoScaling.minInstances <= 0) {
      errors.push('minInstances must be positive');
    }
  }
  
  // High availability validation
  if (config.highAvailability.enabled) {
    if (!config.highAvailability.primaryEndpoint) {
      errors.push('primaryEndpoint is required when high availability is enabled');
    }
    
    if (config.highAvailability.fallbackEndpoints.length === 0) {
      errors.push('At least one fallback endpoint is required when high availability is enabled');
    }
  }
  
  // Load balancer validation
  if (config.loadBalancer.instances.length > 0) {
    for (const instance of config.loadBalancer.instances) {
      if (!instance.id || !instance.url) {
        errors.push('Load balancer instances must have id and url');
      }
      
      if (instance.weight <= 0) {
        errors.push('Load balancer instance weights must be positive');
      }
    }
  }
  
  return errors;
}

// Configuration presets for common scenarios
export const scalingPresets = {
  // Small application (< 1000 users)
  small: {
    database: {
      maxConnections: 10,
      minConnections: 2,
    },
    autoScaling: {
      enabled: false,
    },
    highAvailability: {
      enabled: false,
    },
  },
  
  // Medium application (1000-10000 users)
  medium: {
    database: {
      maxConnections: 25,
      minConnections: 5,
    },
    autoScaling: {
      enabled: true,
      maxInstances: 5,
    },
    highAvailability: {
      enabled: true,
    },
  },
  
  // Large application (10000+ users)
  large: {
    database: {
      maxConnections: 100,
      minConnections: 10,
    },
    autoScaling: {
      enabled: true,
      maxInstances: 20,
    },
    highAvailability: {
      enabled: true,
    },
    loadBalancer: {
      algorithm: 'least-connections' as const,
    },
  },
};

// Apply preset configuration
export function applyScalingPreset(preset: keyof typeof scalingPresets): ScalingConfig {
  const presetConfig = scalingPresets[preset];
  return mergeDeep(defaultConfig, presetConfig);
}

// Export the configuration
export const scalingConfig = getScalingConfig();