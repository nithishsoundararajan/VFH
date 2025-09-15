'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Zap, TrendingUp, RefreshCw, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

interface NodeUsageData {
  nodeType: string;
  totalCount: number;
  avgComplexity: number;
  avgExecutionTime: number;
  successRate: number;
  projects: number;
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#ff00ff', '#00ffff', '#ff0000', '#0000ff', '#ffff00'
];

export function NodeUsageChart() {
  const supabase = useSupabaseClient();
  const [data, setData] = useState<NodeUsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [timeRange, setTimeRange] = useState('30d');

  const loadNodeUsageData = async () => {
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
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      const { data: nodeUsage, error } = await supabase
        .from('node_usage_analytics')
        .select(`
          node_type,
          node_count,
          complexity_score,
          execution_time_ms,
          success_rate,
          project_id
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        console.error('Failed to load node usage data:', error);
        return;
      }

      // Aggregate data by node type
      const aggregated = nodeUsage?.reduce((acc, item) => {
        const existing = acc.find(a => a.nodeType === item.node_type);
        
        if (existing) {
          existing.totalCount += item.node_count;
          existing.avgComplexity = (existing.avgComplexity + item.complexity_score) / 2;
          existing.avgExecutionTime = item.execution_time_ms 
            ? (existing.avgExecutionTime + item.execution_time_ms) / 2 
            : existing.avgExecutionTime;
          existing.successRate = (existing.successRate + item.success_rate) / 2;
          existing.projects += 1;
        } else {
          acc.push({
            nodeType: item.node_type,
            totalCount: item.node_count,
            avgComplexity: item.complexity_score,
            avgExecutionTime: item.execution_time_ms || 0,
            successRate: item.success_rate,
            projects: 1
          });
        }
        
        return acc;
      }, [] as NodeUsageData[]) || [];

      // Sort by total count
      aggregated.sort((a, b) => b.totalCount - a.totalCount);
      
      setData(aggregated.slice(0, 10)); // Top 10 nodes
    } catch (error) {
      console.error('Failed to load node usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodeUsageData();
  }, [timeRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            Total Usage: <span className="font-medium">{data.totalCount}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Projects: <span className="font-medium">{data.projects}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Avg Complexity: <span className="font-medium">{Math.round(data.avgComplexity)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Success Rate: <span className="font-medium">{Math.round(data.successRate)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="nodeType" 
          angle={-45}
          textAnchor="end"
          height={100}
          fontSize={12}
        />
        <YAxis />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="totalCount" fill="#8884d8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ nodeType, percent }) => `${nodeType} (${(percent * 100).toFixed(0)}%)`}
          outerRadius={120}
          fill="#8884d8"
          dataKey="totalCount"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Node Usage Analytics
              </CardTitle>
              <CardDescription>
                Most frequently used node types in your workflows
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChartType(chartType === 'bar' ? 'pie' : 'bar')}
              >
                {chartType === 'bar' ? <PieChartIcon className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadNodeUsageData}
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
              <span className="ml-2">Loading node usage data...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No node usage data available for the selected time range
            </div>
          ) : (
            chartType === 'bar' ? renderBarChart() : renderPieChart()
          )}
        </CardContent>
      </Card>

      {/* Top Nodes Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.slice(0, 6).map((node, index) => (
          <Card key={node.nodeType}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                {node.nodeType}
                <Badge variant="secondary">#{index + 1}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Usage:</span>
                  <span className="font-medium">{node.totalCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Projects:</span>
                  <span className="font-medium">{node.projects}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="font-medium">{Math.round(node.successRate)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Complexity:</span>
                  <span className="font-medium">{Math.round(node.avgComplexity)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default NodeUsageChart;