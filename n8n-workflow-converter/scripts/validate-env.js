#!/usr/bin/env node

/**
 * Environment validation script for n8n Workflow Converter
 * This script validates environment variables and system configuration
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

// Configuration
const config = {
  logFile: path.join(__dirname, '..', 'validation.log')
};

// Logging function
function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  
  // Write to log file
  try {
    fs.appendFileSync(config.logFile, logMessage + '\n');
  } catch (error) {
    // Ignore log file errors
  }
  
  // Write to console with color
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Load environment variables from files
function loadEnvironment() {
  const envFiles = ['.env.local', '.env.production', '.env.docker', '.env'];
  let loadedFile = null;
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      log(`Loading environment from ${envFile}`, 'blue');
      loadedFile = envFile;
      
      const content = fs.readFileSync(envFile, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^([^#][^=]+)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          if (!process.env[key]) {
            process.env[key] = value.replace(/^["']|["']$/g, '');
          }
        }
      }
      break;
    }
  }
  
  return loadedFile;
}

// Validation rules
const validationRules = {
  // Required variables
  required: [
    'NEXTAUTH_SECRET'
  ],
  
  // Conditional requirements
  conditional: {
    // If using Docker or production, need database password
    'POSTGRES_PASSWORD': {
      condition: () => process.env.NODE_ENV === 'production' || 
                        process.env.USE_DOCKER === 'true' ||
                        process.env.DATABASE_URL?.includes('postgres'),
      message: 'Required for PostgreSQL database'
    }
  },
  
  // Format validations
  format: {
    'NEXT_PUBLIC_APP_URL': {
      pattern: /^https?:\/\/.+/,
      message: 'Must be a valid URL starting with http:// or https://'
    },
    'NEXT_PUBLIC_SUPABASE_URL': {
      pattern: /^https:\/\/.+\.supabase\.co$/,
      message: 'Must be a valid Supabase URL (https://project.supabase.co)'
    },
    'NEXTAUTH_URL': {
      pattern: /^https?:\/\/.+/,
      message: 'Must be a valid URL starting with http:// or https://'
    },
    'DATABASE_URL': {
      pattern: /^postgresql:\/\/.+/,
      message: 'Must be a valid PostgreSQL connection string'
    },
    'REDIS_URL': {
      pattern: /^redis:\/\/.+/,
      message: 'Must be a valid Redis connection string'
    },
    'OPENAI_API_KEY': {
      pattern: /^sk-[a-zA-Z0-9]{48,}$/,
      message: 'Must be a valid OpenAI API key (starts with sk-)'
    },
    'ANTHROPIC_API_KEY': {
      pattern: /^sk-ant-[a-zA-Z0-9_-]+$/,
      message: 'Must be a valid Anthropic API key (starts with sk-ant-)'
    }
  },
  
  // Length validations
  length: {
    'NEXTAUTH_SECRET': {
      min: 32,
      message: 'Must be at least 32 characters long'
    },
    'ENCRYPTION_KEY': {
      min: 32,
      max: 32,
      message: 'Must be exactly 32 characters long'
    },
    'POSTGRES_PASSWORD': {
      min: 12,
      message: 'Must be at least 12 characters long'
    }
  },
  
  // AI provider requirements
  aiProviders: [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_AI_API_KEY'
  ]
};

// Validation functions
function validateRequired() {
  log('🔍 Checking required variables...', 'yellow');
  
  const missing = [];
  
  for (const varName of validationRules.required) {
    if (!process.env[varName] || process.env[varName].trim() === '') {
      missing.push(varName);
    } else {
      log(`✅ ${varName}`, 'green');
    }
  }
  
  return missing;
}

function validateConditional() {
  log('🔍 Checking conditional requirements...', 'yellow');
  
  const missing = [];
  
  for (const [varName, rule] of Object.entries(validationRules.conditional)) {
    if (rule.condition()) {
      if (!process.env[varName] || process.env[varName].trim() === '') {
        missing.push({ name: varName, message: rule.message });
      } else {
        log(`✅ ${varName} (${rule.message})`, 'green');
      }
    }
  }
  
  return missing;
}

function validateFormats() {
  log('🔍 Checking variable formats...', 'yellow');
  
  const invalid = [];
  
  for (const [varName, rule] of Object.entries(validationRules.format)) {
    const value = process.env[varName];
    
    if (value && value.trim() !== '') {
      if (!rule.pattern.test(value)) {
        invalid.push({ name: varName, message: rule.message, value: value.substring(0, 20) + '...' });
      } else {
        log(`✅ ${varName} format`, 'green');
      }
    }
  }
  
  return invalid;
}

function validateLengths() {
  log('🔍 Checking variable lengths...', 'yellow');
  
  const invalid = [];
  
  for (const [varName, rule] of Object.entries(validationRules.length)) {
    const value = process.env[varName];
    
    if (value && value.trim() !== '') {
      const length = value.length;
      
      if (rule.min && length < rule.min) {
        invalid.push({ name: varName, message: `Too short (${length} chars). ${rule.message}` });
      } else if (rule.max && length > rule.max) {
        invalid.push({ name: varName, message: `Too long (${length} chars). ${rule.message}` });
      } else {
        log(`✅ ${varName} length (${length} chars)`, 'green');
      }
    }
  }
  
  return invalid;
}

function validateAIProviders() {
  log('🔍 Checking AI provider configuration...', 'yellow');
  
  const providers = [];
  
  for (const provider of validationRules.aiProviders) {
    if (process.env[provider] && process.env[provider].trim() !== '') {
      providers.push(provider);
      log(`✅ ${provider} configured`, 'green');
    }
  }
  
  if (providers.length === 0) {
    return { error: 'No AI provider keys found. At least one is required.' };
  }
  
  // Check default provider
  const defaultProvider = process.env.DEFAULT_AI_PROVIDER;
  if (defaultProvider) {
    const providerMap = {
      'openai': 'OPENAI_API_KEY',
      'anthropic': 'ANTHROPIC_API_KEY',
      'google': 'GOOGLE_AI_API_KEY'
    };
    
    const requiredKey = providerMap[defaultProvider];
    if (requiredKey && !process.env[requiredKey]) {
      return { error: `DEFAULT_AI_PROVIDER is set to '${defaultProvider}' but ${requiredKey} is not configured` };
    }
    
    log(`✅ Default AI provider: ${defaultProvider}`, 'green');
  }
  
  return { providers };
}

function validateDatabaseConfiguration() {
  log('🔍 Checking database configuration...', 'yellow');
  
  const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                     process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const hasPostgreSQL = process.env.DATABASE_URL;
  
  if (!hasSupabase && !hasPostgreSQL) {
    return { error: 'No database configuration found. Configure either Supabase or PostgreSQL.' };
  }
  
  if (hasSupabase) {
    log('✅ Supabase configuration found', 'green');
    
    // Validate Supabase keys format
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (anonKey && !anonKey.startsWith('eyJ')) {
      return { error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be invalid (should start with eyJ)' };
    }
    
    if (serviceKey && !serviceKey.startsWith('eyJ')) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY appears to be invalid (should start with eyJ)' };
    }
  }
  
  if (hasPostgreSQL) {
    log('✅ PostgreSQL configuration found', 'green');
  }
  
  return { success: true };
}

function validateSystemRequirements() {
  log('🔍 Checking system requirements...', 'yellow');
  
  const issues = [];
  
  // Check Node.js version
  const nodeVersion = process.version.substring(1); // Remove 'v' prefix
  const requiredNodeVersion = '20.0.0';
  
  if (compareVersions(nodeVersion, requiredNodeVersion) < 0) {
    issues.push(`Node.js version ${nodeVersion} is too old (>= ${requiredNodeVersion} required)`);
  } else {
    log(`✅ Node.js ${nodeVersion}`, 'green');
  }
  
  // Check npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    log(`✅ npm ${npmVersion}`, 'green');
  } catch (error) {
    issues.push('npm is not available');
  }
  
  // Check available memory (if on Linux/Mac)
  try {
    if (process.platform !== 'win32') {
      const memInfo = execSync('free -m', { encoding: 'utf8' });
      const totalMem = parseInt(memInfo.split('\n')[1].split(/\s+/)[1]);
      
      if (totalMem < 4096) {
        issues.push(`Available memory: ${Math.round(totalMem/1024)}GB (4GB recommended)`);
      } else {
        log(`✅ Memory: ${Math.round(totalMem/1024)}GB`, 'green');
      }
    }
  } catch (error) {
    // Ignore memory check errors
  }
  
  // Check disk space
  try {
    const diskInfo = execSync('df -BG .', { encoding: 'utf8' });
    const availableDisk = parseInt(diskInfo.split('\n')[1].split(/\s+/)[3]);
    
    if (availableDisk < 20) {
      issues.push(`Available disk space: ${availableDisk}GB (20GB recommended)`);
    } else {
      log(`✅ Disk space: ${availableDisk}GB`, 'green');
    }
  } catch (error) {
    // Ignore disk check errors on Windows
  }
  
  return issues;
}

function compareVersions(version1, version2) {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part < v2part) return -1;
    if (v1part > v2part) return 1;
  }
  
  return 0;
}

function testConnections() {
  log('🔍 Testing external connections...', 'yellow');
  
  const tests = [];
  
  // Test Supabase connection
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    tests.push({
      name: 'Supabase API',
      test: async () => {
        const fetch = require('node-fetch');
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          }
        });
        return response.ok;
      }
    });
  }
  
  // Test OpenAI API
  if (process.env.OPENAI_API_KEY) {
    tests.push({
      name: 'OpenAI API',
      test: async () => {
        const fetch = require('node-fetch');
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          }
        });
        return response.ok;
      }
    });
  }
  
  // Test Anthropic API
  if (process.env.ANTHROPIC_API_KEY) {
    tests.push({
      name: 'Anthropic API',
      test: async () => {
        const fetch = require('node-fetch');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          })
        });
        return response.ok || response.status === 400; // 400 is expected for minimal request
      }
    });
  }
  
  return Promise.all(tests.map(async test => {
    try {
      const result = await test.test();
      if (result) {
        log(`✅ ${test.name} connection`, 'green');
        return { name: test.name, success: true };
      } else {
        log(`❌ ${test.name} connection failed`, 'red');
        return { name: test.name, success: false, error: 'Connection failed' };
      }
    } catch (error) {
      log(`❌ ${test.name} connection error: ${error.message}`, 'red');
      return { name: test.name, success: false, error: error.message };
    }
  }));
}

// Main validation function
async function validateEnvironment(options = {}) {
  log('🔍 Environment Validation for n8n Workflow Converter', 'cyan');
  log('==================================================', 'cyan');
  log('');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Load environment
  const envFile = loadEnvironment();
  if (!envFile) {
    log('⚠️  No environment file found', 'yellow');
    hasWarnings = true;
  }
  
  log('');
  
  // Validate required variables
  const missingRequired = validateRequired();
  if (missingRequired.length > 0) {
    log('❌ Missing required variables:', 'red');
    missingRequired.forEach(varName => log(`   - ${varName}`, 'red'));
    hasErrors = true;
  }
  
  log('');
  
  // Validate conditional requirements
  const missingConditional = validateConditional();
  if (missingConditional.length > 0) {
    log('❌ Missing conditional variables:', 'red');
    missingConditional.forEach(item => log(`   - ${item.name}: ${item.message}`, 'red'));
    hasErrors = true;
  }
  
  log('');
  
  // Validate formats
  const invalidFormats = validateFormats();
  if (invalidFormats.length > 0) {
    log('❌ Invalid variable formats:', 'red');
    invalidFormats.forEach(item => log(`   - ${item.name}: ${item.message}`, 'red'));
    hasErrors = true;
  }
  
  log('');
  
  // Validate lengths
  const invalidLengths = validateLengths();
  if (invalidLengths.length > 0) {
    log('❌ Invalid variable lengths:', 'red');
    invalidLengths.forEach(item => log(`   - ${item.name}: ${item.message}`, 'red'));
    hasErrors = true;
  }
  
  log('');
  
  // Validate AI providers
  const aiResult = validateAIProviders();
  if (aiResult.error) {
    log(`❌ AI Provider Error: ${aiResult.error}`, 'red');
    hasErrors = true;
  }
  
  log('');
  
  // Validate database configuration
  const dbResult = validateDatabaseConfiguration();
  if (dbResult.error) {
    log(`❌ Database Error: ${dbResult.error}`, 'red');
    hasErrors = true;
  }
  
  log('');
  
  // Validate system requirements
  const systemIssues = validateSystemRequirements();
  if (systemIssues.length > 0) {
    log('⚠️  System requirement warnings:', 'yellow');
    systemIssues.forEach(issue => log(`   - ${issue}`, 'yellow'));
    hasWarnings = true;
  }
  
  log('');
  
  // Test connections if requested
  if (options.testConnections) {
    log('Testing external connections...', 'yellow');
    try {
      const connectionResults = await testConnections();
      const failedConnections = connectionResults.filter(result => !result.success);
      
      if (failedConnections.length > 0) {
        log('⚠️  Connection test failures:', 'yellow');
        failedConnections.forEach(result => log(`   - ${result.name}: ${result.error}`, 'yellow'));
        hasWarnings = true;
      }
    } catch (error) {
      log(`⚠️  Connection tests failed: ${error.message}`, 'yellow');
      hasWarnings = true;
    }
    
    log('');
  }
  
  // Summary
  log('📋 Validation Summary', 'blue');
  log('==================', 'blue');
  
  if (hasErrors) {
    log('❌ Validation failed with errors. Please fix the issues above.', 'red');
    return false;
  } else if (hasWarnings) {
    log('⚠️  Validation completed with warnings. Review the issues above.', 'yellow');
    return true;
  } else {
    log('✅ All validations passed successfully!', 'green');
    return true;
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const options = {
    testConnections: args.includes('--test-connections'),
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (options.help) {
    console.log(`
Environment Validation Script for n8n Workflow Converter

Usage: node validate-env.js [options]

Options:
  --test-connections  Test connections to external services
  -h, --help         Show this help message

Examples:
  node validate-env.js                    # Basic validation
  node validate-env.js --test-connections # Include connection tests

This script validates:
  ✓ Required environment variables
  ✓ Variable formats and lengths
  ✓ AI provider configuration
  ✓ Database configuration
  ✓ System requirements
  ✓ External service connections (optional)
`);
    return;
  }
  
  validateEnvironment(options)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`❌ Validation error: ${error.message}`, 'red');
      process.exit(1);
    });
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironment,
  loadEnvironment
};