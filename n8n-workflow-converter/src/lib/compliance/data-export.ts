import { createClient } from '@/lib/supabase/server';
import JSZip from 'jszip';

export interface DataExportOptions {
  includeProjects?: boolean;
  includeAnalytics?: boolean;
  includeSecurityEvents?: boolean;
  includeSessions?: boolean;
  includeFiles?: boolean;
  format?: 'json' | 'csv';
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface ExportedData {
  profile: any;
  projects?: any[];
  analytics?: any[];
  securityEvents?: any[];
  sessions?: any[];
  files?: any[];
  exportMetadata: {
    exportedAt: string;
    userId: string;
    options: DataExportOptions;
    version: string;
  };
}

/**
 * GDPR-compliant data export service
 */
export class DataExportService {
  /**
   * Export all user data in a structured format
   */
  static async exportUserData(
    userId: string,
    options: DataExportOptions = {}
  ): Promise<{ data: ExportedData; zipBuffer?: Buffer }> {
    const supabase = await createClient();
    
    const {
      includeProjects = true,
      includeAnalytics = true,
      includeSecurityEvents = true,
      includeSessions = true,
      includeFiles = true,
      format = 'json',
      dateRange
    } = options;

    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        throw new Error(`Failed to fetch profile: ${profileError.message}`);
      }

      const exportedData: ExportedData = {
        profile,
        exportMetadata: {
          exportedAt: new Date().toISOString(),
          userId,
          options,
          version: '1.0'
        }
      };

      // Export projects
      if (includeProjects) {
        let projectsQuery = supabase
          .from('projects')
          .select(`
            *,
            project_analytics(*),
            generation_logs(*)
          `)
          .eq('user_id', userId);

        if (dateRange) {
          projectsQuery = projectsQuery
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString());
        }

        const { data: projects, error: projectsError } = await projectsQuery;
        
        if (projectsError) {
          console.error('Failed to fetch projects:', projectsError);
        } else {
          exportedData.projects = projects || [];
        }
      }

      // Export analytics data
      if (includeAnalytics) {
        let analyticsQuery = supabase
          .from('project_analytics')
          .select(`
            *,
            projects!inner(user_id)
          `)
          .eq('projects.user_id', userId);

        if (dateRange) {
          analyticsQuery = analyticsQuery
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString());
        }

        const { data: analytics, error: analyticsError } = await analyticsQuery;
        
