'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Brain, GitBranch, Layers, Clock, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

interface ComplexityData {
  projectId: string;
  projectName: string;
  totalNodes: number;
  totalConnections: number;
  maxDepth: number;
  branchingFactor: number;
  cyclicComplexity: number;
  uniqueNodeTypes: number;
  complexityScore: number;
  generationTime: number;
  createdAt: string;
}

interface ComplexityDistribution {
  range: string;
  count: number;
  avgGenerationTime: number;
}

interface ComplexityMetrics {
  avgComplexity: number;
  maxComplexity: number;
  minComplexity: number;
  complexityTrend: 'increasing' | 'decreasing' | 'stable';
  correlationWithTime: number;
}

export function ComplexityAnalysis() {
  const supabase = useSupabaseClient();
  const [data, setData] = useState<ComplexityData[]>([]);
  const [distribution, setDistribution] = useState<ComplexityDistribution[]>([]);
  const [metrics, setMetrics] = useState<ComplexityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadComplexityData = async () => {
    try {
      setLoading(true);
      
      // Load workflow complexity analytics
      const { data: complexityData, error: complexityError } = await supabase
        .from('workflow_complexity_analytics')
        .select(`
          *,
          projects!inner(name, created_at)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Load project analytics for complexity scores
      const { data: projectAnalytics, error: analyticsError } = await supabase
        .from('project_analytics')
        .select(`
          project_id,
          complexity_score,
          generation_time_ms,
          projects!inner(name, created_at)
        `)
        .order('projects.created_at', { ascending: false })
        .limit(100);

      if (complexityError || analyticsError) {
        console.error('Failed to load complexity data:', complexityError || analyticsError);
        return;
      }

      // Combine data
      const combinedData: ComplexityData[] = [];
      
      complexityData?.forEach(item => {
        const analytics = projectAnalytics?.find(a => a.project_id === item.project_id);
        combinedData.push({
          projectId: item.project_id,
          projectName: item.projects.name,
          totalNodes: item.total_nodes,
          totalConnections: item.total_connections,
          maxDepth: item.max_depth || 0,
          branchingFactor: item.branching_factor || 0,
          cyclicComplexity: item.cyclic_complexity || 0,
          uniqueNodeTypes: item.unique_node_types || 0,
          complexityScore: analytics?.complexity_score || 0,
          generationTime: analytics?.generation_time_ms || 0,
          createdAt: item.projects.created_at
        });
      });

      setData(combinedData);

      // Calculate distribution
      const ranges = [
        { min: 0, max: 20, label: 'Simple (0-20)' },
        { min: 21, max: 50, label: 'Moderate (21-50)' },
        { min: 51, max: 100, label: 'Complex (51-100)' },
        { min: 101, max: 200, label: 'Very Complex (101-200)' },
        { min: 201, max: Infinity, label: 'Extremely Complex (200+)' }
      ];

      const dist: ComplexityDistribution[] = ranges.map(range => {
        const items = combinedData.filter(item => 
          item.complexityScore >= range.min && item.complexityScore <= range.max
        );
        
        return {
          range: range.label,
          count: items.length,
          avgGenerationTime: items.length > 0 
            ? items.reduce((sum, item) => sum + item.generationTime, 0) / items.length 
            : 0
        };
      });

      setDistribution(dist);

      // Calculate metrics
      if (combinedData.length > 0) {
        const complexityScores = combinedData.map(item => item.complexityScore);
        const avgComplexity = complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length;
        const maxComplexity = Math.max(...complexityScores);
        const minComplexity = Math.min(...complexityScores);

        // Calculate trend (simple linear regression)
        const n = combinedData.length;
        const xValues = combinedData.map((_, index) => index);
        const yValues = complexityScores;
        
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const complexityTrend = Math.abs(slope) < 0.1 ? 'stable' : slope > 0 ? 'increasing' : 'decreasing';

        // Calculate correlation between complexity and generation time
        const generationTimes = combinedData.map(item => item.generationTime);
        const correlationWithTime = calculateCorrelation(complexityScores, generationTimes);

        setMetrics({
          avgComplexity,
          maxComplexity,
          minComplexity,
          complexityTrend,
          correlationWithTime
        });
      }
    } catch (error) {
      console.error('Failed to load complexity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  };

  useEffect(() => {
    loadComplexityData();
  }, []);

  const getComplexityLevel = (score: number): { level: string; color: string; icon: React.ComponentType<any> } => {
    if (score <= 20) return { level: 'Simple', color: 'text-green-600', icon: CheckCircle };
    if (score <= 50) return { level: 'Moderate', color: 'text-blue-600', icon: CheckCircle };
    if (score <= 100) return { level: 'Complex', color: 'text-yellow-600', icon: AlertTriangle };
    if (score <= 200) return { level: 'Very Complex', color: 'text-orange-600', icon: AlertTriangle };
    return { level: 'Extremely Complex', color: 'text-red-600', icon: AlertTriangle };
  };

  const radarData = data.slice(0, 5).map(item => ({
    project: item.projectName.substring(0, 10) + '...',
    nodes: (item.totalNodes / 50) * 100, // Normalize to 0-100
    connections: (item.totalConnections / 100) * 100,
    depth: (item.maxDepth / 10) * 100,
    branching: item.branchingFactor * 20,
    uniqueTypes: (item.uniqueNodeTypes / 20) * 100
  }));

  return (
    <div className="space-y-4">
      {/* Complexity Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Complexity
            </CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.avgComplexity.toFixed(1) || 'N/A'}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {metrics?.complexityTrend || 'stable'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Max Complexity
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.maxComplexity || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">
              Highest complexity score
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Time Correlation
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.correlationWithTime ? (metrics.correlationWithTime * 100).toFixed(1) + '%' : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">
              Complexity vs generation time
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.length}
            </div>
            <div className="text-xs text-muted-foreground">
              Analyzed workflows
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Complexity Distribution */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Complexity Distribution
              </CardTitle>
              <CardDescription>
                Distribution of workflow complexity across your projects
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadComplexityData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading complexity data...</span>
            </div>
          ) : distribution.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No complexity data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'count' ? `${value} projects` : `${Math.round(Number(value))}ms`,
                    name === 'count' ? 'Projects' : 'Avg Generation Time'
                  ]}
                />
                <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Project Complexity Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Project Complexity Breakdown</CardTitle>
          <CardDescription>
            Multi-dimensional complexity analysis of recent projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          {radarData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No projects available for radar analysis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="project" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Nodes" dataKey="nodes" stroke="#8884d8" fill="#8884d8" fillOpacity={0.1} />
                <Radar name="Connections" dataKey="connections" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.1} />
                <Radar name="Depth" dataKey="depth" stroke="#ffc658" fill="#ffc658" fillOpacity={0.1} />
                <Radar name="Branching" dataKey="branching" stroke="#ff7300" fill="#ff7300" fillOpacity={0.1} />
                <Radar name="Unique Types" dataKey="uniqueTypes" stroke="#00ff00" fill="#00ff00" fillOpacity={0.1} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent Projects Complexity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>
            Complexity analysis of your most recent workflow conversions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.slice(0, 10).map((project) => {
              const complexity = getComplexityLevel(project.complexityScore);
              const Icon = complexity.icon;
              
              return (
                <div key={project.projectId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{project.projectName}</h4>
                      <Badge variant="outline" className={complexity.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {complexity.level}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Nodes: {project.totalNodes}</span>
                      <span>Connections: {project.totalConnections}</span>
                      <span>Depth: {project.maxDepth}</span>
                      <span>Types: {project.uniqueNodeTypes}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{project.complexityScore}</div>
                    <div className="text-xs text-muted-foreground">
                      {project.generationTime > 0 ? `${Math.round(project.generationTime / 1000)}s` : 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ComplexityAnalysis;