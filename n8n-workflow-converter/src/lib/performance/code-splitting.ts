/**
 * Code splitting utilities for lazy loading components and modules
 */

import { lazy, ComponentType } from 'react';
import dynamic from 'next/dynamic';

// Lazy loading wrapper with error boundary
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ComponentType
) {
  return lazy(() => 
    importFn().catch(error => {
      console.error('Failed to load component:', error);
      // Return a fallback component or error component
      return { 
        default: fallback || (() => <div>Failed to load component</div>) as T 
      };
    })
  );
}

// Dynamic imports with loading states
export const createDynamicComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ComponentType
) => {
  importFn: () => Promise<{ default: T }>,
  options?: {
    loading?: ComponentType;
    ssr?: boolean;
  }
) => {
  return dynamic(importFn, {
    loading: options?.loading || (() => <div className="animate-pulse">Loading...</div>),
    ssr: options?.ssr ?? true,
  });
};

// Preload critical components
export const preloadComponent = (importFn: () => Promise<any>) => {
  if (typeof window !== 'undefined') {
    // Preload on idle or after a delay
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => importFn());
    } else {
      setTimeout(() => importFn(), 100);
    }
  }
};

// Route-based code splitting
export const RouteComponents = {
  Dashboard: createDynamicComponent(
    () => import('@/components/dashboard/dashboard'),
    { ssr: true }
  ),
  
  WorkflowUpload: createDynamicComponent(
    () => import('@/components/dashboard/workflow-upload'),
    { ssr: false }
  ),
  
  ProjectManagement: createDynamicComponent(
    () => import('@/components/project/project-management'),
    { ssr: false }
  ),
  
  Analytics: createDynamicComponent(
    () => import('@/components/analytics/analytics-dashboard'),
    { ssr: false }
  ),
  
  Settings: createDynamicComponent(
    () => import('@/components/settings/settings-panel'),
    { ssr: false }
  ),
  
  FileManagement: createDynamicComponent(
    () => import('@/components/file-management/file-browser'),
    { ssr: false }
  ),
};

// Feature-based code splitting
export const FeatureComponents = {
  // Heavy components that are not always needed
  CodeEditor: createDynamicComponent(
    () => import('@/components/code/code-editor'),
    { ssr: false }
  ),
  
  ChartComponents: createDynamicComponent(
    () => import('@/components/charts/chart-bundle'),
    { ssr: false }
  ),
  
  AdvancedFilters: createDynamicComponent(
    () => import('@/components/filters/advanced-filters'),
    { ssr: false }
  ),
  
  ExportTools: createDynamicComponent(
    () => import('@/components/export/export-tools'),
    { ssr: false }
  ),
};

// Utility for bundle analysis
export const getBundleInfo = () => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    return {
      chunks: (window as any).__NEXT_DATA__?.chunks || [],
      buildId: (window as any).__NEXT_DATA__?.buildId,
    };
  }
  return null;
};