-- Add AI provider columns to profiles table (with existence checks)

-- Add ai_provider column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'ai_provider'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ai_provider TEXT;
    RAISE NOTICE 'Added ai_provider column to profiles table';
  ELSE
    RAISE NOTICE 'ai_provider column already exists in profiles table';
  END IF;
END $$;

-- Add ai_api_key_encrypted column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'ai_api_key_encrypted'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ai_api_key_encrypted TEXT;
    RAISE NOTICE 'Added ai_api_key_encrypted column to profiles table';
  ELSE
    RAISE NOTICE 'ai_api_key_encrypted column already exists in profiles table';
  END IF;
END $$;

-- Add ai_api_key_valid column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'ai_api_key_valid'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ai_api_key_valid BOOLEAN;
    RAISE NOTICE 'Added ai_api_key_valid column to profiles table';
  ELSE
    RAISE NOTICE 'ai_api_key_valid column already exists in profiles table';
  END IF;
END $$;

-- Add check constraint for ai_provider values (with existence check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_ai_provider_check' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_ai_provider_check 
    CHECK (ai_provider IN ('openai', 'anthropic', 'gemini', 'openrouter', 'system_default') OR ai_provider IS NULL);
    RAISE NOTICE 'Added ai_provider check constraint to profiles table';
  ELSE
    RAISE NOTICE 'ai_provider check constraint already exists in profiles table';
  END IF;
END $$;

-- Create index for ai_provider lookups (with existence check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_profiles_ai_provider' AND tablename = 'profiles'
  ) THEN
    CREATE INDEX idx_profiles_ai_provider ON profiles(ai_provider) WHERE ai_provider IS NOT NULL;
    RAISE NOTICE 'Created ai_provider index on profiles table';
  ELSE
    RAISE NOTICE 'ai_provider index already exists on profiles table';
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN profiles.ai_provider IS 'AI provider preference for code generation (openai, anthropic, gemini, openrouter, system_default)';
COMMENT ON COLUMN profiles.ai_api_key_encrypted IS 'Encrypted API key for the selected AI provider';
COMMENT ON COLUMN profiles.ai_api_key_valid IS 'Whether the stored API key is valid and working';