import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

type SupabaseClient = ReturnType<typeof createClient<Database>>;

export interface AnalyticsEvent {
  eventType: string;
  eventData?: Record<string, any>;
  sessionId?: string;
  userAgent?: string;
}

export interface NodeUsageData {
  projectId: string;
  nodeType: string;
  nodeCount: number;
  complexityScore?: number;
  executionTimeMs?: number;
  successRate?: number;
  errorCount?: number;
}

export interface FeatureUsageData {
  featureName: string;
  usageCount?: number;
  sessionDurationMs?: number;
  successCount?: number;
  errorCount?: number;
}

export interface PerformanceMetric {
  projectId?: string;
  metricType: string;
  metricValue: number;
  metricUnit: string;
  contextData?: Record<string, any>;
}

export interface WorkflowComplexityData {
  projectId: string;
  totalNodes: number;
  totalConnections: number;
  maxDepth?: number;
  branchingFactor?: number;
  cyclicComplexity?: number;
  uniqueNodeTypes?: number;
  triggerTypes?: string[];
  estimatedExecutionTimeMs?: number;
  memoryEstimateMb?: number;
}

export class AnalyticsService {
  private supabase: SupabaseClient;
  private sessionId: string;
  private isEnabled: boolean;

  constructor(supabase: SupabaseClient, enableAnalytics: boolean = true) {
    this.supabase = supabase;
    this.isEnabled = enableAnalytics;
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user?.id || null;
  }

