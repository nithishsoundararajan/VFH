-- Test script for Row Level Security policies
-- This script can be run in Supabase SQL editor to test RLS policies

-- Test 1: Create test users (simulate different user contexts)
-- Note: In actual testing, you would use different authenticated sessions

-- Test 2: Test profiles access
-- Should only return the current user's profile
SELECT * FROM profiles WHERE id = auth.uid();

-- Test 3: Test projects access
-- Should only return projects owned by the current user
SELECT * FROM projects WHERE user_id = auth.uid();

-- Test 4: Test shared projects access
-- Create a test share and verify access
INSERT INTO shared_projects (project_id, shared_by, shared_with, permissions)
VALUES (
  (SELECT id FROM projects LIMIT 1),
  auth.uid(),
  'test-user-id',
  'read'
);

-- Test 5: Test analytics access
-- Should only return analytics for user's own projects
SELECT pa.* FROM project_analytics pa
JOIN projects p ON pa.project_id = p.id
WHERE p.user_id = auth.uid();

-- Test 6: Test generation logs access
-- Should only return logs for user's own projects
SELECT gl.* FROM generation_logs gl
JOIN projects p ON gl.project_id = p.id
WHERE p.user_id = auth.uid();

-- Test 7: Test unauthorized access (should return empty results)
-- These queries should return no results when run by unauthorized users
SELECT * FROM profiles WHERE id != auth.uid();
SELECT * FROM projects WHERE user_id != auth.uid();

-- Test 8: Test public share token access
-- Create a public share and test access
INSERT INTO shared_projects (project_id, shared_by, share_token, permissions)
VALUES (
  (SELECT id FROM projects LIMIT 1),
  auth.uid(),
  'public-share-token-123',
  'read'
);

-- Verify public share is accessible
SELECT * FROM shared_projects WHERE share_token = 'public-share-token-123';

-- Clean up test data
DELETE FROM shared_projects WHERE share_token = 'public-share-token-123';
DELETE FROM shared_projects WHERE shared_with = 'test-user-id';