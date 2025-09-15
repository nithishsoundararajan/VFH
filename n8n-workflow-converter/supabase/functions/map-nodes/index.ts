import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface NodeMappingRequest {
  nodes: WorkflowNode[]
  userId: string
  projectId?: string
}

interface WorkflowNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters?: Record<string, any>
  credentials?: Record<string, string>
}

interface MappedNode {
  id: string
  name: string
  type: string
  packageName: string
  importPath: string
  supported: boolean
  parameters: Record<string, any>
  credentialTypes: string[]
  executionCode: string
  errorMessage?: string
}

interface NodeMappingResponse {
  success: boolean
  mappedNodes: MappedNode[]
  unsupportedNodes: string[]
  totalNodes: number
  supportedNodes: number
  dependencies?: string[]
  environmentVariables?: Record<string, string>
  metadata?: {
    triggerNodes: number
    actionNodes: number
    transformNodes: number
    hasWebhooks: boolean
    hasCronJobs: boolean
    complexityScore: number
  }
  error?: string
}

// Enhanced node type mapping with comprehensive definitions
const NODE_PACKAGE_MAPPING: Record<string, {
  package: string
  importPath: string
  credentialTypes?: string[]
  category: 'trigger' | 'action' | 'transform' | 'condition' | 'utility'
  className: string
  standaloneFilePath: string
  dependencies: string[]
  parameters: Record<string, { type: string; required: boolean; default?: any }>
}> = {
  // Core nodes
  'n8n-nodes-base.httpRequest': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/HttpRequest/HttpRequest.node.js',
    credentialTypes: ['httpBasicAuth', 'httpDigestAuth', 'httpHeaderAuth', 'httpQueryAuth', 'oAuth1Api', 'oAuth2Api'],
    category: 'action',
    className: 'HttpRequestNode',
    standaloneFilePath: 'src/nodes/HttpRequestNode.js',
    dependencies: ['node-fetch'],
    parameters: {
      url: { type: 'string', required: true },
      method: { type: 'string', required: false, default: 'GET' },
      headers: { type: 'object', required: false, default: {} },
      body: { type: 'string', required: false },
      timeout: { type: 'number', required: false, default: 30000 }
    }
  },
  'n8n-nodes-base.set': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Set/Set.node.js',
    category: 'transform',
    className: 'SetNode',
    standaloneFilePath: 'src/nodes/SetNode.js',
    dependencies: [],
    parameters: {
      operations: { type: 'array', required: true },
      options: { type: 'object', required: false, default: { dotNotation: true, keepOnlySet: false } }
    }
  },
  'n8n-nodes-base.code': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Code/Code.node.js',
    category: 'transform',
    className: 'CodeNode',
    standaloneFilePath: 'src/nodes/CodeNode.js',
    dependencies: ['vm2'],
    parameters: {
      jsCode: { type: 'string', required: true },
      mode: { type: 'string', required: false, default: 'runOnceForAllItems' }
    }
  },
  'n8n-nodes-base.if': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/If/If.node.js',
    category: 'condition',
    className: 'IfNode',
    standaloneFilePath: 'src/nodes/IfNode.js',
    dependencies: [],
    parameters: {
      conditions: { type: 'array', required: true },
      combineOperation: { type: 'string', required: false, default: 'all' }
    }
  },
  'n8n-nodes-base.merge': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Merge/Merge.node.js',
    category: 'utility',
    className: 'MergeNode',
    standaloneFilePath: 'src/nodes/MergeNode.js',
    dependencies: [],
    parameters: {
      mode: { type: 'string', required: false, default: 'append' },
      mergeByFields: { type: 'array', required: false }
    }
  },

  // Trigger nodes
  'n8n-nodes-base.cron': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Cron/Cron.node.js',
    category: 'trigger',
    className: 'CronTrigger',
    standaloneFilePath: 'src/triggers/CronTrigger.js',
    dependencies: ['node-cron'],
    parameters: {
      rule: { type: 'string', required: true },
      timezone: { type: 'string', required: false, default: 'UTC' }
    }
  },
  'n8n-nodes-base.webhook': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Webhook/Webhook.node.js',
    category: 'trigger',
    className: 'WebhookTrigger',
    standaloneFilePath: 'src/triggers/WebhookTrigger.js',
    dependencies: ['express'],
    parameters: {
      path: { type: 'string', required: true },
      httpMethod: { type: 'string', required: false, default: 'POST' },
      responseMode: { type: 'string', required: false, default: 'onReceived' }
    }
  },
  'n8n-nodes-base.manualTrigger': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/ManualTrigger/ManualTrigger.node.js',
    category: 'trigger',
    className: 'ManualTrigger',
    standaloneFilePath: 'src/triggers/ManualTrigger.js',
    dependencies: [],
    parameters: {}
  },

  // Popular service nodes
  'n8n-nodes-base.gmail': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Gmail/Gmail.node.js',
    credentialTypes: ['gmailOAuth2', 'googleApi'],
    category: 'action',
    className: 'GmailNode',
    standaloneFilePath: 'src/nodes/GmailNode.js',
    dependencies: ['googleapis'],
    parameters: {
      operation: { type: 'string', required: true },
      resource: { type: 'string', required: true }
    }
  },
  'n8n-nodes-base.slack': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Slack/Slack.node.js',
    credentialTypes: ['slackApi', 'slackOAuth2Api'],
    category: 'action',
    className: 'SlackNode',
    standaloneFilePath: 'src/nodes/SlackNode.js',
    dependencies: ['@slack/web-api'],
    parameters: {
      operation: { type: 'string', required: true },
      resource: { type: 'string', required: true }
    }
  },
  'n8n-nodes-base.googleSheets': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/GoogleSheets/GoogleSheets.node.js',
    credentialTypes: ['googleSheetsOAuth2Api', 'googleApi'],
    category: 'action',
    className: 'GoogleSheetsNode',
    standaloneFilePath: 'src/nodes/GoogleSheetsNode.js',
    dependencies: ['googleapis'],
    parameters: {
      operation: { type: 'string', required: true },
      resource: { type: 'string', required: true }
    }
  },
  'n8n-nodes-base.notion': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Notion/Notion.node.js',
    credentialTypes: ['notionApi', 'notionOAuth2Api'],
    category: 'action',
    className: 'NotionNode',
    standaloneFilePath: 'src/nodes/NotionNode.js',
    dependencies: ['@notionhq/client'],
    parameters: {
      operation: { type: 'string', required: true },
      resource: { type: 'string', required: true }
    }
  },
  'n8n-nodes-base.airtable': {
    package: 'n8n-nodes-base',
    importPath: 'dist/nodes/Airtable/Airtable.node.js',
    credentialTypes: ['airtableApi', 'airtableTokenApi'],
    category: 'action',
    className: 'AirtableNode',
    standaloneFilePath: 'src/nodes/AirtableNode.js',
    dependencies: ['airtable'],
    parameters: {
      operation: { type: 'string', required: true },
      application: { type: 'string', required: true }
    }
  }
}

