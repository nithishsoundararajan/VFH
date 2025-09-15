/**
 * Shared utilities for Supabase Edge Functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
}

export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration')
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

export async function verifyAuth(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

  const supabase = createSupabaseClient()
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    throw new Error('Invalid authentication token')
  }
  
  return { user, supabase }
}

export function createErrorResponse(error: string, status = 400) {
  return new Response(
    JSON.stringify({ error }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

export function createSuccessResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify(data),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

export async function logProgress(
  supabase: any, 
  projectId: string, 
  level: 'info' | 'warning' | 'error', 
  message: string
) {
  try {
    await supabase.from('generation_logs').insert({
      project_id: projectId,
      log_level: level,
      message,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to log progress:', error)
  }
}

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potentially dangerous characters
    return input.replace(/[<>\"'&]/g, '')
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput)
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value)
    }
    return sanitized
  }
  
  return input
}

export function validateWorkflowStructure(workflow: any): boolean {
  if (!workflow || typeof workflow !== 'object') {
    return false
  }
  
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return false
  }
  
  // Validate each node has required properties
  for (const node of workflow.nodes) {
    if (!node.id || !node.type || !node.name) {
      return false
    }
  }
  
  return true
}

export function calculateComplexityScore(workflow: any): number {
  if (!workflow || !workflow.nodes) {
    return 0
  }
  
  const nodeCount = workflow.nodes.length
  const connectionCount = Object.keys(workflow.connections || {}).length
  const triggerCount = workflow.nodes.filter((node: any) => 
    node.type.includes('trigger') || node.type.includes('Trigger')
  ).length
  
  // Simple complexity calculation
  return nodeCount + (connectionCount * 2) + (triggerCount * 3)
}

export function extractNodeTypes(workflow: any): string[] {
  if (!workflow || !workflow.nodes) {
    return []
  }
  
  return [...new Set(workflow.nodes.map((node: any) => node.type))]
}

export function hasCredentials(workflow: any): boolean {
  if (!workflow || !workflow.nodes) {
    return false
  }
  
  return workflow.nodes.some((node: any) => 
    node.credentials && Object.keys(node.credentials).length > 0
  )
}