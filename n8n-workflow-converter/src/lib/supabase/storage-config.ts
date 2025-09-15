/**
 * Storage configuration constants and validation rules
 */

export const STORAGE_CONFIG = {
  buckets: {
    workflowFiles: {
      name: 'workflow-files',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'application/json',
        'text/plain',
        'text/json'
      ],
      allowedExtensions: ['.json', '.txt']
    },
    generatedProjects: {
      name: 'generated-projects',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: [
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream'
      ],
      allowedExtensions: ['.zip', '.tar.gz']
    }
  },
  paths: {
    workflowFile: (userId: string, projectId: string, fileName: string = 'workflow.json') =>
      `${userId}/${projectId}/${fileName}`,
    generatedProject: (userId: string, projectId: string, fileName: string = 'project.zip') =>
      `${userId}/${projectId}/${fileName}`,
    userFolder: (userId: string) => userId,
    projectFolder: (userId: string, projectId: string) => `${userId}/${projectId}`
  },
  signedUrlExpiry: {
    default: 3600, // 1 hour
    download: 1800, // 30 minutes
    upload: 300    // 5 minutes
  }
} as const;

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  bucketType: 'workflowFiles' | 'generatedProjects'
): { valid: boolean; error?: string } {
  const config = STORAGE_CONFIG.buckets[bucketType];

  // Check file size
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds limit of ${Math.round(config.maxFileSize / 1024 / 1024)}MB`
    };
  }

  // Check MIME type
  if (!config.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type '${file.type}' is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`
    };
  }

  // Check file extension
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!config.allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `File extension '${fileExtension}' is not allowed. Allowed extensions: ${config.allowedExtensions.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Generate file path for storage
 */
export function generateFilePath(
  bucketType: 'workflowFiles' | 'generatedProjects',
  userId: string,
  projectId: string,
  fileName?: string
): string {
  if (bucketType === 'workflowFiles') {
    return STORAGE_CONFIG.paths.workflowFile(userId, projectId, fileName);
  } else {
    return STORAGE_CONFIG.paths.generatedProject(userId, projectId, fileName);
  }
}

/**
 * Parse file path to extract components
 */
export function parseFilePath(filePath: string): {
  userId?: string;
  projectId?: string;
  fileName?: string;
  valid: boolean;
} {
  const parts = filePath.split('/');
  
  if (parts.length < 3) {
    return { valid: false };
  }

  return {
    userId: parts[0],
    projectId: parts[1],
    fileName: parts[2],
    valid: true
  };
}

/**
 * Storage error messages
 */
export const STORAGE_ERRORS = {
  FILE_TOO_LARGE: 'File size exceeds the maximum allowed limit',
  INVALID_FILE_TYPE: 'File type is not supported',
  UPLOAD_FAILED: 'Failed to upload file',
  DOWNLOAD_FAILED: 'Failed to download file',
  DELETE_FAILED: 'Failed to delete file',
  ACCESS_DENIED: 'You do not have permission to access this file',
  FILE_NOT_FOUND: 'File not found',
  INVALID_PATH: 'Invalid file path'
} as const;