# Vercel Deployment Guide

This guide covers deploying the n8n Workflow Converter to Vercel, a popular serverless platform for Next.js applications.

## Prerequisites

- Vercel account (free tier available)
- GitHub repository with your code
- Supabase project (recommended) or configured environment variables

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/n8n-workflow-converter&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,NEXTAUTH_SECRET,OPENAI_API_KEY&envDescription=Required%20environment%20variables%20for%20n8n%20Workflow%20Converter&envLink=https://github.com/your-org/n8n-workflow-converter/blob/main/docs/ENVIRONMENT-SETUP.md)

## Manual Deployment

### 1. Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Select the repository containing n8n Workflow Converter

### 2. Configure Build Settings

Vercel will automatically detect Next.js. Configure these settings:

- **Framework Preset**: Next.js
- **Root Directory**: `./` (if deploying from root)
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### 3. Environment Variables

Add these environment variables in the Vercel dashboard:

#### Required Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret_32_chars_min
NEXTAUTH_URL=https://your-app.vercel.app

# AI Provider (at least one required)
OPENAI_API_KEY=sk-your_openai_api_key
```

#### Optional Variables

```env
# Additional AI Providers
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
GOOGLE_AI_API_KEY=your_google_ai_key
DEFAULT_AI_PROVIDER=openai

# Security
VIRUSTOTAL_API_KEY=your_virustotal_key
ENCRYPTION_KEY=your_32_char_encryption_key

# OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn
```

### 4. Deploy

1. Click "Deploy"
2. Wait for the build to complete
3. Your app will be available at `https://your-app.vercel.app`

## Configuration Files

### vercel.json

The included `vercel.json` file configures:

- **Function timeouts**: Extended for code generation
- **Security headers**: CORS, XSS protection, etc.
- **Redirects**: Health check endpoint
- **Environment**: Production settings

### Custom Domain

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Update `NEXTAUTH_URL` environment variable

## Environment-Specific Deployments

### Production

```bash
# Set production environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXTAUTH_SECRET production
vercel env add OPENAI_API_KEY production

# Deploy to production
vercel --prod
```

### Preview/Staging

```bash
# Set preview environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview

# Deploy preview
vercel
```

## CLI Deployment

### Install Vercel CLI

```bash
npm install -g vercel
```

### Login and Deploy

```bash
# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Deploy to production
vercel --prod

# Set environment variables
vercel env add VARIABLE_NAME
```

## Advanced Configuration

### Custom Build Process

Create `vercel-build.sh`:

```bash
#!/bin/bash
echo "Running custom build process..."

# Install dependencies
npm ci

# Run type checking
npm run type-check

# Run tests
npm run test

# Build application
npm run build

echo "Build completed successfully!"
```

Update `package.json`:

```json
{
  "scripts": {
    "vercel-build": "./vercel-build.sh"
  }
}
```

### Edge Functions

For enhanced performance, you can use Vercel Edge Functions:

Create `middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Add security headers
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Database Connection Pooling

For high-traffic applications, configure connection pooling:

```typescript
// lib/db-pool.ts
import { createPool } from '@vercel/postgres';

export const pool = createPool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Monitoring and Analytics

### Vercel Analytics

Add to your `_app.tsx`:

```typescript
import { Analytics } from '@vercel/analytics/react';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
```

### Performance Monitoring

```typescript
// lib/monitoring.ts
export function reportWebVitals(metric: any) {
  if (process.env.NODE_ENV === 'production') {
    // Send to analytics service
    console.log(metric);
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Build Timeouts

```json
// vercel.json
{
  "functions": {
    "app/**/*.js": {
      "maxDuration": 60
    }
  }
}
```

#### 2. Memory Limits

```json
// vercel.json
{
  "functions": {
    "app/api/generate-code/route.js": {
      "memory": 1024
    }
  }
}
```

#### 3. Environment Variable Issues

```bash
# Check environment variables
vercel env ls

# Pull environment variables locally
vercel env pull .env.local
```

#### 4. Cold Start Performance

```typescript
// Warm up functions
export const config = {
  runtime: 'nodejs18.x',
  maxDuration: 30,
};
```

### Debug Mode

Enable debug logging:

```bash
# Deploy with debug
DEBUG=1 vercel --prod

# Check function logs
vercel logs
```

### Performance Optimization

1. **Enable compression**:
   ```typescript
   // next.config.js
   module.exports = {
     compress: true,
   };
   ```

2. **Optimize images**:
   ```typescript
   // next.config.js
   module.exports = {
     images: {
       domains: ['your-domain.com'],
       formats: ['image/webp', 'image/avif'],
     },
   };
   ```

3. **Bundle analysis**:
   ```bash
   npm run analyze
   ```

## Security Considerations

### Environment Variables

- Never commit secrets to version control
- Use Vercel's environment variable encryption
- Rotate secrets regularly

### Headers

The included configuration sets security headers:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: origin-when-cross-origin`

### Rate Limiting

Implement rate limiting for API routes:

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export default ratelimit;
```

## Cost Optimization

### Function Optimization

- Use appropriate memory allocation
- Optimize cold start times
- Implement caching strategies

### Bandwidth Optimization

- Enable compression
- Optimize images and assets
- Use CDN for static files

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)