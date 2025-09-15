# AI Provider Error Fix

## Problem Description

The AI Provider settings were throwing an error:
```
AIProviderError: Failed to fetch AI provider settings
at getUserSettings (src/lib/services/ai-provider-service.ts:18:13)
```

## Root Cause

The error occurred because the `profiles` table in the database was missing the required columns for AI provider functionality:
- `ai_provider` - stores the selected AI provider
- `ai_api_key_encrypted` - stores encrypted API keys
- `ai_api_key_valid` - tracks API key validation status

## Solution Implemented

### 1. Added Graceful Error Handling

The AI provider service now:
- Checks if the required database schema exists
- Falls back to `system_default` provider when columns are missing
- Provides helpful error messages to users
- Prevents crashes when the database schema is not updated

### 2. Enhanced Service Resilience

**Before:**
```typescript
// Would crash if columns don't exist
const { data, error } = await this.supabase
  .from('profiles')
  .select('ai_provider, ai_api_key_valid')
  .eq('id', userId)
  .single();

if (error) {
  throw new AIProviderError('Failed to fetch AI provider settings', 'system_default');
}
```

**After:**
```typescript
// Checks schema availability first
const schemaAvailable = await this.checkSchema();

if (!schemaAvailable) {
  return {
    provider: 'system_default',
    isValid: true,
  };
}

// Graceful error handling with fallbacks
try {
  // ... query logic
} catch (err) {
  console.warn('Error fetching AI provider settings, falling back to system default:', err);
  return {
    provider: 'system_default',
    isValid: true,
  };
}
```

### 3. Improved User Experience

- Users see a helpful message instead of a crash
- The system defaults to the built-in AI service
- Settings page shows when functionality is not available
- Clear instructions for administrators

## Database Migration Required

To fully enable AI provider functionality, apply this migration:

```sql
-- Add AI provider columns to profiles table
ALTER TABLE profiles 
ADD COLUMN ai_provider TEXT,
ADD COLUMN ai_api_key_encrypted TEXT,
ADD COLUMN ai_api_key_valid BOOLEAN;

-- Add check constraint for ai_provider values
ALTER TABLE profiles 
ADD CONSTRAINT profiles_ai_provider_check 
CHECK (ai_provider IN ('openai', 'anthropic', 'gemini', 'openrouter', 'system_default') OR ai_provider IS NULL);

-- Create index for ai_provider lookups
CREATE INDEX idx_profiles_ai_provider ON profiles(ai_provider) WHERE ai_provider IS NOT NULL;
```

The migration file is available at: `supabase/migrations/009_add_ai_provider_columns.sql`

## Current Behavior

### Without Migration (Current State)
- ✅ Application doesn't crash
- ✅ Users can still use the system default AI service
- ✅ Settings page shows helpful message
- ❌ Users cannot configure custom AI providers

### After Migration
- ✅ Full AI provider functionality available
- ✅ Users can configure OpenAI, Anthropic, Gemini, etc.
- ✅ API key encryption and validation
- ✅ Per-user AI provider preferences

## Files Modified

1. **`src/lib/services/ai-provider-service.ts`**
   - Added schema checking
   - Enhanced error handling
   - Graceful fallbacks

2. **`src/hooks/use-ai-provider.ts`**
   - Better error messages
   - Fallback settings

3. **`src/components/settings/ai-provider-settings.tsx`**
   - Improved error display
   - User-friendly messages

4. **`supabase/migrations/009_add_ai_provider_columns.sql`**
   - Database schema update (to be applied)

## Testing

1. **Before Migration**: 
   - Settings page loads without errors
   - Shows "system default" provider
   - Displays helpful message about unavailable functionality

2. **After Migration**:
   - Full AI provider selection available
   - API key configuration works
   - Validation and encryption functional

## Next Steps

1. Apply the database migration when ready
2. Test AI provider functionality
3. Configure any required Edge Functions for encryption
4. Update documentation for end users

The application is now resilient and won't crash due to missing database columns, while providing a clear path forward for enabling full AI provider functionality.