# Docker Deployment Guide

This guide covers deploying the n8n Workflow Converter using Docker and Docker Compose, providing both simple and full-stack deployment options.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Deployment Options](#deployment-options)
3. [Configuration](#configuration)
4. [Development Setup](#development-setup)
5. [Production Deployment](#production-deployment)
6. [Monitoring and Logging](#monitoring-and-logging)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

## Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- At least 4GB RAM and 20GB disk space
- Basic understanding of Docker concepts

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/n8n-workflow-converter.git
cd n8n-workflow-converter
```

### 2. Configure Environment

```bash
# Copy Docker environment template
cp .env.docker .env.production

# Edit configuration (see Configuration section below)
nano .env.production
```

### 3. Run Setup Script

```bash
# Make setup script executable (Linux/Mac)
chmod +x scripts/docker-setup.sh

# Run automated setup
./scripts/docker-setup.sh
```

### 4. Access Application

- **Application**: http://localhost:3000
- **Monitoring**: http://localhost:3001 (Grafana)
- **Metrics**: http://localhost:9090 (Prometheus)

## Deployment Options

### Option 1: Simple Deployment (Supabase Backend)

Uses the existing `docker-compose.yml` with Supabase as the backend:

```bash
# Start with Supabase backend
docker-compose up -d
```

**Services included:**
- Next.js application
- Redis for caching
- Nginx reverse proxy
- Basic monitoring

### Option 2: Full Stack Deployment (Self-hosted)

Uses `docker-compose.full-stack.yml` with self-hosted database:

```bash
# Start full stack
docker-compose -f docker-compose.full-stack.yml up -d
```

**Services included:**
- Next.js application
- PostgreSQL database
- Redis for caching
- Nginx reverse proxy
- Prometheus monitoring
- Grafana dashboards
- Loki log aggregation
- Automated backups

### Option 3: Development Setup

Uses development overrides for hot reloading:

```bash
# Start development environment
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

**Development features:**
- Hot reloading
- Debug port exposed
- Development database
- Verbose logging

## Configuration

### Environment Variables

Edit `.env.production` with your configuration:

#### Required Variables

```env
# Database (for full-stack deployment)
POSTGRES_PASSWORD=your_secure_password_min_32_chars

# Authentication
NEXTAUTH_SECRET=your_secure_nextauth_secret_min_32_chars

# AI Provider (at least one required)
OPENAI_API_KEY=sk-your_openai_api_key
# OR
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
# OR
GOOGLE_AI_API_KEY=your_google_ai_key
```

#### Optional Variables

```env
# Security
VIRUSTOTAL_API_KEY=your_virustotal_key
ENCRYPTION_KEY=your_32_char_encryption_key

# OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Monitoring
GRAFANA_ADMIN_PASSWORD=your_grafana_password
SENTRY_DSN=your_sentry_dsn

# Email (for notifications)
SMTP_HOST=smtp.your-provider.com
SMTP_USER=your_email@domain.com
SMTP_PASS=your_email_password
```

### Service Configuration

#### PostgreSQL Tuning

For production, adjust PostgreSQL settings in `docker-compose.full-stack.yml`:

```yaml
postgres:
  command: >
    postgres 
    -c shared_buffers=512MB          # 25% of RAM
    -c effective_cache_size=2GB      # 75% of RAM
    -c maintenance_work_mem=128MB
    -c max_connections=100
```

#### Redis Configuration

Customize Redis settings in `redis.conf`:

```conf
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

#### Nginx Configuration

SSL and performance settings in `nginx/nginx.conf`:

```nginx
# Enable SSL (uncomment and configure)
# server {
#     listen 443 ssl http2;
#     ssl_certificate /etc/nginx/ssl/cert.pem;
#     ssl_certificate_key /etc/nginx/ssl/key.pem;
# }

# Performance tuning
client_max_body_size 50M;
gzip on;
gzip_types text/plain application/json application/javascript text/css;
```

## Development Setup

### Hot Reloading Development

```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f app

# Execute commands in container
docker-compose exec app npm run test
docker-compose exec app npm run lint
```

### Development Database

Access development database:

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d n8n_converter_dev

# Run migrations
docker-compose exec app npm run migrate

# Reset development data
docker-compose exec postgres psql -U postgres -d n8n_converter_dev -c "SELECT public.reset_dev_data();"
```

### Debugging

Enable Node.js debugger:

```bash
# Start with debugger
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# Connect debugger to localhost:9229
```

## Production Deployment

### Security Hardening

1. **Use strong passwords**:
   ```bash
   # Generate secure passwords
   openssl rand -base64 32
   ```

2. **Enable SSL**:
   ```bash
   # Generate SSL certificates
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout nginx/ssl/key.pem \
     -out nginx/ssl/cert.pem
   ```

3. **Configure firewall**:
   ```bash
   # Allow only necessary ports
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw deny 3000/tcp  # Block direct app access
   ```

### Resource Limits

Set resource limits in `docker-compose.full-stack.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'

  postgres:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

### Health Checks

Monitor service health:

```bash
# Run health check script
./scripts/docker-health-check.sh docker-compose.full-stack.yml true

# Check individual service health
docker-compose exec app curl -f http://localhost:3000/api/health
```

### Load Balancing

For high availability, use multiple app instances:

```yaml
services:
  app:
    deploy:
      replicas: 3
    ports:
      - "3000-3002:3000"

  nginx:
    # Configure upstream load balancing
```

## Monitoring and Logging

### Prometheus Metrics

Access Prometheus at http://localhost:9090

**Key metrics to monitor:**
- `http_requests_total` - Request count
- `http_request_duration_seconds` - Response time
- `nodejs_heap_size_used_bytes` - Memory usage
- `postgres_up` - Database health

### Grafana Dashboards

Access Grafana at http://localhost:3001 (admin/admin)

**Pre-configured dashboards:**
- Application Performance
- Database Metrics
- System Resources
- Error Rates

### Log Aggregation

Logs are collected by Promtail and stored in Loki:

```bash
# View application logs
docker-compose logs -f app

# Query logs in Grafana
# Use LogQL: {job="n8n-workflow-converter"} |= "error"
```

### Alerting

Configure alerts in `monitoring/rules/alerts.yml`:

```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  for: 5m
  annotations:
    summary: "High error rate detected"
```

## Backup and Recovery

### Automated Backups

Backups run automatically via the `db-backup` service:

```bash
# Check backup status
docker-compose logs db-backup

# List backups
ls -la backups/

# Manual backup
docker-compose exec db-backup /backup.sh
```

### Backup Configuration

Configure backup settings in `.env.production`:

```env
BACKUP_SCHEDULE=0 2 * * *        # Daily at 2 AM
BACKUP_RETENTION_DAYS=7          # Keep 7 days
BACKUP_COMPRESSION=gzip          # Compression type
```

### Recovery Procedures

#### Database Recovery

```bash
# Stop application
docker-compose stop app

# Restore from backup
docker-compose exec postgres psql -U postgres -d n8n_converter < backups/backup_file.sql

# Start application
docker-compose start app
```

#### Full System Recovery

```bash
# Stop all services
docker-compose down

# Restore volumes from backup
tar -xzf system-backup.tar.gz

# Start services
docker-compose up -d
```

### Cloud Backup Integration

Upload backups to cloud storage:

```bash
# AWS S3 example
aws s3 sync backups/ s3://your-backup-bucket/n8n-converter/

# Google Cloud Storage example
gsutil -m rsync -r backups/ gs://your-backup-bucket/n8n-converter/
```

## Troubleshooting

### Common Issues

#### 1. Services Won't Start

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs [service-name]

# Check resource usage
docker stats
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
docker-compose exec app pg_isready -h postgres -p 5432

# Check database logs
docker-compose logs postgres

# Verify environment variables
docker-compose exec app env | grep DATABASE_URL
```

#### 3. Memory Issues

```bash
# Check container memory usage
docker stats --no-stream

# Increase memory limits
# Edit docker-compose.yml deploy.resources.limits.memory

# Clear Docker cache
docker system prune -a
```

#### 4. SSL Certificate Issues

```bash
# Regenerate certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem

# Check certificate validity
openssl x509 -in nginx/ssl/cert.pem -text -noout
```

### Debug Commands

```bash
# Execute shell in container
docker-compose exec app sh
docker-compose exec postgres bash

# Check container filesystem
docker-compose exec app ls -la /app

# Monitor real-time logs
docker-compose logs -f --tail=100

# Check network connectivity
docker-compose exec app ping postgres
docker-compose exec app nslookup redis
```

### Performance Issues

#### Database Performance

```bash
# Check slow queries
docker-compose exec postgres psql -U postgres -d n8n_converter \
  -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Analyze table statistics
docker-compose exec postgres psql -U postgres -d n8n_converter \
  -c "SELECT * FROM public.analyze_table_stats();"
```

#### Application Performance

```bash
# Check Node.js memory usage
docker-compose exec app node -e "console.log(process.memoryUsage())"

# Profile application
docker-compose exec app npm run profile
```

## Maintenance

### Regular Tasks

#### Daily
- Check service health
- Monitor resource usage
- Review error logs

#### Weekly
- Update Docker images
- Clean up old logs
- Verify backups

#### Monthly
- Security updates
- Performance review
- Capacity planning

### Maintenance Commands

```bash
# Update all services
docker-compose pull
docker-compose up -d

# Clean up unused resources
docker system prune -a

# Rotate logs
docker-compose exec app npm run logs:rotate

# Database maintenance
docker-compose exec postgres psql -U postgres -d n8n_converter \
  -c "SELECT public.run_maintenance();"
```

### Scaling

#### Horizontal Scaling

```bash
# Scale application instances
docker-compose up -d --scale app=3

# Use external load balancer
# Configure HAProxy, AWS ALB, or similar
```

#### Vertical Scaling

```yaml
# Increase resource limits
services:
  app:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
```

### Monitoring Scripts

Create monitoring scripts for automation:

```bash
#!/bin/bash
# monitoring/check-health.sh

# Run health checks
./scripts/docker-health-check.sh

# Send alerts if unhealthy
if [ $? -ne 0 ]; then
    curl -X POST "$WEBHOOK_URL" -d "Service health check failed"
fi
```

This comprehensive Docker deployment guide should help you successfully deploy and maintain the n8n Workflow Converter in various environments, from development to production.