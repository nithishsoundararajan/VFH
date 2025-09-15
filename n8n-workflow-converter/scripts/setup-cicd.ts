#!/usr/bin/env tsx

/**
 * CI/CD Setup and Configuration Script
 * Sets up GitHub Actions secrets, environment variables, and deployment configuration
 */

import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

interface CICDConfig {
  environments: {
    staging: EnvironmentConfig
    production: EnvironmentConfig
  }
  secrets: SecretConfig[]
  variables: VariableConfig[]
}

interface EnvironmentConfig {
  name: string
  url: string
  supabaseProjectId: string
  vercelProjectId?: string
  protectionRules: string[]
}

interface SecretConfig {
  name: string
  description: string
  required: boolean
  environments?: string[]
}

interface VariableConfig {
  name: string
  description: string
  value?: string
  environments?: string[]
}

class CICDSetup {
  private config: CICDConfig
  
  constructor() {
    this.config = {
      environments: {
        staging: {
          name: 'staging',
          url: 'https://staging-n8n-converter.vercel.app',
          supabaseProjectId: 'STAGING_SUPABASE_PROJECT_ID',
          vercelProjectId: 'VERCEL_PROJECT_ID',
          protectionRules: [
            'required_status_checks',
            'dismiss_stale_reviews'
          ]
        },
        production: {
          name: 'production',
          url: 'https://n8n-converter.com',
          supabaseProjectId: 'PRODUCTION_SUPABASE_PROJECT_ID',
          vercelProjectId: 'VERCEL_PRODUCTION_PROJECT_ID',
          protectionRules: [
            'required_status_checks',
            'required_reviews',
            'dismiss_stale_reviews',
            'restrict_pushes'
          ]
        }
      },
      secrets: [
        {
          name: 'SUPABASE_ACCESS_TOKEN',
          description: 'Supabase CLI access token for database operations',
          required: true
        },
        {
          name: 'STAGING_SUPABASE_PROJECT_ID',
          description: 'Supabase project ID for staging environment',
          required: true,
          environments: ['staging']
        },
        {
          name: 'PRODUCTION_SUPABASE_PROJECT_ID',
          description: 'Supabase project ID for production environment',
          required: true,
          environments: ['production']
        },
        {
          name: 'SUPABASE_SERVICE_ROLE_KEY',
          description: 'Supabase service role key for API access',
          required: true
        },
        {
          name: 'VERCEL_TOKEN',
          description: 'Vercel deployment token',
          required: true
        },
        {
          name: 'VERCEL_ORG_ID',
          description: 'Vercel organization ID',
          required: true
        },
        {
          name: 'VERCEL_PROJECT_ID',
          description: 'Vercel project ID for staging',
          required: true,
          environments: ['staging']
        },
        {
          name: 'VERCEL_PRODUCTION_PROJECT_ID',
          description: 'Vercel project ID for production',
          required: true,
          environments: ['production']
        },
        {
          name: 'SNYK_TOKEN',
          description: 'Snyk security scanning token',
          required: false
        },
        {
          name: 'CODECOV_TOKEN',
          description: 'Codecov coverage reporting token',
          required: false
        },
        {
          name: 'SLACK_WEBHOOK',
          description: 'Slack webhook for deployment notifications',
          required: false
        },
        {
          name: 'SLACK_WEBHOOK_ALERTS',
          description: 'Slack webhook for security and error alerts',
          required: false
        },
        {
          name: 'SLACK_SECURITY_WEBHOOK',
          description: 'Slack webhook for security team notifications',
          required: false
        }
      ],
      variables: [
        {
          name: 'NEXT_PUBLIC_SUPABASE_URL',
          description: 'Public Supabase URL',
          environments: ['staging', 'production']
        },
        {
          name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          description: 'Public Supabase anonymous key',
          environments: ['staging', 'production']
        },
        {
          name: 'NEXT_PUBLIC_APP_URL',
          description: 'Application URL for the environment'
        }
      ]
    }
  }
  
