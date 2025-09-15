-- Add AI provider settings to profiles table
ALTER TABLE profiles 
ADD COLUMN ai_provider TEXT CHECK (ai_provider IN ('openai', 'anthropic', 'gemini', 'openrouter', 'system_default')),
ADD COLUMN ai_api_key_encrypted TEXT,
ADD COLUMN ai_api_key_valid BOOLEAN DEFAULT NULL;

-- Create index for AI provider lookups
CREATE INDEX idx_profiles_ai_provider ON profiles(ai_provider);

-- Add RLS policy for AI settings (users can only access their own AI settings)
CREATE POLICY "Users can manage their own AI settings" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Create function to encrypt API keys (using pgcrypto extension)
CREATE OR REPLACE FUNCTION encrypt_api_key(api_key TEXT, user_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Use user_id as part of the encryption key for additional security
  RETURN encode(
    encrypt(
      api_key::bytea, 
      (user_id::text || current_setting('app.encryption_key', true))::bytea, 
      'aes'
    ), 
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decrypt API keys
CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_key TEXT, user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN convert_from(
    decrypt(
      decode(encrypted_key, 'base64'), 
      (user_id::text || current_setting('app.encryption_key', true))::bytea, 
      'aes'
    ), 
    'UTF8'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL; -- Return NULL if decryption fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;