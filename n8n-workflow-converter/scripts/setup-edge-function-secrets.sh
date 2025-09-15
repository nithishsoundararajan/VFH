#!/bin/bash

# Setup Edge Function Secrets for n8n Workflow Converter
# This script configures Supabase Edge Function secrets from your .env.local file

echo "🔧 Setting up Supabase Edge Function secrets..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found. Please create it first."
    exit 1
fi

# Source the .env.local file to get the variables
set -a
source .env.local
set +a

echo "📋 Found environment variables, checking existing secrets..."

# Get existing secrets list
echo "🔍 Checking existing Supabase secrets..."
EXISTING_SECRETS=$(npx supabase secrets list --format=json 2>/dev/null || echo "[]")

# Function to check if secret exists
secret_exists() {
    local secret_name="$1"
    echo "$EXISTING_SECRETS" | grep -q "\"name\":\"$secret_name\""
}

# Set OpenRouter API Key
if [ ! -z "$OPENROUTER_API_KEY" ]; then
    if secret_exists "OPENROUTER_API_KEY"; then
        echo "� OPgENROUTER_API_KEY already exists, updating..."
    else
        echo "🔑 Setting new OPENROUTER_API_KEY..."
    fi
    npx supabase secrets set OPENROUTER_API_KEY="$OPENROUTER_API_KEY"
else
    echo "⚠️  OPENROUTER_API_KEY not found in .env.local"
fi

# Set Google AI API Key (try both variable names)
if [ ! -z "$GOOGLE_AI_API_KEY" ]; then
    if secret_exists "GOOGLE_AI_API_KEY"; then
        echo "🔄 GOOGLE_AI_API_KEY already exists, updating..."
    else
        echo "🔑 Setting new GOOGLE_AI_API_KEY..."
    fi
    npx supabase secrets set GOOGLE_AI_API_KEY="$GOOGLE_AI_API_KEY"
elif [ ! -z "$Gemini_API" ]; then
    if secret_exists "GOOGLE_AI_API_KEY"; then
        echo "🔄 GOOGLE_AI_API_KEY already exists, updating from Gemini_API..."
    else
        echo "🔑 Setting new GOOGLE_AI_API_KEY from Gemini_API..."
    fi
    npx supabase secrets set GOOGLE_AI_API_KEY="$Gemini_API"
else
    echo "⚠️  GOOGLE_AI_API_KEY or Gemini_API not found in .env.local"
fi

# Set OpenAI API Key (if available)
if [ ! -z "$OPENAI_API_KEY" ]; then
    if secret_exists "OPENAI_API_KEY"; then
        echo "🔄 OPENAI_API_KEY already exists, updating..."
    else
        echo "🔑 Setting new OPENAI_API_KEY..."
    fi
    npx supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"
else
    echo "⚠️  OPENAI_API_KEY not found in .env.local"
fi

# Set VirusTotal API Key
if [ ! -z "$VIRUSTOTAL_API_KEY" ]; then
    if secret_exists "VIRUSTOTAL_API_KEY"; then
        echo "🔄 VIRUSTOTAL_API_KEY already exists, updating..."
    else
        echo "🔑 Setting new VIRUSTOTAL_API_KEY..."
    fi
    npx supabase secrets set VIRUSTOTAL_API_KEY="$VIRUSTOTAL_API_KEY"
else
    echo "⚠️  VIRUSTOTAL_API_KEY not found in .env.local"
fi

# Set API Key Encryption Secret (generate if not exists)
if [ ! -z "$API_KEY_ENCRYPTION_SECRET" ]; then
    if secret_exists "API_KEY_ENCRYPTION_SECRET"; then
        echo "🔄 API_KEY_ENCRYPTION_SECRET already exists, updating..."
    else
        echo "🔑 Setting new API_KEY_ENCRYPTION_SECRET..."
    fi
    npx supabase secrets set API_KEY_ENCRYPTION_SECRET="$API_KEY_ENCRYPTION_SECRET"
else
    if secret_exists "API_KEY_ENCRYPTION_SECRET"; then
        echo "✅ API_KEY_ENCRYPTION_SECRET already exists, skipping generation"
    else
        echo "🔑 Generating new API_KEY_ENCRYPTION_SECRET..."
        ENCRYPTION_SECRET=$(openssl rand -hex 32)
        npx supabase secrets set API_KEY_ENCRYPTION_SECRET="$ENCRYPTION_SECRET"
        echo "⚠️  Please add this to your .env.local: API_KEY_ENCRYPTION_SECRET=$ENCRYPTION_SECRET"
    fi
fi

echo "✅ Edge Function secrets setup complete!"
echo ""
echo "📋 To verify secrets were set correctly, run:"
echo "   npx supabase secrets list"
echo ""
echo "🔄 To deploy the updated Edge Functions, run:"
echo "   npx supabase functions deploy"