  /**
   * Generate CI/CD setup documentation
   */
  async generateSetupDocumentation(): Promise<void> {
    console.log('📝 Generating CI/CD setup documentation...')
    
    const docs = `# CI/CD Setup Guide

This guide helps you configure the complete CI/CD pipeline for the n8n Workflow Converter.

## Prerequisites

1. **GitHub Repository**: Ensure your code is in a GitHub repository
2. **Supabase Projects**: Create staging and production Supabase projects
3. **Vercel Account**: Set up Vercel for deployment
4. **Third-party Services**: Optional services for enhanced functionality

## Required Secrets

Configure these secrets in your GitHub repository settings:

### Core Secrets

${this.config.secrets
  .filter(s => s.required)
  .map(s => `- **${s.name}**: ${s.description}`)
  .join('\n')}

### Optional Secrets

${this.config.secrets
  .filter(s => !s.required)
  .map(s => `- **${s.name}**: ${s.description}`)
  .join('\n')}

## Environment Variables

Configure these variables for each environment:

${this.config.variables
  .map(v => `- **${v.name}**: ${v.description}`)
  .join('\n')}

## Environment Configuration

### Staging Environment

- **URL**: ${this.config.environments.staging.url}
- **Branch**: \`develop\`
- **Auto-deploy**: Yes
- **Protection Rules**: ${this.config.environments.staging.protectionRules.join(', ')}

### Production Environment

- **URL**: ${this.config.environments.production.url}
- **Branch**: \`main\`
- **Auto-deploy**: Yes (with approvals)
- **Protection Rules**: ${this.config.environments.production.protectionRules.join(', ')}

## Setup Steps

### 1. Configure GitHub Secrets

\`\`\`bash
# Using GitHub CLI
gh secret set SUPABASE_ACCESS_TOKEN --body "your-token-here"
gh secret set STAGING_SUPABASE_PROJECT_ID --body "your-staging-project-id"
gh secret set PRODUCTION_SUPABASE_PROJECT_ID --body "your-production-project-id"
# ... add all other secrets
\`\`\`

### 2. Configure Environment Variables

\`\`\`bash
# For staging environment
gh variable set NEXT_PUBLIC_SUPABASE_URL --body "https://your-staging-project.supabase.co" --env staging
gh variable set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "your-staging-anon-key" --env staging

# For production environment
gh variable set NEXT_PUBLIC_SUPABASE_URL --body "https://your-production-project.supabase.co" --env production
gh variable set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "your-production-anon-key" --env production
\`\`\`

### 3. Set Up Branch Protection Rules

\`\`\`bash
# Protect main branch
gh api repos/:owner/:repo/branches/main/protection \\
  --method PUT \\
  --field required_status_checks='{"strict":true,"contexts":["ci-success"]}' \\
  --field enforce_admins=true \\
  --field required_pull_request_reviews='{"required_approving_review_count":2}' \\
  --field restrictions=null

# Protect develop branch
gh api repos/:owner/:repo/branches/develop/protection \\
  --method PUT \\
  --field required_status_checks='{"strict":true,"contexts":["ci-success"]}' \\
  --field enforce_admins=false \\
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \\
  --field restrictions=null
\`\`\`

### 4. Configure Environments

Create GitHub environments with the following settings:

#### Staging Environment
- **Environment name**: \`staging\`
- **Deployment branches**: \`develop\`
- **Environment secrets**: Staging-specific secrets
- **Required reviewers**: None (auto-deploy)

#### Production Environment
- **Environment name**: \`production\`
- **Deployment branches**: \`main\`
- **Environment secrets**: Production-specific secrets
- **Required reviewers**: 2 team members
- **Wait timer**: 5 minutes

### 5. Verify Setup

Run the verification script to ensure everything is configured correctly:

\`\`\`bash
npm run cicd:verify
\`\`\`

## Workflow Overview

### Continuous Integration (CI)

Triggered on every push and pull request:

1. **Code Quality**: Linting, formatting, type checking
2. **Security Scanning**: Dependency audit, Snyk scan, secret detection
3. **Testing**: Unit tests, integration tests, E2E tests
4. **Build Verification**: Ensure application builds successfully
5. **Performance Testing**: Lighthouse audits

### Continuous Deployment (CD)

#### Staging Deployment (\`develop\` branch)

1. **Pre-deployment Checks**: Verify CI passed
2. **Database Migration**: Apply pending migrations
3. **Application Deployment**: Deploy to Vercel staging
4. **Health Checks**: Verify deployment health
5. **Smoke Tests**: Run basic functionality tests
6. **Notifications**: Notify team of deployment status

#### Production Deployment (\`main\` branch)

1. **Production Readiness**: Comprehensive checks
2. **Security Audit**: Enhanced security scanning
3. **Database Backup**: Create pre-deployment backup
4. **Database Migration**: Apply migrations with rollback plan
5. **Blue-Green Deployment**: Deploy with zero downtime
6. **Health Verification**: Comprehensive health checks
7. **Performance Monitoring**: Verify performance metrics
8. **Rollback Capability**: Automated rollback on failure

## Monitoring and Alerting

### Health Checks

- **Application Health**: \`/api/health\`
- **Database Health**: \`/api/health/database\`
- **Storage Health**: \`/api/health/storage\`
- **External Services**: \`/api/health/external-services\`

### Notifications

- **Slack Integration**: Deployment and alert notifications
- **Email Alerts**: Critical security issues
- **GitHub Status**: Deployment status in repository

## Troubleshooting

### Common Issues

1. **Migration Failures**: Check database connectivity and migration syntax
2. **Build Failures**: Verify environment variables and dependencies
3. **Test Failures**: Check test environment setup and data
4. **Deployment Failures**: Verify Vercel configuration and secrets

### Emergency Procedures

1. **Rollback**: Use the emergency rollback workflow
2. **Hotfix**: Deploy critical fixes via hotfix workflow
3. **Database Recovery**: Restore from automated backups

## Security Considerations

1. **Secret Rotation**: Regularly rotate all secrets and tokens
2. **Access Control**: Limit repository access to authorized personnel
3. **Audit Logging**: Monitor all deployment activities
4. **Vulnerability Management**: Address security issues promptly

## Maintenance

1. **Dependency Updates**: Regularly update GitHub Actions and dependencies
2. **Workflow Optimization**: Monitor and optimize workflow performance
3. **Documentation Updates**: Keep setup documentation current
4. **Backup Verification**: Regularly test backup and restore procedures
`

    await this.writeFile('docs/CICD-SETUP.md', docs)
    console.log('✅ CI/CD setup documentation generated')
  }
  