serve(async (req) => {
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

    // Import Edge Function secrets
    const { getSecret, logSecretStatus } = await import('../_shared/edge-secrets.ts')

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

    const { nodes, userId, projectId }: NodeMappingRequest = await req.json()

    // Validate input
    if (!nodes || !Array.isArray(nodes) || userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mappedNodes: MappedNode[] = []
    const unsupportedNodes: string[] = []

    // Process each node with enhanced mapping
    const allDependencies = new Set<string>()
    const environmentVariables = new Set<string>()
    let triggerNodes = 0
    let actionNodes = 0
    let transformNodes = 0

    for (const node of nodes) {
      try {
        const nodeMapping = NODE_PACKAGE_MAPPING[node.type]

        if (nodeMapping) {
          // Transform and validate parameters
          const { transformedParams, validation, envVars } = transformNodeParameters(node, nodeMapping)

          // Generate execution code for supported node
          const executionCode = generateEnhancedNodeCode(node, nodeMapping, transformedParams)

          const mappedNode: MappedNode = {
            id: node.id,
            name: node.name,
            type: node.type,
            packageName: nodeMapping.package,
            importPath: nodeMapping.standaloneFilePath,
            supported: validation.valid,
            parameters: transformedParams,
            credentialTypes: nodeMapping.credentialTypes || [],
            executionCode,
            errorMessage: validation.valid ? undefined : validation.errors.join('; ')
          }

          mappedNodes.push(mappedNode)

          // Collect dependencies and environment variables
          nodeMapping.dependencies.forEach(dep => allDependencies.add(dep))
          envVars.forEach(envVar => environmentVariables.add(envVar))

          // Count by category
          switch (nodeMapping.category) {
            case 'trigger':
              triggerNodes++
              break
            case 'action':
              actionNodes++
              break
            case 'transform':
              transformNodes++
              break
          }

          // Log successful mapping
          if (projectId) {
            await supabase.from('generation_logs').insert({
              project_id: projectId,
              log_level: validation.valid ? 'info' : 'warning',
              message: validation.valid
                ? `Mapped node: ${node.name} (${node.type})`
                : `Mapped node with warnings: ${node.name} - ${validation.errors.join(', ')}`
            })
          }
        } else {
          // Handle unsupported node type
          unsupportedNodes.push(node.type)

          const unsupportedNode: MappedNode = {
            id: node.id,
            name: node.name,
            type: node.type,
            packageName: 'unsupported',
            importPath: '',
            supported: false,
            parameters: {},
            credentialTypes: [],
            executionCode: '',
            errorMessage: `Node type '${node.type}' is not supported in the current mapping`
          }

          mappedNodes.push(unsupportedNode)

          // Log unsupported node
          if (projectId) {
            await supabase.from('generation_logs').insert({
              project_id: projectId,
              log_level: 'warning',
              message: `Unsupported node type: ${node.type} (${node.name})`
            })
          }
        }
      } catch (error) {
        console.error(`Error mapping node ${node.id}:`, error)

        const errorNode: MappedNode = {
          id: node.id,
          name: node.name,
          type: node.type,
          packageName: 'error',
          importPath: '',
          supported: false,
          parameters: {},
          credentialTypes: [],
          executionCode: '',
          errorMessage: `Error mapping node: ${error.message}`
        }

        mappedNodes.push(errorNode)

        if (projectId) {
          await supabase.from('generation_logs').insert({
            project_id: projectId,
            log_level: 'error',
            message: `Error mapping node ${node.name}: ${error.message}`
          })
        }
      }
    }

    // Add base dependencies
    allDependencies.add('dotenv')
    allDependencies.add('express')

    const response: NodeMappingResponse = {
      success: true,
      mappedNodes,
      unsupportedNodes: [...new Set(unsupportedNodes)],
      totalNodes: nodes.length,
      supportedNodes: mappedNodes.filter(n => n.supported).length,
      dependencies: Array.from(allDependencies),
      environmentVariables: Array.from(environmentVariables).reduce((acc, envVar) => {
        acc[envVar] = `your_${envVar.toLowerCase()}_here`
        return acc
      }, {} as Record<string, string>),
      metadata: {
        triggerNodes,
        actionNodes,
        transformNodes,
        hasWebhooks: mappedNodes.some(n => n.type === 'n8n-nodes-base.webhook'),
        hasCronJobs: mappedNodes.some(n => n.type === 'n8n-nodes-base.cron'),
        complexityScore: calculateComplexityScore(nodes)
      }
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
        mappedNodes: [],
        unsupportedNodes: [],
        totalNodes: 0,
        supportedNodes: 0,
        dependencies: [],
        environmentVariables: {},
        metadata: {
          triggerNodes: 0,
          actionNodes: 0,
          transformNodes: 0,
          hasWebhooks: false,
          hasCronJobs: false,
          complexityScore: 0
        },
        error: 'Internal server error'
      } as NodeMappingResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function transformNodeParameters(node: WorkflowNode, nodeMapping: any): {
  transformedParams: Record<string, any>
  validation: { valid: boolean; errors: string[]; warnings: string[] }
  envVars: string[]
} {
  const transformedParams: Record<string, any> = {}
  const validation = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[]
  }
  const envVars: string[] = []

  // Process each parameter according to its definition
  for (const [paramName, paramDef] of Object.entries(nodeMapping.parameters)) {
    const paramDefinition = paramDef as any
    const nodeParamValue = node.parameters?.[paramName]

    if (nodeParamValue !== undefined) {
      // Transform the parameter value
      const { transformedValue, extractedEnvVars } = transformParameterValue(
        nodeParamValue,
        paramDefinition
      )
      transformedParams[paramName] = transformedValue
      envVars.push(...extractedEnvVars)
    } else if (paramDefinition.default !== undefined) {
      // Use default value
      transformedParams[paramName] = paramDefinition.default
    } else if (paramDefinition.required) {
      // Missing required parameter
      validation.valid = false
      validation.errors.push(`Required parameter '${paramName}' is missing`)
    }

    // Validate parameter value
    const paramValidation = validateParameterValue(
      transformedParams[paramName],
      paramDefinition,
      paramName
    )

    if (!paramValidation.valid) {
      validation.valid = false
      validation.errors.push(...paramValidation.errors)
    }
    validation.warnings.push(...paramValidation.warnings)
  }

  return { transformedParams, validation, envVars }
}

function transformParameterValue(value: any, paramDef: any): {
  transformedValue: any
  extractedEnvVars: string[]
} {
  const extractedEnvVars: string[] = []
  let transformedValue = value

  // Handle string values that might contain expressions
  if (typeof value === 'string') {
    // Extract environment variable references
    const envVarRegex = /\$env\.([A-Z_][A-Z0-9_]*)/g
    let match
    while ((match = envVarRegex.exec(value)) !== null) {
      extractedEnvVars.push(match[1])
      // Replace with process.env reference for code generation
      transformedValue = transformedValue.replace(match[0], `process.env.${match[1]}`)
    }

    // Handle n8n expressions
    const n8nExprRegex = /\{\{\s*([^}]+)\s*\}\}/g
    transformedValue = transformedValue.replace(n8nExprRegex, (match: string, expression: string) => {
      return convertN8nExpression(expression.trim())
    })
  }

  // Type conversion
  switch (paramDef.type) {
    case 'number':
      if (typeof transformedValue === 'string') {
        const num = Number(transformedValue)
        if (!isNaN(num)) {
          transformedValue = num
        }
      }
      break
    case 'boolean':
      if (typeof transformedValue === 'string') {
        transformedValue = transformedValue.toLowerCase() === 'true'
      }
      break
    case 'object':
      if (typeof transformedValue === 'string') {
        try {
          transformedValue = JSON.parse(transformedValue)
        } catch {
          // Keep as string if not valid JSON
        }
      }
      break
  }

  return { transformedValue, extractedEnvVars }
}

function convertN8nExpression(expression: string): string {
  // Convert n8n expressions to standalone format
  if (expression.startsWith('$json')) {
    const path = expression.substring(5)
    return path === '' || path === '.' ? 'inputData' : `inputData${path}`
  }

  if (expression.startsWith('$node')) {
    const nodeRef = expression.match(/\$node\[\"([^\"]+)\"\](.*)/)
    if (nodeRef) {
      const nodeName = nodeRef[1]
      const path = nodeRef[2] || ''
      return `context.getNodeOutput('${nodeName}')${path}`
    }
  }

  if (expression.startsWith('$parameter')) {
    const paramPath = expression.substring(10)
    if (paramPath.startsWith('.')) {
      return `this.getParameter('${paramPath.substring(1)}')`
    }
    return 'this.parameters'
  }

  // Return as-is for other expressions
  return `"${expression}"`
}

function validateParameterValue(value: any, paramDef: any, paramName: string): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const validation = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[]
  }

  if (paramDef.required && (value === undefined || value === null || value === '')) {
    validation.valid = false
    validation.errors.push(`Parameter '${paramName}' is required`)
    return validation
  }

  if (value === undefined || value === null) {
    return validation
  }

  // Type-specific validation
  switch (paramDef.type) {
    case 'string':
      if (typeof value !== 'string') {
        validation.warnings.push(`Parameter '${paramName}' should be a string`)
      }
      break
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        validation.valid = false
        validation.errors.push(`Parameter '${paramName}' must be a valid number`)
      }
      break
    case 'boolean':
      if (typeof value !== 'boolean') {
        validation.warnings.push(`Parameter '${paramName}' should be a boolean`)
      }
      break
  }

  return validation
}

