-- Development database initialization
-- This script sets up the database for development with additional debugging features

-- Include the main initialization
\i /docker-entrypoint-initdb.d/01-init.sql

-- Development-specific configurations
ALTER DATABASE n8n_converter_dev SET log_statement TO 'all';
ALTER DATABASE n8n_converter_dev SET log_min_duration_statement TO 0;
ALTER DATABASE n8n_converter_dev SET log_line_prefix TO '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';

-- Create development user with more permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dev_user') THEN
        CREATE USER dev_user WITH PASSWORD 'dev_password';
    END IF;
END
$$;

-- Grant development permissions
GRANT ALL PRIVILEGES ON DATABASE n8n_converter_dev TO dev_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, app, analytics, audit TO dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, app, analytics, audit TO dev_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public, app, analytics, audit TO dev_user;

-- Set default privileges for development
ALTER DEFAULT PRIVILEGES IN SCHEMA public, app, analytics, audit GRANT ALL ON TABLES TO dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, app, analytics, audit GRANT ALL ON SEQUENCES TO dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, app, analytics, audit GRANT ALL ON FUNCTIONS TO dev_user;

-- Create development-specific functions
CREATE OR REPLACE FUNCTION public.reset_dev_data()
RETURNS VOID AS $$
BEGIN
    -- Truncate all application tables (will be created by migrations)
    -- TRUNCATE TABLE app.projects CASCADE;
    -- TRUNCATE TABLE app.generation_logs CASCADE;
    -- TRUNCATE TABLE app.project_analytics CASCADE;
    
    -- Reset sequences
    -- ALTER SEQUENCE app.projects_id_seq RESTART WITH 1;
    
    RAISE NOTICE 'Development data reset completed';
END;
$$ LANGUAGE plpgsql;

-- Create function to generate test data
CREATE OR REPLACE FUNCTION public.generate_test_data()
RETURNS VOID AS $$
BEGIN
    -- This function will be populated after migrations create the tables
    RAISE NOTICE 'Test data generation function created (to be implemented after migrations)';
END;
$$ LANGUAGE plpgsql;

-- Enable more detailed logging for development
CREATE EXTENSION IF NOT EXISTS "auto_explain";
ALTER SYSTEM SET auto_explain.log_min_duration = 0;
ALTER SYSTEM SET auto_explain.log_analyze = true;
ALTER SYSTEM SET auto_explain.log_verbose = true;
ALTER SYSTEM SET auto_explain.log_nested_statements = true;

-- Reload configuration
SELECT pg_reload_conf();

-- Log development initialization
INSERT INTO audit.audit_log (
    table_name,
    operation,
    new_values,
    changed_by,
    changed_at
) VALUES (
    'development_initialization',
    'INIT',
    '{"environment": "development", "features": ["detailed_logging", "test_data_functions", "dev_user"], "status": "completed"}',
    'system',
    NOW()
);