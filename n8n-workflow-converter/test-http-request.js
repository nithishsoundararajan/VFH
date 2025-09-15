// Test HTTP request format for the Edge Function
// This simulates how the frontend would call your function

const mockWorkflow = {
  name: "Email Automation",
  nodes: [
    {
      id: "trigger",
      name: "Schedule Trigger",
      type: "n8n-nodes-base.scheduleTrigger",
      position: [250, 300],
      parameters: {
        rule: {
          interval: [
            {
              field: "hours",
              value: 24
            }
          ]
        }
      }
    },
    {
      id: "email",
      name: "Send Email",
      type: "n8n-nodes-base.emailSend",
      position: [450, 300],
      parameters: {
        subject: "Daily Report",
        text: "Your daily report is ready"
      },
      credentials: {
        smtp: "email-server"
      }
    }
  ],
  connections: {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "Send Email",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}

// Simulate the HTTP request that would be sent to your Edge Function
function createMockHttpRequest() {
  const fileData = Buffer.from(JSON.stringify(mockWorkflow)).toString('base64')
  
  const requestBody = {
    fileData: fileData,
    fileName: 'email-automation.json',
    userId: 'user-456'
  }
  
  const headers = {
    'Authorization': 'Bearer mock-jwt-token',
    'Content-Type': 'application/json'
  }
  
  return {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  }
}

// Simulate processing the request
function simulateEdgeFunctionRequest() {
  console.log('📡 Testing HTTP Request Format...\n')
  
  const mockRequest = createMockHttpRequest()
  
  console.log('📤 Request Details:')
  console.log(`   Method: ${mockRequest.method}`)
  console.log(`   Headers: ${JSON.stringify(mockRequest.headers, null, 2)}`)
  console.log(`   Body Size: ${mockRequest.body.length} bytes`)
  
  // Parse the request body (like your Edge Function would)
  const requestData = JSON.parse(mockRequest.body)
  
  console.log('\n📥 Parsed Request Data:')
  console.log(`   File Name: ${requestData.fileName}`)
  console.log(`   User ID: ${requestData.userId}`)
  console.log(`   File Data Length: ${requestData.fileData.length} characters`)
  
  // Decode and validate the workflow data
  const decodedWorkflow = JSON.parse(Buffer.from(requestData.fileData, 'base64').toString())
  
  console.log('\n🔍 Decoded Workflow:')
  console.log(`   Name: ${decodedWorkflow.name}`)
  console.log(`   Nodes: ${decodedWorkflow.nodes.length}`)
  console.log(`   Node Types: ${decodedWorkflow.nodes.map(n => n.type).join(', ')}`)
  
  // Simulate successful response
  const response = {
    success: true,
    securityStatus: {
      safe: true,
      message: 'File passed security scan'
    },
    workflow: {
      metadata: {
        name: decodedWorkflow.name,
        nodeCount: decodedWorkflow.nodes.length,
        triggerCount: decodedWorkflow.nodes.filter(n => n.type.includes('trigger')).length,
        connections: Object.keys(decodedWorkflow.connections).length,
        nodeTypes: [...new Set(decodedWorkflow.nodes.map(n => n.type))],
        hasCredentials: decodedWorkflow.nodes.some(n => n.credentials)
      },
      sanitizedData: {
        ...decodedWorkflow,
        nodes: decodedWorkflow.nodes.map(node => ({
          ...node,
          credentials: node.credentials ? 
            Object.keys(node.credentials).reduce((acc, key) => {
              acc[key] = '[CREDENTIAL_PLACEHOLDER]'
              return acc
            }, {}) : undefined
        }))
      }
    }
  }
  
  console.log('\n📤 Response:')
  console.log(`   Success: ${response.success}`)
  console.log(`   Security Safe: ${response.securityStatus.safe}`)
  console.log(`   Metadata: ${JSON.stringify(response.workflow.metadata, null, 2)}`)
  
  console.log('\n✅ HTTP request simulation completed successfully!')
  
  return response
}

// Test CORS preflight request
function testCorsRequest() {
  console.log('\n🌐 Testing CORS Preflight Request...\n')
  
  const corsRequest = {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, content-type'
    }
  }
  
  console.log('📤 CORS Preflight Request:')
  console.log(`   Method: ${corsRequest.method}`)
  console.log(`   Headers: ${JSON.stringify(corsRequest.headers, null, 2)}`)
  
  // Simulate CORS response
  const corsResponse = {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: 'ok'
  }
  
  console.log('\n📥 CORS Response:')
  console.log(`   Status: ${corsResponse.status}`)
  console.log(`   Headers: ${JSON.stringify(corsResponse.headers, null, 2)}`)
  console.log(`   Body: ${corsResponse.body}`)
  
  console.log('\n✅ CORS test completed!')
}

// Run all HTTP tests
function runHttpTests() {
  simulateEdgeFunctionRequest()
  testCorsRequest()
  console.log('\n🎯 All HTTP tests completed successfully!')
}

runHttpTests()