function generateEnhancedNodeCode(node: WorkflowNode, mapping: any, transformedParams: Record<string, any>): string {
  const className = mapping.className
  const baseClass = mapping.category === 'trigger' ? 'BaseTriggerNode' : 'BaseActionNode'

  // Generate parameter assignments
  const parameterCode = Object.entries(transformedParams)
    .map(([key, value]) => {
      const valueStr = typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
      return `    this.${key} = ${valueStr};`
    })
    .join('\n')

  // Generate credential methods if needed
  const credentialCode = mapping.credentialTypes?.length > 0
    ? generateCredentialMethods(mapping.credentialTypes)
    : ''

  return `
/**
 * ${node.name} Node Implementation
 * Generated from n8n node type: ${node.type}
 */
class ${className} extends ${baseClass} {
  constructor(parameters = {}) {
    super();
    
    // Initialize parameters
${parameterCode}
    
    // Override with provided parameters
    Object.assign(this, parameters);
  }

${credentialCode}

  /**
   * Execute the node
   */
  async execute(inputData, context) {
    try {
      return await this.processData(inputData, context);
    } catch (error) {
      throw new Error(\`\${this.constructor.name} execution failed: \${error.message}\`);
    }
  }

  /**
   * Process data - implemented based on node type
   */
  async processData(inputData, context) {
    // Implementation will be generated based on specific node type
    throw new Error('processData method must be implemented by subclass');
  }
}

module.exports = ${className};
`.trim()
}

