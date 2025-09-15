'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Server, 
  TrendingUp,
  RefreshCw,
  Download
} from 'lucide-react';
import { logAggregator, LogAnalysis } from '@/lib/monitoring/log-aggregator';
import { errorTracker } from '@/lib/monitoring/error-tracker';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { logger } from '@/lib/logging/structured-logger';
import { toast } from 'sonner';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, any>;
  responseTime: number;
  timestamp: string;
}

interface ErrorStats {
  totalErrors: number;
  resolvedErrors: number;
  criticalErrors: number;
  errorRate: number;
  topErrors: Array<{ message: string; count: number }>;
}

export function MonitoringDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [logAnalysis, setLogAnalysis] = useState<LogAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      
      // Load system health
      const healthResponse = await fetch('/api/health');
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        setSystemHealth(health);
      }

      // Load error statistics
      const errorStats = await errorTracker.getErrorStats('day');
      setErrorStats(errorStats);

      // Load log analysis
      const analysis = await logAggregator.analyzeLogs({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      });
      setLogAnalysis(analysis);

      logger.info('Monitoring dashboard data loaded', {
        component: 'monitoring_dashboard'
      });
    } catch (error) {
      logger.error('Failed to load dashboard data', error as Error, {
        component: 'monitoring_dashboard'
      });
      toast.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const exportLogs = async () => {
    try {
      const logs = await logAggregator.exportLogs({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }, 'csv');

      const blob = new Blob([logs], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Logs exported successfully');
    } catch (error) {
      toast.error('Failed to export logs');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Monitoring</h1>
          <p className="text-gray-600">Real-time system health and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportLogs}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(systemHealth?.status || 'unknown')}>
                {systemHealth?.status || 'Unknown'}
              </Badge>
              {systemHealth?.responseTime && (
                <span className="text-sm text-gray-500">
                  {systemHealth.responseTime.toFixed(0)}ms
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors (24h)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorStats?.totalErrors || 0}</div>
            <p className="text-xs text-muted-foreground">
              {errorStats?.criticalErrors || 0} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errorStats?.errorRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {errorStats?.resolvedErrors || 0} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logAnalysis?.performanceMetrics.averageResponseTime?.toFixed(0) || 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              P95: {logAnalysis?.performanceMetrics.p95ResponseTime?.toFixed(0) || 0}ms
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemHealth?.services && Object.entries(systemHealth.services).map(([service, data]) => (
              <Card key={service}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="capitalize">{service.replace('_', ' ')}</span>
                    <Badge className={getStatusColor(data.status)}>
                      {data.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.responseTime && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Response Time:</span>
                        <span className="text-sm font-medium">{data.responseTime.toFixed(0)}ms</span>
                      </div>
                    )}
                    {data.memory && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Memory Usage:</span>
                        <span className="text-sm font-medium">
                          {data.memory.used}MB / {data.memory.total}MB
                        </span>
                      </div>
                    )}
                    {data.error && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {data.error}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Errors (24h)</CardTitle>
                <CardDescription>Most frequent error messages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {errorStats?.topErrors?.map((error, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{error.message}</p>
                      </div>
                      <Badge variant="secondary">{error.count}</Badge>
                    </div>
                  )) || (
                    <p className="text-sm text-gray-500">No errors in the last 24 hours</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Component Breakdown</CardTitle>
                <CardDescription>Errors by component</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logAnalysis?.componentBreakdown?.slice(0, 5).map((component, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{component.component}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{component.count}</span>
                        {component.errorCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {component.errorCount} errors
                          </Badge>
                        )}
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-gray-500">No component data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
                <CardDescription>Average response times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logAnalysis?.performanceMetrics.slowestEndpoints?.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{endpoint.endpoint}</p>
                        <p className="text-xs text-gray-500">{endpoint.count} requests</p>
                      </div>
                      <span className="text-sm font-medium">
                        {endpoint.averageTime.toFixed(0)}ms
                      </span>
                    </div>
                  )) || (
                    <p className="text-sm text-gray-500">No performance data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Average Response Time:</span>
                    <span className="text-sm font-medium">
                      {logAnalysis?.performanceMetrics.averageResponseTime?.toFixed(0) || 0}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">95th Percentile:</span>
                    <span className="text-sm font-medium">
                      {logAnalysis?.performanceMetrics.p95ResponseTime?.toFixed(0) || 0}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Logs:</span>
                    <span className="text-sm font-medium">
                      {logAnalysis?.totalLogs || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest system logs and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logAnalysis?.timeSeriesData?.slice(-10).map((entry, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border-l-2 border-blue-200 bg-blue-50">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-gray-600">
                        {entry.count} events
                        {entry.errorCount > 0 && `, ${entry.errorCount} errors`}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      {entry.errorCount > 0 && (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-gray-500">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}