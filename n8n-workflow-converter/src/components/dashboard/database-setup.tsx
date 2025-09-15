'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { 
  Database, 
  ExternalLink, 
  Copy, 
  Check,
  AlertTriangle 
} from 'lucide-react';
import { useState } from 'react';

interface DatabaseSetupProps {
  onRetry: () => void;
}

export function DatabaseSetup({ onRetry }: DatabaseSetupProps) {
  const [copiedSql, setCopiedSql] = useState(false);
  const [autoSetupLoading, setAutoSetupLoading] = useState(false);
  const [autoSetupResult, setAutoSetupResult] = useState<{
    success?: boolean;
    error?: string;
  } | null>(null);

  const migrationSql = `-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  workflow_json JSONB NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  node_count INTEGER,
  trigger_count INTEGER,
  generated_at TIMESTAMP WITH TIME ZONE,
  file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_analytics table
CREATE TABLE project_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  generation_time_ms INTEGER,
  file_size_bytes BIGINT,
  node_types JSONB,
  complexity_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create generation_logs table
CREATE TABLE generation_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  log_level TEXT CHECK (log_level IN ('info', 'warning', 'error')) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shared_projects table
CREATE TABLE shared_projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE,
  permissions TEXT CHECK (permissions IN ('read', 'write')) DEFAULT 'read',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_project_analytics_project_id ON project_analytics(project_id);
CREATE INDEX idx_generation_logs_project_id ON generation_logs(project_id);
CREATE INDEX idx_generation_logs_timestamp ON generation_logs(timestamp DESC);
CREATE INDEX idx_shared_projects_project_id ON shared_projects(project_id);
CREATE INDEX idx_shared_projects_shared_by ON shared_projects(shared_by);
CREATE INDEX idx_shared_projects_shared_with ON shared_projects(shared_with);
CREATE INDEX idx_shared_projects_share_token ON shared_projects(share_token);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;

  const rlsPoliciesSql = `-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_projects ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects RLS Policies
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared projects" ON projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM shared_projects 
      WHERE shared_with = auth.uid() 
      OR (share_token IS NOT NULL AND shared_with IS NULL)
    )
  );

-- Project Analytics RLS Policies
CREATE POLICY "Users can view analytics for own projects" ON project_analytics
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analytics for own projects" ON project_analytics
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Generation Logs RLS Policies
CREATE POLICY "Users can view logs for own projects" ON generation_logs
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert logs for own projects" ON generation_logs
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Shared Projects RLS Policies
CREATE POLICY "Users can view own shared projects" ON shared_projects
  FOR SELECT USING (
    shared_by = auth.uid() OR shared_with = auth.uid()
  );

CREATE POLICY "Users can create shares for own projects" ON shared_projects
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own shares" ON shared_projects
  FOR UPDATE USING (shared_by = auth.uid());

CREATE POLICY "Users can delete own shares" ON shared_projects
  FOR DELETE USING (shared_by = auth.uid());`;

  const copyToClipboard = async (text: string, type: 'sql' | 'rls') => {
    await navigator.clipboard.writeText(text);
    setCopiedSql(type === 'sql');
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleAutoSetup = async () => {
    setAutoSetupLoading(true);
    setAutoSetupResult(null);

    try {
      const response = await fetch('/api/setup-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        setAutoSetupResult({ success: true });
        // Wait a moment then retry connection
        setTimeout(() => {
          onRetry();
        }, 1000);
      } else {
        setAutoSetupResult({ 
          success: false, 
          error: result.error || 'Setup failed' 
        });
      }
    } catch (error) {
      setAutoSetupResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      });
    } finally {
      setAutoSetupLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Alert className="mb-6 border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <div className="text-yellow-800">
          <strong>Database Setup Required</strong>
          <p className="mt-1">
            The database tables need to be created before you can use the application.
          </p>
        </div>
      </Alert>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Database Setup Instructions</h2>
        </div>

        <div className="space-y-6">
          {/* Why Manual Setup */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 text-blue-900">Why Manual Setup?</h3>
            <p className="text-blue-700 mb-2">
              For security reasons, database schema changes must be done manually through the Supabase dashboard:
            </p>
            <ul className="text-blue-700 text-sm space-y-1 ml-4">
              <li>• Prevents unauthorized database modifications</li>
              <li>• Gives you full control over your database schema</li>
              <li>• Allows you to review changes before applying them</li>
              <li>• Follows database security best practices</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Manual Setup: Access Supabase Dashboard</h3>
            <p className="text-gray-600 mb-3">
              Go to your Supabase project dashboard and navigate to the SQL Editor.
            </p>
            <Button
              variant="outline"
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Supabase Dashboard
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Manual Step 1: Create Database Schema</h3>
            <p className="text-gray-600 mb-3">
              Copy and run the following SQL to create the required tables:
            </p>
            <div className="relative">
              <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-64">
                {migrationSql}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(migrationSql, 'sql')}
              >
                {copiedSql ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Manual Step 2: Set Up Row Level Security</h3>
            <p className="text-gray-600 mb-3">
              Run this SQL to enable security policies:
            </p>
            <div className="relative">
              <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-64">
                {rlsPoliciesSql}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(rlsPoliciesSql, 'rls')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Final Step: Test Connection</h3>
            <p className="text-gray-600 mb-3">
              After running the SQL commands, click the button below to test the connection:
            </p>
            <Button onClick={onRetry}>
              Test Database Connection
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}