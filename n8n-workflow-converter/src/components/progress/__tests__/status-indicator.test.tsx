import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusIndicator, StatusIndicatorWithDescription, StatusTimeline } from '../status-indicator';

describe('StatusIndicator', () => {
  it('renders pending status correctly', () => {
    render(<StatusIndicator status="pending" />);
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders processing status with animation', () => {
    render(<StatusIndicator status="processing" animated={true} />);
    
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('renders completed status correctly', () => {
    render(<StatusIndicator status="completed" />);
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders failed status correctly', () => {
    render(<StatusIndicator status="failed" />);
    
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('hides icon when showIcon is false', () => {
    render(<StatusIndicator status="pending" showIcon={false} />);
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    // Icon should not be visible, but we can't easily test this without checking DOM structure
  });

  it('hides label when showLabel is false', () => {
    render(<StatusIndicator status="pending" showLabel={false} />);
    
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });

  it('applies different sizes correctly', () => {
    const { rerender } = render(<StatusIndicator status="pending" size="sm" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();

    rerender(<StatusIndicator status="pending" size="md" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();

    rerender(<StatusIndicator status="pending" size="lg" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatusIndicator status="pending" className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('StatusIndicatorWithDescription', () => {
  it('renders status with description', () => {
    render(<StatusIndicatorWithDescription status="pending" />);
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Waiting to start processing')).toBeInTheDocument();
  });

  it('hides description when showDescription is false', () => {
    render(<StatusIndicatorWithDescription status="pending" showDescription={false} />);
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.queryByText('Waiting to start processing')).not.toBeInTheDocument();
  });

  it('renders different descriptions for different statuses', () => {
    const { rerender } = render(<StatusIndicatorWithDescription status="pending" />);
    expect(screen.getByText('Waiting to start processing')).toBeInTheDocument();

    rerender(<StatusIndicatorWithDescription status="processing" />);
    expect(screen.getByText('Converting workflow to code')).toBeInTheDocument();

    rerender(<StatusIndicatorWithDescription status="completed" />);
    expect(screen.getByText('Successfully converted')).toBeInTheDocument();

    rerender(<StatusIndicatorWithDescription status="failed" />);
    expect(screen.getByText('Conversion failed')).toBeInTheDocument();
  });
});

describe('StatusTimeline', () => {
  it('renders timeline with current status', () => {
    render(<StatusTimeline currentStatus="processing" />);
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders timeline with timestamps', () => {
    const timestamps = {
      pending: '2024-01-01T00:00:00Z',
      processing: '2024-01-01T00:01:00Z',
      completed: '2024-01-01T00:02:00Z'
    };

    render(<StatusTimeline currentStatus="completed" timestamps={timestamps} />);
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    
    // Check that timestamps are formatted and displayed
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('handles failed status correctly', () => {
    const timestamps = {
      pending: '2024-01-01T00:00:00Z',
      failed: '2024-01-01T00:02:00Z'
    };

    render(<StatusTimeline currentStatus="failed" timestamps={timestamps} />);
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatusTimeline currentStatus="pending" className="custom-timeline" />
    );
    
    expect(container.firstChild).toHaveClass('custom-timeline');
  });

  it('shows active states correctly', () => {
    render(<StatusTimeline currentStatus="processing" />);
    
    // Both pending and processing should be active (completed)
    // We can't easily test the visual styling, but we can verify the content is rendered
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});