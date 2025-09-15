import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMonitoringConfig } from '@/lib/config/monitoring'

export async function GET() {
  const startTime = Date.now()
  
  try {
    const supabase = await createClient()
    
    // Test basic connectivity
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    // Test projects table
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('count')
      .limit(1)
    
    // Test generation logs
    const { data: logs, error: logsError } = await supabase
      .from('generation_logs')
      .select('count')
      .limit(1)
    
    const responseTime = Date.now() - startTime
    
    // Track performance
    const config = getMonitoringConfig()
    if (config.database.enabled && responseTime > config.database.timeout) {
      console.warn(`Database health check took ${responseTime}ms, exceeding timeout of ${config.database.timeout}ms`)
    }
    
    const checks = {
      profiles: {
        status: profilesError ? 'unhealthy' : 'healthy',
        error: profilesError?.message
      },
      projects: {
        status: projectsError ? 'unhealthy' : 'healthy',
        error: projectsError?.message
      },
      generation_logs: {
        status: logsError ? 'unhealthy' : 'healthy',
        error: logsError?.message
      }
    }
    
    const hasErrors = Object.values(checks).some(check => check.status === 'unhealthy')
    
    return NextResponse.json({
      status: hasErrors ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks,
      connection: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        authenticated: true
      }
    }, { 
      status: hasErrors ? 503 : 200 
    })
    
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }, { status: 503 })
  }
}