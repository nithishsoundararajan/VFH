-- Performance optimization indexes and functions
-- This migration adds indexes and functions to improve query performance

-- Only drop materialized view and functions that we're recreating with changes
DROP MATERIALIZED VIEW IF EXISTS user_analytics_summary;
DROP FUNCTION IF EXISTS get_estimated_project_count(UUID);
DROP FUNCTION IF EXISTS search_projects_fts(UUID, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS trigger_refresh_analytics() CASCADE;

-- Create performance indexes (only if they don't exist)
-- Index for projects by user_id and status (for filtering)
CREATE INDEX IF NOT EXISTS idx_projects_user_status 
ON projects(user_id, status);

-- Index for projects by user_id and created_at (for ordering and pagination)
CREATE INDEX IF NOT EXISTS idx_projects_user_created 
ON projects(user_id, created_at DESC);

-- Index for project_analytics by project_id (for joins)
CREATE INDEX IF NOT EXISTS idx_analytics_project 
ON project_analytics(project_id);

-- Index for generation_logs by project_id and timestamp (for log queries)
CREATE INDEX IF NOT EXISTS idx_logs_project_time 
ON generation_logs(project_id, timestamp DESC);

-- Composite index for shared_projects (for permission checks)
CREATE INDEX IF NOT EXISTS idx_shared_projects_composite 
ON shared_projects(project_id, shared_with, expires_at);

-- Full-text search index for projects
CREATE INDEX IF NOT EXISTS idx_projects_search 
ON projects USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Conditional index creation for user_sessions (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires 
    ON user_sessions(user_id, expires_at);
  END IF;
END $$;

-- Conditional index creation for download_history (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'download_history') THEN
    CREATE INDEX IF NOT EXISTS idx_download_history_user_created 
    ON download_history(user_id, created_at DESC);
  END IF;
END $$;

-- Materialized view for analytics summary
CREATE MATERIALIZED VIEW user_analytics_summary AS
SELECT 
  p.user_id,
  COUNT(p.id) as total_projects,
  COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_projects,
  COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_projects,
  COUNT(CASE WHEN p.status = 'processing' THEN 1 END) as processing_projects,
  COALESCE(AVG(pa.generation_time_ms), 0) as avg_generation_time,
  COALESCE(SUM(pa.file_size_bytes), 0) as total_file_size,
  MAX(p.created_at) as last_project_date,
  MIN(p.created_at) as first_project_date,
  COUNT(DISTINCT DATE(p.created_at)) as active_days
FROM projects p
LEFT JOIN project_analytics pa ON p.id = pa.project_id
GROUP BY p.user_id;

-- Create unique index on the materialized view
CREATE UNIQUE INDEX idx_user_analytics_summary 
ON user_analytics_summary(user_id);

-- Function for estimated project counts (for large datasets)
CREATE OR REPLACE FUNCTION get_estimated_project_count(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_rows INTEGER;
  sample_ratio FLOAT;
  estimated_count INTEGER;
BEGIN
  -- Get total row count estimate from pg_class
  SELECT reltuples::INTEGER
  FROM pg_class
  WHERE relname = 'projects'
  INTO total_rows;
  
  -- If table is small, do exact count
  IF total_rows < 10000 THEN
    SELECT COUNT(*)::INTEGER
    FROM projects
    WHERE user_id = target_user_id
    INTO estimated_count;
    
    RETURN estimated_count;
  END IF;
  
  -- For large tables, use sampling
  SELECT COUNT(*)::FLOAT / GREATEST(COUNT(*) OVER (), 1)
  FROM projects
  WHERE user_id = target_user_id
  LIMIT 1000
  INTO sample_ratio;
  
  estimated_count := (total_rows * sample_ratio)::INTEGER;
  
  RETURN COALESCE(estimated_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Full-text search function with ranking
CREATE OR REPLACE FUNCTION search_projects_fts(
  target_user_id UUID,
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
    ts_rank(
      to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')), 
      plainto_tsquery('english', search_term)
    ) as rank
  FROM projects p
  WHERE p.user_id = target_user_id
    AND to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) 
        @@ plainto_tsquery('english', search_term)
  ORDER BY rank DESC, p.created_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_analytics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_analytics_summary;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get query performance stats
CREATE OR REPLACE FUNCTION get_query_performance_stats()
RETURNS TABLE(
  query_type TEXT,
  calls BIGINT,
  total_time DOUBLE PRECISION,
  mean_time DOUBLE PRECISION,
  rows BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'projects_by_user' as query_type,
    pg_stat_user_tables.n_tup_ins + pg_stat_user_tables.n_tup_upd + pg_stat_user_tables.n_tup_del as calls,
    0.0 as total_time,
    0.0 as mean_time,
    pg_stat_user_tables.n_live_tup as rows
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public' AND relname = 'projects';
END;
$$ LANGUAGE plpgsql;

-- Add table statistics update
ANALYZE projects;
ANALYZE project_analytics;
ANALYZE generation_logs;
ANALYZE shared_projects;

-- Create a simple table to track materialized view refresh times
CREATE TABLE IF NOT EXISTS materialized_view_refresh_log (
  view_name TEXT PRIMARY KEY,
  last_refresh TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial record for our analytics view
INSERT INTO materialized_view_refresh_log (view_name, last_refresh)
VALUES ('user_analytics_summary', NOW())
ON CONFLICT (view_name) DO NOTHING;

-- Create a simplified trigger to refresh analytics view (without throttling for now)
CREATE OR REPLACE FUNCTION trigger_refresh_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple refresh without throttling to avoid complexity
  BEGIN
    PERFORM refresh_user_analytics();
    
    -- Update the refresh time in our tracking table
    UPDATE materialized_view_refresh_log
    SET last_refresh = NOW()
    WHERE view_name = 'user_analytics_summary';
    
  EXCEPTION WHEN OTHERS THEN
    -- If refresh fails (e.g., concurrent refresh), ignore the error
    NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic analytics refresh (with conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_projects_analytics_refresh') THEN
    CREATE TRIGGER trigger_projects_analytics_refresh
      AFTER INSERT OR UPDATE OR DELETE ON projects
      FOR EACH STATEMENT
      EXECUTE FUNCTION trigger_refresh_analytics();
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON INDEX idx_projects_user_status IS 'Optimizes queries filtering projects by user and status';
COMMENT ON INDEX idx_projects_user_created IS 'Optimizes queries ordering projects by creation date for a user';
COMMENT ON INDEX idx_analytics_project IS 'Optimizes joins between projects and analytics tables';
COMMENT ON INDEX idx_logs_project_time IS 'Optimizes log queries ordered by timestamp';
COMMENT ON INDEX idx_shared_projects_composite IS 'Optimizes shared project permission checks';
COMMENT ON INDEX idx_projects_search IS 'Enables full-text search on project names and descriptions';

COMMENT ON MATERIALIZED VIEW user_analytics_summary IS 'Pre-computed analytics summary for faster dashboard queries';
COMMENT ON FUNCTION get_estimated_project_count(UUID) IS 'Returns estimated project count for large datasets';
COMMENT ON FUNCTION search_projects_fts(UUID, TEXT, INTEGER, INTEGER) IS 'Full-text search with ranking for projects';
COMMENT ON FUNCTION refresh_user_analytics() IS 'Refreshes the user analytics materialized view';

-- Grant necessary permissions
GRANT SELECT ON user_analytics_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_estimated_project_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_projects_fts(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_user_analytics() TO service_role;