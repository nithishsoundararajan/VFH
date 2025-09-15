# Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with the n8n Workflow Converter application.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Configuration Problems](#configuration-problems)
4. [Runtime Errors](#runtime-errors)
5. [Performance Issues](#performance-issues)
6. [Database Problems](#database-problems)
7. [Authentication Issues](#authentication-issues)
8. [File Upload/Storage Issues](#file-uploadstorage-issues)
9. [AI Provider Issues](#ai-provider-issues)
10. [Deployment Problems](#deployment-problems)
11. [Debug Tools](#debug-tools)
12. [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check Commands

Run these commands to quickly identify issues:

```bash
# Check application health
curl http://localhost:3000/api/health

# Check environment variables
npm run validate-env

# Check dependencies
npm ls --depth=0

# Check system resources
df -h  # Disk space
free -h  # Memory usage
```

### Common Status Indicators

| Status | Meaning | Action |
|--------|---------|--------|
| 🟢 Healthy | Service running normally | No action needed |
| 🟡 Warning | Service degraded | Monitor closely |
| 🔴 Error | Service unavailable | Immediate attention required |
| ⚪ Unknown | Status unclear | Check logs |

## Installation Issues

### Node.js Version Problems

**Problem**: Application fails to start with Node.js version errors

```
Error: The engine "node" is incompatible with this module
```

**Solutions**:

```bash
# Check Node.js version
node --version

# Install correct version (v20+)
nvm install 20
nvm use 20

# Or using n
n 20

# Verify installation
node --version
npm --version
```

### Dependency Installation Failures

**Problem**: `npm install` fails with errors

**Common causes and solutions**:

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json
npm install

# Use specific npm version
npm install -g npm@latest

# Check for permission issues (Linux/Mac)
sudo chown -R $(whoami) ~/.npm
```

**Python/Build tools missing**:

```bash
# Ubuntu/Debian
sudo apt-get install build-essential python3

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install python3

# macOS
xcode-select --install

# Windows
npm install -g windows-build-tools
```

### Port Already in Use

**Problem**: Cannot start server on port 3000

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions**:

```bash
# Find process using port 3000
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows

# Use different port
PORT=3001 npm run dev
```

## Configuration Problems

### Environment Variable Issues

**Problem**: Missing or invalid environment variables

**Diagnostic steps**:

```bash
# Run validation script
npm run validate-env

# Check specific variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $OPENAI_API_KEY

# List all environment variables
printenv | grep -E "(SUPABASE|OPENAI|NEXTAUTH)"
```

**Common fixes**:

```bash
# Copy template
cp .env.example .env.local

# Check file permissions
ls -la .env*

# Verify file encoding (should be UTF-8)
file .env.local
```

### Supabase Configuration Issues

**Problem**: Cannot connect to Supabase

**Diagnostic commands**:

```bash
# Test Supabase connection
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"

# Check project status
# Visit Supabase dashboard to verify project is active
```

**Common solutions**:

1. **Invalid URL format**:
   ```env
   # Correct format
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   
   # Incorrect (missing https://)
   NEXT_PUBLIC_SUPABASE_URL=your-project-id.supabase.co
   ```

2. **Wrong API keys**:
   ```bash
   # Regenerate keys in Supabase dashboard
   # Update .env.local with new keys
   ```

3. **Project paused**:
   - Check Supabase dashboard
   - Unpause project if needed

### Database Migration Issues

**Problem**: Database schema is outdated or corrupted

**Solutions**:

```bash
# Check migration status
npx supabase db diff

# Reset database (development only)
npx supabase db reset

# Apply specific migration
npx supabase db push

# Check database connection
psql $DATABASE_URL -c "SELECT version();"
```

## Runtime Errors

### Application Crashes

**Problem**: Application crashes unexpectedly

**Diagnostic steps**:

1. **Check logs**:
   ```bash
   # Application logs
   tail -f logs/app.log
   
   # System logs
   journalctl -u your-app-service -f
   
   # Docker logs (if using containers)
   docker logs container-name -f
   ```

2. **Memory issues**:
   ```bash
   # Check memory usage
   free -h
   htop
   
   # Increase Node.js memory limit
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

3. **Unhandled exceptions**:
   ```javascript
   // Add to your app
   process.on('uncaughtException', (error) => {
     console.error('Uncaught Exception:', error);
     process.exit(1);
   });
   
   process.on('unhandledRejection', (reason, promise) => {
     console.error('Unhandled Rejection at:', promise, 'reason:', reason);
   });
   ```

### API Endpoint Errors

**Problem**: API endpoints return 500 errors

**Debugging steps**:

```bash
# Check API health
curl -v http://localhost:3000/api/health

# Test specific endpoints
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check request logs
tail -f logs/requests.log
```

**Common causes**:

1. **Database connection lost**
2. **Missing environment variables**
3. **Unhandled async errors**
4. **Rate limiting triggered**

### Next.js Build Issues

**Problem**: Build fails with errors

```bash
# Clear Next.js cache
rm -rf .next

# Check for TypeScript errors
npx tsc --noEmit

# Build with verbose output
npm run build -- --debug

# Check for circular dependencies
npx madge --circular src/
```

## Performance Issues

### Slow Page Load Times

**Problem**: Pages load slowly

**Diagnostic tools**:

```bash
# Lighthouse audit
npx lighthouse http://localhost:3000 --output html

# Bundle analyzer
npm run analyze

# Performance monitoring
npm run perf:monitor
```

**Optimization steps**:

1. **Enable compression**:
   ```env
   ENABLE_COMPRESSION=true
   ```

2. **Optimize images**:
   ```bash
   # Install image optimization
   npm install next-optimized-images
   ```

3. **Code splitting**:
   ```javascript
   // Use dynamic imports
   const Component = dynamic(() => import('./Component'));
   ```

### High Memory Usage

**Problem**: Application consumes too much memory

**Monitoring**:

```bash
# Monitor memory usage
node --inspect app.js
# Open chrome://inspect in Chrome

# Memory profiling
npm install -g clinic
clinic doctor -- node app.js
```

**Solutions**:

1. **Increase memory limit**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=8192" npm start
   ```

2. **Optimize database queries**:
   ```sql
   -- Add indexes
   CREATE INDEX idx_projects_user_id ON projects(user_id);
   
   -- Limit query results
   SELECT * FROM projects LIMIT 100;
   ```

3. **Implement caching**:
   ```env
   ENABLE_CACHING=true
   CACHE_TTL=3600
   ```

### Database Performance

**Problem**: Slow database queries

**Diagnostic queries**:

```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public';
```

**Optimization steps**:

```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_projects_created_at ON projects(created_at);
CREATE INDEX CONCURRENTLY idx_generation_logs_project_id ON generation_logs(project_id);

-- Vacuum and analyze
VACUUM ANALYZE;

-- Update table statistics
ANALYZE projects;
```

## Database Problems

### Connection Issues

**Problem**: Cannot connect to database

**Diagnostic steps**:

```bash
# Test connection
pg_isready -h localhost -p 5432

# Test with psql
psql $DATABASE_URL -c "SELECT version();"

# Check connection string format
echo $DATABASE_URL
```

**Common solutions**:

1. **Database not running**:
   ```bash
   # Start PostgreSQL
   sudo systemctl start postgresql  # Linux
   brew services start postgresql   # macOS
   ```

2. **Wrong connection parameters**:
   ```env
   # Correct format
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

3. **Firewall blocking connection**:
   ```bash
   # Check firewall rules
   sudo ufw status  # Ubuntu
   sudo firewall-cmd --list-all  # CentOS
   ```

### Migration Failures

**Problem**: Database migrations fail

**Diagnostic steps**:

```bash
# Check migration status
npx supabase migration list

# Check for conflicts
npx supabase db diff

# Validate migration files
npx supabase migration validate
```

**Solutions**:

1. **Rollback and retry**:
   ```bash
   # Rollback to previous migration
   npx supabase migration down
   
   # Fix migration file
   # Retry migration
   npx supabase db push
   ```

2. **Manual migration**:
   ```bash
   # Apply migration manually
   psql $DATABASE_URL -f supabase/migrations/001_initial.sql
   ```

### Data Corruption

**Problem**: Database data appears corrupted

**Recovery steps**:

```bash
# Check database integrity
psql $DATABASE_URL -c "SELECT pg_database_size(current_database());"

# Backup current state
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql $DATABASE_URL < backup_file.sql

# Rebuild indexes
psql $DATABASE_URL -c "REINDEX DATABASE your_database;"
```

## Authentication Issues

### Login Failures

**Problem**: Users cannot log in

**Diagnostic steps**:

```bash
# Check auth service
curl http://localhost:8000/auth/v1/health

# Test auth endpoint
curl -X POST http://localhost:8000/auth/v1/token \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

**Common causes**:

1. **Invalid credentials**
2. **Email not confirmed**
3. **Account locked/disabled**
4. **JWT secret mismatch**

### OAuth Provider Issues

**Problem**: OAuth login fails

**Solutions**:

1. **Check OAuth configuration**:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

2. **Verify redirect URLs**:
   - Check OAuth provider settings
   - Ensure redirect URL matches exactly

3. **Test OAuth flow**:
   ```bash
   # Check OAuth endpoint
   curl "https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=email"
   ```

### Session Issues

**Problem**: User sessions expire unexpectedly

**Solutions**:

1. **Check JWT configuration**:
   ```env
   JWT_EXPIRY=3600  # 1 hour
   NEXTAUTH_SECRET=your-secret-min-32-chars
   ```

2. **Verify system time**:
   ```bash
   # Check system time
   date
   
   # Sync time if needed
   sudo ntpdate -s time.nist.gov
   ```

## File Upload/Storage Issues

### Upload Failures

**Problem**: File uploads fail

**Diagnostic steps**:

```bash
# Check storage service
curl http://localhost:8000/storage/v1/health

# Test file upload
curl -X POST http://localhost:3000/api/files/upload \
  -F "file=@test.json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Common causes**:

1. **File size too large**:
   ```env
   MAX_FILE_SIZE=10485760  # 10MB
   ```

2. **Invalid file type**:
   ```env
   ALLOWED_FILE_TYPES=application/json,application/zip
   ```

3. **Storage quota exceeded**
4. **Permissions issues**

### Storage Bucket Issues

**Problem**: Cannot access storage buckets

**Solutions**:

```sql
-- Check bucket policies
SELECT * FROM storage.buckets;

-- Update bucket policy
UPDATE storage.buckets 
SET public = false 
WHERE id = 'workflow-files';

-- Check object permissions
SELECT * FROM storage.objects LIMIT 10;
```

## AI Provider Issues

### API Key Problems

**Problem**: AI API calls fail with authentication errors

**Diagnostic steps**:

```bash
# Test OpenAI API
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models

# Test Anthropic API
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     https://api.anthropic.com/v1/messages

# Check API key format
echo $OPENAI_API_KEY | cut -c1-10  # Should start with "sk-"
```

**Solutions**:

1. **Verify API key format**
2. **Check API quota/credits**
3. **Regenerate API key**
4. **Test with different provider**

### Rate Limiting

**Problem**: AI API calls are rate limited

**Solutions**:

```env
# Reduce concurrent requests
MAX_CONCURRENT_GENERATIONS=2

# Add retry logic
AI_RETRY_ATTEMPTS=3
AI_RETRY_DELAY=1000
```

### Model Availability

**Problem**: Specific AI models are unavailable

**Solutions**:

```javascript
// Implement fallback models
const modelFallbacks = {
  'gpt-4': 'gpt-3.5-turbo',
  'claude-3-opus': 'claude-3-sonnet',
};
```

## Deployment Problems

### Docker Issues

**Problem**: Docker containers fail to start

**Diagnostic steps**:

```bash
# Check container status
docker ps -a

# Check container logs
docker logs container-name

# Check resource usage
docker stats

# Inspect container
docker inspect container-name
```

**Common solutions**:

1. **Insufficient resources**:
   ```yaml
   # docker-compose.yml
   services:
     app:
       deploy:
         resources:
           limits:
             memory: 2G
             cpus: '1.0'
   ```

2. **Port conflicts**:
   ```yaml
   ports:
     - "3001:3000"  # Use different host port
   ```

3. **Volume mount issues**:
   ```bash
   # Check permissions
   ls -la volumes/
   
   # Fix permissions
   sudo chown -R 1000:1000 volumes/
   ```

### Vercel Deployment Issues

**Problem**: Deployment fails on Vercel

**Common causes and solutions**:

1. **Build timeout**:
   ```json
   // vercel.json
   {
     "builds": [
       {
         "src": "package.json",
         "use": "@vercel/node",
         "config": {
           "maxLambdaSize": "50mb"
         }
       }
     ]
   }
   ```

2. **Environment variables missing**:
   - Check Vercel dashboard
   - Ensure all required variables are set

3. **Function size limits**:
   ```javascript
   // Optimize bundle size
   export const config = {
     runtime: 'nodejs18.x',
     maxDuration: 30,
   };
   ```

### SSL/TLS Issues

**Problem**: HTTPS certificate errors

**Solutions**:

```bash
# Check certificate validity
openssl x509 -in cert.pem -text -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443

# Renew Let's Encrypt certificate
certbot renew --dry-run
```

## Debug Tools

### Logging Configuration

**Enable debug logging**:

```env
LOG_LEVEL=debug
NODE_ENV=development
DEBUG=*
```

**Structured logging**:

```javascript
// lib/logger.js
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### Performance Monitoring

**Add performance monitoring**:

```javascript
// lib/monitoring.js
export function measurePerformance(name, fn) {
  return async (...args) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      console.log(`${name} took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  };
}
```

### Health Check Endpoints

**Implement comprehensive health checks**:

```javascript
// pages/api/health/index.js
export default async function handler(req, res) {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    ai_providers: await checkAIProviders(),
    external_services: await checkExternalServices(),
  };

  const isHealthy = Object.values(checks).every(check => check.status === 'ok');
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
}
```

## Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Search existing issues on GitHub**
3. **Check application logs**
4. **Run diagnostic commands**
5. **Try minimal reproduction**

### Information to Include

When reporting issues, include:

```bash
# System information
uname -a
node --version
npm --version

# Application information
npm run validate-env
curl http://localhost:3000/api/health

# Error logs
tail -n 50 logs/error.log

# Configuration (sanitized)
cat .env.local | sed 's/=.*/=***REDACTED***/'
```

### Support Channels

1. **GitHub Issues**: Bug reports and feature requests
2. **GitHub Discussions**: Questions and community help
3. **Documentation**: Check all docs in `/docs` folder
4. **Community Discord/Slack**: Real-time help

### Creating Minimal Reproduction

```bash
# Create minimal test case
git clone https://github.com/your-org/n8n-workflow-converter.git test-case
cd test-case
git checkout -b reproduce-issue

# Minimal configuration
cp .env.example .env.local
# Edit with minimal required variables

# Document steps to reproduce
echo "Steps to reproduce:" > REPRODUCE.md
echo "1. npm install" >> REPRODUCE.md
echo "2. npm run dev" >> REPRODUCE.md
echo "3. Navigate to..." >> REPRODUCE.md
```

This troubleshooting guide should help you resolve most common issues. If you encounter problems not covered here, please contribute by documenting the solution for others.