-- Create comprehensive analytics tables for data collection (with existence checks)

-- Create user_analytics table for tracking user engagement
CREATE TABLE IF NOT EXISTS user_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'login', 'logout', 'project_create', 'project_view', 'download', etc.
  event_data JSONB, -- Additional event-specific data
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create node_usage_analytics table for tracking node type usage
CREATE TABLE IF NOT EXISTS node_usage_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  node_type TEXT NOT NULL,
  node_count INTEGER DEFAULT 1,
  complexity_score INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  success_rate DECIMAL(5,2) DEFAULT 100.00, -- Percentage
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feature_usage_analytics table for tracking feature engagement
CREATE TABLE IF NOT EXISTS feature_usage_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature_name TEXT NOT NULL, -- 'workflow_upload', 'real_time_progress', 'ai_provider_config', etc.
  usage_count INTEGER DEFAULT 1,
  session_duration_ms INTEGER,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_complexity_analytics table for detailed workflow analysis
CREATE TABLE IF NOT EXISTS workflow_complexity_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_nodes INTEGER NOT NULL,
  total_connections INTEGER NOT NULL,
  max_depth INTEGER DEFAULT 0, -- Maximum execution depth
  branching_factor DECIMAL(5,2) DEFAULT 0, -- Average branches per node
  cyclic_complexity INTEGER DEFAULT 0, -- Number of cycles in workflow
  unique_node_types INTEGER DEFAULT 0,
  trigger_types JSONB, -- Array of trigger types used
  estimated_execution_time_ms INTEGER,
  memory_estimate_mb DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhance existing project_analytics table with additional columns (with existence checks)
DO $$ 
BEGIN
  -- Add memory_usage_mb column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_analytics' AND column_name = 'memory_usage_mb'
  ) THEN
    ALTER TABLE project_analytics ADD COLUMN memory_usage_mb DECIMAL(10,2);
    RAISE NOTICE 'Added memory_usage_mb column to project_analytics table';
  ELSE
    RAISE NOTICE 'memory_usage_mb column already exists in project_analytics table';
  END IF;

  -- Add cpu_usage_percent column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_analytics' AND column_name = 'cpu_usage_percent'
  ) THEN
    ALTER TABLE project_analytics ADD COLUMN cpu_usage_percent DECIMAL(5,2);
    RAISE NOTICE 'Added cpu_usage_percent column to project_analytics table';
  ELSE
    RAISE NOTICE 'cpu_usage_percent column already exists in project_analytics table';
  END IF;

  -- Add api_calls_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_analytics' AND column_name = 'api_calls_count'
  ) THEN
    ALTER TABLE project_analytics ADD COLUMN api_calls_count INTEGER DEFAULT 0;
    RAISE NOTICE 'Added api_calls_count column to project_analytics table';
  ELSE
    RAISE NOTICE 'api_calls_count column already exists in project_analytics table';
  END IF;

  -- Add error_rate column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_analytics' AND column_name = 'error_rate'
  ) THEN
    ALTER TABLE project_analytics ADD COLUMN error_rate DECIMAL(5,2) DEFAULT 0;
    RAISE NOTICE 'Added error_rate column to project_analytics table';
  ELSE
    RAISE NOTICE 'error_rate column already exists in project_analytics table';
  END IF;

  -- Add optimization_suggestions column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_analytics' AND column_name = 'optimization_suggestions'
  ) THEN
    ALTER TABLE project_analytics ADD COLUMN optimization_suggestions JSONB;
    RAISE NOTICE 'Added optimization_suggestions column to project_analytics table';
  ELSE
    RAISE NOTICE 'optimization_suggestions column already exists in project_analytics table';
  END IF;
END $$;

-- Create indexes for performance optimization (with existence checks)
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_event_type ON user_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_user_analytics_created_at ON user_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_analytics_session_id ON user_analytics(session_id);

