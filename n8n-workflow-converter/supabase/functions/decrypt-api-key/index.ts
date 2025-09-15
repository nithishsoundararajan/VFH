import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for database access
    )

    // Verify user with the provided auth header
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { userId } = await req.json()

    if (!userId || userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get encrypted API key from database
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .select('ai_api_key_encrypted')
      .eq('id', userId)
      .single()

    if (dbError || !profile?.ai_api_key_encrypted) {
      return new Response(
        JSON.stringify({ apiKey: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get encryption key from environment
    const encryptionKey = Deno.env.get('API_KEY_ENCRYPTION_SECRET')
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ error: 'Encryption not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decrypt the API key
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    
    // Create decryption key from user ID and secret
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(userId + encryptionKey),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('supabase-ai-keys'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )

    // Decode base64 and extract IV and encrypted data
    const combined = new Uint8Array(
      atob(profile.ai_api_key_encrypted)
        .split('')
        .map(char => char.charCodeAt(0))
    )
    
    const iv = combined.slice(0, 12)
    const encryptedData = combined.slice(12)

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    )

    const apiKey = decoder.decode(decryptedData)

    return new Response(
      JSON.stringify({ apiKey }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Decryption error:', error)
    return new Response(
      JSON.stringify({ error: 'Decryption failed', apiKey: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})