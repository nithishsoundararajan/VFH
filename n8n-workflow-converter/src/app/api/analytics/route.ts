import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, data } = body;

    // Get client IP address for analytics (anonymized)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    
    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'unknown';

    switch (type) {
      case 'event': {
        const { eventType, eventData, sessionId } = data;
        
        const { error } = await supabase.from('user_analytics').insert({
          user_id: user.id,
          session_id: sessionId,
          event_type: eventType,
          event_data: eventData,
          user_agent: userAgent,
          ip_address: ip
        });

        if (error) {
          console.error('Failed to insert analytics event:', error);
          return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
        }
        break;
      }

      case 'node_usage': {
        const { projectId, nodeType, nodeCount, complexityScore, executionTimeMs, successRate, errorCount } = data;
        
        const { error } = await supabase.from('node_usage_analytics').insert({
          project_id: projectId,
          user_id: user.id,
          node_type: nodeType,
          node_count: nodeCount,
          complexity_score: complexityScore || 0,
          execution_time_ms: executionTimeMs,
          success_rate: successRate || 100,
          error_count: errorCount || 0
        });

        if (error) {
          console.error('Failed to insert node usage analytics:', error);
          return NextResponse.json({ error: 'Failed to track node usage' }, { status: 500 });
        }
        break;
      }

      case 'feature_usage': {
        const { featureName, usageCount, sessionDurationMs, successCount, errorCount } = data;
        
        // Check if feature usage record exists
        const { data: existing, error: selectError } = await supabase
          .from('feature_usage_analytics')
          .select('*')
          .eq('user_id', user.id)
          .eq('feature_name', featureName)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          console.error('Failed to check existing feature usage:', selectError);
          return NextResponse.json({ error: 'Failed to track feature usage' }, { status: 500 });
        }

        if (existing) {
          // Update existing record
          const { error } = await supabase
            .from('feature_usage_analytics')
            .update({
              usage_count: (existing.usage_count || 0) + (usageCount || 1),
              success_count: (existing.success_count || 0) + (successCount || 0),
              error_count: (existing.error_count || 0) + (errorCount || 0),
              session_duration_ms: sessionDurationMs || existing.session_duration_ms,
              last_used_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (error) {
            console.error('Failed to update feature usage analytics:', error);
            return NextResponse.json({ error: 'Failed to track feature usage' }, { status: 500 });
          }
        } else {
          // Create new record
          const { error } = await supabase.from('feature_usage_analytics').insert({
            user_id: user.id,
            feature_name: featureName,
            usage_count: usageCount || 1,
            session_duration_ms: sessionDurationMs,
            success_count: successCount || 0,
            error_count: errorCount || 0
          });

          if (error) {
            console.error('Failed to insert feature usage analytics:', error);
            return NextResponse.json({ error: 'Failed to track feature usage' }, { status: 500 });
          }
        }
        break;
      }

      case 'performance_metric': {
        const { projectId, metricType, metricValue, metricUnit, contextData } = data;
        
        const { error } = await supabase.from('performance_metrics').insert({
          project_id: projectId,
          user_id: user.id,
          metric_type: metricType,
          metric_value: metricValue,
          metric_unit: metricUnit,
          context_data: contextData
        });

        if (error) {
          console.error('Failed to insert performance metric:', error);
          return NextResponse.json({ error: 'Failed to track performance metric' }, { status: 500 });
        }
        break;
      }

      case 'workflow_complexity': {
        const { 
          projectId, 
          totalNodes, 
          totalConnections, 
          maxDepth, 
          branchingFactor, 
          cyclicComplexity, 
          uniqueNodeTypes, 
          triggerTypes, 
          estimatedExecutionTimeMs, 
          memoryEstimateMb 
        } = data;
        
        const { error } = await supabase.from('workflow_complexity_analytics').insert({
          project_id: projectId,
          user_id: user.id,
          total_nodes: totalNodes,
          total_connections: totalConnections,
          max_depth: maxDepth || 0,
          branching_factor: branchingFactor || 0,
          cyclic_complexity: cyclicComplexity || 0,
          unique_node_types: uniqueNodeTypes || 0,
          trigger_types: triggerTypes,
          estimated_execution_time_ms: estimatedExecutionTimeMs,
          memory_estimate_mb: memoryEstimateMb
        });

        if (error) {
          console.error('Failed to insert workflow complexity analytics:', error);
          return NextResponse.json({ error: 'Failed to track workflow complexity' }, { status: 500 });
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const summaryType = searchParams.get('summary');

    if (summaryType === 'user') {
      // Get user analytics summary
      const { data, error } = await supabase
        .rpc('get_user_analytics_summary', { user_uuid: user.id });

      if (error) {
        console.error('Failed to get user analytics summary:', error);
        return NextResponse.json({ error: 'Failed to get analytics summary' }, { status: 500 });
      }

      return NextResponse.json({ data: data?.[0] || null });
    }

    // Default: return basic analytics data
    const [projectsResult, downloadsResult, featuresResult] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, status, created_at, node_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      
      supabase
        .from('download_history')
        .select('id, format, file_size, downloaded_at')
        .eq('user_id', user.id)
        .order('downloaded_at', { ascending: false })
        .limit(10),
      
      supabase
        .from('feature_usage_analytics')
        .select('feature_name, usage_count, last_used_at')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false })
        .limit(10)
    ]);

    return NextResponse.json({
      projects: projectsResult.data || [],
      downloads: downloadsResult.data || [],
      features: featuresResult.data || []
    });
  } catch (error) {
    console.error('Analytics GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}