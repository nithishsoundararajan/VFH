# Supabase Self-Hosting Guide

This guide provides detailed instructions for self-hosting Supabase for the n8n Workflow Converter application. Self-hosting Supabase gives you complete control over your data and infrastructure.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Configuration](#configuration)
6. [Database Setup](#database-setup)
7. [Storage Configuration](#storage-configuration)
8. [Edge Functions](#edge-functions)
9. [Authentication Setup](#authentication-setup)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)

## Overview

Self-hosted Supabase provides:
- Full control over your data
- No vendor lock-in
- Custom configurations
- Enhanced security
- Cost optimization for large deployments

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │────│  Kong Gateway   │────│   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
            ┌───────▼───┐ ┌───▼───┐ ┌───▼────┐
            │   Auth    │ │Storage│ │ Edge   │
            │ (GoTrue)  │ │       │ │Functions│
            └───────────┘ └───────┘ └────────┘
```

## Prerequisites

### System Requirements

**Minimum Requirements:**
- 4GB RAM
- 2 CPU cores
- 20GB disk space
- Docker 20.10+
- Docker Compose 2.0+

**Recommended for Production:**
- 8GB RAM
- 4 CPU cores
- 100GB SSD storage
- Load balancer
- Backup solution

### Software Dependencies

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Quick Start

### 1. Clone Supabase

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with secure values:

```env
############
# Secrets
############
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
ANON_KEY=your-anon-key
SERVICE_ROLE_KEY=your-service-role-key
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=this_password_is_insecure_and_should_be_updated

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API Proxy
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# API
############
SUPABASE_PUBLIC_URL=http://localhost:8000
SUPABASE_URL=http://localhost:8000

############
# Auth
############
SITE_URL=http://localhost:3000
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=http://localhost:8000

############
# Email Auth
############
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=fake_sender

############
# Phone Auth
############
ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Verify Installation

```bash
# Check all services are running
docker-compose ps

# Access Supabase Studio
open http://localhost:8000
```

## Detailed Setup

### Environment Configuration

#### Generate Secure Keys

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate anon key
docker run --rm supabase/gotrue:latest gotrue generate anon --jwt-secret="your-jwt-secret"

# Generate service role key
docker run --rm supabase/gotrue:latest gotrue generate service_role --jwt-secret="your-jwt-secret"
```

#### Production Environment Variables

```env
############
# Production Settings
############
POSTGRES_PASSWORD=your-production-password-min-32-chars
JWT_SECRET=your-production-jwt-secret-min-32-chars
ANON_KEY=your-generated-anon-key
SERVICE_ROLE_KEY=your-generated-service-role-key

# Use strong dashboard credentials
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your-secure-dashboard-password

############
# Network Configuration
############
SUPABASE_PUBLIC_URL=https://your-domain.com
SITE_URL=https://your-app-domain.com
API_EXTERNAL_URL=https://your-domain.com

############
# SSL Configuration
############
KONG_HTTPS_PORT=443
SSL_CERT_PATH=/path/to/your/cert.pem
SSL_KEY_PATH=/path/to/your/key.pem

############
# Email Configuration (Production SMTP)
############
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_SENDER_NAME=n8n Workflow Converter
SMTP_ADMIN_EMAIL=admin@your-domain.com

############
# Security
############
DISABLE_SIGNUP=true  # Disable public signup in production
ENABLE_EMAIL_AUTOCONFIRM=false
SECURITY_CAPTCHA_ENABLED=true
SECURITY_CAPTCHA_SECRET=your-captcha-secret
```

### Custom Docker Compose

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  # Override base services for production
  kong:
    image: kong:2.8-alpine
    restart: unless-stopped
    ports:
      - "80:8000"
      - "443:8443"
    volumes:
      - ./volumes/api/kong.yml:/var/lib/kong/kong.yml:ro
      - ./volumes/ssl:/etc/ssl/certs:ro
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
      KONG_SSL_CERT: /etc/ssl/certs/cert.pem
      KONG_SSL_CERT_KEY: /etc/ssl/certs/key.pem

  db:
    image: supabase/postgres:15.1.0.117
    restart: unless-stopped
    ports:
      - "5432:5432"
    volumes:
      - ./volumes/db/data:/var/lib/postgresql/data:Z
      - ./volumes/db/init:/docker-entrypoint-initdb.d:Z
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - log_min_messages=fatal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Add backup service
  db-backup:
    image: postgres:15-alpine
    restart: unless-stopped
    volumes:
      - ./volumes/backups:/backups
      - ./scripts/backup.sh:/backup.sh:ro
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST: db
      POSTGRES_DB: ${POSTGRES_DB}
    command: ["/backup.sh"]
    depends_on:
      - db

  # Add monitoring
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

volumes:
  prometheus_data:
```

## Database Setup

### 1. Initialize Application Schema

Create `init-app-schema.sql`:

```sql
-- Create application-specific schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set up extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application user
CREATE USER app_user WITH PASSWORD 'secure_app_password';
GRANT USAGE ON SCHEMA app TO app_user;
GRANT USAGE ON SCHEMA analytics TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO app_user;

-- Set up Row Level Security
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON SEQUENCES TO app_user;
```

### 2. Run Application Migrations

```bash
# Copy your migration files
cp -r ../supabase/migrations ./volumes/db/init/

# Restart database to apply migrations
docker-compose restart db
```

### 3. Database Performance Tuning

Create `postgresql.conf`:

```conf
# Memory Configuration
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connection Settings
max_connections = 100
shared_preload_libraries = 'pg_stat_statements'

# Logging
log_statement = 'all'
log_duration = on
log_min_duration_statement = 1000

# Performance
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Replication (if needed)
wal_level = replica
max_wal_senders = 3
```

## Storage Configuration

### 1. Storage Service Setup

The storage service handles file uploads and downloads. Configure it in your environment:

```env
############
# Storage Configuration
############
STORAGE_BACKEND=file
FILE_SIZE_LIMIT=52428800
FILE_STORAGE_BACKEND_PATH=/var/lib/storage
STORAGE_S3_REGION=us-east-1
STORAGE_S3_BUCKET=your-bucket-name
```

### 2. Create Storage Buckets

```sql
-- Connect to your Supabase instance and run:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('workflow-files', 'workflow-files', false, 52428800, '{"application/json"}'),
  ('generated-projects', 'generated-projects', false, 104857600, '{"application/zip", "application/x-zip-compressed"}');

-- Set up storage policies
CREATE POLICY "Users can upload workflow files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'workflow-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can download their workflow files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'workflow-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload generated projects" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'generated-projects' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can download their generated projects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'generated-projects' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 3. Storage Backup Script

Create `scripts/backup-storage.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backups/storage"
STORAGE_DIR="/var/lib/storage"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup storage files
tar -czf "$BACKUP_DIR/storage_backup_$DATE.tar.gz" -C "$STORAGE_DIR" .

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "storage_backup_*.tar.gz" -mtime +7 -delete

echo "Storage backup completed: storage_backup_$DATE.tar.gz"
```

## Edge Functions

### 1. Edge Functions Setup

Edge Functions provide serverless compute capabilities. Set up the Deno runtime:

```yaml
# Add to docker-compose.yml
edge-functions:
  image: supabase/edge-runtime:v1.2.0
  restart: unless-stopped
  ports:
    - "54321:9000"
  volumes:
    - ./volumes/functions:/home/deno/functions:ro
  environment:
    SUPABASE_URL: http://kong:8000
    SUPABASE_ANON_KEY: ${ANON_KEY}
    SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
```

### 2. Deploy Application Edge Functions

```bash
# Copy your edge functions
cp -r ../supabase/functions ./volumes/

# Restart edge functions service
docker-compose restart edge-functions
```

### 3. Edge Function Environment Variables

Create `volumes/functions/.env`:

```env
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_AI_API_KEY=your_google_ai_key
VIRUSTOTAL_API_KEY=your_virustotal_key
```

## Authentication Setup

### 1. Configure OAuth Providers

Edit your `.env` file:

```env
############
# OAuth Configuration
############
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=your_google_client_id
GOTRUE_EXTERNAL_GOOGLE_SECRET=your_google_client_secret
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=http://localhost:8000/auth/v1/callback

GOTRUE_EXTERNAL_GITHUB_ENABLED=true
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=your_github_client_id
GOTRUE_EXTERNAL_GITHUB_SECRET=your_github_client_secret
GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=http://localhost:8000/auth/v1/callback
```

### 2. Email Templates

Create custom email templates in `volumes/auth/templates/`:

```html
<!-- volumes/auth/templates/confirmation.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Confirm Your Email</title>
</head>
<body>
    <h1>Welcome to n8n Workflow Converter!</h1>
    <p>Please confirm your email address by clicking the link below:</p>
    <a href="{{ .ConfirmationURL }}">Confirm Email</a>
</body>
</html>
```

### 3. Custom Auth Hooks

Create `volumes/auth/hooks/`:

```javascript
// volumes/auth/hooks/send-email.js
export default async function sendEmail(event) {
  const { user, email_data } = event;
  
  // Custom email sending logic
  console.log(`Sending email to ${user.email}`);
  
  return {
    success: true
  };
}
```

## Monitoring

### 1. Prometheus Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'supabase-kong'
    static_configs:
      - targets: ['kong:8001']
    metrics_path: /metrics

  - job_name: 'supabase-postgres'
    static_configs:
      - targets: ['db:5432']
    metrics_path: /metrics

  - job_name: 'supabase-gotrue'
    static_configs:
      - targets: ['auth:9999']
    metrics_path: /metrics
```

### 2. Grafana Dashboard

Create `monitoring/grafana/dashboards/supabase.json`:

```json
{
  "dashboard": {
    "title": "Supabase Monitoring",
    "panels": [
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"postgres\"}"
          }
        ]
      },
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "kong_http_status"
          }
        ]
      }
    ]
  }
}
```

### 3. Health Check Script

Create `scripts/health-check.sh`:

```bash
#!/bin/bash

# Check all services
services=("kong" "db" "auth" "rest" "realtime" "storage" "edge-functions")

for service in "${services[@]}"; do
    if docker-compose ps $service | grep -q "Up"; then
        echo "✅ $service is running"
    else
        echo "❌ $service is not running"
        exit 1
    fi
done

# Check API endpoints
endpoints=(
    "http://localhost:8000/health"
    "http://localhost:8000/rest/v1/"
    "http://localhost:8000/auth/v1/health"
    "http://localhost:8000/storage/v1/health"
)

for endpoint in "${endpoints[@]}"; do
    if curl -f -s "$endpoint" > /dev/null; then
        echo "✅ $endpoint is responding"
    else
        echo "❌ $endpoint is not responding"
        exit 1
    fi
done

echo "🎉 All services are healthy!"
```

## Troubleshooting

### Common Issues

#### 1. Services Won't Start

```bash
# Check logs
docker-compose logs kong
docker-compose logs db
docker-compose logs auth

# Check disk space
df -h

# Check memory usage
free -h

# Restart services
docker-compose restart
```

#### 2. Database Connection Issues

```bash
# Test database connection
docker-compose exec db psql -U postgres -c "SELECT version();"

# Check database logs
docker-compose logs db

# Reset database
docker-compose down -v
docker-compose up -d
```

#### 3. Authentication Problems

```bash
# Check auth service logs
docker-compose logs auth

# Verify JWT secret
echo $JWT_SECRET | wc -c  # Should be 32+ characters

# Test auth endpoint
curl http://localhost:8000/auth/v1/health
```

#### 4. Storage Issues

```bash
# Check storage service
docker-compose logs storage

# Verify storage directory permissions
ls -la volumes/storage/

# Test storage endpoint
curl http://localhost:8000/storage/v1/health
```

### Performance Issues

#### 1. Slow Database Queries

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

#### 2. High Memory Usage

```bash
# Check container memory usage
docker stats

# Optimize PostgreSQL memory settings
# Edit postgresql.conf
shared_buffers = 25% of RAM
effective_cache_size = 75% of RAM
```

#### 3. Network Issues

```bash
# Check network connectivity
docker network ls
docker network inspect supabase_default

# Test internal connectivity
docker-compose exec kong ping db
docker-compose exec auth ping db
```

### Backup and Recovery

#### 1. Database Backup

```bash
# Create backup
docker-compose exec db pg_dump -U postgres postgres > backup.sql

# Restore backup
docker-compose exec -T db psql -U postgres postgres < backup.sql
```

#### 2. Full System Backup

```bash
# Stop services
docker-compose down

# Backup volumes
tar -czf supabase-backup-$(date +%Y%m%d).tar.gz volumes/

# Restart services
docker-compose up -d
```

#### 3. Disaster Recovery

```bash
# Restore from backup
docker-compose down -v
tar -xzf supabase-backup-YYYYMMDD.tar.gz
docker-compose up -d
```

This comprehensive guide should help you successfully self-host Supabase for your n8n Workflow Converter application. Remember to regularly backup your data and monitor your services for optimal performance.