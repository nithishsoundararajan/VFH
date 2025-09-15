-- Create privacy_settings table
CREATE TABLE IF NOT EXISTS privacy_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  analytics_consent BOOLEAN DEFAULT FALSE,
  marketing_consent BOOLEAN DEFAULT FALSE,
  functional_cookies BOOLEAN DEFAULT TRUE,
  data_sharing_consent BOOLEAN DEFAULT FALSE,
  email_notifications BOOLEAN DEFAULT TRUE,
  security_notifications BOOLEAN DEFAULT TRUE,
  data_retention_period INTEGER DEFAULT 365,
  auto_delete_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for privacy_settings
CREATE INDEX IF NOT EXISTS idx_privacy_settings_user_id ON privacy_settings(user_id);

-- Enable RLS for privacy_settings
ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for privacy_settings
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'privacy_settings' AND policyname = 'Users can only access their own privacy settings') THEN
    CREATE POLICY "Users can only access their own privacy settings" ON privacy_settings
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create consent_records table
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'analytics', 'marketing', 'functional', 'data_sharing', 
    'email_notifications', 'security_notifications', 'terms_of_service', 'privacy_policy'
  )),
  consent_given BOOLEAN NOT NULL,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for consent_records
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_consent_type ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_created_at ON consent_records(created_at);

-- Enable RLS for consent_records
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for consent_records
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consent_records' AND policyname = 'Users can only access their own consent records') THEN
    CREATE POLICY "Users can only access their own consent records" ON consent_records
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Enable RLS for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_logs (users can only see their own logs)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Users can only access their own audit logs') THEN
    CREATE POLICY "Users can only access their own audit logs" ON audit_logs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Admin policy for audit_logs (if you have admin roles)
-- DO $$ 
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Admins can access all audit logs') THEN
--     CREATE POLICY "Admins can access all audit logs" ON audit_logs
--       FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
--   END IF;
-- END $$;

-- Create data_exports table to track export requests
CREATE TABLE IF NOT EXISTS data_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('full', 'partial', 'gdpr')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  options JSONB,
  file_path TEXT,
  file_size BIGINT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for data_exports
CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status);
CREATE INDEX IF NOT EXISTS idx_data_exports_created_at ON data_exports(created_at);

-- Enable RLS for data_exports
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;

-- RLS policies for data_exports
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_exports' AND policyname = 'Users can only access their own data exports') THEN
    CREATE POLICY "Users can only access their own data exports" ON data_exports
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create data_deletion_requests table
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('account_deletion', 'data_cleanup', 'gdpr_erasure')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  reason TEXT,
  verification_token TEXT UNIQUE,
  verification_expires_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  deletion_summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for data_deletion_requests
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_verification_token ON data_deletion_requests(verification_token);

-- Enable RLS for data_deletion_requests
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for data_deletion_requests
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_deletion_requests' AND policyname = 'Users can only access their own deletion requests') THEN
    CREATE POLICY "Users can only access their own deletion requests" ON data_deletion_requests
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to automatically create privacy settings for new users
CREATE OR REPLACE FUNCTION create_default_privacy_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO privacy_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create privacy settings when a user is created (with conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_privacy_settings') THEN
    CREATE TRIGGER trigger_create_privacy_settings
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_default_privacy_settings();
  END IF;
END $$;

-- Function to log privacy setting changes
CREATE OR REPLACE FUNCTION log_privacy_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if this is an update (not insert)
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      ip_address,
      user_agent
    ) VALUES (
      NEW.user_id,
      'privacy_settings_updated',
      'privacy_settings',
      NEW.id::TEXT,
      jsonb_build_object(
        'old_values', to_jsonb(OLD),
        'new_values', to_jsonb(NEW),
        'changed_fields', (
          SELECT jsonb_object_agg(key, value)
          FROM jsonb_each(to_jsonb(NEW))
          WHERE to_jsonb(OLD) ->> key IS DISTINCT FROM value::TEXT
        )
      ),
      'system',
      'privacy_trigger'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log privacy setting changes (with conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_log_privacy_changes') THEN
    CREATE TRIGGER trigger_log_privacy_changes
      AFTER UPDATE ON privacy_settings
      FOR EACH ROW
      EXECUTE FUNCTION log_privacy_changes();
  END IF;
END $$;

-- Function to clean up expired data exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS void AS $$
BEGIN
  -- Delete expired export files and records
  DELETE FROM data_exports 
  WHERE expires_at < NOW() 
    AND status = 'completed';
    
  -- Update failed exports older than 7 days
  UPDATE data_exports 
  SET status = 'failed'
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND status IN ('pending', 'processing');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply data retention policies
CREATE OR REPLACE FUNCTION apply_data_retention_policies()
RETURNS void AS $$
DECLARE
  settings_record RECORD;
BEGIN
  -- Loop through all users with auto-delete enabled
  FOR settings_record IN 
    SELECT user_id, data_retention_period 
    FROM privacy_settings 
    WHERE auto_delete_enabled = TRUE
  LOOP
    -- Clean up old security events (keep minimum 90 days for compliance)
    DELETE FROM security_events 
    WHERE user_id = settings_record.user_id 
      AND created_at < NOW() - INTERVAL '90 days';
    
    -- Clean up old user sessions
    DELETE FROM user_sessions 
    WHERE user_id = settings_record.user_id 
      AND created_at < NOW() - INTERVAL '30 days';
    
    -- Clean up old generation logs based on user preference
    DELETE FROM generation_logs 
    WHERE project_id IN (
      SELECT id FROM projects WHERE user_id = settings_record.user_id
    ) AND created_at < NOW() - (settings_record.data_retention_period || ' days')::INTERVAL;
    
    -- Clean up old audit logs (keep minimum 1 year for compliance)
    DELETE FROM audit_logs 
    WHERE user_id = settings_record.user_id 
      AND created_at < NOW() - INTERVAL '1 year';
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled jobs (if pg_cron is available)
-- SELECT cron.schedule('cleanup-expired-exports', '0 2 * * *', 'SELECT cleanup_expired_exports();');
-- SELECT cron.schedule('apply-data-retention', '0 3 * * 0', 'SELECT apply_data_retention_policies();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON privacy_settings TO authenticated;
GRANT ALL ON consent_records TO authenticated;
GRANT ALL ON audit_logs TO authenticated;
GRANT ALL ON data_exports TO authenticated;
GRANT ALL ON data_deletion_requests TO authenticated;

GRANT EXECUTE ON FUNCTION create_default_privacy_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION log_privacy_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_exports() TO authenticated;
GRANT EXECUTE ON FUNCTION apply_data_retention_policies() TO authenticated;

-- Insert default privacy policies (informational) with conditional insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit_logs 
    WHERE action = 'system_initialization' 
    AND resource_type = 'compliance_system'
    AND resource_id = 'privacy_tables'
  ) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      ip_address,
      user_agent
    ) VALUES (
      NULL,
      'system_initialization',
      'compliance_system',
      'privacy_tables',
      jsonb_build_object(
        'message', 'Privacy and compliance tables initialized',
        'tables_created', ARRAY['privacy_settings', 'consent_records', 'audit_logs', 'data_exports', 'data_deletion_requests'],
        'gdpr_compliant', true,
        'retention_policies_enabled', true
      ),
      'system',
      'migration_script'
    );
  END IF;
END $$;