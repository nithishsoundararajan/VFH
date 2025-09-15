-- Create error_logs table for comprehensive error tracking
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Create performance_metrics table for monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Enable RLS on all tables
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

-- RLS policies for error_logs
CREATE POLICY "Users can view their own error logs" ON error_logs
  FOR SELECT USING (
    auth.uid() = user_id OR 
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert error logs" ON error_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own error logs" ON error_logs
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS policies for performance_metrics
CREATE POLICY "Users can view their own performance metrics" ON performance_metrics
  FOR SELECT USING (
    auth.uid() = user_id OR 
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

-- RLS policies for system_health (admin only for now)
CREATE POLICY "System can manage health metrics" ON system_health
  FOR ALL WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for error_logs updated_at
CREATE TRIGGER update_error_logs_updated_at 
  BEFORE UPDATE ON error_logs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

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
END;
$$ LANGUAGE plpgsql;
-- Cre
ate application_logs table for structured logging
CREATE TABLE IF NOT EXISTS application_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Create error_patterns table
CREATE TABLE IF NOT EXISTS error_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  auto_resolve BOOLEAN DEFAULT FALSE,
  notification_enabled BOOLEAN DEFAULT TRUE,
  occurrences INTEGER DEFAULT 0,
  last_seen TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for error_patterns
CREATE INDEX IF NOT EXISTS idx_error_patterns_pattern ON error_patterns(pattern);
CREATE INDEX IF NOT EXISTS idx_error_patterns_severity ON error_patterns(severity);
CREATE INDEX IF NOT EXISTS idx_error_patterns_occurrences ON error_patterns(occurrences);

-- Create error_notifications table
CREATE TABLE IF NOT EXISTS error_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_id UUID REFERENCES error_logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('email', 'push', 'in_app', 'webhook')) NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for error_notifications
CREATE INDEX IF NOT EXISTS idx_error_notifications_error_id ON error_notifications(error_id);
CREATE INDEX IF NOT EXISTS idx_error_notifications_user_id ON error_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_error_notifications_type ON error_notifications(type);
CREATE INDEX IF NOT EXISTS idx_error_notifications_sent ON error_notifications(sent);

-- Create error_resolutions table
CREATE TABLE IF NOT EXISTS error_resolutions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_id UUID REFERENCES error_logs(id) ON DELETE CASCADE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution TEXT NOT NULL,
  prevention_steps TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for error_resolutions
CREATE INDEX IF NOT EXISTS idx_error_resolutions_error_id ON error_resolutions(error_id);
CREATE INDEX IF NOT EXISTS idx_error_resolutions_resolved_by ON error_resolutions(resolved_by);

-- Create alert_conditions table
CREATE TABLE IF NOT EXISTS alert_conditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  query_config JSONB NOT NULL,
  threshold INTEGER NOT NULL,
  time_window_minutes INTEGER DEFAULT 60,
  enabled BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMP WITH TIME ZONE,
  notification_channels TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for alert_conditions
CREATE INDEX IF NOT EXISTS idx_alert_conditions_enabled ON alert_conditions(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_conditions_last_triggered ON alert_conditions(last_triggered);

-- Enable RLS on new tables
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_conditions ENABLE ROW LEVEL SECURITY;

-- RLS policies for application_logs
CREATE POLICY "Users can view their own application logs" ON application_logs
  FOR SELECT USING (
    auth.uid() = user_id OR 
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert application logs" ON application_logs
  FOR INSERT WITH CHECK (true);

-- RLS policies for error_patterns (admin only for now)
CREATE POLICY "System can manage error patterns" ON error_patterns
  FOR ALL WITH CHECK (true);

-- RLS policies for error_notifications
CREATE POLICY "Users can view their own notifications" ON error_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON error_notifications
  FOR INSERT WITH CHECK (true);

-- RLS policies for error_resolutions
CREATE POLICY "Users can view resolutions for their errors" ON error_resolutions
  FOR SELECT USING (
    error_id IN (
      SELECT id FROM error_logs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create resolutions" ON error_resolutions
  FOR INSERT WITH CHECK (
    error_id IN (
      SELECT id FROM error_logs WHERE user_id = auth.uid()
    )
  );

-- RLS policies for alert_conditions (admin only for now)
CREATE POLICY "System can manage alert conditions" ON alert_conditions
  FOR ALL WITH CHECK (true);

-- Create triggers for updated_at columns
CREATE TRIGGER update_error_patterns_updated_at 
  BEFORE UPDATE ON error_patterns 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_conditions_updated_at 
  BEFORE UPDATE ON alert_conditions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to increment occurrences
CREATE OR REPLACE FUNCTION increment_occurrences()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(OLD.occurrences, 0) + 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old logs
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  -- Delete application logs older than 90 days
  DELETE FROM application_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete resolved error logs older than 180 days
  DELETE FROM error_logs 
  WHERE resolved = true 
    AND created_at < NOW() - INTERVAL '180 days';
    
  -- Delete old notifications
  DELETE FROM error_notifications 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;