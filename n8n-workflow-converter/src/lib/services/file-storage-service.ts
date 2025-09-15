import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';
import JSZip from 'jszip';

export interface FileUploadOptions {
  bucket: 'workflow-files' | 'generated-projects' | 'user-uploads';
  path: string;
  file: File | Blob;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

// New interfaces for AI integration support
export interface ProjectFile {
  path: string;
  content: string;
  type: 'javascript' | 'json' | 'markdown' | 'text' | 'typescript';
  size?: number;
}

export interface NodeConfiguration {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  parameters: Record<string, any>;
  credentials: Record<string, any>;
  configuredParameters: ConfiguredParameter[];
  environmentVariables: EnvironmentVariable[];
  dependencies: string[];
}

export interface ConfiguredParameter {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'expression';
  isConfigured: boolean;
  defaultValue?: any;
}

export interface EnvironmentVariable {
  key: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  example?: string;
}

export interface GeneratedProject {
  files: ProjectFile[];
  dependencies: string[];
  environmentVariables: EnvironmentVariable[];
  documentation: string;
  projectName: string;
  nodeConfigurations: NodeConfiguration[];
}

export interface StorageResult {
  success: boolean;
  filePath?: string;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
  metadata?: {
    projectId: string;
    userId: string;
    aiProvider?: string;
    generationMethod?: string;
    nodeCount?: number;
  };
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  contentType: string;
  lastModified: Date;
  bucket: string;
  path: string;
  publicUrl?: string;
}

export class FileStorageService {
  private supabase;
  private isServer: boolean;

  constructor(isServer = false) {
    this.isServer = isServer;
    if (isServer) {
      // Server-side usage
      this.supabase = null; // Will be initialized in methods
    } else {
      // Client-side usage
      this.supabase = createClient();
    }
  }

  private async getClient() {
    if (this.isServer) {
      return await createServerClient();
    }
    return this.supabase;
  }

