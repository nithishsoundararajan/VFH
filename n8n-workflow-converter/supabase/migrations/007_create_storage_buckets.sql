-- Create storage buckets for file management
-- Note: This migration is designed for Supabase environments with Storage enabled

-- Check if storage schema exists (Supabase Storage feature)
DO $$
BEGIN
  -- Only proceed if we're in a Supabase environment with storage
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    
    -- Create workflow-files bucket for original n8n JSON files
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
    SELECT 
      'workflow-files',
      'workflow-files',
      false,
      52428800, -- 50MB limit
      ARRAY['application/json', 'text/plain'],
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.buckets WHERE id = 'workflow-files'
    );

    -- Create generated-projects bucket for generated Node.js project files
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
    SELECT 
      'generated-projects',
      'generated-projects',
      false,
      104857600, -- 100MB limit
      ARRAY['application/zip', 'application/x-tar', 'application/gzip', 'application/x-compressed'],
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.buckets WHERE id = 'generated-projects'
    );

    -- Create user-uploads bucket for temporary file uploads
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
    SELECT 
      'user-uploads',
      'user-uploads',
      false,
      52428800, -- 50MB limit
      ARRAY['application/json', 'text/plain', 'application/octet-stream'],
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.buckets WHERE id = 'user-uploads'
    );

    RAISE NOTICE 'Storage buckets created successfully';
  ELSE
    RAISE NOTICE 'Storage schema not found - skipping bucket creation. This is normal for non-Supabase environments.';
  END IF;
END $$;

-- Create RLS policies for storage objects (only if storage schema exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    
    -- Create RLS policies for workflow-files bucket
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can upload their own workflow files'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can upload their own workflow files" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = ''workflow-files'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can view their own workflow files'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view their own workflow files" ON storage.objects
        FOR SELECT USING (
          bucket_id = ''workflow-files'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can update their own workflow files'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can update their own workflow files" ON storage.objects
        FOR UPDATE USING (
          bucket_id = ''workflow-files'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can delete their own workflow files'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can delete their own workflow files" ON storage.objects
        FOR DELETE USING (
          bucket_id = ''workflow-files'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    -- Create RLS policies for generated-projects bucket
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can upload their own generated projects'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can upload their own generated projects" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = ''generated-projects'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can view their own generated projects'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view their own generated projects" ON storage.objects
        FOR SELECT USING (
          bucket_id = ''generated-projects'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can update their own generated projects'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can update their own generated projects" ON storage.objects
        FOR UPDATE USING (
          bucket_id = ''generated-projects'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can delete their own generated projects'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can delete their own generated projects" ON storage.objects
        FOR DELETE USING (
          bucket_id = ''generated-projects'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    -- Create RLS policies for user-uploads bucket
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can upload their own files'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can upload their own files" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = ''user-uploads'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can view their own uploads'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view their own uploads" ON storage.objects
        FOR SELECT USING (
          bucket_id = ''user-uploads'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can update their own uploads'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can update their own uploads" ON storage.objects
        FOR UPDATE USING (
          bucket_id = ''user-uploads'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can delete their own uploads'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can delete their own uploads" ON storage.objects
        FOR DELETE USING (
          bucket_id = ''user-uploads'' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )';
    END IF;

    RAISE NOTICE 'Storage RLS policies created successfully';
  ELSE
    RAISE NOTICE 'Storage schema not found - skipping RLS policy creation';
  END IF;
END $$;

-- Create shared project access policies (only if storage and required tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_projects') THEN
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can view shared projects'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view shared projects" ON storage.objects
        FOR SELECT USING (
          bucket_id = ''generated-projects'' AND
          EXISTS (
            SELECT 1 FROM shared_projects sp
            JOIN projects p ON sp.project_id = p.id
            WHERE p.file_path = name AND (
              sp.shared_with = auth.uid() OR
              (sp.share_token IS NOT NULL AND sp.expires_at > NOW())
            )
          )
        )';
    END IF;

    RAISE NOTICE 'Shared project policies created successfully';
  ELSE
    RAISE NOTICE 'Storage schema or shared_projects table not found - skipping shared project policies';
  END IF;
END $$;