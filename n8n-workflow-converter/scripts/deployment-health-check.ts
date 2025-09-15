#!/usr/bin/env tsx

/**
 * Deployment Health Check Script
 * Comprehensive health checks for post-deployment verification
 */

import { createClient } from '@supabase/supabase-js'

interface HealthCheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  duration?: number
  details?: any
}

class DeploymentHealthChecker {
  private baseUrl: string
  private supabase: any
  private results: HealthCheckResult[] = []
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    }
  }
  
  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<boolean> {
    console.log('🔍 Starting deployment health checks...')
    console.log(`Target URL: ${this.baseUrl}`)
    console.log('=' .repeat(50))
    
    // Basic connectivity checks
    await this.checkApplicationHealth()
    await this.checkDatabaseHealth()
    await this.checkStorageHealth()
    await this.checkExternalServicesHealth()
    
    // Functional checks
    await this.checkAuthenticationFlow()
    await this.checkFileUploadCapability()
    await this.checkWorkflowProcessing()
    
    // Performance checks
    await this.checkResponseTimes()
    await this.checkMemoryUsage()
    
    // Security checks
    await this.checkSecurityHeaders()
    await this.checkSSLConfiguration()
    
    // Generate report
    this.generateReport()
    
    // Return overall status
    const failures = this.results.filter(r => r.status === 'fail')
    return failures.length === 0
  }
  
  /**
   * Check basic application health
   */
  private async checkApplicationHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'User-Agent': 'deployment-health-check' }
      })
      
      const duration = Date.now() - startTime
      
      if (response.ok) {
        const data = await response.json()
        this.results.push({
          name: 'Application Health',
          status: 'pass',
          message: 'Application is responding correctly',
          duration,
          details: data
        })
      } else {
        this.results.push({
          name: 'Application Health',
          status: 'fail',
          message: `HTTP ${response.status}: ${response.statusText}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'Application Health',
        status: 'fail',
        message: `Connection failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check database connectivity and basic operations
   */
  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.baseUrl}/api/health/database`)
      const duration = Date.now() - startTime
      
      if (response.ok) {
        const data = await response.json()
        
        // Additional Supabase direct check if credentials available
        if (this.supabase) {
          const { data: testData, error } = await this.supabase
            .from('profiles')
            .select('count')
            .limit(1)
          
          if (error) {
            this.results.push({
              name: 'Database Health',
              status: 'warn',
              message: 'API endpoint healthy but direct connection failed',
              duration,
              details: { api: data, direct: error }
            })
          } else {
            this.results.push({
              name: 'Database Health',
              status: 'pass',
              message: 'Database is accessible and responsive',
              duration,
              details: { api: data, direct: 'success' }
            })
          }
        } else {
          this.results.push({
            name: 'Database Health',
            status: 'pass',
            message: 'Database API endpoint is healthy',
            duration,
            details: data
          })
        }
      } else {
        this.results.push({
          name: 'Database Health',
          status: 'fail',
          message: `Database health check failed: HTTP ${response.status}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'Database Health',
        status: 'fail',
        message: `Database health check error: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check storage service health
   */
  private async checkStorageHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.baseUrl}/api/health/storage`)
      const duration = Date.now() - startTime
      
      if (response.ok) {
        const data = await response.json()
        this.results.push({
          name: 'Storage Health',
          status: 'pass',
          message: 'Storage service is accessible',
          duration,
          details: data
        })
      } else {
        this.results.push({
          name: 'Storage Health',
          status: 'fail',
          message: `Storage health check failed: HTTP ${response.status}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'Storage Health',
        status: 'fail',
        message: `Storage health check error: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check external services health
   */
  private async checkExternalServicesHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.baseUrl}/api/health/external-services`)
      const duration = Date.now() - startTime
      
      if (response.ok) {
        const data = await response.json()
        this.results.push({
          name: 'External Services Health',
          status: 'pass',
          message: 'External services are accessible',
          duration,
          details: data
        })
      } else {
        this.results.push({
          name: 'External Services Health',
          status: 'warn',
          message: `Some external services may be unavailable: HTTP ${response.status}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'External Services Health',
        status: 'warn',
        message: `External services check error: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check authentication flow
   */
  private async checkAuthenticationFlow(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Check if auth endpoints are accessible
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'HEAD'
      })
      
      const duration = Date.now() - startTime
      
      if (response.status === 200 || response.status === 405) {
        // 405 Method Not Allowed is acceptable for HEAD request
        this.results.push({
          name: 'Authentication Flow',
          status: 'pass',
          message: 'Authentication endpoints are accessible',
          duration
        })
      } else {
        this.results.push({
          name: 'Authentication Flow',
          status: 'warn',
          message: `Authentication endpoint returned HTTP ${response.status}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'Authentication Flow',
        status: 'fail',
        message: `Authentication check error: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check file upload capability
   */
  private async checkFileUploadCapability(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Check if upload endpoint is accessible
      const response = await fetch(`${this.baseUrl}/api/files/upload`, {
        method: 'OPTIONS'
      })
      
      const duration = Date.now() - startTime
      
      if (response.ok || response.status === 405) {
        this.results.push({
          name: 'File Upload Capability',
          status: 'pass',
          message: 'File upload endpoints are accessible',
          duration
        })
      } else {
        this.results.push({
          name: 'File Upload Capability',
          status: 'warn',
          message: `Upload endpoint returned HTTP ${response.status}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'File Upload Capability',
        status: 'fail',
        message: `File upload check error: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check workflow processing capability
   */
  private async checkWorkflowProcessing(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Check if workflow parsing endpoint is accessible
      const response = await fetch(`${this.baseUrl}/api/parse-workflow`, {
        method: 'OPTIONS'
      })
      
      const duration = Date.now() - startTime
      
      if (response.ok || response.status === 405) {
        this.results.push({
          name: 'Workflow Processing',
          status: 'pass',
          message: 'Workflow processing endpoints are accessible',
          duration
        })
      } else {
        this.results.push({
          name: 'Workflow Processing',
          status: 'warn',
          message: `Workflow endpoint returned HTTP ${response.status}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'Workflow Processing',
        status: 'fail',
        message: `Workflow processing check error: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check response times
   */
  private async checkResponseTimes(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.baseUrl}/`)
      const duration = Date.now() - startTime
      
      if (response.ok) {
        if (duration < 2000) {
          this.results.push({
            name: 'Response Times',
            status: 'pass',
            message: `Homepage loads in ${duration}ms`,
            duration
          })
        } else if (duration < 5000) {
          this.results.push({
            name: 'Response Times',
            status: 'warn',
            message: `Homepage loads slowly in ${duration}ms`,
            duration
          })
        } else {
          this.results.push({
            name: 'Response Times',
            status: 'fail',
            message: `Homepage loads too slowly in ${duration}ms`,
            duration
          })
        }
      } else {
        this.results.push({
          name: 'Response Times',
          status: 'fail',
          message: `Homepage not accessible: HTTP ${response.status}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'Response Times',
        status: 'fail',
        message: `Response time check error: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check memory usage (if available)
   */
  private async checkMemoryUsage(): Promise<void> {
    try {
      // This would typically check application metrics
      // For now, we'll just mark as informational
      this.results.push({
        name: 'Memory Usage',
        status: 'pass',
        message: 'Memory usage monitoring not implemented',
        details: { note: 'Consider implementing application metrics' }
      })
    } catch (error) {
      this.results.push({
        name: 'Memory Usage',
        status: 'warn',
        message: `Memory check error: ${error.message}`
      })
    }
  }
  
  /**
   * Check security headers
   */
  private async checkSecurityHeaders(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.baseUrl}/`)
      const duration = Date.now() - startTime
      
      const headers = response.headers
      const securityHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'strict-transport-security',
        'content-security-policy'
      ]
      
      const missingHeaders = securityHeaders.filter(header => !headers.has(header))
      
      if (missingHeaders.length === 0) {
        this.results.push({
          name: 'Security Headers',
          status: 'pass',
          message: 'All security headers are present',
          duration
        })
      } else if (missingHeaders.length <= 2) {
        this.results.push({
          name: 'Security Headers',
          status: 'warn',
          message: `Missing headers: ${missingHeaders.join(', ')}`,
          duration
        })
      } else {
        this.results.push({
          name: 'Security Headers',
          status: 'fail',
          message: `Multiple security headers missing: ${missingHeaders.join(', ')}`,
          duration
        })
      }
    } catch (error) {
      this.results.push({
        name: 'Security Headers',
        status: 'fail',
        message: `Security headers check error: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }
  
  /**
   * Check SSL configuration
   */
  private async checkSSLConfiguration(): Promise<void> {
    try {
      if (this.baseUrl.startsWith('https://')) {
        this.results.push({
          name: 'SSL Configuration',
          status: 'pass',
          message: 'HTTPS is enabled'
        })
      } else {
        this.results.push({
          name: 'SSL Configuration',
          status: 'fail',
          message: 'HTTPS is not enabled'
        })
      }
    } catch (error) {
      this.results.push({
        name: 'SSL Configuration',
        status: 'warn',
        message: `SSL check error: ${error.message}`
      })
    }
  }
  
  /**
   * Generate comprehensive report
   */
  private generateReport(): void {
    console.log('\n📊 Health Check Results')
    console.log('=' .repeat(50))
    
    const passed = this.results.filter(r => r.status === 'pass').length
    const warned = this.results.filter(r => r.status === 'warn').length
    const failed = this.results.filter(r => r.status === 'fail').length
    
    console.log(`✅ Passed: ${passed}`)
    console.log(`⚠️  Warnings: ${warned}`)
    console.log(`❌ Failed: ${failed}`)
    console.log('')
    
    // Detailed results
    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌'
      const duration = result.duration ? ` (${result.duration}ms)` : ''
      
      console.log(`${icon} ${result.name}${duration}`)
      console.log(`   ${result.message}`)
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
      }
      console.log('')
    })
    
    // Summary
    if (failed > 0) {
      console.log('🚨 DEPLOYMENT HEALTH CHECK FAILED')
      console.log(`${failed} critical issues found that require immediate attention.`)
    } else if (warned > 0) {
      console.log('⚠️  DEPLOYMENT HEALTH CHECK PASSED WITH WARNINGS')
      console.log(`${warned} issues found that should be addressed.`)
    } else {
      console.log('🎉 DEPLOYMENT HEALTH CHECK PASSED')
      console.log('All systems are healthy and operational.')
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const baseUrl = args[0] || process.env.APP_URL || 'http://localhost:3000'
  
  if (!baseUrl) {
    console.error('❌ Base URL is required')
    console.log('Usage: tsx scripts/deployment-health-check.ts <base-url>')
    console.log('   or: APP_URL=<base-url> tsx scripts/deployment-health-check.ts')
    process.exit(1)
  }
  
  const checker = new DeploymentHealthChecker(baseUrl)
  
  try {
    const success = await checker.runAllChecks()
    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error('❌ Health check failed:', error)
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

export { DeploymentHealthChecker }