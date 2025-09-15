/**
 * Storage Service
 * Handles file upload, download, and management operations
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FileUploadOptions {
  compress?: boolean;
  metadata?: Record<string, any>;
  contentType?: string;
}

export interface FileListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  fileType?: string;
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export interface BatchUploadResult {
  uploaded: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}

export interface StorageUsage {
  totalFiles: number;
  totalSize: number;
  averageFileSize: number;
  fileTypes: Record<string, number>;
}

export class StorageService {
  private readonly maxFileSize = 25 * 1024 * 1024; // 25MB
  private readonly allowedFileTypes = ['.json', '.zip', '.tar.gz', '.md', '.txt'];
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private supabase: SupabaseClient) {}

  // Workflow File Operations
  async uploadWorkflowFile(
    userId: string,
    projectId: string,
    fileName: string,
    content: string,
    options?: FileUploadOptions
  ): Promise<StorageResult<{ path: string; id?: string }>> {
    try {
      // Validate file
      const validation = this.validateFile(fileName, content);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const filePath = `${userId}/${projectId}/${fileName}`;
      let processedContent = content;

      // Apply compression if requested or file is large
      if (options?.compress || content.length > 1024 * 1024) {
        processedContent = await this.compressContent(content);
      }

      const uploadOptions: any = {
        contentType: options?.contentType || 'application/json',
        upsert: true,
        metadata: {
          userId,
          projectId,
          uploadedAt: new Date().toISOString(),
          ...options?.metadata
        }
      };

      if (options?.compress || content.length > 1024 * 1024) {
        uploadOptions.contentEncoding = 'gzip';
      }

      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .upload(filePath, processedContent, uploadOptions);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Clear cache for this file
      this.clearCache(filePath);

      return {
        success: true,
        data: {
          path: data.path,
          id: data.id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async downloadWorkflowFile(filePath: string): Promise<StorageResult<{
    content: string;
    blob: Blob;
    metadata?: any;
  }>> {
    try {
      // Check cache first
      const cached = this.getFromCache(filePath);
      if (cached) {
        return {
          success: true,
          data: cached
        };
      }

      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .download(filePath);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      const content = await data.text();
      const result = {
        content,
        blob: data,
        metadata: {
          size: data.size,
          type: data.type,
          lastModified: data.lastModified
        }
      };

      // Cache the result
      this.setCache(filePath, result);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  // Generated Project Operations
  async uploadGeneratedProject(
    userId: string,
    projectId: string,
    files: Array<{ path: string; content: string }>
  ): Promise<StorageResult<{ path: string; size: number }>> {
    try {
      // Create ZIP archive from files
      const zipBlob = await this.createZipArchive(files);
      const filePath = `${userId}/${projectId}/generated.zip`;

      const { data, error } = await this.supabase.storage
        .from('generated-projects')
        .upload(filePath, zipBlob, {
          contentType: 'application/zip',
          upsert: true,
          metadata: {
            userId,
            projectId,
            fileCount: files.length,
            generatedAt: new Date().toISOString()
          }
        });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: {
          path: data.path,
          size: zipBlob.size
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Project upload failed'
      };
    }
  }

  async downloadGeneratedProject(filePath: string): Promise<StorageResult<{
    blob: Blob;
    filename: string;
  }>> {
    try {
      const { data, error } = await this.supabase.storage
        .from('generated-projects')
        .download(filePath);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      const filename = filePath.split('/').pop() || 'project.zip';

      return {
        success: true,
        data: {
          blob: data,
          filename
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  // File Listing and Management
  async listUserFiles(userId: string, options?: FileListOptions): Promise<StorageResult<any[]>> {
    try {
      const listOptions: any = {
        limit: options?.limit || 100,
        offset: options?.offset || 0,
        sortBy: {
          column: options?.sortBy || 'created_at',
          order: options?.sortOrder || 'desc'
        }
      };

      if (options?.search) {
        listOptions.search = options.search;
      }

      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .list(userId, listOptions);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      let files = data || [];

      // Apply client-side filtering if needed
      if (options?.fileType) {
        files = files.filter(file => 
          file.name.toLowerCase().endsWith(`.${options.fileType.toLowerCase()}`)
        );
      }

      // Enhance file data
      const enhancedFiles = files.map(file => ({
        ...file,
        size: file.metadata?.size || 0,
        type: this.getFileType(file.name),
        url: this.getFileUrl('workflow-files', `${userId}/${file.name}`)
      }));

      return {
        success: true,
        data: enhancedFiles
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List files failed'
      };
    }
  }

  async deleteFile(bucketName: string, filePath: string): Promise<StorageResult<void>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Clear cache
      this.clearCache(filePath);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  async moveFile(
    bucketName: string,
    fromPath: string,
    toPath: string
  ): Promise<StorageResult<void>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .move(fromPath, toPath);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Clear cache for both paths
      this.clearCache(fromPath);
      this.clearCache(toPath);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Move failed'
      };
    }
  }

  async copyFile(
    bucketName: string,
    fromPath: string,
    toPath: string
  ): Promise<StorageResult<void>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .copy(fromPath, toPath);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Copy failed'
      };
    }
  }

  // URL Generation
  async createSignedUrl(
    bucketName: string,
    filePath: string,
    expiresIn: number
  ): Promise<StorageResult<{ url: string; expiresAt: Date }>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: {
          url: data.signedUrl,
          expiresAt: new Date(Date.now() + expiresIn * 1000)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'URL generation failed'
      };
    }
  }

  async getPublicUrl(bucketName: string, filePath: string): Promise<StorageResult<{ url: string }>> {
    try {
      const { data } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        success: true,
        data: {
          url: data.publicUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Public URL generation failed'
      };
    }
  }

  // Batch Operations
  async batchUpload(
    userId: string,
    projectId: string,
    files: Array<{ path: string; content: string }>
  ): Promise<StorageResult<BatchUploadResult>> {
    const result: BatchUploadResult = {
      uploaded: 0,
      failed: 0,
      errors: []
    };

    const uploadPromises = files.map(async (file) => {
      try {
        const uploadResult = await this.uploadWorkflowFile(
          userId,
          projectId,
          file.path,
          file.content
        );

        if (uploadResult.success) {
          result.uploaded++;
        } else {
          result.failed++;
          result.errors.push({
            file: file.path,
            error: uploadResult.error || 'Unknown error'
          });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          file: file.path,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.all(uploadPromises);

    return {
      success: true,
      data: result
    };
  }

  async batchDelete(
    bucketName: string,
    filePaths: string[]
  ): Promise<StorageResult<{ deleted: number; failed: number }>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .remove(filePaths);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Clear cache for all deleted files
      filePaths.forEach(path => this.clearCache(path));

      return {
        success: true,
        data: {
          deleted: data?.length || 0,
          failed: filePaths.length - (data?.length || 0)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch delete failed'
      };
    }
  }

  // Analytics and Monitoring
  async getStorageUsage(userId: string): Promise<StorageResult<StorageUsage>> {
    try {
      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .list(userId, { limit: 1000 });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      const files = data || [];
      const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      const fileTypes: Record<string, number> = {};

      files.forEach(file => {
        const type = this.getFileType(file.name);
        fileTypes[type] = (fileTypes[type] || 0) + 1;
      });

      return {
        success: true,
        data: {
          totalFiles: files.length,
          totalSize,
          averageFileSize: files.length > 0 ? Math.round((totalSize / files.length) * 100) / 100 : 0,
          fileTypes
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Usage calculation failed'
      };
    }
  }

  async trackFileAccess(
    userId: string,
    filePath: string,
    operation: 'upload' | 'download' | 'delete'
  ): Promise<StorageResult<void>> {
    try {
      // This would typically log to an analytics table
      // For now, we'll just return success
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Access tracking failed'
      };
    }
  }

  async generateStorageReport(
    userId: string,
    options: {
      startDate: string;
      endDate: string;
      includeDetails: boolean;
    }
  ): Promise<StorageResult<any>> {
    try {
      // This would generate a comprehensive storage report
      // For now, return a mock report structure
      return {
        success: true,
        data: {
          summary: {
            totalFiles: 0,
            totalSize: 0,
            period: `${options.startDate} to ${options.endDate}`
          },
          fileBreakdown: {},
          usageTrends: []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed'
      };
    }
  }

  // Security and Compliance
  async enforceRetentionPolicy(
    userId: string,
    policy: { maxAge: number; maxFiles: number }
  ): Promise<StorageResult<{ filesRemoved: number; spaceFreed: number }>> {
    try {
      // This would implement retention policy enforcement
      return {
        success: true,
        data: {
          filesRemoved: 0,
          spaceFreed: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Retention policy enforcement failed'
      };
    }
  }

  async auditFileOperations(
    userId: string,
    options: {
      startDate: string;
      endDate: string;
      operations: string[];
    }
  ): Promise<StorageResult<{ operations: any[] }>> {
    try {
      // This would return audit logs
      return {
        success: true,
        data: {
          operations: []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audit query failed'
      };
    }
  }

  // Private Helper Methods
  private validateFile(fileName: string, content: string): { valid: boolean; error?: string } {
    // Check file size
    if (content.length > this.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds limit of ${this.maxFileSize / (1024 * 1024)}MB`
      };
    }

    // Check file type
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (!this.allowedFileTypes.includes(fileExtension)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${this.allowedFileTypes.join(', ')}`
      };
    }

    // Basic security check
    if (this.containsSecurityThreats(content)) {
      return {
        valid: false,
        error: 'Security threat detected in file content'
      };
    }

    return { valid: true };
  }

  private containsSecurityThreats(content: string): boolean {
    const threats = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi
    ];

    return threats.some(threat => threat.test(content));
  }

  private async compressContent(content: string): Promise<string> {
    // This would implement actual compression
    // For now, return the content as-is
    return content;
  }

  private async createZipArchive(files: Array<{ path: string; content: string }>): Promise<Blob> {
    // This would create an actual ZIP archive
    // For now, return a mock blob
    const zipContent = JSON.stringify(files);
    return new Blob([zipContent], { type: 'application/zip' });
  }

  private getFileType(fileName: string): string {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
    return extension || 'unknown';
  }

  private getFileUrl(bucketName: string, filePath: string): string {
    return `${this.supabase.supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
  }

  // Cache Management
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}