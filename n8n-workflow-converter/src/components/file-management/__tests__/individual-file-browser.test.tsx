import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import IndividualFileBrowser from '../individual-file-browser';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
});

// Mock alert
global.alert = jest.fn();

describe('IndividualFileBrowser', () => {
  const mockProps = {
    projectId: 'test-project-id',
    projectName: 'Test Project'
  };

  const mockFiles = [
    {
      name: 'main.js',
      url: 'https://example.com/main.js',
      size: 1024,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    },
    {
      name: 'README.md',
      url: 'https://example.com/README.md',
      size: 512,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    },
    {
      name: 'test.spec.js',
      url: 'https://example.com/test.spec.js',
      size: 256,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        files: mockFiles,
        summary: {
          totalFiles: mockFiles.length,
          totalSize: mockFiles.reduce((sum, f) => sum + f.size, 0)
        }
      })
    });
  });

  it('renders with project information', () => {
    render(<IndividualFileBrowser {...mockProps} />);

    expect(screen.getByText('Project Files')).toBeInTheDocument();
    expect(screen.getByText(/Browse and download individual files from Test Project/)).toBeInTheDocument();
  });

  it('fetches files on mount', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/test-project-id/files')
      );
    });
  });

  it('displays files after loading', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('main.js')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
      expect(screen.getByText('test.spec.js')).toBeInTheDocument();
    });
  });

  it('filters files based on search term', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('main.js')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search files...');
    fireEvent.change(searchInput, { target: { value: 'main' } });

    expect(screen.getByText('main.js')).toBeInTheDocument();
    expect(screen.queryByText('README.md')).not.toBeInTheDocument();
  });

  it('handles file selection', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('main.js')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const fileCheckbox = checkboxes.find(cb => 
      cb.closest('div')?.textContent?.includes('main.js')
    );

    if (fileCheckbox) {
      fireEvent.click(fileCheckbox);
      expect(screen.getByText(/1 files selected/)).toBeInTheDocument();
    }
  });

  it('handles select all functionality', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('main.js')).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select All/i });
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText(/3 files selected/)).toBeInTheDocument();
  });

  it('handles file download', async () => {
    // Mock createElement and appendChild/removeChild
    const mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: jest.fn()
    };
    
    const mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    const mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    const mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('main.js')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByTitle('Download file');
    fireEvent.click(downloadButtons[0]);

    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();

    mockCreateElement.mockRestore();
    mockAppendChild.mockRestore();
    mockRemoveChild.mockRestore();
  });

  it('handles copy URL functionality', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('main.js')).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByTitle('Copy download URL');
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/main.js');
    expect(global.alert).toHaveBeenCalledWith('Download URL copied to clipboard!');
  });

  it('handles file type filters', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('main.js')).toBeInTheDocument();
    });

    // Uncheck source code files
    const sourceCheckbox = screen.getByLabelText(/Source Code/);
    fireEvent.click(sourceCheckbox);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('includeSource=false')
      );
    });
  });

  it('displays error message on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    // Make fetch hang to show loading state
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<IndividualFileBrowser {...mockProps} />);

    expect(screen.getByText('Loading files...')).toBeInTheDocument();
  });

  it('formats file sizes correctly', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('1 KB')).toBeInTheDocument(); // main.js
      expect(screen.getByText('512 Bytes')).toBeInTheDocument(); // README.md
      expect(screen.getByText('256 Bytes')).toBeInTheDocument(); // test.spec.js
    });
  });

  it('sorts files correctly', async () => {
    render(<IndividualFileBrowser {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('main.js')).toBeInTheDocument();
    });

    // Change sort to size
    const sortSelect = screen.getByDisplayValue('Name');
    fireEvent.click(sortSelect);
    
    const sizeOption = screen.getByText('Size');
    fireEvent.click(sizeOption);

    // Files should be sorted by size (ascending by default)
    const fileElements = screen.getAllByText(/\.(js|md)$/);
    expect(fileElements[0]).toHaveTextContent('test.spec.js'); // smallest
    expect(fileElements[2]).toHaveTextContent('main.js'); // largest
  });
});