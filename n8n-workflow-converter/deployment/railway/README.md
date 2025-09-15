# Railway Deployment Guide

This guide covers deploying the n8n Workflow Converter to Railway, a modern deployment platform with built-in database and infrastructure services.

## Prerequisites

- Railway account (free tier available)
- GitHub repository with your code
- Basic understanding of environment variables

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

## Manual Deployment

### 1. Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 2. Configure Services

Railway will automatically detect your Next.js application. The included `railway.toml` configures:

- **Web service**: Next.js application
- **Database service**: PostgreSQL 15
- **Redis service**: For caching and sessions

### 3. Environment Variables

Set these environment variables in Railway:

#### Required Variables

```env
# Application
NODE_ENV=production
NEXTAUTH_SECRET=your_nextauth_secret_32_chars_min
NEXTAUTH_URL=${{RAILWAY_STATIC_URL}}

# Database (automatically set by Railway)
DATABASE_URL=${{DATABASE_PRIVATE_URL}}
POSTGRES_PASSWORD=${{POSTGRES_PASSWORD}}

# Redis (automatically set by Railway)
REDIS_URL=${{REDIS_PRIVATE_URL}}

# AI Provider (at least one required)
OPENAI_API_KEY=sk-your_openai_api_key
```

#### Optional Variables

```env
# Additional AI Providers
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
GOOGLE_AI_API_KEY=your_google_ai_key
DEFAULT_AI_PROVIDER=openai

# Security
VIRUSTOTAL_API_KEY=your_virustotal_key
ENCRYPTION_KEY=your_32_char_encryption_key

# OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info
```

### 4. Deploy

1. Railway will automatically deploy when you push to your main branch
2. Monitor the build process in the Railway dashboard
3. Your app will be available at the generated Railway URL

## CLI Deployment

### Install Railway CLI

```bash
# Install via npm
npm install -g @railway/cli

# Or via curl
curl -fsSL https://railway.app/install.sh | sh
```

### Login and Deploy

```bash
# Login to Railway
railway login

# Initialize project
railway init

# Link to existing project (optional)
railway link

# Deploy
railway up

# Set environment variables
railway variables set VARIABLE_NAME=value

# View logs
railway logs
```

## Service Configuration

### Web Service

The web service runs your Next.js application:

```toml
[[services]]
name = "web"

[services.web]
source = "."
build = { builder = "NIXPACKS" }

[services.web.variables]
NODE_ENV = "production"
PORT = "3000"
```

### Database Service

PostgreSQL database with automatic backups:

```toml
[[services]]
name = "database"

[services.database]
source = "postgres:15"

[services.database.variables]
POSTGRES_DB = "n8n_converter"
POSTGRES_USER = "postgres"
POSTGRES_PASSWORD = "${{POSTGRES_PASSWORD}}"
```

### Redis Service

Redis for caching and session storage:

```toml
[[services]]
name = "redis"

[services.redis]
source = "redis:7-alpine"
```

## Database Setup

### Run Migrations

After deployment, run database migrations:

```bash
# Connect to your Railway project
railway link

# Run migrations
railway run npm run migrate

# Or run directly on the database
railway connect postgres
```

### Database Management

```bash
# Connect to database
railway connect postgres

# View database logs
railway logs --service database

# Backup database
railway run pg_dump $DATABASE_URL > backup.sql
```

## Custom Domain

### Add Domain

1. Go to your project settings in Railway
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update `NEXTAUTH_URL` environment variable

### SSL Certificate

Railway automatically provides SSL certificates for custom domains.

## Monitoring and Logs

### View Logs

```bash
# View all logs
railway logs

# View specific service logs
railway logs --service web
railway logs --service database

# Follow logs in real-time
railway logs --follow
```

### Metrics

Railway provides built-in metrics:

- CPU usage
- Memory usage
- Network traffic
- Response times

Access these in the Railway dashboard under "Metrics".

## Scaling

