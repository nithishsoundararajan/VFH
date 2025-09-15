export interface MonitoringConfig {
  enabled: boolean;
  healthCheck: {
    interval: number;
    timeout: number;
  };
  database: {
    enabled: boolean;
    timeout: number;
  };
  storage: {
    enabled: boolean;
    timeout: number;
  };
  externalServices: {
    enabled: boolean;
    timeout: number;
  };
}

export const defaultMonitoringConfig: MonitoringConfig = {
  enabled: process.env.NODE_ENV === 'production',
  healthCheck: {
    interval: 30000, // 30 seconds
    timeout: 5000,   // 5 seconds
  },
  database: {
    enabled: true,
    timeout: 3000,
  },
  storage: {
    enabled: true,
    timeout: 3000,
  },
  externalServices: {
    enabled: true,
    timeout: 5000,
  },
};

export function getMonitoringConfig(): MonitoringConfig {
  return {
    enabled: process.env.MONITORING_ENABLED === 'true' || defaultMonitoringConfig.enabled,
    healthCheck: {
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
    },
    database: {
      enabled: process.env.DATABASE_MONITORING_ENABLED !== 'false',
      timeout: parseInt(process.env.DATABASE_TIMEOUT || '3000'),
    },
    storage: {
      enabled: process.env.STORAGE_MONITORING_ENABLED !== 'false',
      timeout: parseInt(process.env.STORAGE_TIMEOUT || '3000'),
    },
    externalServices: {
      enabled: process.env.EXTERNAL_SERVICES_MONITORING_ENABLED !== 'false',
      timeout: parseInt(process.env.EXTERNAL_SERVICES_TIMEOUT || '5000'),
    },
  };
}