  /**
   * Generate GitHub CLI setup script
   */
  async generateGitHubCLIScript(): Promise<void> {
    console.log('📝 Generating GitHub CLI setup script...')
    
    const script = `#!/bin/bash

# GitHub CLI Setup Script for n8n Workflow Converter CI/CD
# This script configures all necessary secrets and variables for the CI/CD pipeline

set -e

echo "🚀 Setting up CI/CD for n8n Workflow Converter"
echo "=============================================="

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI is not installed. Please install it first:"
    echo "   https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI. Please run:"
    echo "   gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is ready"

# Function to set secret with confirmation
set_secret() {
    local name=$1
    local description=$2
    local required=$3
    
    echo ""
    echo "Setting secret: $name"
    echo "Description: $description"
    
    if [ "$required" = "true" ]; then
        echo "⚠️  This secret is REQUIRED"
    else
        echo "ℹ️  This secret is optional"
    fi
    
    read -p "Enter value for $name (or press Enter to skip): " -s value
    echo ""
    
    if [ -n "$value" ]; then
        gh secret set "$name" --body "$value"
        echo "✅ Secret $name set successfully"
    else
        if [ "$required" = "true" ]; then
            echo "⚠️  Required secret $name was skipped"
        else
            echo "ℹ️  Optional secret $name was skipped"
        fi
    fi
}

# Function to set environment variable
set_variable() {
    local name=$1
    local description=$2
    local env=$3
    
    echo ""
    echo "Setting variable: $name"
    echo "Description: $description"
    echo "Environment: $env"
    
    read -p "Enter value for $name: " value
    
    if [ -n "$value" ]; then
        if [ -n "$env" ]; then
            gh variable set "$name" --body "$value" --env "$env"
        else
            gh variable set "$name" --body "$value"
        fi
        echo "✅ Variable $name set successfully"
    else
        echo "⚠️  Variable $name was skipped"
    fi
}

echo ""
echo "📋 Setting up repository secrets..."
echo "=================================="

# Core secrets
${this.config.secrets
  .filter(s => s.required)
  .map(s => `set_secret "${s.name}" "${s.description}" "true"`)
  .join('\n')}

echo ""
echo "📋 Setting up optional secrets..."
echo "================================"

${this.config.secrets
  .filter(s => !s.required)
  .map(s => `set_secret "${s.name}" "${s.description}" "false"`)
  .join('\n')}

echo ""
echo "📋 Setting up environment variables..."
echo "====================================="

# Staging environment variables
echo ""
echo "🔧 Staging Environment Variables"
${this.config.variables
  .filter(v => !v.environments || v.environments.includes('staging'))
  .map(v => `set_variable "${v.name}" "${v.description}" "staging"`)
  .join('\n')}

# Production environment variables
echo ""
echo "🔧 Production Environment Variables"
${this.config.variables
  .filter(v => !v.environments || v.environments.includes('production'))
  .map(v => `set_variable "${v.name}" "${v.description}" "production"`)
  .join('\n')}

echo ""
echo "🔒 Setting up branch protection rules..."
echo "======================================="

# Protect main branch
echo "Protecting main branch..."
gh api repos/:owner/:repo/branches/main/protection \\
  --method PUT \\
  --field required_status_checks='{"strict":true,"contexts":["CI Success"]}' \\
  --field enforce_admins=true \\
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true}' \\
  --field restrictions=null || echo "⚠️  Failed to set main branch protection (may already exist)"

# Protect develop branch
echo "Protecting develop branch..."
gh api repos/:owner/:repo/branches/develop/protection \\
  --method PUT \\
  --field required_status_checks='{"strict":true,"contexts":["CI Success"]}' \\
  --field enforce_admins=false \\
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \\
  --field restrictions=null || echo "⚠️  Failed to set develop branch protection (may already exist)"

echo ""
echo "🎉 CI/CD setup completed!"
echo "========================"
echo ""
echo "Next steps:"
echo "1. Verify all secrets are set correctly in GitHub repository settings"
echo "2. Create staging and production environments in GitHub"
echo "3. Run 'npm run cicd:verify' to test the setup"
echo "4. Make a test commit to trigger the CI/CD pipeline"
echo ""
echo "For detailed setup instructions, see docs/CICD-SETUP.md"
`

    await this.writeFile('scripts/setup-github-cicd.sh', script)
    
    // Make script executable
    if (process.platform !== 'win32') {
      const { exec } = await import('child_process')
      exec('chmod +x scripts/setup-github-cicd.sh')
    }
    
    console.log('✅ GitHub CLI setup script generated')
  }
  
