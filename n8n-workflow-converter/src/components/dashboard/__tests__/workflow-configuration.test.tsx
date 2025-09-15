import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkflowConfiguration } from '../workflow-configuration';

// Mock the UI components
jest.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, disabled, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} {...props}>
            {children}
        </button>
    )
}));

jest.mock('@/components/ui/card', () => ({
    Card: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

jest.mock('@/components/ui/input', () => ({
    Input: ({ onChange, value, ...props }: any) => (
        <input onChange={onChange} value={value} {...props} />
    )
}));

jest.mock('@/components/ui/label', () => ({
    Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}));

jest.mock('@/components/ui/textarea', () => ({
    Textarea: ({ onChange, value, ...props }: any) => (
        <textarea onChange={onChange} value={value} {...props} />
    )
}));

jest.mock('@/components/ui/alert', () => ({
    Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

jest.mock('@/components/ui/select', () => ({
    Select: ({ onChange, value, children, ...props }: any) => (
        <select onChange={onChange} value={value} {...props}>
            {children}
        </select>
    )
}));

const mockWorkflowMetadata = {
    name: 'Test Workflow',
    nodeCount: 5,
    triggerCount: 1,
    connections: 4,
    nodeTypes: ['HttpRequest', 'Set', 'Code'],
    hasCredentials: true
};

const mockOnConfigurationComplete = jest.fn();
const mockOnBack = jest.fn();

describe('WorkflowConfiguration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render workflow configuration form', () => {
        render(
            <WorkflowConfiguration
                workflowMetadata={mockWorkflowMetadata}
                onConfigurationComplete={mockOnConfigurationComplete}
                onBack={mockOnBack}
            />
        );

        expect(screen.getByText('Configure Project')).toBeInTheDocument();
        expect(screen.getByText('Project Settings')).toBeInTheDocument();
        expect(screen.getByText('Environment Variables')).toBeInTheDocument();
    });

    it('should initialize with default configuration', () => {
        render(
            <WorkflowConfiguration
                workflowMetadata={mockWorkflowMetadata}
                onConfigurationComplete={mockOnConfigurationComplete}
                onBack={mockOnBack}
            />
        );

        const projectNameInput = screen.getByDisplayValue('Test Workflow');
        expect(projectNameInput).toBeInTheDocument();
    });

    it('should validate project name', async () => {
        render(
            <WorkflowConfiguration
                workflowMetadata={mockWorkflowMetadata}
                onConfigurationComplete={mockOnConfigurationComplete}
                onBack={mockOnBack}
            />
        );

        const projectNameInput = screen.getByDisplayValue('Test Workflow');
        const generateButton = screen.getByText('Generate Project');

        // Clear project name
        fireEvent.change(projectNameInput, { target: { value: '' } });
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(screen.getByText('Project name is required')).toBeInTheDocument();
        });
    });

    it('should sanitize project name input', () => {
        render(
            <WorkflowConfiguration
                workflowMetadata={mockWorkflowMetadata}
                onConfigurationComplete={mockOnConfigurationComplete}
                onBack={mockOnBack}
            />
        );

        const projectNameInput = screen.getByDisplayValue('Test Workflow');

        // Input invalid characters
        fireEvent.change(projectNameInput, { target: { value: 'test@project!' } });

        // Should be sanitized to remove invalid characters
        expect((projectNameInput as HTMLInputElement).value).toBe('testproject');
    });

    it('should add environment variables', () => {
        render(
            <WorkflowConfiguration
                workflowMetadata={mockWorkflowMetadata}
                onConfigurationComplete={mockOnConfigurationComplete}
                onBack={mockOnBack}
            />
        );

        const addButton = screen.getByText('Add Variable');
        fireEvent.click(addButton);

        // Should have added a new environment variable row
        const envKeyInputs = screen.getAllByPlaceholderText('API_KEY');
        expect(envKeyInputs.length).toBeGreaterThan(0);
    });

    it('should validate environment variable names', async () => {
        render(
            <WorkflowConfiguration
                workflowMetadata={mockWorkflowMetadata}
                onConfigurationComplete={mockOnConfigurationComplete}
                onBack={mockOnBack}
            />
        );

        const addButton = screen.getByText('Add Variable');
        fireEvent.click(addButton);

        const envKeyInput = screen.getByPlaceholderText('API_KEY');
        const generateButton = screen.getByText('Generate Project');

        // Enter invalid environment variable name
        fireEvent.change(envKeyInput, { target: { value: 'invalid-name' } });
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(screen.getByText('Environment variable name must be uppercase with underscores')).toBeInTheDocument();
        });
    });

    it('should call onConfigurationComplete with valid configuration', async () => {
        render(
            <WorkflowConfiguration
                workflowMetadata={mockWorkflowMetadata}
                onConfigurationComplete={mockOnConfigurationComplete}
                onBack={mockOnBack}
            />
        );

        const generateButton = screen.getByText('Generate Project');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(mockOnConfigurationComplete).toHaveBeenCalledWith(
                expect.objectContaining({
                    projectName: expect.any(String),
                    description: expect.any(String),
                    outputFormat: expect.any(String),
                    includeDocumentation: expect.any(Boolean),
                    includeTests: expect.any(Boolean),
                    nodeVersion: expect.any(String),
                    packageManager: expect.any(String),
                    environmentVariables: expect.any(Array)
                })
            );
        });
    });

    it('should call onBack when back button is clicked', () => {
        render(
            <WorkflowConfiguration
                workflowMetadata={mockWorkflowMetadata}
                onConfigurationComplete={mockOnConfigurationComplete}
                onBack={mockOnBack}
            />
        );

        const backButton = screen.getByText('Back to Upload');
        fireEvent.click(backButton);

        expect(mockOnBack).toHaveBeenCalled();
    });
});