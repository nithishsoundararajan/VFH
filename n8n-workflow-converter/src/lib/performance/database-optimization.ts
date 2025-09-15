/**
 * Database query optimization and indexing strategies
 */

import { createClient } from '@supabase/supabase-js';

// Query optimization utilities
export class DatabaseOptimizer {
  private supabase: ReturnType<typeof createClient>;
  
  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  // Optimized project queries with proper indexing
  async getProjectsOptimized(userId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
  }) {
    let query = this.supabase
      .from('projects')
      .select(`
        id,
        name,
        description,
        status,
        node_count,
        trigger_count,
        created_at,
        updated_at,
        generated_at
      `)
      .eq('user_id', userId);

    // Add filters
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
    }

    // Add pagination
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
    }

    // Order by most recent first (uses index on created_at)
    query = query.order('created_at', { ascending: false });

    return query;
  }

  // Optimized analytics queries with aggregation
  async getAnalyticsOptimized(userId: string, timeRange?: {
    start: string;
    end: string;
  }) {
    let query = this.supabase
      .from('project_analytics')
      .select(`
        generation_time_ms,
        file_size_bytes,
        node_types,
        complexity_score,
        created_at,
        projects!inner(user_id, status)
      `)
      .eq('projects.user_id', userId);

    if (timeRange) {
      query = query
        .gte('created_at', timeRange.start)
        .lte('created_at', timeRange.end);
    }

    return query;
  }

  // Batch operations for better performance
  async batchUpdateProjects(updates: Array<{ id: string; data: any }>) {
    const promises = updates.map(({ id, data }) =>
      this.supabase
        .from('projects')
        .update(data)
        .eq('id', id)
    );

    return Promise.all(promises);
  }

  // Efficient counting with estimated counts for large tables
  async getProjectCount(userId: string, useEstimate = false) {
    if (useEstimate) {
      // Use PostgreSQL's estimated count for better performance on large tables
      const { data, error } = await this.supabase
        .rpc('get_estimated_project_count', { user_id: userId });
      
      if (error) throw error;
      return data;
    }

    const { count, error } = await this.supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;
    return count;
  }

  // Optimized search with full-text search
  async searchProjects(userId: string, searchTerm: string, options?: {
    limit?: number;
    offset?: number;
  }) {
    const { data, error } = await this.supabase
      .rpc('search_projects_fts', {
        user_id: userId,
        search_term: searchTerm,
        result_limit: options?.limit || 20,
        result_offset: options?.offset || 0
      });

    if (error) throw error;
    return data;
  }
}

// Database connection optimization
export class ConnectionOptimizer {
  private static instance: ConnectionOptimizer;
  private connectionPool: Map<string, ReturnType<typeof createClient>> = new Map();

  static getInstance(): ConnectionOptimizer {
    if (!ConnectionOptimizer.instance) {
      ConnectionOptimizer.instance = new ConnectionOptimizer();
    }
    return ConnectionOptimizer.instance;
  }

  // Get optimized connection for specific use cases
  getConnection(type: 'read' | 'write' | 'analytics' = 'read') {
    if (this.connectionPool.has(type)) {
      return this.connectionPool.get(type)!;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: {
          schema: 'public',
        },
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
        realtime: {
          params: {
            eventsPerSecond: type === 'analytics' ? 1 : 10,
          },
        },
      }
    );

    this.connectionPool.set(type, supabase);
    return supabase;
  }

  // Clean up connections
  cleanup() {
    this.connectionPool.clear();
  }
}

