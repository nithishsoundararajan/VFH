#!/usr/bin/env tsx

/**
 * Database Migration Management Script
 * Handles database migrations, rollbacks, and backup operations
 */

import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const execAsync = promisify(exec)

interface MigrationInfo {
  version: string
  name: string
  applied: boolean
  appliedAt?: string
  checksum?: string
}

class DatabaseMigrationManager {
  private supabase: any
  private migrationsPath = 'supabase/migrations'
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  
  /**
   * Get list of available migrations
   */
  async getAvailableMigrations(): Promise<MigrationInfo[]> {
    try {
      const files = await readdir(this.migrationsPath)
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort()
      
      const migrations: MigrationInfo[] = []
      
      for (const file of migrationFiles) {
        const version = file.split('_')[0]
        const name = file.replace('.sql', '').replace(`${version}_`, '')
        
        // Check if migration is applied
        const { data: appliedMigration } = await this.supabase
          .from('supabase_migrations')
          .select('*')
          .eq('version', version)
          .single()
        
        migrations.push({
          version,
          name,
          applied: !!appliedMigration,
          appliedAt: appliedMigration?.inserted_at,
          checksum: appliedMigration?.checksum
        })
      }
      
      return migrations
    } catch (error) {
      console.error('Failed to get available migrations:', error)
      throw error
    }
  }
  
