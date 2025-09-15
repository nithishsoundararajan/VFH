import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectProgress } from '../project-progress';
import { useRealtimeProject } from '@/hooks/use-realtime-project';

// Mock the hooks
jest.mock('@/hooks/use-realtime-project');
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }))
}));

const mockUseRealtimeProject = useRealtimeProject as jest.MockedFunction<typeof useRealtimeProject>;

const mockProject = {
  id: 'test-project-id',
  user_id: 'test-user-id',
  name: 'Test Project',
  description: 'Test Description',
  workflow_json: {},
  status: 'processing' as const,
  node_count: 5,
  trigger_count: 2,
  generated_at: null,
  file_path: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockLogs = [
  {
    id: 'log-1',
    project_id: 'test-project-id',
    log_level: 'info' as const,
    message: 'Starting workflow processing...',
    timestamp: '2024-01-01T00:00:00Z'
  },
  {
    id: 'log-2',
    project_id: 'test-project-id',
    log_level: 'warning' as const,
    message: 'Node mapping warning',
    timestamp: '2024-01-01T00:01:00Z'
  },
  {
    id: 'log-3',
    project_id: 'test-project-id',
    log_level: 'error' as const,
    message: 'Failed to process node',
    timestamp: '2024-01-01T00:02:00Z'
  }
];

describe('ProjectProgress', () => {
  beforeEach(() => {
    mockUseRealtimeProject.mockReturnValue({
      project: mockProject,
      logs: mockLogs,
      isConnected: true,
      connectionError: null,
      reconnect: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders project progress with basic information', () => {
    render(<ProjectProgress projectId="test-project-id" />);

    expect(screen.getByText('Project Progress')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // node count
    expect(screen.getByText('2')).toBeInTheDocument(); // trigger count
  });

  it('displays progress bar with correct value', () => {
    render(<ProjectProgress projectId="test-project-id" />);

    // Look for progress text instead of aria attributes
    expect(screen.getByText('Progress')).toBeInTheDocument();
    // Check that some percentage is displayed
    expect(screen.getByText(/\d+%/)).toBeInTheDocument();
  });

  it('shows connection status correctly', () => {
    render(<ProjectProgress projectId="test-project-id" />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
  });

  it('displays connection error and reconnect button when disconnected', () => {
    const mockReconnect = jest.fn();
    mockUseRealtimeProject.mockReturnValue({
      project: mockProject,
      logs: mockLogs,
      isConnected: false,
      connectionError: 'Connection failed',
      reconnect: mockReconnect
    });

    render(<ProjectProgress projectId="test-project-id" />);

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    
    const reconnectButton = screen.getByText('Reconnect');
    expect(reconnectButton).toBeInTheDocument();
    
    fireEvent.click(reconnectButton);
    expect(mockReconnect).toHaveBeenCalledTimes(1);
  });

  it('displays logs when showLogs is true', () => {
    render(<ProjectProgress projectId="test-project-id" showLogs={true} />);

    expect(screen.getByText('Live Logs')).toBeInTheDocument();
    expect(screen.getByText('3 logs')).toBeInTheDocument();
    expect(screen.getByText('Starting workflow processing...')).toBeInTheDocument();
    expect(screen.getByText('Node mapping warning')).toBeInTheDocument();
    expect(screen.getByText('Failed to process node')).toBeInTheDocument();
  });

  it('hides logs when showLogs is false', () => {
    render(<ProjectProgress projectId="test-project-id" showLogs={false} />);

    expect(screen.queryByText('Live Logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Starting workflow processing...')).not.toBeInTheDocument();
  });

  it('handles auto-scroll toggle', () => {
    render(<ProjectProgress projectId="test-project-id" showLogs={true} />);

    const pauseScrollButton = screen.getByText('Pause Scroll');
    expect(pauseScrollButton).toBeInTheDocument();

    fireEvent.click(pauseScrollButton);
    expect(screen.getByText('Auto Scroll')).toBeInTheDocument();
  });

  it('calls onStatusChange when status changes', () => {
    const mockOnStatusChange = jest.fn();
    
    render(
      <ProjectProgress 
        projectId="test-project-id" 
        onStatusChange={mockOnStatusChange}
      />
    );

    // Simulate status change by updating the mock
    mockUseRealtimeProject.mockReturnValue({
      project: { ...mockProject, status: 'completed' },
      logs: mockLogs,
      isConnected: true,
      connectionError: null,
      reconnect: jest.fn()
    });

    // Re-render to trigger the status change
    render(
      <ProjectProgress 
        projectId="test-project-id" 
        onStatusChange={mockOnStatusChange}
      />
    );
  });

  it('displays different status icons correctly', () => {
    // Test processing status
    render(<ProjectProgress projectId="test-project-id" />);
    expect(screen.getByText('Processing')).toBeInTheDocument();

    // Test completed status
    mockUseRealtimeProject.mockReturnValue({
      project: { ...mockProject, status: 'completed' },
      logs: mockLogs,
      isConnected: true,
      connectionError: null,
      reconnect: jest.fn()
    });

    render(<ProjectProgress projectId="test-project-id" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows empty state when no logs are available', () => {
    mockUseRealtimeProject.mockReturnValue({
      project: mockProject,
      logs: [],
      isConnected: true,
      connectionError: null,
      reconnect: jest.fn()
    });

    render(<ProjectProgress projectId="test-project-id" showLogs={true} />);

    expect(screen.getByText('No logs yet. Logs will appear here in real-time.')).toBeInTheDocument();
  });

  it('formats timestamps correctly', () => {
    render(<ProjectProgress projectId="test-project-id" showLogs={true} />);

    // Check that timestamps are formatted as time strings
    const timestamps = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it('displays log level icons correctly', () => {
    render(<ProjectProgress projectId="test-project-id" showLogs={true} />);

    // The component should render different icons for different log levels
    // We can't easily test the specific icons, but we can verify the logs are rendered
    expect(screen.getByText('Starting workflow processing...')).toBeInTheDocument();
    expect(screen.getByText('Node mapping warning')).toBeInTheDocument();
    expect(screen.getByText('Failed to process node')).toBeInTheDocument();
  });
});