  /**
   * Generate CI/CD verification script
   */
  async generateVerificationScript(): Promise<void> {
    console.log('📝 Generating CI/CD verification script...')
    
    const script = `#!/usr/bin/env tsx

/**
 * CI/CD Configuration Verification Script
 * Verifies that all required secrets and variables are configured
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
}

class CICDVerifier {
  private results: CheckResult[] = []
  
  async verifySetup(): Promise<boolean> {
    console.log('🔍 Verifying CI/CD configuration...')
    console.log('=' .repeat(50))
    
    await this.checkGitHubCLI()
    await this.checkSecrets()
    await this.checkEnvironments()
    await this.checkBranchProtection()
    await this.checkWorkflowFiles()
    
    this.generateReport()
    
    const failures = this.results.filter(r => r.status === 'fail')
    return failures.length === 0
  }
  
  private async checkGitHubCLI(): Promise<void> {
    try {
      await execAsync('gh --version')
      this.results.push({
        name: 'GitHub CLI',
        status: 'pass',
        message: 'GitHub CLI is installed and accessible'
      })
      
      await execAsync('gh auth status')
      this.results.push({
        name: 'GitHub Authentication',
        status: 'pass',
        message: 'Authenticated with GitHub CLI'
      })
    } catch (error) {
      this.results.push({
        name: 'GitHub CLI',
        status: 'fail',
        message: 'GitHub CLI not installed or not authenticated'
      })
    }
  }
  
  private async checkSecrets(): Promise<void> {
    const requiredSecrets = [
      'SUPABASE_ACCESS_TOKEN',
      'STAGING_SUPABASE_PROJECT_ID',
      'PRODUCTION_SUPABASE_PROJECT_ID',
      'VERCEL_TOKEN',
      'VERCEL_ORG_ID'
    ]
    
    for (const secret of requiredSecrets) {
      try {
        const { stdout } = await execAsync(\`gh secret list | grep \${secret}\`)
        if (stdout.includes(secret)) {
          this.results.push({
            name: \`Secret: \${secret}\`,
            status: 'pass',
            message: 'Secret is configured'
          })
        } else {
          this.results.push({
            name: \`Secret: \${secret}\`,
            status: 'fail',
            message: 'Required secret is missing'
          })
        }
      } catch (error) {
        this.results.push({
          name: \`Secret: \${secret}\`,
          status: 'fail',
          message: 'Failed to check secret or secret is missing'
        })
      }
    }
  }
  
  private async checkEnvironments(): Promise<void> {
    const environments = ['staging', 'production']
    
    for (const env of environments) {
      try {
        const { stdout } = await execAsync(\`gh api repos/:owner/:repo/environments/\${env}\`)
        if (stdout) {
          this.results.push({
            name: \`Environment: \${env}\`,
            status: 'pass',
            message: 'Environment is configured'
          })
        }
      } catch (error) {
        this.results.push({
          name: \`Environment: \${env}\`,
          status: 'fail',
          message: 'Environment is not configured'
        })
      }
    }
  }
  
  private async checkBranchProtection(): Promise<void> {
    const branches = ['main', 'develop']
    
    for (const branch of branches) {
      try {
        const { stdout } = await execAsync(\`gh api repos/:owner/:repo/branches/\${branch}/protection\`)
        if (stdout) {
          this.results.push({
            name: \`Branch Protection: \${branch}\`,
            status: 'pass',
            message: 'Branch protection is configured'
          })
        }
      } catch (error) {
        this.results.push({
          name: \`Branch Protection: \${branch}\`,
          status: 'warn',
          message: 'Branch protection may not be configured'
        })
      }
    }
  }
  
  private async checkWorkflowFiles(): Promise<void> {
    const workflowFiles = [
      '.github/workflows/ci.yml',
      '.github/workflows/cd-staging.yml',
      '.github/workflows/cd-production.yml',
      '.github/workflows/security-scan.yml',
      '.github/workflows/database-migration.yml',
      '.github/workflows/rollback.yml'
    ]
    
    const fs = await import('fs/promises')
    
    for (const file of workflowFiles) {
      try {
        await fs.access(file)
        this.results.push({
          name: \`Workflow: \${file}\`,
          status: 'pass',
          message: 'Workflow file exists'
        })
      } catch (error) {
        this.results.push({
          name: \`Workflow: \${file}\`,
          status: 'fail',
          message: 'Workflow file is missing'
        })
      }
    }
  }
  
  private generateReport(): void {
    console.log('\\n📊 Verification Results')
    console.log('=' .repeat(50))
    
    const passed = this.results.filter(r => r.status === 'pass').length
    const warned = this.results.filter(r => r.status === 'warn').length
    const failed = this.results.filter(r => r.status === 'fail').length
    
    console.log(\`✅ Passed: \${passed}\`)
    console.log(\`⚠️  Warnings: \${warned}\`)
    console.log(\`❌ Failed: \${failed}\`)
    console.log('')
    
    // Show failures and warnings
    const issues = this.results.filter(r => r.status !== 'pass')
    if (issues.length > 0) {
      console.log('Issues found:')
      issues.forEach(result => {
        const icon = result.status === 'warn' ? '⚠️' : '❌'
        console.log(\`\${icon} \${result.name}: \${result.message}\`)
      })
      console.log('')
    }
    
    // Summary
    if (failed > 0) {
      console.log('🚨 CI/CD VERIFICATION FAILED')
      console.log(\`\${failed} critical issues found. Please fix these before proceeding.\`)
    } else if (warned > 0) {
      console.log('⚠️  CI/CD VERIFICATION PASSED WITH WARNINGS')
      console.log(\`\${warned} issues found that should be addressed.\`)
    } else {
      console.log('🎉 CI/CD VERIFICATION PASSED')
      console.log('All CI/CD components are properly configured.')
    }
  }
}

async function main() {
  const verifier = new CICDVerifier()
  
  try {
    const success = await verifier.verifySetup()
    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
`

    await this.writeFile('scripts/verify-cicd.ts', script)
    console.log('✅ CI/CD verification script generated')
  }
  
