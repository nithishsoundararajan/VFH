# Setup Edge Function Secrets for n8n Workflow Converter
# This script configures Supabase Edge Function secrets from your .env.local file

Write-Host "🔧 Setting up Supabase Edge Function secrets..." -ForegroundColor Cyan

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ .env.local file not found. Please create it first." -ForegroundColor Red
    exit 1
}

Write-Host "📋 Reading .env.local file..." -ForegroundColor Yellow

# Read and parse .env.local file
$envVars = @{}
Get-Content ".env.local" | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        # Remove quotes if present
        $value = $value -replace '^"(.*)"$', '$1'
        $value = $value -replace "^'(.*)'$", '$1'
        $envVars[$key] = $value
    }
}

Write-Host "📋 Found $($envVars.Count) environment variables, checking existing secrets..." -ForegroundColor Green

# Get existing secrets list
Write-Host "🔍 Checking existing Supabase secrets..." -ForegroundColor Yellow
try {
    $existingSecretsJson = npx supabase secrets list --format=json 2>$null
    $existingSecrets = $existingSecretsJson | ConvertFrom-Json
} catch {
    Write-Host "⚠️  Could not retrieve existing secrets, proceeding with setup..." -ForegroundColor Yellow
    $existingSecrets = @()
}

# Function to check if secret exists
function Test-SecretExists {
    param($secretName)
    return $existingSecrets | Where-Object { $_.name -eq $secretName }
}

# Set OpenRouter API Key
if ($envVars.ContainsKey("OPENROUTER_API_KEY") -and $envVars["OPENROUTER_API_KEY"]) {
    if (Test-SecretExists "OPENROUTER_API_KEY") {
        Write-Host "🔄 OPENROUTER_API_KEY already exists, updating..." -ForegroundColor Cyan
    } else {
        Write-Host "🔑 Setting new OPENROUTER_API_KEY..." -ForegroundColor Green
    }
    npx supabase secrets set "OPENROUTER_API_KEY=$($envVars['OPENROUTER_API_KEY'])"
} else {
    Write-Host "⚠️  OPENROUTER_API_KEY not found in .env.local" -ForegroundColor Yellow
}

# Set Google AI API Key (try both variable names)
if ($envVars.ContainsKey("GOOGLE_AI_API_KEY") -and $envVars["GOOGLE_AI_API_KEY"]) {
    if (Test-SecretExists "GOOGLE_AI_API_KEY") {
        Write-Host "🔄 GOOGLE_AI_API_KEY already exists, updating..." -ForegroundColor Cyan
    } else {
        Write-Host "🔑 Setting new GOOGLE_AI_API_KEY..." -ForegroundColor Green
    }
    npx supabase secrets set "GOOGLE_AI_API_KEY=$($envVars['GOOGLE_AI_API_KEY'])"
} elseif ($envVars.ContainsKey("Gemini_API") -and $envVars["Gemini_API"]) {
    if (Test-SecretExists "GOOGLE_AI_API_KEY") {
        Write-Host "🔄 GOOGLE_AI_API_KEY already exists, updating from Gemini_API..." -ForegroundColor Cyan
    } else {
        Write-Host "🔑 Setting new GOOGLE_AI_API_KEY from Gemini_API..." -ForegroundColor Green
    }
    npx supabase secrets set "GOOGLE_AI_API_KEY=$($envVars['Gemini_API'])"
} else {
    Write-Host "⚠️  GOOGLE_AI_API_KEY or Gemini_API not found in .env.local" -ForegroundColor Yellow
}

# Set OpenAI API Key (if available)
if ($envVars.ContainsKey("OPENAI_API_KEY") -and $envVars["OPENAI_API_KEY"]) {
    if (Test-SecretExists "OPENAI_API_KEY") {
        Write-Host "🔄 OPENAI_API_KEY already exists, updating..." -ForegroundColor Cyan
    } else {
        Write-Host "🔑 Setting new OPENAI_API_KEY..." -ForegroundColor Green
    }
    npx supabase secrets set "OPENAI_API_KEY=$($envVars['OPENAI_API_KEY'])"
} else {
    Write-Host "⚠️  OPENAI_API_KEY not found in .env.local" -ForegroundColor Yellow
}

# Set VirusTotal API Key
if ($envVars.ContainsKey("VIRUSTOTAL_API_KEY") -and $envVars["VIRUSTOTAL_API_KEY"]) {
    if (Test-SecretExists "VIRUSTOTAL_API_KEY") {
        Write-Host "🔄 VIRUSTOTAL_API_KEY already exists, updating..." -ForegroundColor Cyan
    } else {
        Write-Host "🔑 Setting new VIRUSTOTAL_API_KEY..." -ForegroundColor Green
    }
    npx supabase secrets set "VIRUSTOTAL_API_KEY=$($envVars['VIRUSTOTAL_API_KEY'])"
} else {
    Write-Host "⚠️  VIRUSTOTAL_API_KEY not found in .env.local" -ForegroundColor Yellow
}

# Set API Key Encryption Secret (generate if not exists)
if ($envVars.ContainsKey("API_KEY_ENCRYPTION_SECRET") -and $envVars["API_KEY_ENCRYPTION_SECRET"]) {
    if (Test-SecretExists "API_KEY_ENCRYPTION_SECRET") {
        Write-Host "🔄 API_KEY_ENCRYPTION_SECRET already exists, updating..." -ForegroundColor Cyan
    } else {
        Write-Host "🔑 Setting new API_KEY_ENCRYPTION_SECRET..." -ForegroundColor Green
    }
    npx supabase secrets set "API_KEY_ENCRYPTION_SECRET=$($envVars['API_KEY_ENCRYPTION_SECRET'])"
} else {
    if (Test-SecretExists "API_KEY_ENCRYPTION_SECRET") {
        Write-Host "✅ API_KEY_ENCRYPTION_SECRET already exists, skipping generation" -ForegroundColor Green
    } else {
        Write-Host "🔑 Generating new API_KEY_ENCRYPTION_SECRET..." -ForegroundColor Green
        $encryptionSecret = -join ((1..64) | ForEach-Object { "{0:X}" -f (Get-Random -Max 16) })
        npx supabase secrets set "API_KEY_ENCRYPTION_SECRET=$encryptionSecret"
        Write-Host "⚠️  Please add this to your .env.local: API_KEY_ENCRYPTION_SECRET=$encryptionSecret" -ForegroundColor Yellow
    }
}

Write-Host "✅ Edge Function secrets setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 To verify secrets were set correctly, run:" -ForegroundColor Cyan
Write-Host "   npx supabase secrets list" -ForegroundColor White
Write-Host ""
Write-Host "🔄 To deploy the updated Edge Functions, run:" -ForegroundColor Cyan
Write-Host "   npx supabase functions deploy" -ForegroundColor White