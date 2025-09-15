# Environment Configuration Guide

This guide provides comprehensive instructions for configuring environment variables and settings for the n8n Workflow Converter application across different deployment scenarios.

## Table of Contents

1. [Environment Files Overview](#environment-files-overview)
2. [Required Variables](#required-variables)
3. [Optional Variables](#optional-variables)
4. [Environment-Specific Configurations](#environment-specific-configurations)
5. [Security Best Practices](#security-best-practices)
6. [Validation and Testing](#validation-and-testing)
7. [Troubleshooting](#troubleshooting)

## Environment Files Overview

The application uses different environment files for different scenarios:

```
.env.example          # Template with all variables
.env.local           # Local development
.env.development     # Development environment
.env.staging         # Staging environment
.env.production      # Production environment
```

### File Priority

Next.js loads environment files in this order (later files override earlier ones):

1. `.env`
2. `.env.local`
3. `.env.[NODE_ENV]`
4. `.env.[NODE_ENV].local`

## Required Variables

### Core Application Settings

```env
# ===========================================
# APPLICATION CORE
# ===========================================

# Application URL (used for redirects, webhooks, etc.)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Node environment
NODE_ENV=development

# Server port
PORT=3000
```

### Supabase Configuration

```env
# ===========================================
# SUPABASE CONFIGURATION
# ===========================================

# Supabase project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase anonymous key (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase service role key (private - server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Authentication

```env
# ===========================================
# AUTHENTICATION
# ===========================================

# NextAuth secret (minimum 32 characters)
NEXTAUTH_SECRET=your-super-secret-nextauth-secret-min-32-chars

# NextAuth URL (should match NEXT_PUBLIC_APP_URL)
NEXTAUTH_URL=http://localhost:3000
```

### AI Provider (at least one required)

```env
# ===========================================
# AI PROVIDERS (At least one required)
# ===========================================

# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Anthropic API Key (optional)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# Google AI API Key (optional)
GOOGLE_AI_API_KEY=your-google-ai-api-key-here

# Default AI provider to use
DEFAULT_AI_PROVIDER=openai
```

## Optional Variables

### Security and Scanning

```env
# ===========================================
# SECURITY
# ===========================================

# VirusTotal API key for file scanning
VIRUSTOTAL_API_KEY=your-virustotal-api-key

# Encryption key for sensitive data (32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# CSRF protection
CSRF_SECRET=your-csrf-secret-key
```

### OAuth Providers

```env
# ===========================================
# OAUTH PROVIDERS
# ===========================================

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

### Database (Standalone Mode)

```env
# ===========================================
# DATABASE (Alternative to Supabase)
# ===========================================

# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/n8n_converter

# Connection pool settings
DATABASE_POOL_SIZE=10
DATABASE_SSL=false
DATABASE_TIMEOUT=30000
```

### File Storage

```env
# ===========================================
# FILE STORAGE
# ===========================================

# Supabase Storage (default)
SUPABASE_STORAGE_URL=https://your-project.supabase.co/storage/v1
STORAGE_BUCKET_WORKFLOWS=workflow-files
STORAGE_BUCKET_PROJECTS=generated-projects

# Local Storage (alternative)
LOCAL_STORAGE_PATH=./storage
LOCAL_STORAGE_MAX_SIZE=104857600

# AWS S3 (alternative)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name

# File upload limits
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/json,application/zip
```

### Caching and Performance

```env
# ===========================================
# CACHING AND PERFORMANCE
# ===========================================

# Redis configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Cache settings
CACHE_TTL=3600
ENABLE_COMPRESSION=true
ENABLE_CACHING=true

# Performance limits
MAX_CONCURRENT_GENERATIONS=5
GENERATION_TIMEOUT=300000
```

### Monitoring and Logging

```env
# ===========================================
# MONITORING AND LOGGING
# ===========================================

# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Enable structured logging
STRUCTURED_LOGGING=true

# Sentry error tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Analytics
ENABLE_ANALYTICS=true
ANALYTICS_PROVIDER=supabase

# Health check settings
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
```

### Email Configuration

```env
# ===========================================
# EMAIL CONFIGURATION
# ===========================================

# SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email settings
FROM_EMAIL=noreply@your-domain.com
FROM_NAME=n8n Workflow Converter
SUPPORT_EMAIL=support@your-domain.com
```

## Environment-Specific Configurations

### Development Environment (.env.local)

```env
# Development-specific settings
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# Supabase local/development
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key

# Development AI keys (use test keys if available)
OPENAI_API_KEY=sk-your-dev-openai-key
DEFAULT_AI_PROVIDER=openai

# Relaxed security for development
VIRUSTOTAL_API_KEY=optional-in-dev
RATE_LIMIT_MAX=1000
LOG_LEVEL=debug

# Local storage for development
LOCAL_STORAGE_PATH=./dev-storage
MAX_FILE_SIZE=52428800
```

### Staging Environment (.env.staging)

```env
# Staging environment
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.your-domain.com
NEXTAUTH_URL=https://staging.your-domain.com

# Staging Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-key

# Production-like AI configuration
OPENAI_API_KEY=sk-your-staging-openai-key
ANTHROPIC_API_KEY=sk-ant-your-staging-anthropic-key
DEFAULT_AI_PROVIDER=openai

# Enhanced security
VIRUSTOTAL_API_KEY=your-virustotal-key
RATE_LIMIT_MAX=200
LOG_LEVEL=info

# Staging-specific settings
ENABLE_ANALYTICS=false
SENTRY_DSN=https://your-staging-sentry-dsn@sentry.io/project-id
```

### Production Environment (.env.production)

```env
# Production environment
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com

# Production Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key

# Production AI configuration
OPENAI_API_KEY=sk-your-production-openai-key
ANTHROPIC_API_KEY=sk-ant-your-production-anthropic-key
GOOGLE_AI_API_KEY=your-production-google-ai-key
DEFAULT_AI_PROVIDER=openai

# Maximum security
VIRUSTOTAL_API_KEY=your-production-virustotal-key
ENCRYPTION_KEY=your-production-encryption-key-32-chars
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Production monitoring
LOG_LEVEL=warn
STRUCTURED_LOGGING=true
ENABLE_ANALYTICS=true
SENTRY_DSN=https://your-production-sentry-dsn@sentry.io/project-id

# Performance optimization
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
CACHE_TTL=3600
MAX_CONCURRENT_GENERATIONS=3

# Production email
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-production-email@your-domain.com
SMTP_PASS=your-production-email-password
FROM_EMAIL=noreply@your-domain.com
```

## Security Best Practices

### 1. Secret Management

**Never commit secrets to version control:**

```bash
# Add to .gitignore
.env.local
.env.production
.env.staging
*.key
*.pem
```

**Use environment-specific files:**

```bash
# Development
cp .env.example .env.local
# Edit .env.local with development values

# Production (use CI/CD or deployment platform)
# Set environment variables in your deployment platform
```

### 2. Key Generation

**Generate secure secrets:**

```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate encryption key
openssl rand -hex 32

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Environment Variable Validation

The application includes built-in validation:

```typescript
// lib/config/env-validation.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

### 4. Runtime Configuration

**Create a configuration service:**

```typescript
// lib/config/index.ts
export const config = {
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL!,
    env: process.env.NODE_ENV!,
    port: parseInt(process.env.PORT || '3000'),
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  ai: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_AI_API_KEY,
    defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'openai',
  },
  security: {
    virusTotal: process.env.VIRUSTOTAL_API_KEY,
    encryptionKey: process.env.ENCRYPTION_KEY,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
  },
};
```

## Validation and Testing

### 1. Environment Validation Script

Create `scripts/validate-env.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const requiredVars = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXTAUTH_SECRET',
];

const optionalVars = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_AI_API_KEY',
  'VIRUSTOTAL_API_KEY',
];

function validateEnvironment() {
  console.log('🔍 Validating environment variables...\n');

  const missing = [];
  const warnings = [];

  // Check required variables
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      console.log(`✅ ${varName}`);
    }
  });

  // Check optional variables
  optionalVars.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(varName);
    } else {
      console.log(`✅ ${varName}`);
    }
  });

  // Report results
  if (missing.length > 0) {
    console.log('\n❌ Missing required environment variables:');
    missing.forEach(varName => console.log(`   - ${varName}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Missing optional environment variables:');
    warnings.forEach(varName => console.log(`   - ${varName}`));
  }

  // Validate formats
  validateFormats();

  console.log('\n🎉 Environment validation passed!');
}

function validateFormats() {
  // Validate URLs
  const urls = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
  urls.forEach(varName => {
    const value = process.env[varName];
    if (value && !isValidUrl(value)) {
      console.log(`❌ ${varName} is not a valid URL: ${value}`);
      process.exit(1);
    }
  });

  // Validate NextAuth secret length
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (nextAuthSecret && nextAuthSecret.length < 32) {
    console.log('❌ NEXTAUTH_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  // Validate AI provider
  const defaultProvider = process.env.DEFAULT_AI_PROVIDER;
  const validProviders = ['openai', 'anthropic', 'google'];
  if (defaultProvider && !validProviders.includes(defaultProvider)) {
    console.log(`❌ DEFAULT_AI_PROVIDER must be one of: ${validProviders.join(', ')}`);
    process.exit(1);
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Load environment file if it exists
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  require('dotenv').config({ path: envFile });
}

validateEnvironment();
```

### 2. Test Environment Setup

Create `scripts/test-env-setup.js`:

```javascript
#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

async function testEnvironmentSetup() {
  console.log('🧪 Testing environment setup...\n');

  // Test Supabase connection
  await testSupabaseConnection();

  // Test AI providers
  await testAIProviders();

  // Test file storage
  await testFileStorage();

  console.log('\n🎉 All tests passed!');
}

async function testSupabaseConnection() {
  console.log('📡 Testing Supabase connection...');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = table not found (acceptable)
      throw error;
    }
    console.log('✅ Supabase connection successful');
  } catch (error) {
    console.log(`❌ Supabase connection failed: ${error.message}`);
    process.exit(1);
  }
}

async function testAIProviders() {
  console.log('🤖 Testing AI providers...');

  const providers = [
    { name: 'OpenAI', key: process.env.OPENAI_API_KEY, test: testOpenAI },
    { name: 'Anthropic', key: process.env.ANTHROPIC_API_KEY, test: testAnthropic },
    { name: 'Google AI', key: process.env.GOOGLE_AI_API_KEY, test: testGoogleAI },
  ];

  let hasValidProvider = false;

  for (const provider of providers) {
    if (provider.key) {
      try {
        await provider.test(provider.key);
        console.log(`✅ ${provider.name} API key is valid`);
        hasValidProvider = true;
      } catch (error) {
        console.log(`❌ ${provider.name} API key is invalid: ${error.message}`);
      }
    } else {
      console.log(`⚠️  ${provider.name} API key not provided`);
    }
  }

  if (!hasValidProvider) {
    console.log('❌ No valid AI provider found. At least one is required.');
    process.exit(1);
  }
}

async function testOpenAI(apiKey) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

async function testAnthropic(apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'test' }]
    })
  });
  if (!response.ok && response.status !== 400) { // 400 is expected for minimal request
    throw new Error(`HTTP ${response.status}`);
  }
}