  /**
   * Update package.json with CI/CD scripts
   */
  async updatePackageJsonScripts(): Promise<void> {
    console.log('📝 Updating package.json scripts...')
    
    try {
      const packageJsonPath = 'package.json'
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
      
      // Add CI/CD related scripts
      const newScripts = {
        'cicd:setup': 'tsx scripts/setup-cicd.ts',
        'cicd:verify': 'tsx scripts/verify-cicd.ts',
        'cicd:health-check': 'tsx scripts/deployment-health-check.ts',
        'deploy:health-check:staging': 'APP_URL=https://staging-n8n-converter.vercel.app tsx scripts/deployment-health-check.ts',
        'deploy:health-check:production': 'APP_URL=https://n8n-converter.com tsx scripts/deployment-health-check.ts'
      }
      
      packageJson.scripts = {
        ...packageJson.scripts,
        ...newScripts
      }
      
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
      console.log('✅ Package.json scripts updated')
    } catch (error) {
      console.error('❌ Failed to update package.json:', error)
    }
  }
  
  /**
   * Write file with directory creation
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const dir = filePath.split('/').slice(0, -1).join('/')
    if (dir && !existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(filePath, content)
  }
  
  /**
   * Run complete setup
   */
  async runSetup(): Promise<void> {
    console.log('🚀 Setting up CI/CD configuration...')
    console.log('=' .repeat(50))
    
    await this.generateSetupDocumentation()
    await this.generateGitHubCLIScript()
    await this.generateVerificationScript()
    await this.updatePackageJsonScripts()
    
    console.log('')
    console.log('🎉 CI/CD setup completed!')
    console.log('=' .repeat(50))
    console.log('')
    console.log('Next steps:')
    console.log('1. Review the generated documentation: docs/CICD-SETUP.md')
    console.log('2. Run the GitHub CLI setup script: ./scripts/setup-github-cicd.sh')
    console.log('3. Verify the configuration: npm run cicd:verify')
    console.log('4. Test the pipeline with a commit to the develop branch')
  }
}

// CLI Interface
async function main() {
  const setup = new CICDSetup()
  
  try {
    await setup.runSetup()
  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

// Run setup
if (require.main === module) {
  main()
}

export { CICDSetup }