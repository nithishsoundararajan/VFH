# Quick Deployment Guide

## 🚀 Fast Track Deployment

This guide gets you up and running quickly, bypassing build issues and focusing on deployment.

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account (for full features)

### 1. Quick Setup

```bash
# Navigate to project directory
cd n8n-workflow-converter

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 2. Automated Quick Deploy

Use our automated deployment script for the fastest setup:

```bash
# Quick development setup
npm run quick-deploy

# Production build and setup
npm run quick-deploy:prod

# Setup and auto-start
npm run quick-deploy:start
```

#### Manual Setup (if needed)

The build issues have been resolved with the included `next.config.js`. If you need to modify it:

```bash
# The next.config.js is already configured to handle build issues
# No manual intervention needed for basic deployment
```

### 3. Environment Configuration

Edit `.env.local` with your settings:

```bash
# Basic configuration for local development
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (optional for basic functionality)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
NEXTAUTH_SECRET=your-32-character-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# AI Providers (optional)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### 4. Build and Deploy

#### Local Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

#### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### 5. Quick Deploy Options

#### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts and add environment variables in Vercel dashboard
```

#### Docker (Alternative)

```bash
# Build Docker image
docker build -t n8n-converter .

# Run container
docker run -p 3000:3000 --env-file .env.local n8n-converter
```

#### Netlify

```bash
# Build static export (if needed)
npm run build

# Deploy dist folder to Netlify
```

### 6. Troubleshooting

#### Build Issues Fixed ✅

The project now includes a `next.config.js` that handles common build issues automatically.

#### Common Issues and Solutions

**Port Already in Use:**
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

**Memory Issues During Build:**
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

**Missing Dependencies:**
```bash
# Use the quick deploy script
npm run quick-deploy

# Or manual cleanup
rm -rf node_modules package-lock.json
npm install
```

**Environment Issues:**
```bash
# Regenerate environment file
rm .env.local
npm run quick-deploy
```

**Verify Deployment:**
```bash
# Check if everything is working
npm run verify-deployment
```

### 7. Production Checklist

- [ ] Environment variables configured
- [ ] Supabase project setup (if using database features)
- [ ] Domain configured
- [ ] SSL certificate (handled by most platforms)
- [ ] Error monitoring setup
- [ ] Backup strategy

### 8. Platform-Specific Deployment

#### Vercel

1. Connect GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically on push

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### DigitalOcean App Platform

1. Create new app from GitHub
2. Configure build settings:
   - Build command: `npm run build`
   - Run command: `npm start`
3. Add environment variables

#### AWS Amplify

1. Connect repository
2. Build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
   ```

### 9. Monitoring and Maintenance

#### Health Check Endpoint

The app includes a health check at `/api/health`:

```bash
# Check if app is running
curl http://localhost:3000/api/health
```

#### Log Monitoring

```bash
# View application logs
npm run logs

# Or with PM2 (if using)
pm2 logs
```

### 10. Quick Fixes for Common Issues

#### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

#### Database Connection Issues

```bash
# Test Supabase connection
npm run test:db
```

#### File Upload Issues

```bash
# Check storage permissions
npm run test:storage
```

## 🎯 One-Command Deployment

For the absolute fastest deployment:

```bash
# Single command deployment (development)
npm run quick-deploy:start

# Or for production
npm run quick-deploy:prod -- --start
```

### Manual Minimal Deployment

If you prefer manual setup:

```bash
# 1. Navigate to project
cd n8n-workflow-converter

# 2. Quick setup
npm run quick-deploy

# 3. Start development server
npm run dev

# 4. Verify deployment
npm run verify-deployment
```

This gets you a working deployment in under 2 minutes!

## 📚 Next Steps

Once deployed:

1. Set up Supabase for full functionality
2. Configure AI providers for code generation
3. Set up monitoring and analytics
4. Implement proper error handling
5. Add custom domain and SSL

For detailed configuration, see [DEPLOYMENT.md](./DEPLOYMENT.md).