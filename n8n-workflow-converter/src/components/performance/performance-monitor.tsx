'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Clock, Database, Zap } from 'lucide-react';

interface PerformanceMetrics {
  // Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  apiResponseTime?: number;
  databaseQueryTime?: number;
  bundleSize?: number;
  memoryUsage?: number;
}

interface PerformanceMonitorProps {
  showDetails?: boolean;
  className?: string;
}

export function PerformanceMonitor({ 
  showDetails = false, 
  className = '' 
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development or when explicitly enabled
    const shouldShow = process.env.NODE_ENV === 'development' || 
                      localStorage.getItem('show-performance-monitor') === 'true';
    setIsVisible(shouldShow);

    if (!shouldShow) return;

    // Collect Web Vitals
    const collectWebVitals = () => {
      if (typeof window === 'undefined') return;

      // Performance Observer for Web Vitals
      if ('PerformanceObserver' in window) {
        // First Contentful Paint
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcp = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcp) {
            setMetrics(prev => ({ ...prev, fcp: fcp.startTime }));
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.processingStart && entry.startTime) {
              const fid = entry.processingStart - entry.startTime;
              setMetrics(prev => ({ ...prev, fid }));
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Layout Shift
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          setMetrics(prev => ({ ...prev, cls: clsValue }));
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      }

      // Navigation timing for TTFB
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const ttfb = timing.responseStart - timing.navigationStart;
        setMetrics(prev => ({ ...prev, ttfb }));
      }

      // Memory usage (if available)
      if ('memory' in window.performance) {
        const memory = (window.performance as any).memory;
        setMetrics(prev => ({ 
          ...prev, 
          memoryUsage: memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100 
        }));
      }
    };

    collectWebVitals();

    // Update metrics periodically
    const interval = setInterval(() => {
      if ('memory' in window.performance) {
        const memory = (window.performance as any).memory;
        setMetrics(prev => ({ 
          ...prev, 
          memoryUsage: memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100 
        }));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Monitor API response times
  useEffect(() => {
    if (!isVisible) return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const start = performance.now();
      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - start;
        
        // Only track API calls to our backend
        const url = args[0] as string;
        if (url.includes('/api/')) {
          setMetrics(prev => ({ ...prev, apiResponseTime: duration }));
        }
        
        return response;
      } catch (error) {
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const getScoreColor = (metric: string, value: number) => {
    switch (metric) {
      case 'fcp':
        return value < 1800 ? 'bg-green-500' : value < 3000 ? 'bg-yellow-500' : 'bg-red-500';
      case 'lcp':
        return value < 2500 ? 'bg-green-500' : value < 4000 ? 'bg-yellow-500' : 'bg-red-500';
      case 'fid':
        return value < 100 ? 'bg-green-500' : value < 300 ? 'bg-yellow-500' : 'bg-red-500';
      case 'cls':
        return value < 0.1 ? 'bg-green-500' : value < 0.25 ? 'bg-yellow-500' : 'bg-red-500';
      case 'ttfb':
        return value < 800 ? 'bg-green-500' : value < 1800 ? 'bg-yellow-500' : 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatValue = (metric: string, value: number) => {
    switch (metric) {
      case 'cls':
        return value.toFixed(3);
      case 'memoryUsage':
        return `${value.toFixed(1)}%`;
      default:
        return `${Math.round(value)}ms`;
    }
  };

  if (!showDetails) {
    // Compact view
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Card className="w-64 bg-black/80 text-white border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.lcp && (
              <div className="flex items-center justify-between">
                <span className="text-xs">LCP</span>
                <Badge className={getScoreColor('lcp', metrics.lcp)}>
                  {formatValue('lcp', metrics.lcp)}
                </Badge>
              </div>
            )}
            {metrics.fid && (
              <div className="flex items-center justify-between">
                <span className="text-xs">FID</span>
                <Badge className={getScoreColor('fid', metrics.fid)}>
                  {formatValue('fid', metrics.fid)}
                </Badge>
              </div>
            )}
            {metrics.cls !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs">CLS</span>
                <Badge className={getScoreColor('cls', metrics.cls)}>
                  {formatValue('cls', metrics.cls)}
                </Badge>
              </div>
            )}
            {metrics.memoryUsage && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Memory</span>
                  <span className="text-xs">{formatValue('memoryUsage', metrics.memoryUsage)}</span>
                </div>
                <Progress value={metrics.memoryUsage} className="h-1" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detailed view
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Web Vitals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Core Web Vitals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.fcp && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">FCP</span>
                  <Badge className={getScoreColor('fcp', metrics.fcp)}>
                    {formatValue('fcp', metrics.fcp)}
                  </Badge>
                </div>
                <Progress value={Math.min(metrics.fcp / 30, 100)} className="h-1" />
              </div>
            )}
            {metrics.lcp && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">LCP</span>
                  <Badge className={getScoreColor('lcp', metrics.lcp)}>
                    {formatValue('lcp', metrics.lcp)}
                  </Badge>
                </div>
                <Progress value={Math.min(metrics.lcp / 40, 100)} className="h-1" />
              </div>
            )}
            {metrics.fid && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">FID</span>
                  <Badge className={getScoreColor('fid', metrics.fid)}>
                    {formatValue('fid', metrics.fid)}
                  </Badge>
                </div>
                <Progress value={Math.min(metrics.fid / 3, 100)} className="h-1" />
              </div>
            )}
            {metrics.cls !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">CLS</span>
                  <Badge className={getScoreColor('cls', metrics.cls)}>
                    {formatValue('cls', metrics.cls)}
                  </Badge>
                </div>
                <Progress value={Math.min(metrics.cls * 400, 100)} className="h-1" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Network
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.ttfb && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">TTFB</span>
                  <Badge className={getScoreColor('ttfb', metrics.ttfb)}>
                    {formatValue('ttfb', metrics.ttfb)}
                  </Badge>
                </div>
                <Progress value={Math.min(metrics.ttfb / 18, 100)} className="h-1" />
              </div>
            )}
            {metrics.apiResponseTime && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">API Response</span>
                  <Badge variant="outline">
                    {formatValue('api', metrics.apiResponseTime)}
                  </Badge>
                </div>
                <Progress value={Math.min(metrics.apiResponseTime / 10, 100)} className="h-1" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resource Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.memoryUsage && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">Memory Usage</span>
                  <Badge variant="outline">
                    {formatValue('memoryUsage', metrics.memoryUsage)}
                  </Badge>
                </div>
                <Progress value={metrics.memoryUsage} className="h-1" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Hook for performance monitoring
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});

  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          setMetrics(prev => ({
            ...prev,
            ttfb: navEntry.responseStart - navEntry.fetchStart,
          }));
        }
      });
    });

    observer.observe({ entryTypes: ['navigation'] });

    return () => observer.disconnect();
  }, []);

  return metrics;
}