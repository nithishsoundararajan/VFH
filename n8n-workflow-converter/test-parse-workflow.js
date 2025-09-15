// Simple test for parse-workflow function logic
// This simulates the core parsing logic without Supabase/Deno dependencies

// Mock n8n workflow data
const mockWorkflowData = {
  name: "Test Workflow",
  nodes: [
    {
      id: "1",
      name: "Start",
      type: "n8n-nodes-base.start",
      position: [250, 300],
      parameters: {}
    },
    {
      id: "2", 
      name: "HTTP Request",
      type: "n8n-nodes-base.httpRequest",
      position: [450, 300],
      parameters: {
        url: "https://api.example.com/data",
        method: "GET"
      },
      credentials: {
        httpBasicAuth: "test-credential"
      }
    },
    {
      id: "3",
      name: "Set Data",
      type: "n8n-nodes-base.set",
      position: [650, 300],
      parameters: {
        values: {
          string: [
            {
              name: "processed",
              value: "true"
            }
          ]
        }
      }
    }
  ],
  connections: {
    "Start": {
      "main": [
        [
          {
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Set Data", 
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}

// Test the parsing logic
function testWorkflowParsing() {
  console.log('🧪 Testing n8n Workflow Parsing Logic...\n')
  
  try {
    // Simulate the parsing logic from your function
    const workflowData = mockWorkflowData
    
    // Validate n8n workflow structure
    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      throw new Error('Invalid n8n workflow: missing or invalid nodes array')
    }
    
    // Extract metadata
    const nodes = workflowData.nodes || []
    const connections = workflowData.connections || {}
    const triggers = nodes.filter(node => 
      node.type?.includes('trigger') || node.type?.includes('Trigger')
    )
    
    const nodeTypes = [...new Set(nodes.map(node => node.type))]
    const hasCredentials = nodes.some(node => 
      node.credentials && Object.keys(node.credentials).length > 0
    )
    
    const metadata = {
      name: workflowData.name || 'Unnamed Workflow',
      nodeCount: nodes.length,
      triggerCount: triggers.length,
      connections: Object.keys(connections).length,
      nodeTypes,
      hasCredentials
    }
    
    // Sanitize workflow data (remove sensitive information)
    const sanitizedData = {
      ...workflowData,
      nodes: nodes.map(node => ({
        ...node,
        // Remove credential values but keep credential names for mapping
        credentials: node.credentials ? 
          Object.keys(node.credentials).reduce((acc, key) => {
            acc[key] = '[CREDENTIAL_PLACEHOLDER]'
            return acc
          }, {}) : undefined
      }))
    }
    
    // Display results
    console.log('✅ Workflow parsed successfully!')
    console.log('📊 Metadata:')
    console.log(`   Name: ${metadata.name}`)
    console.log(`   Nodes: ${metadata.nodeCount}`)
    console.log(`   Triggers: ${metadata.triggerCount}`)
    console.log(`   Connections: ${metadata.connections}`)
    console.log(`   Has Credentials: ${metadata.hasCredentials}`)
    console.log(`   Node Types: ${metadata.nodeTypes.join(', ')}`)
    
    console.log('\n🔒 Sanitized Data Sample:')
    console.log('   Original credential:', mockWorkflowData.nodes[1].credentials)
    console.log('   Sanitized credential:', sanitizedData.nodes[1].credentials)
    
    console.log('\n✨ Test completed successfully!')
    
    return {
      success: true,
      metadata,
      sanitizedData
    }
    
  } catch (error) {
    console.error('❌ Parsing failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// Run the test
testWorkflowParsing()