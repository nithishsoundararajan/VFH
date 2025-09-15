-- Create user_sessions table for secure session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_sessions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_sessions' AND policyname = 'Users can only access their own sessions') THEN
    CREATE POLICY "Users can only access their own sessions" ON user_sessions
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create security_events table for audit logging
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_success', 'login_failure', 'logout', 'session_expired',
    'suspicious_activity', 'rate_limit_exceeded', 'file_quarantined',
    'csrf_violation', 'invalid_session', 'concurrent_session_limit'
  )),
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  details JSONB,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for security events
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);

-- Enable RLS for security events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for security events (users can only see their own events)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_events' AND policyname = 'Users can only access their own security events') THEN
    CREATE POLICY "Users can only access their own security events" ON security_events
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Admin policy for security events (if you have admin roles)
-- DO $$ 
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_events' AND policyname = 'Admins can access all security events') THEN
--     CREATE POLICY "Admins can access all security events" ON security_events
--       FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
--   END IF;
-- END $$;

-- Create quarantined_files table
CREATE TABLE IF NOT EXISTS quarantined_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  scan_result JSONB NOT NULL,
  quarantine_reason TEXT NOT NULL,
  quarantined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('quarantined', 'released', 'deleted')) DEFAULT 'quarantined'
);

-- Create indexes for quarantined files
CREATE INDEX IF NOT EXISTS idx_quarantined_files_user_id ON quarantined_files(user_id);
CREATE INDEX IF NOT EXISTS idx_quarantined_files_status ON quarantined_files(status);
CREATE INDEX IF NOT EXISTS idx_quarantined_files_quarantined_at ON quarantined_files(quarantined_at);

-- Enable RLS for quarantined files
ALTER TABLE quarantined_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for quarantined files
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quarantined_files' AND policyname = 'Users can only access their own quarantined files') THEN
    CREATE POLICY "Users can only access their own quarantined files" ON quarantined_files
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'low'
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO security_events (
    user_id, event_type, ip_address, user_agent, details, severity
  ) VALUES (
    p_user_id, p_event_type, p_ip_address, p_user_agent, p_details, p_severity
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up expired sessions (if pg_cron is available)
-- SELECT cron.schedule('cleanup-expired-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_sessions TO authenticated;
GRANT ALL ON security_events TO authenticated;
GRANT ALL ON quarantined_files TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;