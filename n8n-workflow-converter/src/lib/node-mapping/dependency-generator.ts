/**
 * Dependency and Import Generator
 * Generates appropriate imports and dependencies for node types
 */

import { NodeTypeDefinition, ImportDefinition } from './node-registry';

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  description: string;
  optional: boolean;
}

export interface ImportInfo {
  module: string;
  imports: string[];
  type: 'npm' | 'builtin' | 'local';
  version?: string;
  alias?: string;
}

export interface GeneratedDependencies {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  imports: {
    npm: ImportInfo[];
    builtin: ImportInfo[];
    local: ImportInfo[];
  };
  packageJsonUpdates: Record<string, any>;
}

/**
 * Dependency Generator - Generates dependencies and imports for node types
 */
export class DependencyGenerator {
  private builtinModules = new Set([
    'fs', 'path', 'url', 'crypto', 'http', 'https', 'os', 'util',
    'events', 'stream', 'buffer', 'querystring', 'zlib', 'child_process'
  ]);

  private commonDependencies: Map<string, DependencyInfo> = new Map();

  constructor() {
    this.initializeCommonDependencies();
  }

  /**
   * Generate dependencies for a set of node types
   */
  generateDependencies(nodeTypes: NodeTypeDefinition[]): GeneratedDependencies {
    const result: GeneratedDependencies = {
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      imports: {
        npm: [],
        builtin: [],
        local: []
      },
      packageJsonUpdates: {}
    };

    const processedModules = new Set<string>();
    const allImports = new Map<string, ImportInfo>();

    // Process each node type
    nodeTypes.forEach(nodeType => {
      // Add node-specific dependencies
      nodeType.dependencies.forEach(dep => {
        if (!processedModules.has(dep)) {
          this.addDependency(dep, result);
          processedModules.add(dep);
        }
      });

      // Process imports
      nodeType.imports.forEach(importDef => {
        const key = `${importDef.module}:${importDef.type}`;
        if (!allImports.has(key)) {
          const importInfo: ImportInfo = {
            module: importDef.module,
            imports: [...importDef.imports],
            type: importDef.type,
            version: importDef.version
          };
          allImports.set(key, importInfo);
        } else {
          // Merge imports for the same module
          const existing = allImports.get(key)!;
          importDef.imports.forEach(imp => {
            if (!existing.imports.includes(imp)) {
              existing.imports.push(imp);
            }
          });
        }
      });
    });

    // Categorize imports
    allImports.forEach(importInfo => {
      result.imports[importInfo.type].push(importInfo);
      
      // Add npm dependencies
      if (importInfo.type === 'npm' && importInfo.version) {
        result.dependencies[importInfo.module] = importInfo.version;
      }
    });

    // Add base dependencies
    this.addBaseDependencies(result);

    // Generate package.json updates
    this.generatePackageJsonUpdates(result, nodeTypes);

    return result;
  }

  /**
   * Generate import statements for a file
   */
  generateImportStatements(imports: ImportInfo[], fileType: 'js' | 'ts' = 'js'): string[] {
    const statements: string[] = [];

    // Group imports by module
    const groupedImports = new Map<string, ImportInfo>();
    imports.forEach(imp => {
      const key = imp.module;
      if (groupedImports.has(key)) {
        const existing = groupedImports.get(key)!;
        imp.imports.forEach(importName => {
          if (!existing.imports.includes(importName)) {
            existing.imports.push(importName);
          }
        });
      } else {
        groupedImports.set(key, { ...imp });
      }
    });

    // Generate import statements
    groupedImports.forEach(importInfo => {
      const statement = this.generateSingleImportStatement(importInfo, fileType);
      if (statement) {
        statements.push(statement);
      }
    });

    return statements.sort();
  }

  /**
   * Generate a single import statement
   */
  private generateSingleImportStatement(importInfo: ImportInfo, fileType: 'js' | 'ts'): string {
    const { module, imports, type } = importInfo;

    if (imports.length === 0) {
      return '';
    }

    // Handle different import patterns
    if (imports.includes('default') || imports.includes('*')) {
      // Default or namespace import
      const defaultImport = imports.find(imp => imp === 'default' || imp === '*');
      const namedImports = imports.filter(imp => imp !== 'default' && imp !== '*');
      
      let statement = '';
      if (defaultImport === 'default') {
        statement = `import ${module.replace(/[^a-zA-Z0-9]/g, '')} from '${module}';`;
      } else if (defaultImport === '*') {
        statement = `import * as ${module.replace(/[^a-zA-Z0-9]/g, '')} from '${module}';`;
      }
      
      if (namedImports.length > 0) {
        const namedPart = `{ ${namedImports.join(', ')} }`;
        if (statement) {
          statement = statement.replace(' from', `, ${namedPart} from`);
        } else {
          statement = `import ${namedPart} from '${module}';`;
        }
      }
      
      return statement;
    } else {
      // Named imports only
      return `import { ${imports.join(', ')} } from '${module}';`;
    }
  }

  /**
   * Add a dependency to the result
   */
  private addDependency(depName: string, result: GeneratedDependencies): void {
    const depInfo = this.commonDependencies.get(depName);
    
    if (depInfo) {
      switch (depInfo.type) {
        case 'dependency':
          result.dependencies[depName] = depInfo.version;
          break;
        case 'devDependency':
          result.devDependencies[depName] = depInfo.version;
          break;
        case 'peerDependency':
          result.peerDependencies[depName] = depInfo.version;
          break;
      }
    } else {
      // Unknown dependency - add as regular dependency with latest version
      result.dependencies[depName] = 'latest';
    }
  }

