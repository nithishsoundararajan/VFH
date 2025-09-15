-- Create PostgreSQL extensions for n8n Workflow Converter
-- This script installs necessary extensions for the application

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Query performance statistics
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Additional text search functions
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- JSON functions (PostgreSQL 13+)
-- CREATE EXTENSION IF NOT EXISTS "jsonb_plperl";

-- PostGIS for geospatial data (if needed)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- Additional useful extensions
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Configure pg_stat_statements
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Configure logging for better monitoring
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = 'on';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_checkpoints = 'on';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_lock_waits = 'on';

-- Performance tuning
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Connection settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET idle_in_transaction_session_timeout = '10min';
ALTER SYSTEM SET statement_timeout = '30min';

-- Reload configuration
SELECT pg_reload_conf();

-- Create helper functions
CREATE OR REPLACE FUNCTION public.generate_ulid() RETURNS TEXT AS $$
DECLARE
    timestamp BIGINT;
    randomness BIGINT;
    ulid TEXT;
BEGIN
    -- Get current timestamp in milliseconds
    timestamp := EXTRACT(EPOCH FROM NOW()) * 1000;
    
    -- Generate random component
    randomness := (RANDOM() * 9223372036854775807)::BIGINT;
    
    -- Combine timestamp and randomness to create ULID-like ID
    ulid := LPAD(TO_HEX(timestamp), 12, '0') || LPAD(TO_HEX(randomness), 16, '0');
    
    RETURN UPPER(ulid);
END;
$$ LANGUAGE plpgsql;

-- Create function to safely drop and recreate indexes
CREATE OR REPLACE FUNCTION public.recreate_index(index_name TEXT, table_name TEXT, index_definition TEXT)
RETURNS VOID AS $$
BEGIN
    -- Drop index if it exists
    EXECUTE format('DROP INDEX IF EXISTS %I', index_name);
    
    -- Create new index
    EXECUTE format('CREATE INDEX CONCURRENTLY %I ON %s %s', index_name, table_name, index_definition);
    
    -- Log the operation
    RAISE NOTICE 'Recreated index % on table %', index_name, table_name;
END;
$$ LANGUAGE plpgsql;

-- Create function to analyze table statistics
CREATE OR REPLACE FUNCTION public.analyze_table_stats(schema_name TEXT DEFAULT 'public')
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    index_size TEXT,
    total_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::TEXT,
        t.n_live_tup,
        pg_size_pretty(pg_total_relation_size(c.oid) - pg_indexes_size(c.oid)) AS table_size,
        pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
    FROM pg_stat_user_tables t
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = schema_name
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get database health metrics
CREATE OR REPLACE FUNCTION public.get_db_health()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
        'total_connections', (SELECT count(*) FROM pg_stat_activity),
        'cache_hit_ratio', (
            SELECT round(
                100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read) + 1), 2
            ) FROM pg_stat_database WHERE datname = current_database()
        ),
        'longest_query_duration', (
            SELECT COALESCE(max(EXTRACT(EPOCH FROM (now() - query_start))), 0)
            FROM pg_stat_activity 
            WHERE state = 'active' AND query != '<IDLE>'
        ),
        'deadlocks', (
            SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()
        ),
        'temp_files', (
            SELECT temp_files FROM pg_stat_database WHERE datname = current_database()
        ),
        'temp_bytes', (
            SELECT pg_size_pretty(temp_bytes) FROM pg_stat_database WHERE datname = current_database()
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old audit logs
CREATE OR REPLACE FUNCTION audit.cleanup_old_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit.audit_log 
    WHERE changed_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % old audit log entries older than % days', deleted_count, retention_days;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create maintenance function
CREATE OR REPLACE FUNCTION public.run_maintenance()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
BEGIN
    -- Update table statistics
    ANALYZE;
    result := result || 'ANALYZE completed. ';
    
    -- Clean up old audit logs (keep 90 days)
    PERFORM audit.cleanup_old_logs(90);
    result := result || 'Audit log cleanup completed. ';
    
    -- Vacuum analyze critical tables (will be added by migrations)
    -- VACUUM ANALYZE app.projects;
    -- VACUUM ANALYZE app.generation_logs;
    
    result := result || 'Maintenance completed successfully.';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Log extension installation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM audit.audit_log LIMIT 1) THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            new_values,
            changed_by,
            changed_at
        ) VALUES (
            'extensions_initialization',
            'INSTALL',
            json_build_object(
                'extensions', ARRAY['uuid-ossp', 'pgcrypto', 'pg_stat_statements', 'pg_trgm', 'unaccent', 'btree_gin', 'btree_gist'],
                'functions', ARRAY['generate_ulid', 'recreate_index', 'analyze_table_stats', 'get_db_health', 'cleanup_old_logs', 'run_maintenance'],
                'status', 'completed'
            ),
            'system',
            NOW()
        );
    END IF;
END $$;