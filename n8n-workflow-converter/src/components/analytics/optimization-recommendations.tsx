'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Lightbulb, 
  TrendingUp, 
  Clock, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Target,
  BarChart3,
  Settings
} from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

interface Recommendation {
  id: string;
  type: 'performance' | 'complexity' | 'usage' | 'best_practice';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actionItems: string[];
  metrics?: {
    current: number;
    target: number;
    unit: string;
  };
}

interface AnalysisData {
  avgGenerationTime: number;
  avgComplexity: number;
  mostUsedNodes: string[];
  errorRate: number;
  projectCount: number;
  recentTrends: {
    generationTime: 'improving' | 'declining' | 'stable';
    complexity: 'increasing' | 'decreasing' | 'stable';
    usage: 'increasing' | 'decreasing' | 'stable';
  };
}

export function OptimizationRecommendations() {
  const supabase = useSupabaseClient();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  const generateRecommendations = (data: AnalysisData): Recommendation[] => {
    const recs: Recommendation[] = [];

    // Performance recommendations
    if (data.avgGenerationTime > 10000) { // > 10 seconds
      recs.push({
        id: 'perf-generation-time',
        type: 'performance',
        priority: 'high',
        title: 'Optimize Generation Time',
        description: 'Your average generation time is higher than optimal. Consider simplifying workflows or optimizing node configurations.',
        impact: 'Reduce generation time by up to 40%',
        actionItems: [
          'Review workflows with high complexity scores',
          'Minimize unnecessary node connections',
          'Use more efficient node types where possible',
          'Consider breaking large workflows into smaller components'
        ],
        metrics: {
          current: data.avgGenerationTime,
          target: 6000,
          unit: 'ms'
        }
      });
    }

    // Complexity recommendations
    if (data.avgComplexity > 100) {
      recs.push({
        id: 'complexity-reduction',
        type: 'complexity',
        priority: 'medium',
        title: 'Reduce Workflow Complexity',
        description: 'Your workflows have high complexity scores. Simplifying them can improve maintainability and performance.',
        impact: 'Improve maintainability and reduce errors',
        actionItems: [
          'Break complex workflows into smaller, focused workflows',
          'Reduce the number of conditional branches',
          'Consolidate similar node operations',
          'Use sub-workflows for repeated patterns'
        ],
        metrics: {
          current: data.avgComplexity,
          target: 50,
          unit: 'score'
        }
      });
    }

    // Node usage recommendations
    if (data.mostUsedNodes.includes('HttpRequest') && data.mostUsedNodes.length < 5) {
      recs.push({
        id: 'node-diversity',
        type: 'usage',
        priority: 'low',
        title: 'Diversify Node Usage',
        description: 'You\'re primarily using HTTP Request nodes. Explore other node types to build more efficient workflows.',
        impact: 'Discover more efficient workflow patterns',
        actionItems: [
          'Explore data transformation nodes (Set, Function)',
          'Use conditional nodes (If, Switch) for logic',
          'Try database nodes for data persistence',
          'Consider webhook nodes for real-time triggers'
        ]
      });
    }

    // Error rate recommendations
    if (data.errorRate > 5) {
      recs.push({
        id: 'error-reduction',
        type: 'best_practice',
        priority: 'high',
        title: 'Improve Error Handling',
        description: 'Your workflows have a higher than normal error rate. Implementing better error handling can improve reliability.',
        impact: 'Reduce errors by up to 80%',
        actionItems: [
          'Add error handling nodes to critical paths',
          'Validate input data before processing',
          'Use try-catch patterns in Function nodes',
          'Implement retry logic for external API calls'
        ],
        metrics: {
          current: data.errorRate,
          target: 2,
          unit: '%'
        }
      });
    }

    // Usage pattern recommendations
    if (data.recentTrends.generationTime === 'declining') {
      recs.push({
        id: 'performance-trend',
        type: 'performance',
        priority: 'medium',
        title: 'Address Performance Decline',
        description: 'Your generation times have been increasing recently. This trend should be addressed to maintain efficiency.',
        impact: 'Prevent further performance degradation',
        actionItems: [
          'Review recent workflow changes',
          'Check for increased data volumes',
          'Optimize database queries in workflows',
          'Monitor resource usage patterns'
        ]
      });
    }

    // Best practice recommendations
    if (data.projectCount > 10) {
      recs.push({
        id: 'workflow-organization',
        type: 'best_practice',
        priority: 'low',
        title: 'Organize Workflow Library',
        description: 'With many workflows created, consider organizing them into categories and creating reusable templates.',
        impact: 'Improve workflow discoverability and reuse',
        actionItems: [
          'Create workflow templates for common patterns',
          'Use consistent naming conventions',
          'Document workflow purposes and usage',
          'Archive or delete unused workflows'
        ]
      });
    }

    // Complexity trend recommendations
    if (data.recentTrends.complexity === 'increasing') {
      recs.push({
        id: 'complexity-trend',
        type: 'complexity',
        priority: 'medium',
        title: 'Monitor Complexity Growth',
        description: 'Your workflow complexity has been increasing. Consider establishing complexity guidelines.',
        impact: 'Maintain workflow simplicity and performance',
        actionItems: [
          'Set complexity score targets for new workflows',
          'Review and refactor complex existing workflows',
          'Create simpler alternatives to complex patterns',
          'Train team on workflow design best practices'
        ]
      });
    }

    // General optimization recommendations
    recs.push({
      id: 'general-optimization',
      type: 'best_practice',
      priority: 'low',
      title: 'General Optimization Tips',
      description: 'Follow these best practices to maintain optimal workflow performance.',
      impact: 'Overall system efficiency improvement',
      actionItems: [
        'Regularly review and update node configurations',
        'Use caching where appropriate to reduce API calls',
        'Implement proper logging for debugging',
        'Keep workflows focused on single responsibilities'
      ]
    });

    return recs.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const loadAnalysisData = async () => {
    try {
      setLoading(true);

      // Load project analytics
      const { data: projectAnalytics, error: analyticsError } = await supabase
        .from('project_analytics')
        .select(`
          generation_time_ms,
          complexity_score,
          node_types,
          error_rate,
          projects!inner(created_at)
        `)
        .order('projects.created_at', { ascending: false })
        .limit(50);

      // Load node usage data
      const { data: nodeUsage, error: nodeError } = await supabase
        .from('node_usage_analytics')
        .select('node_type, node_count')
        .order('created_at', { ascending: false })
        .limit(100);

      if (analyticsError || nodeError) {
        console.error('Failed to load analysis data:', analyticsError || nodeError);
        return;
      }

      if (!projectAnalytics || projectAnalytics.length === 0) {
        setAnalysisData({
          avgGenerationTime: 0,
          avgComplexity: 0,
          mostUsedNodes: [],
          errorRate: 0,
          projectCount: 0,
          recentTrends: {
            generationTime: 'stable',
            complexity: 'stable',
            usage: 'stable'
          }
        });
        return;
      }

      // Calculate averages
      const avgGenerationTime = projectAnalytics.reduce((sum, p) => sum + (p.generation_time_ms || 0), 0) / projectAnalytics.length;
      const avgComplexity = projectAnalytics.reduce((sum, p) => sum + (p.complexity_score || 0), 0) / projectAnalytics.length;
      const avgErrorRate = projectAnalytics.reduce((sum, p) => sum + (p.error_rate || 0), 0) / projectAnalytics.length;

      // Calculate most used nodes
      const nodeTypeCounts = new Map<string, number>();
      nodeUsage?.forEach(usage => {
        const current = nodeTypeCounts.get(usage.node_type) || 0;
        nodeTypeCounts.set(usage.node_type, current + usage.node_count);
      });

      const mostUsedNodes = Array.from(nodeTypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nodeType]) => nodeType);

      // Calculate trends (simple comparison of first half vs second half)
      const midpoint = Math.floor(projectAnalytics.length / 2);
      const recent = projectAnalytics.slice(0, midpoint);
      const older = projectAnalytics.slice(midpoint);

      const recentAvgTime = recent.reduce((sum, p) => sum + (p.generation_time_ms || 0), 0) / recent.length;
      const olderAvgTime = older.reduce((sum, p) => sum + (p.generation_time_ms || 0), 0) / older.length;

      const recentAvgComplexity = recent.reduce((sum, p) => sum + (p.complexity_score || 0), 0) / recent.length;
      const olderAvgComplexity = older.reduce((sum, p) => sum + (p.complexity_score || 0), 0) / older.length;

      const getTrend = (recent: number, older: number): 'improving' | 'declining' | 'stable' | 'increasing' | 'decreasing' => {
        const diff = ((recent - older) / older) * 100;
        if (Math.abs(diff) < 10) return 'stable';
        return diff > 0 ? 'declining' : 'improving'; // For generation time, increase is decline
      };

      const getComplexityTrend = (recent: number, older: number): 'increasing' | 'decreasing' | 'stable' => {
        const diff = ((recent - older) / older) * 100;
        if (Math.abs(diff) < 10) return 'stable';
        return diff > 0 ? 'increasing' : 'decreasing';
      };

      const analysisData: AnalysisData = {
        avgGenerationTime,
        avgComplexity,
        mostUsedNodes,
        errorRate: avgErrorRate,
        projectCount: projectAnalytics.length,
        recentTrends: {
          generationTime: getTrend(recentAvgTime, olderAvgTime),
          complexity: getComplexityTrend(recentAvgComplexity, olderAvgComplexity),
          usage: 'stable' // Simplified for now
        }
      };

      setAnalysisData(analysisData);
      setRecommendations(generateRecommendations(analysisData));
    } catch (error) {
      console.error('Failed to load analysis data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysisData();
  }, []);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Target className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <Zap className="h-4 w-4" />;
      case 'complexity':
        return <BarChart3 className="h-4 w-4" />;
      case 'usage':
        return <TrendingUp className="h-4 w-4" />;
      case 'best_practice':
        return <Settings className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Optimization Recommendations
            </CardTitle>
            <CardDescription>
              Personalized suggestions to improve your workflow performance
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalysisData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Analyzing your workflows...</span>
          </div>
        ) : recommendations.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Great job! Your workflows are well-optimized. Keep following best practices to maintain performance.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(rec.type)}
                    <h4 className="font-medium">{rec.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(rec.priority) as any}>
                      {getPriorityIcon(rec.priority)}
                      {rec.priority}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {rec.description}
                </p>

                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-600">Impact:</span>
                  <span>{rec.impact}</span>
                </div>

                {rec.metrics && (
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Current: {rec.metrics.current.toFixed(1)} {rec.metrics.unit}</span>
                      <span>Target: {rec.metrics.target} {rec.metrics.unit}</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min((rec.metrics.target / rec.metrics.current) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <h5 className="font-medium text-sm mb-2">Action Items:</h5>
                  <ul className="space-y-1">
                    {rec.actionItems.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 mt-0.5 text-green-600 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OptimizationRecommendations;