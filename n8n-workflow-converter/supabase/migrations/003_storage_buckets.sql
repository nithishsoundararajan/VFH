-- Create storage buckets for workflow files and generated projects

-- Create workflow-files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workflow-files',
  'workflow-files',
  false,
  10485760, -- 10MB limit
  ARRAY['application/json', 'text/plain']
);

-- Create generated-projects bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-projects',
  'generated-projects',
  false,
  104857600, -- 100MB limit
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
);

-- Storage policies for workflow-files bucket
-- Users can upload workflow files to their own folder
CREATE POLICY "Users can upload workflow files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'workflow-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own workflow files
CREATE POLICY "Users can view own workflow files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'workflow-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own workflow files
CREATE POLICY "Users can update own workflow files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'workflow-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own workflow files
CREATE POLICY "Users can delete own workflow files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'workflow-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for generated-projects bucket
-- Users can upload generated projects to their own folder
CREATE POLICY "Users can upload generated projects" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'generated-projects' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own generated projects
CREATE POLICY "Users can view own generated projects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'generated-projects' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own generated projects
CREATE POLICY "Users can update own generated projects" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'generated-projects' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own generated projects
CREATE POLICY "Users can delete own generated projects" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'generated-projects' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to view shared project files
CREATE POLICY "Users can view shared workflow files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'workflow-files' AND
    (storage.foldername(name))[2] IN (
      SELECT p.id::text FROM projects p
      JOIN shared_projects sp ON p.id = sp.project_id
      WHERE sp.shared_with = auth.uid() OR sp.share_token IS NOT NULL
    )
  );

CREATE POLICY "Users can view shared generated projects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'generated-projects' AND
    (storage.foldername(name))[2] IN (
      SELECT p.id::text FROM projects p
      JOIN shared_projects sp ON p.id = sp.project_id
      WHERE sp.shared_with = auth.uid() OR sp.share_token IS NOT NULL
    )
  );