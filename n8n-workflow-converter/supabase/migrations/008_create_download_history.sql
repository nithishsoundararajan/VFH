-- Create download_history table for tracking downloads
CREATE TABLE IF NOT EXISTS download_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  format TEXT CHECK (format IN ('zip', 'tar.gz', 'individual')) NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_download_history_user_id ON download_history(user_id);
CREATE INDEX IF NOT EXISTS idx_download_history_project_id ON download_history(project_id);
CREATE INDEX IF NOT EXISTS idx_download_history_downloaded_at ON download_history(downloaded_at DESC);

-- Create RLS policies for download_history
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own download history" ON download_history;
DROP POLICY IF EXISTS "Users can insert their own download history" ON download_history;

-- Create RLS policies
CREATE POLICY "Users can view their own download history" ON download_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own download history" ON download_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to clean up expired download history entries
CREATE OR REPLACE FUNCTION cleanup_expired_downloads()
RETURNS void AS $$
BEGIN
  DELETE FROM download_history 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired entries (if pg_cron is available)
-- This would typically be set up separately in production
-- SELECT cron.schedule('cleanup-downloads', '0 2 * * *', 'SELECT cleanup_expired_downloads();');

-- Add file_path column to projects table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE projects ADD COLUMN file_path TEXT;
    RAISE NOTICE 'Added file_path column to projects table';
  ELSE
    RAISE NOTICE 'file_path column already exists in projects table';
  END IF;
END $$;

-- Add workflow_file_path column to projects table for storing original workflow files
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'workflow_file_path'
  ) THEN
    ALTER TABLE projects ADD COLUMN workflow_file_path TEXT;
    RAISE NOTICE 'Added workflow_file_path column to projects table';
  ELSE
    RAISE NOTICE 'workflow_file_path column already exists in projects table';
  END IF;
END $$;

-- Add configuration column to projects table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'configuration'
  ) THEN
    ALTER TABLE projects ADD COLUMN configuration JSONB;
    RAISE NOTICE 'Added configuration column to projects table';
  ELSE
    RAISE NOTICE 'configuration column already exists in projects table';
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE download_history IS 'Tracks user download history for generated projects';
COMMENT ON COLUMN download_history.format IS 'Download format: zip, tar.gz, or individual files';
COMMENT ON COLUMN download_history.file_name IS 'Name of the downloaded file';
COMMENT ON COLUMN download_history.file_size IS 'Size of the downloaded file in bytes';
COMMENT ON COLUMN download_history.expires_at IS 'When the download link expires (optional)';

COMMENT ON COLUMN projects.file_path IS 'Path to the generated project file in storage';
COMMENT ON COLUMN projects.workflow_file_path IS 'Path to the original workflow JSON file in storage';
COMMENT ON COLUMN projects.configuration IS 'Project configuration settings as JSON';