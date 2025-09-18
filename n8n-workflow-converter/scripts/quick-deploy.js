#!/usr/bin/env node

/**
 * Quick Deployment Script for n8n Workflow Converter
 * 
 * This script automates the deployment process and handles common issues.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateSecret() {
  return crypto.randomBytes(32).toString('base64');
}

function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 18) {
    log('❌ Node.js version 18+ is required. Current version: ' + nodeVersion, 'red');
    process.exit(1);
  }

  log('✅ Node.js version check passed: ' + nodeVersion, 'green');
}

function setupEnvironment() {
  log('🔧 Setting up environment...', 'blue');

  const envPath = '.env.local';
  const envExamplePath = '.env.example';

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      log('📋 Copied .env.example to .env.local', 'cyan');
    } else {
      // Create minimal .env.local
      const minimalEnv = `# n8n Workflow Converter Environment Configuration
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Security (auto-generated)
NEXTAUTH_SECRET=${generateSecret()}
NEXTAUTH_URL=http://localhost:3000

# Supabase (optional - add your credentials)
# NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers (optional)
# OPENAI_API_KEY=your-openai-key
# ANTHROPIC_API_KEY=your-anthropic-key
# GOOGLE_AI_API_KEY=your-google-ai-key

# VirusTotal (optional)
# VIRUSTOTAL_API_KEY=your-virustotal-key
`;
      fs.writeFileSync(envPath, minimalEnv);
      log('📝 Created minimal .env.local file', 'cyan');
    }
  } else {
    log('✅ .env.local already exists', 'green');
  }
}

function installDependencies() {
  log('📦 Installing dependencies...', 'blue');

  try {
    execSync('npm ci', { stdio: 'inherit' });
    log('✅ Dependencies installed successfully', 'green');
  } catch (error) {
    log('⚠️  npm ci failed, trying npm install...', 'yellow');
    try {
      execSync('npm install', { stdio: 'inherit' });
      log('✅ Dependencies installed successfully', 'green');
    } catch (installError) {
      log('❌ Failed to install dependencies', 'red');
      console.error(installError.message);
      process.exit(1);
    }
  }
}

function buildApplication() {
  log('🏗️  Building application...', 'blue');

  try {
    execSync('npm run build', { stdio: 'inherit' });
    log('✅ Build completed successfully', 'green');
  } catch (error) {
    log('❌ Build failed', 'red');
    console.error(error.message);
    process.exit(1);
  }
}

function startApplication(mode = 'dev') {
  log(`🚀 Starting application in ${mode} mode...`, 'blue');

  const command = mode === 'dev' ? 'npm run dev' : 'npm start';

  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    log('❌ Failed to start application', 'red');
    console.error(error.message);
    process.exit(1);
  }
}

function checkPort(port = 3000) {
  const { exec } = require('child_process');

  return new Promise((resolve) => {
    exec(`netstat -an | grep :${port}`, (error, stdout) => {
      resolve(stdout.includes(`:${port}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--prod') || args.includes('--production') ? 'prod' : 'dev';
  const skipBuild = args.includes('--skip-build');
  const skipInstall = args.includes('--skip-install');

  log('🎯 n8n Workflow Converter - Quick Deploy', 'bright');
  log('==========================================', 'cyan');

  // Check Node.js version
  checkNodeVersion();

  // Setup environment
  setupEnvironment();

  // Install dependencies
  if (!skipInstall) {
    installDependencies();
  } else {
    log('⏭️  Skipping dependency installation', 'yellow');
  }

  // Build for production
  if (mode === 'prod' && !skipBuild) {
    buildApplication();
  } else if (skipBuild) {
    log('⏭️  Skipping build step', 'yellow');
  }

  // Check if port is available
  const portInUse = await checkPort(3000);
  if (portInUse) {
    log('⚠️  Port 3000 is already in use', 'yellow');
    log('   You can kill the process with: npx kill-port 3000', 'cyan');
    log('   Or use a different port: PORT=3001 npm run dev', 'cyan');
  }

  log('', 'reset');
  log('🎉 Setup complete!', 'green');
  log('', 'reset');

  if (mode === 'dev') {
    log('📝 Next steps:', 'bright');
    log('   1. Configure your .env.local file with Supabase credentials', 'cyan');
    log('   2. Run: npm run dev', 'cyan');
    log('   3. Open: http://localhost:3000', 'cyan');
  } else {
    log('📝 Production deployment ready:', 'bright');
    log('   1. Configure production environment variables', 'cyan');
    log('   2. Run: npm start', 'cyan');
    log('   3. Open: http://localhost:3000', 'cyan');
  }

  log('', 'reset');
  log('📚 Documentation:', 'bright');
  log('   • Quick Deploy: docs/QUICK-DEPLOYMENT.md', 'cyan');
  log('   • Full Guide: docs/DEPLOYMENT.md', 'cyan');
  log('   • Troubleshooting: docs/TROUBLESHOOTING.md', 'cyan');

  // Auto-start if requested
  if (args.includes('--start')) {
    log('', 'reset');
    startApplication(mode);
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  log('❌ Unexpected error occurred:', 'red');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('❌ Unhandled promise rejection:', 'red');
  console.error('At:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    log('❌ Deployment failed:', 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main, checkNodeVersion, setupEnvironment, installDependencies, buildApplication };