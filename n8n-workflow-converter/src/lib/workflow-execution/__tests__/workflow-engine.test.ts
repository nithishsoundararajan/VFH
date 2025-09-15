/**
 * Workflow Engine Tests
 * Tests for the workflow execution engine
 */

import { WorkflowExecutionEngine, WorkflowData, ExecutionConfig } from '../workflow-engine';
import { BaseActionNode, NodeInputData } from '../base-node';

// Mock node for testing
class MockNode extends BaseActionNode {
  private shouldFail: boolean;
  private delay: number;

  constructor(shouldFail = false, delay = 0) {
    super('MockNode', 'Mock Node', 'A mock node for testing');
    this.shouldFail = shouldFail;
    this.delay = delay;
  }

  async execute(inputData: NodeInputData[]): Promise<any> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      throw new Error('Mock node failure');
    }

    const processedData = this.processInputData(inputData);
    return {
      success: true,
      data: processedData,
      timestamp: new Date().toISOString()
    };
  }
}

describe('WorkflowExecutionEngine', () => {
  let mockWorkflow: WorkflowData;
  let mockConfig: ExecutionConfig;

  beforeEach(() => {
    mockWorkflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      active: true,
      nodes: [
        {
          id: 'node1',
          name: 'Start Node',
          type: 'MockNode',
          parameters: {},
          position: [0, 0]
        },
        {
          id: 'node2',
          name: 'Process Node',
          type: 'MockNode',
          parameters: {},
          position: [200, 0]
        },
        {
          id: 'node3',
          name: 'End Node',
          type: 'MockNode',
          parameters: {},
          position: [400, 0]
        }
      ],
      connections: {
        node2: {
          main: [
            {
              node: 'node1',
              type: 'main',
              index: 0
            }
          ]
        },
        node3: {
          main: [
            {
              node: 'node2',
              type: 'main',
              index: 0
            }
          ]
        }
      }
    };

    mockConfig = {
      timeout: 30000,
      retries: 3,
      continueOnFailure: false,
      logging: {
        level: 'info',
        format: 'json'
      },
      credentials: {},
      nodes: {}
    };
  });

  describe('Execution Order Calculation', () => {
    it('should calculate correct execution order for linear workflow', () => {
      const engine = new WorkflowExecutionEngine(mockWorkflow, mockConfig);
      
      // Register mock nodes
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode());
      engine.registerNode('node3', new MockNode());

      // Access private method for testing (in real implementation, this would be tested through execute)
      const executionOrder = (engine as any).calculateExecutionOrder();
      
      expect(executionOrder).toEqual(['node1', 'node2', 'node3']);
    });

    it('should handle parallel branches correctly', () => {
      const parallelWorkflow: WorkflowData = {
        ...mockWorkflow,
        nodes: [
          { id: 'start', name: 'Start', type: 'MockNode', parameters: {}, position: [0, 0] },
          { id: 'branch1', name: 'Branch 1', type: 'MockNode', parameters: {}, position: [200, -100] },
          { id: 'branch2', name: 'Branch 2', type: 'MockNode', parameters: {}, position: [200, 100] },
          { id: 'merge', name: 'Merge', type: 'MockNode', parameters: {}, position: [400, 0] }
        ],
        connections: {
          branch1: {
            main: [{ node: 'start', type: 'main', index: 0 }]
          },
          branch2: {
            main: [{ node: 'start', type: 'main', index: 0 }]
          },
          merge: {
            main: [
              { node: 'branch1', type: 'main', index: 0 },
              { node: 'branch2', type: 'main', index: 0 }
            ]
          }
        }
      };

      const engine = new WorkflowExecutionEngine(parallelWorkflow, mockConfig);
      const executionOrder = (engine as any).calculateExecutionOrder();
      
      expect(executionOrder[0]).toBe('start');
      expect(executionOrder.slice(1, 3)).toEqual(expect.arrayContaining(['branch1', 'branch2']));
      expect(executionOrder[3]).toBe('merge');
    });

    it('should detect circular dependencies', () => {
      const circularWorkflow: WorkflowData = {
        ...mockWorkflow,
        connections: {
          node2: {
            main: [{ node: 'node1', type: 'main', index: 0 }]
          },
          node1: {
            main: [{ node: 'node2', type: 'main', index: 0 }]
          }
        }
      };

      const engine = new WorkflowExecutionEngine(circularWorkflow, mockConfig);
      const executionOrder = (engine as any).calculateExecutionOrder();
      
      // Should fallback to original node order when circular dependency detected
      expect(executionOrder).toEqual(['node1', 'node2', 'node3']);
    });
  });

  describe('Workflow Execution', () => {
    it('should execute a simple linear workflow successfully', async () => {
      const engine = new WorkflowExecutionEngine(mockWorkflow, mockConfig);
      
      // Register mock nodes
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode());
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.results).toHaveProperty('node1');
      expect(result.results).toHaveProperty('node2');
      expect(result.results).toHaveProperty('node3');
      expect(result.summary.nodesExecuted).toBe(3);
      expect(result.summary.nodesSucceeded).toBe(3);
      expect(result.summary.nodesFailed).toBe(0);
    });

    it('should handle node failures with continueOnFailure=false', async () => {
      const engine = new WorkflowExecutionEngine(mockWorkflow, mockConfig);
      
      // Register nodes with one failing node
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode(true)); // This node will fail
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Mock node failure');
      expect(result.results).toHaveProperty('node1');
      expect(result.results).toHaveProperty('node2');
      expect(result.results.node2.success).toBe(false);
    });

    it('should continue execution with continueOnFailure=true', async () => {
      const configWithContinue = { ...mockConfig, continueOnFailure: true };
      const engine = new WorkflowExecutionEngine(mockWorkflow, configWithContinue);
      
      // Register nodes with one failing node
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode(true)); // This node will fail
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.success).toBe(true); // Overall execution succeeds
      expect(result.results).toHaveProperty('node1');
      expect(result.results).toHaveProperty('node2');
      expect(result.results).toHaveProperty('node3');
      expect(result.results.node2.success).toBe(false);
      expect(result.results.node3.success).toBe(true); // node3 still executes
      expect(result.summary.nodesFailed).toBe(1);
      expect(result.summary.nodesSucceeded).toBe(2);
    });

    it('should handle execution timeout', async () => {
      const shortTimeoutConfig = { ...mockConfig, timeout: 100 };
      const engine = new WorkflowExecutionEngine(mockWorkflow, shortTimeoutConfig);
      
      // Register nodes with one slow node
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode(false, 200)); // This node will timeout
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should retry failed operations', async () => {
      const retryConfig = { ...mockConfig, retries: 2 };
      const engine = new WorkflowExecutionEngine(mockWorkflow, retryConfig);
      
      let attemptCount = 0;
      class RetryMockNode extends MockNode {
        async execute(inputData: NodeInputData[]): Promise<any> {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Temporary failure');
          }
          return super.execute(inputData);
        }
      }
      
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new RetryMockNode());
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2); // Should have retried once
      expect(result.results.node2.success).toBe(true);
    });

    it('should skip disabled nodes', async () => {
      const workflowWithDisabled = {
        ...mockWorkflow,
        nodes: mockWorkflow.nodes.map(node => 
          node.id === 'node2' ? { ...node, disabled: true } : node
        )
      };

      const engine = new WorkflowExecutionEngine(workflowWithDisabled, mockConfig);
      
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode());
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.results).toHaveProperty('node1');
      expect(result.results).not.toHaveProperty('node2'); // Disabled node not executed
      expect(result.results).toHaveProperty('node3');
      expect(result.summary.nodesSkipped).toBe(1);
    });
  });

  describe('Data Flow', () => {
    it('should pass data between connected nodes', async () => {
      class DataPassingNode extends BaseActionNode {
        constructor(private outputData: any) {
          super('DataNode', 'Data Node');
        }

        async execute(inputData: NodeInputData[]): Promise<any> {
          const processedData = this.processInputData(inputData);
          return {
            success: true,
            data: this.outputData,
            inputReceived: processedData
          };
        }
      }

      const engine = new WorkflowExecutionEngine(mockWorkflow, mockConfig);
      
      engine.registerNode('node1', new DataPassingNode({ message: 'Hello from node1' }));
      engine.registerNode('node2', new DataPassingNode({ message: 'Hello from node2' }));
      engine.registerNode('node3', new DataPassingNode({ message: 'Hello from node3' }));

      const result = await engine.execute();

      expect(result.success).toBe(true);
      
      // node1 should have no input (trigger node)
      expect(result.results.node1.inputReceived).toEqual([{}]);
      
      // node2 should receive data from node1
      expect(result.results.node2.inputReceived[0].data).toEqual({
        success: true,
        data: { message: 'Hello from node1' },
        inputReceived: [{}]
      });
      
      // node3 should receive data from node2
      expect(result.results.node3.inputReceived[0].data).toEqual({
        success: true,
        data: { message: 'Hello from node2' },
        inputReceived: expect.any(Array)
      });
    });
  });

  describe('Logging and Metrics', () => {
    it('should generate execution logs', async () => {
      const engine = new WorkflowExecutionEngine(mockWorkflow, mockConfig);
      
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode());
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.logs).toBeDefined();
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs.some(log => log.message.includes('Starting workflow execution'))).toBe(true);
      expect(result.logs.some(log => log.message.includes('completed'))).toBe(true);
    });

    it('should track node execution times', async () => {
      const engine = new WorkflowExecutionEngine(mockWorkflow, mockConfig);
      
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode());
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.nodeExecutionTimes).toBeDefined();
      expect(result.nodeExecutionTimes.node1).toBeGreaterThanOrEqual(0);
      expect(result.nodeExecutionTimes.node2).toBeGreaterThanOrEqual(0);
      expect(result.nodeExecutionTimes.node3).toBeGreaterThanOrEqual(0);
    });

    it('should generate execution summary', async () => {
      const engine = new WorkflowExecutionEngine(mockWorkflow, mockConfig);
      
      engine.registerNode('node1', new MockNode());
      engine.registerNode('node2', new MockNode(true)); // Failing node
      engine.registerNode('node3', new MockNode());

      const result = await engine.execute();

      expect(result.summary).toBeDefined();
      expect(result.summary.executionId).toBe(result.executionId);
      expect(result.summary.nodesExecuted).toBe(2); // Only node1 and node2 execute before failure
      expect(result.summary.nodesFailed).toBe(1);
      expect(result.summary.errorCount).toBeGreaterThan(0);
    });
  });
});