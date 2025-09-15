#!/usr/bin/env node

/**
 * Environment template generator for n8n Workflow Converter
 * This script generates environment variable templates based on deployment type
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Generate secure random values
function generateSecrets() {
  const secrets = {};
  
  try {
    // Generate NEXTAUTH_SECRET (32+ characters)
    secrets.NEXTAUTH_SECRET = execSync('openssl rand -base64 32', { encoding: 'utf8' }).trim();
    
    // Generate ENCRYPTION_KEY (32 hex characters)
    secrets.ENCRYPTION_KEY = execSync('openssl rand -hex 32', { encoding: 'utf8' }).trim();
    
    // Generate POSTGRES_PASSWORD (32+ characters)
    secrets.POSTGRES_PASSWORD = execSync('openssl rand -base64 32', { encoding: 'utf8' }).trim();
    
    // Generate GRAFANA_ADMIN_PASSWORD
    secrets.GRAFANA_ADMIN_PASSWORD = execSync('openssl rand -base64 16', { encoding: 'utf8' }).trim();
    
  } catch (error) {
    log('⚠️  OpenSSL not available, using fallback random generation', 'yellow');
    
    // Fallback random generation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const hexChars = '0123456789abcdef';
    
    secrets.NEXTAUTH_SECRET = Array.from({ length: 44 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    secrets.ENCRYPTION_KEY = Array.from({ length: 64 }, () => hexChars[Math.floor(Math.random() * hexChars.length)]).join('');
    secrets.POSTGRES_PASSWORD = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    secrets.GRAFANA_ADMIN_PASSWORD = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
  
  return secrets;
}

// Environment templates
const templates = {
  development: {
    filename: '.env.local',
    description: 'Development environment configuration',
    variables: {
      '# Application Configuration': '',
      'NODE_ENV': 'development',
      'NEXT_PUBLIC_APP_URL': 'http://localhost:3000',
      'NEXTAUTH_URL': 'http://localhost:3000',
      'PORT': '3000',
      '': '',
      
      '# Supabase Configuration (recommended for development)': '',
      'NEXT_PUBLIC_SUPABASE_URL': 'https://your-project.supabase.co',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'your_supabase_anon_key',
      'SUPABASE_SERVICE_ROLE_KEY': 'your_supabase_service_key',
      ' ': '',
      
      '# Alternative: Local PostgreSQL Database': '',
      '# DATABASE_URL': 'postgresql://postgres:password@localhost:5432/n8n_converter',
      '  ': '',
      
      '# Authentication': '',
      'NEXTAUTH_SECRET': '{{NEXTAUTH_SECRET}}',
      '   ': '',
      
      '# AI Providers (at least one required)': '',
      'OPENAI_API_KEY': 'sk-your_openai_api_key_here',
      '# ANTHROPIC_API_KEY': 'sk-ant-your_anthropic_api_key_here',
      '# GOOGLE_AI_API_KEY': 'your_google_ai_api_key_here',
      'DEFAULT_AI_PROVIDER': 'openai',
      '    ': '',
      
      '# Security (optional for development)': '',
      'VIRUSTOTAL_API_KEY': 'your_virustotal_api_key',
      'ENCRYPTION_KEY': '{{ENCRYPTION_KEY}}',
      '     ': '',
      
      '# OAuth Providers (optional)': '',
      '# GOOGLE_CLIENT_ID': 'your_google_client_id',
      '# GOOGLE_CLIENT_SECRET': 'your_google_client_secret',
      '# GITHUB_CLIENT_ID': 'your_github_client_id',
      '# GITHUB_CLIENT_SECRET': 'your_github_client_secret',
      '      ': '',
      
      '# Development Settings': '',
      'LOG_LEVEL': 'debug',
      'ENABLE_ANALYTICS': 'false',
      'MAX_FILE_SIZE': '52428800',
      'LOCAL_STORAGE_PATH': './dev-storage'
    }
  },
  
  production: {
    filename: '.env.production',
    description: 'Production environment configuration',
    variables: {
      '# Application Configuration': '',
      'NODE_ENV': 'production',
      'NEXT_PUBLIC_APP_URL': 'https://your-domain.com',
      'NEXTAUTH_URL': 'https://your-domain.com',
      'PORT': '3000',
      '': '',
      
      '# Database Configuration': '',
      'POSTGRES_DB': 'n8n_converter',
      'POSTGRES_USER': 'postgres',
      'POSTGRES_PASSWORD': '{{POSTGRES_PASSWORD}}',
      'DATABASE_URL': 'postgresql://postgres:{{POSTGRES_PASSWORD}}@postgres:5432/n8n_converter',
      ' ': '',
      
      '# Alternative: Supabase Configuration': '',
      '# NEXT_PUBLIC_SUPABASE_URL': 'https://your-project.supabase.co',
      '# NEXT_PUBLIC_SUPABASE_ANON_KEY': 'your_supabase_anon_key',
      '# SUPABASE_SERVICE_ROLE_KEY': 'your_supabase_service_key',
      '  ': '',
      
      '# Redis Configuration': '',
      'REDIS_URL': 'redis://redis:6379',
      '   ': '',
      
      '# Authentication': '',
      'NEXTAUTH_SECRET': '{{NEXTAUTH_SECRET}}',
      '    ': '',
      
      '# AI Providers (at least one required)': '',
      'OPENAI_API_KEY': 'sk-your_production_openai_key',
      'ANTHROPIC_API_KEY': 'sk-ant-your_production_anthropic_key',
      'GOOGLE_AI_API_KEY': 'your_production_google_ai_key',
      'DEFAULT_AI_PROVIDER': 'openai',
      '     ': '',
      
      '# Security': '',
      'VIRUSTOTAL_API_KEY': 'your_production_virustotal_key',
      'ENCRYPTION_KEY': '{{ENCRYPTION_KEY}}',
      'RATE_LIMIT_MAX': '100',
      'RATE_LIMIT_WINDOW': '900000',
      '      ': '',
      
      '# OAuth Providers': '',
      'GOOGLE_CLIENT_ID': 'your_production_google_client_id',
      'GOOGLE_CLIENT_SECRET': 'your_production_google_client_secret',
      'GITHUB_CLIENT_ID': 'your_production_github_client_id',
      'GITHUB_CLIENT_SECRET': 'your_production_github_client_secret',
      '       ': '',
      
      '# File Storage': '',
      'LOCAL_STORAGE_PATH': '/app/storage',
      'MAX_FILE_SIZE': '52428800',
      'ALLOWED_FILE_TYPES': 'application/json,application/zip',
      '        ': '',
      
      '# Email Configuration': '',
      'SMTP_HOST': 'smtp.your-provider.com',
      'SMTP_PORT': '587',
      'SMTP_SECURE': 'false',
      'SMTP_USER': 'your_email@your-domain.com',
      'SMTP_PASS': 'your_email_password',
      'FROM_EMAIL': 'noreply@your-domain.com',
      'FROM_NAME': 'n8n Workflow Converter',
      '         ': '',
      
      '# Monitoring': '',
      'LOG_LEVEL': 'info',
      'STRUCTURED_LOGGING': 'true',
      'ENABLE_ANALYTICS': 'true',
      'SENTRY_DSN': 'your_sentry_dsn',
      'GRAFANA_ADMIN_USER': 'admin',
      'GRAFANA_ADMIN_PASSWORD': '{{GRAFANA_ADMIN_PASSWORD}}',
      '          ': '',
      
      '# Backup Configuration': '',
      'BACKUP_SCHEDULE': '0 2 * * *',
      'BACKUP_RETENTION_DAYS': '7',
      'BACKUP_COMPRESSION': 'gzip',
      '           ': '',
      
      '# Performance': '',
      'MAX_CONCURRENT_GENERATIONS': '3',
      'GENERATION_TIMEOUT': '300000',
      'ENABLE_COMPRESSION': 'true',
      'ENABLE_CACHING': 'true',
      'CACHE_TTL': '3600'
    }
  },
  
  docker: {
    filename: '.env.docker',
    description: 'Docker deployment configuration',
    variables: {
      '# Docker Environment Configuration for n8n Workflow Converter': '',
      '# Copy this file to .env.production and customize for your deployment': '',
      '': '',
      
      '# Application Configuration': '',
      'NODE_ENV': 'production',
      'NEXT_PUBLIC_APP_URL': 'http://localhost:3000',
      'NEXTAUTH_URL': 'http://localhost:3000',
      'PORT': '3000',
      ' ': '',
      
      '# Database Configuration': '',
      'POSTGRES_DB': 'n8n_converter',
      'POSTGRES_USER': 'postgres',
      'POSTGRES_PASSWORD': '{{POSTGRES_PASSWORD}}',
      'DATABASE_URL': 'postgresql://postgres:{{POSTGRES_PASSWORD}}@postgres:5432/n8n_converter',
      '  ': '',
      
      '# Redis Configuration': '',
      'REDIS_URL': 'redis://redis:6379',
      '   ': '',
      
      '# Authentication': '',
      'NEXTAUTH_SECRET': '{{NEXTAUTH_SECRET}}',
      '    ': '',
      
      '# AI Providers (at least one required)': '',
      'OPENAI_API_KEY': 'sk-your_openai_api_key_here',
      'ANTHROPIC_API_KEY': 'sk-ant-your_anthropic_api_key_here',
      'GOOGLE_AI_API_KEY': 'your_google_ai_api_key_here',
      'DEFAULT_AI_PROVIDER': 'openai',
      '     ': '',
      
      '# Security': '',
      'VIRUSTOTAL_API_KEY': 'your_virustotal_api_key',
      'ENCRYPTION_KEY': '{{ENCRYPTION_KEY}}',
      'RATE_LIMIT_MAX': '100',
      'RATE_LIMIT_WINDOW': '900000',
      '      ': '',
      
      '# File Storage': '',
      'LOCAL_STORAGE_PATH': '/app/storage',
      'MAX_FILE_SIZE': '52428800',
      'ALLOWED_FILE_TYPES': 'application/json,application/zip',
      '       ': '',
      
      '# Monitoring': '',
      'LOG_LEVEL': 'info',
      'STRUCTURED_LOGGING': 'true',
      'ENABLE_ANALYTICS': 'true',
      'GRAFANA_ADMIN_USER': 'admin',
      'GRAFANA_ADMIN_PASSWORD': '{{GRAFANA_ADMIN_PASSWORD}}',
      '        ': '',
      
      '# Performance': '',
      'MAX_CONCURRENT_GENERATIONS': '3',
      'GENERATION_TIMEOUT': '300000',
      'ENABLE_COMPRESSION': 'true',
      'ENABLE_CACHING': 'true',
      'CACHE_TTL': '3600',
      '         ': '',
      
      '# Development/Debug (Set to false in production)': '',
      'DEBUG': 'false',
      'NEXT_TELEMETRY_DISABLED': '1'
    }
  }
};

// Generate environment file
function generateEnvironmentFile(type, options = {}) {
  const template = templates[type];
  if (!template) {
    throw new Error(`Unknown template type: ${type}`);
  }
  
  log(`📝 Generating ${template.description}...`, 'yellow');
  
  // Generate secrets
  const secrets = generateSecrets();
  
  // Build file content
  let content = `# ${template.description}\n`;
  content += `# Generated on ${new Date().toISOString()}\n`;
  content += `# \n`;
  content += `# IMPORTANT: Review and customize all values before use\n`;
  content += `# Never commit this file to version control\n\n`;
  
  for (const [key, value] of Object.entries(template.variables)) {
    if (key.startsWith('#') || key.trim() === '') {
      // Comment or empty line
      if (key.trim() === '') {
        content += '\n';
      } else {
        content += `${key}\n`;
      }
    } else {
      // Environment variable
      let finalValue = value;
      
      // Replace secret placeholders
      for (const [secretKey, secretValue] of Object.entries(secrets)) {
        finalValue = finalValue.replace(`{{${secretKey}}}`, secretValue);
      }
      
      // Add the variable
      if (finalValue.startsWith('#')) {
        content += `${key}=${finalValue}\n`;
      } else {
        content += `${key}=${finalValue}\n`;
      }
    }
  }
  
  // Write file
  const filename = options.filename || template.filename;
  fs.writeFileSync(filename, content);
  
  log(`✅ Generated ${filename}`, 'green');
  
  // Show next steps
  log('', 'reset');
  log('📋 Next steps:', 'blue');
  log(`   1. Review and customize ${filename}`, 'blue');
  log('   2. Set your API keys and credentials', 'blue');
  log('   3. Update URLs and domain names', 'blue');
  log('   4. Run validation: node scripts/validate-env.js', 'blue');
  
  return filename;
}

// Generate all templates
function generateAllTemplates() {
  log('📝 Generating all environment templates...', 'cyan');
  log('', 'reset');
  
  const generated = [];
  
  for (const [type, template] of Object.entries(templates)) {
    try {
      const filename = generateEnvironmentFile(type);
      generated.push(filename);
      log('', 'reset');
    } catch (error) {
      log(`❌ Failed to generate ${type} template: ${error.message}`, 'red');
    }
  }
  
  log('🎉 Template generation completed!', 'green');
  log('', 'reset');
  log('Generated files:', 'blue');
  generated.forEach(file => log(`   - ${file}`, 'blue'));
  
  return generated;
}

// Interactive template generator
function interactiveGeneration() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  log('🔧 Interactive Environment Template Generator', 'cyan');
  log('', 'reset');
  
  rl.question('Select deployment type (development/production/docker/all): ', (type) => {
    if (type === 'all') {
      generateAllTemplates();
    } else if (templates[type]) {
      rl.question(`Custom filename (default: ${templates[type].filename}): `, (filename) => {
        const options = filename.trim() ? { filename: filename.trim() } : {};
        generateEnvironmentFile(type, options);
        rl.close();
      });
    } else {
      log(`❌ Invalid type: ${type}`, 'red');
      log('Valid types: development, production, docker, all', 'yellow');
      rl.close();
    }
  });
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Environment Template Generator for n8n Workflow Converter

Usage: node generate-env-template.js [type] [options]

Types:
  development    Generate development environment template (.env.local)
  production     Generate production environment template (.env.production)
  docker         Generate Docker environment template (.env.docker)
  all            Generate all templates
  interactive    Interactive mode (default)

Options:
  --filename FILE    Custom output filename
  --help, -h         Show this help message

Examples:
  node generate-env-template.js development
  node generate-env-template.js production --filename .env.prod
  node generate-env-template.js all
  node generate-env-template.js interactive

Generated templates include:
  ✓ Secure randomly generated secrets
  ✓ Comprehensive variable documentation
  ✓ Environment-specific configurations
  ✓ Best practice defaults
`);
    return;
  }
  
  const type = args[0];
  const filenameIndex = args.indexOf('--filename');
  const customFilename = filenameIndex !== -1 ? args[filenameIndex + 1] : null;
  
  const options = customFilename ? { filename: customFilename } : {};
  
  try {
    if (!type || type === 'interactive') {
      interactiveGeneration();
    } else if (type === 'all') {
      generateAllTemplates();
    } else if (templates[type]) {
      generateEnvironmentFile(type, options);
    } else {
      log(`❌ Unknown template type: ${type}`, 'red');
      log('Valid types: development, production, docker, all, interactive', 'yellow');
      process.exit(1);
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateEnvironmentFile,
  generateAllTemplates,
  templates
};