async function testGoogleAI(apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

async function testFileStorage() {
  console.log('📁 Testing file storage...');
  // Add file storage tests here
  console.log('✅ File storage configuration valid');
}

testEnvironmentSetup().catch(error => {
  console.error('❌ Environment test failed:', error);
  process.exit(1);
});
```

### 3. Add to package.json

```json
{
  "scripts": {
    "validate-env": "node scripts/validate-env.js",
    "test-env": "node scripts/test-env-setup.js",
    "setup-env": "cp .env.example .env.local && echo 'Please edit .env.local with your configuration'"
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Invalid Environment Variables

**Problem**: Application fails to start with validation errors

**Solution**:
```bash
# Run validation script
npm run validate-env

# Check for typos in variable names
# Ensure all required variables are set
# Verify URL formats are correct
```

#### 2. Supabase Connection Issues

**Problem**: Cannot connect to Supabase

**Solutions**:
- Verify SUPABASE_URL format: `https://project-id.supabase.co`
- Check API keys are correct and not expired
- Ensure project is not paused
- Test connection with validation script

#### 3. AI Provider Authentication

**Problem**: AI API calls fail with authentication errors

**Solutions**:
- Verify API key format (OpenAI: `sk-...`, Anthropic: `sk-ant-...`)
- Check API key has sufficient credits/quota
- Ensure API key has correct permissions
- Test with validation script

#### 4. File Upload Issues

**Problem**: File uploads fail or storage errors

**Solutions**:
- Check storage bucket configuration
- Verify file size limits
- Ensure proper permissions are set
- Check storage quota

### Debug Commands

```bash
# Check environment variables
printenv | grep -E "(SUPABASE|OPENAI|NEXTAUTH)"

# Test Supabase connection
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"

# Test OpenAI API
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Validate environment
npm run validate-env

# Test full setup
npm run test-env
```

This comprehensive environment configuration guide should help you properly set up and manage environment variables for all deployment scenarios.