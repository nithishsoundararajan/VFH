# Supabase Database Schema and Storage Setup

This directory contains the database migrations and configuration for the n8n Workflow Converter application.

## Database Schema

### Tables

1. **profiles** - User profile information extending Supabase auth.users
2. **projects** - Workflow conversion projects
3. **project_analytics** - Analytics data for projects
4. **generation_logs** - Logs from the code generation process
5. **shared_projects** - Project sharing and collaboration

### Migrations

- `001_initial_schema.sql` - Creates all database tables with proper relationships and indexes
- `002_rls_policies.sql` - Implements Row Level Security policies for data isolation
- `003_storage_buckets.sql` - Creates and configures Supabase Storage buckets

## Storage Buckets

### workflow-files
- **Purpose**: Store original n8n workflow JSON files
- **Size Limit**: 10MB per file
- **Allowed Types**: JSON, text files
- **Path Structure**: `{user_id}/{project_id}/workflow.json`

### generated-projects
- **Purpose**: Store generated Node.js project ZIP files
- **Size Limit**: 100MB per file
- **Allowed Types**: ZIP, compressed archives
- **Path Structure**: `{user_id}/{project_id}/project.zip`

## Row Level Security (RLS)

All tables have RLS enabled with the following access patterns:

- **profiles**: Users can only access their own profile
- **projects**: Users can access their own projects and projects shared with them
- **project_analytics**: Users can view analytics for their own and shared projects
- **generation_logs**: Users can view logs for their own and shared projects
- **shared_projects**: Users can manage shares they created and view shares directed to them

### RLS Policy Column Differences

**Important**: The RLS policies use different column comparisons based on table relationships:

#### Profiles Table (1:1 relationship)
```sql
-- profiles.id IS the user's auth ID (primary key = foreign key)
FOR SELECT USING (auth.uid() = id)
```
- `profiles.id` directly references `auth.users(id)`
- The profile record's primary key is literally the user's authentication ID
- Structure: `profiles(id UUID REFERENCES auth.users(id) PRIMARY KEY, ...)`

#### Projects Table (1:many relationship)
```sql
-- projects.user_id points to the owner (separate foreign key)
FOR SELECT USING (auth.uid() = user_id)
```
- `projects.id` is the project's own unique identifier
- `projects.user_id` is a foreign key pointing to the owner
- Structure: `projects(id UUID PRIMARY KEY, user_id UUID REFERENCES auth.users(id), ...)`

This pattern applies to all related tables:
- **project_analytics**, **generation_logs**: Use `project_id` to join with projects, then check ownership
- **shared_projects**: Use `shared_by`/`shared_with` columns for access control

## Storage Policies

Storage buckets have policies that:
- Allow users to upload/download files in their own folders
- Prevent access to other users' files
- Allow access to shared project files based on sharing permissions
- Support public sharing via share tokens

## Setup Instructions

1. **Run Migrations**
   ```sql
   -- In Supabase SQL Editor, run each migration file in order:
   -- 1. 001_initial_schema.sql
   -- 2. 002_rls_policies.sql
   -- 3. 003_storage_buckets.sql
   ```

2. **Verify Setup**
   ```sql
   -- Check tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';

   -- Check RLS is enabled
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE schemaname = 'public';

   -- Check storage buckets
   SELECT * FROM storage.buckets;
   ```

3. **Test RLS Policies**
   - Use the test files in `tests/` directory
   - Run the TypeScript test utilities in `src/lib/supabase/rls-test.ts`

## Environment Variables

Make sure these environment variables are set:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## File Structure

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   └── 003_storage_buckets.sql
├── tests/
│   └── rls_test.sql
├── docs/
│   └── RLS_PATTERNS.md
└── README.md
```

## Documentation

- **RLS_PATTERNS.md**: Detailed explanation of Row Level Security patterns and why different tables use different policy conditions

## TypeScript Integration

The database types are defined in `src/types/database.ts` and storage utilities are in:
- `src/lib/supabase/storage.ts` - Main storage operations
- `src/lib/supabase/storage-config.ts` - Configuration and validation
- `src/lib/supabase/rls-test.ts` - RLS testing utilities

## Security Considerations

1. **Data Isolation**: RLS policies ensure users can only access their own data
2. **File Access Control**: Storage policies prevent unauthorized file access
3. **Sharing Security**: Shared projects have controlled access based on permissions
4. **Input Validation**: File uploads are validated for type and size
5. **Audit Trail**: Generation logs provide audit trail for all operations

## Performance Optimizations

1. **Database Indexes**: Optimized indexes on frequently queried columns
2. **File Size Limits**: Reasonable limits to prevent storage abuse
3. **Signed URLs**: Temporary URLs for secure file downloads
4. **Connection Pooling**: Efficient database connection management

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**: Check that policies are correctly applied and user is authenticated
2. **Storage Upload Failures**: Verify file size and type restrictions
3. **Access Denied**: Ensure user has proper permissions for shared projects
4. **Migration Errors**: Run migrations in correct order and check for conflicts

### Debug Queries

```sql
-- Check user's projects
SELECT * FROM projects WHERE user_id = auth.uid();

-- Check shared projects
SELECT * FROM shared_projects WHERE shared_with = auth.uid();

-- Check storage objects
SELECT * FROM storage.objects WHERE bucket_id = 'workflow-files';
```