function generateCredentialMethods(credentialTypes: string[]): string {
  return credentialTypes.map(credType => {
    const methodName = `get${credType.charAt(0).toUpperCase() + credType.slice(1)}Credential`
    return `
  /**
   * Get ${credType} credential
   */
  ${methodName}() {
    return {
      // Credential fields will be populated from environment variables
      // Implementation depends on credential type
    };
  }`
  }).join('\n')
}

function calculateComplexityScore(nodes: WorkflowNode[]): number {
  // Simple complexity calculation based on node count and types
  let score = nodes.length

  // Add complexity for specific node types
  nodes.forEach(node => {
    const mapping = NODE_PACKAGE_MAPPING[node.type]
    if (mapping) {
      switch (mapping.category) {
        case 'trigger':
          score += 2 // Triggers add complexity
          break
        case 'condition':
          score += 1.5 // Conditions add some complexity
          break
        case 'transform':
          score += 1 // Transforms are moderately complex
          break
      }

      // Add complexity for credential requirements
      if (mapping.credentialTypes && mapping.credentialTypes.length > 0) {
        score += mapping.credentialTypes.length * 0.5
      }

      // Add complexity for dependencies
      score += mapping.dependencies.length * 0.3
    }
  })

  return Math.round(score * 10) / 10 // Round to 1 decimal place
}

function sanitizeParameters(parameters: Record<string, any>): Record<string, any> {
  const sanitized = { ...parameters }

  // Remove or mask sensitive parameter values
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential']

  for (const [key, value] of Object.entries(sanitized)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      if (typeof value === 'string' && value.length > 0) {
        sanitized[key] = '[MASKED_VALUE]'
      }
    }
  }

  return sanitized
}