  /**
   * Add base dependencies required for all projects
   */
  private addBaseDependencies(result: GeneratedDependencies): void {
    // Base runtime dependencies
    result.dependencies['dotenv'] = '^16.0.0';
    result.dependencies['express'] = '^4.18.0';
    
    // Development dependencies
    result.devDependencies['nodemon'] = '^2.0.0';
    result.devDependencies['jest'] = '^29.0.0';
    result.devDependencies['@types/node'] = '^18.0.0';
  }

  /**
   * Generate package.json updates
   */
  private generatePackageJsonUpdates(result: GeneratedDependencies, nodeTypes: NodeTypeDefinition[]): void {
    const hasWebhooks = nodeTypes.some(node => node.category === 'trigger' && node.name.toLowerCase().includes('webhook'));
    const hasCron = nodeTypes.some(node => node.category === 'trigger' && node.name.toLowerCase().includes('cron'));
    
    result.packageJsonUpdates = {
      scripts: {
        start: 'node main.js',
        dev: 'nodemon main.js',
        test: 'jest',
        'test:watch': 'jest --watch'
      },
      engines: {
        node: '>=16.0.0'
      }
    };

    // Add webhook-specific scripts
    if (hasWebhooks) {
      result.packageJsonUpdates.scripts['start:webhook'] = 'node main.js --mode=webhook';
    }

    // Add cron-specific scripts
    if (hasCron) {
      result.packageJsonUpdates.scripts['start:cron'] = 'node main.js --mode=cron';
    }
  }

  /**
   * Initialize common dependencies
   */
  private initializeCommonDependencies(): void {
    // HTTP and networking
    this.commonDependencies.set('node-fetch', {
      name: 'node-fetch',
      version: '^3.3.0',
      type: 'dependency',
      description: 'HTTP client for Node.js',
      optional: false
    });

    this.commonDependencies.set('axios', {
      name: 'axios',
      version: '^1.6.0',
      type: 'dependency',
      description: 'Promise-based HTTP client',
      optional: false
    });

    // Scheduling
    this.commonDependencies.set('node-cron', {
      name: 'node-cron',
      version: '^3.0.0',
      type: 'dependency',
      description: 'Cron job scheduler',
      optional: false
    });

    // Code execution
    this.commonDependencies.set('vm2', {
      name: 'vm2',
      version: '^3.9.0',
      type: 'dependency',
      description: 'Secure JavaScript sandbox',
      optional: false
    });

    // Database
    this.commonDependencies.set('mysql2', {
      name: 'mysql2',
      version: '^3.6.0',
      type: 'dependency',
      description: 'MySQL client',
      optional: true
    });

    this.commonDependencies.set('pg', {
      name: 'pg',
      version: '^8.11.0',
      type: 'dependency',
      description: 'PostgreSQL client',
      optional: true
    });

    this.commonDependencies.set('mongodb', {
      name: 'mongodb',
      version: '^6.3.0',
      type: 'dependency',
      description: 'MongoDB driver',
      optional: true
    });

    // File processing
    this.commonDependencies.set('csv-parser', {
      name: 'csv-parser',
      version: '^3.0.0',
      type: 'dependency',
      description: 'CSV file parser',
      optional: true
    });

    this.commonDependencies.set('xlsx', {
      name: 'xlsx',
      version: '^0.18.0',
      type: 'dependency',
      description: 'Excel file processor',
      optional: true
    });

    // Utilities
    this.commonDependencies.set('lodash', {
      name: 'lodash',
      version: '^4.17.0',
      type: 'dependency',
      description: 'Utility library',
      optional: false
    });

    this.commonDependencies.set('moment', {
      name: 'moment',
      version: '^2.29.0',
      type: 'dependency',
      description: 'Date manipulation library',
      optional: true
    });

    // Testing
    this.commonDependencies.set('supertest', {
      name: 'supertest',
      version: '^6.3.0',
      type: 'devDependency',
      description: 'HTTP testing library',
      optional: true
    });
  }

  /**
   * Get dependency information
   */
  getDependencyInfo(name: string): DependencyInfo | undefined {
    return this.commonDependencies.get(name);
  }

  /**
   * Check if module is a built-in Node.js module
   */
  isBuiltinModule(moduleName: string): boolean {
    return this.builtinModules.has(moduleName);
  }

  /**
   * Generate README section for dependencies
   */
  generateDependencyDocumentation(dependencies: GeneratedDependencies): string {
    const sections: string[] = [];

    sections.push('## Dependencies\n');
    sections.push('This project uses the following dependencies:\n');

    // Runtime dependencies
    if (Object.keys(dependencies.dependencies).length > 0) {
      sections.push('### Runtime Dependencies\n');
      Object.entries(dependencies.dependencies).forEach(([name, version]) => {
        const info = this.commonDependencies.get(name);
        const description = info?.description || 'Required dependency';
        sections.push(`- **${name}** (${version}): ${description}`);
      });
      sections.push('');
    }

    // Development dependencies
    if (Object.keys(dependencies.devDependencies).length > 0) {
      sections.push('### Development Dependencies\n');
      Object.entries(dependencies.devDependencies).forEach(([name, version]) => {
        const info = this.commonDependencies.get(name);
        const description = info?.description || 'Development dependency';
        sections.push(`- **${name}** (${version}): ${description}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }
}

// Export singleton instance
export const dependencyGenerator = new DependencyGenerator();