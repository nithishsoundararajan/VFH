'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter
} from 'recharts';
import { Activity, Clock, HardDrive, Cpu, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

interface PerformanceData {
  date: string;
  generationTime: number;
  fileSize: number;
  memoryUsage: number;
  cpuUsage: number;
  nodeCount: number;
  complexityScore: number;
}

interface MetricSummary {
  metric: string;
  current: number;
  previous: number;
  unit: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<any>;
}

export function PerformanceChart() {
  const supabase = useSupabaseClient();
  const [data, setData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricType, setMetricType] = useState('generation_time');
  const [timeRange, setTimeRange] = useState('30d');
  const [summary, setSummary] = useState<MetricSummary[]>([]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      // Load performance metrics
      const { data: metrics, error: metricsError } = await supabase
        .from('performance_metrics')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      // Load project analytics for additional context
      const { data: projects, error: projectsError } = await supabase
        .from('project_analytics')
        .select(`
          *,
          projects!inner(created_at, node_count)
        `)
        .gte('projects.created_at', startDate.toISOString())
        .lte('projects.created_at', endDate.toISOString())
        .order('projects.created_at', { ascending: true });

      if (metricsError || projectsError) {
        console.error('Failed to load performance data:', metricsError || projectsError);
        return;
      }

      // Combine and process data
      const combinedData: PerformanceData[] = [];
      
      // Group by date
      const dateGroups = new Map<string, any>();
      
      projects?.forEach(project => {
        const date = new Date(project.projects.created_at).toISOString().split('T')[0];
        if (!dateGroups.has(date)) {
          dateGroups.set(date, {
            date,
            generationTime: [],
            fileSize: [],
            memoryUsage: [],
            cpuUsage: [],
            nodeCount: [],
            complexityScore: []
          });
        }
        
        const group = dateGroups.get(date);
        group.generationTime.push(project.generation_time_ms || 0);
        group.fileSize.push(project.file_size_bytes || 0);
        group.memoryUsage.push(project.memory_usage_mb || 0);
        group.cpuUsage.push(project.cpu_usage_percent || 0);
        group.nodeCount.push(project.projects.node_count || 0);
        group.complexityScore.push(project.complexity_score || 0);
      });

      // Calculate averages for each date
      dateGroups.forEach((group, date) => {
        combinedData.push({
          date,
          generationTime: group.generationTime.reduce((a: number, b: number) => a + b, 0) / group.generationTime.length || 0,
          fileSize: group.fileSize.reduce((a: number, b: number) => a + b, 0) / group.fileSize.length || 0,
          memoryUsage: group.memoryUsage.reduce((a: number, b: number) => a + b, 0) / group.memoryUsage.length || 0,
          cpuUsage: group.cpuUsage.reduce((a: number, b: number) => a + b, 0) / group.cpuUsage.length || 0,
          nodeCount: group.nodeCount.reduce((a: number, b: number) => a + b, 0) / group.nodeCount.length || 0,
          complexityScore: group.complexityScore.reduce((a: number, b: number) => a + b, 0) / group.complexityScore.length || 0
        });
      });

      combinedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setData(combinedData);

      // Calculate summary metrics
      if (combinedData.length >= 2) {
        const recent = combinedData.slice(-7); // Last 7 days
        const previous = combinedData.slice(-14, -7); // Previous 7 days
        
        const calculateAverage = (arr: PerformanceData[], key: keyof PerformanceData) => {
          const values = arr.map(item => Number(item[key])).filter(val => !isNaN(val));
          return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        };

        const getTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
          const diff = ((current - previous) / previous) * 100;
          if (Math.abs(diff) < 5) return 'neutral';
          return diff > 0 ? 'up' : 'down';
        };

        const summaryMetrics: MetricSummary[] = [
          {
            metric: 'Generation Time',
            current: calculateAverage(recent, 'generationTime'),
            previous: calculateAverage(previous, 'generationTime'),
            unit: 'ms',
            trend: getTrend(calculateAverage(recent, 'generationTime'), calculateAverage(previous, 'generationTime')),
            icon: Clock
          },
          {
            metric: 'File Size',
            current: calculateAverage(recent, 'fileSize'),
            previous: calculateAverage(previous, 'fileSize'),
            unit: 'bytes',
            trend: getTrend(calculateAverage(recent, 'fileSize'), calculateAverage(previous, 'fileSize')),
            icon: HardDrive
          },
          {
            metric: 'Memory Usage',
            current: calculateAverage(recent, 'memoryUsage'),
            previous: calculateAverage(previous, 'memoryUsage'),
            unit: 'MB',
            trend: getTrend(calculateAverage(recent, 'memoryUsage'), calculateAverage(previous, 'memoryUsage')),
            icon: Activity
          },
          {
            metric: 'CPU Usage',
            current: calculateAverage(recent, 'cpuUsage'),
            previous: calculateAverage(previous, 'cpuUsage'),
            unit: '%',
            trend: getTrend(calculateAverage(recent, 'cpuUsage'), calculateAverage(previous, 'cpuUsage')),
            icon: Cpu
          }
        ];

        setSummary(summaryMetrics);
      }
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPerformanceData();
  }, [timeRange]);

  const formatValue = (value: number, type: string) => {
    switch (type) {
      case 'generation_time':
        return `${Math.round(value)}ms`;
      case 'file_size':
        return `${(value / 1024).toFixed(1)}KB`;
      case 'memory_usage':
        return `${value.toFixed(1)}MB`;
      case 'cpu_usage':
        return `${value.toFixed(1)}%`;
      default:
        return Math.round(value).toString();
    }
  };

  const getMetricKey = (type: string): keyof PerformanceData => {
    switch (type) {
      case 'generation_time':
        return 'generationTime';
      case 'file_size':
        return 'fileSize';
      case 'memory_usage':
        return 'memoryUsage';
      case 'cpu_usage':
        return 'cpuUsage';
      case 'node_count':
        return 'nodeCount';
      case 'complexity_score':
        return 'complexityScore';
      default:
        return 'generationTime';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{new Date(label).toLocaleDateString()}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].name}: <span className="font-medium">{formatValue(payload[0].value, metricType)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Node Count: <span className="font-medium">{Math.round(data.nodeCount)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Complexity: <span className="font-medium">{Math.round(data.complexityScore)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((metric) => {
          const Icon = metric.icon;
          const trendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : null;
          const trendColor = metric.trend === 'up' ? 'text-red-500' : metric.trend === 'down' ? 'text-green-500' : 'text-muted-foreground';
          
          return (
            <Card key={metric.metric}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.metric}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatValue(metric.current, metricType)}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {trendIcon && (
                    <div className={`flex items-center ${trendColor}`}>
                      {React.createElement(trendIcon, { className: 'h-3 w-3 mr-1' })}
                      {Math.abs(((metric.current - metric.previous) / metric.previous) * 100).toFixed(1)}%
                    </div>
                  )}
                  <span className="ml-1">vs last period</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
              <CardDescription>
                Track system performance over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={metricType} onValueChange={setMetricType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generation_time">Generation Time</SelectItem>
                  <SelectItem value="file_size">File Size</SelectItem>
                  <SelectItem value="memory_usage">Memory Usage</SelectItem>
                  <SelectItem value="cpu_usage">CPU Usage</SelectItem>
                  <SelectItem value="node_count">Node Count</SelectItem>
                  <SelectItem value="complexity_score">Complexity Score</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPerformanceData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading performance data...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No performance data available for the selected time range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis tickFormatter={(value) => formatValue(value, metricType)} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey={getMetricKey(metricType)} 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Performance vs Complexity Scatter Plot */}
      <Card>
        <CardHeader>
          <CardTitle>Performance vs Complexity</CardTitle>
          <CardDescription>
            Relationship between workflow complexity and generation performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No data available for correlation analysis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="complexityScore" 
                  name="Complexity Score"
                  tickFormatter={(value) => Math.round(value).toString()}
                />
                <YAxis 
                  dataKey="generationTime" 
                  name="Generation Time"
                  tickFormatter={(value) => `${Math.round(value)}ms`}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'generationTime' ? `${Math.round(Number(value))}ms` : Math.round(Number(value)),
                    name === 'generationTime' ? 'Generation Time' : 'Complexity Score'
                  ]}
                />
                <Scatter dataKey="generationTime" fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PerformanceChart;