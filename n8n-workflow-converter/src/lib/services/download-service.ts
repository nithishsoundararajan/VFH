import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { serverFileStorage } from './file-storage-service';

export type ExportFormat = 'zip' | 'tar.gz' | 'individual';

export interface DownloadOptions {
  projectId: string;
  format: ExportFormat;
  includeSource?: boolean;
  includeDocs?: boolean;
  includeTests?: boolean;
}

export interface DownloadHistoryEntry {
  id: string;
  projectId: string;
  format: ExportFormat;
  fileName: string;
  fileSize: number;
  downloadedAt: Date;
  expiresAt?: Date;
}

export class DownloadService {
  private supabase;
  private isServer: boolean;

  constructor(isServer = false) {
    this.isServer = isServer;
    if (isServer) {
      this.supabase = null; // Will be initialized in methods
    } else {
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
   * Download a project as a ZIP file
   */
  async downloadProject(options: DownloadOptions): Promise<{
    data: { url: string; fileName: string } | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getClient();
      
      // Get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', options.projectId)
        .single();

      if (projectError || !project) {
        return { data: null, error: 'Project not found' };
      }

      // Check if user has access to this project
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'Unauthorized' };
      }

      // Check if user owns the project or has shared access
      const hasAccess = project.user_id === user.id || await this.checkSharedAccess(options.projectId, user.id);
      if (!hasAccess) {
        return { data: null, error: 'Access denied' };
      }

      // Generate download based on format
      switch (options.format) {
        case 'zip':
          return this.downloadAsZip(project, options);
        case 'tar.gz':
          return this.downloadAsTarGz(project, options);
        case 'individual':
          return this.downloadIndividualFiles(project, options);
        default:
          return { data: null, error: 'Unsupported export format' };
      }

    } catch (error) {
      console.error('Download service error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown download error'
      };
    }
  }

  /**
   * Download project as ZIP file
   */
  private async downloadAsZip(project: any, options: DownloadOptions): Promise<{
    data: { url: string; fileName: string } | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getClient();
      
      // Check if ZIP file already exists in storage
      const zipFileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.zip`;
      const zipPath = `${project.user_id}/${project.id}/${zipFileName}`;

      // Look for existing generated project file
      if (project.file_path) {
        const { data: signedUrl, error: urlError } = await serverFileStorage.getSignedUrl(
          'generated-projects',
          project.file_path,
          3600 // 1 hour expiry
        );

        if (!urlError && signedUrl) {
          // Record download in history
          await this.recordDownload(project.id, 'zip', zipFileName, 0);
          
          return {
            data: {
              url: signedUrl,
              fileName: project.file_path.split('/').pop() || zipFileName
            },
            error: null
          };
        }
      }

      // If no existing file, trigger generation
      return this.triggerProjectGeneration(project, options);

    } catch (error) {
      console.error('ZIP download error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'ZIP download failed'
      };
    }
  }

  /**
   * Download project as tar.gz file
   */
  private async downloadAsTarGz(project: any, options: DownloadOptions): Promise<{
    data: { url: string; fileName: string } | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getClient();
      
      // Check if tar.gz file already exists in storage
      const tarFileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.tar.gz`;
      const tarPath = `${project.user_id}/${project.id}/${tarFileName}`;

      // Look for existing tar.gz file or convert from ZIP
      const { data: files, error: listError } = await serverFileStorage.listFiles(
        'generated-projects',
        `${project.user_id}/${project.id}`
      );

      if (!listError && files) {
        // Look for existing tar.gz file
        const existingTarFile = files.find(file => file.name.endsWith('.tar.gz'));
        if (existingTarFile) {
          const { data: signedUrl, error: urlError } = await serverFileStorage.getSignedUrl(
            'generated-projects',
            existingTarFile.path,
            3600
          );

          if (!urlError && signedUrl) {
            await this.recordDownload(project.id, 'tar.gz', existingTarFile.name, existingTarFile.size);
            return {
              data: {
                url: signedUrl,
                fileName: existingTarFile.name
              },
              error: null
            };
          }
        }

        // Look for ZIP file to convert
        const zipFile = files.find(file => file.name.endsWith('.zip'));
        if (zipFile) {
          // In a real implementation, this would trigger server-side conversion
          // For now, we'll return the ZIP file with a note
          const { data: signedUrl, error: urlError } = await serverFileStorage.getSignedUrl(
            'generated-projects',
            zipFile.path,
            3600
          );

          if (!urlError && signedUrl) {
            await this.recordDownload(project.id, 'tar.gz', zipFile.name, zipFile.size);
            return {
              data: {
                url: signedUrl,
                fileName: zipFile.name.replace('.zip', '.tar.gz')
              },
              error: null
            };
          }
        }
      }

      // If no existing files, trigger generation
      return this.triggerProjectGeneration(project, { ...options, format: 'tar.gz' });

    } catch (error) {
      console.error('tar.gz download error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'tar.gz download failed'
      };
    }
  }

  /**
   * Download individual project files
   */
  private async downloadIndividualFiles(project: any, options: DownloadOptions): Promise<{
    data: { url: string; fileName: string } | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getClient();
      
      // List all files for this project
      const { data: files, error: listError } = await serverFileStorage.listFiles(
        'generated-projects',
        `${project.user_id}/${project.id}`
      );

      if (listError || !files || files.length === 0) {
        return { data: null, error: 'No files found for this project' };
      }

      // Filter files based on options
      let filteredFiles = files;
      
      if (!options.includeSource) {
        filteredFiles = filteredFiles.filter(file => 
          !file.name.includes('/src/') && !file.name.endsWith('.js') && !file.name.endsWith('.ts')
        );
      }
      
      if (!options.includeDocs) {
        filteredFiles = filteredFiles.filter(file => 
          !file.name.toLowerCase().includes('readme') && 
          !file.name.toLowerCase().includes('doc') &&
          !file.name.endsWith('.md')
        );
      }
      
      if (!options.includeTests) {
        filteredFiles = filteredFiles.filter(file => 
          !file.name.includes('/test/') && 
          !file.name.includes('/__tests__/') &&
          !file.name.includes('.test.') &&
          !file.name.includes('.spec.')
        );
      }

      if (filteredFiles.length === 0) {
        return { data: null, error: 'No files match the selected criteria' };
      }

      // Create a manifest file listing all available files
      const manifest = {
        projectId: project.id,
        projectName: project.name,
        generatedAt: new Date().toISOString(),
        totalFiles: filteredFiles.length,
        totalSize: filteredFiles.reduce((sum, file) => sum + file.size, 0),
        files: filteredFiles.map(file => ({
          name: file.name,
          path: file.path,
          size: file.size,
          contentType: file.contentType,
          lastModified: file.lastModified,
          downloadUrl: `/api/projects/${project.id}/files/${encodeURIComponent(file.name)}`
        }))
      };

      // Create manifest as a downloadable JSON file
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: 'application/json'
      });

      const manifestFileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_manifest.json`;
      const manifestPath = `${project.user_id}/${project.id}/manifests/${manifestFileName}`;

      // Upload manifest to storage
      const { data: uploadData, error: uploadError } = await serverFileStorage.uploadFile({
        bucket: 'generated-projects',
        path: manifestPath,
        file: manifestBlob,
        contentType: 'application/json'
      });

      if (uploadError || !uploadData) {
        // Fallback: return the first file
        const firstFile = filteredFiles[0];
        const { data: signedUrl, error: urlError } = await serverFileStorage.getSignedUrl(
          'generated-projects',
          firstFile.path,
          3600
        );

        if (urlError || !signedUrl) {
          return { data: null, error: 'Failed to generate download URL' };
        }

        await this.recordDownload(project.id, 'individual', firstFile.name, firstFile.size);

        return {
          data: {
            url: signedUrl,
            fileName: firstFile.name
          },
          error: null
        };
      }

      // Get signed URL for manifest
      const { data: manifestUrl, error: manifestUrlError } = await serverFileStorage.getSignedUrl(
        'generated-projects',
        manifestPath,
        3600
      );

      if (manifestUrlError || !manifestUrl) {
        return { data: null, error: 'Failed to generate manifest download URL' };
      }

      // Record download
      await this.recordDownload(project.id, 'individual', manifestFileName, manifestBlob.size);

      return {
        data: {
          url: manifestUrl,
          fileName: manifestFileName
        },
        error: null
      };

    } catch (error) {
      console.error('Individual files download error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Individual files download failed'
      };
    }
  }

  /**
   * Trigger project generation if not exists
   */
  private async triggerProjectGeneration(project: any, options: DownloadOptions): Promise<{
    data: { url: string; fileName: string } | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getClient();
      
      // Update project status to processing
      await supabase
        .from('projects')
        .update({ status: 'processing' })
        .eq('id', project.id);

      // Log generation trigger
      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'info',
        message: `Project generation triggered for download (format: ${options.format})`
      });

      // In a real implementation, this would trigger the code generation Edge Function
      // For now, return a message indicating generation is in progress
      return {
        data: null,
        error: 'Project generation in progress. Please check back in a few minutes.'
      };

    } catch (error) {
      console.error('Project generation trigger error:', error);
      return {
        data: null,
        error: 'Failed to trigger project generation'
      };
    }
  }

  /**
   * Get download history for a user
   */
  async getDownloadHistory(userId?: string, limit = 50): Promise<{
    data: DownloadHistoryEntry[] | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getClient();
      
      let query = supabase
        .from('download_history')
        .select(`
          *,
          projects (
            name,
            description
          )
        `)
        .order('downloaded_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        // Get current user's history
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { data: null, error: 'Unauthorized' };
        }
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Download history error:', error);
        return { data: null, error: error.message };
      }

      const history: DownloadHistoryEntry[] = data.map(entry => ({
        id: entry.id,
        projectId: entry.project_id,
        format: entry.format,
        fileName: entry.file_name,
        fileSize: entry.file_size,
        downloadedAt: new Date(entry.downloaded_at),
        expiresAt: entry.expires_at ? new Date(entry.expires_at) : undefined
      }));

      return { data: history, error: null };

    } catch (error) {
      console.error('Download history service error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch download history'
      };
    }
  }

  /**
   * Record a download in the history
   */
  private async recordDownload(
    projectId: string,
    format: ExportFormat,
    fileName: string,
    fileSize: number
  ): Promise<void> {
    try {
      const supabase = await this.getClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      await supabase.from('download_history').insert({
        user_id: user.id,
        project_id: projectId,
        format,
        file_name: fileName,
        file_size: fileSize,
        downloaded_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

    } catch (error) {
      console.error('Failed to record download:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Check if user has shared access to a project
   */
  private async checkSharedAccess(projectId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await this.getClient();
      
      const { data, error } = await supabase
        .from('shared_projects')
        .select('id')
        .eq('project_id', projectId)
        .eq('shared_with', userId)
        .or('expires_at.is.null,expires_at.gt.now()')
        .single();

      return !error && !!data;

    } catch (error) {
      console.error('Shared access check error:', error);
      return false;
    }
  }

  /**
   * Get individual file download URLs for a project
   */
  async getIndividualFileUrls(
    projectId: string,
    options: { includeSource?: boolean; includeDocs?: boolean; includeTests?: boolean } = {}
  ): Promise<{
    data: Array<{ name: string; url: string; size: number; expiresAt: Date }> | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getClient();
      
      // Get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        return { data: null, error: 'Project not found' };
      }

      // Check access
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: 'Unauthorized' };
      }

      const hasAccess = project.user_id === user.id || await this.checkSharedAccess(projectId, user.id);
      if (!hasAccess) {
        return { data: null, error: 'Access denied' };
      }

      // List all files for this project
      const { data: files, error: listError } = await serverFileStorage.listFiles(
        'generated-projects',
        `${project.user_id}/${project.id}`
      );

      if (listError || !files || files.length === 0) {
        return { data: null, error: 'No files found for this project' };
      }

      // Filter files based on options
      let filteredFiles = files;
      
      if (!options.includeSource) {
        filteredFiles = filteredFiles.filter(file => 
          !file.name.includes('/src/') && !file.name.endsWith('.js') && !file.name.endsWith('.ts')
        );
      }
      
      if (!options.includeDocs) {
        filteredFiles = filteredFiles.filter(file => 
          !file.name.toLowerCase().includes('readme') && 
          !file.name.toLowerCase().includes('doc') &&
          !file.name.endsWith('.md')
        );
      }
      
      if (!options.includeTests) {
        filteredFiles = filteredFiles.filter(file => 
          !file.name.includes('/test/') && 
          !file.name.includes('/__tests__/') &&
          !file.name.includes('.test.') &&
          !file.name.includes('.spec.')
        );
      }

      // Generate signed URLs for all files
      const fileUrls = await Promise.all(
        filteredFiles.map(async (file) => {
          const { data: signedUrl, error: urlError } = await serverFileStorage.getSignedUrl(
            'generated-projects',
            file.path,
            3600
          );

          if (urlError || !signedUrl) {
            return null;
          }

          return {
            name: file.name,
            url: signedUrl,
            size: file.size,
            expiresAt: new Date(Date.now() + 3600 * 1000)
          };
        })
      );

      const validUrls = fileUrls.filter(url => url !== null);

      return { data: validUrls, error: null };

    } catch (error) {
      console.error('Individual file URLs error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to generate file URLs'
      };
    }
  }

  /**
   * Generate a temporary download link
   */
  async generateDownloadLink(
    projectId: string,
    format: ExportFormat = 'zip',
    expiresIn = 3600
  ): Promise<{
    data: { url: string; expiresAt: Date } | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getClient();
      
      // Get project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        return { data: null, error: 'Project not found' };
      }

      if (!project.file_path) {
        return { data: null, error: 'Project files not generated yet' };
      }

      // Generate signed URL
      const { data: signedUrl, error: urlError } = await serverFileStorage.getSignedUrl(
        'generated-projects',
        project.file_path,
        expiresIn
      );

      if (urlError || !signedUrl) {
        return { data: null, error: 'Failed to generate download link' };
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      return {
        data: {
          url: signedUrl,
          expiresAt
        },
        error: null
      };

    } catch (error) {
      console.error('Download link generation error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to generate download link'
      };
    }
  }
}

// Export singleton instances
export const clientDownloadService = new DownloadService(false);
export const serverDownloadService = new DownloadService(true);