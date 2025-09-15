-- Add workflow execution tracking tables

-- Workflow executions table
CREATE TABLE workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_node TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  workflow_data JSONB NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Execution logs table
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  node_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Node execution metrics table
CREATE TABLE node_execution_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  execution_time_ms INTEGER,
  input_size INTEGER,
  output_size INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_start_time ON workflow_executions(start_time);
CREATE INDEX idx_execution_logs_execution_id ON execution_logs(execution_id);
CREATE INDEX idx_execution_logs_timestamp ON execution_logs(timestamp);
CREATE INDEX idx_execution_logs_level ON execution_logs(level);
CREATE INDEX idx_node_execution_metrics_execution_id ON node_execution_metrics(execution_id);
CREATE INDEX idx_node_execution_metrics_node_type ON node_execution_metrics(node_type);

-- RLS policies
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_execution_metrics ENABLE ROW LEVEL SECURITY;

-- Users can only access their own executions
CREATE POLICY "Users can manage their own workflow executions" ON workflow_executions
  FOR ALL USING (auth.uid() = user_id);

-- Users can only access logs for their own executions
CREATE POLICY "Users can access logs for their own executions" ON execution_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflow_executions 
      WHERE workflow_executions.id = execution_logs.execution_id 
      AND workflow_executions.user_id = auth.uid()
    )
  );

-- Users can only access metrics for their own executions
CREATE POLICY "Users can access metrics for their own executions" ON node_execution_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflow_executions 
      WHERE workflow_executions.id = node_execution_metrics.execution_id 
      AND workflow_executions.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_workflow_executions_updated_at 
  BEFORE UPDATE ON workflow_executions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate execution statistics
CREATE OR REPLACE FUNCTION get_execution_statistics(user_uuid UUID)
RETURNS TABLE (
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  avg_execution_time_ms NUMERIC,
  total_nodes_executed BIGINT,
  most_used_node_types JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_executions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) as avg_execution_time_ms,
    COALESCE(SUM(JSONB_ARRAY_LENGTH(COALESCE(workflow_data->'nodes', '[]'::jsonb))), 0) as total_nodes_executed,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'node_type', node_type,
            'count', count
          )
        )
        FROM (
          SELECT 
            nem.node_type,
            COUNT(*) as count
          FROM node_execution_metrics nem
          JOIN workflow_executions we ON we.id = nem.execution_id
          WHERE we.user_id = user_uuid
          GROUP BY nem.node_type
          ORDER BY count DESC
          LIMIT 10
        ) top_nodes
      ),
      '[]'::jsonb
    ) as most_used_node_types
  FROM workflow_executions
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;