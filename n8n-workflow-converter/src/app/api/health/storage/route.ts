import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMonitoringConfig } from '@/lib/config/monitoring'

export async function GET() {
  const startTime = Date.now()
  
  try {
    const supabase = await createClient()
    
    // Test storage buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    const bucketChecks: Record<string, any> = {}
    
    if (!bucketsError && buckets) {
      // Check specific buckets
      const requiredBuckets = ['workflow-files', 'generated-projects']
      
      for (const bucketName of requiredBuckets) {
        const bucket = buckets.find(b => b.name === bucketName)
        if (bucket) {
          // Test bucket access
          const { data: files, error: filesError } = await supabase.storage
            .from(bucketName)
            .list('', { limit: 1 })
          
          bucketChecks[bucketName] = {
            status: filesError ? 'degraded' : 'healthy',
            exists: true,
            accessible: !filesError,
            error: filesError?.message
          }
        } else {
          bucketChecks[bucketName] = {
            status: 'unhealthy',
            exists: false,
            accessible: false,
            error: 'Bucket not found'
          }
        }
      }
    }
    
    const responseTime = Date.now() - startTime
    
    // Track performance
    const config = getMonitoringConfig()
    if (config.storage.enabled && responseTime > config.storage.timeout) {
      console.warn(`Storage health check took ${responseTime}ms, exceeding timeout of ${config.storage.timeout}ms`)
    }
    
    const hasErrors = bucketsError || Object.values(bucketChecks).some((check: any) => check.status === 'unhealthy')
    const hasDegraded = Object.values(bucketChecks).some((check: any) => check.status === 'degraded')
    
    let overallStatus = 'healthy'
    if (hasErrors) overallStatus = 'unhealthy'
    else if (hasDegraded) overallStatus = 'degraded'
    
    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      buckets: {
        total: buckets?.length || 0,
        accessible: bucketsError ? false : true,
        error: bucketsError?.message
      },
      checks: bucketChecks,
      storage_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`
    }, { 
      status: hasErrors ? 503 : 200 
    })
    
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown storage error'
    }, { status: 503 })
  }
}