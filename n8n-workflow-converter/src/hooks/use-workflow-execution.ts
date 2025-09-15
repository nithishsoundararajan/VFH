/**
 * Workflow Execution Hook
 * React hook for managing workflow executions with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { workflowExecutionService, ExecutionRequest, ExecutionStatus } from '@/lib/workflow-execution/execution-service';
import { useUser } from './use-user';

export interface UseWorkflowExecutionOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useWorkflowExecution(options: UseWorkflowExecutionOptions = {}) {
  const { user } = useUser();
  const [executions, setExecutions] = useState<ExecutionStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { autoRefresh = false, refreshInterval = 5000 } = options;

  /**
   * Start a new workflow execution
   */
  const startExecution = useCallback(async (request: Omit<ExecutionRequest, 'userId'>): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      const executionId = await workflowExecutionService.startExecution({
        ...request,
        userId: user.id
      });

      // Refresh executions list
      await loadExecutions();

      return executionId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start execution';
      setError(errorMessage);
      throw err;
    }
  }, [user]);

  /**
   * Cancel a running execution
   */
  const cancelExecution = useCallback(async (executionId: string): Promise<void> => {
    try {
      setError(null);
      await workflowExecutionService.cancelExecution(executionId);
      await loadExecutions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel execution';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Get execution status
   */
  const getExecutionStatus = useCallback(async (executionId: string): Promise<ExecutionStatus | null> => {
    try {
      setError(null);
      return await workflowExecutionService.getExecutionStatus(executionId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get execution status';
      setError(errorMessage);
      return null;
    }
  }, []);

  /**
   * Get execution logs
   */
  const getExecutionLogs = useCallback(async (executionId: string): Promise<any[]> => {
    try {
      setError(null);
      return await workflowExecutionService.getExecutionLogs(executionId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get execution logs';
      setError(errorMessage);
      return [];
    }
  }, []);

  /**
   * Load user's executions
   */
  const loadExecutions = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // This would be implemented as an API call to get user's executions
      // For now, we'll use a placeholder
      const userExecutions: ExecutionStatus[] = [];
      setExecutions(userExecutions);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load executions';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Subscribe to execution updates
   */
  const subscribeToExecution = useCallback((
    executionId: string,
    callback: (status: ExecutionStatus) => void
  ) => {
    return workflowExecutionService.subscribeToExecution(executionId, callback);
  }, []);

  // Load executions on mount and user change
  useEffect(() => {
    if (user) {
      loadExecutions();
    }
  }, [user, loadExecutions]);

  // Auto-refresh executions
  useEffect(() => {
    if (!autoRefresh || !user) return;

    const interval = setInterval(() => {
      loadExecutions();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, user, loadExecutions]);

  return {
    executions,
    loading,
    error,
    startExecution,
    cancelExecution,
    getExecutionStatus,
    getExecutionLogs,
    loadExecutions,
    subscribeToExecution,
  };
}

/**
 * Hook for managing a single execution with real-time updates
 */
export function useSingleExecution(executionId: string | null) {
  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getExecutionStatus, getExecutionLogs, subscribeToExecution } = useWorkflowExecution();

  // Load execution data
  const loadExecution = useCallback(async () => {
    if (!executionId) return;

    try {
      setLoading(true);
      setError(null);

      const [status, executionLogs] = await Promise.all([
        getExecutionStatus(executionId),
        getExecutionLogs(executionId)
      ]);

      setExecution(status);
      setLogs(executionLogs);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load execution';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [executionId, getExecutionStatus, getExecutionLogs]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!executionId) return;

    const subscription = subscribeToExecution(executionId, (status) => {
      setExecution(status);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [executionId, subscribeToExecution]);

  // Load execution on mount and ID change
  useEffect(() => {
    if (executionId) {
      loadExecution();
    } else {
      setExecution(null);
      setLogs([]);
    }
  }, [executionId, loadExecution]);

  return {
    execution,
    logs,
    loading,
    error,
    reload: loadExecution,
  };
}