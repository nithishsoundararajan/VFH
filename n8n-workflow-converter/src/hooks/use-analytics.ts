import { useEffect, useRef, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { 
  AnalyticsService, 
  getAnalyticsService,
  AnalyticsEvent,
  NodeUsageData,
  FeatureUsageData,
  PerformanceMetric,
  WorkflowComplexityData
} from '@/lib/services/analytics-service';

interface UseAnalyticsOptions {
  enableAnalytics?: boolean;
  autoTrackPageViews?: boolean;
}

interface UseAnalyticsReturn {
  trackEvent: (event: AnalyticsEvent) => Promise<void>;
  trackNodeUsage: (data: NodeUsageData) => Promise<void>;
  trackFeatureUsage: (data: FeatureUsageData) => Promise<void>;
  trackPerformanceMetric: (data: PerformanceMetric) => Promise<void>;
  trackWorkflowComplexity: (data: WorkflowComplexityData) => Promise<void>;
  trackProjectGeneration: (
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
  ) => Promise<void>;
  trackPageView: (page: string, additionalData?: Record<string, any>) => Promise<void>;
  trackLogin: (method?: string) => Promise<void>;
  trackLogout: () => Promise<void>;
  trackError: (error: Error, context?: Record<string, any>) => Promise<void>;
  getUserAnalyticsSummary: () => Promise<any>;
  calculateWorkflowComplexity: (workflowJson: any) => Promise<number>;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsReturn {
  const supabase = useSupabaseClient();
  const analyticsRef = useRef<AnalyticsService | null>(null);
  const { enableAnalytics = true, autoTrackPageViews = true } = options;

  // Initialize analytics service
  useEffect(() => {
    if (!analyticsRef.current) {
      analyticsRef.current = getAnalyticsService(supabase, enableAnalytics);
    }
  }, [supabase, enableAnalytics]);

  // Auto-track page views
  useEffect(() => {
    if (autoTrackPageViews && analyticsRef.current) {
      const currentPath = window.location.pathname;
      analyticsRef.current.trackPageView(currentPath, {
        referrer: document.referrer,
        userAgent: navigator.userAgent
      });
    }
  }, [autoTrackPageViews]);

  // Track performance metrics on page load
  useEffect(() => {
    if (analyticsRef.current && typeof window !== 'undefined') {
      // Track page load performance
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          analyticsRef.current?.trackPerformanceMetric({
            metricType: 'page_load_time',
            metricValue: navigation.loadEventEnd - navigation.fetchStart,
            metricUnit: 'ms',
            contextData: {
              page: window.location.pathname,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
              firstContentfulPaint: navigation.loadEventStart - navigation.fetchStart
            }
          });
        }
      });

      // Track unhandled errors
      window.addEventListener('error', (event) => {
        analyticsRef.current?.trackError(event.error, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          page: window.location.pathname
        });
      });

      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        analyticsRef.current?.trackError(new Error(event.reason), {
          type: 'unhandled_promise_rejection',
          page: window.location.pathname
        });
      });
    }
  }, []);

  const trackEvent = useCallback(async (event: AnalyticsEvent) => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackEvent(event);
    }
  }, []);

  const trackNodeUsage = useCallback(async (data: NodeUsageData) => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackNodeUsage(data);
    }
  }, []);

  const trackFeatureUsage = useCallback(async (data: FeatureUsageData) => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackFeatureUsage(data);
    }
  }, []);

  const trackPerformanceMetric = useCallback(async (data: PerformanceMetric) => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackPerformanceMetric(data);
    }
  }, []);

  const trackWorkflowComplexity = useCallback(async (data: WorkflowComplexityData) => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackWorkflowComplexity(data);
    }
  }, []);

  const trackProjectGeneration = useCallback(async (
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
  ) => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackProjectGeneration(
        projectId,
        generationTimeMs,
        fileSizeBytes,
        nodeTypes,
        complexityScore,
        additionalMetrics
      );
    }
  }, []);

  const trackPageView = useCallback(async (page: string, additionalData?: Record<string, any>) => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackPageView(page, additionalData);
    }
  }, []);

  const trackLogin = useCallback(async (method: string = 'email') => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackLogin(method);
    }
  }, []);

  const trackLogout = useCallback(async () => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackLogout();
    }
  }, []);

  const trackError = useCallback(async (error: Error, context?: Record<string, any>) => {
    if (analyticsRef.current) {
      await analyticsRef.current.trackError(error, context);
    }
  }, []);

  const getUserAnalyticsSummary = useCallback(async () => {
    if (analyticsRef.current) {
      return await analyticsRef.current.getUserAnalyticsSummary();
    }
    return null;
  }, []);

  const calculateWorkflowComplexity = useCallback(async (workflowJson: any) => {
    if (analyticsRef.current) {
      return await analyticsRef.current.calculateWorkflowComplexity(workflowJson);
    }
    return 0;
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    if (analyticsRef.current) {
      analyticsRef.current.setEnabled(enabled);
    }
  }, []);

  return {
    trackEvent,
    trackNodeUsage,
    trackFeatureUsage,
    trackPerformanceMetric,
    trackWorkflowComplexity,
    trackProjectGeneration,
    trackPageView,
    trackLogin,
    trackLogout,
    trackError,
    getUserAnalyticsSummary,
    calculateWorkflowComplexity,
    isEnabled: enableAnalytics,
    setEnabled
  };
}

// Higher-order component for automatic analytics tracking
export function withAnalytics<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureName: string
) {
  return function AnalyticsWrapper(props: P) {
    const { trackFeatureUsage } = useAnalytics();
    const startTimeRef = useRef<number>(Date.now());

    useEffect(() => {
      // Track feature usage on mount
      trackFeatureUsage({
        featureName,
        usageCount: 1
      });

      return () => {
        // Track session duration on unmount
        const sessionDuration = Date.now() - startTimeRef.current;
        trackFeatureUsage({
          featureName,
          sessionDurationMs: sessionDuration
        });
      };
    }, [trackFeatureUsage]);

    return <WrappedComponent {...props} />;
  };
}

export default useAnalytics;