  /**
   * Track user analytics events
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      await this.supabase.from('user_analytics').insert({
        user_id: userId,
        session_id: event.sessionId || this.sessionId,
        event_type: event.eventType,
        event_data: event.eventData || null,
        user_agent: event.userAgent || navigator?.userAgent || null,
        ip_address: null // Will be handled server-side for privacy
      });
    } catch (error) {
      console.error('Failed to track analytics event:', error);
    }
  }

  /**
   * Track node usage analytics
   */
  async trackNodeUsage(data: NodeUsageData): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      await this.supabase.from('node_usage_analytics').insert({
        project_id: data.projectId,
        user_id: userId,
        node_type: data.nodeType,
        node_count: data.nodeCount,
        complexity_score: data.complexityScore || 0,
        execution_time_ms: data.executionTimeMs || null,
        success_rate: data.successRate || 100,
        error_count: data.errorCount || 0
      });
    } catch (error) {
      console.error('Failed to track node usage:', error);
    }
  }

  /**
   * Track feature usage analytics
   */
  async trackFeatureUsage(data: FeatureUsageData): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      // Check if feature usage record exists
      const { data: existing } = await this.supabase
        .from('feature_usage_analytics')
        .select('*')
        .eq('user_id', userId)
        .eq('feature_name', data.featureName)
        .single();

      if (existing) {
        // Update existing record
        await this.supabase
          .from('feature_usage_analytics')
          .update({
            usage_count: (existing.usage_count || 0) + (data.usageCount || 1),
            success_count: (existing.success_count || 0) + (data.successCount || 0),
            error_count: (existing.error_count || 0) + (data.errorCount || 0),
            session_duration_ms: data.sessionDurationMs || existing.session_duration_ms,
            last_used_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Create new record
        await this.supabase.from('feature_usage_analytics').insert({
          user_id: userId,
          feature_name: data.featureName,
          usage_count: data.usageCount || 1,
          session_duration_ms: data.sessionDurationMs || null,
          success_count: data.successCount || 0,
          error_count: data.errorCount || 0
        });
      }
    } catch (error) {
      console.error('Failed to track feature usage:', error);
    }
  }

  /**
   * Track performance metrics
   */
  async trackPerformanceMetric(data: PerformanceMetric): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      await this.supabase.from('performance_metrics').insert({
        project_id: data.projectId || null,
        user_id: userId,
        metric_type: data.metricType,
        metric_value: data.metricValue,
        metric_unit: data.metricUnit,
        context_data: data.contextData || null
      });
    } catch (error) {
      console.error('Failed to track performance metric:', error);
    }
  }

  /**
   * Track workflow complexity analytics
   */
  async trackWorkflowComplexity(data: WorkflowComplexityData): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      await this.supabase.from('workflow_complexity_analytics').insert({
        project_id: data.projectId,
        user_id: userId,
        total_nodes: data.totalNodes,
        total_connections: data.totalConnections,
        max_depth: data.maxDepth || 0,
        branching_factor: data.branchingFactor || 0,
        cyclic_complexity: data.cyclicComplexity || 0,
        unique_node_types: data.uniqueNodeTypes || 0,
        trigger_types: data.triggerTypes || null,
        estimated_execution_time_ms: data.estimatedExecutionTimeMs || null,
        memory_estimate_mb: data.memoryEstimateMb || null
      });
    } catch (error) {
      console.error('Failed to track workflow complexity:', error);
    }
  }

  /**
   * Track project generation metrics
   */
  async trackProjectGeneration(
    projectId: string,
    generationTimeMs: number,
    fileSizeBytes: number,
    nodeTypes: string[],
    complexityScore: number,
    additionalMetrics?: {
      memoryUsageMb?: number;
      cpuUsagePercent?: number;
      apiCallsCount?: number;
      errorRate?: number;
    }
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Track in project_analytics table
      await this.supabase.from('project_analytics').insert({
        project_id: projectId,
        generation_time_ms: generationTimeMs,
        file_size_bytes: fileSizeBytes,
        node_types: nodeTypes,
        complexity_score: complexityScore,
        memory_usage_mb: additionalMetrics?.memoryUsageMb || null,
        cpu_usage_percent: additionalMetrics?.cpuUsagePercent || null,
        api_calls_count: additionalMetrics?.apiCallsCount || 0,
        error_rate: additionalMetrics?.errorRate || 0
      });

      // Track performance metrics
      await this.trackPerformanceMetric({
        projectId,
        metricType: 'generation_time',
        metricValue: generationTimeMs,
        metricUnit: 'ms',
        contextData: {
          nodeCount: nodeTypes.length,
          complexityScore,
          fileSizeBytes
        }
      });

      // Track individual node types
      const nodeTypeCounts = nodeTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      for (const [nodeType, count] of Object.entries(nodeTypeCounts)) {
        await this.trackNodeUsage({
          projectId,
          nodeType,
          nodeCount: count,
          complexityScore: Math.floor(complexityScore / nodeTypes.length)
        });
      }

      // Track event
      await this.trackEvent({
        eventType: 'project_generation_completed',
        eventData: {
          projectId,
          generationTimeMs,
          nodeCount: nodeTypes.length,
          complexityScore
        }
      });
    } catch (error) {
      console.error('Failed to track project generation:', error);
    }
  }

  /**
   * Get user analytics summary
   */
  async getUserAnalyticsSummary(): Promise<any> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return null;

      const { data, error } = await this.supabase
        .rpc('get_user_analytics_summary', { user_uuid: userId });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Failed to get user analytics summary:', error);
      return null;
    }
  }

  /**
   * Calculate workflow complexity from JSON
   */
  async calculateWorkflowComplexity(workflowJson: any): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .rpc('calculate_workflow_complexity', { workflow_data: workflowJson });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Failed to calculate workflow complexity:', error);
      return 0;
    }
  }

  /**
   * Track page view
   */
  async trackPageView(page: string, additionalData?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      eventType: 'page_view',
      eventData: {
        page,
        timestamp: new Date().toISOString(),
        ...additionalData
      }
    });
  }

  /**
   * Track user login
   */
  async trackLogin(method: string = 'email'): Promise<void> {
    await this.trackEvent({
      eventType: 'login',
      eventData: {
        method,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track user logout
   */
  async trackLogout(): Promise<void> {
    await this.trackEvent({
      eventType: 'logout',
      eventData: {
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track error events
   */
  async trackError(error: Error, context?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      eventType: 'error',
      eventData: {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Enable or disable analytics collection
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Generate new session ID
   */
  renewSession(): string {
    this.sessionId = this.generateSessionId();
    return this.sessionId;
  }
}

// Export singleton instance
let analyticsInstance: AnalyticsService | null = null;

export function getAnalyticsService(supabase: SupabaseClient, enableAnalytics: boolean = true): AnalyticsService {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsService(supabase, enableAnalytics);
  }
  return analyticsInstance;
}

export default AnalyticsService;