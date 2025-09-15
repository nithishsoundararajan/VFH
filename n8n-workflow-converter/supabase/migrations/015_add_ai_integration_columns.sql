-- Add AI integration columns to projects table
-- Migration: 015_add_ai_integration_columns.sql

-- Add columns for AI code generation tracking
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS download_url TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'system_default',
ADD COLUMN IF NOT EXISTS generation_method TEXT DEFAULT 'template_only',
ADD COLUMN IF NOT EXISTS node_configurations JSONB;

-- Update existing rows to have valid generation_method values
UPDATE projects 
SET generation_method = CASE 
  WHEN generation_method IS NULL THEN 'template_only'
  WHEN generation_method = 'template' THEN 'template_only'
  WHEN generation_method NOT IN ('ai_enhanced', 'configuration_aware', 'template_only', 'failed') THEN 'template_only'
  ELSE generation_method
END
WHERE generation_method IS NULL 
   OR generation_method NOT IN ('ai_enhanced', 'configuration_aware', 'template_only', 'failed');

-- Update existing rows to have valid ai_provider values
UPDATE projects 
SET ai_provider = CASE 
  WHEN ai_provider IS NULL THEN 'system_default'
  WHEN ai_provider NOT IN ('openai', 'anthropic', 'gemini', 'openrouter', 'system_default', 'fallback', 'none') THEN 'system_default'
  ELSE ai_provider
END
WHERE ai_provider IS NULL 
   OR ai_provider NOT IN ('openai', 'anthropic', 'gemini', 'openrouter', 'system_default', 'fallback', 'none');

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_ai_provider ON projects(ai_provider);
CREATE INDEX IF NOT EXISTS idx_projects_generation_method ON projects(generation_method);
CREATE INDEX IF NOT EXISTS idx_projects_file_path ON projects(file_path) WHERE file_path IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN projects.file_path IS 'Path to the generated project file in Supabase Storage';
COMMENT ON COLUMN projects.download_url IS 'Public URL for downloading the generated project';
COMMENT ON COLUMN projects.file_size IS 'Size of the generated project file in bytes';
COMMENT ON COLUMN projects.ai_provider IS 'AI provider used for code generation (openai, anthropic, gemini, openrouter, system_default, fallback)';
COMMENT ON COLUMN projects.generation_method IS 'Method used for code generation (ai_enhanced, configuration_aware, template_only, failed)';
COMMENT ON COLUMN projects.node_configurations IS 'Extracted node configurations from the workflow JSON';

-- Update RLS policies to include new columns (with idempotent approach)
DO $$
BEGIN
  -- Drop existing policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can view their own project files') THEN
    DROP POLICY "Users can view their own project files" ON projects;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can update their own project files') THEN
    DROP POLICY "Users can update their own project files" ON projects;
  END IF;
END $$;

-- Create policies for project file access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can view their own project files') THEN
    CREATE POLICY "Users can view their own project files" ON projects
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can update their own project files') THEN
    CREATE POLICY "Users can update their own project files" ON projects
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add validation constraints using DO block (PostgreSQL doesn't support IF NOT EXISTS for constraints)
DO $$
BEGIN
  -- Add ai_provider constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_ai_provider' AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects 
    ADD CONSTRAINT check_ai_provider 
      CHECK (ai_provider IN ('openai', 'anthropic', 'gemini', 'openrouter', 'system_default', 'fallback', 'none'));
  END IF;

  -- Add generation_method constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_generation_method' AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects 
    ADD CONSTRAINT check_generation_method 
      CHECK (generation_method IN ('ai_enhanced', 'configuration_aware', 'template_only', 'failed'));
  END IF;

  -- Add file_size constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_file_size_positive' AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects 
    ADD CONSTRAINT check_file_size_positive 
      CHECK (file_size IS NULL OR file_size >= 0);
  END IF;
END $$;