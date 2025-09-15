'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import useFileUpload, { UseFileUploadOptions } from '@/hooks/use-file-upload';

interface FileUploadProps extends UseFileUploadOptions {
  accept?: Record<string, string[]>;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface FileWithPreview extends File {
  preview?: string;
}

export function FileUpload({
  bucket,
  projectId,
  compress = false,
  accept = {
    'application/json': ['.json'],
    'text/plain': ['.txt']
  },
  maxSize = 50 * 1024 * 1024, // 50MB default
  multiple = false,
  disabled = false,
  className = '',
  onSuccess,
  onError,
  children
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<any[]>([]);

  const {
    isUploading,
    progress,
    error,
    uploadedFile,
    uploadFile,
    uploadLargeFile,
    resetState
  } = useFileUpload({
    bucket,
    projectId,
    compress,
    onSuccess: (file) => {
      setFiles([]);
      onSuccess?.(file);
    },
    onError: (error) => {
      onError?.(error);
    }
  });

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setRejectedFiles(fileRejections);
    
    if (acceptedFiles.length > 0) {
      const filesWithPreview = acceptedFiles.map(file => 
        Object.assign(file, {
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
        })
      );
      
      setFiles(multiple ? [...files, ...filesWithPreview] : filesWithPreview);
      resetState();
    }
  }, [files, multiple, resetState]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
    disabled: disabled || isUploading
  });

  const handleUpload = async () => {
    if (files.length === 0) return;

    try {
      const file = files[0]; // Upload first file for now
      
      // Use large file upload for files > 5MB
      if (file.size > 5 * 1024 * 1024) {
        await uploadLargeFile(file);
      } else {
        await uploadFile(file);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const removeFile = (fileToRemove: FileWithPreview) => {
    setFiles(files.filter(file => file !== fileToRemove));
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/json') {
      return <File className="h-8 w-8 text-blue-500" />;
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {children || (
          <div className="space-y-4">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-900">
                {isDragActive ? 'Drop files here' : 'Upload files'}
              </p>
              <p className="text-sm text-gray-500">
                Drag and drop files here, or click to select files
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Max size: {formatFileSize(maxSize)} • 
                Accepted: {Object.values(accept).flat().join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* File Rejections */}
      {rejectedFiles.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {rejectedFiles.map((rejection, index) => (
                <div key={index}>
                  <strong>{rejection.file.name}</strong>: {rejection.errors[0]?.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Selected Files</h4>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {getFileIcon(file)}
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {compress && (
                  <Badge variant="secondary" className="text-xs">
                    Compress
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Uploading... {progress.percentage}%
            </span>
            <span className="text-sm text-gray-500">
              {formatFileSize(progress.loaded)} / {formatFileSize(progress.total)}
            </span>
          </div>
          <Progress value={progress.percentage} className="w-full" />
        </div>
      )}

      {/* Upload Success */}
      {uploadedFile && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            File uploaded successfully: <strong>{uploadedFile.name}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Button */}
      {files.length > 0 && !uploadedFile && (
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              setFiles([]);
              resetState();
            }}
            disabled={isUploading}
          >
            Clear
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {files.length} file{files.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default FileUpload;