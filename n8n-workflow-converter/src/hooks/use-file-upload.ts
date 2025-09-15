import { useState, useCallback } from 'react';
import { clientFileStorage, FileUploadProgress, FileMetadata } from '@/lib/services/file-storage-service';

export interface UseFileUploadOptions {
  bucket: 'workflow-files' | 'generated-projects' | 'user-uploads';
  projectId?: string;
  compress?: boolean;
  onSuccess?: (file: FileMetadata) => void;
  onError?: (error: string) => void;
}

export interface FileUploadState {
  isUploading: boolean;
  progress: FileUploadProgress | null;
  error: string | null;
  uploadedFile: FileMetadata | null;
}

export function useFileUpload(options: UseFileUploadOptions) {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    progress: null,
    error: null,
    uploadedFile: null
  });

  const uploadFile = useCallback(async (file: File) => {
    setState({
      isUploading: true,
      progress: { loaded: 0, total: file.size, percentage: 0 },
      error: null,
      uploadedFile: null
    });

    try {
      // Use API route for server-side upload with authentication
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', options.bucket);
      if (options.projectId) {
        formData.append('projectId', options.projectId);
      }
      if (options.compress) {
        formData.append('compress', 'true');
      }

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      return new Promise<FileMetadata>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress: FileUploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            
            setState(prev => ({
              ...prev,
              progress
            }));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              const uploadedFile = response.file;
              
              setState({
                isUploading: false,
                progress: { loaded: file.size, total: file.size, percentage: 100 },
                error: null,
                uploadedFile
              });

              options.onSuccess?.(uploadedFile);
              resolve(uploadedFile);
            } catch (parseError) {
              const error = 'Failed to parse upload response';
              setState(prev => ({
                ...prev,
                isUploading: false,
                error
              }));
              options.onError?.(error);
              reject(new Error(error));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              const error = errorResponse.error || `Upload failed with status ${xhr.status}`;
              setState(prev => ({
                ...prev,
                isUploading: false,
                error
              }));
              options.onError?.(error);
              reject(new Error(error));
            } catch {
              const error = `Upload failed with status ${xhr.status}`;
              setState(prev => ({
                ...prev,
                isUploading: false,
                error
              }));
              options.onError?.(error);
              reject(new Error(error));
            }
          }
        });

        xhr.addEventListener('error', () => {
          const error = 'Network error during upload';
          setState(prev => ({
            ...prev,
            isUploading: false,
            error
          }));
          options.onError?.(error);
          reject(new Error(error));
        });

        xhr.addEventListener('abort', () => {
          const error = 'Upload was cancelled';
          setState(prev => ({
            ...prev,
            isUploading: false,
            error
          }));
          options.onError?.(error);
          reject(new Error(error));
        });

        xhr.open('POST', '/api/files/upload');
        xhr.send(formData);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage
      }));
      options.onError?.(errorMessage);
      throw error;
    }
  }, [options]);

  const uploadLargeFile = useCallback(async (file: File) => {
    setState({
      isUploading: true,
      progress: { loaded: 0, total: file.size, percentage: 0 },
      error: null,
      uploadedFile: null
    });

    try {
      const { data: uploadedFile, error } = await clientFileStorage.uploadLargeFile(
        {
          bucket: options.bucket,
          path: `temp/${Date.now()}_${file.name}`,
          file,
          upsert: false
        },
        (progress) => {
          setState(prev => ({
            ...prev,
            progress
          }));
        }
      );

      if (error) {
        setState(prev => ({
          ...prev,
          isUploading: false,
          error
        }));
        options.onError?.(error);
        throw new Error(error);
      }

      setState({
        isUploading: false,
        progress: { loaded: file.size, total: file.size, percentage: 100 },
        error: null,
        uploadedFile: uploadedFile!
      });

      options.onSuccess?.(uploadedFile!);
      return uploadedFile!;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage
      }));
      options.onError?.(errorMessage);
      throw error;
    }
  }, [options]);

  const cancelUpload = useCallback(() => {
    // This would need to be implemented with the actual upload mechanism
    setState(prev => ({
      ...prev,
      isUploading: false,
      error: 'Upload cancelled'
    }));
  }, []);

  const resetState = useCallback(() => {
    setState({
      isUploading: false,
      progress: null,
      error: null,
      uploadedFile: null
    });
  }, []);

  return {
    ...state,
    uploadFile,
    uploadLargeFile,
    cancelUpload,
    resetState
  };
}

export default useFileUpload;