/**
 * Node Mapper Tests
 * Comprehensive tests for the node mapping and transformation system
 */

import { NodeMapper } from '../node-mapper';
import { nodeRegistry } from '../node-registry';
import { WorkflowData } from '../node-mapper';

describe('NodeMapper', () => {
  let nodeMapper: NodeMapper;

  beforeEach(() => {
    nodeMapper = new NodeMapper();
  });

  describe('mapWorkflow', () => {
    it('should map a simple HTTP request workflow', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'webhook-1',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              path: '/test-webhook',
              httpMethod: 'POST',
              responseMode: 'onReceived'
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
              method: 'GET',
              headers: {
                'Authorization': 'Bearer {{ $env.API_TOKEN }}'
              }
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
        }
      };

      const result = nodeMapper.mapWorkflow(workflowData);

      expect(result.validation.valid).toBe(true);
      expect(result.nodes).toHaveLength(2);
      expect(result.metadata.totalNodes).toBe(2);
      expect(result.metadata.supportedNodes).toBe(2);
      expect(result.metadata.triggerNodes).toBe(1);
      expect(result.metadata.actionNodes).toBe(1);
    });

    it('should handle unsupported node types', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'unsupported-1',
            name: 'Unsupported Node',
            type: 'n8n-nodes-base.unsupportedNode',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        ],
        connections: {}
      };

      const result = nodeMapper.mapWorkflow(workflowData);

      expect(result.validation.valid).toBe(false);
      expect(result.validation.unsupportedNodes).toContain('n8n-nodes-base.unsupportedNode');
      expect(result.metadata.supportedNodes).toBe(0);
    });

    it('should transform parameters correctly', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'set-1',
            name: 'Set Values',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              operations: [
                {
                  name: 'field1',
                  value: '{{ $json.data }}',
                  type: 'set'
                }
              ],
              options: {
                dotNotation: true,
                keepOnlySet: false
              }
            }
          }
        ],
        connections: {}
      };

      const result = nodeMapper.mapWorkflow(workflowData);

      expect(result.validation.valid).toBe(true);
      expect(result.nodes[0].transformedParameters.parameters.operations).toBeDefined();
      expect(result.nodes[0].transformedParameters.parameters.options).toBeDefined();
    });

    it('should collect environment variables', () => {
      const workflowData: WorkflowData = {
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
                'Authorization': 'Bearer $env.API_TOKEN',
                'X-Custom': '$env.CUSTOM_HEADER'
              }
            }
          }
        ],
        connections: {}
      };

      const result = nodeMapper.mapWorkflow(workflowData, {
        environmentVariables: {}
      });

      expect(Object.keys(result.environmentVariables)).toContain('API_TOKEN');
      expect(Object.keys(result.environmentVariables)).toContain('CUSTOM_HEADER');
    });

    it('should generate dependencies correctly', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              url: 'https://api.example.com'
            }
          },
          {
            id: 'code-1',
            name: 'Code',
            type: 'n8n-nodes-base.code',
            typeVersion: 1,
            position: [300, 100],
            parameters: {
              jsCode: 'return { processed: true };'
            }
          }
        ],
        connections: {}
      };

      const result = nodeMapper.mapWorkflow(workflowData);

      expect(result.dependencies.dependencies['node-fetch']).toBeDefined();
      expect(result.dependencies.dependencies['vm2']).toBeDefined();
      expect(result.dependencies.dependencies['express']).toBeDefined();
      expect(result.dependencies.dependencies['dotenv']).toBeDefined();
    });
  });

  describe('generateNodeImplementations', () => {
    it('should generate code for mapped nodes', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              url: 'https://api.example.com',
              method: 'GET'
            }
          }
        ],
        connections: {}
      };

      const mappingResult = nodeMapper.mapWorkflow(workflowData);
      const implementations = nodeMapper.generateNodeImplementations(mappingResult.nodes);

      expect(Object.keys(implementations)).toHaveLength(1);
      const code = Object.values(implementations)[0];
      expect(code).toContain('class HttpRequestNode');
      expect(code).toContain('extends BaseActionNode');
      expect(code).toContain('this.url = \"https://api.example.com\"');
      expect(code).toContain('this.method = \"GET\"');
    });

    it('should include credential methods when credentials are present', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              url: 'https://api.example.com'
            },
            credentials: {
              httpBasicAuth: 'my-basic-auth'
            }
          }
        ],
        connections: {}
      };

      const mappingResult = nodeMapper.mapWorkflow(workflowData, {
        credentials: {
          'my-basic-auth': {
            user: 'testuser',
            password: 'testpass'
          }
        }
      });

      const implementations = nodeMapper.generateNodeImplementations(mappingResult.nodes);
      const code = Object.values(implementations)[0];
      
      expect(code).toContain('getBasicAuthCredential');
      expect(code).toContain('process.env.HTTP_BASIC_USERNAME');
      expect(code).toContain('process.env.HTTP_BASIC_PASSWORD');
    });
  });

  describe('getWorkflowMappingStats', () => {
    it('should calculate correct statistics', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'webhook-1',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [100, 100],
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
            id: 'unsupported-1',
            name: 'Unsupported',
            type: 'n8n-nodes-base.unsupported',
            typeVersion: 1,
            position: [500, 100],
            parameters: {}
          }
        ],
        connections: {}
      };

      const stats = nodeMapper.getWorkflowMappingStats(workflowData);

      expect(stats.totalNodes).toBe(3);
      expect(stats.supportedNodes).toBe(2);
      expect(stats.unsupportedNodes).toContain('n8n-nodes-base.unsupported');
      expect(stats.supportedPercentage).toBeCloseTo(66.67, 1);
    });
  });

  describe('isNodeTypeSupported', () => {
    it('should correctly identify supported node types', () => {
      expect(nodeMapper.isNodeTypeSupported('n8n-nodes-base.httpRequest')).toBe(true);
      expect(nodeMapper.isNodeTypeSupported('n8n-nodes-base.webhook')).toBe(true);
      expect(nodeMapper.isNodeTypeSupported('n8n-nodes-base.set')).toBe(true);
      expect(nodeMapper.isNodeTypeSupported('n8n-nodes-base.code')).toBe(true);
      expect(nodeMapper.isNodeTypeSupported('n8n-nodes-base.cron')).toBe(true);
    });

    it('should correctly identify unsupported node types', () => {
      expect(nodeMapper.isNodeTypeSupported('n8n-nodes-base.nonexistent')).toBe(false);
      expect(nodeMapper.isNodeTypeSupported('custom-node-type')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle invalid workflow data gracefully', () => {
      const invalidWorkflowData = {
        nodes: null,
        connections: {}
      } as any;

      expect(() => {
        nodeMapper.mapWorkflow(invalidWorkflowData);
      }).toThrow();
    });

    it('should handle missing node parameters', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {} // Missing required 'url' parameter
          }
        ],
        connections: {}
      };

      const result = nodeMapper.mapWorkflow(workflowData);

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.some(error => 
        error.includes('url') && error.includes('required')
      )).toBe(true);
    });

    it('should handle invalid parameter values', () => {
      const workflowData: WorkflowData = {
        nodes: [
          {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {
              url: 'invalid-url',
              timeout: 'not-a-number'
            }
          }
        ],
        connections: {}
      };

      const result = nodeMapper.mapWorkflow(workflowData);

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });
});