CREATE INDEX IF NOT EXISTS idx_node_usage_analytics_project_id ON node_usage_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_node_usage_analytics_user_id ON node_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_node_usage_analytics_node_type ON node_usage_analytics(node_type);
CREATE INDEX IF NOT EXISTS idx_node_usage_analytics_created_at ON node_usage_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_usage_analytics_user_id ON feature_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_analytics_feature_name ON feature_usage_analytics(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_usage_analytics_last_used_at ON feature_usage_analytics(last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_complexity_analytics_project_id ON workflow_complexity_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_complexity_analytics_user_id ON workflow_complexity_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_complexity_analytics_total_nodes ON workflow_complexity_analytics(total_nodes);

-- Create function for updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns (with existence checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_feature_usage_analytics_updated_at'
  ) THEN
    CREATE TRIGGER update_feature_usage_analytics_updated_at 
    BEFORE UPDATE ON feature_usage_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    RAISE NOTICE 'Created update trigger for feature_usage_analytics table';
  ELSE
    RAISE NOTICE 'Update trigger already exists for feature_usage_analytics table';
  END IF;
END $$;

-- Enable RLS for analytics tables
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_complexity_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (with existence checks)
DO $$
BEGIN
  -- User analytics policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_analytics' 
    AND policyname = 'Users can view their own analytics'
  ) THEN
    CREATE POLICY "Users can view their own analytics" ON user_analytics
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_analytics' 
    AND policyname = 'Users can insert their own analytics'
  ) THEN
    CREATE POLICY "Users can insert their own analytics" ON user_analytics
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Node usage analytics policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'node_usage_analytics' 
    AND policyname = 'Users can view their own node usage analytics'
  ) THEN
    CREATE POLICY "Users can view their own node usage analytics" ON node_usage_analytics
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'node_usage_analytics' 
    AND policyname = 'Users can insert their own node usage analytics'
  ) THEN
    CREATE POLICY "Users can insert their own node usage analytics" ON node_usage_analytics
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Feature usage analytics policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'feature_usage_analytics' 
    AND policyname = 'Users can view their own feature usage analytics'
  ) THEN
    CREATE POLICY "Users can view their own feature usage analytics" ON feature_usage_analytics
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'feature_usage_analytics' 
    AND policyname = 'Users can insert their own feature usage analytics'
  ) THEN
    CREATE POLICY "Users can insert their own feature usage analytics" ON feature_usage_analytics
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'feature_usage_analytics' 
    AND policyname = 'Users can update their own feature usage analytics'
  ) THEN
    CREATE POLICY "Users can update their own feature usage analytics" ON feature_usage_analytics
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  -- Workflow complexity analytics policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workflow_complexity_analytics' 
    AND policyname = 'Users can view their own workflow complexity analytics'
  ) THEN
    CREATE POLICY "Users can view their own workflow complexity analytics" ON workflow_complexity_analytics
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workflow_complexity_analytics' 
    AND policyname = 'Users can insert their own workflow complexity analytics'
  ) THEN
    CREATE POLICY "Users can insert their own workflow complexity analytics" ON workflow_complexity_analytics
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  RAISE NOTICE 'Analytics RLS policies created or verified';
END $$;

-- Create functions for analytics data aggregation
CREATE OR REPLACE FUNCTION get_user_analytics_summary(user_uuid UUID)
RETURNS TABLE (
  total_projects INTEGER,
  total_downloads INTEGER,
  avg_generation_time_ms DECIMAL,
  most_used_node_type TEXT,
  total_sessions INTEGER,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM projects WHERE user_id = user_uuid),
    (SELECT COUNT(*)::INTEGER FROM download_history WHERE user_id = user_uuid),
    (SELECT AVG(generation_time_ms) FROM project_analytics pa 
     JOIN projects p ON pa.project_id = p.id WHERE p.user_id = user_uuid),
    (SELECT node_type FROM node_usage_analytics 
     WHERE user_id = user_uuid 
     GROUP BY node_type 
     ORDER BY SUM(node_count) DESC 
     LIMIT 1),
    (SELECT COUNT(DISTINCT session_id)::INTEGER FROM user_analytics WHERE user_id = user_uuid),
    (SELECT MAX(created_at) FROM user_analytics WHERE user_id = user_uuid);
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate workflow complexity score
CREATE OR REPLACE FUNCTION calculate_workflow_complexity(workflow_data JSONB)
RETURNS INTEGER AS $$
DECLARE
  node_count INTEGER;
  connection_count INTEGER;
  unique_types INTEGER;
  complexity_score INTEGER;
BEGIN
  -- Extract basic metrics from workflow JSON
  node_count := jsonb_array_length(workflow_data->'nodes');
  connection_count := jsonb_array_length(workflow_data->'connections');
  
  -- Count unique node types
  SELECT COUNT(DISTINCT node->>'type') INTO unique_types
  FROM jsonb_array_elements(workflow_data->'nodes') AS node;
  
  -- Calculate complexity score (weighted formula)
  complexity_score := (node_count * 2) + (connection_count * 3) + (unique_types * 5);
  
  RETURN complexity_score;
END;
$$ LANGUAGE plpgsql;

-- Create function for automatic analytics cleanup (privacy compliance)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
  -- Delete analytics data older than 2 years (configurable for GDPR compliance)
  DELETE FROM user_analytics WHERE created_at < NOW() - INTERVAL '2 years';
  DELETE FROM node_usage_analytics WHERE created_at < NOW() - INTERVAL '2 years';
  
  -- Keep feature usage analytics longer for product insights
  DELETE FROM feature_usage_analytics WHERE created_at < NOW() - INTERVAL '3 years';
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE user_analytics IS 'Tracks user engagement and behavior analytics';
COMMENT ON TABLE node_usage_analytics IS 'Tracks usage patterns of different n8n node types';
COMMENT ON TABLE feature_usage_analytics IS 'Tracks feature adoption and usage metrics';
COMMENT ON TABLE workflow_complexity_analytics IS 'Analyzes workflow complexity and performance metrics';