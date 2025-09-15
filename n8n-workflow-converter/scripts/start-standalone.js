#!/usr/bin/env node

/**
 * Standalone server launcher for n8n Workflow Converter
 * This script starts the application in standalone mode without Supabase
 */

const path = require('path');
const fs = require('fs');

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

// Load environment variables
function loadEnvironment() {
  const envFiles = ['.env.standalone', '.env.local', '.env'];
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      log(`Loading environment from ${envFile}`, 'blue');
      
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
}

// Check if we should run in standalone mode
function shouldRunStandalone() {
  // Check for explicit standalone mode
  if (process.env.STANDALONE_MODE === 'true') {
    return true;
  }
  
  // Check if Supabase is not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return true;
  }
  
  // Check for standalone database configuration
  if (process.env.DATABASE_TYPE === 'sqlite' || process.env.STORAGE_TYPE === 'local') {
    return true;
  }
  
  return false;
}

// Validate standalone configuration
function validateStandaloneConfig() {
  const errors = [];
  
  // Check required environment variables
  const requiredVars = [
    'AUTH_SECRET',
  ];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }
  
  // Validate AUTH_SECRET
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
    errors.push('AUTH_SECRET must be at least 32 characters long');
  }
  
  // Check database configuration
  const dbType = process.env.DATABASE_TYPE || 'sqlite';
  if (dbType === 'sqlite' && !process.env.DATABASE_PATH) {
    // Use default path
    process.env.DATABASE_PATH = './data/app.db';
  }
  
  if (dbType === 'postgresql' && !process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required for PostgreSQL');
  }
  
  // Check storage configuration
  const storageType = process.env.STORAGE_TYPE || 'local';
  if (storageType === 'local' && !process.env.STORAGE_PATH) {
    // Use default path
    process.env.STORAGE_PATH = './storage';
  }
  
  return errors;
}

// Create default environment file for standalone mode
function createStandaloneEnv() {
  const envPath = '.env.standalone';
  
  if (fs.existsSync(envPath)) {
    return envPath;
  }
  
  log('Creating standalone environment configuration...', 'yellow');
  
  // Generate secure secrets
  const crypto = require('crypto');
  const authSecret = crypto.randomBytes(32).toString('base64');
  
  const envContent = `# Standalone Configuration for n8n Workflow Converter
# Generated on ${new Date().toISOString()}

# ===========================================
# STANDALONE MODE
# ===========================================
STANDALONE_MODE=true
NODE_ENV=production

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:3000

# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/app.db

# ===========================================
# STORAGE CONFIGURATION
# ===========================================
STORAGE_TYPE=local
STORAGE_PATH=./storage

# ===========================================
# AUTHENTICATION
# ===========================================
AUTH_SECRET=${authSecret}
AUTH_TYPE=simple

# ===========================================
# AI PROVIDERS (Configure at least one)
# ===========================================
# OPENAI_API_KEY=sk-your_openai_api_key_here
# ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here
# GOOGLE_AI_API_KEY=your_google_ai_api_key_here
DEFAULT_AI_PROVIDER=openai

# ===========================================
# FEATURES
# ===========================================
ENABLE_ANALYTICS=true
ENABLE_MONITORING=false
ENABLE_REALTIME=false
ENABLE_FILE_UPLOAD=true

# ===========================================
# SECURITY
# ===========================================
VIRUSTOTAL_API_KEY=your_virustotal_api_key
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# ===========================================
# LOGGING
# ===========================================
LOG_LEVEL=info
STRUCTURED_LOGGING=true
`;

  fs.writeFileSync(envPath, envContent);
  log(`✅ Created ${envPath}`, 'green');
  log('Please edit this file to configure your API keys and settings', 'yellow');
  
  return envPath;
}

// Start the standalone server
async function startStandaloneServer() {
  try {
    log('🚀 Starting n8n Workflow Converter in standalone mode...', 'cyan');
    
    // Import the standalone server (using dynamic import for ES modules)
    const { StandaloneServer } = await import('../lib/standalone/server.js');
    
    // Create and start server
    const server = new StandaloneServer();
    await server.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      log('\n🛑 Shutting down server...', 'yellow');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      log('\n🛑 Shutting down server...', 'yellow');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    log(`❌ Failed to start standalone server: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Start Next.js in regular mode
function startNextJS() {
  log('🚀 Starting n8n Workflow Converter with Next.js...', 'cyan');
  
  // Start Next.js server
  const { spawn } = require('child_process');
  const nextProcess = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: true
  });
  
  nextProcess.on('error', (error) => {
    log(`❌ Failed to start Next.js: ${error.message}`, 'red');
    process.exit(1);
  });
  
  nextProcess.on('exit', (code) => {
    process.exit(code);
  });
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
n8n Workflow Converter Standalone Server

Usage: node start-standalone.js [options]

Options:
  --standalone, -s    Force standalone mode
  --nextjs, -n       Force Next.js mode
  --create-env       Create standalone environment file
  --help, -h         Show this help message

Environment Detection:
  The script automatically detects whether to run in standalone mode based on:
  - STANDALONE_MODE environment variable
  - Presence of Supabase configuration
  - Database and storage type configuration

Standalone Mode Features:
  ✓ SQLite database (lightweight, no setup required)
  ✓ Local file storage
  ✓ Simple authentication system
  ✓ Express.js API server
  ✓ No external dependencies

Examples:
  node start-standalone.js                    # Auto-detect mode
  node start-standalone.js --standalone       # Force standalone
  node start-standalone.js --create-env       # Create config file
`);
    return;
  }
  
  // Load environment
  loadEnvironment();
  
  // Handle create-env flag
  if (args.includes('--create-env')) {
    createStandaloneEnv();
    return;
  }
  
  // Determine mode
  let useStandalone = shouldRunStandalone();
  
  if (args.includes('--standalone') || args.includes('-s')) {
    useStandalone = true;
  } else if (args.includes('--nextjs') || args.includes('-n')) {
    useStandalone = false;
  }
  
  log('🔍 Configuration Detection', 'blue');
  log('========================', 'blue');
  log(`Mode: ${useStandalone ? 'Standalone' : 'Next.js with Supabase'}`, 'blue');
  log(`Database: ${process.env.DATABASE_TYPE || (useStandalone ? 'sqlite' : 'supabase')}`, 'blue');
  log(`Storage: ${process.env.STORAGE_TYPE || (useStandalone ? 'local' : 'supabase')}`, 'blue');
  log(`Auth: ${process.env.AUTH_TYPE || (useStandalone ? 'simple' : 'supabase')}`, 'blue');
  log('');
  
  if (useStandalone) {
    // Validate standalone configuration
    const configErrors = validateStandaloneConfig();
    
    if (configErrors.length > 0) {
      log('❌ Configuration errors:', 'red');
      configErrors.forEach(error => log(`   - ${error}`, 'red'));
      log('');
      log('💡 Run with --create-env to generate a configuration file', 'yellow');
      process.exit(1);
    }
    
    // Create environment file if it doesn't exist
    if (!fs.existsSync('.env.standalone') && !fs.existsSync('.env.local')) {
      createStandaloneEnv();
      log('');
      log('⚠️  Please configure your API keys in .env.standalone and restart', 'yellow');
      process.exit(0);
    }
    
    await startStandaloneServer();
  } else {
    startNextJS();
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`❌ Uncaught exception: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ Unhandled rejection: ${reason}`, 'red');
  process.exit(1);
});

// Run main function
main().catch(error => {
  log(`❌ Startup error: ${error.message}`, 'red');
  process.exit(1);
});