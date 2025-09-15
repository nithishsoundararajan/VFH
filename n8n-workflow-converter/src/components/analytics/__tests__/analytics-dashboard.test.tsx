import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalyticsDashboard } from '../analytics-dashboard';
import { useAnalytics } from '@/hooks/use-analytics';

// Mock the analytics hook
jest.mock('@/hooks/use-analytics');
const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;

// Mock the chart components
jest.mock('../user-stats-card', () => ({
  UserStatsCard: ({ title, value }: any) => (
    <div data-testid="user-stats-card">
      <span>{title}: {value}</span>
    </div>
  )
}));

jest.mock('../node-usage-chart', () => ({
  NodeUsageChart: () => <div data-testid="node-usage-chart">Node Usage Chart</div>
}));

jest.mock('../performance-chart', () => ({
  PerformanceChart: () => <div data-testid="performance-chart">Performance Chart</div>
}));

jest.mock('../complexity-analysis', () => ({
  ComplexityAnalysis: () => <div data-testid="complexity-analysis">Complexity Analysis</div>
}));

jest.mock('../usage-patterns', () => ({
  UsagePatterns: () => <div data-testid="usage-patterns">Usage Patterns</div>
}));

jest.mock('../optimization-recommendations', () => ({
  OptimizationRecommendations: () => <div data-testid="optimization-recommendations">Optimization Recommendations</div>
}));

describe('AnalyticsDashboard', () => {
  const mockGetUserAnalyticsSummary = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAnalytics.mockReturnValue({
      getUserAnalyticsSummary: mockGetUserAnalyticsSummary,
      isEnabled: true,
      trackEvent: jest.fn(),
      trackNodeUsage: jest.fn(),
      trackFeatureUsage: jest.fn(),
      trackPerformanceMetric: jest.fn(),
      trackWorkflowComplexity: jest.fn(),
      trackProjectGeneration: jest.fn(),
      trackPageView: jest.fn(),
      trackLogin: jest.fn(),
      trackLogout: jest.fn(),
      trackError: jest.fn(),
      calculateWorkflowComplexity: jest.fn(),
      setEnabled: jest.fn()
    });
  });

  it('should render analytics dashboard when enabled', async () => {
    const mockSummary = {
      total_projects: 5,
      total_downloads: 3,
      avg_generation_time_ms: 2500,
      total_sessions: 10,
      most_used_node_type: 'HttpRequest',
      last_activity: '2023-12-01T10:00:00Z'
    };

    mockGetUserAnalyticsSummary.mockResolvedValue(mockSummary);

    render(<AnalyticsDashboard />);

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Insights into your workflow conversion patterns and usage')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total Projects: 5')).toBeInTheDocument();
      expect(screen.getByText('Downloads: 3')).toBeInTheDocument();
      expect(screen.getByText('Avg Generation Time: 3s')).toBeInTheDocument();
      expect(screen.getByText('Active Sessions: 10')).toBeInTheDocument();
    });
  });

  it('should show disabled message when analytics is disabled', () => {
    mockUseAnalytics.mockReturnValue({
      getUserAnalyticsSummary: mockGetUserAnalyticsSummary,
      isEnabled: false,
      trackEvent: jest.fn(),
      trackNodeUsage: jest.fn(),
      trackFeatureUsage: jest.fn(),
      trackPerformanceMetric: jest.fn(),
      trackWorkflowComplexity: jest.fn(),
      trackProjectGeneration: jest.fn(),
      trackPageView: jest.fn(),
      trackLogin: jest.fn(),
      trackLogout: jest.fn(),
      trackError: jest.fn(),
      calculateWorkflowComplexity: jest.fn(),
      setEnabled: jest.fn()
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByText('Analytics are currently disabled. Enable analytics in settings to view insights.')).toBeInTheDocument();
    expect(screen.getByText('Enable Analytics')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    mockGetUserAnalyticsSummary.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<AnalyticsDashboard />);

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('should handle refresh button click', async () => {
    const mockSummary = {
      total_projects: 5,
      total_downloads: 3,
      avg_generation_time_ms: 2500,
      total_sessions: 10
    };

    mockGetUserAnalyticsSummary.mockResolvedValue(mockSummary);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Projects: 5')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await userEvent.click(refreshButton);

    expect(mockGetUserAnalyticsSummary).toHaveBeenCalledTimes(2);
  });

  it('should render all tab content', async () => {
    const mockSummary = {
      total_projects: 5,
      total_downloads: 3,
      avg_generation_time_ms: 2500,
      total_sessions: 10,
      most_used_node_type: 'HttpRequest'
    };

    mockGetUserAnalyticsSummary.mockResolvedValue(mockSummary);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Projects: 5')).toBeInTheDocument();
    });

    // Test tab navigation
    const nodeUsageTab = screen.getByRole('tab', { name: /node usage/i });
    await userEvent.click(nodeUsageTab);
    expect(screen.getByTestId('node-usage-chart')).toBeInTheDocument();

    const performanceTab = screen.getByRole('tab', { name: /performance/i });
    await userEvent.click(performanceTab);
    expect(screen.getByTestId('performance-chart')).toBeInTheDocument();

    const complexityTab = screen.getByRole('tab', { name: /complexity/i });
    await userEvent.click(complexityTab);
    expect(screen.getByTestId('complexity-analysis')).toBeInTheDocument();

    const patternsTab = screen.getByRole('tab', { name: /patterns/i });
    await userEvent.click(patternsTab);
    expect(screen.getByTestId('usage-patterns')).toBeInTheDocument();
    expect(screen.getByTestId('optimization-recommendations')).toBeInTheDocument();
  });

  it('should display most used node type', async () => {
    const mockSummary = {
      total_projects: 5,
      most_used_node_type: 'HttpRequest',
      last_activity: '2023-12-01T10:00:00Z'
    };

    mockGetUserAnalyticsSummary.mockResolvedValue(mockSummary);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('HttpRequest')).toBeInTheDocument();
      expect(screen.getByText('Primary node type in your workflows')).toBeInTheDocument();
    });
  });

  it('should display last activity date', async () => {
    const mockSummary = {
      total_projects: 5,
      last_activity: '2023-12-01T10:00:00Z'
    };

    mockGetUserAnalyticsSummary.mockResolvedValue(mockSummary);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('12/1/2023')).toBeInTheDocument(); // Formatted date
    });
  });

  it('should handle missing summary data gracefully', async () => {
    mockGetUserAnalyticsSummary.mockResolvedValue(null);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Projects: 0')).toBeInTheDocument();
      expect(screen.getByText('Downloads: 0')).toBeInTheDocument();
      expect(screen.getByText('Avg Generation Time: N/A')).toBeInTheDocument();
      expect(screen.getByText('Active Sessions: 0')).toBeInTheDocument();
    });
  });

  it('should handle analytics service errors gracefully', async () => {
    mockGetUserAnalyticsSummary.mockRejectedValue(new Error('Analytics service error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Projects: 0')).toBeInTheDocument();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load analytics summary:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});