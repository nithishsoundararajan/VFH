/**
 * n8n Repository Manager
 * Handles cloning, updating, and managing the n8n source code repository
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface RepositoryInfo {
  version: string;
  lastUpdated: Date;
  commitHash: string;
  nodeCount: number;
}

export class N8nRepositoryManager {
  private repoPath: string;
  private repoUrl = 'https://github.com/n8n-io/n8n.git';
  private nodesBasePath: string;
  private credentialsPath: string;

  constructor(basePath: string = './n8n-source') {
    this.repoPath = path.resolve(basePath);
    this.nodesBasePath = path.join(this.repoPath, 'packages/nodes-base/nodes');
    this.credentialsPath = path.join(this.repoPath, 'packages/nodes-base/credentials');
  }

  /**
   * Initialize the repository (clone if not exists, update if exists)
   */
  async initializeRepository(): Promise<RepositoryInfo> {
    try {
      const exists = await this.repositoryExists();
      
      if (!exists) {
        console.log('n8n repository not found, cloning...');
        await this.cloneRepository();
      } else {
        console.log('n8n repository found, updating...');
        await this.updateRepository();
      }

      return await this.getRepositoryInfo();
    } catch (error) {
      console.error('Failed to initialize n8n repository:', error);
      throw new Error(`Repository initialization failed: ${error.message}`);
    }
  }

  /**
   * Check if repository exists and is valid
   */
  private async repositoryExists(): Promise<boolean> {
    try {
      await fs.access(path.join(this.repoPath, '.git'));
      await fs.access(this.nodesBasePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clone the n8n repository
   */
  private async cloneRepository(): Promise<void> {
    console.log(`Cloning n8n repository to ${this.repoPath}...`);
    
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(this.repoPath), { recursive: true });
    
    // Clone with depth 1 for faster cloning (we only need latest)
    const { stdout, stderr } = await execAsync(
      `git clone --depth 1 ${this.repoUrl} "${this.repoPath}"`
    );
    
    if (stderr && !stderr.includes('Cloning into')) {
      throw new Error(`Git clone failed: ${stderr}`);
    }
    
    console.log('Repository cloned successfully');
  }

  /**
   * Update the existing repository
   */
  async updateRepository(): Promise<boolean> {
    try {
      console.log('Updating n8n repository...');
      
      const oldCommit = await this.getCurrentCommitHash();
      
      // Fetch and reset to latest
      await execAsync(`cd "${this.repoPath}" && git fetch origin master`);
      await execAsync(`cd "${this.repoPath}" && git reset --hard origin/master`);
      
      const newCommit = await this.getCurrentCommitHash();
      const hasUpdates = oldCommit !== newCommit;
      
      if (hasUpdates) {
        console.log(`Repository updated: ${oldCommit.substring(0, 8)} → ${newCommit.substring(0, 8)}`);
      } else {
        console.log('Repository is already up to date');
      }
      
      return hasUpdates;
    } catch (error) {
      console.error('Failed to update repository:', error);
      throw new Error(`Repository update failed: ${error.message}`);
    }
  }

  /**
   * Get current commit hash
   */
  private async getCurrentCommitHash(): Promise<string> {
    const { stdout } = await execAsync(`cd "${this.repoPath}" && git rev-parse HEAD`);
    return stdout.trim();
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(): Promise<RepositoryInfo> {
    try {
      const commitHash = await this.getCurrentCommitHash();
      
      // Get package.json version
      const packageJsonPath = path.join(this.repoPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // Get last commit date
      const { stdout: dateOutput } = await execAsync(
        `cd "${this.repoPath}" && git log -1 --format=%ci`
      );
      
      // Count available nodes
      const nodeCount = await this.countAvailableNodes();
      
      return {
        version: packageJson.version,
        lastUpdated: new Date(dateOutput.trim()),
        commitHash,
        nodeCount
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error.message}`);
    }
  }

  /**
   * Count available nodes in the repository
   */
  private async countAvailableNodes(): Promise<number> {
    try {
      const entries = await fs.readdir(this.nodesBasePath, { withFileTypes: true });
      return entries.filter(entry => entry.isDirectory()).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get path to a specific node's source file
   */
  async getNodeSourcePath(nodeType: string): Promise<string | null> {
    try {
      const normalizedName = this.normalizeNodeName(nodeType);
      const nodePath = path.join(this.nodesBasePath, normalizedName);
      
      // Check if node directory exists
      try {
        await fs.access(nodePath);
      } catch {
        return null;
      }
      
      // Look for the main node file
      const possibleFiles = [
        `${normalizedName}.node.ts`,
        `${normalizedName}.node.js`,
        'index.ts',
        'index.js'
      ];
      
      for (const fileName of possibleFiles) {
        const filePath = path.join(nodePath, fileName);
        try {
          await fs.access(filePath);
          return filePath;
        } catch {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting node source path for ${nodeType}:`, error);
      return null;
    }
  }

  /**
   * Get path to a credential file
   */
  async getCredentialSourcePath(credentialType: string): Promise<string | null> {
    try {
      const normalizedName = this.normalizeCredentialName(credentialType);
      const possibleFiles = [
        `${normalizedName}.credentials.ts`,
        `${normalizedName}.credentials.js`
      ];
      
      for (const fileName of possibleFiles) {
        const filePath = path.join(this.credentialsPath, fileName);
        try {
          await fs.access(filePath);
          return filePath;
        } catch {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting credential source path for ${credentialType}:`, error);
      return null;
    }
  }

  /**
   * List all available nodes
   */
  async listAvailableNodes(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.nodesBasePath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort();
    } catch (error) {
      console.error('Error listing available nodes:', error);
      return [];
    }
  }

  /**
   * Check if a specific node exists in the repository
   */
  async nodeExists(nodeType: string): Promise<boolean> {
    const sourcePath = await this.getNodeSourcePath(nodeType);
    return sourcePath !== null;
  }

  /**
   * Normalize node name for file system lookup
   */
  private normalizeNodeName(nodeType: string): string {
    // Remove 'n8n-nodes-base.' prefix if present
    let normalized = nodeType.replace(/^n8n-nodes-base\./, '');
    
    // Handle special cases and naming conventions
    const nameMap: Record<string, string> = {
      'httpRequest': 'HttpRequest',
      'webhook': 'Webhook',
      'set': 'Set',
      'if': 'If',
      'switch': 'Switch',
      'merge': 'Merge',
      'noOp': 'NoOp'
    };
    
    return nameMap[normalized] || normalized;
  }

  /**
   * Normalize credential name for file system lookup
   */
  private normalizeCredentialName(credentialType: string): string {
    // Remove any prefixes and normalize
    return credentialType.replace(/^n8n-nodes-base\./, '');
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(): Promise<{
    totalNodes: number;
    totalCredentials: number;
    repositorySize: string;
    lastUpdate: Date;
  }> {
    try {
      const [nodeEntries, credentialEntries] = await Promise.all([
        fs.readdir(this.nodesBasePath, { withFileTypes: true }),
        fs.readdir(this.credentialsPath, { withFileTypes: true })
      ]);
      
      const totalNodes = nodeEntries.filter(entry => entry.isDirectory()).length;
      const totalCredentials = credentialEntries.filter(entry => 
        entry.isFile() && entry.name.endsWith('.credentials.ts')
      ).length;
      
      // Get repository size (approximate)
      const { stdout } = await execAsync(`cd "${this.repoPath}" && du -sh . 2>/dev/null || echo "Unknown"`);
      const repositorySize = stdout.trim().split('\t')[0] || 'Unknown';
      
      const info = await this.getRepositoryInfo();
      
      return {
        totalNodes,
        totalCredentials,
        repositorySize,
        lastUpdate: info.lastUpdated
      };
    } catch (error) {
      console.error('Error getting repository stats:', error);
      return {
        totalNodes: 0,
        totalCredentials: 0,
        repositorySize: 'Unknown',
        lastUpdate: new Date()
      };
    }
  }
}

export default N8nRepositoryManager;