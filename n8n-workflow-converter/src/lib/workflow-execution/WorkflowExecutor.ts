/**
 * Configuration-Aware Workflow Executor
 * Executes workflows with exact n8n node configurations
 */

import { BaseNode } from '../base-classes/BaseNode.js';

export interface WorkflowExecutorConfig {
    nodes: Map<string, BaseNode>;
    connections: Record<string, any>;
    workflowName: string;
    executionMode: 'standalone' | 'debug';
}

export interface ExecutionResult {
    success: boolean;
    nodesExecuted: number;
    executionTime: number;
    successRate: string;
    results: Record<string, any>;
    errors: string[];
    message?: string;
    error?: string;
}

export class WorkflowExecutor {
    private config: WorkflowExecutorConfig;
    private executionId: string;
    private executionStartTime: number = 0;
    private nodeResults: Map<string, any> = new Map();
    private executionErrors: string[] = [];

    constructor(config: WorkflowExecutorConfig) {
        this.config = config;
        this.executionId = this.generateExecutionId();
    }

    /**
     * Execute the entire workflow
     */
    async execute(): Promise<ExecutionResult> {
        this.executionStartTime = Date.now();

        try {
            console.log(`🚀 Starting workflow execution: ${this.config.workflowName}`);
            console.log(`📋 Execution ID: ${this.executionId}`);

            // Calculate execution order
            const executionOrder = this.calculateExecutionOrder();
            console.log(`🔄 Execution order: ${executionOrder.join(' → ')}`);

            let successfulNodes = 0;

            // Execute nodes in order
            for (const nodeId of executionOrder) {
                try {
                    await this.executeNode(nodeId);
                    successfulNodes++;
                } catch (error) {
                    const errorMessage = `Node ${nodeId} failed: ${error.message}`;
                    this.executionErrors.push(errorMessage);
                    console.error(`❌ ${errorMessage}`);

                    // Continue execution for other nodes (non-blocking)
                    continue;
                }
            }

            const executionTime = Date.now() - this.executionStartTime;
            const successRate = executionOrder.length > 0
                ? `${Math.round((successfulNodes / executionOrder.length) * 100)}%`
                : '0%';

            console.log(`✅ Workflow execution completed`);
            console.log(`📊 Success rate: ${successRate} (${successfulNodes}/${executionOrder.length})`);

            return {
                success: this.executionErrors.length === 0,
                nodesExecuted: successfulNodes,
                executionTime,
                successRate,
                results: Object.fromEntries(this.nodeResults),
                errors: this.executionErrors,
                message: `Executed ${successfulNodes} nodes successfully`
            };

        } catch (error) {
            const executionTime = Date.now() - this.executionStartTime;

            return {
                success: false,
                nodesExecuted: 0,
                executionTime,
                successRate: '0%',
                results: {},
                errors: [error.message],
                error: error.message
            };
        }
    }

    /**
     * Execute a single node
     */
    private async executeNode(nodeId: string): Promise<void> {
        const node = this.config.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }

        console.log(`⚡ Executing node: ${node.nodeName} (${node.nodeType})`);

        // Get input data from connected nodes
        const inputData = this.getInputData(nodeId);

        // Prepare execution context
        const context = {
            workflow: {
                name: this.config.workflowName,
                executionId: this.executionId
            },
            executionId: this.executionId,
            nodeId: nodeId,
            mode: this.config.executionMode,
            getNodeOutput: (id: string) => this.nodeResults.get(id),
            setNodeOutput: (id: string, data: any) => this.nodeResults.set(id, data)
        };

        // Execute the node
        const startTime = Date.now();
        const result = await node.execute(inputData, context);
        const executionTime = Date.now() - startTime;

        // Store result
        this.nodeResults.set(nodeId, result);

        console.log(`✅ Node completed: ${node.nodeName} (${executionTime}ms)`);

        // Log result summary
        if (result && typeof result === 'object') {
            const resultSize = Array.isArray(result) ? result.length : Object.keys(result).length;
            console.log(`📤 Output: ${resultSize} items`);
        }
    }

    /**
     * Get input data for a node from its connections
     */
    private getInputData(nodeId: string): any {
        const connections = this.config.connections;
        const inputData: any[] = [];

        // Find nodes that connect to this node
        for (const [sourceNodeId, sourceConnections] of Object.entries(connections)) {
            if (sourceConnections && typeof sourceConnections === 'object') {
                for (const [outputType, connectionList] of Object.entries(sourceConnections)) {
                    if (Array.isArray(connectionList)) {
                        for (const connection of connectionList) {
                            if (connection.node === nodeId) {
                                const sourceResult = this.nodeResults.get(sourceNodeId);
                                if (sourceResult !== undefined) {
                                    inputData.push(sourceResult);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Return input data or empty object for trigger nodes
        if (inputData.length === 0) {
            return {}; // Trigger nodes start with empty data
        } else if (inputData.length === 1) {
            return inputData[0];
        } else {
            return inputData; // Multiple inputs
        }
    }

    /**
     * Calculate execution order using topological sort
     */
    private calculateExecutionOrder(): string[] {
        const nodes = Array.from(this.config.nodes.keys());
        const connections = this.config.connections;

        // Build dependency graph
        const graph = new Map<string, string[]>();
        const inDegree = new Map<string, number>();

        // Initialize
        nodes.forEach(nodeId => {
            graph.set(nodeId, []);
            inDegree.set(nodeId, 0);
        });

        // Build edges
        for (const [sourceNodeId, sourceConnections] of Object.entries(connections)) {
            if (sourceConnections && typeof sourceConnections === 'object') {
                for (const [outputType, connectionList] of Object.entries(sourceConnections)) {
                    if (Array.isArray(connectionList)) {
                        for (const connection of connectionList) {
                            const targetNodeId = connection.node;
                            if (graph.has(sourceNodeId) && graph.has(targetNodeId)) {
                                graph.get(sourceNodeId)!.push(targetNodeId);
                                inDegree.set(targetNodeId, inDegree.get(targetNodeId)! + 1);
                            }
                        }
                    }
                }
            }
        }

        // Topological sort (Kahn's algorithm)
        const queue: string[] = [];
        const result: string[] = [];

        // Find nodes with no incoming edges (triggers)
        inDegree.forEach((degree, nodeId) => {
            if (degree === 0) {
                queue.push(nodeId);
            }
        });

        while (queue.length > 0) {
            const currentNode = queue.shift()!;
            result.push(currentNode);

            // Process neighbors
            const neighbors = graph.get(currentNode) || [];
            for (const neighbor of neighbors) {
                const newDegree = inDegree.get(neighbor)! - 1;
                inDegree.set(neighbor, newDegree);

                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }

        // Check for cycles
        if (result.length !== nodes.length) {
            console.warn('⚠️ Circular dependency detected, using fallback order');
            return nodes; // Fallback to original order
        }

        return result;
    }

    /**
     * Generate unique execution ID
     */
    private generateExecutionId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `exec_${timestamp}_${random}`;
    }

    /**
     * Get execution statistics
     */
    public getExecutionStats(): {
        executionId: string;
        workflowName: string;
        totalNodes: number;
        executedNodes: number;
        failedNodes: number;
        executionTime: number;
        nodeResults: Record<string, any>;
    } {
        return {
            executionId: this.executionId,
            workflowName: this.config.workflowName,
            totalNodes: this.config.nodes.size,
            executedNodes: this.nodeResults.size,
            failedNodes: this.executionErrors.length,
            executionTime: this.executionStartTime ? Date.now() - this.executionStartTime : 0,
            nodeResults: Object.fromEntries(this.nodeResults)
        };
    }
}