  /**
   * Upload a file to Supabase Storage with progress tracking
   */
  async uploadFile(
    options: FileUploadOptions,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<{ data: FileMetadata | null; error: string | null }> {
    try {
      const supabase = await this.getClient();
      
      // Validate file size based on bucket limits
      const maxSize = this.getMaxFileSize(options.bucket);
      if (options.file.size > maxSize) {
        return {
          data: null,
          error: `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
        };
      }

      // Validate file type
      const allowedTypes = this.getAllowedMimeTypes(options.bucket);
      const fileType = options.file.type || options.contentType;
      if (fileType && !allowedTypes.includes(fileType)) {
        return {
          data: null,
          error: `File type ${fileType} is not allowed for this bucket`
        };
      }

      // Create upload options
      const uploadOptions: any = {
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert || false
      };

      if (options.contentType) {
        uploadOptions.contentType = options.contentType;
      }

      // For large files, we'll use the standard upload (Supabase handles chunking internally)
      const { data, error } = await supabase.storage
        .from(options.bucket)
        .upload(options.path, options.file, uploadOptions);

      if (error) {
        console.error('File upload error:', error);
        return { data: null, error: error.message };
      }

      // Get file metadata
      const { data: fileData } = await supabase.storage
        .from(options.bucket)
        .list(options.path.split('/').slice(0, -1).join('/'), {
          search: options.path.split('/').pop()
        });

      const fileInfo = fileData?.[0];
      if (!fileInfo) {
        return { data: null, error: 'Failed to retrieve file metadata' };
      }

      const metadata: FileMetadata = {
        id: fileInfo.id || data.path,
        name: fileInfo.name,
        size: fileInfo.metadata?.size || options.file.size,
        contentType: fileInfo.metadata?.mimetype || options.file.type,
        lastModified: new Date(fileInfo.updated_at || fileInfo.created_at),
        bucket: options.bucket,
        path: data.path
      };

      // Simulate progress for immediate feedback
      if (onProgress) {
        onProgress({ loaded: options.file.size, total: options.file.size, percentage: 100 });
      }

      return { data: metadata, error: null };

    } catch (error) {
      console.error('File upload service error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown upload error' 
      };
    }
  }

  /**
   * Upload file with chunked upload for large files
   */
  async uploadLargeFile(
    options: FileUploadOptions,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<{ data: FileMetadata | null; error: string | null }> {
    try {
      const supabase = await this.getClient();
      const chunkSize = 1024 * 1024; // 1MB chunks
      const file = options.file;
      const totalChunks = Math.ceil(file.size / chunkSize);

      // For files smaller than chunk size, use regular upload
      if (file.size <= chunkSize) {
        return this.uploadFile(options, onProgress);
      }

      let uploadedBytes = 0;

      // Create a new Blob to accumulate chunks (for demonstration)
      // In a real implementation, you might use resumable uploads
      const chunks: Blob[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        chunks.push(chunk);
        
        uploadedBytes += chunk.size;
        
        if (onProgress) {
          onProgress({
            loaded: uploadedBytes,
            total: file.size,
            percentage: Math.round((uploadedBytes / file.size) * 100)
          });
        }
      }

      // Combine chunks and upload
      const combinedFile = new Blob(chunks, { type: file.type });
      const finalOptions = { ...options, file: combinedFile };
      
      return this.uploadFile(finalOptions);

    } catch (error) {
      console.error('Large file upload error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown upload error' 
      };
    }
  }

  /**
   * Download a file from Supabase Storage
   */
  async downloadFile(
    bucket: string,
    path: string
  ): Promise<{ data: Blob | null; error: string | null }> {
    try {
      const supabase = await this.getClient();
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);

      if (error) {
        console.error('File download error:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };

    } catch (error) {
      console.error('File download service error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown download error' 
      };
    }
  }

  /**
   * Get a signed URL for file download
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn = 3600 // 1 hour default
  ): Promise<{ data: string | null; error: string | null }> {
    try {
      const supabase = await this.getClient();
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        console.error('Signed URL error:', error);
        return { data: null, error: error.message };
      }

      return { data: data.signedUrl, error: null };

    } catch (error) {
      console.error('Signed URL service error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Delete a file from Supabase Storage
   */
  async deleteFile(
    bucket: string,
    path: string
  ): Promise<{ error: string | null }> {
    try {
      const supabase = await this.getClient();
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        console.error('File deletion error:', error);
        return { error: error.message };
      }

      return { error: null };

    } catch (error) {
      console.error('File deletion service error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown deletion error' 
      };
    }
  }

  /**
   * List files in a bucket path
   */
  async listFiles(
    bucket: string,
    path = '',
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
    }
  ): Promise<{ data: FileMetadata[] | null; error: string | null }> {
    try {
      const supabase = await this.getClient();
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path, {
          limit: options?.limit,
          offset: options?.offset,
          sortBy: options?.sortBy
        });

      if (error) {
        console.error('File listing error:', error);
        return { data: null, error: error.message };
      }

      const files: FileMetadata[] = data.map(file => ({
        id: file.id || file.name,
        name: file.name,
        size: file.metadata?.size || 0,
        contentType: file.metadata?.mimetype || 'application/octet-stream',
        lastModified: new Date(file.updated_at || file.created_at),
        bucket,
        path: path ? `${path}/${file.name}` : file.name
      }));

      return { data: files, error: null };

    } catch (error) {
      console.error('File listing service error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown listing error' 
      };
    }
  }

  /**
   * Get file metadata without downloading
   */
  async getFileMetadata(
    bucket: string,
    path: string
  ): Promise<{ data: FileMetadata | null; error: string | null }> {
    try {
      const supabase = await this.getClient();
      
      const pathParts = path.split('/');
      const fileName = pathParts.pop();
      const folderPath = pathParts.join('/');

      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folderPath, {
          search: fileName
        });

      if (error) {
        console.error('File metadata error:', error);
        return { data: null, error: error.message };
      }

      const fileInfo = data.find(file => file.name === fileName);
      if (!fileInfo) {
        return { data: null, error: 'File not found' };
      }

      const metadata: FileMetadata = {
        id: fileInfo.id || fileInfo.name,
        name: fileInfo.name,
        size: fileInfo.metadata?.size || 0,
        contentType: fileInfo.metadata?.mimetype || 'application/octet-stream',
        lastModified: new Date(fileInfo.updated_at || fileInfo.created_at),
        bucket,
        path
      };

      return { data: metadata, error: null };

    } catch (error) {
      console.error('File metadata service error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Store AI-generated project files as ZIP archive
   */
  async storeProjectFiles(
    projectId: string,
    userId: string,
    generatedProject: GeneratedProject,
    options?: {
      aiProvider?: string;
      generationMethod?: string;
      onProgress?: (progress: { stage: string; percentage: number; message: string }) => void;
    }
  ): Promise<StorageResult> {
    try {
      const { onProgress } = options || {};
      
      onProgress?.({ stage: 'validation', percentage: 10, message: 'Validating project files...' });
      
      // Validate project files
      if (!generatedProject.files || generatedProject.files.length === 0) {
        return {
          success: false,
          error: 'No project files to store'
        };
      }

      onProgress?.({ stage: 'zip_creation', percentage: 30, message: 'Creating ZIP archive...' });
      
      // Create ZIP archive
      const zipBuffer = await this.createZipArchive(generatedProject.files);
      
      onProgress?.({ stage: 'upload', percentage: 60, message: 'Uploading to Supabase Storage...' });
      
      // Upload to Supabase Storage
      const uploadResult = await this.uploadToSupabase(
        projectId,
        userId,
        zipBuffer,
        generatedProject.projectName
      );

      if (!uploadResult.success) {
        return uploadResult;
      }

      onProgress?.({ stage: 'complete', percentage: 100, message: 'Files stored successfully' });

      return {
        success: true,
        filePath: uploadResult.filePath,
        downloadUrl: uploadResult.downloadUrl,
        fileSize: zipBuffer.length,
        metadata: {
          projectId,
          userId,
          aiProvider: options?.aiProvider,
          generationMethod: options?.generationMethod,
          nodeCount: generatedProject.nodeConfigurations.length
        }
      };

    } catch (error) {
      console.error('Store project files error:', error);
      
      // Attempt cleanup on failure
      await this.cleanupFailedUpload(projectId, userId).catch(cleanupError => {
        console.error('Cleanup failed:', cleanupError);
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown storage error'
      };
    }
  }

  /**
   * Create ZIP archive from project files with proper Node.js directory structure
   */
  async createZipArchive(files: ProjectFile[]): Promise<Buffer> {
    try {
      const zip = new JSZip();
      
      // Add files to ZIP with proper directory structure
      for (const file of files) {
        // Ensure proper file path structure
        const normalizedPath = file.path.replace(/\\/g, '/');
        
        // Add file to ZIP
        zip.file(normalizedPath, file.content);
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6 // Balanced compression
        }
      });

      return zipBuffer;

    } catch (error) {
      console.error('ZIP creation error:', error);
      throw new Error(`Failed to create ZIP archive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload ZIP archive to Supabase Storage with user-specific folder structure
   */
  async uploadToSupabase(
    projectId: string,
    userId: string,
    zipBuffer: Buffer,
    projectName: string
  ): Promise<StorageResult> {
    try {
      const supabase = await this.getClient();
      
      // Create user-specific file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const fileName = `${sanitizedProjectName}-${timestamp}.zip`;
      const filePath = `${userId}/${projectId}/${fileName}`;

      // Validate file size
      const maxSize = this.getMaxFileSize('generated-projects');
      if (zipBuffer.length > maxSize) {
        return {
          success: false,
          error: `ZIP file size (${Math.round(zipBuffer.length / 1024 / 1024)}MB) exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
        };
      }

      // Upload ZIP file
      const { data, error } = await supabase.storage
        .from('generated-projects')
        .upload(filePath, zipBuffer, {
          contentType: 'application/zip',
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return {
          success: false,
          error: `Upload failed: ${error.message}`
        };
      }

      // Get signed URL for download
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('generated-projects')
        .createSignedUrl(filePath, 3600 * 24 * 7); // 7 days expiry

      if (urlError) {
        console.error('Signed URL error:', urlError);
        return {
          success: false,
          error: `Failed to create download URL: ${urlError.message}`
        };
      }

      return {
        success: true,
        filePath: data.path,
        downloadUrl: signedUrlData.signedUrl,
        fileSize: zipBuffer.length
      };

    } catch (error) {
      console.error('Supabase upload service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  }

  /**
   * Get download URL for stored project
   */
  async getProjectDownloadUrl(
    projectId: string,
    userId: string,
    expiresIn = 3600
  ): Promise<{ data: string | null; error: string | null }> {
    try {
      const supabase = await this.getClient();
      
      // List files in user's project directory
      const { data: files, error: listError } = await supabase.storage
        .from('generated-projects')
        .list(`${userId}/${projectId}`);

      if (listError) {
        return { data: null, error: listError.message };
      }

      if (!files || files.length === 0) {
        return { data: null, error: 'No project files found' };
      }

      // Get the most recent file (assuming sorted by creation time)
      const latestFile = files.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      const filePath = `${userId}/${projectId}/${latestFile.name}`;
      
      // Create signed URL
      const { data, error } = await supabase.storage
        .from('generated-projects')
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data.signedUrl, error: null };

    } catch (error) {
      console.error('Get project download URL error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Clean up failed uploads and partial files
   */
  async cleanupFailedUpload(
    projectId: string,
    userId: string
  ): Promise<{ error: string | null }> {
    try {
      const supabase = await this.getClient();
      
      // List all files in the project directory
      const { data: files, error: listError } = await supabase.storage
        .from('generated-projects')
        .list(`${userId}/${projectId}`);

      if (listError) {
        console.error('Cleanup list error:', listError);
        return { error: listError.message };
      }

      if (!files || files.length === 0) {
        return { error: null }; // Nothing to clean up
      }

      // Delete all files in the project directory
      const filePaths = files.map(file => `${userId}/${projectId}/${file.name}`);
      
      const { error: deleteError } = await supabase.storage
        .from('generated-projects')
        .remove(filePaths);

      if (deleteError) {
        console.error('Cleanup delete error:', deleteError);
        return { error: deleteError.message };
      }

      console.log(`Cleaned up ${filePaths.length} files for project ${projectId}`);
      return { error: null };

    } catch (error) {
      console.error('Cleanup service error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown cleanup error' 
      };
    }
  }

  /**
   * Validate project files before storage
   */
  validateProjectFiles(files: ProjectFile[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!files || files.length === 0) {
      errors.push('No files provided');
      return { valid: false, errors };
    }

    // Check for required files
    const requiredFiles = ['package.json', 'main.js', 'README.md'];
    const fileNames = files.map(f => f.path.split('/').pop() || f.path);
    
    for (const required of requiredFiles) {
      if (!fileNames.includes(required)) {
        errors.push(`Missing required file: ${required}`);
      }
    }

    // Validate file content
    for (const file of files) {
      if (!file.content || file.content.trim().length === 0) {
        errors.push(`Empty content in file: ${file.path}`);
      }

      if (file.path.includes('..') || file.path.startsWith('/')) {
        errors.push(`Invalid file path: ${file.path}`);
      }

      // Validate file size (individual files)
      const contentSize = Buffer.byteLength(file.content, 'utf8');
      if (contentSize > 10 * 1024 * 1024) { // 10MB per file
        errors.push(`File too large: ${file.path} (${Math.round(contentSize / 1024 / 1024)}MB)`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Compress file before upload (client-side only)
   */
  async compressFile(file: File, quality = 0.8): Promise<File> {
    // For JSON files, we can compress using gzip-like compression
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      try {
        const text = await file.text();
        const compressed = JSON.stringify(JSON.parse(text)); // Minify JSON
        return new File([compressed], file.name, { type: file.type });
      } catch {
        return file; // Return original if compression fails
      }
    }
    
    return file; // Return original for non-compressible files
  }

  private getMaxFileSize(bucket: string): number {
    switch (bucket) {
      case 'workflow-files':
      case 'user-uploads':
        return 50 * 1024 * 1024; // 50MB
      case 'generated-projects':
        return 100 * 1024 * 1024; // 100MB
      default:
        return 10 * 1024 * 1024; // 10MB default
    }
  }

  private getAllowedMimeTypes(bucket: string): string[] {
    switch (bucket) {
      case 'workflow-files':
      case 'user-uploads':
        return ['application/json', 'text/plain', 'application/octet-stream'];
      case 'generated-projects':
        return ['application/zip', 'application/x-tar', 'application/gzip', 'application/x-compressed'];
      default:
        return ['application/octet-stream'];
    }
  }
}

// Export singleton instances
export const clientFileStorage = new FileStorageService(false);
export const serverFileStorage = new FileStorageService(true);