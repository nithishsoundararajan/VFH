# Video Tutorial Scripts

This document contains scripts and guides for creating video tutorials for the n8n Workflow Converter self-hosting setup. These scripts can be used to create comprehensive video guides for complex setup procedures.

## Table of Contents

1. [Tutorial Overview](#tutorial-overview)
2. [Local Development Setup](#local-development-setup)
3. [Supabase Self-Hosting](#supabase-self-hosting)
4. [Docker Deployment](#docker-deployment)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## Tutorial Overview

### Video Series Structure

1. **Part 1**: Local Development Setup (15 minutes)
2. **Part 2**: Supabase Self-Hosting (25 minutes)
3. **Part 3**: Docker Deployment (20 minutes)
4. **Part 4**: Production Deployment (30 minutes)
5. **Part 5**: Troubleshooting & Maintenance (20 minutes)

### Prerequisites for Viewers

- Basic command line knowledge
- Git installed
- Node.js v20+ installed
- Docker installed (for containerization tutorials)

## Local Development Setup

### Video Script: "Setting Up n8n Workflow Converter Locally"

**Duration**: ~15 minutes

#### Introduction (1 minute)

```
"Welcome to this tutorial on setting up the n8n Workflow Converter for local development. 

In this video, we'll cover:
- Cloning the repository
- Installing dependencies
- Configuring environment variables
- Starting the development server
- Verifying the setup

Let's get started!"
```

#### Section 1: Repository Setup (3 minutes)

```
"First, let's clone the repository and install dependencies.

[SCREEN: Terminal]

1. Open your terminal and navigate to your projects directory:
   cd ~/projects

2. Clone the repository:
   git clone https://github.com/your-org/n8n-workflow-converter.git
   
3. Navigate into the project:
   cd n8n-workflow-converter
   
4. Install dependencies:
   npm install
   
   This will take a few minutes to complete.

[PAUSE for installation]

Great! Now we have all the dependencies installed."
```

#### Section 2: Environment Configuration (5 minutes)

```
"Next, we need to configure our environment variables.

[SCREEN: File explorer and text editor]

1. Copy the environment template:
   cp .env.example .env.local

2. Open .env.local in your text editor:
   code .env.local

Now let's configure the essential variables:

[SCREEN: .env.local file]

3. Set your application URL:
   NEXT_PUBLIC_APP_URL=http://localhost:3000

4. For Supabase, you have two options:
   
   Option A - Use Supabase Cloud (Recommended for beginners):
   - Go to supabase.com
   - Create a new project
   - Copy your project URL and API keys
   
   [SCREEN: Supabase dashboard]
   
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-key

   Option B - Self-hosted Supabase (covered in Part 2)

5. Generate a NextAuth secret:
   [SCREEN: Terminal]
   openssl rand -base64 32
   
   Copy this value to:
   NEXTAUTH_SECRET=your-generated-secret

6. Add at least one AI provider key:
   OPENAI_API_KEY=sk-your-openai-key
   
   You can get this from platform.openai.com"
```

#### Section 3: Database Setup (3 minutes)

```
"Now let's set up the database schema.

[SCREEN: Terminal]

1. If using Supabase Cloud, run the migrations:
   npx supabase db push
   
2. Create the storage buckets:
   npx supabase storage create workflow-files
   npx supabase storage create generated-projects

3. Validate your environment:
   npm run validate-env
   
   [SCREEN: Show successful validation output]
   
   If you see any errors, double-check your environment variables."
```

#### Section 4: Starting the Application (2 minutes)

```
"Let's start the development server:

[SCREEN: Terminal]

1. Start the development server:
   npm run dev

2. Open your browser and navigate to:
   http://localhost:3000

[SCREEN: Browser showing the application]

You should see the n8n Workflow Converter homepage. 

3. Test the setup by:
   - Creating an account
   - Uploading a sample workflow
   - Verifying the conversion process works"
```

#### Conclusion (1 minute)

```
"Congratulations! You now have the n8n Workflow Converter running locally.

In the next video, we'll cover how to self-host Supabase for complete control over your data.

Key takeaways:
- Always validate your environment variables
- Keep your API keys secure
- Check the troubleshooting guide if you encounter issues

Thanks for watching!"
```

## Supabase Self-Hosting

### Video Script: "Self-Hosting Supabase for n8n Workflow Converter"

**Duration**: ~25 minutes

#### Introduction (2 minutes)

```
"Welcome to Part 2 of our n8n Workflow Converter setup series. 

Today we'll learn how to self-host Supabase, giving you complete control over your data and infrastructure.

We'll cover:
- Why self-host Supabase
- Prerequisites and system requirements
- Step-by-step setup process
- Configuration and testing
- Basic troubleshooting

Let's dive in!"
```

#### Section 1: Prerequisites (3 minutes)

```
"Before we start, let's ensure you have everything needed:

[SCREEN: Terminal showing version checks]

1. Docker and Docker Compose:
   docker --version
   docker-compose --version
   
   You need Docker 20.10+ and Docker Compose 2.0+

2. System requirements:
   - 4GB RAM minimum (8GB recommended)
   - 20GB disk space
   - Linux, macOS, or Windows with WSL2

3. Network requirements:
   - Ports 8000, 5432, 54321 available
   - Internet access for initial setup

[SCREEN: System monitor showing resources]

Let's verify we have sufficient resources available."
```

#### Section 2: Supabase Installation (8 minutes)

```
"Now let's install and configure Supabase:

[SCREEN: Terminal]

1. Clone the Supabase repository:
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker

2. Copy the environment template:
   cp .env.example .env

3. Generate secure secrets:
   [SCREEN: Text editor with .env file]
   
   Let's generate secure values for our secrets:
   
   For POSTGRES_PASSWORD:
   openssl rand -base64 32
   
   For JWT_SECRET:
   openssl rand -base64 32
   
   [SCREEN: Show copying values to .env file]

4. Configure the environment file:
   [SCREEN: .env file editing]
   
   Key variables to set:
   - POSTGRES_PASSWORD=your-secure-password
   - JWT_SECRET=your-jwt-secret
   - SITE_URL=http://localhost:3000
   - SUPABASE_PUBLIC_URL=http://localhost:8000

5. Generate API keys:
   [SCREEN: Terminal]
   
   docker run --rm supabase/gotrue:latest gotrue generate anon --jwt-secret="your-jwt-secret"
   docker run --rm supabase/gotrue:latest gotrue generate service_role --jwt-secret="your-jwt-secret"
   
   [SCREEN: Copy generated keys to .env file]

6. Start Supabase services:
   docker-compose up -d
   
   [SCREEN: Show services starting up]
   
   This will take a few minutes to download and start all services."
```

#### Section 3: Verification and Testing (5 minutes)

```
"Let's verify our Supabase installation is working:

[SCREEN: Terminal]

1. Check service status:
   docker-compose ps
   
   [SCREEN: Show all services running]
   
   All services should show 'Up' status.

2. Access Supabase Studio:
   [SCREEN: Browser]
   
   Navigate to: http://localhost:8000
   
   [SCREEN: Supabase Studio login]
   
   Use the credentials from your .env file.

3. Test the API:
   [SCREEN: Terminal]
   
   curl -H "apikey: your-anon-key" http://localhost:8000/rest/v1/
   
   [SCREEN: Show successful API response]

4. Test database connection:
   [SCREEN: Supabase Studio SQL editor]
   
   Run a simple query:
   SELECT version();
   
   [SCREEN: Show query results]"
```

#### Section 4: Application Integration (5 minutes)

```
"Now let's connect our application to self-hosted Supabase:

[SCREEN: Text editor with .env.local]

1. Update your application's environment variables:
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-generated-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-generated-service-key

2. Run database migrations:
   [SCREEN: Terminal in application directory]
   
   npx supabase db push --db-url postgresql://postgres:your-password@localhost:5432/postgres

3. Create storage buckets:
   [SCREEN: Supabase Studio Storage section]
   
   Create two buckets:
   - workflow-files
   - generated-projects
   
   [SCREEN: Show bucket creation process]

4. Test the application:
   [SCREEN: Terminal]
   
   npm run dev
   
   [SCREEN: Browser showing application]
   
   Test user registration and file upload to verify everything works."
```

#### Section 5: Basic Maintenance (2 minutes)

```
"Here are some essential maintenance tasks:

[SCREEN: Terminal]

1. View logs:
   docker-compose logs kong
   docker-compose logs db

2. Backup database:
   docker-compose exec db pg_dump -U postgres postgres > backup.sql

3. Stop services:
   docker-compose down

4. Update Supabase:
   git pull
   docker-compose pull
   docker-compose up -d

[SCREEN: Show health check script]

I recommend setting up automated health checks and backups for production use."
```

## Docker Deployment

### Video Script: "Containerizing n8n Workflow Converter with Docker"

**Duration**: ~20 minutes

#### Introduction (1 minute)

```
"Welcome to Part 3! Today we'll containerize the n8n Workflow Converter using Docker.

This approach provides:
- Consistent deployment across environments
- Easy scaling and management
- Isolation from host system
- Simplified backup and recovery

Let's get started!"
```

#### Section 1: Dockerfile Creation (5 minutes)

```
"First, let's create a Dockerfile for our application:

[SCREEN: Text editor creating Dockerfile]

1. Create the Dockerfile:
   [SCREEN: Show Dockerfile content being typed]
   
   FROM node:20-alpine AS base
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   
   FROM node:20-alpine AS build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   
   FROM base AS runtime
   COPY --from=build /app/.next ./.next
   COPY --from=build /app/public ./public
   EXPOSE 3000
   CMD ["npm", "start"]

2. Create .dockerignore:
   [SCREEN: Show .dockerignore content]
   
   node_modules
   .next
   .git
   .env.local
   *.log

3. Build the image:
   [SCREEN: Terminal]
   
   docker build -t n8n-workflow-converter .
   
   [SCREEN: Show build process]"
```

#### Section 2: Docker Compose Setup (8 minutes)

```
"Now let's create a complete Docker Compose setup:

[SCREEN: Text editor creating docker-compose.yml]

1. Create docker-compose.yml:
   [SCREEN: Show docker-compose.yml being created]
   
   version: '3.8'
   
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
       env_file:
         - .env.production
       depends_on:
         - db
         - redis
   
     db:
       image: postgres:15-alpine
       environment:
         POSTGRES_DB: n8n_converter
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
       volumes:
         - postgres_data:/var/lib/postgresql/data
       ports:
         - "5432:5432"
   
     redis:
       image: redis:7-alpine
       ports:
         - "6379:6379"
       volumes:
         - redis_data:/data
   
   volumes:
     postgres_data:
     redis_data:

2. Create production environment file:
   [SCREEN: Text editor with .env.production]
   
   cp .env.example .env.production
   
   [SCREEN: Show editing production values]

3. Start the stack:
   [SCREEN: Terminal]
   
   docker-compose up -d
   
   [SCREEN: Show services starting]"
```

#### Section 3: Health Checks and Monitoring (4 minutes)

```
"Let's add health checks and monitoring:

[SCREEN: Text editor updating docker-compose.yml]

1. Add health checks:
   [SCREEN: Show adding healthcheck sections]
   
   app:
     healthcheck:
       test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
       interval: 30s
       timeout: 10s
       retries: 3
   
   db:
     healthcheck:
       test: ["CMD-SHELL", "pg_isready -U postgres"]
       interval: 30s
       timeout: 10s
       retries: 3

2. Check service health:
   [SCREEN: Terminal]
   
   docker-compose ps
   
   [SCREEN: Show healthy services]

3. View logs:
   docker-compose logs -f app
   
   [SCREEN: Show application logs]"
```

#### Section 4: Production Considerations (2 minutes)

```
"For production deployment, consider these additions:

[SCREEN: Text editor showing production docker-compose]

1. Add reverse proxy (Nginx):
   [SCREEN: Show nginx service configuration]

2. SSL termination:
   [SCREEN: Show SSL certificate mounting]

3. Resource limits:
   [SCREEN: Show deploy.resources configuration]

4. Backup strategy:
   [SCREEN: Show backup service configuration]

These topics are covered in detail in our production deployment guide."
```

## Production Deployment

### Video Script: "Production Deployment on Cloud Platforms"

**Duration**: ~30 minutes

#### Introduction (2 minutes)

```
"Welcome to Part 4 - Production Deployment!

Today we'll deploy our containerized application to various cloud platforms:
- DigitalOcean App Platform
- AWS ECS
- Google Cloud Run
- Railway

We'll also cover:
- SSL certificates
- Environment management
- Monitoring setup
- Backup strategies

Let's start with DigitalOcean App Platform as it's beginner-friendly."
```

#### Section 1: DigitalOcean App Platform (8 minutes)

```
"DigitalOcean App Platform provides an easy deployment experience:

[SCREEN: DigitalOcean dashboard]

1. Create App Spec:
   [SCREEN: Text editor creating app.yaml]
   
   name: n8n-workflow-converter
   services:
   - name: web
     source_dir: /
     github:
       repo: your-username/n8n-workflow-converter
       branch: main
     run_command: npm start
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     
   databases:
   - name: db
     engine: PG
     version: "15"

2. Deploy via CLI:
   [SCREEN: Terminal]
   
   doctl apps create --spec app.yaml
   
   [SCREEN: Show deployment progress]

3. Configure environment variables:
   [SCREEN: DigitalOcean Apps dashboard]
   
   [SCREEN: Show adding environment variables in UI]

4. Set up custom domain:
   [SCREEN: Show domain configuration]
   
   [SCREEN: Show SSL certificate setup]"
```

#### Section 2: AWS ECS Deployment (10 minutes)

```
"For AWS ECS, we'll use Fargate for serverless containers:

[SCREEN: AWS Console]

1. Create ECR repository:
   [SCREEN: ECR console]
   
   aws ecr create-repository --repository-name n8n-workflow-converter

2. Build and push image:
   [SCREEN: Terminal]
   
   docker build -t n8n-workflow-converter .
   docker tag n8n-workflow-converter:latest 123456789.dkr.ecr.region.amazonaws.com/n8n-workflow-converter:latest
   docker push 123456789.dkr.ecr.region.amazonaws.com/n8n-workflow-converter:latest

3. Create ECS cluster:
   [SCREEN: ECS console]
   
   [SCREEN: Show cluster creation wizard]

4. Create task definition:
   [SCREEN: Task definition creation]
   
   [SCREEN: Show container configuration]
   
   Key settings:
   - CPU: 512
   - Memory: 1024
   - Port mappings: 3000

5. Create service:
   [SCREEN: Service creation]
   
   [SCREEN: Show service configuration]

6. Set up Application Load Balancer:
   [SCREEN: ALB configuration]
   
   [SCREEN: Show target group setup]"
```

#### Section 3: Environment Management (5 minutes)

```
"Managing environment variables securely in production:

[SCREEN: AWS Systems Manager Parameter Store]

1. Store secrets in Parameter Store:
   [SCREEN: Show creating parameters]
   
   /n8n-converter/prod/database-url
   /n8n-converter/prod/openai-api-key
   /n8n-converter/prod/supabase-service-key

2. Update task definition to use secrets:
   [SCREEN: Task definition secrets configuration]

3. Use AWS Secrets Manager for rotation:
   [SCREEN: Secrets Manager console]
   
   [SCREEN: Show automatic rotation setup]

For other platforms:
- DigitalOcean: App-level environment variables
- Google Cloud: Secret Manager
- Railway: Built-in environment variables"
```

#### Section 4: Monitoring and Logging (3 minutes)

```
"Set up monitoring for production:

[SCREEN: CloudWatch dashboard]

1. CloudWatch Logs:
   [SCREEN: Show log group creation]

2. Application metrics:
   [SCREEN: Show custom metrics dashboard]

3. Alerts:
   [SCREEN: Show alarm configuration]
   
   Key metrics to monitor:
   - Response time
   - Error rate
   - Memory usage
   - Database connections

4. Health checks:
   [SCREEN: Show health check configuration]"
```

#### Section 5: Backup and Recovery (2 minutes)

```
"Implement backup strategies:

[SCREEN: RDS automated backups]

1. Database backups:
   - Automated daily backups
   - Point-in-time recovery
   - Cross-region replication

2. Application data:
   [SCREEN: S3 backup configuration]
   
   - File storage backups
   - Configuration backups

3. Disaster recovery plan:
   [SCREEN: Show recovery procedures document]"
```

## Troubleshooting Common Issues

### Video Script: "Troubleshooting and Maintenance"

**Duration**: ~20 minutes

#### Introduction (1 minute)

```
"Welcome to our final video in the series - Troubleshooting and Maintenance!

We'll cover:
- Common deployment issues
- Performance optimization
- Monitoring and alerting
- Maintenance procedures
- Getting help

Let's start with the most common issues you might encounter."
```

#### Section 1: Common Deployment Issues (8 minutes)

```
"Let's troubleshoot typical deployment problems:

[SCREEN: Terminal showing error messages]

1. Container startup failures:
   
   Problem: Container exits immediately
   [SCREEN: Show docker logs output]
   
   Solution steps:
   - Check environment variables
   - Verify database connectivity
   - Review application logs
   
   [SCREEN: Show debugging commands]
   docker logs container-name
   docker exec -it container-name sh

2. Database connection issues:
   
   [SCREEN: Show connection error]
   
   Diagnostic steps:
   - Test database connectivity
   - Verify connection string format
   - Check network policies
   
   [SCREEN: Show testing commands]
   pg_isready -h host -p 5432
   telnet database-host 5432

3. Memory and performance issues:
   
   [SCREEN: Show resource monitoring]
   
   Solutions:
   - Increase container memory limits
   - Optimize database queries
   - Enable caching
   
   [SCREEN: Show resource configuration]"
```

#### Section 2: Performance Optimization (5 minutes)

```
"Let's optimize application performance:

[SCREEN: Performance monitoring dashboard]

1. Database optimization:
   [SCREEN: Database query analysis]
   
   - Add missing indexes
   - Optimize slow queries
   - Configure connection pooling
   
   [SCREEN: Show SQL optimization examples]

2. Application caching:
   [SCREEN: Redis configuration]
   
   - Enable Redis caching
   - Configure cache TTL
   - Implement cache warming
   
   [SCREEN: Show caching implementation]

3. CDN and static assets:
   [SCREEN: CloudFront configuration]
   
   - Configure CDN
   - Optimize images
   - Enable compression
   
   [SCREEN: Show CDN setup]"
```

#### Section 3: Monitoring Setup (4 minutes)

```
"Implement comprehensive monitoring:

[SCREEN: Grafana dashboard]

1. Application metrics:
   [SCREEN: Show metrics configuration]
   
   Key metrics:
   - Request rate
   - Response time
   - Error rate
   - Resource usage

2. Alert configuration:
   [SCREEN: Alert manager setup]
   
   Critical alerts:
   - Application down
   - High error rate
   - Resource exhaustion
   
   [SCREEN: Show alert rules]

3. Log aggregation:
   [SCREEN: ELK stack setup]
   
   - Centralized logging
   - Log parsing and indexing
   - Search and analysis
   
   [SCREEN: Show log analysis]"
```

#### Section 4: Maintenance Procedures (2 minutes)

```
"Regular maintenance tasks:

[SCREEN: Maintenance checklist]

1. Weekly tasks:
   - Review application logs
   - Check resource usage
   - Verify backup integrity
   
2. Monthly tasks:
   - Update dependencies
   - Security patches
   - Performance review
   
3. Quarterly tasks:
   - Disaster recovery testing
   - Security audit
   - Capacity planning

[SCREEN: Show automation scripts for maintenance]"
```

## Screenshot and Recording Guidelines

### Screen Recording Setup

**Recommended tools:**
- **macOS**: QuickTime Player or ScreenFlow
- **Windows**: OBS Studio or Camtasia
- **Linux**: OBS Studio or SimpleScreenRecorder

**Recording settings:**
- Resolution: 1920x1080 (1080p)
- Frame rate: 30 FPS
- Audio: 44.1 kHz, stereo
- Format: MP4 (H.264)

### Visual Guidelines

**Terminal setup:**
```bash
# Use a clear, readable font
# Recommended: Fira Code, Monaco, or Consolas
# Font size: 14-16pt for readability

# Color scheme: Use high contrast
# Recommended: Dark background with light text
# or Light background with dark text

# Window size: Full screen or large window
# Ensure all text is clearly visible
```

**Code editor setup:**
```
# Use syntax highlighting
# Recommended themes: 
# - Dark: One Dark Pro, Dracula
# - Light: One Light, GitHub Light

# Font size: 14-16pt
# Line numbers: Enabled
# Minimap: Disabled (can be distracting)
```

### Audio Guidelines

**Recording setup:**
- Use a quality microphone (USB or XLR)
- Record in a quiet environment
- Use noise reduction if necessary
- Maintain consistent volume levels

**Speaking guidelines:**
- Speak clearly and at moderate pace
- Pause between sections
- Explain what you're doing before doing it
- Use consistent terminology

### Post-Production

**Editing checklist:**
- Remove long pauses and "ums"
- Add captions/subtitles
- Include chapter markers
- Add intro/outro graphics
- Ensure audio levels are consistent

**Export settings:**
- Format: MP4
- Codec: H.264
- Bitrate: 5-10 Mbps for 1080p
- Audio: AAC, 128-192 kbps

### Publishing

**Platform considerations:**
- **YouTube**: Add detailed descriptions, tags, and timestamps
- **Vimeo**: Use for higher quality, professional presentation
- **Documentation site**: Embed videos with accompanying text

**Accessibility:**
- Provide accurate captions
- Include transcript in documentation
- Use descriptive titles and descriptions
- Ensure good color contrast in visuals

This comprehensive video tutorial guide provides scripts and technical guidelines for creating professional instructional videos for the n8n Workflow Converter self-hosting setup.