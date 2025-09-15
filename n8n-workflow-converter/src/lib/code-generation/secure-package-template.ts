/**
 * Secure Package Template
 * Generates package.json without vulnerable dependencies
 */

export interface PackageConfig {
  projectName: string;
  description?: string;
  nodeVersion?: string;
  packageManager?: string;
  dependencies: string[];
  environmentVariables: string[];
}

export class SecurePackageTemplate {

  /**
   * Generate secure package.json content
   */
  static generatePackageJson(config: PackageConfig): string {
    const packageJson = {
      name: config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: "1.0.0",
      description: config.description || `Generated n8n workflow: ${config.projectName}`,
      main: "main.js",
      type: "module",
      engines: {
        node: `>=${config.nodeVersion || '18'}.0.0`
      },
      scripts: {
        start: "node main.js",
        dev: "node --watch main.js",
        test: "node --test",
        "validate-env": "node scripts/validate-env.js"
      },
      dependencies: this.getSecureDependencies(config.dependencies),
      devDependencies: {
        "@types/node": "^20.0.0"
      },
      keywords: [
        "n8n",
        "workflow",
        "automation",
        "standalone"
      ],
      author: "n8n Workflow Converter",
      license: "MIT",
      repository: {
        type: "git",
        url: "https://github.com/your-username/your-repo.git"
      }
    };

    return JSON.stringify(packageJson, null, 2);
  }

  /**
   * Get secure dependencies without vulnerable packages
   */
  private static getSecureDependencies(requestedDeps: string[]): Record<string, string> {
    const secureDependencies: Record<string, string> = {};

    // Define secure versions of common dependencies
    const secureVersions: Record<string, string> = {
      'axios': '^1.6.0',
      'express': '^4.18.0',
      'lodash': '^4.17.21',
      'form-data': '^4.0.0',
      'dotenv': '^16.0.0',
      'crypto': 'built-in', // Node.js built-in
      'vm': 'built-in', // Node.js built-in
      'fs': 'built-in', // Node.js built-in
      'path': 'built-in', // Node.js built-in
      'url': 'built-in', // Node.js built-in
      'querystring': 'built-in' // Node.js built-in
    };

    // Blocked dependencies (security vulnerabilities)
    const blockedDependencies = [
      'vm2',
      'eval',
      'child_process',
      'exec',
      'spawn'
    ];

    for (const dep of requestedDeps) {
      // Skip blocked dependencies
      if (blockedDependencies.some(blocked => dep.includes(blocked))) {
        console.warn(`Skipping blocked dependency: ${dep}`);
        continue;
      }

      // Skip built-in modules
      if (secureVersions[dep] === 'built-in') {
        continue;
      }

      // Add secure version if available
      if (secureVersions[dep]) {
        secureDependencies[dep] = secureVersions[dep];
      } else {
        // For unknown dependencies, use latest version with caution
        console.warn(`Unknown dependency ${dep}, using latest version`);
        secureDependencies[dep] = '^1.0.0';
      }
    }

    return secureDependencies;
  }

  /**
   * Generate environment validation script
   */
  static generateEnvValidationScript(environmentVariables: string[]): string {
    return `#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates that all required environment variables are set
 */

const requiredEnvVars = [
${environmentVariables.map(env => `  '${env}'`).join(',\n')}
];

const missingVars = [];

console.log('🔍 Validating environment variables...');

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  } else {
    console.log(\`✅ \${envVar}: Set\`);
  }
}

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  for (const missing of missingVars) {
    console.error(\`   - \${missing}\`);
  }
  console.error('\\nPlease set these variables in your .env file or environment.');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set!');
}
`;
  }

  /**
   * Generate .env.example file
   */
  static generateEnvExample(environmentVariables: string[]): string {
    const lines = [
      '# Environment Variables for n8n Workflow',
      '# Copy this file to .env and fill in your actual values',
      ''
    ];

    for (const envVar of environmentVariables) {
      lines.push(`# ${envVar}=your_value_here`);
    }

    lines.push('');
    lines.push('# Optional: Set log level');
    lines.push('# LOG_LEVEL=info');
    lines.push('');
    lines.push('# Optional: Set webhook port');
    lines.push('# WEBHOOK_PORT=3001');

    return lines.join('\n');
  }

  /**
   * Generate README.md with security notes
   */
  static generateSecureReadme(config: PackageConfig): string {
    return `# ${config.projectName}

${config.description || 'Generated n8n workflow converted to standalone Node.js application.'}

## Security Features

This generated code includes several security improvements:

- ✅ **No vm2 dependency** - Uses Node.js built-in \`vm\` module instead
- ✅ **Secure code execution** - Sandboxed JavaScript execution with timeout
- ✅ **Input validation** - Sanitized user input and expressions
- ✅ **No eval()** - Safe expression evaluation without \`eval()\`
- ✅ **Dependency filtering** - Blocked vulnerable dependencies

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

1. Copy the environment template:
\`\`\`bash
cp .env.example .env
\`\`\`

2. Fill in your environment variables in \`.env\`

3. Validate your configuration:
\`\`\`bash
npm run validate-env
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Environment Variables

${config.environmentVariables.length > 0
        ? config.environmentVariables.map(env => `- \`${env}\`: Required`).join('\n')
        : 'No environment variables required.'
      }

## Generated Files

- \`main.js\` - Application entry point
- \`src/nodes/\` - Individual node implementations
- \`src/workflow/\` - Workflow execution logic
- \`config.js\` - Configuration management

## Attribution

This code was generated from an n8n workflow using the n8n Workflow Converter.

- Original n8n project: https://n8n.io
- Converter tool: [Add your converter URL here]

## License

MIT License - See LICENSE file for details.
`;
  }
}