// SQL optimization helpers
export const OptimizedQueries = {
  // Create indexes for better performance
  createIndexes: `
    -- Index for projects by user_id and status
    CREATE INDEX IF NOT EXISTS idx_projects_user_status 
    ON projects(user_id, status);
    
    -- Index for projects by user_id and created_at
    CREATE INDEX IF NOT EXISTS idx_projects_user_created 
    ON projects(user_id, created_at DESC);
    
    -- Index for project_analytics by project_id
    CREATE INDEX IF NOT EXISTS idx_analytics_project 
    ON project_analytics(project_id);
    
    -- Index for generation_logs by project_id and timestamp
    CREATE INDEX IF NOT EXISTS idx_logs_project_time 
    ON generation_logs(project_id, timestamp DESC);
    
    -- Composite index for shared_projects
    CREATE INDEX IF NOT EXISTS idx_shared_projects_composite 
    ON shared_projects(project_id, shared_with, expires_at);
    
    -- Full-text search index for projects
    CREATE INDEX IF NOT EXISTS idx_projects_search 
    ON projects USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
  `,

  // Materialized view for analytics
  createAnalyticsView: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS user_analytics_summary AS
    SELECT 
      p.user_id,
      COUNT(p.id) as total_projects,
      COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_projects,
      COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_projects,
      AVG(pa.generation_time_ms) as avg_generation_time,
      SUM(pa.file_size_bytes) as total_file_size,
      MAX(p.created_at) as last_project_date
    FROM projects p
    LEFT JOIN project_analytics pa ON p.id = pa.project_id
    GROUP BY p.user_id;
    
    -- Create index on the materialized view
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_analytics_summary 
    ON user_analytics_summary(user_id);
  `,

  // Function for estimated counts
  createEstimateFunction: `
    CREATE OR REPLACE FUNCTION get_estimated_project_count(user_id UUID)
    RETURNS INTEGER AS $$
    DECLARE
      result INTEGER;
    BEGIN
      SELECT reltuples::INTEGER
      FROM pg_class
      WHERE relname = 'projects'
      INTO result;
      
      -- Adjust estimate based on user ratio
      SELECT (result * (
        SELECT COUNT(*)::FLOAT / (SELECT COUNT(*) FROM projects)
        FROM projects p
        WHERE p.user_id = $1
        LIMIT 1000
      ))::INTEGER
      INTO result;
      
      RETURN COALESCE(result, 0);
    END;
    $$ LANGUAGE plpgsql;
  `,

  // Full-text search function
  createSearchFunction: `
    CREATE OR REPLACE FUNCTION search_projects_fts(
      user_id UUID,
      search_term TEXT,
      result_limit INTEGER DEFAULT 20,
      result_offset INTEGER DEFAULT 0
    )
    RETURNS TABLE(
      id UUID,
      name TEXT,
      description TEXT,
      status TEXT,
      created_at TIMESTAMPTZ,
      rank REAL
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        p.id,
        p.name,
        p.description,
        p.status,
        p.created_at,
        ts_rank(to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')), 
                plainto_tsquery('english', search_term)) as rank
      FROM projects p
      WHERE p.user_id = $1
        AND to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) 
            @@ plainto_tsquery('english', search_term)
      ORDER BY rank DESC, p.created_at DESC
      LIMIT result_limit
      OFFSET result_offset;
    END;
    $$ LANGUAGE plpgsql;
  `,
};

// Query performance monitoring
export class QueryPerformanceMonitor {
  private static queryTimes: Map<string, number[]> = new Map();

  static startTimer(queryName: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      
      if (!this.queryTimes.has(queryName)) {
        this.queryTimes.set(queryName, []);
      }
      
      const times = this.queryTimes.get(queryName)!;
      times.push(duration);
      
      // Keep only last 100 measurements
      if (times.length > 100) {
        times.shift();
      }
      
      // Log slow queries in development
      if (process.env.NODE_ENV === 'development' && duration > 1000) {
        console.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  static getStats(queryName: string) {
    const times = this.queryTimes.get(queryName);
    if (!times || times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    return {
      count: times.length,
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  static getAllStats() {
    const stats: Record<string, any> = {};
    for (const [queryName] of this.queryTimes) {
      stats[queryName] = this.getStats(queryName);
    }
    return stats;
  }
}