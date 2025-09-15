# Simple Edge Function Secrets Setup for n8n Workflow Converter
# This script configures Supabase Edge Function secrets from your .env.local file

Write-Host "Setting up Supabase Edge Function secrets..." -ForegroundColor Cyan

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "ERROR: .env.local file not found. Please create it first." -ForegroundColor Red
    exit 1
}

Write-Host "Reading .env.local file..." -ForegroundColor Yellow

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

Write-Host "Found $($envVars.Count) environment variables" -ForegroundColor Green

# Set OpenRouter API Key
if ($envVars.ContainsKey("OPENROUTER_API_KEY") -and $envVars["OPENROUTER_API_KEY"]) {
    Write-Host "Setting OPENROUTER_API_KEY..." -ForegroundColor Green
    npx supabase secrets set "OPENROUTER_API_KEY=$($envVars['OPENROUTER_API_KEY'])"
} else {
    Write-Host "WARNING: OPENROUTER_API_KEY not found in .env.local" -ForegroundColor Yellow
}

# Set Google AI API Key (try both variable names)
if ($envVars.ContainsKey("GOOGLE_AI_API_KEY") -and $envVars["GOOGLE_AI_API_KEY"]) {
    Write-Host "Setting GOOGLE_AI_API_KEY..." -ForegroundColor Green
    npx supabase secrets set "GOOGLE_AI_API_KEY=$($envVars['GOOGLE_AI_API_KEY'])"
} elseif ($envVars.ContainsKey("Gemini_API") -and $envVars["Gemini_API"]) {
    Write-Host "Setting GOOGLE_AI_API_KEY from Gemini_API..." -ForegroundColor Green
    npx supabase secrets set "GOOGLE_AI_API_KEY=$($envVars['Gemini_API'])"
} else {
    Write-Host "WARNING: GOOGLE_AI_API_KEY or Gemini_API not found in .env.local" -ForegroundColor Yellow
}

# Set OpenAI API Key (if available)
if ($envVars.ContainsKey("OPENAI_API_KEY") -and $envVars["OPENAI_API_KEY"]) {
    Write-Host "Setting OPENAI_API_KEY..." -ForegroundColor Green
    npx supabase secrets set "OPENAI_API_KEY=$($envVars['OPENAI_API_KEY'])"
} else {
    Write-Host "WARNING: OPENAI_API_KEY not found in .env.local" -ForegroundColor Yellow
}

# Set VirusTotal API Key
if ($envVars.ContainsKey("VIRUSTOTAL_API_KEY") -and $envVars["VIRUSTOTAL_API_KEY"]) {
    Write-Host "Setting VIRUSTOTAL_API_KEY..." -ForegroundColor Green
    npx supabase secrets set "VIRUSTOTAL_API_KEY=$($envVars['VIRUSTOTAL_API_KEY'])"
} else {
    Write-Host "WARNING: VIRUSTOTAL_API_KEY not found in .env.local" -ForegroundColor Yellow
}

# Set API Key Encryption Secret (generate if not exists)
if ($envVars.ContainsKey("API_KEY_ENCRYPTION_SECRET") -and $envVars["API_KEY_ENCRYPTION_SECRET"]) {
    Write-Host "Setting API_KEY_ENCRYPTION_SECRET..." -ForegroundColor Green
    npx supabase secrets set "API_KEY_ENCRYPTION_SECRET=$($envVars['API_KEY_ENCRYPTION_SECRET'])"
} else {
    Write-Host "Generating new API_KEY_ENCRYPTION_SECRET..." -ForegroundColor Green
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    $encryptionSecret = [System.BitConverter]::ToString($bytes) -replace '-', ''
    npx supabase secrets set "API_KEY_ENCRYPTION_SECRET=$encryptionSecret"
    Write-Host "Please add this to your .env.local: API_KEY_ENCRYPTION_SECRET=$encryptionSecret" -ForegroundColor Yellow
}

Write-Host "Edge Function secrets setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To verify secrets were set correctly, run:" -ForegroundColor Cyan
Write-Host "   npx supabase secrets list" -ForegroundColor White
Write-Host ""
Write-Host "To deploy the updated Edge Functions, run:" -ForegroundColor Cyan
Write-Host "   npx supabase functions deploy" -ForegroundColor White