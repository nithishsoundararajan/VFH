#!/usr/bin/env node

/**
 * Backup and restore script for n8n Workflow Converter
 * This script handles data backup and restoration for different deployment types
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');
const extract = require('extract-zip');

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
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Configuration
const config = {
  backupDir: path.join(__dirname, '..', 'backups'),
  tempDir: path.join(__dirname, '..', 'temp'),
  logFile: path.join(__dirname, '..', 'backup.log')
};

// Ensure directories exist
function ensureDirectories() {
  [config.backupDir, config.tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Load environment variables
function loadEnvironment() {
  const envFiles = ['.env.local', '.env.production', '.env'];
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
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

// Detect deployment type
function detectDeploymentType() {
  if (fs.existsSync('docker-compose.yml') || fs.existsSync('docker-compose.full-stack.yml')) {
    return 'docker';
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return 'supabase';
  } else if (process.env.DATABASE_URL) {
    return 'postgresql';
  } else {
    return 'unknown';
  }
}

// Database backup functions
async function backupDatabase(deploymentType, backupPath) {
  log('📄 Backing up database...', 'yellow');
  
  switch (deploymentType) {
    case 'docker':
      await backupDockerDatabase(backupPath);
      break;
    case 'postgresql':
      await backupPostgreSQLDatabase(backupPath);
      break;
    case 'supabase':
      await backupSupabaseDatabase(backupPath);
      break;
    default:
      log('⚠️  Unknown deployment type, skipping database backup', 'yellow');
  }
}

async function backupDockerDatabase(backupPath) {
  try {
    const dbBackupPath = path.join(backupPath, 'database.sql');
    
    // Check if Docker containers are running
    const containers = execSync('docker-compose ps -q postgres', { encoding: 'utf8' }).trim();
    if (!containers) {
      throw new Error('PostgreSQL container is not running');
    }
    
    // Create database backup
    execSync(`docker-compose exec -T postgres pg_dump -U postgres -d n8n_converter > "${dbBackupPath}"`, {
      stdio: 'inherit'
    });
    
    log('✅ Docker database backup completed', 'green');
  } catch (error) {
    log(`❌ Docker database backup failed: ${error.message}`, 'red');
    throw error;
  }
}

async function backupPostgreSQLDatabase(backupPath) {
  try {
    const dbBackupPath = path.join(backupPath, 'database.sql');
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not found');
    }
    
    execSync(`pg_dump "${databaseUrl}" > "${dbBackupPath}"`, {
      stdio: 'inherit'
    });
    
    log('✅ PostgreSQL database backup completed', 'green');
  } catch (error) {
    log(`❌ PostgreSQL database backup failed: ${error.message}`, 'red');
    throw error;
  }
}

async function backupSupabaseDatabase(backupPath) {
  try {
    const dbBackupPath = path.join(backupPath, 'supabase-schema.sql');
    
    // Use Supabase CLI to dump schema
    execSync(`supabase db dump --schema-only > "${dbBackupPath}"`, {
      stdio: 'inherit'
    });
    
    // Also backup data if possible
    const dataBackupPath = path.join(backupPath, 'supabase-data.sql');
    try {
      execSync(`supabase db dump --data-only > "${dataBackupPath}"`, {
        stdio: 'inherit'
      });
    } catch (error) {
      log('⚠️  Could not backup Supabase data (schema only backed up)', 'yellow');
    }
    
    log('✅ Supabase database backup completed', 'green');
  } catch (error) {
    log(`❌ Supabase database backup failed: ${error.message}`, 'red');
    throw error;
  }
}

// File system backup functions
async function backupFiles(backupPath) {
  log('📁 Backing up application files...', 'yellow');
  
  const filesToBackup = [
    // Configuration files
    '.env.local',
    '.env.production',
    '.env.docker',
    
    // Application data
    'logs',
    'storage',
    'uploads',
    
    // Custom configurations
    'nginx',
    'monitoring',
    
    // SSL certificates
    'ssl',
    'certs'
  ];
  
  const filesBackupPath = path.join(backupPath, 'files');
  fs.mkdirSync(filesBackupPath, { recursive: true });
  
  for (const item of filesToBackup) {
    if (fs.existsSync(item)) {
      const destPath = path.join(filesBackupPath, item);
      
      try {
        if (fs.statSync(item).isDirectory()) {
          // Copy directory recursively
          execSync(`cp -r "${item}" "${destPath}"`, { stdio: 'pipe' });
        } else {
          // Copy file
          fs.copyFileSync(item, destPath);
        }
        
        log(`✅ Backed up: ${item}`, 'green');
      } catch (error) {
        log(`⚠️  Failed to backup ${item}: ${error.message}`, 'yellow');
      }
    }
  }
  
  log('✅ File backup completed', 'green');
}

// Docker volumes backup
async function backupDockerVolumes(backupPath) {
  log('🐳 Backing up Docker volumes...', 'yellow');
  
  try {
    const volumesBackupPath = path.join(backupPath, 'volumes');
    fs.mkdirSync(volumesBackupPath, { recursive: true });
    
    // Get list of project volumes
    const volumes = execSync('docker volume ls --filter name=n8n-workflow-converter --format "{{.Name}}"', {
      encoding: 'utf8'
    }).trim().split('\n').filter(v => v);
    
    for (const volume of volumes) {
      const volumeBackupPath = path.join(volumesBackupPath, `${volume}.tar`);
      
      try {
        execSync(`docker run --rm -v ${volume}:/data -v "${volumesBackupPath}":/backup alpine tar -czf /backup/${volume}.tar -C /data .`, {
          stdio: 'inherit'
        });
        
        log(`✅ Backed up volume: ${volume}`, 'green');
      } catch (error) {
        log(`⚠️  Failed to backup volume ${volume}: ${error.message}`, 'yellow');
      }
    }
    
    log('✅ Docker volumes backup completed', 'green');
  } catch (error) {
    log(`❌ Docker volumes backup failed: ${error.message}`, 'red');
  }
}

// Create backup manifest
function createBackupManifest(backupPath, deploymentType) {
  const manifest = {
    timestamp: new Date().toISOString(),
    deploymentType,
    version: '1.0.0',
    platform: process.platform,
    nodeVersion: process.version,
    contents: {
      database: fs.existsSync(path.join(backupPath, 'database.sql')) || 
                fs.existsSync(path.join(backupPath, 'supabase-schema.sql')),
      files: fs.existsSync(path.join(backupPath, 'files')),
      volumes: fs.existsSync(path.join(backupPath, 'volumes'))
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasPostgreSQL: !!process.env.DATABASE_URL,
      hasDocker: deploymentType === 'docker'
    }
  };
  
  fs.writeFileSync(
    path.join(backupPath, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  return manifest;
}

// Create compressed backup
async function createCompressedBackup(backupPath, outputPath) {
  log('📦 Creating compressed backup...', 'yellow');
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      log(`✅ Compressed backup created: ${outputPath} (${sizeInMB} MB)`, 'green');
      resolve();
    });
    
    archive.on('error', (err) => {
      log(`❌ Compression failed: ${err.message}`, 'red');
      reject(err);
    });
    
    archive.pipe(output);
    archive.directory(backupPath, false);
    archive.finalize();
  });
}

// Main backup function
async function createBackup(options = {}) {
  log('🔄 Starting backup process...', 'cyan');
  
  try {
    ensureDirectories();
    loadEnvironment();
    
    const deploymentType = detectDeploymentType();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(config.backupDir, backupName);
    
    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });
    
    log(`📂 Backup directory: ${backupPath}`, 'blue');
    log(`🔧 Deployment type: ${deploymentType}`, 'blue');
    
    // Backup database
    if (!options.skipDatabase) {
      await backupDatabase(deploymentType, backupPath);
    }
    
    // Backup files
    if (!options.skipFiles) {
      await backupFiles(backupPath);
    }
    
    // Backup Docker volumes if applicable
    if (deploymentType === 'docker' && !options.skipVolumes) {
      await backupDockerVolumes(backupPath);
    }
    
    // Create manifest
    const manifest = createBackupManifest(backupPath, deploymentType);
    log('✅ Backup manifest created', 'green');
    
    // Create compressed backup if requested
    let finalBackupPath = backupPath;
    if (options.compress) {
      const compressedPath = `${backupPath}.zip`;
      await createCompressedBackup(backupPath, compressedPath);
      
      // Remove uncompressed backup if compression succeeded
      if (fs.existsSync(compressedPath)) {
        execSync(`rm -rf "${backupPath}"`);
        finalBackupPath = compressedPath;
      }
    }
    
    log('🎉 Backup completed successfully!', 'green');
    log(`📦 Backup location: ${finalBackupPath}`, 'green');
    
    return {
      success: true,
      backupPath: finalBackupPath,
      manifest
    };
    
  } catch (error) {
    log(`❌ Backup failed: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message
    };
  }
}

// Restore functions
async function restoreDatabase(backupPath, deploymentType) {
  log('📄 Restoring database...', 'yellow');
  
  const dbBackupFile = path.join(backupPath, 'database.sql');
  const supabaseSchemaFile = path.join(backupPath, 'supabase-schema.sql');
  const supabaseDataFile = path.join(backupPath, 'supabase-data.sql');
  
  switch (deploymentType) {
    case 'docker':
      if (fs.existsSync(dbBackupFile)) {
        execSync(`docker-compose exec -T postgres psql -U postgres -d n8n_converter < "${dbBackupFile}"`, {
          stdio: 'inherit'
        });
        log('✅ Docker database restored', 'green');
      }
      break;
      
    case 'postgresql':
      if (fs.existsSync(dbBackupFile)) {
        const databaseUrl = process.env.DATABASE_URL;
        execSync(`psql "${databaseUrl}" < "${dbBackupFile}"`, {
          stdio: 'inherit'
        });
        log('✅ PostgreSQL database restored', 'green');
      }
      break;
      
    case 'supabase':
      if (fs.existsSync(supabaseSchemaFile)) {
        execSync(`supabase db push --file "${supabaseSchemaFile}"`, {
          stdio: 'inherit'
        });
        
        if (fs.existsSync(supabaseDataFile)) {
          // Note: Data restoration for Supabase might need manual intervention
          log('⚠️  Supabase data file found but automatic restoration not supported', 'yellow');
          log(`   Manual restoration required: ${supabaseDataFile}`, 'yellow');
        }
        
        log('✅ Supabase schema restored', 'green');
      }
      break;
  }
}

async function restoreFiles(backupPath) {
  log('📁 Restoring application files...', 'yellow');
  
  const filesBackupPath = path.join(backupPath, 'files');
  
  if (!fs.existsSync(filesBackupPath)) {
    log('⚠️  No files backup found', 'yellow');
    return;
  }
  
  const items = fs.readdirSync(filesBackupPath);
  
  for (const item of items) {
    const sourcePath = path.join(filesBackupPath, item);
    const destPath = item;
    
    try {
      if (fs.statSync(sourcePath).isDirectory()) {
        // Copy directory recursively
        if (fs.existsSync(destPath)) {
          execSync(`rm -rf "${destPath}"`);
        }
        execSync(`cp -r "${sourcePath}" "${destPath}"`);
      } else {
        // Copy file
        fs.copyFileSync(sourcePath, destPath);
      }
      
      log(`✅ Restored: ${item}`, 'green');
    } catch (error) {
      log(`⚠️  Failed to restore ${item}: ${error.message}`, 'yellow');
    }
  }
  
  log('✅ Files restoration completed', 'green');
}

async function restoreDockerVolumes(backupPath) {
  log('🐳 Restoring Docker volumes...', 'yellow');
  
  const volumesBackupPath = path.join(backupPath, 'volumes');
  
  if (!fs.existsSync(volumesBackupPath)) {
    log('⚠️  No Docker volumes backup found', 'yellow');
    return;
  }
  
  const volumeFiles = fs.readdirSync(volumesBackupPath).filter(f => f.endsWith('.tar'));
  
  for (const volumeFile of volumeFiles) {
    const volumeName = volumeFile.replace('.tar', '');
    const volumeBackupFile = path.join(volumesBackupPath, volumeFile);
    
    try {
      // Create volume if it doesn't exist
      execSync(`docker volume create ${volumeName}`, { stdio: 'pipe' });
      
      // Restore volume data
      execSync(`docker run --rm -v ${volumeName}:/data -v "${volumesBackupPath}":/backup alpine tar -xzf /backup/${volumeFile} -C /data`, {
        stdio: 'inherit'
      });
      
      log(`✅ Restored volume: ${volumeName}`, 'green');
    } catch (error) {
      log(`⚠️  Failed to restore volume ${volumeName}: ${error.message}`, 'yellow');
    }
  }
  
  log('✅ Docker volumes restoration completed', 'green');
}

// Main restore function
async function restoreBackup(backupPath, options = {}) {
  log('🔄 Starting restore process...', 'cyan');
  
  try {
    loadEnvironment();
    
    // Handle compressed backup
    let actualBackupPath = backupPath;
    if (backupPath.endsWith('.zip')) {
      log('📦 Extracting compressed backup...', 'yellow');
      const extractPath = path.join(config.tempDir, 'restore-' + Date.now());
      await extract(backupPath, { dir: extractPath });
      actualBackupPath = extractPath;
      log('✅ Backup extracted', 'green');
    }
    
    // Read manifest
    const manifestPath = path.join(actualBackupPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Backup manifest not found');
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    log(`📋 Backup created: ${manifest.timestamp}`, 'blue');
    log(`🔧 Deployment type: ${manifest.deploymentType}`, 'blue');
    
    const currentDeploymentType = detectDeploymentType();
    if (manifest.deploymentType !== currentDeploymentType) {
      log(`⚠️  Deployment type mismatch: backup=${manifest.deploymentType}, current=${currentDeploymentType}`, 'yellow');
      
      if (!options.force) {
        throw new Error('Deployment type mismatch. Use --force to override.');
      }
    }
    
    // Restore database
    if (manifest.contents.database && !options.skipDatabase) {
      await restoreDatabase(actualBackupPath, manifest.deploymentType);
    }
    
    // Restore files
    if (manifest.contents.files && !options.skipFiles) {
      await restoreFiles(actualBackupPath);
    }
    
    // Restore Docker volumes
    if (manifest.contents.volumes && !options.skipVolumes) {
      await restoreDockerVolumes(actualBackupPath);
    }
    
    // Cleanup temporary extraction
    if (backupPath.endsWith('.zip')) {
      execSync(`rm -rf "${actualBackupPath}"`);
    }
    
    log('🎉 Restore completed successfully!', 'green');
    
    return {
      success: true,
      manifest
    };
    
  } catch (error) {
    log(`❌ Restore failed: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message
    };
  }
}

// List available backups
function listBackups() {
  log('📋 Available Backups', 'cyan');
  log('==================', 'cyan');
  
  if (!fs.existsSync(config.backupDir)) {
    log('No backups found', 'yellow');
    return [];
  }
  
  const backups = fs.readdirSync(config.backupDir)
    .filter(item => {
      const itemPath = path.join(config.backupDir, item);
      return fs.statSync(itemPath).isDirectory() || item.endsWith('.zip');
    })
    .map(item => {
      const itemPath = path.join(config.backupDir, item);
      const stats = fs.statSync(itemPath);
      
      // Try to read manifest
      let manifest = null;
      try {
        if (item.endsWith('.zip')) {
          // For compressed backups, we can't easily read the manifest without extracting
          manifest = { deploymentType: 'unknown', timestamp: 'unknown' };
        } else {
          const manifestPath = path.join(itemPath, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          }
        }
      } catch (error) {
        // Ignore manifest read errors
      }
      
      return {
        name: item,
        path: itemPath,
        size: stats.size,
        created: stats.mtime,
        manifest
      };
    })
    .sort((a, b) => b.created - a.created);
  
  backups.forEach((backup, index) => {
    const sizeInMB = (backup.size / 1024 / 1024).toFixed(2);
    const age = Math.round((Date.now() - backup.created.getTime()) / (1000 * 60 * 60 * 24));
    
    log(`${index + 1}. ${backup.name}`, 'blue');
    log(`   Created: ${backup.created.toISOString()}`, 'blue');
    log(`   Size: ${sizeInMB} MB`, 'blue');
    log(`   Age: ${age} days`, 'blue');
    
    if (backup.manifest) {
      log(`   Type: ${backup.manifest.deploymentType}`, 'blue');
    }
    
    log('', 'reset');
  });
  
  return backups;
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const options = {
    compress: args.includes('--compress'),
    skipDatabase: args.includes('--skip-database'),
    skipFiles: args.includes('--skip-files'),
    skipVolumes: args.includes('--skip-volumes'),
    force: args.includes('--force'),
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (options.help || !command) {
    console.log(`
Backup and Restore Script for n8n Workflow Converter

Usage: node backup-restore.js <command> [options]

Commands:
  backup                Create a new backup
  restore <path>        Restore from backup
  list                  List available backups

Options:
  --compress            Create compressed backup (backup only)
  --skip-database       Skip database backup/restore
  --skip-files          Skip files backup/restore
  --skip-volumes        Skip Docker volumes backup/restore
  --force               Force restore even with deployment type mismatch
  --help, -h            Show this help message

Examples:
  node backup-restore.js backup --compress
  node backup-restore.js restore backups/backup-2024-01-01.zip
  node backup-restore.js list

Supported deployment types:
  - Docker (docker-compose)
  - Supabase
  - PostgreSQL
`);
    return;
  }
  
  switch (command) {
    case 'backup':
      createBackup(options)
        .then(result => {
          process.exit(result.success ? 0 : 1);
        });
      break;
      
    case 'restore':
      const backupPath = args[1];
      if (!backupPath) {
        log('❌ Backup path required for restore command', 'red');
        process.exit(1);
      }
      
      restoreBackup(backupPath, options)
        .then(result => {
          process.exit(result.success ? 0 : 1);
        });
      break;
      
    case 'list':
      listBackups();
      break;
      
    default:
      log(`❌ Unknown command: ${command}`, 'red');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups
};