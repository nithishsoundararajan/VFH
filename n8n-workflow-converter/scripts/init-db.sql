-- Initialize database for n8n Workflow Converter
-- This script sets up the basic database structure and users

-- Create application schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Create application user with limited privileges
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE USER app_user WITH PASSWORD 'secure_app_password_change_me';
    END IF;
END
$$;

-- Grant schema usage permissions
GRANT USAGE ON SCHEMA app TO app_user;
GRANT USAGE ON SCHEMA analytics TO app_user;
GRANT USAGE ON SCHEMA audit TO app_user;

-- Grant table permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO app_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO app_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON FUNCTIONS TO app_user;

-- Create read-only user for monitoring
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'monitoring_user') THEN
        CREATE USER monitoring_user WITH PASSWORD 'monitoring_password_change_me';
    END IF;
END
$$;

-- Grant monitoring permissions
GRANT CONNECT ON DATABASE n8n_converter TO monitoring_user;
GRANT USAGE ON SCHEMA public, app, analytics, audit TO monitoring_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public, app, analytics, audit TO monitoring_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, app, analytics, audit GRANT SELECT ON TABLES TO monitoring_user;

-- Create backup user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'backup_user') THEN
        CREATE USER backup_user WITH PASSWORD 'backup_password_change_me';
    END IF;
END
$$;

-- Grant backup permissions
GRANT CONNECT ON DATABASE n8n_converter TO backup_user;
GRANT USAGE ON SCHEMA public, app, analytics, audit TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public, app, analytics, audit TO backup_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, app, analytics, audit GRANT SELECT ON TABLES TO backup_user;

-- Create indexes for performance
-- Note: Specific table indexes will be created by application migrations

-- Set up database configuration
ALTER DATABASE n8n_converter SET timezone TO 'UTC';
ALTER DATABASE n8n_converter SET log_statement TO 'all';
ALTER DATABASE n8n_converter SET log_min_duration_statement TO 1000;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            old_values,
            changed_by,
            changed_at
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(OLD),
            current_user,
            NOW()
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            old_values,
            new_values,
            changed_by,
            changed_at
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(OLD),
            row_to_json(NEW),
            current_user,
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            new_values,
            changed_by,
            changed_at
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(NEW),
            current_user,
            NOW()
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit.audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON audit.audit_log(changed_by);

-- Create function to add audit triggers to tables
CREATE OR REPLACE FUNCTION audit.add_audit_trigger(target_table TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        CREATE TRIGGER audit_trigger_%s
        AFTER INSERT OR UPDATE OR DELETE ON %s
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_function();
    ', replace(target_table, '.', '_'), target_table);
END;
$$ LANGUAGE plpgsql;

-- Create performance monitoring views
CREATE OR REPLACE VIEW analytics.slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY mean_time DESC;

CREATE OR REPLACE VIEW analytics.table_stats AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

CREATE OR REPLACE VIEW analytics.index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Grant permissions on analytics views
GRANT SELECT ON analytics.slow_queries TO monitoring_user;
GRANT SELECT ON analytics.table_stats TO monitoring_user;
GRANT SELECT ON analytics.index_usage TO monitoring_user;

-- Log successful initialization
INSERT INTO audit.audit_log (
    table_name,
    operation,
    new_values,
    changed_by,
    changed_at
) VALUES (
    'database_initialization',
    'INIT',
    '{"status": "completed", "version": "1.0.0"}',
    'system',
    NOW()
);