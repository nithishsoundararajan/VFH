-- Add configuration column to projects table
ALTER TABLE projects ADD COLUMN configuration JSONB;

-- Add index for configuration queries
CREATE INDEX idx_projects_configuration ON projects USING GIN (configuration);

-- Add comment for documentation
COMMENT ON COLUMN projects.configuration IS 'Project configuration including environment variables, output settings, and generation options';