# Self-Hosting Guide

This guide provides comprehensive instructions for self-hosting the n8n Workflow Converter application. You can deploy this application in various configurations, from simple local development to full production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Supabase Self-Hosting](#supabase-self-hosting)
4. [Environment Configuration](#environment-configuration)
5. [Deployment Options](#deployment-options)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance](#maintenance)

## Prerequisites

### System Requirements

- **Node.js**: v20.0.0 or higher
- **npm**: v9.0.0 or higher (or yarn/pnpm equivalent)
- **Git**: Latest version
- **Docker**: v20.0.0 or higher (for containerized deployment)
- **PostgreSQL**: v14.0 or higher (if not using Supabase)

### Hardware Requirements

**Minimum (Development):**
- 4GB RAM
- 2 CPU cores
- 10GB disk space

**Recommended (Production):**
- 8GB RAM
- 4 CPU cores
- 50GB disk space
- SSD storage

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/n8n-workflow-converter.git
cd n8n-workflow-converter
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the environment template:

```bash
cp .env.example .env.local
```

### 4. Configure Environment Variables

Edit `.env.local` with your configuration:

```env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Provider Keys (Optional)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_AI_API_KEY=your_google_ai_key

# Security
VIRUSTOTAL_API_KEY=your_virustotal_key
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Database (if using standalone mode)
DATABASE_URL=postgresql://user:password@localhost:5432/n8n_converter
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Supabase Self-Hosting

### Option 1: Supabase Cloud (Recommended for beginners)

1. **Create Supabase Project**
   - Visit [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and API keys

2. **Run Database Migrations**
   ```bash
   npx supabase db push
   ```

3. **Configure Storage Buckets**
   ```bash
   npx supabase storage create workflow-files
   npx supabase storage create generated-projects
   ```

### Option 2: Self-Hosted Supabase

#### Prerequisites
- Docker and Docker Compose
- At least 4GB RAM available

#### Setup Steps

1. **Clone Supabase**
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   ```

2. **Configure Supabase**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```env
   POSTGRES_PASSWORD=your_secure_password
   JWT_SECRET=your_jwt_secret
   ANON_KEY=your_anon_key
   SERVICE_ROLE_KEY=your_service_role_key
   SITE_URL=http://localhost:3000
   ```

3. **Start Supabase Services**
   ```bash
   docker-compose up -d
   ```

4. **Access Supabase Studio**
   - Open `http://localhost:8000`
   - Use the credentials from your `.env` file

5. **Run Application Migrations**
   ```bash
   # In your application directory
   npx supabase db push --db-url postgresql://postgres:your_password@localhost:5432/postgres
   ```

#### Supabase Services Overview

| Service | Port | Description |
|---------|------|-------------|
| Studio | 8000 | Web interface |
| API Gateway | 8000 | REST/GraphQL API |
| Database | 5432 | PostgreSQL |
| Auth | 9999 | Authentication service |
| Storage | 5000 | File storage |
| Edge Functions | 54321 | Serverless functions |

## Environment Configuration

### Complete Environment Variables Reference

```env
# ===========================================
# APPLICATION CONFIGURATION
# ===========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
PORT=3000

# ===========================================
# SUPABASE CONFIGURATION
# ===========================================
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ===========================================
# DATABASE CONFIGURATION (Standalone Mode)
# ===========================================
DATABASE_URL=postgresql://user:password@localhost:5432/n8n_converter
DATABASE_POOL_SIZE=10
DATABASE_SSL=false

# ===========================================
# AUTHENTICATION
# ===========================================
NEXTAUTH_SECRET=your_nextauth_secret_min_32_chars
NEXTAUTH_URL=http://localhost:3000

# OAuth Providers (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# ===========================================
# AI PROVIDERS
# ===========================================
OPENAI_API_KEY=sk-your_openai_key
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
GOOGLE_AI_API_KEY=your_google_ai_key

# Default AI Provider (openai|anthropic|google)
DEFAULT_AI_PROVIDER=openai

# ===========================================
# SECURITY
# ===========================================
VIRUSTOTAL_API_KEY=your_virustotal_key
ENCRYPTION_KEY=your_32_char_encryption_key
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# ===========================================
# FILE STORAGE
# ===========================================
# Supabase Storage
SUPABASE_STORAGE_URL=http://localhost:8000/storage/v1
STORAGE_BUCKET_WORKFLOWS=workflow-files
STORAGE_BUCKET_PROJECTS=generated-projects

# Local Storage (Alternative)
LOCAL_STORAGE_PATH=./storage
MAX_FILE_SIZE=10485760

# ===========================================
# REDIS (Optional - for caching)
# ===========================================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# ===========================================
# MONITORING & LOGGING
# ===========================================
LOG_LEVEL=info
ENABLE_ANALYTICS=true
SENTRY_DSN=your_sentry_dsn

# ===========================================
# PERFORMANCE
# ===========================================
ENABLE_COMPRESSION=true
CACHE_TTL=3600
MAX_CONCURRENT_GENERATIONS=5
```

### Environment Variable Validation

The application includes built-in validation for required environment variables. Missing or invalid variables will be reported on startup.

## Deployment Options

### 1. Docker Deployment

See [Docker Containerization](#docker-containerization) section below.

### 2. Vercel Deployment

1. **Fork the Repository**
2. **Connect to Vercel**
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

3. **Environment Variables in Vercel**
   ```bash
   # Add these in Vercel dashboard
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXTAUTH_SECRET
   OPENAI_API_KEY
   VIRUSTOTAL_API_KEY
   ```

### 3. Railway Deployment

1. **Connect Repository**
   ```bash
   railway login
   railway link
   ```

2. **Set Environment Variables**
   ```bash
   railway variables set NEXT_PUBLIC_SUPABASE_URL=your_url
   railway variables set SUPABASE_SERVICE_ROLE_KEY=your_key
   ```

3. **Deploy**
   ```bash
   railway up
   ```

### 4. DigitalOcean App Platform

1. **Create App Spec**
   ```yaml
   name: n8n-workflow-converter
   services:
   - name: web
     source_dir: /
     github:
       repo: your-username/n8n-workflow-converter
       branch: main
     run_command: npm start
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: NEXT_PUBLIC_SUPABASE_URL
       value: your_supabase_url
     - key: SUPABASE_SERVICE_ROLE_KEY
       value: your_service_key
   ```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues

**Problem**: Cannot connect to database
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions**:
- Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Check DATABASE_URL format: `postgresql://user:password@host:port/database`
- Ensure firewall allows connections on port 5432
- For Docker: Use container name instead of localhost

#### 2. Supabase Authentication Errors

**Problem**: Invalid JWT token
```
Error: JWT expired or invalid
```

**Solutions**:
- Verify SUPABASE_SERVICE_ROLE_KEY is correct
- Check JWT_SECRET matches between app and Supabase
- Ensure system time is synchronized
- Regenerate keys if necessary

#### 3. File Upload Issues

**Problem**: File uploads fail
```
Error: Storage bucket not found
```

**Solutions**:
- Verify storage buckets exist in Supabase
- Check bucket policies allow uploads
- Ensure STORAGE_BUCKET_* variables are set correctly
- Verify file size limits

#### 4. AI Provider Errors

**Problem**: Code generation fails
```
Error: Invalid API key for OpenAI
```

**Solutions**:
- Verify API keys are valid and have sufficient credits
- Check API key format (should start with sk- for OpenAI)
- Ensure DEFAULT_AI_PROVIDER matches available keys
- Test API keys independently

#### 5. Memory Issues

**Problem**: Application crashes with out of memory
```
Error: JavaScript heap out of memory
```

**Solutions**:
- Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096"`
- Reduce MAX_CONCURRENT_GENERATIONS
- Monitor memory usage with `htop` or similar
- Consider upgrading server resources

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

### Health Checks

The application provides health check endpoints:

- `/api/health` - Overall application health
- `/api/health/database` - Database connectivity
- `/api/health/storage` - Storage service status
- `/api/health/external-services` - AI providers and external APIs

### Log Analysis

Application logs are structured and include:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "User uploaded workflow",
  "userId": "uuid",
  "projectId": "uuid",
  "metadata": {
    "fileSize": 1024,
    "nodeCount": 5
  }
}
```

## Maintenance

### Regular Tasks

#### 1. Database Maintenance

```bash
# Vacuum and analyze (weekly)
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Clean old logs (monthly)
psql $DATABASE_URL -c "DELETE FROM generation_logs WHERE created_at < NOW() - INTERVAL '30 days';"
```

#### 2. Storage Cleanup

```bash
# Clean orphaned files (monthly)
npm run cleanup:storage

# Check storage usage
npm run storage:usage
```

#### 3. Security Updates

```bash
# Update dependencies (weekly)
npm audit
npm update

# Check for security vulnerabilities
npm audit --audit-level moderate
```

#### 4. Backup Procedures

**Database Backup**:
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql $DATABASE_URL < backup_file.sql
```

**Storage Backup**:
```bash
# Backup Supabase storage
supabase storage download --recursive workflow-files ./backups/workflows/
supabase storage download --recursive generated-projects ./backups/projects/
```

### Monitoring

#### 1. Application Metrics

Monitor these key metrics:
- Response times
- Error rates
- Memory usage
- CPU utilization
- Database connections
- Storage usage

#### 2. Alerting

Set up alerts for:
- Application downtime
- High error rates (>5%)
- Memory usage >80%
- Database connection failures
- Storage quota >90%

### Performance Optimization

#### 1. Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_projects_user_created 
ON projects(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_generation_logs_project_timestamp 
ON generation_logs(project_id, timestamp DESC);
```

#### 2. Caching Strategy

- Enable Redis for session storage
- Cache frequently accessed data
- Use CDN for static assets
- Implement query result caching

#### 3. Resource Limits

```env
# Optimize for your server capacity
MAX_CONCURRENT_GENERATIONS=3
DATABASE_POOL_SIZE=10
CACHE_TTL=3600
MAX_FILE_SIZE=10485760
```

## Support

### Getting Help

1. **Documentation**: Check this guide and other docs in `/docs`
2. **Issues**: Report bugs on GitHub Issues
3. **Discussions**: Join GitHub Discussions for questions
4. **Community**: Join our Discord/Slack community

### Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

### License

This project is licensed under the MIT License. See [LICENSE](../LICENSE) for details.