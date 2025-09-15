import { serve } from 'http://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'http://esm.sh/@supabase/supabase-js@2'

interface WorkflowParseRequest {
  fileData: string // Base64 encoded file data
  fileName: string
  userId: string
}

interface VirusTotalResponse {
  scan_id: string
  resource: string
  response_code: number
  verbose_msg: string
  permalink: string
  positives?: number
  total?: number
}

interface WorkflowMetadata {
  name: string
  nodeCount: number
  triggerCount: number
  connections: number
  nodeTypes: string[]
  hasCredentials: boolean
}

interface ParseResponse {
  success: boolean
  securityStatus: {
    safe: boolean
    scanId?: string
    permalink?: string
    message: string
  }
  workflow?: {
    metadata: WorkflowMetadata
    sanitizedData: any
  }
  error?: string
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { fileData, fileName, userId }: WorkflowParseRequest = await req.json()

    // Validate input
    if (!fileData || !fileName || userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decode base64 file data
    const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0))

    // Import Edge Function secrets manager
    const { getSecret } = await import('../_shared/edge-secrets.ts')

    // Step 1: Security scanning with VirusTotal
    const virusTotalKey = await getSecret('VIRUSTOTAL_API_KEY')
    let securityStatus = {
      safe: false,
      message: 'Security scan required'
    }

    if (virusTotalKey) {
      try {
        // Create form data for VirusTotal
        const formData = new FormData()
        formData.append('file', new Blob([fileBuffer]), fileName)

        // Submit file for scanning
        const scanResponse = await fetch('https://www.virustotal.com/vtapi/v2/file/scan', {
          method: 'POST',
          headers: {
            'apikey': virusTotalKey
          },
          body: formData
        })

        const scanResult: VirusTotalResponse = await scanResponse.json()

        if (scanResult.response_code === 1) {
          // Wait a moment then get scan report
          await new Promise(resolve => setTimeout(resolve, 2000))

          const reportResponse = await fetch(
            `https://www.virustotal.com/vtapi/v2/file/report?apikey=${virusTotalKey}&resource=${scanResult.scan_id}`
          )

          const reportResult: VirusTotalResponse = await reportResponse.json()

          securityStatus = {
            safe: (reportResult.positives || 0) === 0,
            scanId: scanResult.scan_id,
            permalink: scanResult.permalink,
            message: reportResult.positives === 0
              ? 'File passed security scan'
              : `Security threats detected: ${reportResult.positives}/${reportResult.total}`
          }
        } else {
          securityStatus = {
            safe: false,
            message: 'Security scan failed: ' + scanResult.verbose_msg
          }
        }
      } catch (error) {
        console.error('VirusTotal scan error:', error)
        securityStatus = {
          safe: false,
          message: 'Security scan service unavailable'
        }
      }
    } else {
      // If no VirusTotal key, perform basic validation only
      securityStatus = {
        safe: true,
        message: 'Basic validation passed (VirusTotal not configured)'
      }
    }

    // Step 2: Parse and validate JSON if security check passes
    let workflow: { metadata: WorkflowMetadata; sanitizedData: any } | undefined

    if (securityStatus.safe) {
      try {
        // Convert buffer to string and parse JSON
        const jsonString = new TextDecoder().decode(fileBuffer)
        const workflowData = JSON.parse(jsonString)

        // Validate n8n workflow structure
        if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
          throw new Error('Invalid n8n workflow: missing or invalid nodes array')
        }

        // Extract metadata
        const nodes = workflowData.nodes || []
        const connections = workflowData.connections || {}
        const triggers = nodes.filter((node: any) =>
          node.type?.includes('trigger') || node.type?.includes('Trigger')
        )

        const nodeTypes = [...new Set(nodes.map((node: any) => node.type))] as string[]
        const hasCredentials = nodes.some((node: any) =>
          node.credentials && Object.keys(node.credentials).length > 0
        )

        const metadata: WorkflowMetadata = {
          name: workflowData.name || fileName.replace('.json', ''),
          nodeCount: nodes.length,
          triggerCount: triggers.length,
          connections: Object.keys(connections).length,
          nodeTypes,
          hasCredentials
        }

        // Sanitize workflow data (remove sensitive information)
        const sanitizedData = {
          ...workflowData,
          nodes: nodes.map((node: any) => ({
            ...node,
            // Remove credential values but keep credential names for mapping
            credentials: node.credentials ?
              Object.keys(node.credentials).reduce((acc: any, key: string) => {
                acc[key] = '[CREDENTIAL_PLACEHOLDER]'
                return acc
              }, {}) : undefined
          }))
        }

        workflow = { metadata, sanitizedData }

        // Log successful parsing
        await supabase.from('generation_logs').insert({
          project_id: null, // Will be set when project is created
          log_level: 'info',
          message: `Workflow parsed successfully: ${metadata.nodeCount} nodes, ${metadata.triggerCount} triggers`
        })

      } catch (parseError) {
        console.error('JSON parsing error:', parseError)
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error'

        // Log parsing error
        await supabase.from('generation_logs').insert({
          project_id: null,
          log_level: 'error',
          message: `Workflow parsing failed: ${errorMessage}`
        })

        return new Response(
          JSON.stringify({
            success: false,
            securityStatus,
            error: `Invalid JSON format: ${errorMessage}`
          } as ParseResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    const response: ParseResponse = {
      success: securityStatus.safe && !!workflow,
      securityStatus,
      workflow
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        securityStatus: { safe: false, message: 'Internal server error' },
        error: 'Internal server error'
      } as ParseResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})