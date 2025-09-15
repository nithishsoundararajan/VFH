/**
 * Source-Aware Dependency Analyzer
 * Analyzes n8n source code to extract real dependencies for standalone projects
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface SourceDependency {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  source: 'n8n-package-json' | 'import-analysis' | 'manual-mapping';
  description?: string;
  optional: boolean;
}

export interface AnalyzedDependencies {
  runtime: Record<string, string>;
  development: Record<string, string>;
  peer: Record<string, string>;
  nodeSpecific: Record<string, string[]>; // nodeType -> dependencies
}

export class SourceAwareDependencyAnalyzer {
  private n8nSourcePath: string;
  private dependencyCache = new Map<string, SourceDependency[]>();

  constructor(n8nSourcePath: string = './n8n-source') {
    this.n8nSourcePath = path.resolve(n8nSourcePath);
  }

  /**
   * Analyze dependencies for specific node types
   */
  async analyzeDependencies(nodeTypes: string[]): Promise<AnalyzedDependencies> {
    const result: AnalyzedDependencies = {
      runtime: {},
      development: {},
      peer: {},
      nodeSpecific: {}
    };

    // Get base n8n dependencies
    const baseDependencies = await this.getN8nBaseDependencies();
    
    // Analyze each node type
    for (const nodeType of nodeTypes) {
      const nodeDeps = await this.analyzeNodeDependencies(nodeType);
      result.nodeSpecific[nodeType] = nodeDeps.map(dep => dep.name);
      
      // Add to runtime dependencies
      nodeDeps.forEach(dep => {
        if (dep.type === 'dependency') {
          result.runtime[dep.name] = dep.version;
        }
      });
    }

    // Add essential standalone dependencies
    this.addStandaloneDependencies(result);

    return result;
  }

  /**
   * Get base dependencies from n8n package.json files
   */
  private async getN8nBaseDependencies(): Promise<SourceDependency[]> {
    const cacheKey = 'n8n-base';
    if (this.dependencyCache.has(cacheKey)) {
      return this.dependencyCache.get(cacheKey)!;
    }

    const dependencies: SourceDependency[] = [];

    try {
      // Read n8n core package.json
      const corePackagePath = path.join(this.n8nSourcePath, 'packages/core/package.json');
      const corePackage = JSON.parse(await fs.readFile(corePackagePath, 'utf-8'));
      
      // Read nodes-base package.json
      const nodesPackagePath = path.join(this.n8nSourcePath, 'packages/nodes-base/package.json');
      const nodesPackage = JSON.parse(await fs.readFile(nodesPackagePath, 'utf-8'));

      // Extract useful dependencies
      const usefulDeps = [
        'lodash', 'axios', 'moment', 'uuid', 'crypto-js', 'jsonwebtoken',
        'xml2js', 'csv-parser', 'mysql2', 'pg', 'mongodb', 'redis',
        'nodemailer', 'basic-ftp', 'node-ssh', 'ws', 'ioredis'
      ];

      // Check both packages for these dependencies
      [corePackage, nodesPackage].forEach(pkg => {
        if (pkg.dependencies) {
          Object.entries(pkg.dependencies).forEach(([name, version]) => {
            if (usefulDeps.includes(name)) {
              dependencies.push({
                name,
                version: version as string,
                type: 'dependency',
                source: 'n8n-package-json',
                optional: false
              });
            }
          });
        }
      });

      this.dependencyCache.set(cacheKey, dependencies);
      return dependencies;

    } catch (error) {
      console.warn('Could not read n8n package.json files:', error);
      return [];
    }
  }

  /**
   * Analyze dependencies for a specific node type
   */
  private async analyzeNodeDependencies(nodeType: string): Promise<SourceDependency[]> {
    const cacheKey = `node-${nodeType}`;
    if (this.dependencyCache.has(cacheKey)) {
      return this.dependencyCache.get(cacheKey)!;
    }

    const dependencies: SourceDependency[] = [];

    try {
      // Get node source file path
      const nodeName = this.normalizeNodeName(nodeType);
      const nodeDir = path.join(this.n8nSourcePath, 'packages/nodes-base/nodes', nodeName);
      
      // Find the main node file
      const nodeFiles = await this.findNodeFiles(nodeDir);
      
      // Analyze imports in node files
      for (const filePath of nodeFiles) {
        const fileDeps = await this.analyzeFileImports(filePath);
        dependencies.push(...fileDeps);
      }

      // Add node-specific dependencies based on type
      const specificDeps = this.getNodeSpecificDependencies(nodeType);
      dependencies.push(...specificDeps);

      this.dependencyCache.set(cacheKey, dependencies);
      return dependencies;

    } catch (error) {
      console.warn(`Could not analyze dependencies for ${nodeType}:`, error);
      return [];
    }
  }

  /**
   * Find all TypeScript files for a node
   */
  private async findNodeFiles(nodeDir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(nodeDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(nodeDir, entry.name);
        
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          files.push(fullPath);
        } else if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findNodeFiles(fullPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  /**
   * Analyze imports in a TypeScript file
   */
  private async analyzeFileImports(filePath: string): Promise<SourceDependency[]> {
    const dependencies: SourceDependency[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract import statements
      const importRegex = /import\\s+(?:{[^}]+}|[^\\s]+|\\*\\s+as\\s+\\w+)\\s+from\\s+['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const moduleName = match[1];
        
        // Skip relative imports and n8n-specific modules
        if (moduleName.startsWith('.') || moduleName.startsWith('n8n-')) {
          continue;
        }

        // Skip built-in Node.js modules
        if (this.isBuiltinModule(moduleName)) {
          continue;
        }

        // Extract package name (handle scoped packages)
        const packageName = this.extractPackageName(moduleName);
        
        if (packageName && !dependencies.some(dep => dep.name === packageName)) {
          dependencies.push({
            name: packageName,
            version: 'latest', // Will be resolved later
            type: 'dependency',
            source: 'import-analysis',
            optional: false
          });
        }
      }

    } catch (error) {
      console.warn(`Could not analyze imports in ${filePath}:`, error);
    }

    return dependencies;
  }

  /**
   * Get node-specific dependencies based on node type
   */
  private getNodeSpecificDependencies(nodeType: string): SourceDependency[] {
    const dependencies: SourceDependency[] = [];

    // Database nodes
    if (nodeType.includes('mysql') || nodeType.includes('MySQL')) {
      dependencies.push({
        name: 'mysql2',
        version: '^3.6.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'MySQL database client',
        optional: false
      });
    }

    if (nodeType.includes('postgres') || nodeType.includes('Postgres')) {
      dependencies.push({
        name: 'pg',
        version: '^8.11.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'PostgreSQL database client',
        optional: false
      });
    }

    if (nodeType.includes('mongo') || nodeType.includes('MongoDB')) {
      dependencies.push({
        name: 'mongodb',
        version: '^6.3.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'MongoDB database driver',
        optional: false
      });
    }

    if (nodeType.includes('redis') || nodeType.includes('Redis')) {
      dependencies.push({
        name: 'redis',
        version: '^4.6.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'Redis client',
        optional: false
      });
    }

    // Communication nodes
    if (nodeType.includes('email') || nodeType.includes('Email')) {
      dependencies.push({
        name: 'nodemailer',
        version: '^6.9.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'Email sending library',
        optional: false
      });
    }

    if (nodeType.includes('slack') || nodeType.includes('Slack')) {
      dependencies.push({
        name: '@slack/web-api',
        version: '^6.10.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'Slack Web API client',
        optional: false
      });
    }

    // File operations
    if (nodeType.includes('ftp') || nodeType.includes('FTP')) {
      dependencies.push({
        name: 'basic-ftp',
        version: '^5.0.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'FTP client',
        optional: false
      });
    }

    if (nodeType.includes('ssh') || nodeType.includes('SSH')) {
      dependencies.push({
        name: 'node-ssh',
        version: '^13.1.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'SSH client',
        optional: false
      });
    }

    // Data processing
    if (nodeType.includes('xml') || nodeType.includes('XML')) {
      dependencies.push({
        name: 'xml2js',
        version: '^0.6.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'XML parser and builder',
        optional: false
      });
    }

    if (nodeType.includes('csv') || nodeType.includes('CSV')) {
      dependencies.push({
        name: 'csv-parser',
        version: '^3.0.0',
        type: 'dependency',
        source: 'manual-mapping',
        description: 'CSV file parser',
        optional: false
      });
    }

    return dependencies;
  }

  /**
   * Add essential dependencies for standalone execution
   */
  private addStandaloneDependencies(result: AnalyzedDependencies): void {
    // Essential runtime dependencies
    const essentialDeps = {
      'dotenv': '^16.0.0',           // Environment variables
      'axios': '^1.6.0',            // HTTP client
      'lodash': '^4.17.21',         // Utility functions
      'express': '^4.18.2',         // Web server
      'node-cron': '^3.0.3',        // Cron scheduling
      'uuid': '^9.0.0',             // UUID generation
      'moment': '^2.29.4',          // Date manipulation
      'validator': '^13.11.0'       // Data validation
    };

    Object.entries(essentialDeps).forEach(([name, version]) => {
      if (!result.runtime[name]) {
        result.runtime[name] = version;
      }
    });

    // Development dependencies
    result.development = {
      'nodemon': '^3.0.0',
      'jest': '^29.7.0',
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0'
    };
  }

  /**
   * Utility methods
   */
  private normalizeNodeName(nodeType: string): string {
    return nodeType.replace(/^n8n-nodes-base\\./, '');
  }

  private isBuiltinModule(moduleName: string): boolean {
    const builtins = [
      'fs', 'path', 'url', 'crypto', 'http', 'https', 'os', 'util',
      'events', 'stream', 'buffer', 'querystring', 'zlib', 'child_process',
      'cluster', 'dgram', 'dns', 'net', 'readline', 'repl', 'tls', 'tty',
      'v8', 'vm', 'worker_threads', 'assert', 'async_hooks', 'perf_hooks'
    ];
    return builtins.includes(moduleName);
  }

  private extractPackageName(moduleName: string): string {
    // Handle scoped packages (@scope/package)
    if (moduleName.startsWith('@')) {
      const parts = moduleName.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : moduleName;
    }
    
    // Handle regular packages (package/submodule)
    return moduleName.split('/')[0];
  }

  /**
   * Generate enhanced package.json with analyzed dependencies
   */
  generatePackageJson(
    projectName: string, 
    nodeTypes: string[], 
    analyzedDeps: AnalyzedDependencies
  ): any {
    return {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: '1.0.0',
      description: `Standalone Node.js project generated from n8n workflow: ${projectName}`,
      main: 'main.js',
      type: 'module',
      scripts: {
        start: 'node main.js',
        dev: 'nodemon main.js',
        test: 'jest',
        'test:watch': 'jest --watch',
        build: 'tsc',
        'type-check': 'tsc --noEmit'
      },
      dependencies: analyzedDeps.runtime,
      devDependencies: analyzedDeps.development,
      engines: {
        node: '>=18.0.0'
      },
      keywords: [
        'n8n', 'workflow', 'automation', 'standalone',
        ...nodeTypes.map(type => type.replace('n8n-nodes-base.', ''))
      ],
      author: 'Generated by n8n Workflow Converter',
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'https://github.com/your-username/your-repo.git'
      }
    };
  }
}

export default SourceAwareDependencyAnalyzer;