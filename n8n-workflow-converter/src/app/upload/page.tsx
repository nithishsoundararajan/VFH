'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { WorkflowUpload } from '@/components/dashboard/workflow-upload';
import { WorkflowConfiguration } from '@/components/dashboard/workflow-configuration';
import { useAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface WorkflowMetadata {
  name: string;
  nodeCount: number;
  triggerCount: number;
  connections: number;
  nodeTypes: string[];
  hasCredentials: boolean;
}

interface ProjectConfiguration {
  projectName: string;
  description: string;
  outputFormat: 'zip' | 'tar.gz';
  includeDocumentation: boolean;
  includeTests: boolean;
  nodeVersion: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  environmentVariables: Array<{
    key: string;
    value: string;
    description?: string;
    required: boolean;
  }>;
}

type UploadStep = 'upload' | 'configure' | 'generating';

function UploadContent() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState<UploadStep>('upload');
  const [workflowData, setWorkflowData] = useState<{
    metadata: WorkflowMetadata;
    sanitizedData: any;
  } | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfiguration | null>(null);

  // Handle workflow upload completion
  const handleWorkflowParsed = (workflow: { metadata: WorkflowMetadata; sanitizedData: any }) => {
    setWorkflowData(workflow);
    setCurrentStep('configure');
  };

  // Handle configuration completion
  const handleConfigurationComplete = async (config: ProjectConfiguration) => {
    if (!workflowData || !user) return;

    setProjectConfig(config);
    setCurrentStep('generating');

    try {
      // Create project in database
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: config.projectName,
          description: config.description,
          workflow_json: workflowData.sanitizedData,
          node_count: workflowData.metadata.nodeCount,
          trigger_count: workflowData.metadata.triggerCount,
          configuration: config
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const project = await response.json();

      // Redirect to dashboard or project page
      router.push(`/dashboard?project=${project.id}`);

    } catch (error) {
      console.error('Project creation error:', error);
      // Handle error - could show error message and allow retry
      setCurrentStep('configure');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    switch (currentStep) {
      case 'configure':
        setCurrentStep('upload');
        setWorkflowData(null);
        break;
      case 'generating':
        setCurrentStep('configure');
        break;
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Upload Workflow</h1>
                <p className="text-gray-600 mt-1">
                  Convert your n8n workflow to a standalone Node.js project
                </p>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-8">
              <div className={`flex items-center ${currentStep === 'upload' ? 'text-blue-600' : currentStep === 'configure' || currentStep === 'generating' ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 'upload' ? 'bg-blue-100 text-blue-600' : currentStep === 'configure' || currentStep === 'generating' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  1
                </div>
                <span className="ml-2 font-medium">Upload</span>
              </div>
              
              <div className={`w-16 h-0.5 ${currentStep === 'configure' || currentStep === 'generating' ? 'bg-green-600' : 'bg-gray-300'}`} />
              
              <div className={`flex items-center ${currentStep === 'configure' ? 'text-blue-600' : currentStep === 'generating' ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 'configure' ? 'bg-blue-100 text-blue-600' : currentStep === 'generating' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  2
                </div>
                <span className="ml-2 font-medium">Configure</span>
              </div>
              
              <div className={`w-16 h-0.5 ${currentStep === 'generating' ? 'bg-green-600' : 'bg-gray-300'}`} />
              
              <div className={`flex items-center ${currentStep === 'generating' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 'generating' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  3
                </div>
                <span className="ml-2 font-medium">Generate</span>
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="mt-8">
            {currentStep === 'upload' && (
              <WorkflowUpload
                onWorkflowParsed={handleWorkflowParsed}
                onCancel={handleCancel}
              />
            )}

            {currentStep === 'configure' && workflowData && (
              <WorkflowConfiguration
                workflowMetadata={workflowData.metadata}
                onConfigurationComplete={handleConfigurationComplete}
                onBack={handleBack}
              />
            )}

            {currentStep === 'generating' && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Your Project</h3>
                  <p className="text-gray-600">
                    Please wait while we convert your workflow and generate the standalone Node.js project...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <UploadContent />
    </ProtectedRoute>
  );
}