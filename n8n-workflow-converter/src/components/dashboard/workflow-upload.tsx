'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Shield, 
  X,
  Loader2
} from 'lucide-react';

interface WorkflowMetadata {
  name: string;
  nodeCount: number;
  triggerCount: number;
  connections: number;
  nodeTypes: string[];
  hasCredentials: boolean;
}

interface SecurityStatus {
  safe: boolean;
  scanId?: string;
  permalink?: string;
  message: string;
}

interface ParseResponse {
  success: boolean;
  securityStatus: SecurityStatus;
  workflow?: {
    metadata: WorkflowMetadata;
    sanitizedData: any;
  };
  error?: string;
}

interface WorkflowUploadProps {
  onWorkflowParsed: (workflow: { metadata: WorkflowMetadata; sanitizedData: any }) => void;
  onCancel?: () => void;
}

export function WorkflowUpload({ onWorkflowParsed, onCancel }: WorkflowUploadProps) {
  const { user, session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload state
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Security and parsing state
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [workflowMetadata, setWorkflowMetadata] = useState<WorkflowMetadata | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // Processing stages
  const [currentStage, setCurrentStage] = useState<'upload' | 'security' | 'parsing' | 'complete'>('upload');

  // File validation
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      return 'Please select a JSON file';
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }
    
    // Check if file is empty
    if (file.size === 0) {
      return 'File cannot be empty';
    }
    
    return null;
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:application/json;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Process uploaded file
  const processFile = async (file: File) => {
    if (!user) return;
    
    setIsProcessing(true);
    setCurrentStage('security');
    setParseError(null);
    setSecurityStatus(null);
    setWorkflowMetadata(null);
    
    try {
      // Convert file to base64
      const fileData = await fileToBase64(file);
      
      // Call parse-workflow Edge Function for security scanning and parsing
      const response = await fetch('/api/parse-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          fileData,
          fileName: file.name,
          userId: user.id
        })
      });
      
      const result: ParseResponse = await response.json();
      
      setSecurityStatus(result.securityStatus);
      
      if (!result.success) {
        setParseError(result.error || 'Failed to process workflow');
        setCurrentStage('upload');
        return;
      }
      
      if (result.workflow) {
        setCurrentStage('parsing');
        setWorkflowMetadata(result.workflow.metadata);
        setCurrentStage('complete');
        
        // Notify parent component
        onWorkflowParsed(result.workflow);
      }
      
    } catch (error) {
      console.error('File processing error:', error);
      setParseError('Failed to process file. Please try again.');
      setCurrentStage('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setParseError(error);
      return;
    }
    
    setSelectedFile(file);
    setParseError(null);
    processFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  // File input handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Reset upload
  const resetUpload = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setIsProcessing(false);
    setSecurityStatus(null);
    setWorkflowMetadata(null);
    setParseError(null);
    setCurrentStage('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Upload n8n Workflow</h2>
          <p className="text-muted-foreground">
            Upload your n8n workflow JSON file to convert it to a standalone Node.js project
          </p>
        </div>

        {/* Upload Area */}
        {currentStage === 'upload' && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Drop your workflow file here
            </h3>
            <p className="text-muted-foreground mb-4">
              or click to browse for a JSON file
            </p>
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              Select File
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileInputChange}
              className="hidden"
            />
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Supported format: JSON files up to 10MB</p>
              <p>Files are automatically scanned for security threats</p>
            </div>
          </div>
        )}

        {/* Processing Stages */}
        {(currentStage !== 'upload' || isProcessing) && (
          <div className="space-y-4">
            {/* Security Scanning */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              {currentStage === 'security' ? (
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              ) : securityStatus?.safe ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Security Scanning</h4>
                <p className="text-sm text-muted-foreground">
                  {currentStage === 'security' 
                    ? 'Scanning file for security threats...'
                    : securityStatus?.message || 'Pending security scan'
                  }
                </p>
                {securityStatus?.permalink && (
                  <a
                    href={securityStatus.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View detailed scan results
                  </a>
                )}
              </div>
            </div>

            {/* Workflow Parsing */}
            {securityStatus?.safe && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                {currentStage === 'parsing' ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                ) : workflowMetadata ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <FileText className="h-5 w-5 text-gray-400" />
                )}
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">Workflow Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    {currentStage === 'parsing'
                      ? 'Analyzing workflow structure...'
                      : workflowMetadata
                      ? 'Workflow parsed successfully'
                      : 'Waiting for security scan completion'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Workflow Metadata Display */}
        {workflowMetadata && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-900">Workflow Ready for Conversion</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Name:</span>
                <span className="ml-2 text-foreground">{workflowMetadata.name}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Nodes:</span>
                <span className="ml-2 text-foreground">{workflowMetadata.nodeCount}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Triggers:</span>
                <span className="ml-2 text-foreground">{workflowMetadata.triggerCount}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Connections:</span>
                <span className="ml-2 text-foreground">{workflowMetadata.connections}</span>
              </div>
            </div>
            
            {workflowMetadata.hasCredentials && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    This workflow contains credentials that will need to be configured
                  </span>
                </div>
              </div>
            )}
            
            <div className="mt-3">
              <span className="font-medium text-muted-foreground">Node Types:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {workflowMetadata.nodeTypes.map((nodeType, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-primary/10 text-primary text-xs rounded"
                  >
                    {nodeType}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {parseError && (
          <Alert className="mt-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <div className="text-red-800">
              <strong>Error:</strong> {parseError}
            </div>
          </Alert>
        )}

        {/* Security Warning */}
        {securityStatus && !securityStatus.safe && (
          <Alert className="mt-4 border-red-200 bg-red-50">
            <Shield className="h-4 w-4 text-red-600" />
            <div className="text-red-800">
              <strong>Security Warning:</strong> {securityStatus.message}
              {securityStatus.permalink && (
                <div className="mt-1">
                  <a
                    href={securityStatus.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 hover:underline"
                  >
                    View detailed security report
                  </a>
                </div>
              )}
            </div>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={onCancel || resetUpload}
            disabled={isProcessing}
          >
            {onCancel ? 'Cancel' : 'Upload Another File'}
          </Button>
          
          {selectedFile && !workflowMetadata && !parseError && (
            <Button
              variant="outline"
              onClick={resetUpload}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}