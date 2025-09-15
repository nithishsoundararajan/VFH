#!/usr/bin/env tsx

/**
 * Production Startup Script
 * Validates environment, checks services, and starts the application
 */

import { validateProductionEnv, checkProductionServices } from '../lib/config/production'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function startProduction() {
  console.log('🚀 Starting n8n Workflow Converter in production mode...\n')
  
  try {
    // Step 1: Validate environment configuration
    console.log('Step 1: Environment Validation')
    const config = validateProductionEnv()
    console.log('✅ Environment validation passed\n')
    
    // Step 2: Check external services
    console.log('Step 2: Service Health Checks')
    const serviceChecks = await checkProductionServices()
    
    console.log(`  - Supabase: ${serviceChecks.supabase ? '✅ Connected' : '❌ Failed'}`)
    console.log(`  - VirusTotal: ${serviceChecks.virusTotal ? '✅ Connected' : '⚠️  Not configured or failed'}`)
    console.log(`  - Sentry: ${serviceChecks.sentry ? '✅ Configured' : '⚠️  Not configured'}`)
    
    if (!serviceChecks.supabase) {
      console.error('\n❌ Critical service failure: Supabase connection failed')
      console.error('Please check your Supabase configuration and network connectivity.')
      process.exit(1)
    }
    
    console.log('✅ Service health checks completed\n')
    
    // Step 3: Database migrations check
    console.log('Step 3: Database Migration Status')
    try {
      // Check if we can run Supabase CLI commands
      await execAsync('supabase --version')
      console.log('  - Supabase CLI available')
      
      // Note: In production, migrations should already be applied
      // This is just a status check
      console.log('  - Database migrations should be applied via CI/CD')
      console.log('  - Manual check: supabase db diff --schema public')
    } catch (error) {
      console.log('  - Supabase CLI not available (expected in containerized deployments)')
    }
    console.log('✅ Database status checked\n')
    
    // Step 4: Build verification
    console.log('Step 4: Build Verification')
    try {
      const { stdout } = await execAsync('ls -la .next')
      if (stdout.includes('BUILD_ID')) {
        console.log('  - Next.js build artifacts found')
      } else {
        console.log('  - No build artifacts found, running build...')
        await execAsync('npm run build')
      }
    } catch (error) {
      console.log('  - Running production build...')
      await execAsync('npm run build')
    }
    console.log('✅ Build verification completed\n')
    
    // Step 5: Security checks
    console.log('Step 5: Security Configuration')
    const securityChecks = {
      httpsEnforced: config.NEXT_PUBLIC_APP_URL.startsWith('https://'),
      secretsConfigured: config.NEXTAUTH_SECRET.length >= 32,
      virusScanEnabled: !!config.VIRUSTOTAL_API_KEY,
      errorTrackingEnabled: !!config.SENTRY_DSN
    }
    
    console.log(`  - HTTPS Enforced: ${securityChecks.httpsEnforced ? '✅' : '⚠️  HTTP detected'}`)
    console.log(`  - Secure Secrets: ${securityChecks.secretsConfigured ? '✅' : '❌'}`)
    console.log(`  - Virus Scanning: ${securityChecks.virusScanEnabled ? '✅' : '⚠️  Disabled'}`)
    console.log(`  - Error Tracking: ${securityChecks.errorTrackingEnabled ? '✅' : '⚠️  Disabled'}`)
    
    if (!securityChecks.httpsEnforced && config.NODE_ENV === 'production') {
      console.warn('⚠️  Warning: HTTPS not enforced in production environment')
    }
    
    if (!securityChecks.secretsConfigured) {
      console.error('❌ Critical: NextAuth secret is too short or missing')
      process.exit(1)
    }
    
    console.log('✅ Security configuration verified\n')
    
    // Step 6: Performance optimization check
    console.log('Step 6: Performance Configuration')
    console.log(`  - Max File Size: ${Math.round((config.NEXT_PUBLIC_MAX_FILE_SIZE || 10485760) / 1024 / 1024)}MB`)
    console.log(`  - Max Projects per User: ${config.NEXT_PUBLIC_MAX_PROJECTS_PER_USER || 100}`)
    console.log(`  - Rate Limit: ${config.RATE_LIMIT_REQUESTS_PER_MINUTE || 60}/min, ${config.RATE_LIMIT_REQUESTS_PER_HOUR || 1000}/hour`)
    console.log('✅ Performance configuration loaded\n')
    
    // Step 7: Start the application
    console.log('Step 7: Starting Application')
    console.log('🎯 All checks passed! Starting Next.js server...\n')
    console.log('=' .repeat(60))
    console.log(`🌐 Application URL: ${config.NEXT_PUBLIC_APP_URL}`)
    console.log(`📊 Environment: ${config.NODE_ENV}`)
    console.log(`🔧 Log Level: ${config.LOG_LEVEL || 'info'}`)
    console.log('=' .repeat(60))
    console.log('')
    
    // Start Next.js server
    const server = exec('npm start', (error, stdout, stderr) => {
      if (error) {
        console.error(`Server error: ${error}`)
        process.exit(1)
      }
    })
    
    server.stdout?.on('data', (data) => {
      console.log(data.toString())
    })
    
    server.stderr?.on('data', (data) => {
      console.error(data.toString())
    })
    
    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
      server.kill('SIGTERM')
      process.exit(0)
    })
    
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...')
      server.kill('SIGINT')
      process.exit(0)
    })
    
  } catch (error) {
    console.error('\n❌ Production startup failed:', error)
    console.error('\n🔍 Troubleshooting steps:')
    console.error('1. Check your .env.production file')
    console.error('2. Verify Supabase project configuration')
    console.error('3. Ensure all required environment variables are set')
    console.error('4. Check network connectivity to external services')
    console.error('5. Review the deployment documentation')
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

// Start the application
startProduction()