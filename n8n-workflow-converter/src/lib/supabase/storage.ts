import { createClient } from './client';

/**
 * Storage utility functions for managing workflow files and generated projects
 */

export class StorageManager {
  private supabase = createClient();

  /**
   * Upload a workflow JSON file
   */
  async uploadWorkflowFile(
    userId: string,
    projectId: string,
    file: File,
    fileName: string = 'workflow.json'
  ) {
    try {
      // Validate file type
      if (!file.type.includes('json') && !file.type.includes('text')) {
        throw new Error('Invalid file type. Only JSON files are allowed.');
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit.');
      }

      const filePath = `${userId}/${projectId}/${fileName}`;

      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        path: data.path,
        fullPath: filePath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Download a workflow file
   */
  async downloadWorkflowFile(userId: string, projectId: string, fileName: string = 'workflow.json') {
    try {
      const filePath = `${userId}/${projectId}/${fileName}`;

      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .download(filePath);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data,
        blob: data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  /**
   * Upload a generated project ZIP file
   */
  async uploadGeneratedProject(
    userId: string,
    projectId: string,
    file: File | Blob,
    fileName: string = 'project.zip'
  ) {
    try {
      // Validate file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File size exceeds 100MB limit.');
      }

      const filePath = `${userId}/${projectId}/${fileName}`;

      const { data, error } = await this.supabase.storage
        .from('generated-projects')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        path: data.path,
        fullPath: filePath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Download a generated project
   */
  async downloadGeneratedProject(
    userId: string,
    projectId: string,
    fileName: string = 'project.zip'
  ) {
    try {
      const filePath = `${userId}/${projectId}/${fileName}`;

      const { data, error } = await this.supabase.storage
        .from('generated-projects')
        .download(filePath);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data,
        blob: data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  /**
   * Get signed URL for file download
   */
  async getSignedUrl(
    bucket: 'workflow-files' | 'generated-projects',
    filePath: string,
    expiresIn: number = 3600 // 1 hour default
  ) {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw error;
      }

      return {
        success: true,
        signedUrl: data.signedUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create signed URL'
      };
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(
    bucket: 'workflow-files' | 'generated-projects',
    filePath: string
  ) {
    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        throw error;
      }

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

  /**
   * List files in a user's folder
   */
  async listUserFiles(
    bucket: 'workflow-files' | 'generated-projects',
    userId: string,
    projectId?: string
  ) {
    try {
      const folderPath = projectId ? `${userId}/${projectId}` : userId;

      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list(folderPath);

      if (error) {
        throw error;
      }

      return {
        success: true,
        files: data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List failed'
      };
    }
  }

  /**
   * Get file metadata
   */
  async getFileInfo(
    bucket: 'workflow-files' | 'generated-projects',
    filePath: string
  ) {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list('', {
          search: filePath
        });

      if (error) {
        throw error;
      }

      const fileInfo = data.find(file => file.name === filePath.split('/').pop());

      return {
        success: true,
        fileInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file info'
      };
    }
  }

  /**
   * Check if user has access to a file (for shared projects)
   */
  async checkFileAccess(
    bucket: 'workflow-files' | 'generated-projects',
    filePath: string,
    userId: string
  ) {
    try {
      // Extract project ID from file path
      const pathParts = filePath.split('/');
      if (pathParts.length < 2) {
        return { success: false, hasAccess: false };
      }

      const fileUserId = pathParts[0];
      const projectId = pathParts[1];

      // Check if user owns the file
      if (fileUserId === userId) {
        return { success: true, hasAccess: true, reason: 'owner' };
      }

      // Check if project is shared with user
      const { data: sharedProject, error } = await this.supabase
        .from('shared_projects')
        .select('*')
        .eq('project_id', projectId)
        .or(`shared_with.eq.${userId},share_token.is.not.null`)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      const hasAccess = !!sharedProject;

      return {
        success: true,
        hasAccess,
        reason: hasAccess ? 'shared' : 'no_access',
        shareInfo: sharedProject
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Access check failed'
      };
    }
  }
}

// Export singleton instance
export const storageManager = new StorageManager();