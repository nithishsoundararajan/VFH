#!/usr/bin/env node

/**
 * Daily n8n Source Repository Sync Script
 * Updates the local n8n repository and logs changes
 */

import N8nRepositoryManager from '../src/lib/source-analysis/repository-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SyncLog {
  timestamp: Date;
  oldVersion: string;
  newVersion: string;
  oldCommit: string;
  newCommit: string;
  hasUpdates: boolean;
  nodeCount: number;
  error?: string;
}

class N8nSourceSyncer {
  private repoManager: N8nRepositoryManager;
  private logPath: string;

  constructor() {
    this.repoManager = new N8nRepositoryManager('./n8n-source');
    this.logPath = './logs/n8n-sync.log';
  }

  /**
   * Perform daily sync operation
   */
  async performSync(): Promise<SyncLog> {
    const syncLog: SyncLog = {
      timestamp: new Date(),
      oldVersion: '',
      newVersion: '',
      oldCommit: '',
      newCommit: '',
      hasUpdates: false,
      nodeCount: 0
    };

    try {
      console.log('🔄 Starting n8n source repository sync...');

      // Get current state before update
      try {
        const oldInfo = await this.repoManager.getRepositoryInfo();
        syncLog.oldVersion = oldInfo.version;
        syncLog.oldCommit = oldInfo.commitHash;
      } catch (error) {
        console.log('📁 Repository not initialized, will clone...');
      }

      // Initialize/update repository
      const newInfo = await this.repoManager.initializeRepository();
      syncLog.newVersion = newInfo.version;
      syncLog.newCommit = newInfo.commitHash;
      syncLog.nodeCount = newInfo.nodeCount;

      // Check if there were updates
      syncLog.hasUpdates = syncLog.oldCommit !== syncLog.newCommit;

      if (syncLog.hasUpdates) {
        console.log(`✅ Repository updated successfully!`);
        console.log(`   Version: ${syncLog.oldVersion} → ${syncLog.newVersion}`);
        console.log(`   Commit: ${syncLog.oldCommit.substring(0, 8)} → ${syncLog.newCommit.substring(0, 8)}`);
        console.log(`   Nodes available: ${syncLog.nodeCount}`);

        // Log significant changes
        await this.logSignificantChanges(syncLog);
      } else {
        console.log('✅ Repository is already up to date');
        console.log(`   Version: ${syncLog.newVersion}`);
        console.log(`   Nodes available: ${syncLog.nodeCount}`);
      }

      // Write sync log
      await this.writeSyncLog(syncLog);

      return syncLog;

    } catch (error) {
      console.error('❌ Sync failed:', error);
      syncLog.error = error.message;
      await this.writeSyncLog(syncLog);
      throw error;
    }
  }

  /**
   * Log significant changes for monitoring
   */
  private async logSignificantChanges(syncLog: SyncLog): Promise<void> {
    try {
      // Get repository statistics
      const stats = await this.repoManager.getRepositoryStats();

      console.log('\n📊 Repository Statistics:');
      console.log(`   Total Nodes: ${stats.totalNodes}`);
      console.log(`   Total Credentials: ${stats.totalCredentials}`);
      console.log(`   Repository Size: ${stats.repositorySize}`);
      console.log(`   Last Update: ${stats.lastUpdate.toISOString()}`);

      // Check for new nodes (simplified check)
      const availableNodes = await this.repoManager.listAvailableNodes();
      console.log(`\n📋 Sample Available Nodes (first 10):`);
      availableNodes.slice(0, 10).forEach(node => {
        console.log(`   - ${node}`);
      });

      if (availableNodes.length > 10) {
        console.log(`   ... and ${availableNodes.length - 10} more nodes`);
      }

    } catch (error) {
      console.warn('⚠️  Could not retrieve detailed statistics:', error.message);
    }
  }

  /**
   * Write sync log to file
   */
  private async writeSyncLog(syncLog: SyncLog): Promise<void> {
    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.logPath);
      await fs.mkdir(logDir, { recursive: true });

      // Append to log file
      const logEntry = JSON.stringify(syncLog) + '\n';
      await fs.appendFile(this.logPath, logEntry);

      // Also write latest status to a separate file
      const statusPath = path.join(logDir, 'n8n-sync-status.json');
      await fs.writeFile(statusPath, JSON.stringify(syncLog, null, 2));

    } catch (error) {
      console.warn('⚠️  Could not write sync log:', error.message);
    }
  }

  /**
   * Get sync history from logs
   */
  async getSyncHistory(limit: number = 10): Promise<SyncLog[]> {
    try {
      const logContent = await fs.readFile(this.logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(line => line.trim());

      return lines
        .slice(-limit)
        .map(line => JSON.parse(line))
        .reverse(); // Most recent first
    } catch (error) {
      console.warn('Could not read sync history:', error.message);
      return [];
    }
  }

  /**
   * Get current sync status
   */
  async getCurrentStatus(): Promise<SyncLog | null> {
    try {
      const statusPath = path.join(path.dirname(this.logPath), 'n8n-sync-status.json');
      const statusContent = await fs.readFile(statusPath, 'utf-8');
      return JSON.parse(statusContent);
    } catch (error) {
      return null;
    }
  }
}

// CLI execution
async function main() {
  const syncer = new N8nSourceSyncer();

  try {
    const result = await syncer.performSync();

    if (result.hasUpdates) {
      console.log('\n🎉 Sync completed with updates!');
      process.exit(0);
    } else {
      console.log('\n✅ Sync completed - no updates needed');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Sync failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { N8nSourceSyncer };
export default N8nSourceSyncer;