### Vertical Scaling

Upgrade your service resources:

1. Go to project settings
2. Select your service
3. Choose a higher resource tier
4. Railway will automatically restart with new resources

### Horizontal Scaling

For high-traffic applications:

```toml
[services.web]
replicas = 3
```

## Environment Management

### Multiple Environments

Create separate Railway projects for different environments:

```bash
# Production
railway init --name n8n-converter-prod

# Staging
railway init --name n8n-converter-staging

# Development
railway init --name n8n-converter-dev
```

### Environment Variables

```bash
# Set variables for current environment
railway variables set NODE_ENV=production
railway variables set OPENAI_API_KEY=sk-your-key

# View all variables
railway variables

# Delete variable
railway variables delete VARIABLE_NAME
```

## Advanced Configuration

### Custom Build Process

Create `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build:production"
  },
  "deploy": {
    "startCommand": "npm run start:production",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```

### Health Checks

Railway automatically monitors your application health:

```typescript
// pages/api/health.ts
export default function handler(req, res) {
  // Check database connection
  // Check external services
  // Return health status
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'healthy',
      redis: 'healthy',
    }
  });
}
```

### Cron Jobs

For scheduled tasks, use Railway's cron service:

```toml
[[services]]
name = "cron"

[services.cron]
source = "."
cron = "0 2 * * *"  # Daily at 2 AM
startCommand = "npm run cleanup"
```

## Backup and Recovery

### Database Backups

```bash
# Manual backup
railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated backup script
#!/bin/bash
railway run pg_dump $DATABASE_URL | gzip > "backup-$(date +%Y%m%d-%H%M%S).sql.gz"
```

### File Storage Backups

If using local file storage:

```bash
# Backup files
railway run tar -czf files-backup.tar.gz /app/storage

# Download backup
railway run cat files-backup.tar.gz > local-backup.tar.gz
```

## Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check build logs
railway logs --service web

# Debug build locally
railway run npm run build
```

#### 2. Database Connection Issues

```bash
# Test database connection
railway run psql $DATABASE_URL -c "SELECT version();"

# Check database logs
railway logs --service database
```

#### 3. Memory Issues

```bash
# Check memory usage
railway logs --service web | grep "memory"

# Upgrade service tier
# Go to Railway dashboard > Settings > Resources
```

#### 4. Environment Variable Issues

```bash
# List all variables
railway variables

# Check specific variable
railway run echo $VARIABLE_NAME
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment
railway variables set DEBUG=*
railway variables set LOG_LEVEL=debug

# View detailed logs
railway logs --follow
```

### Performance Optimization

1. **Enable caching**:
   ```typescript
   // Use Redis for caching
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   ```

2. **Database optimization**:
   ```sql
   -- Add indexes for better performance
   CREATE INDEX idx_projects_user_id ON projects(user_id);
   CREATE INDEX idx_projects_created_at ON projects(created_at);
   ```

3. **Resource monitoring**:
   ```bash
   # Monitor resource usage
   railway logs --service web | grep -E "(memory|cpu)"
   ```

## Security

### Network Security

Railway provides:
- Automatic HTTPS
- Private networking between services
- Environment variable encryption

### Application Security

```typescript
// Add security headers
export default function handler(req, res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'origin-when-cross-origin');
  
  // Your API logic here
}
```

### Database Security

```sql
-- Create read-only user for monitoring
CREATE USER monitoring WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE n8n_converter TO monitoring;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;
```

## Cost Optimization

### Resource Management

- Monitor usage in Railway dashboard
- Use appropriate service tiers
- Implement efficient caching
- Optimize database queries

### Scaling Strategy

- Start with smaller instances
- Scale up based on actual usage
- Use horizontal scaling for high traffic
- Implement connection pooling

## Support and Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway CLI Reference](https://docs.railway.app/reference/cli-api)
- [Railway Community](https://railway.app/discord)
- [Railway Status](https://status.railway.app/)