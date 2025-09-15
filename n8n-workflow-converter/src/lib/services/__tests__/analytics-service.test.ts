import { AnalyticsService } from '../analytics-service';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn().mockResolvedValue({ data: null, error: null })
    }))
  })),
  rpc: jest.fn().mockResolvedValue({ data: 42, error: null })
} as any;

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'test-user-agent'
  },
  writable: true
});

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } }
    });
    analyticsService = new AnalyticsService(mockSupabase, true);
  });

  describe('constructor', () => {
    it('should initialize with analytics enabled', () => {
      expect(analyticsService.isEnabled).toBe(true);
    });

    it('should generate a session ID', () => {
      const sessionId = analyticsService.getSessionId();
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should initialize with analytics disabled', () => {
      const disabledService = new AnalyticsService(mockSupabase, false);
      expect(disabledService.isEnabled).toBe(false);
    });
  });

  describe('trackEvent', () => {
    it('should track analytics events when enabled', async () => {
      const event = {
        eventType: 'test_event',
        eventData: { key: 'value' }
      };

      await analyticsService.trackEvent(event);

      expect(mockSupabase.from).toHaveBeenCalledWith('user_analytics');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        session_id: expect.stringMatching(/^session_\d+_[a-z0-9]+$/),
        event_type: 'test_event',
        event_data: { key: 'value' },
        user_agent: 'test-user-agent',
        ip_address: null
      });
    });

    it('should not track events when disabled', async () => {
      analyticsService.setEnabled(false);
      
      const event = {
        eventType: 'test_event',
        eventData: { key: 'value' }
      };

      await analyticsService.trackEvent(event);

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should not track events when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });

      const event = {
        eventType: 'test_event',
        eventData: { key: 'value' }
      };

      await analyticsService.trackEvent(event);

      expect(mockSupabase.from().insert).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.from().insert.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const event = {
        eventType: 'test_event',
        eventData: { key: 'value' }
      };

      await analyticsService.trackEvent(event);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to track analytics event:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('trackNodeUsage', () => {
    it('should track node usage analytics', async () => {
      const nodeUsageData = {
        projectId: 'project-123',
        nodeType: 'HttpRequest',
        nodeCount: 2,
        complexityScore: 10,
        executionTimeMs: 1500,
        successRate: 95.5,
        errorCount: 1
      };

      await analyticsService.trackNodeUsage(nodeUsageData);

      expect(mockSupabase.from).toHaveBeenCalledWith('node_usage_analytics');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        project_id: 'project-123',
        user_id: 'test-user-id',
        node_type: 'HttpRequest',
        node_count: 2,
        complexity_score: 10,
        execution_time_ms: 1500,
        success_rate: 95.5,
        error_count: 1
      });
    });

    it('should use default values for optional fields', async () => {
      const nodeUsageData = {
        projectId: 'project-123',
        nodeType: 'HttpRequest',
        nodeCount: 1
      };

      await analyticsService.trackNodeUsage(nodeUsageData);

      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        project_id: 'project-123',
        user_id: 'test-user-id',
        node_type: 'HttpRequest',
        node_count: 1,
        complexity_score: 0,
        execution_time_ms: null,
        success_rate: 100,
        error_count: 0
      });
    });
  });

  describe('trackFeatureUsage', () => {
    it('should create new feature usage record', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found
      });

      const featureUsageData = {
        featureName: 'workflow_upload',
        usageCount: 1,
        sessionDurationMs: 5000,
        successCount: 1,
        errorCount: 0
      };

      await analyticsService.trackFeatureUsage(featureUsageData);

      expect(mockSupabase.from).toHaveBeenCalledWith('feature_usage_analytics');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        feature_name: 'workflow_upload',
        usage_count: 1,
        session_duration_ms: 5000,
        success_count: 1,
        error_count: 0
      });
    });

    it('should update existing feature usage record', async () => {
      const existingRecord = {
        id: 'existing-id',
        usage_count: 5,
        success_count: 4,
        error_count: 1,
        session_duration_ms: 10000
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: existingRecord,
        error: null
      });

      const featureUsageData = {
        featureName: 'workflow_upload',
        usageCount: 2,
        successCount: 1,
        errorCount: 0
      };

      await analyticsService.trackFeatureUsage(featureUsageData);

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        usage_count: 7, // 5 + 2
        success_count: 5, // 4 + 1
        error_count: 1, // 1 + 0
        session_duration_ms: 10000,
        last_used_at: expect.any(String)
      });
    });
  });

  describe('trackPerformanceMetric', () => {
    it('should track performance metrics', async () => {
      const performanceData = {
        projectId: 'project-123',
        metricType: 'generation_time',
        metricValue: 2500,
        metricUnit: 'ms',
        contextData: { nodeCount: 5, complexity: 15 }
      };

      await analyticsService.trackPerformanceMetric(performanceData);

      expect(mockSupabase.from).toHaveBeenCalledWith('performance_metrics');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        project_id: 'project-123',
        user_id: 'test-user-id',
        metric_type: 'generation_time',
        metric_value: 2500,
        metric_unit: 'ms',
        context_data: { nodeCount: 5, complexity: 15 }
      });
    });
  });

  describe('trackWorkflowComplexity', () => {
    it('should track workflow complexity analytics', async () => {
      const complexityData = {
        projectId: 'project-123',
        totalNodes: 10,
        totalConnections: 15,
        maxDepth: 5,
        branchingFactor: 1.5,
        cyclicComplexity: 2,
        uniqueNodeTypes: 6,
        triggerTypes: ['cron', 'webhook'],
        estimatedExecutionTimeMs: 3000,
        memoryEstimateMb: 128
      };

      await analyticsService.trackWorkflowComplexity(complexityData);

      expect(mockSupabase.from).toHaveBeenCalledWith('workflow_complexity_analytics');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        project_id: 'project-123',
        user_id: 'test-user-id',
        total_nodes: 10,
        total_connections: 15,
        max_depth: 5,
        branching_factor: 1.5,
        cyclic_complexity: 2,
        unique_node_types: 6,
        trigger_types: ['cron', 'webhook'],
        estimated_execution_time_ms: 3000,
        memory_estimate_mb: 128
      });
    });
  });

  describe('trackProjectGeneration', () => {
    it('should track comprehensive project generation metrics', async () => {
      const projectId = 'project-123';
      const generationTimeMs = 5000;
      const fileSizeBytes = 1024000;
      const nodeTypes = ['HttpRequest', 'Set', 'If'];
      const complexityScore = 25;
      const additionalMetrics = {
        memoryUsageMb: 64,
        cpuUsagePercent: 45.5,
        apiCallsCount: 3,
        errorRate: 0
      };

      await analyticsService.trackProjectGeneration(
        projectId,
        generationTimeMs,
        fileSizeBytes,
        nodeTypes,
        complexityScore,
        additionalMetrics
      );

      // Should track in project_analytics
      expect(mockSupabase.from).toHaveBeenCalledWith('project_analytics');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        project_id: projectId,
        generation_time_ms: generationTimeMs,
        file_size_bytes: fileSizeBytes,
        node_types: nodeTypes,
        complexity_score: complexityScore,
        memory_usage_mb: 64,
        cpu_usage_percent: 45.5,
        api_calls_count: 3,
        error_rate: 0
      });

      // Should track performance metrics
      expect(mockSupabase.from).toHaveBeenCalledWith('performance_metrics');

      // Should track node usage for each node type
      expect(mockSupabase.from).toHaveBeenCalledWith('node_usage_analytics');

      // Should track completion event
      expect(mockSupabase.from).toHaveBeenCalledWith('user_analytics');
    });
  });

  describe('getUserAnalyticsSummary', () => {
    it('should get user analytics summary', async () => {
      const mockSummary = {
        total_projects: 5,
        total_downloads: 3,
        avg_generation_time_ms: 3500,
        most_used_node_type: 'HttpRequest',
        total_sessions: 10,
        last_activity: '2023-12-01T10:00:00Z'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [mockSummary],
        error: null
      });

      const result = await analyticsService.getUserAnalyticsSummary();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_analytics_summary', {
        user_uuid: 'test-user-id'
      });
      expect(result).toEqual(mockSummary);
    });

    it('should return null when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });

      const result = await analyticsService.getUserAnalyticsSummary();

      expect(result).toBeNull();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('calculateWorkflowComplexity', () => {
    it('should calculate workflow complexity', async () => {
      const workflowJson = {
        nodes: [
          { type: 'HttpRequest' },
          { type: 'Set' },
          { type: 'If' }
        ],
        connections: [
          { source: 0, target: 1 },
          { source: 1, target: 2 }
        ]
      };

      const result = await analyticsService.calculateWorkflowComplexity(workflowJson);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_workflow_complexity', {
        workflow_data: workflowJson
      });
      expect(result).toBe(42);
    });

    it('should return 0 on error', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await analyticsService.calculateWorkflowComplexity({});

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to calculate workflow complexity:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('utility methods', () => {
    it('should track page views', async () => {
      await analyticsService.trackPageView('/dashboard', { referrer: 'google.com' });

      expect(mockSupabase.from).toHaveBeenCalledWith('user_analytics');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'page_view',
          event_data: expect.objectContaining({
            page: '/dashboard',
            referrer: 'google.com'
          })
        })
      );
    });

    it('should track login events', async () => {
      await analyticsService.trackLogin('oauth');

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'login',
          event_data: expect.objectContaining({
            method: 'oauth'
          })
        })
      );
    });

    it('should track logout events', async () => {
      await analyticsService.trackLogout();

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'logout'
        })
      );
    });

    it('should track error events', async () => {
      const error = new Error('Test error');
      const context = { component: 'TestComponent' };

      await analyticsService.trackError(error, context);

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'error',
          event_data: expect.objectContaining({
            message: 'Test error',
            stack: expect.any(String),
            context
          })
        })
      );
    });

    it('should enable/disable analytics', () => {
      analyticsService.setEnabled(false);
      expect(analyticsService.isEnabled).toBe(false);

      analyticsService.setEnabled(true);
      expect(analyticsService.isEnabled).toBe(true);
    });

    it('should renew session ID', () => {
      const originalSessionId = analyticsService.getSessionId();
      const newSessionId = analyticsService.renewSession();

      expect(newSessionId).not.toBe(originalSessionId);
      expect(analyticsService.getSessionId()).toBe(newSessionId);
    });
  });
});