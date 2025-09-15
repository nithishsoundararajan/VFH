# Row Level Security (RLS) Patterns Documentation

This document explains the different RLS policy patterns used in the n8n Workflow Converter database schema.

## Overview

Row Level Security (RLS) policies control which rows users can access in each table. The policy conditions vary based on the table's relationship to the authenticated user.

## Table Relationship Patterns

### Pattern 1: Direct User Extension (1:1)

**Example: `profiles` table**

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  -- other columns...
);
```

**RLS Policy:**
```sql
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
```

**Explanation:**
- The `id` column IS the user's authentication ID
- `profiles.id` = `auth.users.id` = `auth.uid()`
- Direct comparison: `auth.uid() = id`
- One profile per user (1:1 relationship)

### Pattern 2: User Ownership (1:many)

**Example: `projects` table**

```sql
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  -- other columns...
);
```

**RLS Policy:**
```sql
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);
```

**Explanation:**
- The `id` column is the project's unique identifier (NOT the user ID)
- The `user_id` column points to the owner
- `projects.user_id` = `auth.users.id` = `auth.uid()`
- Comparison: `auth.uid() = user_id`
- Multiple projects per user (1:many relationship)

### Pattern 3: Indirect Ownership via Join

**Example: `project_analytics` table**

```sql
CREATE TABLE project_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  generation_time_ms INTEGER,
  -- other columns...
);
```

**RLS Policy:**
```sql
CREATE POLICY "Users can view analytics for own projects" ON project_analytics
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

**Explanation:**
- No direct user reference in the table
- Ownership determined through `projects` table join
- Subquery checks if the project belongs to the current user
- Pattern: `project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())`

### Pattern 4: Sharing and Collaboration

**Example: `shared_projects` table**

```sql
CREATE TABLE shared_projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE,
  -- other columns...
);
```

**RLS Policies:**
```sql
-- Users can view shares they created or shares directed to them
CREATE POLICY "Users can view own shared projects" ON shared_projects
  FOR SELECT USING (
    shared_by = auth.uid() OR shared_with = auth.uid()
  );

-- Public access via share token
CREATE POLICY "Public access via share token" ON shared_projects
  FOR SELECT USING (share_token IS NOT NULL AND shared_with IS NULL);
```

**Explanation:**
- Multiple user references: `shared_by` and `shared_with`
- OR condition allows access for both sharers and recipients
- Public sharing via tokens (no specific user required)

## Complete RLS Policy Matrix

| Table | Primary Access Pattern | Column Used | Relationship Type |
|-------|----------------------|-------------|-------------------|
| `profiles` | Direct user extension | `id` | 1:1 with auth.users |
| `projects` | User ownership | `user_id` | 1:many from auth.users |
| `project_analytics` | Indirect via projects | `project_id` (join) | many:1 to projects |
| `generation_logs` | Indirect via projects | `project_id` (join) | many:1 to projects |
| `shared_projects` | Multi-user collaboration | `shared_by`, `shared_with` | many:many |

## Policy Condition Patterns

### 1. Direct Comparison
```sql
auth.uid() = column_name
```
Used when the column directly contains the user's ID.

### 2. Subquery Join
```sql
foreign_key_column IN (
  SELECT id FROM parent_table WHERE user_id = auth.uid()
)
```
Used when ownership is determined through a parent table.

### 3. Multiple User References
```sql
user_column_1 = auth.uid() OR user_column_2 = auth.uid()
```
Used for tables with multiple user relationships.

### 4. Public Access Conditions
```sql
public_flag = true OR share_token IS NOT NULL
```
Used for publicly accessible records.

## Best Practices

1. **Consistency**: Use the same pattern for similar relationships
2. **Performance**: Index columns used in RLS conditions
3. **Security**: Always use `auth.uid()` for user identification
4. **Clarity**: Add comments explaining the relationship pattern
5. **Testing**: Verify policies work with different user scenarios

## Common Mistakes to Avoid

1. **Wrong Column**: Using `id` instead of `user_id` for ownership tables
2. **Missing Indexes**: Not indexing RLS condition columns
3. **Overly Complex**: Creating unnecessarily complex policy conditions
4. **Inconsistent Patterns**: Using different approaches for similar relationships
5. **Missing Edge Cases**: Not handling NULL values or special conditions

## Testing RLS Policies

Use the provided test utilities:

```typescript
// Test direct user access
await rlsTest.testProfileAccess(userId);

// Test ownership access
await rlsTest.testProjectAccess(userId);

// Test indirect access
await rlsTest.testAnalyticsAccess(userId);

// Test sharing access
await rlsTest.testSharedProjectAccess(projectId, sharedUserId);
```

## Performance Considerations

1. **Index RLS Columns**: Always index columns used in RLS conditions
2. **Avoid Complex Joins**: Keep subqueries simple when possible
3. **Use Appropriate Data Types**: UUID for user IDs, proper indexes
4. **Monitor Query Plans**: Check that RLS doesn't cause performance issues

## Security Considerations

1. **Defense in Depth**: RLS is one layer; validate in application code too
2. **Audit Policies**: Regularly review and test RLS policies
3. **Principle of Least Privilege**: Grant minimum necessary access
4. **Handle Edge Cases**: Consider NULL values, deleted users, etc.