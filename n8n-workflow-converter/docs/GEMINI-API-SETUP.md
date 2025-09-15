# Google Gemini API Setup Guide

This guide explains how to obtain and configure a Google Gemini API key for use with the n8n Workflow Converter.

## Getting a Gemini API Key

1. **Visit Google AI Studio**
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Sign in with your Google account

2. **Create an API Key**
   - Click on "Get API key" in the left sidebar
   - Click "Create API key"
   - Choose "Create API key in new project" or select an existing project
   - Copy the generated API key (starts with `AIza...`)

3. **Configure in n8n Workflow Converter**
   - Navigate to Settings in your dashboard
   - Select "Google Gemini" as your AI provider
   - Paste your API key in the "Google AI API Key" field
   - Click "Test API Key" to verify it works
   - Click "Save Settings"

## API Key Format

Gemini API keys have the format: `AIzaSyA...` (starts with `AIza`)

## Pricing

Google Gemini offers:
- **Free tier**: 15 requests per minute, 1 million tokens per minute
- **Paid tier**: Higher rate limits and additional features

Check [Google AI pricing](https://ai.google.dev/pricing) for current rates.

## Models Available

The system uses `gemini-1.5-flash-latest` by default, which provides:
- Fast response times
- Good code generation quality
- Cost-effective pricing
- Support for long context windows

## Troubleshooting

### Common Issues

1. **"API key not valid"**
   - Ensure the API key is copied correctly
   - Check that the API key hasn't been restricted to specific IPs
   - Verify the key hasn't expired

2. **"Quota exceeded"**
   - You've hit the free tier limits
   - Wait for the quota to reset or upgrade to paid tier

3. **"Model not found"**
   - The Gemini model may be temporarily unavailable
   - The system will automatically fall back to system default

### Rate Limits

Free tier limits:
- 15 requests per minute
- 1 million tokens per minute
- 1,500 requests per day

If you exceed these limits, the system will automatically fall back to the system default AI provider.

## Security

- API keys are encrypted and stored securely
- Keys are never transmitted in plaintext
- Only used for code generation requests
- Can be revoked at any time from Google AI Studio

## Support

For Gemini API issues:
- [Google AI Documentation](https://ai.google.dev/docs)
- [Google AI Studio Help](https://aistudio.google.com/help)

For n8n Workflow Converter issues:
- Check the application logs
- Verify your settings configuration
- Test with system default provider