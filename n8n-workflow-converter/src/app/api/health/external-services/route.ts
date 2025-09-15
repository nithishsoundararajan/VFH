import { NextResponse } from 'next/server'
import { PerformanceMonitor } from '../../../../lib/config/monitoring'

export async function GET() {
  const startTime = Date.now()
  
  try {
    const checks: Record<string, any> = {}
    
    // Check VirusTotal API (if configured)
    if (process.env.VIRUSTOTAL_API_KEY) {
      const vtStart = Date.now()
      try {
        const response = await fetch('https://www.virustotal.com/vtapi/v2/file/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `apikey=${process.env.VIRUSTOTAL_API_KEY}&resource=test`,
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })
        
        checks.virustotal = {
          status: response.status === 403 ? 'unhealthy' : 'healthy',
          responseTime: Date.now() - vtStart,
          statusCode: response.status,
          configured: true,
          message: response.status === 403 ? 'Invalid API key' : 'API accessible'
        }
      } catch (error) {
        checks.virustotal = {
          status: 'unhealthy',
          responseTime: Date.now() - vtStart,
          configured: true,
          error: error instanceof Error ? error.message : 'Connection failed'
        }
      }
    } else {
      checks.virustotal = {
        status: 'not_configured',
        configured: false,
        message: 'API key not provided'
      }
    }
    
    // Check OpenAI API (if configured)
    if (process.env.OPENAI_API_KEY) {
      const openaiStart = Date.now()
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(5000)
        })
        
        checks.openai = {
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - openaiStart,
          statusCode: response.status,
          configured: true,
          message: response.ok ? 'API accessible' : 'API error'
        }
      } catch (error) {
        checks.openai = {
          status: 'unhealthy',
          responseTime: Date.now() - openaiStart,
          configured: true,
          error: error instanceof Error ? error.message : 'Connection failed'
        }
      }
    } else {
      checks.openai = {
        status: 'not_configured',
        configured: false,
        message: 'API key not provided'
      }
    }
    
    // Check Anthropic API (if configured)
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicStart = Date.now()
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          }),
          signal: AbortSignal.timeout(5000)
        })
        
        checks.anthropic = {
          status: response.status === 401 ? 'unhealthy' : 'healthy',
          responseTime: Date.now() - anthropicStart,
          statusCode: response.status,
          configured: true,
          message: response.status === 401 ? 'Invalid API key' : 'API accessible'
        }
      } catch (error) {
        checks.anthropic = {
          status: 'unhealthy',
          responseTime: Date.now() - anthropicStart,
          configured: true,
          error: error instanceof Error ? error.message : 'Connection failed'
        }
      }
    } else {
      checks.anthropic = {
        status: 'not_configured',
        configured: false,
        message: 'API key not provided'
      }
    }
    
    // Check Google AI API (if configured)
    if (process.env.GOOGLE_AI_API_KEY) {
      const googleStart = Date.now()
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_AI_API_KEY}`, {
          signal: AbortSignal.timeout(5000)
        })
        
        checks.google_ai = {
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - googleStart,
          statusCode: response.status,
          configured: true,
          message: response.ok ? 'API accessible' : 'API error'
        }
      } catch (error) {
        checks.google_ai = {
          status: 'unhealthy',
          responseTime: Date.now() - googleStart,
          configured: true,
          error: error instanceof Error ? error.message : 'Connection failed'
        }
      }
    } else {
      checks.google_ai = {
        status: 'not_configured',
        configured: false,
        message: 'API key not provided'
      }
    }
    
    const responseTime = Date.now() - startTime
    
    // Track performance
    PerformanceMonitor.track('external_services_health_check', responseTime, { type: 'comprehensive' })
    
    // Determine overall status
    const configuredServices = Object.values(checks).filter((check: any) => check.configured)
    const unhealthyServices = configuredServices.filter((check: any) => check.status === 'unhealthy')
    const healthyServices = configuredServices.filter((check: any) => check.status === 'healthy')
    
    let overallStatus = 'healthy'
    if (configuredServices.length === 0) {
      overallStatus = 'not_configured'
    } else if (unhealthyServices.length === configuredServices.length) {
      overallStatus = 'unhealthy'
    } else if (unhealthyServices.length > 0) {
      overallStatus = 'degraded'
    }
    
    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      summary: {
        total_services: Object.keys(checks).length,
        configured_services: configuredServices.length,
        healthy_services: healthyServices.length,
        unhealthy_services: unhealthyServices.length
      },
      checks
    }, { 
      status: overallStatus === 'unhealthy' ? 503 : 200 
    })
    
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown external services error'
    }, { status: 503 })
  }
}