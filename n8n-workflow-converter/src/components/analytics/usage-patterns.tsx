'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  MousePointer, 
  RefreshCw, 
  Activity,
  Users,
  Zap
} from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

interface UsagePattern {
  date: string;
  projects: number;
  downloads: number;
  sessions: number;
  avgSessionDuration: number;
}

interface FeatureUsage {
  featureName: string;
  usageCount: number;
  lastUsed: string;
  avgSessionDuration: number;
  successRate: number;
}

interface TimePattern {
  hour: number;
  activity: number;
  dayOfWeek: string;
}

export function UsagePatterns() {
  const supabase = useSupabaseClient();
  const [usageData, setUsageData] = useState<UsagePattern[]>([]);
  const [featureData, setFeatureData] = useState<FeatureUsage[]>([]);
  const [timePatterns, setTimePatterns] = useState<TimePattern[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsagePatterns = async () => {
    try {
      setLoading(true);
      
      // Load usage analytics for the last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      // Load daily usage patterns
      const { data: analytics, error: analyticsError } = await supabase
        .from('user_analytics')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      // Load project creation data
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Load download data
      const { data: downloads, error: downloadsError } = await supabase
        .from('download_history')
        .select('downloaded_at')
        .gte('downloaded_at', startDate.toISOString())
        .lte('downloaded_at', endDate.toISOString());

      // Load feature usage data
      const { data: features, error: featuresError } = await supabase
        .from('feature_usage_analytics')
        .select('*')
        .order('usage_count', { ascending: false })
        .limit(10);

      if (analyticsError || projectsError || downloadsError || featuresError) {
        console.error('Failed to load usage patterns:', {
          analyticsError,
          projectsError,
          downloadsError,
          featuresError
        });
        return;
      }

      // Process daily usage patterns
      const dailyUsage = new Map<string, {
        projects: number;
        downloads: number;
        sessions: Set<string>;
        sessionDurations: number[];
      }>();

      // Initialize all days in range
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        dailyUsage.set(dateKey, {
          projects: 0,
          downloads: 0,
          sessions: new Set(),
          sessionDurations: []
        });
      }

      // Process projects
      projects?.forEach(project => {
        const date = new Date(project.created_at).toISOString().split('T')[0];
        const day = dailyUsage.get(date);
        if (day) {
          day.projects += 1;
        }
      });

      // Process downloads
      downloads?.forEach(download => {
        const date = new Date(download.downloaded_at).toISOString().split('T')[0];
        const day = dailyUsage.get(date);
        if (day) {
          day.downloads += 1;
        }
      });

      // Process analytics events
      analytics?.forEach(event => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        const day = dailyUsage.get(date);
        if (day) {
          day.sessions.add(event.session_id);
          // Estimate session duration from event data
          if (event.event_data?.sessionDuration) {
            day.sessionDurations.push(event.event_data.sessionDuration);
          }
        }
      });

      // Convert to array format
      const usagePatterns: UsagePattern[] = Array.from(dailyUsage.entries()).map(([date, data]) => ({
        date,
        projects: data.projects,
        downloads: data.downloads,
        sessions: data.sessions.size,
        avgSessionDuration: data.sessionDurations.length > 0
          ? data.sessionDurations.reduce((a, b) => a + b, 0) / data.sessionDurations.length
          : 0
      }));

      setUsageData(usagePatterns);

      // Process feature usage
      const featureUsage: FeatureUsage[] = features?.map(feature => ({
        featureName: feature.feature_name,
        usageCount: feature.usage_count || 0,
        lastUsed: feature.last_used_at || feature.created_at,
        avgSessionDuration: feature.session_duration_ms || 0,
        successRate: feature.success_count && feature.usage_count
          ? (feature.success_count / feature.usage_count) * 100
          : 100
      })) || [];

      setFeatureData(featureUsage);

      // Process time patterns (hourly activity)
      const hourlyActivity = new Array(24).fill(0);
      const dayActivity = new Map<string, number>();

      analytics?.forEach(event => {
        const eventDate = new Date(event.created_at);
        const hour = eventDate.getHours();
        const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'short' });
        
        hourlyActivity[hour] += 1;
        dayActivity.set(dayOfWeek, (dayActivity.get(dayOfWeek) || 0) + 1);
      });

      const timePatterns: TimePattern[] = hourlyActivity.map((activity, hour) => ({
        hour,
        activity,
        dayOfWeek: ''
      }));

      setTimePatterns(timePatterns);
    } catch (error) {
      console.error('Failed to load usage patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsagePatterns();
  }, []);

  const formatFeatureName = (name: string): string => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getActivityLevel = (count: number, max: number): string => {
    const percentage = (count / max) * 100;
    if (percentage >= 80) return 'Very High';
    if (percentage >= 60) return 'High';
    if (percentage >= 40) return 'Medium';
    if (percentage >= 20) return 'Low';
    return 'Very Low';
  };

  const maxActivity = Math.max(...timePatterns.map(p => p.activity));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Patterns
            </CardTitle>
            <CardDescription>
              Analyze your workflow conversion patterns and behavior
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsagePatterns}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading usage patterns...</span>
          </div>
        ) : (
          <>
            {/* Daily Activity Chart */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Daily Activity (Last 30 Days)
              </h4>
              {usageData.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No activity data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value, name) => [
                        value,
                        name === 'projects' ? 'Projects' : 
                        name === 'downloads' ? 'Downloads' : 'Sessions'
                      ]}
                    />
                    <Area type="monotone" dataKey="projects" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="downloads" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    <Area type="monotone" dataKey="sessions" stackId="1" stroke="#ffc658" fill="#ffc658" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Hourly Activity Heatmap */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Activity by Hour
              </h4>
              <div className="grid grid-cols-12 gap-1">
                {timePatterns.map((pattern, index) => (
                  <div key={index} className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      {pattern.hour}
                    </div>
                    <div 
                      className="h-8 rounded flex items-center justify-center text-xs font-medium"
                      style={{
                        backgroundColor: `hsl(220, 70%, ${90 - (pattern.activity / maxActivity) * 40}%)`,
                        color: pattern.activity / maxActivity > 0.5 ? 'white' : 'black'
                      }}
                      title={`${pattern.hour}:00 - ${pattern.activity} activities`}
                    >
                      {pattern.activity}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>Less active</span>
                <span>More active</span>
              </div>
            </div>

            {/* Feature Usage */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                Feature Usage
              </h4>
              <div className="space-y-3">
                {featureData.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    No feature usage data available
                  </div>
                ) : (
                  featureData.slice(0, 8).map((feature, index) => (
                    <div key={feature.featureName} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatFeatureName(feature.featureName)}</span>
                          <Badge variant="secondary">#{index + 1}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Used {feature.usageCount} times</span>
                          <span>Success: {Math.round(feature.successRate)}%</span>
                          {feature.avgSessionDuration > 0 && (
                            <span>Avg: {Math.round(feature.avgSessionDuration / 1000)}s</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          Last used: {new Date(feature.lastUsed).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Usage Summary */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Usage Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Peak Activity</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {timePatterns.length > 0 
                      ? `${timePatterns.reduce((max, p) => p.activity > max.activity ? p : max, timePatterns[0]).hour}:00`
                      : 'N/A'
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Most active hour
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Most Used Feature</span>
                  </div>
                  <div className="text-lg font-bold">
                    {featureData.length > 0 
                      ? formatFeatureName(featureData[0].featureName)
                      : 'N/A'
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {featureData.length > 0 ? `${featureData[0].usageCount} uses` : 'No data'}
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">Activity Level</span>
                  </div>
                  <div className="text-lg font-bold">
                    {getActivityLevel(
                      usageData.reduce((sum, day) => sum + day.projects + day.downloads, 0),
                      usageData.length * 10 // Assume max 10 activities per day
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Overall engagement
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default UsagePatterns;