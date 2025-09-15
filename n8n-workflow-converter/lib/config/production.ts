import { z } from 'zod'

/**
 * Production Environment Configuration Schema
 * Validates all required environment variables for production deployment
 */
const ProductionEnvSchema = z.object({
  // Supabase Configuration (Required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

  // Application Configuration
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid app URL'),
  NODE_ENV: z.literal('production'),

  // Security Configuration
  NEXTAUTH_SECRET: z.string().min(32, 'NextAuth secret must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('Invalid NextAuth URL'),

  // Optional Security Services
  VIRUSTOTAL_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // Optional AI Provider Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  // Performance Configuration
  NEXT_PUBLIC_MAX_FILE_SIZE: z.string().transform(Number).pipe(z.number().positive()).optional(),
  NEXT_PUBLIC_MAX_PROJECTS_PER_USER: z.string().transform(Number).pipe(z.number().positive()).optional(),

  // Rate Limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.string().transform(Number).pipe(z.number().positive()).optional(),
  RATE_LIMIT_REQUESTS_PER_HOUR: z.string().transform(Number).pipe(z.number().positive()).optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),

  // CDN Configuration
  NEXT_PUBLIC_CDN_URL: z.string().url().optional(),

  // Database Configuration
  DATABASE_POOL_MIN: z.string().transform(Number).pipe(z.number().positive()).optional(),
  DATABASE_POOL_MAX: z.string().transform(Number).pipe(z.number().positive()).optional(),
})

export type ProductionConfig = z.infer<typeof ProductionEnvSchema>

/**
 * Validates production environment configuration
 * Exits process if validation fails
 */
export function validateProductionEnv(): ProductionConfig {
  console.log('🔍 Validating production environment configuration...')
  
  const result = ProductionEnvSchema.safeParse(process.env)
  
  if (!result.success) {
    console.error('❌ Invalid production environment configuration:')
    result.error.issues.forEach(issue => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    })
    console.error('\n📋 Please check your .env.production file and ensure all required variables are set.')
    process.exit(1)
  }
  
  console.log('✅ Production environment configuration validated successfully')
  
  // Log configuration summary (without sensitive data)
  console.log('📊 Configuration Summary:')
  console.log(`  - App URL: ${result.data.NEXT_PUBLIC_APP_URL}`)
  console.log(`  - Supabase URL: ${result.data.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`  - VirusTotal: ${result.data.VIRUSTOTAL_API_KEY ? 'Configured' : 'Not configured'}`)
  console.log(`  - Sentry: ${result.data.SENTRY_DSN ? 'Configured' : 'Not configured'}`)
  console.log(`  - AI Providers: ${[
    result.data.OPENAI_API_KEY && 'OpenAI',
    result.data.ANTHROPIC_API_KEY && 'Anthropic',
    result.data.GOOGLE_AI_API_KEY && 'Google AI'
  ].filter(Boolean).join(', ') || 'None configured'}`)
  
  return result.data
}

/**
 * Production configuration object with defaults
 */
export const productionConfig = {
  // Performance defaults
  maxFileSize: Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  maxProjectsPerUser: Number(process.env.NEXT_PUBLIC_MAX_PROJECTS_PER_USER) || 100,
  
  // Rate limiting defaults
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 60,
  rateLimitPerHour: Number(process.env.RATE_LIMIT_REQUESTS_PER_HOUR) || 1000,
  
  // Database connection pool
  dbPoolMin: Number(process.env.DATABASE_POOL_MIN) || 2,
  dbPoolMax: Number(process.env.DATABASE_POOL_MAX) || 20,
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // CDN
  cdnUrl: process.env.NEXT_PUBLIC_CDN_URL,
  
  // Security
  enableVirusScan: !!process.env.VIRUSTOTAL_API_KEY,
  enableErrorTracking: !!process.env.SENTRY_DSN,
}

/**
 * Checks if all critical production services are available
 */
export async function checkProductionServices(): Promise<{
  supabase: boolean
  virusTotal: boolean
  sentry: boolean
}> {
  const checks = {
    supabase: false,
    virusTotal: false,
    sentry: false
  }

  // Check Supabase connection
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
      }
    })
    checks.supabase = response.ok
  } catch (error) {
    console.error('Supabase health check failed:', error)
  }

  // Check VirusTotal API
  if (process.env.VIRUSTOTAL_API_KEY) {
    try {
      const response = await fetch('https://www.virustotal.com/vtapi/v2/file/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `apikey=${process.env.VIRUSTOTAL_API_KEY}&resource=test`
      })
      checks.virusTotal = response.status !== 403 // 403 means invalid key
    } catch (error) {
      console.error('VirusTotal health check failed:', error)
    }
  }

  // Check Sentry (if configured)
  if (process.env.SENTRY_DSN) {
    try {
      // Simple check to see if DSN is valid format
      new URL(process.env.SENTRY_DSN)
      checks.sentry = true
    } catch (error) {
      console.error('Sentry DSN validation failed:', error)
    }
  }

  return checks
}