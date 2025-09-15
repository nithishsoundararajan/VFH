/**
 * Test data fixtures for E2E tests
 */

export const TEST_USERS = {
  primary: {
    email: `test-primary-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    fullName: 'Primary Test User'
  },
  secondary: {
    email: `test-secondary-${Date.now()}@example.com`,
    password: 'TestPassword456!',
    fullName: 'Secondary Test User'
  }
};

export const SAMPLE_WORKFLOWS = {
  simple: {
    name: 'Simple HTTP Workflow',
    nodes: [
      {
        id: 'webhook-1',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [100, 100],
        parameters: {
          path: '/test-webhook',
          httpMethod: 'POST'
        }
      },
      {
        id: 'http-1',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 1,
        position: [300, 100],
        parameters: {
          url: 'https://jsonplaceholder.typicode.com/posts',
          method: 'GET'
        }
      }
    ],
    connections: {
      'webhook-1': {
        main: [
          [
            {
              node: 'http-1',
              type: 'main',
              index: 0
            }
          ]
        ]
      }
    }
  },
  
  complex: {
    name: 'Complex Multi-Node Workflow',
    nodes: [
      {
        id: 'cron-1',
        name: 'Cron Trigger',
        type: 'n8n-nodes-base.cron',
        typeVersion: 1,
        position: [100, 100],
        parameters: {
          rule: {
            interval: [
              {
                field: 'cronExpression',
                expression: '0 9 * * 1-5'
              }
            ]
          }
        }
      },
      {
        id: 'http-1',
        name: 'Fetch Data',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 1,
        position: [300, 100],
        parameters: {
          url: 'https://api.github.com/repos/n8n-io/n8n/issues',
          method: 'GET'
        }
      },
      {
        id: 'set-1',
        name: 'Process Data',
        type: 'n8n-nodes-base.set',
        typeVersion: 1,
        position: [500, 100],
        parameters: {
          values: {
            string: [
              {
                name: 'processed_at',
                value: '={{new Date().toISOString()}}'
              }
            ]
          }
        }
      },
      {
        id: 'webhook-1',
        name: 'Send Notification',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [700, 100],
        parameters: {
          path: '/notification',
          httpMethod: 'POST'
        }
      }
    ],
    connections: {
      'cron-1': {
        main: [
          [
            {
              node: 'http-1',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'http-1': {
        main: [
          [
            {
              node: 'set-1',
              type: 'main',
              index: 0
            }
          ]
        ]
      },
      'set-1': {
        main: [
          [
            {
              node: 'webhook-1',
              type: 'main',
              index: 0
            }
          ]
        ]
      }
    }
  },

  malformed: {
    name: 'Malformed Workflow',
    nodes: [
      {
        id: 'invalid-node',
        name: 'Invalid Node',
        type: 'invalid-node-type',
        typeVersion: 1,
        position: [100, 100],
        parameters: {}
      }
    ],
    connections: {}
  }
};

export const TEST_CONFIGURATIONS = {
  basic: {
    outputDirectory: './output',
    environmentVariables: {
      NODE_ENV: 'production',
      API_KEY: 'test-api-key'
    }
  },
  
  advanced: {
    outputDirectory: './custom-output',
    environmentVariables: {
      NODE_ENV: 'development',
      API_KEY: 'dev-api-key',
      DATABASE_URL: 'postgresql://localhost:5432/test'
    },
    aiProvider: 'openai',
    aiApiKey: 'test-openai-key'
  }
};

export const PERFORMANCE_THRESHOLDS = {
  pageLoad: 3000, // 3 seconds
  workflowUpload: 5000, // 5 seconds
  codeGeneration: 30000, // 30 seconds
  fileDownload: 10000 // 10 seconds
};