/**
 * Database Service
 * Handles all database operations with Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProjectData {
  id?: string;
  name: string;
  description?: string;
  workflow_json: any;
  user_id: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  node_count?: number;
  trigger_count?: number;
  generated_at?: string;
  file_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectFilters {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface LogData {
  project_id: string;
  log_level: 'info' | 'warning' | 'error';
  message: string;
}

export interface LogFilters {
  level?: string;
  limit?: number;
  offset?: number;
}

export interface AnalyticsData {
  project_id: string;
  generation_time_ms?: number;
  file_size_bytes?: number;
  node_types?: string[];
  complexity_score?: number;
}

export interface NodeUsageData {
  project_id: string;
  user_id: string;
  node_type: string;
  node_count: number;
  complexity_score?: number;
  execution_time_ms?: number;
  success_rate?: number;
  error_count?: number;
}

export class DatabaseService {
  constructor(private supabase: SupabaseClient) {}

  // Project Operations
  async createProject(projectData: Omit<ProjectData, 'id'>): Promise<DatabaseResult<ProjectData>> {
    try {
      // Validate required fields
      if (!projectData.name || !projectData.user_id || !projectData.workflow_json) {
        return {
          success: false,
          error: 'Missing required fields: name, user_id, workflow_json'
        };
      }

      const { data, error } = await this.supabase
        .from('projects')
        .insert({
          ...projectData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getProject(projectId: string, userId: string): Promise<DatabaseResult<ProjectData>> {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      if (error) {
        return {
          success: false,
          error: error.code === 'PGRST116' ? 'Project not found' : error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getUserProjects(userId: string, filters?: ProjectFilters): Promise<DatabaseResult<ProjectData[]>> {
    try {
      let query = this.supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      // Apply ordering
      const orderBy = filters?.orderBy || 'created_at';
      const orderDirection = filters?.orderDirection || 'desc';
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 10)) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateProjectStatus(projectId: string, status: ProjectData['status']): Promise<DatabaseResult<ProjectData>> {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...(status === 'completed' && { generated_at: new Date().toISOString() })
        })
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteProject(projectId: string, userId: string): Promise<DatabaseResult<void>> {
    try {
      const { error } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);

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
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generation Logs Operations
  async createGenerationLog(logData: LogData): Promise<DatabaseResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('generation_logs')
        .insert({
          ...logData,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getProjectLogs(projectId: string, filters?: LogFilters): Promise<DatabaseResult<any[]>> {
    try {
      let query = this.supabase
        .from('generation_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false });

      if (filters?.level) {
        query = query.eq('log_level', filters.level);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Analytics Operations
  async createProjectAnalytics(analyticsData: AnalyticsData): Promise<DatabaseResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('project_analytics')
        .insert({
          ...analyticsData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getUserAnalyticsSummary(userId: string): Promise<DatabaseResult<any>> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_analytics_summary', { user_uuid: userId });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: data?.[0] || {}
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createNodeUsageAnalytics(nodeUsageData: NodeUsageData): Promise<DatabaseResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('node_usage_analytics')
        .insert({
          ...nodeUsageData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // File Storage Operations
  async uploadWorkflowFile(userId: string, projectId: string, fileName: string, fileContent: string): Promise<DatabaseResult<any>> {
    try {
      const filePath = `${userId}/${projectId}/${fileName}`;
      
      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .upload(filePath, fileContent, {
          contentType: 'application/json',
          upsert: true
        });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: { path: data.path }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async downloadFile(filePath: string): Promise<DatabaseResult<any>> {
    try {
      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .download(filePath);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      const text = await data.text();

      return {
        success: true,
        data: { data: text, blob: data }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async listUserFiles(userId: string): Promise<DatabaseResult<any[]>> {
    try {
      const { data, error } = await this.supabase.storage
        .from('workflow-files')
        .list(userId, {
          limit: 100,
          offset: 0
        });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Transaction Support
  async executeTransaction<T>(operation: (client: SupabaseClient) => Promise<T>): Promise<DatabaseResult<T>> {
    try {
      // Note: Supabase doesn't have explicit transaction support in the client
      // This is a wrapper for consistency, actual transactions would need to be handled
      // at the database level or through stored procedures
      const result = await operation(this.supabase);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    }
  }

  // Health Check
  async healthCheck(): Promise<DatabaseResult<any>> {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('id')
        .limit(1);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: { status: 'healthy', timestamp: new Date().toISOString() }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  // Utility Methods
  async getTableRowCount(tableName: string): Promise<DatabaseResult<number>> {
    try {
      const { count, error } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: count || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Count query failed'
      };
    }
  }

  async executeRawQuery(query: string, params?: any[]): Promise<DatabaseResult<any>> {
    try {
      const { data, error } = await this.supabase.rpc('execute_sql', {
        query,
        params: params || []
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Raw query failed'
      };
    }
  }
}