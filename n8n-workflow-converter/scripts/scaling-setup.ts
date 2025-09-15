#!/usr/bin/env tsx
/**
 * Scaling setup script for production deployment
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

interface ScalingSetupConfig {
  environment: 'staging' | 'production';
  platform: 'vercel' | 'docker' | 'kubernetes';
  enableAutoScaling: boolean;
  enableLoadBalancing: boolean;
  enableHighAvailability: boolean;
  databaseConnections: {
    min: number;
    max: number;
  };
}

class ScalingSetup {
  private config: ScalingSetupConfig;
  private projectRoot: string;

  constructor(config: ScalingSetupConfig) {
    this.config = config;
    this.projectRoot = process.cwd();
  }

  async setup(): Promise<void> {
    console.log('🚀 Setting up scaling configuration...');
    
    try {
      await this.validateEnvironment();
      await this.setupDatabaseOptimizations();
      await this.setupCaching();
      await this.setupMonitoring();
      await this.setupLoadBalancing();
      await this.setupAutoScaling();
      await this.setupHighAvailability();
      await this.generateDocumentation();
      
      console.log('✅ Scaling setup completed successfully!');
    } catch (error) {
      console.error('❌ Scaling setup failed:', error);
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('📋 Validating environment...');
    
    // Check required environment variables
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ Environment validation completed');
  }

  private async setupDatabaseOptimizations(): Promise<void> {
    console.log('🗄️ Setting up database optimizations...');
    
    // Update environment variables for connection pooling
    const envPath = join(this.projectRoot, '.env.local');
    let envContent = '';
    
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, 'utf-8');
    }

    const dbConfig = [
      `DB_MAX_CONNECTIONS=${this.config.databaseConnections.max}`,
      `DB_MIN_CONNECTIONS=${this.config.databaseConnections.min}`,
      `CONNECTION_POOL_ENABLED=true`,
    ];

    dbConfig.forEach(line => {
      const [key] = line.split('=');
      const regex = new RegExp(`^${key}=.*$`, 'm');
      
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, line);
      } else {
        envContent += `\n${line}`;
      }
    });

    writeFileSync(envPath, envContent);
    console.log('✅ Database connection pooling configured');
  }

  private async setupCaching(): Promise<void> {
    console.log('💾 Setting up caching...');
    
    // Ensure lib/config directory exists
    const configDir = join(this.projectRoot, 'lib/config');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Create cache configuration
    const cacheConfig = {
      enabled: true,
      defaultTTL: this.config.environment === 'production' ? 300000 : 60000,
      maxSize: 1000,
      cleanupInterval: 300000,
    };

    const configPath = join(configDir, 'cache.json');
    writeFileSync(configPath, JSON.stringify(cacheConfig, null, 2));
    
    console.log('✅ Caching configuration created');
  }

  private async setupMonitoring(): Promise<void> {
    console.log('📊 Setting up monitoring...');
    
    const configDir = join(this.projectRoot, 'lib/config');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Create monitoring configuration
    const monitoringConfig = {
      enabled: true,
      metricsInterval: this.config.environment === 'production' ? 15000 : 30000,
      alertThresholds: {
        responseTime: 2000,
        errorRate: 0.05,
        memoryUsage: 0.9,
      },
      endpoints: [
        '/api/health',
        '/api/projects',
        '/api/parse-workflow',
        '/api/analytics',
      ],
    };

    const configPath = join(configDir, 'monitoring.json');
    writeFileSync(configPath, JSON.stringify(monitoringConfig, null, 2));
    
    console.log('✅ Monitoring configuration created');
  }

  private async setupLoadBalancing(): Promise<void> {
    if (!this.config.enableLoadBalancing) {
      console.log('⏭️ Load balancing disabled, skipping...');
      return;
    }

    console.log('⚖️ Setting up load balancing...');
    
    if (this.config.platform === 'kubernetes') {
      await this.setupKubernetesLoadBalancing();
    } else if (this.config.platform === 'docker') {
      await this.setupDockerLoadBalancing();
    } else {
      console.log('ℹ️ Vercel handles load balancing automatically');
    }
    
    console.log('✅ Load balancing configured');
  }

  private async setupKubernetesLoadBalancing(): Promise<void> {
    const k8sDir = join(this.projectRoot, 'k8s');
    if (!existsSync(k8sDir)) {
      mkdirSync(k8sDir, { recursive: true });
    }

    const k8sConfig = `apiVersion: v1
kind: Service
metadata:
  name: n8n-converter-service
  labels:
    app: n8n-converter
spec:
  selector:
    app: n8n-converter
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n-converter-deployment
  labels:
    app: n8n-converter
spec:
  replicas: 3
  selector:
    matchLabels:
      app: n8n-converter
  template:
    metadata:
      labels:
        app: n8n-converter
    spec:
      containers:
      - name: n8n-converter
        image: n8n-converter:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "${this.config.environment}"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5`;

    writeFileSync(join(k8sDir, 'deployment.yaml'), k8sConfig);
  }

  private async setupDockerLoadBalancing(): Promise<void> {
    const dockerComposeConfig = `version: '3.8'
services:
  n8n-converter:
    build: .
    ports:
      - "3000-3002:3000"
    environment:
      - NODE_ENV=${this.config.environment}
      - DB_MAX_CONNECTIONS=${this.config.databaseConnections.max}
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - n8n-converter`;

    const nginxConfig = `events {
    worker_connections 1024;
}

http {
    upstream n8n_converter {
        least_conn;
        server n8n-converter:3000;
        server n8n-converter:3001;
        server n8n-converter:3002;
    }

    server {
        listen 80;
        
        location / {
            proxy_pass http://n8n_converter;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /api/health {
            proxy_pass http://n8n_converter;
            access_log off;
        }
    }
}`;

    writeFileSync(join(this.projectRoot, 'docker-compose.prod.yml'), dockerComposeConfig);
    writeFileSync(join(this.projectRoot, 'nginx.conf'), nginxConfig);
  }

  private async setupAutoScaling(): Promise<void> {
    if (!this.config.enableAutoScaling) {
      console.log('⏭️ Auto-scaling disabled, skipping...');
      return;
    }

    console.log('📈 Setting up auto-scaling...');
    
    if (this.config.platform === 'kubernetes') {
      const k8sDir = join(this.projectRoot, 'k8s');
      if (!existsSync(k8sDir)) {
        mkdirSync(k8sDir, { recursive: true });
      }

      const hpaConfig = `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: n8n-converter-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: n8n-converter-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80`;

      writeFileSync(join(k8sDir, 'hpa.yaml'), hpaConfig);
    }
    
    console.log('✅ Auto-scaling configured');
  }

  private async setupHighAvailability(): Promise<void> {
    if (!this.config.enableHighAvailability) {
      console.log('⏭️ High availability disabled, skipping...');
      return;
    }

    console.log('🏥 Setting up high availability...');
    
    const scriptsDir = join(this.projectRoot, 'scripts');
    if (!existsSync(scriptsDir)) {
      mkdirSync(scriptsDir, { recursive: true });
    }

    // Create health check script
    const healthCheckScript = `#!/bin/bash
# Health check script for high availability

ENDPOINTS=(
  "http://localhost:3000/api/health"
  "http://localhost:3000/api/health/database"
  "http://localhost:3000/api/health/storage"
)

for endpoint in "\${ENDPOINTS[@]}"; do
  if ! curl -f -s "$endpoint" > /dev/null; then
    echo "Health check failed for $endpoint"
    exit 1
  fi
done

echo "All health checks passed"
exit 0`;

    writeFileSync(join(scriptsDir, 'health-check.sh'), healthCheckScript);
    
    console.log('✅ High availability configured');
  }

  private async generateDocumentation(): Promise<void> {
    console.log('📚 Generating scaling documentation...');
    
    const docsDir = join(this.projectRoot, 'docs');
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    const documentation = `# Scaling Configuration

This document describes the scaling setup for the n8n Workflow Converter.

## Configuration

- **Environment**: ${this.config.environment}
- **Platform**: ${this.config.platform}
- **Auto-scaling**: ${this.config.enableAutoScaling ? 'Enabled' : 'Disabled'}
- **Load Balancing**: ${this.config.enableLoadBalancing ? 'Enabled' : 'Disabled'}
- **High Availability**: ${this.config.enableHighAvailability ? 'Enabled' : 'Disabled'}

## Database Connections

- **Minimum**: ${this.config.databaseConnections.min}
- **Maximum**: ${this.config.databaseConnections.max}

## Monitoring

The application includes comprehensive monitoring with:

- Performance metrics collection
- Health checks for all critical services
- Alerting for performance degradation
- Resource usage monitoring

## Deployment Commands

### Kubernetes
\`\`\`bash
kubectl apply -f k8s/
\`\`\`

### Docker Compose
\`\`\`bash
docker-compose -f docker-compose.prod.yml up -d
\`\`\`

### Vercel
\`\`\`bash
vercel --prod
\`\`\`

## Health Checks

- **Application**: \`/api/health\`
- **Database**: \`/api/health/database\`
- **Storage**: \`/api/health/storage\`
- **External Services**: \`/api/health/external-services\`

## Scaling Metrics

The auto-scaler monitors:

- CPU usage (target: 70%)
- Memory usage (target: 80%)
- Response time (target: < 2000ms)
- Error rate (target: < 5%)`;

    writeFileSync(join(docsDir, 'SCALING.md'), documentation);
    console.log('✅ Documentation generated');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const environment = (args[0] as 'staging' | 'production') || 'staging';
  const platform = (args[1] as 'vercel' | 'docker' | 'kubernetes') || 'vercel';

  const config: ScalingSetupConfig = {
    environment,
    platform,
    enableAutoScaling: environment === 'production',
    enableLoadBalancing: platform !== 'vercel',
    enableHighAvailability: environment === 'production',
    databaseConnections: {
      min: environment === 'production' ? 5 : 2,
      max: environment === 'production' ? 50 : 10,
    },
  };

  const setup = new ScalingSetup(config);
  await setup.setup();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ScalingSetup, ScalingSetupConfig };