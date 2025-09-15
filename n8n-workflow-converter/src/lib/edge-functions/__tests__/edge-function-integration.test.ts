/**
 * Edge Function Integration Tests
 * Tests for Supabase Edge Function integrations
 */

import { EdgeFunctionService } from '../edge-function-service';

// Mock fetch for Edge Function calls
global.fetch = jest.fn();

describe('Edge Function Integration Tests', () => {
  let edgeFunctionService: EdgeFunctionService;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    edgeFunctionService = new EdgeFunctionService(
      'https://test.supabase.co',
      'test-anon-key'
    );
  });

  describe('Workflow Parsing Edge Function', () => {
    it('should parse workflow with security scanning', async () => {
      const mockWorkflowData = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            parameters: { url: 'https://api.example.com' }
          }
        ],
        connections: {}
      };

      const mockResponse = {
        success: true,
        data: {
          workflow: mockWorkflowData,
          security: {
            safe: true,
            scanId: 'scan-123',
            threats: []
          },
          metadata: {
            nodeCount: 1,
            triggerCount: 0,
            actionCount: 1
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await edgeFunctionService.parseWorkflow(
        JSON.stringify(mockWorkflowData),
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data.workflow.name).toBe('Test Workflow');
      expect(result.data.security.safe).toBe(true);
      expect(result.data.metadata.nodeCount).toBe(1);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/parse-workflow',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-anon-key',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            workflowJson: JSON.stringify(mockWorkflowData),
            userId: 'user-123'
          })
        })
      );
    });

    it('should handle malware detection', async () => {
      const maliciousWorkflow = {
        name: 'Malicious Workflow',
        nodes: [
          {
            id: 'node-1',
            name: 'Code Node',
            type: 'n8n-nodes-base.code',
            parameters: {
              jsCode: 'require("child_process").exec("rm -rf /")'
            }
          }
        ],
        connections: {}
      };

      const mockResponse = {
        success: false,
        error: 'Security threat detected',
        data: {
          security: {
            safe: false,
            scanId: 'scan-456',
            threats: ['malicious_code_execution']
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockResponse,
        status: 400,
        statusText: 'Bad Request'
      } as Response);

      const result = await edgeFunctionService.parseWorkflow(
        JSON.stringify(maliciousWorkflow),
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Security threat detected');
      expect(result.data.security.safe).toBe(false);
      expect(result.data.security.threats).toContain('malicious_code_execution');
    });

    it('should handle parsing errors gracefully', async () => {
      const invalidWorkflow = '{ invalid json }';

      const mockResponse = {
        success: false,
        error: 'Invalid JSON format'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockResponse,
        status: 400,
        statusText: 'Bad Request'
      } as Response);

      const result = await edgeFunctionService.parseWorkflow(invalidWorkflow, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await edgeFunctionService.parseWorkflow('{}', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('Node Mapping Edge Function', () => {
    it('should map workflow nodes successfully', async () => {
      const mockWorkflow = {
        nodes: [
          {
            id: 'http-1',
            type: 'n8n-nodes-base.httpRequest',
            parameters: { url: 'https://api.example.com' }
          },
          {
            id: 'set-1',
            type: 'n8n-nodes-base.set',
            parameters: { operations: [] }
          }
        ]
      };

      const mockResponse = {
        success: true,
        data: {
          mappedNodes: [
            {
              id: 'http-1',
              type: 'n8n-nodes-base.httpRequest',
              supported: true,
              implementation: 'HttpRequestNode',
              dependencies: ['node-fetch']
            },
            {
              id: 'set-1',
              type: 'n8n-nodes-base.set',
              supported: true,
              implementation: 'SetNode',
              dependencies: []
            }
          ],
          unsupportedNodes: [],
          dependencies: {
            'node-fetch': '^3.0.0',
            'dotenv': '^16.0.0'
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await edgeFunctionService.mapNodes(mockWorkflow, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data.mappedNodes).toHaveLength(2);
      expect(result.data.unsupportedNodes).toHaveLength(0);
      expect(result.data.dependencies).toHaveProperty('node-fetch');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/map-nodes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            workflow: mockWorkflow,
            userId: 'user-123'
          })
        })
      );
    });

    it('should handle unsupported node types', async () => {
      const mockWorkflow = {
        nodes: [
          {
            id: 'unsupported-1',
            type: 'n8n-nodes-base.unsupportedNode',
            parameters: {}
          }
        ]
      };

      const mockResponse = {
        success: true,
        data: {
          mappedNodes: [],
          unsupportedNodes: ['n8n-nodes-base.unsupportedNode'],
          dependencies: {}
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await edgeFunctionService.mapNodes(mockWorkflow, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data.mappedNodes).toHaveLength(0);
      expect(result.data.unsupportedNodes).toContain('n8n-nodes-base.unsupportedNode');
    });
  });

  describe('Code Generation Edge Function', () => {
    it('should generate Node.js project successfully', async () => {
      const mockMappedNodes = [
        {
          id: 'http-1',
          type: 'n8n-nodes-base.httpRequest',
          implementation: 'HttpRequestNode'
        }
      ];

      const mockResponse = {
        success: true,
        data: {
          projectId: 'project-123',
          files: [
            {
              path: 'src/nodes/HttpRequestNode.js',
              content: 'class HttpRequestNode extends BaseNode { ... }'
            },
            {
              path: 'package.json',
              content: '{ "name": "generated-workflow", ... }'
            },
            {
              path: 'main.js',
              content: 'const workflow = require("./src/workflow"); ...'
            }
          ],
          metadata: {
            totalFiles: 3,
            totalSize: 15000,
            generationTime: 2500
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await edgeFunctionService.generateCode(
        mockMappedNodes,
        { outputFormat: 'nodejs', includeTests: true },
        'user-123',
        'project-123'
      );

      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(3);
      expect(result.data.files.some(f => f.path === 'package.json')).toBe(true);
      expect(result.data.metadata.totalFiles).toBe(3);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/generate-code',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            mappedNodes: mockMappedNodes,
            options: { outputFormat: 'nodejs', includeTests: true },
            userId: 'user-123',
            projectId: 'project-123'
          })
        })
      );
    });

    it('should handle code generation errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Code generation failed: Invalid node configuration'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockResponse,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const result = await edgeFunctionService.generateCode([], {}, 'user-123', 'project-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Code generation failed');
    });

    it('should support different output formats', async () => {
      const mockResponse = {
        success: true,
        data: {
          projectId: 'project-123',
          files: [
            {
              path: 'src/workflow.ts',
              content: 'export class Workflow { ... }'
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await edgeFunctionService.generateCode(
        [],
        { outputFormat: 'typescript', includeTypes: true },
        'user-123',
        'project-123'
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            mappedNodes: [],
            options: { outputFormat: 'typescript', includeTypes: true },
            userId: 'user-123',
            projectId: 'project-123'
          })
        })
      );
    });
  });

  describe('Real-time Progress Updates', () => {
    it('should track progress during code generation', async () => {
      const progressUpdates: any[] = [];

      // Mock streaming response
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"progress": 25, "message": "Parsing nodes"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"progress": 50, "message": "Generating code"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"progress": 100, "message": "Complete"}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              })
          })
        }
      } as any;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await edgeFunctionService.generateCodeWithProgress(
        [],
        {},
        'user-123',
        'project-123',
        (update) => {
          progressUpdates.push(update);
        }
      );

      expect(progressUpdates).toHaveLength(3);
      expect(progressUpdates[0]).toEqual({ progress: 25, message: 'Parsing nodes' });
      expect(progressUpdates[1]).toEqual({ progress: 50, message: 'Generating code' });
      expect(progressUpdates[2]).toEqual({ progress: 100, message: 'Complete' });
    });
  });

  describe('AI Provider Integration', () => {
    it('should use custom AI provider for code generation', async () => {
      const mockResponse = {
        success: true,
        data: {
          projectId: 'project-123',
          files: [],
          aiProvider: 'openai',
          model: 'gpt-4'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await edgeFunctionService.generateCode(
        [],
        {
          aiProvider: 'openai',
          aiModel: 'gpt-4',
          aiApiKey: 'sk-test-key'
        },
        'user-123',
        'project-123'
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            mappedNodes: [],
            options: {
              aiProvider: 'openai',
              aiModel: 'gpt-4',
              aiApiKey: 'sk-test-key'
            },
            userId: 'user-123',
            projectId: 'project-123'
          })
        })
      );
    });

    it('should handle AI provider errors', async () => {
      const mockResponse = {
        success: false,
        error: 'AI provider authentication failed'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockResponse,
        status: 401,
        statusText: 'Unauthorized'
      } as Response);

      const result = await edgeFunctionService.generateCode(
        [],
        { aiProvider: 'openai', aiApiKey: 'invalid-key' },
        'user-123',
        'project-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI provider authentication failed');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should retry failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: {} }),
          status: 200,
          statusText: 'OK'
        } as Response);

      const result = await edgeFunctionService.parseWorkflow('{}', 'user-123');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle timeout errors', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });

      mockFetch.mockReturnValueOnce(timeoutPromise as any);

      const result = await edgeFunctionService.parseWorkflow('{}', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should validate response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
        status: 200,
        statusText: 'OK'
      } as Response);

      const result = await edgeFunctionService.parseWorkflow('{}', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large workflow files efficiently', async () => {
      const largeWorkflow = {
        name: 'Large Workflow',
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node-${i}`,
          type: 'n8n-nodes-base.set',
          parameters: {}
        })),
        connections: {}
      };

      const mockResponse = {
        success: true,
        data: {
          workflow: largeWorkflow,
          security: { safe: true },
          metadata: { nodeCount: 100 }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK'
      } as Response);

      const startTime = Date.now();
      const result = await edgeFunctionService.parseWorkflow(
        JSON.stringify(largeWorkflow),
        'user-123'
      );
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should compress large payloads', async () => {
      const largePayload = {
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `node-${i}`,
          data: 'x'.repeat(1000)
        }))
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
        status: 200,
        statusText: 'OK'
      } as Response);

      await edgeFunctionService.mapNodes(largePayload, 'user-123');

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const headers = lastCall[1]?.headers as Record<string, string>;

      // Should include compression header for large payloads
      expect(headers['Content-Encoding']).toBe('gzip');
    });
  });
});