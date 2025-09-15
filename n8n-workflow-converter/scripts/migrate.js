#!/usr/bin/env node

/**
 * Database migration script for n8n Workflow Converter
 * This script handles database migrations and seeding
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
  migrationsDir: path.join(__dirname, '..', 'supabase', 'migrations'),
  seedsDir: path.join(__dirname, '..', 'supabase', 'seeds'),
  backupDir: path.join(__dirname, '..', 'backups'),
  logFile: path.join(__dirname, '..', 'migration.log')
};

// Logging function
function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  
  // Write to log file
  fs.appendFileSync(config.logFile, logMessage + '\n');
  
  // Write to console with color
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Error handling
function handleError(error, context = '') {
  log(`❌ Error ${context}: ${error.message}`, 'red');
  if (error.stack) {
    log(`Stack trace: ${error.stack}`, 'red');
  }
  process.exit(1);
}

// Check if we're using Supabase or direct PostgreSQL
function detectDatabaseType() {
  const envFiles = ['.env.local', '.env.production', '.env'];
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      
      if (content.includes('NEXT_PUBLIC_SUPABASE_URL') && 
          !content.match(/^NEXT_PUBLIC_SUPABASE_URL=$/m)) {
        return 'supabase';
      }
      
      if (content.includes('DATABASE_URL') && 
          !content.match(/^DATABASE_URL=$/m)) {
        return 'postgresql';
      }
    }
  }
  
  return 'unknown';
}

// Load environment variables
function loadEnvironment() {
  const envFiles = ['.env.local', '.env.production', '.env'];
  
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

// Check Supabase CLI
function checkSupabaseCLI() {
  try {
    execSync('supabase --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// Install Supabase CLI
function installSupabaseCLI() {
  log('Installing Supabase CLI...', 'yellow');
  
  try {
    execSync('npm install -g supabase', { stdio: 'inherit' });
    log('✅ Supabase CLI installed successfully', 'green');
  } catch (error) {
    handleError(error, 'installing Supabase CLI');
  }
}

// Run Supabase migrations
function runSupabaseMigrations() {
  log('Running Supabase migrations...', 'yellow');
  
  try {
    // Check if supabase directory exists
    if (!fs.existsSync('supabase')) {
      log('Supabase directory not found, initializing...', 'yellow');
      execSync('supabase init', { stdio: 'inherit' });
    }
    
    // Link to remote project if URL is provided
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (projectId) {
        log(`Linking to Supabase project: ${projectId}`, 'blue');
        try {
          execSync(`supabase link --project-ref ${projectId}`, { stdio: 'inherit' });
        } catch (error) {
          log('⚠️  Failed to link project, continuing with local migrations', 'yellow');
        }
      }
    }
    
    // Push migrations
    if (fs.existsSync(config.migrationsDir)) {
      log('Pushing migrations to Supabase...', 'blue');
      execSync('supabase db push', { stdio: 'inherit' });
    } else {
      log('No migrations directory found', 'yellow');
    }
    
    log('✅ Supabase migrations completed', 'green');
  } catch (error) {
    handleError(error, 'running Supabase migrations');
  }
}

// Run PostgreSQL migrations
function runPostgreSQLMigrations() {
  log('Running PostgreSQL migrations...', 'yellow');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    handleError(new Error('DATABASE_URL not found in environment'), 'checking database URL');
  }
  
  try {
    // Check if psql is available
    execSync('psql --version', { stdio: 'pipe' });
  } catch (error) {
    handleError(new Error('psql command not found. Please install PostgreSQL client tools.'), 'checking psql');
  }
  
  try {
    // Test database connection
    log('Testing database connection...', 'blue');
    execSync(`psql "${databaseUrl}" -c "SELECT version();"`, { stdio: 'pipe' });
    log('✅ Database connection successful', 'green');
    
    // Run migration files
    if (fs.existsSync(config.migrationsDir)) {
      const migrationFiles = fs.readdirSync(config.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      for (const file of migrationFiles) {
        const filePath = path.join(config.migrationsDir, file);
        log(`Running migration: ${file}`, 'blue');
        
        try {
          execSync(`psql "${databaseUrl}" -f "${filePath}"`, { stdio: 'inherit' });
          log(`✅ Migration ${file} completed`, 'green');
        } catch (error) {
          log(`⚠️  Migration ${file} failed: ${error.message}`, 'yellow');
          // Continue with other migrations
        }
      }
    } else {
      log('No migrations directory found', 'yellow');
    }
    
    log('✅ PostgreSQL migrations completed', 'green');
  } catch (error) {
    handleError(error, 'running PostgreSQL migrations');
  }
}

// Create storage buckets (Supabase)
function createStorageBuckets() {
  log('Creating storage buckets...', 'yellow');
  
  const buckets = [
    { name: 'workflow-files', public: false },
    { name: 'generated-projects', public: false }
  ];
  
  for (const bucket of buckets) {
    try {
      log(`Creating bucket: ${bucket.name}`, 'blue');
      execSync(`supabase storage create ${bucket.name}`, { stdio: 'pipe' });
      log(`✅ Bucket ${bucket.name} created`, 'green');
    } catch (error) {
      if (error.message.includes('already exists')) {
        log(`✅ Bucket ${bucket.name} already exists`, 'green');
      } else {
        log(`⚠️  Failed to create bucket ${bucket.name}: ${error.message}`, 'yellow');
      }
    }
  }
}

// Run database seeds
function runSeeds() {
  log('Running database seeds...', 'yellow');
  
  if (!fs.existsSync(config.seedsDir)) {
    log('No seeds directory found, skipping...', 'yellow');
    return;
  }
  
  const seedFiles = fs.readdirSync(config.seedsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  if (seedFiles.length === 0) {
    log('No seed files found, skipping...', 'yellow');
    return;
  }
  
  const dbType = detectDatabaseType();
  
  for (const file of seedFiles) {
    const filePath = path.join(config.seedsDir, file);
    log(`Running seed: ${file}`, 'blue');
    
    try {
      if (dbType === 'supabase') {
        // For Supabase, we can use psql with the connection string
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && serviceKey) {
          const connectionString = `postgresql://postgres:${serviceKey}@db.${supabaseUrl.split('//')[1].split('.')[0]}.supabase.co:5432/postgres`;
          execSync(`psql "${connectionString}" -f "${filePath}"`, { stdio: 'inherit' });
        } else {
          log(`⚠️  Supabase connection details not found for seed ${file}`, 'yellow');
        }
      } else if (dbType === 'postgresql') {
        execSync(`psql "${process.env.DATABASE_URL}" -f "${filePath}"`, { stdio: 'inherit' });
      }
      
      log(`✅ Seed ${file} completed`, 'green');
    } catch (error) {
      log(`⚠️  Seed ${file} failed: ${error.message}`, 'yellow');
    }
  }
}

// Create backup before migration
function createBackup() {
  log('Creating database backup...', 'yellow');
  
  const dbType = detectDatabaseType();
  if (dbType !== 'postgresql') {
    log('Backup only supported for PostgreSQL, skipping...', 'yellow');
    return;
  }
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('DATABASE_URL not found, skipping backup...', 'yellow');
    return;
  }
  
  try {
    // Create backup directory
    if (!fs.existsSync(config.backupDir)) {
      fs.mkdirSync(config.backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(config.backupDir, `pre-migration-${timestamp}.sql`);
    
    log(`Creating backup: ${backupFile}`, 'blue');
    execSync(`pg_dump "${databaseUrl}" > "${backupFile}"`, { stdio: 'inherit' });
    
    log(`✅ Backup created: ${backupFile}`, 'green');
  } catch (error) {
    log(`⚠️  Backup failed: ${error.message}`, 'yellow');
  }
}

// Validate migration status
function validateMigrations() {
  log('Validating migration status...', 'yellow');
  
  const dbType = detectDatabaseType();
  
  try {
    if (dbType === 'supabase') {
      // Check Supabase migration status
      const result = execSync('supabase migration list', { encoding: 'utf8' });
      log('Migration status:', 'blue');
      console.log(result);
    } else if (dbType === 'postgresql') {
      // Check if migration tracking table exists
      const databaseUrl = process.env.DATABASE_URL;
      const result = execSync(`psql "${databaseUrl}" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations');"`, { encoding: 'utf8' });
      
      if (result.trim() === 't') {
        log('✅ Migration tracking table exists', 'green');
      } else {
        log('⚠️  Migration tracking table not found', 'yellow');
      }
    }
    
    log('✅ Migration validation completed', 'green');
  } catch (error) {
    log(`⚠️  Migration validation failed: ${error.message}`, 'yellow');
  }
}

// Main migration function
function runMigrations(options = {}) {
  log('🗄️  Starting database migration process', 'cyan');
  log('=====================================', 'cyan');
  
  try {
    // Load environment
    loadEnvironment();
    
    // Detect database type
    const dbType = detectDatabaseType();
    log(`Detected database type: ${dbType}`, 'blue');
    
    if (dbType === 'unknown') {
      handleError(new Error('Could not detect database configuration. Please check your environment variables.'));
    }
    
    // Create backup if requested
    if (options.backup) {
      createBackup();
    }
    
    // Run migrations based on database type
    if (dbType === 'supabase') {
      // Check and install Supabase CLI if needed
      if (!checkSupabaseCLI()) {
        if (options.installCLI) {
          installSupabaseCLI();
        } else {
          handleError(new Error('Supabase CLI not found. Install it with: npm install -g supabase'));
        }
      }
      
      runSupabaseMigrations();
      
      if (options.createBuckets) {
        createStorageBuckets();
      }
    } else if (dbType === 'postgresql') {
      runPostgreSQLMigrations();
    }
    
    // Run seeds if requested
    if (options.seed) {
      runSeeds();
    }
    
    // Validate migrations
    validateMigrations();
    
    log('🎉 Migration process completed successfully!', 'green');
    
  } catch (error) {
    handleError(error, 'during migration process');
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const options = {
    backup: args.includes('--backup'),
    seed: args.includes('--seed'),
    installCLI: args.includes('--install-cli'),
    createBuckets: args.includes('--create-buckets'),
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (options.help) {
    console.log(`
Database Migration Script for n8n Workflow Converter

Usage: node migrate.js [options]

Options:
  --backup         Create a backup before running migrations
  --seed           Run database seeds after migrations
  --install-cli    Automatically install Supabase CLI if needed
  --create-buckets Create Supabase storage buckets
  -h, --help       Show this help message

Examples:
  node migrate.js                           # Run migrations only
  node migrate.js --backup --seed           # Backup, migrate, and seed
  node migrate.js --install-cli --create-buckets  # Full Supabase setup

Environment Variables:
  DATABASE_URL              PostgreSQL connection string
  NEXT_PUBLIC_SUPABASE_URL  Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY Supabase service role key
`);
    return;
  }
  
  // Create log file
  if (!fs.existsSync(path.dirname(config.logFile))) {
    fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
  }
  
  runMigrations(options);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  handleError(error, 'uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
  handleError(new Error(`Unhandled rejection: ${reason}`), 'unhandled promise rejection');
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  detectDatabaseType,
  loadEnvironment
};