'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { ConfigurationValidator } from '@/lib/validation/configuration';
import {
  Settings,
  Plus,
  Trash2,
  AlertCircle,
  Info,
  Key,
  Package,
  FileText,
  Shield
} from 'lucide-react';

interface WorkflowMetadata {
  name: string;
  nodeCount: number;
  triggerCount: number;
  connections: number;
  nodeTypes: string[];
  hasCredentials: boolean;
}

interface EnvironmentVariable {
  key: string;
  value: string;
  description?: string;
  required: boolean;
}

interface ProjectConfiguration {
  projectName: string;
  description: string;
  outputFormat: 'zip' | 'tar.gz';
  includeDocumentation: boolean;
  includeTests: boolean;
  nodeVersion: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  environmentVariables: EnvironmentVariable[];
}

interface WorkflowConfigurationProps {
  workflowMetadata: WorkflowMetadata;
  onConfigurationComplete: (config: ProjectConfiguration) => void;
  onBack?: () => void;
}

export function WorkflowConfiguration({
  workflowMetadata,
  onConfigurationComplete,
  onBack
}: WorkflowConfigurationProps) {
  const [configuration, setConfiguration] = useState<ProjectConfiguration>({
    projectName: workflowMetadata.name || 'n8n-workflow-project',
    description: `Converted n8n workflow with ${workflowMetadata.nodeCount} nodes`,
    outputFormat: 'zip',
    includeDocumentation: true,
    includeTests: false,
    nodeVersion: '20',
    packageManager: 'npm',
    environmentVariables: []
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize environment variables based on workflow metadata
  useEffect(() => {
    if (workflowMetadata.hasCredentials) {
      const defaultEnvVars: EnvironmentVariable[] = [
        {
          key: 'NODE_ENV',
          value: 'production',
          description: 'Node.js environment',
          required: true
        }
      ];

      // Add common credential environment variables based on node types
      workflowMetadata.nodeTypes.forEach(nodeType => {
        switch (nodeType.toLowerCase()) {
          case 'httprequest':
            if (!defaultEnvVars.find(env => env.key === 'API_BASE_URL')) {
              defaultEnvVars.push({
                key: 'API_BASE_URL',
                value: '',
                description: 'Base URL for HTTP requests',
                required: false
              });
            }
            break;
          case 'gmail':
            defaultEnvVars.push({
              key: 'GMAIL_CLIENT_ID',
              value: '',
              description: 'Gmail OAuth client ID',
              required: true
            });
            defaultEnvVars.push({
              key: 'GMAIL_CLIENT_SECRET',
              value: '',
              description: 'Gmail OAuth client secret',
              required: true
            });
            break;
          case 'slack':
            defaultEnvVars.push({
              key: 'SLACK_BOT_TOKEN',
              value: '',
              description: 'Slack bot token',
              required: true
            });
            break;
          case 'webhook':
            defaultEnvVars.push({
              key: 'WEBHOOK_SECRET',
              value: '',
              description: 'Webhook verification secret',
              required: false
            });
            break;
        }
      });

      setConfiguration(prev => ({
        ...prev,
        environmentVariables: defaultEnvVars
      }));
    }
  }, [workflowMetadata]);

  // Enhanced validation using the validation utility
  const validateConfiguration = (): boolean => {
    const validationErrors = ConfigurationValidator.validateConfiguration(configuration);

    // Convert validation errors to the format expected by the component
    const errors: Record<string, string> = {};
    validationErrors.forEach(error => {
      errors[error.field] = error.message;
    });

    setValidationErrors(errors);
    return validationErrors.length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateConfiguration()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Sanitize configuration before submission using the validation utility
      const sanitizedConfig = ConfigurationValidator.sanitizeConfiguration(configuration);

      onConfigurationComplete(sanitizedConfig);
    } catch (error) {
      console.error('Configuration submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Environment variable handlers
  const addEnvironmentVariable = () => {
    setConfiguration(prev => ({
      ...prev,
      environmentVariables: [
        ...prev.environmentVariables,
        { key: '', value: '', description: '', required: false }
      ]
    }));
  };

  const updateEnvironmentVariable = (index: number, field: keyof EnvironmentVariable, value: string | boolean) => {
    setConfiguration(prev => ({
      ...prev,
      environmentVariables: prev.environmentVariables.map((envVar, i) => {
        if (i === index) {
          // Sanitize string inputs using the validation utility
          if (typeof value === 'string') {
            let sanitizedValue = value;

            if (field === 'key') {
              sanitizedValue = ConfigurationValidator.sanitizeEnvKey(value);
            } else if (field === 'value') {
              // For values, preserve content but trim whitespace
              sanitizedValue = value.trim();
            } else if (field === 'description') {
              sanitizedValue = ConfigurationValidator.sanitizeString(value, { maxLength: 200 });
            }

            return { ...envVar, [field]: sanitizedValue };
          }

          return { ...envVar, [field]: value };
        }
        return envVar;
      })
    }));
  };

  const removeEnvironmentVariable = (index: number) => {
    setConfiguration(prev => ({
      ...prev,
      environmentVariables: prev.environmentVariables.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Configure Project</h2>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Workflow Summary</h4>
              <p className="text-sm text-blue-800">
                {workflowMetadata.name} • {workflowMetadata.nodeCount} nodes • {workflowMetadata.triggerCount} triggers
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {workflowMetadata.nodeTypes.slice(0, 5).map((nodeType, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                  >
                    {nodeType}
                  </span>
                ))}
                {workflowMetadata.nodeTypes.length > 5 && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    +{workflowMetadata.nodeTypes.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Project Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Project Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="projectName">Project Name *</Label>
              <Input
                id="projectName"
                value={configuration.projectName}
                onChange={(e) => {
                  // Sanitize project name input using the validation utility
                  const sanitized = ConfigurationValidator.sanitizeProjectName(e.target.value);
                  setConfiguration(prev => ({ ...prev, projectName: sanitized }));
                }}
                placeholder="my-n8n-project"
                className={validationErrors.projectName ? 'border-red-500' : ''}
                maxLength={50}
              />
              {validationErrors.projectName && (
                <p className="text-sm text-destructive mt-1">{validationErrors.projectName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="nodeVersion">Node.js Version</Label>
              <Select
                value={configuration.nodeVersion}
                onChange={(e) => setConfiguration(prev => ({ ...prev, nodeVersion: e.target.value }))}
              >
                <option value="18">Node.js 18 LTS</option>
                <option value="20">Node.js 20 LTS</option>
                <option value="22">Node.js 22</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="packageManager">Package Manager</Label>
              <Select
                value={configuration.packageManager}
                onChange={(e) =>
                  setConfiguration(prev => ({ ...prev, packageManager: e.target.value as 'npm' | 'yarn' | 'pnpm' }))
                }
              >
                <option value="npm">npm</option>
                <option value="yarn">Yarn</option>
                <option value="pnpm">pnpm</option>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="outputFormat">Output Format</Label>
              <Select
                value={configuration.outputFormat}
                onChange={(e) =>
                  setConfiguration(prev => ({ ...prev, outputFormat: e.target.value as 'zip' | 'tar.gz' }))
                }
              >
                <option value="zip">ZIP Archive</option>
                <option value="tar.gz">TAR.GZ Archive</option>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Additional Options</Label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={configuration.includeDocumentation}
                    onChange={(e) => setConfiguration(prev => ({
                      ...prev,
                      includeDocumentation: e.target.checked
                    }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Include documentation</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={configuration.includeTests}
                    onChange={(e) => setConfiguration(prev => ({
                      ...prev,
                      includeTests: e.target.checked
                    }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Include test templates</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={configuration.description}
            onChange={(e) => {
              // Sanitize description input using the validation utility
              const sanitized = ConfigurationValidator.sanitizeString(e.target.value, { maxLength: 500 });
              setConfiguration(prev => ({ ...prev, description: sanitized }));
            }}
            placeholder="Describe your converted workflow project..."
            rows={3}
            maxLength={500}
            className={validationErrors.description ? 'border-red-500' : ''}
          />
          {validationErrors.description && (
            <p className="text-sm text-destructive mt-1">{validationErrors.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {configuration.description.length}/500 characters
          </p>
        </div>
      </Card>

      {/* Environment Variables */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Environment Variables</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addEnvironmentVariable}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Variable
          </Button>
        </div>

        {workflowMetadata.hasCredentials && (
          <Alert className="mb-4 border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <div className="text-yellow-800">
              <strong>Credentials Required:</strong> This workflow contains nodes that require credentials.
              Configure the environment variables below to ensure proper functionality.
              <div className="mt-2 text-sm">
                <strong>Security Note:</strong> Sensitive values will be stored securely and never logged or exposed in generated code.
              </div>
            </div>
          </Alert>
        )}

        <Alert className="mb-4 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <div className="text-blue-800">
            <strong>Environment Variables:</strong> These will be used to generate a secure .env.example file.
            Actual values will be stored securely in the database and referenced in your generated project.
          </div>
        </Alert>

        <div className="space-y-4">
          {configuration.environmentVariables.map((envVar, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-lg">
              <div className="md:col-span-3">
                <Label htmlFor={`envKey_${index}`}>Variable Name</Label>
                <Input
                  id={`envKey_${index}`}
                  value={envVar.key}
                  onChange={(e) => updateEnvironmentVariable(index, 'key', e.target.value)}
                  placeholder="API_KEY"
                  className={validationErrors[`envVar_${index}_key`] ? 'border-destructive' : ''}
                />
                {validationErrors[`envVar_${index}_key`] && (
                  <p className="text-sm text-destructive mt-1">{validationErrors[`envVar_${index}_key`]}</p>
                )}
              </div>

              <div className="md:col-span-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`envValue_${index}`}>Value</Label>
                  {(envVar.key.toLowerCase().includes('secret') ||
                    envVar.key.toLowerCase().includes('password') ||
                    envVar.key.toLowerCase().includes('key')) && (
                      <div title="Sensitive value">
                        <Shield className="h-3 w-3 text-yellow-600" />
                      </div>
                    )}
                </div>
                <Input
                  id={`envValue_${index}`}
                  type={envVar.key.toLowerCase().includes('secret') || envVar.key.toLowerCase().includes('password') ? 'password' : 'text'}
                  value={envVar.value}
                  onChange={(e) => updateEnvironmentVariable(index, 'value', e.target.value)}
                  placeholder="your-api-key-here"
                  className={validationErrors[`envVar_${index}_value`] ? 'border-red-500' : ''}
                  maxLength={1000}
                />
                {validationErrors[`envVar_${index}_value`] && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors[`envVar_${index}_value`]}</p>
                )}
              </div>

              <div className="md:col-span-4">
                <Label htmlFor={`envDesc_${index}`}>Description</Label>
                <Input
                  id={`envDesc_${index}`}
                  value={envVar.description || ''}
                  onChange={(e) => updateEnvironmentVariable(index, 'description', e.target.value)}
                  placeholder="Description of this variable"
                  maxLength={200}
                  className={validationErrors[`envVar_${index}_description`] ? 'border-red-500' : ''}
                />
                {validationErrors[`envVar_${index}_description`] && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors[`envVar_${index}_description`]}</p>
                )}
              </div>

              <div className="md:col-span-1 flex items-end">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={envVar.required}
                    onChange={(e) => updateEnvironmentVariable(index, 'required', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Required</span>
                </label>
              </div>

              <div className="md:col-span-1 flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeEnvironmentVariable(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {configuration.environmentVariables.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No environment variables configured</p>
              <p className="text-sm">Add variables that your workflow nodes require</p>
            </div>
          )}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back to Upload
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <FileText className="h-4 w-4 mr-2 animate-spin" />
              Generating Project...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Generate Project
            </>
          )}
        </Button>
      </div>
    </div>
  );
}