  /**
   * Apply pending migrations
   */
  async applyMigrations(dryRun: boolean = false): Promise<void> {
    console.log('🔄 Checking for pending migrations...')
    
    const migrations = await this.getAvailableMigrations()
    const pendingMigrations = migrations.filter(m => !m.applied)
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations found')
      return
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migrations:`)
    pendingMigrations.forEach(m => {
      console.log(`  - ${m.version}: ${m.name}`)
    })
    
    if (dryRun) {
      console.log('🔍 Dry run mode - no migrations will be applied')
      return
    }
    
    // Create backup before applying migrations
    await this.createBackup(`pre-migration-${Date.now()}`)
    
    for (const migration of pendingMigrations) {
      await this.applyMigration(migration)
    }
    
    console.log('✅ All migrations applied successfully')
  }
  
  /**
   * Apply a single migration
   */
  private async applyMigration(migration: MigrationInfo): Promise<void> {
    console.log(`🔄 Applying migration ${migration.version}: ${migration.name}`)
    
    try {
      // Read migration file
      const migrationPath = join(this.migrationsPath, `${migration.version}_${migration.name}.sql`)
      const migrationSql = await readFile(migrationPath, 'utf-8')
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(migrationSql)
      
      // Apply migration using Supabase CLI
      const { stdout, stderr } = await execAsync(`supabase db push --include-all`)
      
      if (stderr && !stderr.includes('warning')) {
        throw new Error(`Migration failed: ${stderr}`)
      }
      
      console.log(`✅ Migration ${migration.version} applied successfully`)
      
    } catch (error) {
      console.error(`❌ Failed to apply migration ${migration.version}:`, error)
      throw error
    }
  }
  
  /**
   * Rollback to a specific migration version
   */
  async rollbackToVersion(targetVersion: string): Promise<void> {
    console.log(`🔄 Rolling back to version ${targetVersion}...`)
    
    const migrations = await this.getAvailableMigrations()
    const appliedMigrations = migrations
      .filter(m => m.applied)
      .sort((a, b) => b.version.localeCompare(a.version))
    
    const targetMigration = migrations.find(m => m.version === targetVersion)
    if (!targetMigration) {
      throw new Error(`Migration version ${targetVersion} not found`)
    }
    
    // Create backup before rollback
    await this.createBackup(`pre-rollback-${Date.now()}`)
    
    // Find migrations to rollback
    const migrationsToRollback = appliedMigrations.filter(m => 
      m.version > targetVersion
    )
    
    if (migrationsToRollback.length === 0) {
      console.log('✅ No migrations to rollback')
      return
    }
    
    console.log(`📋 Rolling back ${migrationsToRollback.length} migrations:`)
    migrationsToRollback.forEach(m => {
      console.log(`  - ${m.version}: ${m.name}`)
    })
    
    // Apply rollback
    try {
      await execAsync(`supabase db reset --linked`)
      
      // Reapply migrations up to target version
      const migrationsToReapply = migrations
        .filter(m => m.version <= targetVersion)
        .sort((a, b) => a.version.localeCompare(b.version))
      
      for (const migration of migrationsToReapply) {
        await this.applyMigration(migration)
      }
      
      console.log(`✅ Successfully rolled back to version ${targetVersion}`)
      
    } catch (error) {
      console.error('❌ Rollback failed:', error)
      throw error
    }
  }
  
  /**
   * Create database backup
   */
  async createBackup(backupName: string): Promise<string> {
    console.log(`💾 Creating database backup: ${backupName}`)
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFileName = `${backupName}-${timestamp}.sql`
      
      // Use Supabase CLI to create backup
      const { stdout } = await execAsync('supabase db dump --data-only')
      
      // Save backup to file
      await writeFile(`backups/${backupFileName}`, stdout)
      
      console.log(`✅ Backup created: backups/${backupFileName}`)
      return backupFileName
      
    } catch (error) {
      console.error('❌ Failed to create backup:', error)
      throw error
    }
  }
  
  /**
   * Restore from backup
   */
  async restoreFromBackup(backupFileName: string): Promise<void> {
    console.log(`🔄 Restoring from backup: ${backupFileName}`)
    
    try {
      // Read backup file
      const backupPath = join('backups', backupFileName)
      const backupSql = await readFile(backupPath, 'utf-8')
      
      // Apply backup using Supabase CLI
      await execAsync(`supabase db reset --linked`)
      await execAsync(`psql "${process.env.DATABASE_URL}" < ${backupPath}`)
      
      console.log('✅ Database restored successfully')
      
    } catch (error) {
      console.error('❌ Failed to restore backup:', error)
      throw error
    }
  }
  
  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<void> {
    console.log('📊 Migration Status Report')
    console.log('=' .repeat(50))
    
    const migrations = await this.getAvailableMigrations()
    
    console.log(`Total migrations: ${migrations.length}`)
    console.log(`Applied: ${migrations.filter(m => m.applied).length}`)
    console.log(`Pending: ${migrations.filter(m => !m.applied).length}`)
    console.log('')
    
    console.log('Migration Details:')
    migrations.forEach(migration => {
      const status = migration.applied ? '✅' : '⏳'
      const appliedAt = migration.appliedAt ? 
        ` (applied: ${new Date(migration.appliedAt).toLocaleString()})` : ''
      
      console.log(`  ${status} ${migration.version}: ${migration.name}${appliedAt}`)
    })
  }
  
  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<boolean> {
    console.log('🔍 Validating migration integrity...')
    
    try {
      const migrations = await this.getAvailableMigrations()
      let isValid = true
      
      for (const migration of migrations.filter(m => m.applied)) {
        const migrationPath = join(this.migrationsPath, `${migration.version}_${migration.name}.sql`)
        const migrationSql = await readFile(migrationPath, 'utf-8')
        const currentChecksum = await this.calculateChecksum(migrationSql)
        
        if (migration.checksum && migration.checksum !== currentChecksum) {
          console.error(`❌ Checksum mismatch for migration ${migration.version}`)
          isValid = false
        }
      }
      
      if (isValid) {
        console.log('✅ All migrations are valid')
      }
      
      return isValid
      
    } catch (error) {
      console.error('❌ Migration validation failed:', error)
      return false
    }
  }
  
  /**
   * Calculate checksum for migration content
   */
  private async calculateChecksum(content: string): Promise<string> {
    const crypto = await import('crypto')
    return crypto.createHash('sha256').update(content).digest('hex')
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  
  const migrationManager = new DatabaseMigrationManager()
  
  try {
    switch (command) {
      case 'status':
        await migrationManager.getMigrationStatus()
        break
        
      case 'apply':
        const dryRun = args.includes('--dry-run')
        await migrationManager.applyMigrations(dryRun)
        break
        
      case 'rollback':
        const targetVersion = args[1]
        if (!targetVersion) {
          console.error('❌ Target version required for rollback')
          process.exit(1)
        }
        await migrationManager.rollbackToVersion(targetVersion)
        break
        
      case 'backup':
        const backupName = args[1] || `manual-backup-${Date.now()}`
        await migrationManager.createBackup(backupName)
        break
        
      case 'restore':
        const backupFileName = args[1]
        if (!backupFileName) {
          console.error('❌ Backup filename required for restore')
          process.exit(1)
        }
        await migrationManager.restoreFromBackup(backupFileName)
        break
        
      case 'validate':
        const isValid = await migrationManager.validateMigrations()
        process.exit(isValid ? 0 : 1)
        break
        
      default:
        console.log('Database Migration Manager')
        console.log('')
        console.log('Usage:')
        console.log('  tsx scripts/db-migration.ts status              - Show migration status')
        console.log('  tsx scripts/db-migration.ts apply [--dry-run]   - Apply pending migrations')
        console.log('  tsx scripts/db-migration.ts rollback <version>  - Rollback to version')
        console.log('  tsx scripts/db-migration.ts backup [name]       - Create backup')
        console.log('  tsx scripts/db-migration.ts restore <filename>  - Restore from backup')
        console.log('  tsx scripts/db-migration.ts validate            - Validate migrations')
        break
    }
    
  } catch (error) {
    console.error('❌ Command failed:', error)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Run CLI
if (require.main === module) {
  main()
}