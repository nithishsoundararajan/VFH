-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_projects ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
-- 
-- IMPORTANT: In the profiles table, the 'id' column IS the user's auth ID
-- profiles.id = auth.users.id = auth.uid()
-- This is a 1:1 relationship where profiles extend the auth.users table
--
-- Table structure: profiles(id UUID REFERENCES auth.users(id) PRIMARY KEY, ...)
-- 
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);  -- Compare auth.uid() directly to profiles.id

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);  -- Compare auth.uid() directly to profiles.id

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);  -- Compare auth.uid() directly to profiles.id

-- Projects RLS Policies
--
-- IMPORTANT: In the projects table, 'user_id' is a foreign key pointing to the owner
-- projects.id = unique project identifier (NOT the user ID)
-- projects.user_id = auth.users.id = auth.uid()
-- This is a 1:many relationship where users can own multiple projects
--
-- Table structure: projects(id UUID PRIMARY KEY, user_id UUID REFERENCES auth.users(id), ...)
--
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);  -- Compare auth.uid() to projects.user_id (FK)

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Users can also view projects shared with them
CREATE POLICY "Users can view shared projects" ON projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM shared_projects 
      WHERE shared_with = auth.uid() 
      OR (share_token IS NOT NULL AND shared_with IS NULL)
    )
  );

-- Project Analytics RLS Policies
-- Users can only access analytics for their own projects or shared projects
CREATE POLICY "Users can view analytics for own projects" ON project_analytics
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view analytics for shared projects" ON project_analytics
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM shared_projects 
      WHERE shared_with = auth.uid() 
      OR (share_token IS NOT NULL AND shared_with IS NULL)
    )
  );

CREATE POLICY "Users can insert analytics for own projects" ON project_analytics
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update analytics for own projects" ON project_analytics
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Generation Logs RLS Policies
-- Users can only access logs for their own projects or shared projects
CREATE POLICY "Users can view logs for own projects" ON generation_logs
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view logs for shared projects" ON generation_logs
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM shared_projects 
      WHERE shared_with = auth.uid() 
      OR (share_token IS NOT NULL AND shared_with IS NULL)
    )
  );

CREATE POLICY "Users can insert logs for own projects" ON generation_logs
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Shared Projects RLS Policies
-- Users can view shares they created or shares directed to them
CREATE POLICY "Users can view own shared projects" ON shared_projects
  FOR SELECT USING (
    shared_by = auth.uid() OR shared_with = auth.uid()
  );

-- Users can create shares for their own projects
CREATE POLICY "Users can create shares for own projects" ON shared_projects
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can update shares they created
CREATE POLICY "Users can update own shares" ON shared_projects
  FOR UPDATE USING (shared_by = auth.uid());

-- Users can delete shares they created
CREATE POLICY "Users can delete own shares" ON shared_projects
  FOR DELETE USING (shared_by = auth.uid());

-- Public share access policy (for share tokens)
CREATE POLICY "Public access via share token" ON shared_projects
  FOR SELECT USING (share_token IS NOT NULL AND shared_with IS NULL);