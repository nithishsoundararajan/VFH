-- Create error_logs table for comprehensive error tracking
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB DEFAULT '{}',
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_project_id ON error_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_error_logs_user_severity_created ON error_logs(user_id, severity, created_at DESC);

-- Create performance_metrics table for monitoring (separate from analytics)
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_project_id ON performance_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at);

-- Create system_health table for monitoring system status
CREATE TABLE IF NOT EXISTS system_health (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('healthy', 'degraded', 'unhealthy')) NOT NULL,
  response_time_ms INTEGER,
  error_rate NUMERIC,
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for system health
CREATE INDEX IF NOT EXISTS idx_system_health_service ON system_health(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);
CREATE INDEX IF NOT EXISTS idx_system_health_last_check ON system_health(last_check);

-- Create application_logs table for structured logging
CREATE TABLE IF NOT EXISTS application_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  level TEXT CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  component TEXT,
  action TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  trace_id TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for application_logs
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_timestamp ON application_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_application_logs_user_id ON application_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_component ON application_logs(component);
CREATE INDEX IF NOT EXISTS idx_application_logs_trace_id ON application_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_session_id ON application_logs(session_id);

-- Enable RLS on all tables
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for error_logs
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'error_logs' AND policyname = 'Users can view their own error logs') THEN
    CREATE POLICY "Users can view their own error logs" ON error_logs
      FOR SELECT USING (
        auth.uid() = user_id OR 
        project_id IN (
          SELECT id FROM projects WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'error_logs' AND policyname = 'System can insert error logs') THEN
    CREATE POLICY "System can insert error logs" ON error_logs
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'error_logs' AND policyname = 'Users can update their own error logs') THEN
    CREATE POLICY "Users can update their own error logs" ON error_logs
      FOR UPDATE USING (
        auth.uid() = user_id OR 
        project_id IN (
          SELECT id FROM projects WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS policies for performance_metrics
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'performance_metrics' AND policyname = 'Users can view their own performance metrics') THEN
    CREATE POLICY "Users can view their own performance metrics" ON performance_metrics
      FOR SELECT USING (
        auth.uid() = user_id OR 
        project_id IN (
          SELECT id FROM projects WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'performance_metrics' AND policyname = 'System can insert performance metrics') THEN
    CREATE POLICY "System can insert performance metrics" ON performance_metrics
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- RLS policies for system_health (admin only for now)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_health' AND policyname = 'System can manage health metrics') THEN
    CREATE POLICY "System can manage health metrics" ON system_health
      FOR ALL WITH CHECK (true);
  END IF;
END $$;

-- RLS policies for application_logs
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'application_logs' AND policyname = 'Users can view their own application logs') THEN
    CREATE POLICY "Users can view their own application logs" ON application_logs
      FOR SELECT USING (
        auth.uid() = user_id OR 
        project_id IN (
          SELECT id FROM projects WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'application_logs' AND policyname = 'System can insert application logs') THEN
    CREATE POLICY "System can insert application logs" ON application_logs
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Create function to update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for error_logs updated_at (with conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_error_logs_updated_at') THEN
    CREATE TRIGGER update_error_logs_updated_at 
      BEFORE UPDATE ON error_logs 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create function to automatically resolve old low-severity errors
CREATE OR REPLACE FUNCTION auto_resolve_old_errors()
RETURNS void AS $$
BEGIN
  UPDATE error_logs 
  SET resolved = true, 
      resolved_at = NOW(),
      resolution_notes = 'Auto-resolved: older than 30 days'
  WHERE severity = 'low' 
    AND created_at < NOW() - INTERVAL '30 days'
    AND resolved = false;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old performance metrics
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
  DELETE FROM performance_metrics 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM system_health 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  -- Delete application logs older than 90 days
  DELETE FROM application_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete resolved error logs older than 180 days
  DELETE FROM error_logs 
  WHERE resolved = true 
    AND created_at < NOW() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql;