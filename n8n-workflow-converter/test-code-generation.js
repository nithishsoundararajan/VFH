// Simple test script to trigger code generation for existing project
const projectId = 'e953efd6-83f5-43da-a869-9ae1dd63542f';

console.log('Testing code generation for project:', projectId);

// Simulate calling the projects API with a PUT request to trigger code generation
fetch('http://localhost:3000/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token' // This would be a real token in practice
  },
  body: JSON.stringify({
    name: 'Test Project',
    description: 'Test project for code generation',
    workflow_json: {
      name: 'Test Workflow',
      nodes: [
        {
          id: 'node1',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          parameters: {
            url: 'https://api.example.com/data',
            method: 'GET'
          }
        },
        {
          id: 'node2', 
          name: 'Set Data',
          type: 'n8n-nodes-base.set',
          parameters: {
            operations: [
              {
                operation: 'set',
                name: 'processedData',
                value: '{{ $json.data }}'
              }
            ]
          }
        }
      ],
      connections: {
        'node1': {
          'main': [
            {
              'node': 'node2',
              'type': 'main',
              'index': 0
            }
          ]
        }
      }
    },
    node_count: 2,
    trigger_count: 0,
    configuration: {
      projectName: 'Test Project',
      description: 'Test project',
      outputFormat: 'zip',
      includeDocumentation: true,
      includeTests: false,
      nodeVersion: '18',
      packageManager: 'npm',
      environmentVariables: []
    }
  })
})
.then(response => response.json())
.then(data => {
  console.log('Response:', data);
})
.catch(error => {
  console.error('Error:', error);
});