# Edge Function Secrets Management

This document explains how to manage API keys and secrets for your Supabase Edge Functions without using `.env.local` files.

## 🎯 **Overview**

Instead of storing secrets in `.env.local` files, we use **Supabase Edge Function secrets** which are:
- ✅ More secure (encrypted at rest)
- ✅ Environment-specific (dev/staging/prod)
- ✅ Centrally managed via Supabase CLI
- ✅ No need to commit sensitive data to git

## 🔧 **Setup**

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link your project
```bash
supabase link --project-ref gwsnfijcbnwhwckxjpjp
```

## 📝 **Managing Secrets**

### Using the Management Scripts

We've provided scripts to help you manage secrets easily:

#### **Windows (PowerShell)**
```powershell
# List all secrets
.\scripts\manage-secrets.ps1 list

# Set up all converter secrets interactively
.\scripts\manage-secrets.ps1 setup

# Set a specific secret
.\scripts\manage-secrets.ps1 set VIRUSTOTAL_API_KEY your_api_key_here

# Generate secure webhook secret
.\scripts\manage-secrets.ps1 generate-webhook

# Generate secure encryption key
.\scripts\manage-secrets.ps1 generate-encryption
```

#### **Linux/macOS (Bash)**
```bash
# Make script executable
chmod +x scripts/manage-secrets.sh

# List all secrets
./scripts/manage-secrets.sh list

# Set up all converter secrets interactively
./scripts/manage-secrets.sh setup

# Set a specific secret
./scripts/manage-secrets.sh set VIRUSTOTAL_API_KEY your_api_key_here
```

### Using Supabase CLI Directly

```bash
# List all secrets
supabase secrets list

# Set a secret
supabase secrets set VIRUSTOTAL_API_KEY=your_api_key_here

# Set multiple secrets at once
supabase secrets set VIRUSTOTAL_API_KEY=key1 WEBHOOK_SECRET=secret1

# Delete a secret
supabase secrets unset VIRUSTOTAL_API_KEY
```

## 🔑 **Required Secrets for n8n Converter**

### **Essential Secrets**
1. **VIRUSTOTAL_API_KEY** - For security scanning uploaded workflow files
2. **WEBHOOK_SECRET** - For validating incoming webhook requests (32+ characters)
3. **ENCRYPTION_KEY** - For encrypting sensitive workflow data (32+ characters)

### **System Default AI**
1. **OPENROUTER_API_KEY** - System default AI provider for code generation (uses GPT-4o-mini)

### **Optional Secrets**
1. **API_KEY_ENCRYPTION_SECRET** - For encrypting user AI API keys (32+ characters)
2. **OPENAI_API_KEY** - Alternative AI provider (if users prefer OpenAI)
3. **GITHUB_TOKEN** - For GitHub repository integration

## 💻 **How It Works in Code**

### **In Edge Functions**
```typescript
// Import the edge secrets manager
import { getSecret, getConverterSecrets } from '../_shared/edge-secrets.ts'

// Get a single secret
const virusTotalKey = await getSecret('VIRUSTOTAL_API_KEY')

// Get multiple secrets at once
const secrets = await getConverterSecrets()
console.log(secrets.virusTotalKey) // Your VirusTotal API key
```

### **Fallback Support**
The system still supports `.env.local` as a fallback:
```typescript
// This will try Edge Function secrets first, then fall back to .env.local
const apiKey = await getSecret('VIRUSTOTAL_API_KEY', 'VIRUSTOTAL_API_KEY')
```

## 🔒 **Security Features**

1. **Caching**: Secrets are cached for 10 minutes to reduce API calls
2. **Fallback**: Automatic fallback to environment variables if secrets not found
3. **Validation**: Built-in validation to check if required secrets are configured
4. **Logging**: Status logging without exposing secret values

## 🚀 **Deployment**

### **Development**
```bash
# Set development secrets
supabase secrets set VIRUSTOTAL_API_KEY=dev_key_here --project-ref gwsnfijcbnwhwckxjpjp
```

### **Production**
```bash
# Set production secrets
supabase secrets set VIRUSTOTAL_API_KEY=prod_key_here --project-ref your_prod_project_ref
```

## 🛠️ **Troubleshooting**

### **Secret Not Found**
If you get "secret not found" errors:
1. Check if the secret is set: `supabase secrets list`
2. Verify you're connected to the right project: `supabase status`
3. Check the secret name spelling in your code

### **Permission Errors**
If you get permission errors:
1. Make sure you're logged in: `supabase login`
2. Verify project access: `supabase projects list`

### **Caching Issues**
If secrets aren't updating:
1. Wait 10 minutes for cache to expire
2. Or restart your Edge Function to clear cache

## 📋 **Migration from .env.local**

To migrate from `.env.local` to Edge Function secrets:

1. **Copy your current values**:
   ```bash
   # From your .env.local file
   VIRUSTOTAL_API_KEY=your_virustotal_api_key
   ```

2. **Set them as Edge Function secrets**:
   ```bash
   supabase secrets set VIRUSTOTAL_API_KEY=your_virustotal_api_key
   ```

3. **Deploy your updated Edge Functions**:
   ```bash
   supabase functions deploy
   ```

4. **Remove from .env.local** (optional - kept as fallback)

## ✅ **Verification**

To verify your secrets are working:

1. **Check secret status in Edge Function**:
   ```typescript
   import { logSecretStatus } from '../_shared/edge-secrets.ts'
   
   // This will log which secrets are configured
   await logSecretStatus(['VIRUSTOTAL_API_KEY', 'WEBHOOK_SECRET'])
   ```

2. **Test your Edge Functions** with the new secrets

Your Edge Functions will now pull API keys directly from Supabase instead of `.env.local` files! 🎉