#!/usr/bin/env node

/**
 * Deployment Verification Script
 * 
 * Checks if the deployment is working correctly
 */

const http = require('http');
const https = require('https');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      resolve({
        status: res.statusCode,
        success: res.statusCode >= 200 && res.statusCode < 400
      });
    });
    
    req.on('error', (error) => {
      resolve({
        status: 0,
        success: false,
        error: error.message
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        status: 0,
        success: false,
        error: 'Timeout'
      });
    });
  });
}

async function verifyDeployment(baseUrl = 'http://localhost:3000') {
  log('🔍 Verifying deployment...', 'blue');
  log(`Base URL: ${baseUrl}`, 'cyan');
  
  const endpoints = [
    { path: '/', name: 'Home Page' },
    { path: '/api/health', name: 'Health Check' },
    { path: '/auth/login', name: 'Login Page' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/upload', name: 'Upload Page' }
  ];
  
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint.path}`;
    const result = await checkUrl(url);
    
    if (result.success) {
      log(`✅ ${endpoint.name} (${result.status})`, 'green');
    } else {
      log(`❌ ${endpoint.name} (${result.status || 'Failed'})${result.error ? ` - ${result.error}` : ''}`, 'red');
      allPassed = false;
    }
  }
  
  log('', 'reset');
  
  if (allPassed) {
    log('🎉 All checks passed! Deployment is working correctly.', 'green');
  } else {
    log('⚠️  Some checks failed. Please review the issues above.', 'yellow');
  }
  
  // Check environment configuration
  log('', 'reset');
  log('🔧 Environment Check:', 'blue');
  
  const envPath = '.env.local';
  if (fs.existsSync(envPath)) {
    log('✅ .env.local file exists', 'green');
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasSupabase = envContent.includes('NEXT_PUBLIC_SUPABASE_URL') && 
                       !envContent.includes('NEXT_PUBLIC_SUPABASE_URL=your-supabase-url');
    const hasAuth = envContent.includes('NEXTAUTH_SECRET') && 
                   !envContent.includes('NEXTAUTH_SECRET=your-32-character-secret');
    
    if (hasSupabase) {
      log('✅ Supabase configuration detected', 'green');
    } else {
      log('⚠️  Supabase not configured (optional)', 'yellow');
    }
    
    if (hasAuth) {
      log('✅ Authentication secret configured', 'green');
    } else {
      log('⚠️  Authentication secret not configured', 'yellow');
    }
  } else {
    log('❌ .env.local file not found', 'red');
  }
  
  return allPassed;
}

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3000';
  
  log('🎯 n8n Workflow Converter - Deployment Verification', 'cyan');
  log('====================================================', 'cyan');
  
  const success = await verifyDeployment(baseUrl);
  
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    log('❌ Verification failed:', 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { verifyDeployment };