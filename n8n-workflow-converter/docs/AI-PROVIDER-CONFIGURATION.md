# AI Provider Configuration System

This document describes the AI provider configuration system that allows users to configure their preferred AI service for code generation.

## Overview

The AI provider system supports multiple AI services:
- **OpenAI**: Uses GPT models for code generation
- **Anthropic**: Uses Claude models for code generation
- **Google Gemini**: Uses Gemini models for code generation
- **OpenRouter**: Access to multiple AI models (GPT, Claude, Llama, etc.)
- **System Default**: Falls back to system-configured AI service

## Components

### Database Schema

The `profiles` table includes AI provider settings:
- `ai_provider`: The selected provider ('openai', 'anthropic', 'gemini', 'openrouter', 'system_default')
- `ai_api_key_encrypted`: Encrypted API key storage
- `ai_api_key_valid`: Validation status of the API key

### Edge Functions

#### encrypt-api-key
Securely encrypts user API keys using AES-GCM encryption with user-specific keys.

#### decrypt-api-key  
Decrypts API keys for server-side use in code generation.

### Frontend Components

#### AIProviderSettings
React component for managing AI provider configuration:
- Provider selection dropdown
- API key input with validation
- Key testing functionality
- Settings management

### Services

#### AIProviderService
Handles all AI provider operations:
- User settings management
- API key encryption/decryption
- Key validation testing
- Provider switching

#### AIProviderHelper (Edge Functions)
Server-side helper for code generation:
- Provider-specific API calls
- Fallback to system default
- Error handling and retry logic

## Usage

### User Configuration

1. Navigate to Settings page
2. Select preferred AI provider
3. Enter API key (if required)
4. Test key validity
5. Save settings

### Code Generation

The system automatically:
1. Checks user's provider preference
2. Uses user's API key if available and valid
3. Falls back to system default if needed
4. Enhances generated code with AI assistance

## Security

- API keys are encrypted using AES-GCM with user-specific encryption keys
- Keys are never stored in plaintext
- Decryption only occurs server-side for code generation
- All API calls use HTTPS

## Environment Variables

### Required for Edge Functions
- `API_KEY_ENCRYPTION_SECRET`: Master encryption key for user API keys
- `ENCRYPTION_KEY`: General encryption key for workflow data
- `OPENROUTER_API_KEY`: System default AI provider (uses GPT-4o-mini)

### Supabase Configuration
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access

## Testing

Run AI provider tests:
```bash
npm test -- --testPathPattern="ai-provider"
```

## Error Handling

The system includes comprehensive error handling:
- Invalid API keys are detected and flagged
- Network errors trigger fallback to system default
- Encryption/decryption failures are logged and handled gracefully
- User-friendly error messages for all failure scenarios