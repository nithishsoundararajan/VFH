import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AIProviderHelper } from '../_shared/ai-provider-helper.ts'

interface CodeGenerationRequest {
  projectId: string
  workflowData: any
  mappedNodes: MappedNode[]
  userId: string
  projectName: string
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

interface GeneratedFile {
  path: string
  content: string
  type: 'javascript' | 'json' | 'markdown' | 'text'
}

interface CodeGenerationResponse {
  success: boolean
  projectId: string
  filesGenerated: number
  downloadUrl?: string
  error?: string
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
    
    // Initialize AI provider helper
    const aiHelper = new AIProviderHelper(supabaseUrl, supabaseKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { projectId, workflowData, mappedNodes, userId, projectName }: CodeGenerationRequest = await req.json()

    // Validate input
    if (!projectId || !workflowData || !mappedNodes || userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update project status to processing
    await supabase.from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId)

    await logProgress(supabase, projectId, 'info', 'Starting code generation...')

    // Generate project files
    const generatedFiles: GeneratedFile[] = []

    // 1. Generate package.json
    await logProgress(supabase, projectId, 'info', 'Generating package.json...')
    generatedFiles.push(generatePackageJson(projectName, mappedNodes))

    // 2. Generate main entry point
    await logProgress(supabase, projectId, 'info', 'Generating main.js...')
    generatedFiles.push(generateMainFile(workflowData, mappedNodes))

    // 3. Generate config.js
    await logProgress(supabase, projectId, 'info', 'Generating config.js...')
    generatedFiles.push(generateConfigFile(mappedNodes))

    // 4. Generate individual node files using source-aware generation
    await logProgress(supabase, projectId, 'info', 'Generating node implementations with source analysis...')
    const supportedNodes = mappedNodes.filter(node => node.supported)
    
    // Initialize source-aware generator
    const { SourceAwareAIGenerator } = await import('../_shared/source-aware-generator.ts')
    const sourceAwareGenerator = new SourceAwareAIGenerator(supabaseUrl, supabaseKey)
    
    for (const node of supportedNodes) {
      generatedFiles.push(await generateNodeFileWithSource(node, sourceAwareGenerator, userId, workflowData, projectName))
    }

    // 5. Generate workflow execution file
    await logProgress(supabase, projectId, 'info', 'Generating workflow executor...')
    generatedFiles.push(generateWorkflowExecutor(workflowData, mappedNodes))

    // 6. Generate trigger files
    await logProgress(supabase, projectId, 'info', 'Generating trigger implementations...')
    const triggerNodes = mappedNodes.filter(node => 
      node.type.includes('trigger') || node.type.includes('Trigger')
    )
    
    for (const trigger of triggerNodes) {
      generatedFiles.push(generateTriggerFile(trigger, workflowData))
    }

    // 7. Generate README.md
    await logProgress(supabase, projectId, 'info', 'Generating documentation...')
    generatedFiles.push(generateReadme(projectName, workflowData, mappedNodes))

    // 8. Generate .env.example
    generatedFiles.push(generateEnvExample(mappedNodes))

    // 9. Generate .gitignore
    generatedFiles.push(generateGitignore())

    // Create ZIP file and upload to Supabase Storage
    await logProgress(supabase, projectId, 'info', 'Creating project archive...')
    
    const zipBuffer = await createZipFile(generatedFiles, projectName)
    const fileName = `${projectName}-${Date.now()}.zip`
    const filePath = `${userId}/${projectId}/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-projects')
      .upload(filePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Failed to upload project: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('generated-projects')
      .getPublicUrl(filePath)

    // Update project with completion status
    await supabase.from('projects')
      .update({ 
        status: 'completed',
        file_path: filePath,
        generated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    await logProgress(supabase, projectId, 'info', `Code generation completed! Generated ${generatedFiles.length} files.`)

    const response: CodeGenerationResponse = {
      success: true,
      projectId,
      filesGenerated: generatedFiles.length,
      downloadUrl: urlData.publicUrl
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Code generation error:', error)
    
    // Update project status to failed if we have projectId
    const body = await req.json().catch(() => ({}))
    if (body.projectId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      await supabase.from('projects')
        .update({ status: 'failed' })
        .eq('id', body.projectId)
        
      await logProgress(supabase, body.projectId, 'error', `Code generation failed: ${error.message}`)
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        projectId: body.projectId || '',
        filesGenerated: 0,
        error: error.message
      } as CodeGenerationResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function logProgress(supabase: any, projectId: string, level: string, message: string) {
  await supabase.from('generation_logs').insert({
    project_id: projectId,
    log_level: level,
    message
  })
}

function generatePackageJson(projectName: string, mappedNodes: MappedNode[]): GeneratedFile {
  // Core dependencies for standalone execution (no n8n runtime needed)
  const dependencies: Record<string, string> = {
    'dotenv': '^16.0.0',
    'axios': '^1.6.0',        // HTTP requests
    'lodash': '^4.17.21',     // Utility functions
    'node-cron': '^3.0.3',    // Cron scheduling
    'express': '^4.18.2'      // Web server for webhooks
  }

  // Add node-specific dependencies based on analysis
  const nodeTypes = new Set(mappedNodes.map(node => node.type))
  
  // Database dependencies
  if (nodeTypes.has('n8n-nodes-base.mysql') || nodeTypes.has('n8n-nodes-base.postgres')) {
    dependencies['mysql2'] = '^3.6.0'
    dependencies['pg'] = '^8.11.0'
  }
  
  // MongoDB
  if (nodeTypes.has('n8n-nodes-base.mongoDb')) {
    dependencies['mongodb'] = '^6.0.0'
  }
  
  // Redis
  if (nodeTypes.has('n8n-nodes-base.redis')) {
    dependencies['redis'] = '^4.6.0'
  }
  
  // File operations
  if (nodeTypes.has('n8n-nodes-base.readBinaryFile') || nodeTypes.has('n8n-nodes-base.writeBinaryFile')) {
    dependencies['fs-extra'] = '^11.1.0'
  }
  
  // Crypto operations
  if (nodeTypes.has('n8n-nodes-base.crypto')) {
    dependencies['crypto-js'] = '^4.2.0'
  }
  
  // XML processing
  if (nodeTypes.has('n8n-nodes-base.xml')) {
    dependencies['xml2js'] = '^0.6.0'
  }
  
  // JWT operations
  if (nodeTypes.has('n8n-nodes-base.jwt')) {
    dependencies['jsonwebtoken'] = '^9.0.0'
  }
  
  // SSH operations
  if (nodeTypes.has('n8n-nodes-base.ssh')) {
    dependencies['node-ssh'] = '^13.1.0'
  }
  
  // FTP operations
  if (nodeTypes.has('n8n-nodes-base.ftp')) {
    dependencies['basic-ftp'] = '^5.0.0'
  }
  
  // Email operations
  if (nodeTypes.has('n8n-nodes-base.emailSend')) {
    dependencies['nodemailer'] = '^6.9.0'
  }
  
  // Add common utility packages for enhanced functionality
  dependencies['uuid'] = '^9.0.0'           // UUID generation
  dependencies['moment'] = '^2.29.0'        // Date manipulation
  dependencies['validator'] = '^13.11.0'    // Data validation

  const packageJson = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    version: '1.0.0',
    description: `Standalone Node.js project generated from n8n workflow: ${projectName}`,
    main: 'main.js',
    type: 'module',
    scripts: {
      start: 'node main.js',
      dev: 'nodemon main.js',
      test: 'jest',
      'test:watch': 'jest --watch',
      build: 'tsc',
      'type-check': 'tsc --noEmit'
    },
    dependencies,
    devDependencies: {
      'nodemon': '^3.0.0',
      'jest': '^29.7.0',
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0'
    },
    engines: {
      node: '>=18.0.0'
    },
    keywords: [
      'n8n', 'workflow', 'automation', 'standalone',
      ...mappedNodes.map(node => node.type.replace('n8n-nodes-base.', ''))
    ],
    author: 'Generated by n8n Workflow Converter',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'https://github.com/user/generated-n8n-project.git'
    }
  }

  return {
    path: 'package.json',
    content: JSON.stringify(packageJson, null, 2),
    type: 'json'
  }
}

function generateMainFile(workflowData: any, mappedNodes: MappedNode[]): GeneratedFile {
  const content = `#!/usr/bin/env node

/**
 * Main entry point for the standalone n8n workflow
 * Generated from: ${workflowData.name || 'Unnamed Workflow'}
 */

import { config } from './config.js';
import { WorkflowExecutor } from './src/workflows/WorkflowExecutor.js';

async function main() {
  try {
    console.log('Starting n8n standalone workflow...');
    console.log('Workflow:', '${workflowData.name || 'Unnamed Workflow'}');
    console.log('Nodes:', ${mappedNodes.length});
    
    const executor = new WorkflowExecutor(config);
    await executor.initialize();
    
    // Execute workflow
    const result = await executor.execute();
    
    console.log('Workflow execution completed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Workflow execution failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the application
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});`

  return {
    path: 'main.js',
    content,
    type: 'javascript'
  }
}

function generateConfigFile(mappedNodes: MappedNode[]): GeneratedFile {
  const credentialTypes = new Set<string>()
  mappedNodes.forEach(node => {
    node.credentialTypes.forEach(type => credentialTypes.add(type))
  })

  const content = `/**
 * Configuration file for the standalone n8n workflow
 * Load environment variables and configure credentials
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  // Workflow execution settings
  execution: {
    timeout: parseInt(process.env.EXECUTION_TIMEOUT) || 300000, // 5 minutes
    retries: parseInt(process.env.EXECUTION_RETRIES) || 3,
    mode: process.env.EXECUTION_MODE || 'manual'
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },
  
  // Credentials configuration
  credentials: {
${Array.from(credentialTypes).map(type => `    ${type}: {
      // Configure ${type} credentials here
      // Example: apiKey: process.env.${type.toUpperCase()}_API_KEY
    }`).join(',\n')}
  },
  
  // Node-specific configuration
  nodes: {
    httpRequest: {
      timeout: parseInt(process.env.HTTP_TIMEOUT) || 30000,
      maxRedirects: parseInt(process.env.HTTP_MAX_REDIRECTS) || 5
    }
  }
};

// Validate required environment variables
export function validateConfig() {
  const required = [
    // Add required environment variables here
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(\`Missing required environment variables: \${missing.join(', ')}\`);
  }
}

export default config;`

  return {
    path: 'config.js',
    content,
    type: 'javascript'
  }
}

async function generateNodeFileWithSource(
  node: MappedNode, 
  sourceAwareGenerator: any, 
  userId: string, 
  workflowData: any, 
  projectName: string
): Promise<GeneratedFile> {
  const className = node.name.replace(/[^a-zA-Z0-9]/g, '') + 'Node'
  
  try {
    console.log(`Generating ${node.name} with source-aware analysis...`)
    
    const generationContext = {
      workflowData,
      nodeParameters: node.parameters,
      nodeConnections: [],
      projectName
    }

    const result = await sourceAwareGenerator.generateFromSource(userId, node.type, generationContext)
    
    if (result.success) {
      const content = `/**
 * Node implementation: ${node.name}
 * Type: ${node.type}
 * Generated using: ${result.fallbackUsed ? 'ai-fallback' : 'source-aware'}
 */

${result.generatedCode}

export default ${className};`

      return {
        path: `src/nodes/${className}.js`,
        content,
        type: 'javascript'
      }
    } else {
      throw new Error(result.error || 'Source-aware generation failed')
    }
  } catch (error) {
    console.warn(`Source-aware generation failed for ${node.name}, using fallback:`, error)
    return generateNodeFileFallback(node, userId)
  }
}

async function generateNodeFile(node: MappedNode, aiHelper: AIProviderHelper, userId: string): Promise<GeneratedFile> {
  const className = node.name.replace(/[^a-zA-Z0-9]/g, '') + 'Node'
  
  // Try source-aware generation first
  let enhancedCode = node.executionCode
  let generationMethod = 'template'
  
  try {
    // Import source-aware generator (dynamic import for Edge Function compatibility)
    const { SourceAwareAIGenerator } = await import('../_shared/source-aware-generator.ts')
    
    const sourceGenerator = new SourceAwareAIGenerator(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const generationContext = {
      workflowData: { name: node.name, type: node.type },
      nodeParameters: node.parameters,
      nodeConnections: [],
      projectName: 'Generated Project'
    }

    const result = await sourceGenerator.generateFromSource(userId, node.type, generationContext)
    
    if (result.success && result.generatedCode.trim().length > 100) {
      enhancedCode = result.generatedCode
      generationMethod = result.fallbackUsed ? 'ai-fallback' : 'source-aware'
      console.log(`Generated ${node.name} using ${generationMethod} method`)
    } else {
      throw new Error(result.error || 'Source-aware generation failed')
    }
  } catch (sourceError) {
    console.warn(`Source-aware generation failed for ${node.name}, trying AI enhancement:`, sourceError)
    
    // Fallback to original AI enhancement
    try {
      const prompt = `
Enhance this n8n node implementation for standalone execution:

Node Name: ${node.name}
Node Type: ${node.type}
Package: ${node.packageName}
Parameters: ${JSON.stringify(node.parameters, null, 2)}

Current implementation:
${node.executionCode}

Please improve the code with:
1. Better error handling
2. Input validation
3. Proper logging
4. JSDoc documentation
5. TypeScript-style parameter validation

Return only the enhanced JavaScript code for the ${className} class.
`

      const aiEnhancedCode = await aiHelper.generateCode(userId, prompt, {
        nodeType: node.type,
        nodeName: node.name,
        parameters: node.parameters
      })

      if (aiEnhancedCode && aiEnhancedCode.trim().length > 100) {
        enhancedCode = aiEnhancedCode
        generationMethod = 'ai-enhanced'
      }
    } catch (aiError) {
      console.warn(`AI enhancement also failed for node ${node.name}, using template:`, aiError)
      generationMethod = 'template-only'
    }
  }
  
  const content = `/**
 * Node implementation: ${node.name}
 * Type: ${node.type}
 * Generated using: ${generationMethod}
 * ${generationMethod === 'source-aware' ? 'Based on actual n8n source code' : 'Enhanced with AI assistance'}
 */

${enhancedCode}

export default ${className};`

  return {
    path: `src/nodes/${className}.js`,
    content,
    type: 'javascript'
  }
}

async function generateNodeFileFallback(node: MappedNode, userId: string): Promise<GeneratedFile> {
  const className = node.name.replace(/[^a-zA-Z0-9]/g, '') + 'Node'
  
  const content = `/**
 * Node implementation: ${node.name}
 * Type: ${node.type}
 * Generated using: template-fallback
 */

${node.executionCode}

export default ${className};`

  return {
    path: `src/nodes/${className}.js`,
    content,
    type: 'javascript'
  }
}

function generateWorkflowExecutor(workflowData: any, mappedNodes: MappedNode[]): GeneratedFile {
  const nodeImports = mappedNodes
    .filter(node => node.supported)
    .map(node => {
      const className = node.name.replace(/[^a-zA-Z0-9]/g, '') + 'Node'
      return `import ${className} from '../nodes/${className}.js';`
    })
    .join('\n')

  const content = `/**
 * Advanced Workflow Executor
 * Executes the n8n workflow with proper dependency resolution and error handling
 */

${nodeImports}

export class WorkflowExecutor {
  constructor(config) {
    this.config = config;
    this.nodes = new Map();
    this.workflow = ${JSON.stringify(workflowData, null, 2)};
    this.executionId = this.generateExecutionId();
    this.executionLogs = [];
    this.executionStartTime = null;
    this.nodeExecutionTimes = new Map();
  }
  
  generateExecutionId() {
    return \`exec_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  }
  
  log(level, message, nodeId = null, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      executionId: this.executionId,
      level,
      message,
      nodeId,
      data: data ? JSON.stringify(data) : null
    };
    
    this.executionLogs.push(logEntry);
    
    // Console output with formatting
    const prefix = nodeId ? \`[\${nodeId}]\` : '[WORKFLOW]';
    const timestamp = new Date().toISOString();
    console.log(\`\${timestamp} \${level.toUpperCase()} \${prefix} \${message}\`);
    
    if (data && this.config.logging.level === 'debug') {
      console.log(\`\${timestamp} DEBUG \${prefix} Data:\`, data);
    }
  }
  
  async initialize() {
    this.log('info', 'Initializing workflow executor');
    this.log('info', \`Workflow: \${this.workflow.name || 'Unnamed'}\`);
    this.log('info', \`Total nodes: \${this.workflow.nodes?.length || 0}\`);
    
    // Initialize all nodes
${mappedNodes
  .filter(node => node.supported)
  .map(node => {
    const className = node.name.replace(/[^a-zA-Z0-9]/g, '') + 'Node'
    return `    this.nodes.set('${node.id}', new ${className}());`
  })
  .join('\n')}
    
    this.log('info', \`Initialized \${this.nodes.size} nodes\`);
  }
  
  async execute() {
    this.executionStartTime = Date.now();
    this.log('info', 'Starting workflow execution');
    
    const results = new Map();
    const nodeStatus = new Map(); // Track node execution status
    
    try {
      // Calculate execution order using topological sort
      const executionOrder = this.calculateExecutionOrder();
      this.log('info', \`Execution order: \${executionOrder.join(' -> ')}\`);
      
      // Execute nodes in dependency order
      for (const nodeId of executionOrder) {
        await this.executeNode(nodeId, results, nodeStatus);
      }
      
      const executionTime = Date.now() - this.executionStartTime;
      this.log('info', \`Workflow execution completed in \${executionTime}ms\`);
      
      return {
        success: true,
        executionId: this.executionId,
        executionTime,
        results: Object.fromEntries(results),
        logs: this.executionLogs,
        nodeExecutionTimes: Object.fromEntries(this.nodeExecutionTimes)
      };
      
    } catch (error) {
      const executionTime = Date.now() - this.executionStartTime;
      this.log('error', \`Workflow execution failed: \${error.message}\`);
      
      return {
        success: false,
        executionId: this.executionId,
        executionTime,
        error: error.message,
        results: Object.fromEntries(results),
        logs: this.executionLogs,
        nodeExecutionTimes: Object.fromEntries(this.nodeExecutionTimes)
      };
    }
  }
  
  async executeNode(nodeId, results, nodeStatus) {
    const nodeStartTime = Date.now();
    nodeStatus.set(nodeId, 'running');
    
    const node = this.nodes.get(nodeId);
    if (!node) {
      this.log('warn', 'Node not found, skipping', nodeId);
      nodeStatus.set(nodeId, 'skipped');
      return;
    }
    
    try {
      this.log('info', 'Starting node execution', nodeId);
      
      // Get input data from connected nodes
      const inputData = this.getInputData(nodeId, results);
      this.log('debug', 'Input data prepared', nodeId, { inputCount: inputData.length });
      
      // Execute node with timeout and retry logic
      const result = await this.executeWithRetry(node, inputData, nodeId);
      
      results.set(nodeId, result);
      nodeStatus.set(nodeId, 'completed');
      
      const executionTime = Date.now() - nodeStartTime;
      this.nodeExecutionTimes.set(nodeId, executionTime);
      
      this.log('info', \`Node execution completed in \${executionTime}ms\`, nodeId);
      
    } catch (error) {
      const executionTime = Date.now() - nodeStartTime;
      this.nodeExecutionTimes.set(nodeId, executionTime);
      nodeStatus.set(nodeId, 'failed');
      
      this.log('error', \`Node execution failed: \${error.message}\`, nodeId);
      
      if (this.config.execution.continueOnFailure) {
        results.set(nodeId, { 
          error: error.message, 
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        this.log('warn', 'Continuing execution despite node failure', nodeId);
      } else {
        throw new Error(\`Node \${nodeId} failed: \${error.message}\`);
      }
    }
  }
  
  async executeWithRetry(node, inputData, nodeId) {
    const maxRetries = this.config.execution.retries || 3;
    const timeout = this.config.execution.timeout || 300000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log('debug', \`Execution attempt \${attempt}/\${maxRetries}\`, nodeId);
        
        // Execute with timeout
        const result = await Promise.race([
          node.execute(inputData, {
            workflow: this.workflow,
            config: this.config,
            mode: this.config.execution.mode,
            executionId: this.executionId,
            nodeId: nodeId
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Execution timeout')), timeout)
          )
        ]);
        
        return result;
        
      } catch (error) {
        this.log('warn', \`Attempt \${attempt} failed: \${error.message}\`, nodeId);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.log('debug', \`Retrying in \${delay}ms\`, nodeId);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  calculateExecutionOrder() {
    const nodes = this.workflow.nodes || [];
    const connections = this.workflow.connections || {};
    
    // Build dependency graph
    const graph = new Map();
    const inDegree = new Map();
    
    // Initialize graph
    nodes.forEach(node => {
      graph.set(node.id, []);
      inDegree.set(node.id, 0);
    });
    
    // Build edges from connections
    Object.entries(connections).forEach(([targetNodeId, inputConnections]) => {
      Object.values(inputConnections).forEach(connectionList => {
        if (Array.isArray(connectionList)) {
          connectionList.forEach(connection => {
            const sourceNodeId = connection.node;
            if (graph.has(sourceNodeId) && graph.has(targetNodeId)) {
              graph.get(sourceNodeId).push(targetNodeId);
              inDegree.set(targetNodeId, inDegree.get(targetNodeId) + 1);
            }
          });
        }
      });
    });
    
    // Topological sort using Kahn's algorithm
    const queue = [];
    const result = [];
    
    // Find nodes with no incoming edges (triggers/start nodes)
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });
    
    while (queue.length > 0) {
      const currentNode = queue.shift();
      result.push(currentNode);
      
      // Process all neighbors
      graph.get(currentNode).forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }
    
    // Check for cycles
    if (result.length !== nodes.length) {
      this.log('warn', 'Circular dependency detected, using fallback order');
      return nodes.map(node => node.id);
    }
    
    return result;
  }
  
  getInputData(nodeId, results) {
    const connections = this.workflow.connections || {};
    const inputConnections = connections[nodeId] || {};
    const inputData = [];
    
    // Process each input connection
    Object.entries(inputConnections).forEach(([inputIndex, connectionList]) => {
      if (Array.isArray(connectionList)) {
        connectionList.forEach(connection => {
          const sourceNodeId = connection.node;
          const outputIndex = connection.output || 0;
          const sourceData = results.get(sourceNodeId);
          
          if (sourceData) {
            // Handle different output formats
            let outputData = sourceData;
            
            // If source data has multiple outputs, get the specific output
            if (Array.isArray(sourceData) && sourceData[outputIndex] !== undefined) {
              outputData = sourceData[outputIndex];
            } else if (sourceData.outputs && sourceData.outputs[outputIndex]) {
              outputData = sourceData.outputs[outputIndex];
            }
            
            inputData.push({
              data: outputData,
              source: {
                node: sourceNodeId,
                output: outputIndex
              }
            });
          }
        });
      }
    });
    
    // Return formatted input data or empty array for trigger nodes
    return inputData.length > 0 ? inputData : [{ data: {} }];
  }
  
  getExecutionSummary() {
    const totalTime = this.nodeExecutionTimes.size > 0 
      ? Array.from(this.nodeExecutionTimes.values()).reduce((a, b) => a + b, 0)
      : 0;
      
    return {
      executionId: this.executionId,
      totalExecutionTime: Date.now() - this.executionStartTime,
      nodeExecutionTime: totalTime,
      nodesExecuted: this.nodeExecutionTimes.size,
      totalLogs: this.executionLogs.length,
      errorCount: this.executionLogs.filter(log => log.level === 'error').length,
      warningCount: this.executionLogs.filter(log => log.level === 'warn').length
    };
  }
}`

  return {
    path: 'src/workflows/WorkflowExecutor.js',
    content,
    type: 'javascript'
  }
}

function generateTriggerFile(trigger: MappedNode, workflowData: any): GeneratedFile {
  const className = trigger.name.replace(/[^a-zA-Z0-9]/g, '') + 'Trigger'
  
  let triggerImplementation = ''
  
  if (trigger.type.includes('cron')) {
    triggerImplementation = `
import cron from 'node-cron';

export class ${className} {
  constructor(config) {
    this.config = config;
    this.schedule = '${trigger.parameters.rule || '0 * * * *'}'; // Default: every hour
  }
  
  start(callback) {
    console.log(\`Starting cron trigger: \${this.schedule}\`);
    
    cron.schedule(this.schedule, () => {
      console.log('Cron trigger fired');
      callback();
    });
  }
  
  stop() {
    console.log('Stopping cron trigger');
    // Implementation for stopping cron job
  }
}`
  } else if (trigger.type.includes('webhook')) {
    triggerImplementation = `
import express from 'express';

export class ${className} {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.port = process.env.WEBHOOK_PORT || 3000;
    this.path = '${trigger.parameters.path || '/webhook'}';
  }
  
  start(callback) {
    this.app.use(express.json());
    
    this.app.post(this.path, (req, res) => {
      console.log('Webhook triggered');
      callback(req.body);
      res.json({ success: true });
    });
    
    this.app.listen(this.port, () => {
      console.log(\`Webhook listening on port \${this.port}\${this.path}\`);
    });
  }
  
  stop() {
    console.log('Stopping webhook server');
    // Implementation for stopping Express server
  }
}`
  } else {
    triggerImplementation = `
export class ${className} {
  constructor(config) {
    this.config = config;
  }
  
  start(callback) {
    console.log('Manual trigger - call execute() to run workflow');
    this.callback = callback;
  }
  
  execute() {
    if (this.callback) {
      this.callback();
    }
  }
  
  stop() {
    console.log('Stopping manual trigger');
  }
}`
  }

  return {
    path: `src/triggers/${className}.js`,
    content: triggerImplementation,
    type: 'javascript'
  }
}

function generateReadme(projectName: string, workflowData: any, mappedNodes: MappedNode[]): GeneratedFile {
  const supportedNodes = mappedNodes.filter(node => node.supported)
  const unsupportedNodes = mappedNodes.filter(node => !node.supported)

  const content = `# ${projectName}

This is a standalone Node.js project generated from an n8n workflow.

## Overview

- **Original Workflow**: ${workflowData.name || 'Unnamed Workflow'}
- **Total Nodes**: ${mappedNodes.length}
- **Supported Nodes**: ${supportedNodes.length}
- **Unsupported Nodes**: ${unsupportedNodes.length}

## Generated by n8n Workflow Converter

This project was automatically generated from an n8n workflow JSON export. It maintains the same functionality as the original workflow but runs as a standalone Node.js application without requiring the n8n runtime.

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

1. Copy the environment template:
\`\`\`bash
cp .env.example .env
\`\`\`

2. Configure your environment variables in \`.env\`:
${mappedNodes.flatMap(node => node.credentialTypes).filter((type, index, arr) => arr.indexOf(type) === index).map(type => `   - ${type.toUpperCase()}_API_KEY=your_api_key_here`).join('\n')}

## Usage

Run the workflow:
\`\`\`bash
npm start
\`\`\`

Development mode with auto-reload:
\`\`\`bash
npm run dev
\`\`\`

## Supported Nodes

${supportedNodes.map(node => `- **${node.name}** (${node.type})`).join('\n')}

${unsupportedNodes.length > 0 ? `## Unsupported Nodes

The following nodes were not supported during conversion:

${unsupportedNodes.map(node => `- **${node.name}** (${node.type}) - ${node.errorMessage || 'Not supported'}`).join('\n')}

These nodes were skipped during code generation. You may need to implement custom logic for these nodes or find alternative approaches.` : ''}

## Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── nodes/          # Individual node implementations
│   ├── triggers/       # Trigger implementations
│   └── workflows/      # Workflow execution logic
├── config.js           # Configuration management
├── main.js            # Application entry point
├── package.json       # Dependencies and scripts
└── README.md          # This file
\`\`\`

## Attribution

This project uses the following n8n packages:
- n8n-core: Core n8n functionality
- n8n-workflow: Workflow parsing and execution
${Array.from(new Set(supportedNodes.map(node => node.packageName))).map(pkg => `- ${pkg}: Node implementations`).join('\n')}

## License

This generated project maintains compatibility with n8n's licensing terms. Please ensure compliance with all applicable licenses when using this code.

For more information about n8n, visit: https://n8n.io

## Support

This code was generated automatically. For issues with the generated code, please refer to the n8n documentation or community resources.`

  return {
    path: 'README.md',
    content,
    type: 'markdown'
  }
}

function generateEnvExample(mappedNodes: MappedNode[]): GeneratedFile {
  const credentialTypes = new Set<string>()
  mappedNodes.forEach(node => {
    node.credentialTypes.forEach(type => credentialTypes.add(type))
  })

  const content = `# Environment Variables Template
# Copy this file to .env and configure your actual values

# Execution Configuration
EXECUTION_TIMEOUT=300000
EXECUTION_RETRIES=3
EXECUTION_MODE=manual
LOG_LEVEL=info

# HTTP Configuration
HTTP_TIMEOUT=30000
HTTP_MAX_REDIRECTS=5

# Webhook Configuration (if using webhook triggers)
WEBHOOK_PORT=3000

# API Keys and Credentials
${Array.from(credentialTypes).map(type => `# ${type.toUpperCase()}_API_KEY=your_api_key_here`).join('\n')}

# Add other environment variables as needed`

  return {
    path: '.env.example',
    content,
    type: 'text'
  }
}

function generateGitignore(): GeneratedFile {
  const content = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.production

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db`

  return {
    path: '.gitignore',
    content,
    type: 'text'
  }
}

async function createZipFile(files: GeneratedFile[], projectName: string): Promise<Uint8Array> {
  // This is a simplified ZIP creation - in a real implementation,
  // you would use a proper ZIP library like JSZip
  
  // For now, we'll create a simple archive structure
  // In production, implement proper ZIP file creation
  
  const archive = {
    files: files.map(file => ({
      name: file.path,
      content: file.content,
      type: file.type
    })),
    metadata: {
      projectName,
      generatedAt: new Date().toISOString(),
      fileCount: files.length
    }
  }
  
  // Convert to buffer (simplified - use proper ZIP library in production)
  const jsonString = JSON.stringify(archive, null, 2)
  return new TextEncoder().encode(jsonString)
}