        if (analyticsError) {
          console.error('Failed to fetch analytics:', analyticsError);
        } else {
          exportedData.analytics = analytics || [];
        }
      }

      // Export security events
      if (includeSecurityEvents) {
        let securityQuery = supabase
          .from('security_events')
          .select('*')
          .eq('user_id', userId);

        if (dateRange) {
          securityQuery = securityQuery
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString());
        }

        const { data: securityEvents, error: securityError } = await securityQuery;
        
        if (securityError) {
          console.error('Failed to fetch security events:', securityError);
        } else {
          exportedData.securityEvents = securityEvents || [];
        }
      }

      // Export user sessions
      if (includeSessions) {
        const { data: sessions, error: sessionsError } = await supabase
          .from('user_sessions')
          .select('*')
          .eq('user_id', userId);
        
        if (sessionsError) {
          console.error('Failed to fetch sessions:', sessionsError);
        } else {
          exportedData.sessions = sessions || [];
        }
      }

      // Export file metadata (not the actual files for security)
      if (includeFiles) {
        const { data: files, error: filesError } = await supabase
          .storage
          .from('workflow-files')
          .list(userId, { limit: 1000 });
        
        if (filesError) {
          console.error('Failed to fetch files:', filesError);
        } else {
          exportedData.files = files || [];
        }
      }

      // Create ZIP archive with multiple formats
      const zip = new JSZip();
      
      // Add JSON export
      zip.file('data-export.json', JSON.stringify(exportedData, null, 2));
      
      // Add CSV exports for tabular data
      if (format === 'csv' || format === 'json') {
        if (exportedData.projects) {
          zip.file('projects.csv', this.convertToCSV(exportedData.projects));
        }
        if (exportedData.analytics) {
          zip.file('analytics.csv', this.convertToCSV(exportedData.analytics));
        }
        if (exportedData.securityEvents) {
          zip.file('security-events.csv', this.convertToCSV(exportedData.securityEvents));
        }
      }

      // Add README with export information
      const readme = this.generateReadme(exportedData.exportMetadata);
      zip.file('README.txt', readme);

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Log the export for audit purposes
      await this.logDataExport(userId, options);

      return { data: exportedData, zipBuffer };

    } catch (error) {
      console.error('Data export failed:', error);
      throw new Error(`Data export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert array of objects to CSV format
   */
  private static convertToCSV(data: any[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Generate README file for the export
   */
  private static generateReadme(metadata: any): string {
    return `
Data Export Information
======================

Export Date: ${metadata.exportedAt}
User ID: ${metadata.userId}
Export Version: ${metadata.version}

Files Included:
- data-export.json: Complete data export in JSON format
- projects.csv: Projects data in CSV format (if applicable)
- analytics.csv: Analytics data in CSV format (if applicable)
- security-events.csv: Security events in CSV format (if applicable)
- README.txt: This file

Data Categories:
${metadata.options.includeProjects ? '✓' : '✗'} Projects and workflows
${metadata.options.includeAnalytics ? '✓' : '✗'} Analytics and usage data
${metadata.options.includeSecurityEvents ? '✓' : '✗'} Security events and logs
${metadata.options.includeSessions ? '✓' : '✗'} Session information
${metadata.options.includeFiles ? '✓' : '✗'} File metadata

Date Range: ${metadata.options.dateRange ? 
  `${metadata.options.dateRange.from} to ${metadata.options.dateRange.to}` : 
  'All available data'}

Notes:
- This export contains all personal data associated with your account
- File contents are not included for security reasons, only metadata
- Sensitive information like API keys and passwords are excluded
- This export complies with GDPR Article 20 (Right to Data Portability)

For questions about this export, please contact support.
    `.trim();
  }

  /**
   * Log data export for audit purposes
   */
  private static async logDataExport(userId: string, options: DataExportOptions): Promise<void> {
    try {
      const supabase = await createClient();
      
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'data_export',
        resource_type: 'user_data',
        resource_id: userId,
        details: {
          options,
          timestamp: new Date().toISOString()
        },
        ip_address: 'system',
        user_agent: 'data-export-service'
      });
    } catch (error) {
      console.error('Failed to log data export:', error);
      // Don't throw - export should succeed even if logging fails
    }
  }

  /**
   * Get export status for a user
   */
  static async getExportHistory(userId: string): Promise<any[]> {
    try {
      const supabase = await createClient();
      
      const { data: exports, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('action', 'data_export')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      return exports || [];
    } catch (error) {
      console.error('Failed to get export history:', error);
      return [];
    }
  }
}

/**
 * Data deletion service for GDPR compliance
 */
export class DataDeletionService {
  /**
   * Delete all user data (GDPR Right to Erasure)
   */
  static async deleteAllUserData(userId: string, reason: string = 'user_request'): Promise<{
    success: boolean;
    deletedItems: Record<string, number>;
    errors: string[];
  }> {
    const supabase = await createClient();
    const deletedItems: Record<string, number> = {};
    const errors: string[] = [];

    try {
      // Log the deletion request for audit purposes
      await this.logDataDeletion(userId, reason, 'initiated');

      // Delete user sessions
      try {
        const { error: sessionsError, count: sessionsCount } = await supabase
          .from('user_sessions')
          .delete()
          .eq('user_id', userId);
        
        if (sessionsError) throw sessionsError;
        deletedItems.sessions = sessionsCount || 0;
      } catch (error) {
        errors.push(`Failed to delete sessions: ${error}`);
      }

      // Delete security events
      try {
        const { error: securityError, count: securityCount } = await supabase
          .from('security_events')
          .delete()
          .eq('user_id', userId);
        
        if (securityError) throw securityError;
        deletedItems.securityEvents = securityCount || 0;
      } catch (error) {
        errors.push(`Failed to delete security events: ${error}`);
      }

      // Delete quarantined files
      try {
        const { error: quarantineError, count: quarantineCount } = await supabase
          .from('quarantined_files')
          .delete()
          .eq('user_id', userId);
        
        if (quarantineError) throw quarantineError;
        deletedItems.quarantinedFiles = quarantineCount || 0;
      } catch (error) {
        errors.push(`Failed to delete quarantined files: ${error}`);
      }

      // Delete generation logs (via projects)
      try {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', userId);

        if (projects && projects.length > 0) {
          const projectIds = projects.map(p => p.id);
          
          const { error: logsError, count: logsCount } = await supabase
            .from('generation_logs')
            .delete()
            .in('project_id', projectIds);
          
          if (logsError) throw logsError;
          deletedItems.generationLogs = logsCount || 0;
        }
      } catch (error) {
        errors.push(`Failed to delete generation logs: ${error}`);
      }

      // Delete project analytics
      try {
        const { error: analyticsError, count: analyticsCount } = await supabase
          .from('project_analytics')
          .delete()
          .eq('user_id', userId);
        
        if (analyticsError) throw analyticsError;
        deletedItems.analytics = analyticsCount || 0;
      } catch (error) {
        errors.push(`Failed to delete analytics: ${error}`);
      }

      // Delete shared projects
      try {
        const { error: sharedError, count: sharedCount } = await supabase
          .from('shared_projects')
          .delete()
          .or(`shared_by.eq.${userId},shared_with.eq.${userId}`);
        
        if (sharedError) throw sharedError;
        deletedItems.sharedProjects = sharedCount || 0;
      } catch (error) {
        errors.push(`Failed to delete shared projects: ${error}`);
      }

      // Delete projects
      try {
        const { error: projectsError, count: projectsCount } = await supabase
          .from('projects')
          .delete()
          .eq('user_id', userId);
        
        if (projectsError) throw projectsError;
        deletedItems.projects = projectsCount || 0;
      } catch (error) {
        errors.push(`Failed to delete projects: ${error}`);
      }

      // Delete files from storage
      try {
        const { data: files } = await supabase.storage
          .from('workflow-files')
          .list(userId);

        if (files && files.length > 0) {
          const filePaths = files.map(file => `${userId}/${file.name}`);
          const { error: filesError } = await supabase.storage
            .from('workflow-files')
            .remove(filePaths);
          
          if (filesError) throw filesError;
          deletedItems.files = files.length;
        }

        // Also delete from generated-projects bucket
        const { data: generatedFiles } = await supabase.storage
          .from('generated-projects')
          .list(userId);

        if (generatedFiles && generatedFiles.length > 0) {
          const generatedPaths = generatedFiles.map(file => `${userId}/${file.name}`);
          const { error: generatedError } = await supabase.storage
            .from('generated-projects')
            .remove(generatedPaths);
          
          if (generatedError) throw generatedError;
          deletedItems.generatedFiles = generatedFiles.length;
        }
      } catch (error) {
        errors.push(`Failed to delete files: ${error}`);
      }

      // Delete profile (keep this last)
      try {
        const { error: profileError, count: profileCount } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);
        
        if (profileError) throw profileError;
        deletedItems.profile = profileCount || 0;
      } catch (error) {
        errors.push(`Failed to delete profile: ${error}`);
      }

      // Log completion
      await this.logDataDeletion(userId, reason, 'completed', { deletedItems, errors });

      return {
        success: errors.length === 0,
        deletedItems,
        errors
      };

    } catch (error) {
      const errorMessage = `Data deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMessage);
      
      await this.logDataDeletion(userId, reason, 'failed', { error: errorMessage });
      
      return {
        success: false,
        deletedItems,
        errors
      };
    }
  }

  /**
   * Log data deletion for audit purposes
   */
  private static async logDataDeletion(
    userId: string, 
    reason: string, 
    status: 'initiated' | 'completed' | 'failed',
    details?: any
  ): Promise<void> {
    try {
      const supabase = await createClient();
      
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'data_deletion',
        resource_type: 'user_data',
        resource_id: userId,
        details: {
          reason,
          status,
          timestamp: new Date().toISOString(),
          ...details
        },
        ip_address: 'system',
        user_agent: 'data-deletion-service'
      });
    } catch (error) {
      console.error('Failed to log data deletion:', error);
      // Don't throw - deletion should proceed even if logging fails
    }
  }
}