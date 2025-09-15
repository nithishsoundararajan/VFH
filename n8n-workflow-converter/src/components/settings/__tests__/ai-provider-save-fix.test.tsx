import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIProviderSettings } from '../ai-provider-settings';

// Mock the hook
const mockUpdateProvider = jest.fn();
const mockTestApiKey = jest.fn();
const mockClearSettings = jest.fn();

jest.mock('@/hooks/use-ai-provider', () => ({
  useAIProvider: () => ({
    settings: { provider: 'system_default', isValid: true },
    loading: false,
    error: null,
    testing: false,
    updating: false,
    available: true,
    updateProvider: mockUpdateProvider,
    testApiKey: mockTestApiKey,
    clearSettings: mockClearSettings,
  })
}));

describe('AIProviderSettings - Save Button Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should enable save button for system_default provider', () => {
    render(<AIProviderSettings />);
    
    const saveButton = screen.getByText('Save Settings');
    expect(saveButton).not.toBeDisabled();
  });

  it('should call updateProvider when save button is clicked', async () => {
    mockUpdateProvider.mockResolvedValue(undefined);
    
    render(<AIProviderSettings />);
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockUpdateProvider).toHaveBeenCalledWith('system_default', '');
    });
  });

  it('should show success message after successful save', async () => {
    mockUpdateProvider.mockResolvedValue(undefined);
    
    render(<AIProviderSettings />);
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Successfully updated to System Default/)).toBeInTheDocument();
    });
  });

  it('should handle save errors gracefully', async () => {
    mockUpdateProvider.mockRejectedValue(new Error('Save failed'));
    
    render(<AIProviderSettings />);
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to save settings/)).toBeInTheDocument();
    });
  });
});