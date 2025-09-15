import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import DownloadManager from '../download-manager';

// Mock the child components
jest.mock('../project-download', () => {
  return function MockProjectDownload({ projectId, projectName, projectStatus }: any) {
    return (
      <div data-testid="project-download">
        Project Download: {projectId} - {projectName} - {projectStatus}
      </div>
    );
  };
});

jest.mock('../download-history', () => {
  return function MockDownloadHistory() {
    return <div data-testid="download-history">Download History</div>;
  };
});

jest.mock('../individual-file-browser', () => {
  return function MockIndividualFileBrowser({ projectId, projectName }: any) {
    return (
      <div data-testid="individual-file-browser">
        File Browser: {projectId} - {projectName}
      </div>
    );
  };
});

describe('DownloadManager', () => {
  const mockProps = {
    projectId: 'test-project-id',
    projectName: 'Test Project',
    projectStatus: 'completed' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with all tabs', () => {
    render(<DownloadManager {...mockProps} />);

    expect(screen.getByText('Download Project')).toBeInTheDocument();
    expect(screen.getByText('Browse Files')).toBeInTheDocument();
    expect(screen.getByText('Download History')).toBeInTheDocument();
  });

  it('shows project download by default', () => {
    render(<DownloadManager {...mockProps} />);

    expect(screen.getByTestId('project-download')).toBeInTheDocument();
    expect(screen.getByText(/Project Download: test-project-id/)).toBeInTheDocument();
  });

  it('switches to files tab when clicked', async () => {
    render(<DownloadManager {...mockProps} />);

    const filesTab = screen.getByText('Browse Files');
    fireEvent.click(filesTab);

    await waitFor(() => {
      expect(screen.getByTestId('individual-file-browser')).toBeInTheDocument();
    });
  });

  it('switches to history tab when clicked', async () => {
    render(<DownloadManager {...mockProps} />);

    const historyTab = screen.getByText('Download History');
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(screen.getByTestId('download-history')).toBeInTheDocument();
    });
  });

  it('shows placeholder when no project is provided', () => {
    render(<DownloadManager />);

    expect(screen.getByText('No project selected. Please select a project from your dashboard to download.')).toBeInTheDocument();
  });

  it('disables files tab when no project ID is provided', () => {
    render(<DownloadManager />);

    const filesTab = screen.getByRole('tab', { name: /Browse Files/ });
    expect(filesTab).toHaveAttribute('data-state', 'inactive');
    expect(filesTab).toBeDisabled();
  });

  it('enables all tabs when project is provided', () => {
    render(<DownloadManager {...mockProps} />);

    const downloadTab = screen.getByRole('tab', { name: /Download Project/ });
    const filesTab = screen.getByRole('tab', { name: /Browse Files/ });
    const historyTab = screen.getByRole('tab', { name: /Download History/ });

    expect(downloadTab).not.toBeDisabled();
    expect(filesTab).not.toBeDisabled();
    expect(historyTab).not.toBeDisabled();
  });

  it('passes correct props to child components', () => {
    render(<DownloadManager {...mockProps} />);

    // Check project download props
    expect(screen.getByText(/test-project-id - Test Project - completed/)).toBeInTheDocument();

    // Switch to files tab and check props
    const filesTab = screen.getByText('Browse Files');
    fireEvent.click(filesTab);

    expect(screen.getByText(/File Browser: test-project-id - Test Project/)).toBeInTheDocument();
  });
});