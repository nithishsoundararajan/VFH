/**
 * Workflow Parser Tests
 * Tests for workflow JSON parsing and validation functionality
 */

import { WorkflowParser } from '../workflow-parser';
import { WorkflowValidationError } from '../validation-errors';

describe('WorkflowParser', () => {
  let parser: WorkflowParser;

  beforeEach(() => {
    parser = new WorkflowParser();
  });

  describe('parseWorkflow', () => {
    it('should parse a valid n8n workflow JSON', () => {
      const validWorkflow = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'webhook-1',
            name: 'Webhook',
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
              url: 'https://api.example.com/data',
              method: 'GET'
            }
          }
        ],
        connections: {
          'webhook-1': {
            main: [
              {
                node: 'http-1',
                type: 'main',
                index: 0
              }
            ]
          }
        },
        active: true,
        settings: {},
        staticData: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(validWorkflow));

      expect(result.isValid).toBe(true);
      expect(result.workflow.name).toBe('Test Workflow');
      expect(result.workflow.nodes).toHaveLength(2);
      expect(result.workflow.connections).toBeDefined();
      expect(result.metadata.nodeCount).toBe(2);
      expect(result.metadata.triggerCount).toBe(1);
      expect(result.metadata.actionCount).toBe(1);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = '{ invalid json }';

      const result = parser.parseWorkflow(invalidJson);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid JSON format');
      expect(result.workflow).toBeNull();
    });

    it('should validate required workflow properties', () => {
      const incompleteWorkflow = {
        name: 'Test Workflow'
        // Missing nodes and connections
      };

      const result = parser.parseWorkflow(JSON.stringify(incompleteWorkflow));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required property: nodes');
      expect(result.errors).toContain('Missing required property: connections');
    });

    it('should validate node structure', () => {
      const workflowWithInvalidNode = {
        name: 'Test Workflow',
        nodes: [
          {
            // Missing required properties
            name: 'Invalid Node'
          }
        ],
        connections: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(workflowWithInvalidNode));

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Node validation failed'))).toBe(true);
    });

    it('should validate connection references', () => {
      const workflowWithInvalidConnections = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node-1',
            name: 'Node 1',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        ],
        connections: {
          'node-1': {
            main: [
              {
                node: 'non-existent-node', // Invalid reference
                type: 'main',
                index: 0
              }
            ]
          }
        }
      };

      const result = parser.parseWorkflow(JSON.stringify(workflowWithInvalidConnections));

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid connection reference'))).toBe(true);
    });

    it('should extract workflow metadata correctly', () => {
      const workflow = {
        name: 'Complex Workflow',
        nodes: [
          {
            id: 'cron-1',
            name: 'Cron Trigger',
            type: 'n8n-nodes-base.cron',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          },
          {
            id: 'webhook-1',
            name: 'Webhook Trigger',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [100, 200],
            parameters: {}
          },
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [300, 100],
            parameters: {}
          },
          {
            id: 'set-1',
            name: 'Set Values',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [500, 100],
            parameters: {}
          }
        ],
        connections: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(workflow));

      expect(result.metadata.nodeCount).toBe(4);
      expect(result.metadata.triggerCount).toBe(2);
      expect(result.metadata.actionCount).toBe(2);
      expect(result.metadata.nodeTypes).toEqual([
        'n8n-nodes-base.cron',
        'n8n-nodes-base.webhook',
        'n8n-nodes-base.httpRequest',
        'n8n-nodes-base.set'
      ]);
    });

    it('should detect circular dependencies', () => {
      const workflowWithCircularDeps = {
        name: 'Circular Workflow',
        nodes: [
          {
            id: 'node-1',
            name: 'Node 1',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          },
          {
            id: 'node-2',
            name: 'Node 2',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [300, 100],
            parameters: {}
          }
        ],
        connections: {
          'node-1': {
            main: [{ node: 'node-2', type: 'main', index: 0 }]
          },
          'node-2': {
            main: [{ node: 'node-1', type: 'main', index: 0 }]
          }
        }
      };

      const result = parser.parseWorkflow(JSON.stringify(workflowWithCircularDeps));

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Circular dependency detected'))).toBe(true);
    });

    it('should extract credentials information', () => {
      const workflowWithCredentials = {
        name: 'Workflow with Credentials',
        nodes: [
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {},
            credentials: {
              httpBasicAuth: 'my-basic-auth',
              httpHeaderAuth: 'my-header-auth'
            }
          }
        ],
        connections: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(workflowWithCredentials));

      expect(result.isValid).toBe(true);
      expect(result.metadata.credentialTypes).toEqual(['httpBasicAuth', 'httpHeaderAuth']);
      expect(result.metadata.requiresCredentials).toBe(true);
    });

    it('should handle empty workflows', () => {
      const emptyWorkflow = {
        name: 'Empty Workflow',
        nodes: [],
        connections: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(emptyWorkflow));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Workflow must contain at least one node');
    });

    it('should validate node type versions', () => {
      const workflowWithInvalidVersion = {
        name: 'Version Test',
        nodes: [
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 999, // Invalid version
            position: [100, 100],
            parameters: {}
          }
        ],
        connections: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(workflowWithInvalidVersion));

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Unsupported node type version'))).toBe(true);
    });
  });

  describe('validateNodeParameters', () => {
    it('should validate HTTP request node parameters', () => {
      const httpNode = {
        id: 'http-1',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 1,
        position: [100, 100],
        parameters: {
          url: 'https://api.example.com',
          method: 'GET',
          headers: {
            'Authorization': 'Bearer token'
          }
        }
      };

      const result = parser.validateNodeParameters(httpNode);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required parameters', () => {
      const httpNodeMissingUrl = {
        id: 'http-1',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 1,
        position: [100, 100],
        parameters: {
          method: 'GET'
          // Missing required 'url' parameter
        }
      };

      const result = parser.validateNodeParameters(httpNodeMissingUrl);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('url') && error.includes('required'))).toBe(true);
    });

    it('should validate parameter types', () => {
      const nodeWithInvalidTypes = {
        id: 'set-1',
        name: 'Set Values',
        type: 'n8n-nodes-base.set',
        typeVersion: 1,
        position: [100, 100],
        parameters: {
          operations: 'invalid-should-be-array'
        }
      };

      const result = parser.validateNodeParameters(nodeWithInvalidTypes);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('operations') && error.includes('array'))).toBe(true);
    });
  });

  describe('extractEnvironmentVariables', () => {
    it('should extract environment variables from node parameters', () => {
      const workflow = {
        name: 'Env Var Test',
        nodes: [
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              url: 'https://api.example.com',
              headers: {
                'Authorization': 'Bearer {{ $env.API_TOKEN }}',
                'X-Custom': '{{ $env.CUSTOM_HEADER }}'
              },
              body: {
                apiKey: '{{ $env.SECRET_KEY }}'
              }
            }
          }
        ],
        connections: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(workflow));
      const envVars = result.metadata.environmentVariables;

      expect(envVars).toContain('API_TOKEN');
      expect(envVars).toContain('CUSTOM_HEADER');
      expect(envVars).toContain('SECRET_KEY');
    });

    it('should handle different environment variable formats', () => {
      const workflow = {
        name: 'Env Format Test',
        nodes: [
          {
            id: 'test-1',
            name: 'Test Node',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              operations: [
                {
                  name: 'field1',
                  value: '$env.VAR1' // Without braces
                },
                {
                  name: 'field2',
                  value: '{{ $env.VAR2 }}' // With braces
                },
                {
                  name: 'field3',
                  value: 'prefix-{{ $env.VAR3 }}-suffix' // Mixed content
                }
              ]
            }
          }
        ],
        connections: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(workflow));
      const envVars = result.metadata.environmentVariables;

      expect(envVars).toContain('VAR1');
      expect(envVars).toContain('VAR2');
      expect(envVars).toContain('VAR3');
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"name": "test", "nodes": [}';

      expect(() => {
        parser.parseWorkflow(malformedJson);
      }).not.toThrow();

      const result = parser.parseWorkflow(malformedJson);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid JSON format');
    });

    it('should handle null or undefined input', () => {
      expect(() => {
        parser.parseWorkflow(null as any);
      }).not.toThrow();

      expect(() => {
        parser.parseWorkflow(undefined as any);
      }).not.toThrow();

      const nullResult = parser.parseWorkflow(null as any);
      expect(nullResult.isValid).toBe(false);

      const undefinedResult = parser.parseWorkflow(undefined as any);
      expect(undefinedResult.isValid).toBe(false);
    });

    it('should provide detailed error messages', () => {
      const invalidWorkflow = {
        name: 'Invalid Workflow',
        nodes: [
          {
            id: 'invalid-node',
            // Missing required properties
          }
        ],
        connections: {}
      };

      const result = parser.parseWorkflow(JSON.stringify(invalidWorkflow));

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.every(error => typeof error === 'string')).toBe(true);
    });
  });

  describe('performance', () => {
    it('should handle large workflows efficiently', () => {
      const largeWorkflow = {
        name: 'Large Workflow',
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node-${i}`,
          name: `Node ${i}`,
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [i * 100, 100],
          parameters: {}
        })),
        connections: {}
      };

      const startTime = Date.now();
      const result = parser.parseWorkflow(JSON.stringify(largeWorkflow));
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.metadata.nodeCount).toBe(100);
    });
  });
});