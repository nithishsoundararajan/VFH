-- Create comprehensive analytics tables for data collection

-- Create user_analytics table for tracking user engagement
CREATE TABLE user_analytics (
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
CREATE TABLE node_usage_analytics (
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
CREATE TABLE feature_usage_analytics (
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

-- Create performance_metrics table for system performance tracking
CREATE TABLE performance_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'generation_time', 'file_size', 'memory_usage', 'api_response_time'
  metric_value DECIMAL(15,4) NOT NULL,
  metric_unit TEXT NOT NULL, -- 'ms', 'bytes', 'mb', 'seconds'
  context_data JSONB, -- Additional context like node count, complexity, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_complexity_analytics table for detailed workflow analysis
CREATE TABLE workflow_complexity_analytics (
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

-- Enhance existing project_analytics table with additional columns
ALTER TABLE project_analytics ADD COLUMN IF NOT EXISTS memory_usage_mb DECIMAL(10,2);
ALTER TABLE project_analytics ADD COLUMN IF NOT EXISTS cpu_usage_percent DECIMAL(5,2);
ALTER TABLE project_analytics ADD COLUMN IF NOT EXISTS api_calls_count INTEGER DEFAULT 0;
ALTER TABLE project_analytics ADD COLUMN IF NOT EXISTS error_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE project_analytics ADD COLUMN IF NOT EXISTS optimization_suggestions JSONB;

-- Create indexes for performance optimization
CREATE INDEX idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_event_type ON user_analytics(event_type);
CREATE INDEX idx_user_analytics_created_at ON user_analytics(created_at DESC);
CREATE INDEX idx_user_analytics_session_id ON user_analytics(session_id);

CREATE INDEX idx_node_usage_analytics_project_id ON node_usage_analytics(project_id);
CREATE INDEX idx_node_usage_analytics_user_id ON node_usage_analytics(user_id);
CREATE INDEX idx_node_usage_analytics_node_type ON node_usage_analytics(node_type);
CREATE INDEX idx_node_usage_analytics_created_at ON node_usage_analytics(created_at DESC);

CREATE INDEX idx_feature_usage_analytics_user_id ON feature_usage_analytics(user_id);
CREATE INDEX idx_feature_usage_analytics_feature_name ON feature_usage_analytics(feature_name);
CREATE INDEX idx_feature_usage_analytics_last_used_at ON feature_usage_analytics(last_used_at DESC);

CREATE INDEX idx_performance_metrics_project_id ON performance_metrics(project_id);
CREATE INDEX idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX idx_performance_metrics_metric_type ON performance_metrics(metric_type);
CREATE INDEX idx_performance_metrics_created_at ON performance_metrics(created_at DESC);

CREATE INDEX idx_workflow_complexity_analytics_project_id ON workflow_complexity_analytics(project_id);
CREATE INDEX idx_workflow_complexity_analytics_user_id ON workflow_complexity_analytics(user_id);
CREATE INDEX idx_workflow_complexity_analytics_total_nodes ON workflow_complexity_analytics(total_nodes);

-- Create triggers for updated_at columns
CREATE TRIGGER update_feature_usage_analytics_updated_at BEFORE UPDATE ON feature_usage_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies for analytics tables
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_complexity_analytics ENABLE ROW LEVEL SECURITY;

-- User analytics policies
CREATE POLICY "Users can view their own analytics" ON user_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics" ON user_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Node usage analytics policies
CREATE POLICY "Users can view their own node usage analytics" ON node_usage_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own node usage analytics" ON node_usage_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Feature usage analytics policies
CREATE POLICY "Users can view their own feature usage analytics" ON feature_usage_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feature usage analytics" ON feature_usage_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feature usage analytics" ON feature_usage_analytics
  FOR UPDATE USING (auth.uid() = user_id);

-- Performance metrics policies
CREATE POLICY "Users can view their own performance metrics" ON performance_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Workflow complexity analytics policies
CREATE POLICY "Users can view their own workflow complexity analytics" ON workflow_complexity_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflow complexity analytics" ON workflow_complexity_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create functions for analytics data aggregation
CREATE OR REPLACE FUNCTION get_user_analytics_summary(user_uuid UUID)
RETURNS TABLE (
  total_projects INTEGER,
  total_downloads INTEGER,
  avg_generation_time_ms DECIMAL,
  most_used_node_type TEXT,
  total_sessions INTEGER,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $
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
$ LANGUAGE plpgsql;

-- Create function to calculate workflow complexity score
CREATE OR REPLACE FUNCTION calculate_workflow_complexity(workflow_data JSONB)
RETURNS INTEGER AS $
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
$ LANGUAGE plpgsql;

-- Create function for automatic analytics cleanup (privacy compliance)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $
BEGIN
  -- Delete analytics data older than 2 years (configurable for GDPR compliance)
  DELETE FROM user_analytics WHERE created_at < NOW() - INTERVAL '2 years';
  DELETE FROM node_usage_analytics WHERE created_at < NOW() - INTERVAL '2 years';
  DELETE FROM performance_metrics WHERE created_at < NOW() - INTERVAL '2 years';
  
  -- Keep feature usage analytics longer for product insights
  DELETE FROM feature_usage_analytics WHERE created_at < NOW() - INTERVAL '3 years';
END;
$ LANGUAGE plpgsql;