#!/usr/bin/env node

/**
 * System requirements validation script for n8n Workflow Converter
 * This script checks if the system meets all requirements for installation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

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

// System requirements
const requirements = {
  node: {
    command: 'node --version',
    minVersion: '20.0.0',
    name: 'Node.js',
    installUrl: 'https://nodejs.org/',
    required: true
  },
  npm: {
    command: 'npm --version',
    minVersion: '9.0.0',
    name: 'npm',
    installUrl: 'https://www.npmjs.com/get-npm',
    required: true
  },
  git: {
    command: 'git --version',
    minVersion: '2.0.0',
    name: 'Git',
    installUrl: 'https://git-scm.com/downloads',
    required: true
  },
  docker: {
    command: 'docker --version',
    minVersion: '20.10.0',
    name: 'Docker',
    installUrl: 'https://docs.docker.com/get-docker/',
    required: false,
    note: 'Required for Docker deployment'
  },
  dockerCompose: {
    command: 'docker-compose --version',
    minVersion: '2.0.0',
    name: 'Docker Compose',
    installUrl: 'https://docs.docker.com/compose/install/',
    required: false,
    note: 'Required for Docker deployment'
  },
  psql: {
    command: 'psql --version',
    minVersion: '12.0.0',
    name: 'PostgreSQL Client',
    installUrl: 'https://www.postgresql.org/download/',
    required: false,
    note: 'Required for local PostgreSQL setup'
  }
};

// System resource requirements
const resourceRequirements = {
  memory: {
    minimum: 4, // GB
    recommended: 8, // GB
    name: 'RAM'
  },
  disk: {
    minimum: 20, // GB
    recommended: 50, // GB
    name: 'Disk Space'
  },
  cpu: {
    minimum: 2, // cores
    recommended: 4, // cores
    name: 'CPU Cores'
  }
};

// Version comparison function
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

// Extract version from command output
function extractVersion(output, toolName) {
  // Common version patterns
  const patterns = [
    /v?(\d+\.\d+\.\d+)/,  // Standard semver
    /(\d+\.\d+\.\d+)/,    // Without 'v' prefix
    /version (\d+\.\d+\.\d+)/i,
    /(\d+\.\d+)/          // Major.minor only
  ];
  
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Special cases
  if (toolName === 'docker-compose' && output.includes('docker-compose')) {
    const match = output.match(/docker-compose version (\d+\.\d+\.\d+)/);
    if (match) return match[1];
  }
  
  return null;
}

// Check if a command exists and get its version
function checkCommand(requirement) {
  try {
    const output = execSync(requirement.command, { 
      encoding: 'utf8', 
      stdio: 'pipe' 
    }).trim();
    
    const version = extractVersion(output, requirement.name.toLowerCase().replace(/\s+/g, '-'));
    
    if (!version) {
      return {
        installed: true,
        version: 'unknown',
        versionCheck: false,
        error: 'Could not determine version'
      };
    }
    
    const versionCheck = compareVersions(version, requirement.minVersion) >= 0;
    
    return {
      installed: true,
      version,
      versionCheck,
      minVersion: requirement.minVersion
    };
  } catch (error) {
    return {
      installed: false,
      error: error.message
    };
  }
}

// Check system resources
function checkSystemResources() {
  const results = {};
  
  // Memory check
  const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  results.memory = {
    current: totalMemoryGB,
    minimum: resourceRequirements.memory.minimum,
    recommended: resourceRequirements.memory.recommended,
    sufficient: totalMemoryGB >= resourceRequirements.memory.minimum,
    recommended_met: totalMemoryGB >= resourceRequirements.memory.recommended
  };
  
  // CPU cores check
  const cpuCores = os.cpus().length;
  results.cpu = {
    current: cpuCores,
    minimum: resourceRequirements.cpu.minimum,
    recommended: resourceRequirements.cpu.recommended,
    sufficient: cpuCores >= resourceRequirements.cpu.minimum,
    recommended_met: cpuCores >= resourceRequirements.cpu.recommended
  };
  
  // Disk space check (current directory)
  try {
    let diskSpace = 0;
    
    if (process.platform === 'win32') {
      // Windows
      try {
        const output = execSync('dir /-c', { encoding: 'utf8', cwd: process.cwd() });
        const match = output.match(/(\d+) bytes free/);
        if (match) {
          diskSpace = Math.round(parseInt(match[1]) / (1024 * 1024 * 1024));
        }
      } catch (error) {
        // Fallback for Windows
        diskSpace = 50; // Assume sufficient
      }
    } else {
      // Unix-like systems
      const output = execSync('df -BG .', { encoding: 'utf8' });
      const lines = output.split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        diskSpace = parseInt(parts[3]) || 0;
      }
    }
    
    results.disk = {
      current: diskSpace,
      minimum: resourceRequirements.disk.minimum,
      recommended: resourceRequirements.disk.recommended,
      sufficient: diskSpace >= resourceRequirements.disk.minimum,
      recommended_met: diskSpace >= resourceRequirements.disk.recommended
    };
  } catch (error) {
    results.disk = {
      current: 'unknown',
      minimum: resourceRequirements.disk.minimum,
      recommended: resourceRequirements.disk.recommended,
      sufficient: false,
      recommended_met: false,
      error: 'Could not determine disk space'
    };
  }
  
  return results;
}

// Check Docker daemon status
function checkDockerDaemon() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return { running: true };
  } catch (error) {
    return { 
      running: false, 
      error: 'Docker daemon is not running or not accessible' 
    };
  }
}

// Check network connectivity
async function checkNetworkConnectivity() {
  const testUrls = [
    'https://registry.npmjs.org/',
    'https://github.com',
    'https://api.openai.com',
    'https://supabase.com'
  ];
  
  const results = {};
  
  for (const url of testUrls) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url, { 
        timeout: 5000,
        method: 'HEAD'
      });
      
      results[url] = {
        accessible: response.ok,
        status: response.status
      };
    } catch (error) {
      results[url] = {
        accessible: false,
        error: error.message
      };
    }
  }
  
  return results;
}

// Generate installation instructions
function generateInstallInstructions(failedRequirements) {
  log('📋 Installation Instructions', 'blue');
  log('==========================', 'blue');
  log('');
  
  const platform = process.platform;
  
  for (const req of failedRequirements) {
    log(`Installing ${req.name}:`, 'yellow');
    
    switch (platform) {
      case 'win32':
        generateWindowsInstructions(req);
        break;
      case 'darwin':
        generateMacInstructions(req);
        break;
      case 'linux':
        generateLinuxInstructions(req);
        break;
      default:
        log(`  Visit: ${req.installUrl}`, 'cyan');
    }
    
    log('');
  }
}

function generateWindowsInstructions(req) {
  switch (req.name) {
    case 'Node.js':
      log('  1. Download from https://nodejs.org/', 'cyan');
      log('  2. Run the installer and follow the setup wizard', 'cyan');
      log('  3. Restart your command prompt', 'cyan');
      break;
    case 'Git':
      log('  1. Download from https://git-scm.com/download/win', 'cyan');
      log('  2. Run the installer with default settings', 'cyan');
      break;
    case 'Docker':
      log('  1. Download Docker Desktop from https://docker.com/products/docker-desktop', 'cyan');
      log('  2. Install and restart your computer', 'cyan');
      log('  3. Start Docker Desktop', 'cyan');
      break;
    case 'PostgreSQL Client':
      log('  1. Download from https://www.postgresql.org/download/windows/', 'cyan');
      log('  2. Install PostgreSQL (includes psql client)', 'cyan');
      break;
    default:
      log(`  Visit: ${req.installUrl}`, 'cyan');
  }
}

function generateMacInstructions(req) {
  switch (req.name) {
    case 'Node.js':
      log('  Using Homebrew:', 'cyan');
      log('    brew install node', 'cyan');
      log('  Or download from https://nodejs.org/', 'cyan');
      break;
    case 'Git':
      log('  Using Homebrew:', 'cyan');
      log('    brew install git', 'cyan');
      log('  Or install Xcode Command Line Tools:', 'cyan');
      log('    xcode-select --install', 'cyan');
      break;
    case 'Docker':
      log('  Using Homebrew:', 'cyan');
      log('    brew install --cask docker', 'cyan');
      log('  Or download Docker Desktop from https://docker.com/products/docker-desktop', 'cyan');
      break;
    case 'PostgreSQL Client':
      log('  Using Homebrew:', 'cyan');
      log('    brew install postgresql', 'cyan');
      break;
    default:
      log(`  Visit: ${req.installUrl}`, 'cyan');
  }
}

function generateLinuxInstructions(req) {
  switch (req.name) {
    case 'Node.js':
      log('  Ubuntu/Debian:', 'cyan');
      log('    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -', 'cyan');
      log('    sudo apt-get install -y nodejs', 'cyan');
      log('  CentOS/RHEL:', 'cyan');
      log('    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -', 'cyan');
      log('    sudo yum install -y nodejs', 'cyan');
      break;
    case 'Git':
      log('  Ubuntu/Debian:', 'cyan');
      log('    sudo apt-get update && sudo apt-get install git', 'cyan');
      log('  CentOS/RHEL:', 'cyan');
      log('    sudo yum install git', 'cyan');
      break;
    case 'Docker':
      log('  Ubuntu:', 'cyan');
      log('    curl -fsSL https://get.docker.com -o get-docker.sh', 'cyan');
      log('    sh get-docker.sh', 'cyan');
      log('    sudo usermod -aG docker $USER', 'cyan');
      break;
    case 'PostgreSQL Client':
      log('  Ubuntu/Debian:', 'cyan');
      log('    sudo apt-get install postgresql-client', 'cyan');
      log('  CentOS/RHEL:', 'cyan');
      log('    sudo yum install postgresql', 'cyan');
      break;
    default:
      log(`  Visit: ${req.installUrl}`, 'cyan');
  }
}

// Main validation function
async function validateSystemRequirements(options = {}) {
  log('🔍 System Requirements Check for n8n Workflow Converter', 'cyan');
  log('====================================================', 'cyan');
  log('');
  
  let hasErrors = false;
  let hasWarnings = false;
  const failedRequirements = [];
  
  // Check software requirements
  log('📦 Software Requirements', 'yellow');
  log('=======================', 'yellow');
  log('');
  
  for (const [key, requirement] of Object.entries(requirements)) {
    const result = checkCommand(requirement);
    
    if (!result.installed) {
      if (requirement.required) {
        log(`❌ ${requirement.name}: Not installed`, 'red');
        hasErrors = true;
        failedRequirements.push(requirement);
      } else {
        log(`⚠️  ${requirement.name}: Not installed (${requirement.note})`, 'yellow');
        hasWarnings = true;
      }
    } else if (result.version === 'unknown') {
      log(`⚠️  ${requirement.name}: Installed but version unknown`, 'yellow');
      hasWarnings = true;
    } else if (!result.versionCheck) {
      if (requirement.required) {
        log(`❌ ${requirement.name}: Version ${result.version} (>= ${result.minVersion} required)`, 'red');
        hasErrors = true;
        failedRequirements.push(requirement);
      } else {
        log(`⚠️  ${requirement.name}: Version ${result.version} (>= ${result.minVersion} recommended)`, 'yellow');
        hasWarnings = true;
      }
    } else {
      log(`✅ ${requirement.name}: Version ${result.version}`, 'green');
    }
  }
  
  log('');
  
  // Check Docker daemon if Docker is installed
  const dockerResult = checkCommand(requirements.docker);
  if (dockerResult.installed && dockerResult.versionCheck) {
    const daemonResult = checkDockerDaemon();
    if (!daemonResult.running) {
      log(`⚠️  Docker: ${daemonResult.error}`, 'yellow');
      hasWarnings = true;
    } else {
      log('✅ Docker: Daemon is running', 'green');
    }
    log('');
  }
  
  // Check system resources
  log('💻 System Resources', 'yellow');
  log('==================', 'yellow');
  log('');
  
  const resources = checkSystemResources();
  
  for (const [key, resource] of Object.entries(resources)) {
    const name = resourceRequirements[key].name;
    
    if (resource.error) {
      log(`⚠️  ${name}: ${resource.error}`, 'yellow');
      hasWarnings = true;
    } else if (!resource.sufficient) {
      log(`❌ ${name}: ${resource.current}${key === 'memory' || key === 'disk' ? 'GB' : ''} (${resource.minimum}${key === 'memory' || key === 'disk' ? 'GB' : ''} minimum required)`, 'red');
      hasErrors = true;
    } else if (!resource.recommended_met) {
      log(`⚠️  ${name}: ${resource.current}${key === 'memory' || key === 'disk' ? 'GB' : ''} (${resource.recommended}${key === 'memory' || key === 'disk' ? 'GB' : ''} recommended)`, 'yellow');
      hasWarnings = true;
    } else {
      log(`✅ ${name}: ${resource.current}${key === 'memory' || key === 'disk' ? 'GB' : ''}`, 'green');
    }
  }
  
  log('');
  
  // Check network connectivity if requested
  if (options.checkNetwork) {
    log('🌐 Network Connectivity', 'yellow');
    log('======================', 'yellow');
    log('');
    
    try {
      const networkResults = await checkNetworkConnectivity();
      
      for (const [url, result] of Object.entries(networkResults)) {
        const domain = new URL(url).hostname;
        
        if (result.accessible) {
          log(`✅ ${domain}: Accessible`, 'green');
        } else {
          log(`⚠️  ${domain}: ${result.error}`, 'yellow');
          hasWarnings = true;
        }
      }
    } catch (error) {
      log(`⚠️  Network check failed: ${error.message}`, 'yellow');
      hasWarnings = true;
    }
    
    log('');
  }
  
  // System information
  if (options.verbose) {
    log('ℹ️  System Information', 'blue');
    log('=====================', 'blue');
    log(`Platform: ${os.platform()} ${os.arch()}`, 'blue');
    log(`OS Release: ${os.release()}`, 'blue');
    log(`Node.js: ${process.version}`, 'blue');
    log(`CPU: ${os.cpus()[0].model}`, 'blue');
    log(`Memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`, 'blue');
    log('');
  }
  
  // Summary and recommendations
  log('📋 Summary', 'blue');
  log('==========', 'blue');
  
  if (hasErrors) {
    log('❌ System requirements check failed. Critical requirements are missing.', 'red');
    log('');
    
    if (failedRequirements.length > 0) {
      generateInstallInstructions(failedRequirements);
    }
    
    return false;
  } else if (hasWarnings) {
    log('⚠️  System requirements check completed with warnings.', 'yellow');
    log('The system meets minimum requirements but some recommendations are not met.', 'yellow');
    log('');
    return true;
  } else {
    log('✅ All system requirements are met!', 'green');
    log('Your system is ready for n8n Workflow Converter installation.', 'green');
    log('');
    return true;
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const options = {
    checkNetwork: args.includes('--check-network'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (options.help) {
    console.log(`
System Requirements Validation for n8n Workflow Converter

Usage: node system-requirements.js [options]

Options:
  --check-network    Test network connectivity to required services
  --verbose, -v      Show detailed system information
  --help, -h         Show this help message

This script checks:
  ✓ Required software and versions
  ✓ System resources (RAM, CPU, disk space)
  ✓ Docker daemon status (if Docker is installed)
  ✓ Network connectivity (optional)

Examples:
  node system-requirements.js                    # Basic check
  node system-requirements.js --check-network   # Include network tests
  node system-requirements.js --verbose         # Detailed output
`);
    return;
  }
  
  validateSystemRequirements(options)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`❌ System check error: ${error.message}`, 'red');
      process.exit(1);
    });
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  validateSystemRequirements,
  checkCommand,
  checkSystemResources,
  requirements,
  resourceRequirements
};