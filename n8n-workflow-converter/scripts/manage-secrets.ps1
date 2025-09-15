# Supabase Edge Function Secrets Management Script (PowerShell)
# This script helps you manage secrets for your Edge Functions on Windows

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$SecretName,
    
    [Parameter(Position=2)]
    [string]$SecretValue
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Supabase CLI is installed
function Test-SupabaseCLI {
    try {
        $null = Get-Command supabase -ErrorAction Stop
        Write-Success "Supabase CLI is installed"
        return $true
    }
    catch {
        Write-Error "Supabase CLI is not installed. Please install it first:"
        Write-Host "npm install -g supabase"
        return $false
    }
}

# List all current secrets
function Get-Secrets {
    Write-Status "Listing current Edge Function secrets..."
    supabase secrets list
}

# Set a secret
function Set-Secret {
    param(
        [string]$Name,
        [string]$Value
    )
    
    if (-not $Name -or -not $Value) {
        Write-Error "Usage: Set-Secret -Name <SECRET_NAME> -Value <SECRET_VALUE>"
        return
    }
    
    Write-Status "Setting secret: $Name"
    $Value | supabase secrets set $Name
    Write-Success "Secret $Name has been set"
}

# Generate secure random key
function New-SecureKey {
    param([int]$Length = 32)
    
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    
    return [Convert]::ToBase64String($bytes).Replace('+', '').Replace('/', '').Replace('=', '').Substring(0, $Length)
}

# Set up converter secrets interactively
function Set-ConverterSecrets {
    Write-Status "Setting up n8n Converter secrets..."
    
    # Required secrets
    $requiredSecrets = @{
        "VIRUSTOTAL_API_KEY" = "VirusTotal API key for security scanning"
        "WEBHOOK_SECRET" = "Secret for webhook validation (32+ characters)"
        "ENCRYPTION_KEY" = "Encryption key for sensitive data (32+ characters)"
    }
    
    # Optional secrets
    $optionalSecrets = @{
        "OPENAI_API_KEY" = "OpenAI API key for AI-assisted code generation"
        "GITHUB_TOKEN" = "GitHub token for repository integration"
    }
    
    Write-Host ""
    Write-Status "Required secrets:"
    
    foreach ($secret in $requiredSecrets.GetEnumerator()) {
        Write-Host "  $($secret.Key): $($secret.Value)" -ForegroundColor Yellow
        $value = Read-Host "Enter value for $($secret.Key) (or press Enter to skip)" -AsSecureString
        
        if ($value.Length -gt 0) {
            $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
            Set-Secret -Name $secret.Key -Value $plainValue
        }
        else {
            Write-Warning "Skipped $($secret.Key)"
        }
    }
    
    Write-Host ""
    Write-Status "Optional secrets:"
    
    foreach ($secret in $optionalSecrets.GetEnumerator()) {
        Write-Host "  $($secret.Key): $($secret.Value)" -ForegroundColor Yellow
        $value = Read-Host "Enter value for $($secret.Key) (or press Enter to skip)" -AsSecureString
        
        if ($value.Length -gt 0) {
            $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
            Set-Secret -Name $secret.Key -Value $plainValue
        }
        else {
            Write-Warning "Skipped $($secret.Key)"
        }
    }
}

# Generate and set webhook secret
function New-WebhookSecret {
    $webhookSecret = New-SecureKey -Length 32
    Write-Status "Generated secure webhook secret"
    Set-Secret -Name "WEBHOOK_SECRET" -Value $webhookSecret
    Write-Success "Webhook secret has been generated and set"
}

# Generate and set encryption key
function New-EncryptionKey {
    $encryptionKey = New-SecureKey -Length 32
    Write-Status "Generated secure encryption key"
    Set-Secret -Name "ENCRYPTION_KEY" -Value $encryptionKey
    Write-Success "Encryption key has been generated and set"
}

# Delete a secret
function Remove-Secret {
    param([string]$Name)
    
    if (-not $Name) {
        Write-Error "Usage: Remove-Secret -Name <SECRET_NAME>"
        return
    }
    
    Write-Warning "Deleting secret: $Name"
    $confirmation = Read-Host "Are you sure? (y/N)"
    
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        supabase secrets unset $Name
        Write-Success "Secret $Name has been deleted"
    }
    else {
        Write-Status "Cancelled"
    }
}

# Show help
function Show-Help {
    Write-Host "Supabase Edge Function Secrets Manager (PowerShell)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\manage-secrets.ps1 <command> [arguments]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  list                     List all current secrets"
    Write-Host "  set <name> <value>       Set a specific secret"
    Write-Host "  delete <name>            Delete a specific secret"
    Write-Host "  setup                    Interactive setup for n8n converter secrets"
    Write-Host "  generate-webhook         Generate and set a secure webhook secret"
    Write-Host "  generate-encryption      Generate and set a secure encryption key"
    Write-Host "  help                     Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\manage-secrets.ps1 list"
    Write-Host "  .\manage-secrets.ps1 set VIRUSTOTAL_API_KEY your_api_key_here"
    Write-Host "  .\manage-secrets.ps1 setup"
    Write-Host "  .\manage-secrets.ps1 generate-webhook"
}

# Main script logic
if (-not (Test-SupabaseCLI)) {
    exit 1
}

switch ($Command.ToLower()) {
    "list" {
        Get-Secrets
    }
    "set" {
        Set-Secret -Name $SecretName -Value $SecretValue
    }
    "delete" {
        Remove-Secret -Name $SecretName
    }
    "setup" {
        Set-ConverterSecrets
    }
    "generate-webhook" {
        New-WebhookSecret
    }
    "generate-encryption" {
        New-EncryptionKey
    }
    default {
        Show-Help
    }
}