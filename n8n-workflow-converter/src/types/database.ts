export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          ai_provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'system_default' | null;
          ai_api_key_encrypted: string | null;
          ai_api_key_valid: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          ai_provider?: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'system_default' | null;
          ai_api_key_encrypted?: string | null;
          ai_api_key_valid?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          ai_provider?: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'system_default' | null;
          ai_api_key_encrypted?: string | null;
          ai_api_key_valid?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          workflow_json: Record<string, unknown>;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          node_count: number | null;
          trigger_count: number | null;
          generated_at: string | null;
          file_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          workflow_json: Record<string, unknown>;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          node_count?: number | null;
          trigger_count?: number | null;
          generated_at?: string | null;
          file_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          workflow_json?: Record<string, unknown>;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          node_count?: number | null;
          trigger_count?: number | null;
          generated_at?: string | null;
          file_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_analytics: {
        Row: {
          id: string;
          project_id: string;
          generation_time_ms: number | null;
          file_size_bytes: number | null;
          node_types: Record<string, unknown> | null;
          complexity_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          generation_time_ms?: number | null;
          file_size_bytes?: number | null;
          node_types?: Record<string, unknown> | null;
          complexity_score?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          generation_time_ms?: number | null;
          file_size_bytes?: number | null;
          node_types?: Record<string, unknown> | null;
          complexity_score?: number | null;
          created_at?: string;
        };
      };
      generation_logs: {
        Row: {
          id: string;
          project_id: string;
          log_level: 'info' | 'warning' | 'error';
          message: string;
          timestamp: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          log_level: 'info' | 'warning' | 'error';
          message: string;
          timestamp?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          log_level?: 'info' | 'warning' | 'error';
          message?: string;
          timestamp?: string;
        };
      };
      shared_projects: {
        Row: {
          id: string;
          project_id: string;
          shared_by: string;
          shared_with: string | null;
          share_token: string | null;
          permissions: 'read' | 'write';
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          shared_by: string;
          shared_with?: string | null;
          share_token?: string | null;
          permissions?: 'read' | 'write';
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          shared_by?: string;
          shared_with?: string | null;
          share_token?: string | null;
          permissions?: 'read' | 'write';
          expires_at?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
