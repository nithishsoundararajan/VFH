'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Download, 
  Zap, 
  Users, 
  Activity,
  FileText,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useAnalytics } from '@/hooks/use-analytics';
import { UserStatsCard } from './user-stats-card';
import { NodeUsageChart } from './node-usage-chart';
import { PerformanceChart } from './performance-chart';
import { ComplexityAnalysis } from './complexity-analysis';
import { UsagePatterns } from './usage-patterns';
import { OptimizationRecommendations } from './optimization-recommendations';

interface AnalyticsDashboardProps {
  className?: string;
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const { getUserAnalyticsSummary, isEnabled } = useAnalytics();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalyticsSummary = async () => {
    if (!isEnabled) return;
    
    try {
      setRefreshing(true);
      const data = await getUserAnalyticsSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load analytics summary:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalyticsSummary();
  }, [isEnabled]);

  if (!isEnabled) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
          <CardDescription>
            Analytics are currently disabled. Enable analytics in settings to view insights.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Enable Analytics
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics Dashboard
          </h2>
          <p className="text-muted-foreground">
            Insights into your workflow conversion patterns and usage
          </p>
        </div>
        <Button
          onClick={loadAnalyticsSummary}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <UserStatsCard
          title="Total Projects"
          value={summary?.total_projects || 0}
          icon={FileText}
          description="Workflows converted"
          trend={summary?.projects_trend}
        />
        <UserStatsCard
          title="Downloads"
          value={summary?.total_downloads || 0}
          icon={Download}
          description="Projects downloaded"
          trend={summary?.downloads_trend}
        />
        <UserStatsCard
          title="Avg Generation Time"
          value={summary?.avg_generation_time_ms ? `${Math.round(summary.avg_generation_time_ms / 1000)}s` : 'N/A'}
          icon={Clock}
          description="Average processing time"
          trend={summary?.generation_time_trend}
        />
        <UserStatsCard
          title="Active Sessions"
          value={summary?.total_sessions || 0}
          icon={Activity}
          description="Unique sessions"
          trend={summary?.sessions_trend}
        />
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="nodes">Node Usage</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="complexity">Complexity</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Used Node Type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Most Used Node
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {summary?.most_used_node_type || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Primary node type in your workflows
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    #{1}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Last Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Last Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {summary?.last_activity 
                        ? new Date(summary.last_activity).toLocaleDateString()
                        : 'N/A'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {summary?.last_activity 
                        ? new Date(summary.last_activity).toLocaleTimeString()
                        : 'No recent activity'
                      }
                    </p>
                  </div>
                  <Badge variant="outline">
                    Recent
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity Summary</CardTitle>
              <CardDescription>
                Overview of your recent workflow conversion activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">Projects This Week</span>
                  <Badge variant="secondary">{summary?.projects_this_week || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">Downloads This Week</span>
                  <Badge variant="secondary">{summary?.downloads_this_week || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">Average Complexity Score</span>
                  <Badge variant="secondary">{summary?.avg_complexity_score || 'N/A'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nodes" className="space-y-4">
          <NodeUsageChart />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceChart />
        </TabsContent>

        <TabsContent value="complexity" className="space-y-4">
          <ComplexityAnalysis />
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UsagePatterns />
            <OptimizationRecommendations />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AnalyticsDashboard;