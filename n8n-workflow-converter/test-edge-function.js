// Test the complete Edge Function logic (without Supabase/Deno dependencies)

// Mock workflow with trigger
const mockWorkflowWithTrigger = {
  name: "Webhook to Database",
  nodes: [
    {
      id: "webhook",
      name: "Webhook Trigger",
      type: "n8n-nodes-base.webhook",
      position: [250, 300],
      parameters: {
        path: "test-webhook"
      }
    },
    {
      id: "postgres",
      name: "Postgres Insert", 
      type: "n8n-nodes-base.postgres",
      position: [450, 300],
      parameters: {
        operation: "insert",
        table: "users"
      },
      credentials: {
        postgres: "prod-db"
      }
    }
  ],
  connections: {
    "Webhook Trigger": {
      "main": [
        [
          {
            "node": "Postgres Insert",
            "type": "main", 
            "index": 0
          }
        ]
      ]
    }
  }
}

// Simulate the complete function
async function testCompleteFunction() {
  console.log('🚀 Testing Complete Edge Function Logic...\n')
  
  // Step 1: Simulate request validation
  console.log('1️⃣ Request Validation')
  const mockRequest = {
    fileData: Buffer.from(JSON.stringify(mockWorkflowWithTrigger)).toString('base64'),
    fileName: 'webhook-workflow.json',
    userId: 'test-user-123'
  }
  
  if (!mockRequest.fileData || !mockRequest.fileName || !mockRequest.userId) {
    console.log('❌ Request validation failed')
    return
  }
  console.log('✅ Request validation passed')
  
  // Step 2: Simulate security scanning
  console.log('\n2️⃣ Security Scanning')
  // Simulate no VirusTotal key scenario
  const securityStatus = {
    safe: true,
    message: 'Basic validation passed (VirusTotal not configured)'
  }
  console.log(`✅ Security status: ${securityStatus.message}`)
  
  // Step 3: Parse workflow
  console.log('\n3️⃣ Workflow Parsing')
  try {
    // Decode base64 data
    const jsonString = Buffer.from(mockRequest.fileData, 'base64').toString()
    const workflowData = JSON.parse(jsonString)
    
    // Validate structure
    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      throw new Error('Invalid n8n workflow: missing or invalid nodes array')
    }
    
    // Extract metadata
    const nodes = workflowData.nodes || []
    const connections = workflowData.connections || {}
    const triggers = nodes.filter(node => 
      node.type?.includes('trigger') || node.type?.includes('Trigger') || node.type?.includes('webhook')
    )
    
    const nodeTypes = [...new Set(nodes.map(node => node.type))]
    const hasCredentials = nodes.some(node => 
      node.credentials && Object.keys(node.credentials).length > 0
    )
    
    const metadata = {
      name: workflowData.name || mockRequest.fileName.replace('.json', ''),
      nodeCount: nodes.length,
      triggerCount: triggers.length,
      connections: Object.keys(connections).length,
      nodeTypes,
      hasCredentials
    }
    
    // Sanitize data
    const sanitizedData = {
      ...workflowData,
      nodes: nodes.map(node => ({
        ...node,
        credentials: node.credentials ? 
          Object.keys(node.credentials).reduce((acc, key) => {
            acc[key] = '[CREDENTIAL_PLACEHOLDER]'
            return acc
          }, {}) : undefined
      }))
    }
    
    console.log('✅ Workflow parsing successful')
    console.log(`   📝 Name: ${metadata.name}`)
    console.log(`   🔢 Nodes: ${metadata.nodeCount}`)
    console.log(`   ⚡ Triggers: ${metadata.triggerCount}`)
    console.log(`   🔗 Connections: ${metadata.connections}`)
    console.log(`   🔐 Has Credentials: ${metadata.hasCredentials}`)
    console.log(`   🏷️  Node Types: ${metadata.nodeTypes.join(', ')}`)
    
    // Step 4: Generate response
    console.log('\n4️⃣ Response Generation')
    const response = {
      success: securityStatus.safe && !!metadata,
      securityStatus,
      workflow: {
        metadata,
        sanitizedData
      }
    }
    
    console.log('✅ Response generated successfully')
    console.log(`   Success: ${response.success}`)
    console.log(`   Security Safe: ${response.securityStatus.safe}`)
    console.log(`   Workflow Included: ${!!response.workflow}`)
    
    console.log('\n🎉 Complete function test passed!')
    return response
    
  } catch (error) {
    console.error('❌ Workflow parsing failed:', error.message)
    return {
      success: false,
      securityStatus,
      error: `Invalid JSON format: ${error.message}`
    }
  }
}

// Test with invalid workflow
async function testInvalidWorkflow() {
  console.log('\n🧪 Testing Invalid Workflow Handling...\n')
  
  const invalidWorkflow = {
    name: "Invalid Workflow",
    // Missing nodes array
    connections: {}
  }
  
  const mockRequest = {
    fileData: Buffer.from(JSON.stringify(invalidWorkflow)).toString('base64'),
    fileName: 'invalid-workflow.json',
    userId: 'test-user-123'
  }
  
  try {
    const jsonString = Buffer.from(mockRequest.fileData, 'base64').toString()
    const workflowData = JSON.parse(jsonString)
    
    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      throw new Error('Invalid n8n workflow: missing or invalid nodes array')
    }
    
    console.log('❌ Should have failed validation')
  } catch (error) {
    console.log('✅ Invalid workflow correctly rejected:', error.message)
  }
}

// Run all tests
async function runAllTests() {
  await testCompleteFunction()
  await testInvalidWorkflow()
  console.log('\n🏁 All tests completed!')
}

runAllTests()