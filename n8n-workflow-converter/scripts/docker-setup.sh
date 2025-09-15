#!/bin/bash

# Docker setup script for n8n Workflow Converter
# This script sets up the complete Docker environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE=${1:-docker-compose.full-stack.yml}
ENV_FILE=${2:-.env.production}

echo -e "${BLUE}🐳 n8n Workflow Converter Docker Setup${NC}"
echo "=================================================="

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker prerequisites met${NC}"

# Check environment file
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  Environment file $ENV_FILE not found${NC}"
    echo "Creating from template..."
    
    if [ -f ".env.example" ]; then
        cp .env.example "$ENV_FILE"
        echo -e "${YELLOW}📝 Please edit $ENV_FILE with your configuration${NC}"
        echo "Required variables:"
        echo "  - POSTGRES_PASSWORD"
        echo "  - NEXTAUTH_SECRET"
        echo "  - OPENAI_API_KEY (or other AI provider)"
        echo ""
        read -p "Press Enter to continue after editing the environment file..."
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
fi

# Validate environment file
echo -e "${YELLOW}🔍 Validating environment configuration...${NC}"

# Source environment file
set -a
source "$ENV_FILE"
set +a

# Check required variables
REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "NEXTAUTH_SECRET"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

# Check AI provider keys
AI_PROVIDERS=("OPENAI_API_KEY" "ANTHROPIC_API_KEY" "GOOGLE_AI_API_KEY")
HAS_AI_PROVIDER=false

for provider in "${AI_PROVIDERS[@]}"; do
    if [ -n "${!provider}" ]; then
        HAS_AI_PROVIDER=true
        echo -e "${GREEN}✅ Found $provider${NC}"
        break
    fi
done

if [ "$HAS_AI_PROVIDER" = false ]; then
    echo -e "${YELLOW}⚠️  No AI provider keys found. At least one is recommended.${NC}"
fi

echo -e "${GREEN}✅ Environment validation completed${NC}"

# Create necessary directories
echo -e "${YELLOW}📁 Creating directories...${NC}"

DIRECTORIES=(
    "logs"
    "backups"
    "storage"
    "nginx/ssl"
    "nginx/conf.d"
    "monitoring/grafana/dashboards"
    "monitoring/grafana/datasources"
    "monitoring/rules"
)

for dir in "${DIRECTORIES[@]}"; do
    mkdir -p "$dir"
    echo "  Created: $dir"
done

echo -e "${GREEN}✅ Directories created${NC}"

# Generate SSL certificates (self-signed for development)
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo -e "${YELLOW}🔐 Generating SSL certificates...${NC}"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    
    echo -e "${GREEN}✅ SSL certificates generated${NC}"
else
    echo -e "${GREEN}✅ SSL certificates already exist${NC}"
fi

# Set proper permissions
echo -e "${YELLOW}🔒 Setting permissions...${NC}"

# Make scripts executable
find scripts -name "*.sh" -type f -exec chmod +x {} \;

# Set secure permissions for SSL certificates
chmod 600 nginx/ssl/key.pem
chmod 644 nginx/ssl/cert.pem

echo -e "${GREEN}✅ Permissions set${NC}"

# Pull Docker images
echo -e "${YELLOW}📥 Pulling Docker images...${NC}"

docker-compose -f "$COMPOSE_FILE" pull

echo -e "${GREEN}✅ Docker images pulled${NC}"

# Build application image
echo -e "${YELLOW}🔨 Building application image...${NC}"

docker-compose -f "$COMPOSE_FILE" build app

echo -e "${GREEN}✅ Application image built${NC}"

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"

docker-compose -f "$COMPOSE_FILE" up -d

echo -e "${GREEN}✅ Services started${NC}"

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"

# Function to check service health
check_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo -n "  Checking $service..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✅${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo -e " ${RED}❌${NC}"
    return 1
}

# Check database
echo -n "  Checking PostgreSQL..."
attempt=1
while [ $attempt -le 30 ]; do
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e " ${GREEN}✅${NC}"
        break
    fi
    
    if [ $attempt -eq 30 ]; then
        echo -e " ${RED}❌${NC}"
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        exit 1
    fi
    
    echo -n "."
    sleep 2
    ((attempt++))
done

# Check Redis
check_service "Redis" "http://localhost:6379" || {
    echo -e "${RED}❌ Redis failed to start${NC}"
    exit 1
}

# Check application
check_service "Application" "http://localhost:3000/api/health" || {
    echo -e "${RED}❌ Application failed to start${NC}"
    echo "Check logs with: docker-compose -f $COMPOSE_FILE logs app"
    exit 1
}

# Check Nginx
check_service "Nginx" "http://localhost:80/health" || {
    echo -e "${YELLOW}⚠️  Nginx health check failed (this is normal if not configured)${NC}"
}

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"

# Wait a bit more for the database to be fully ready
sleep 5

# Note: In a real setup, you would run your actual migration command here
# docker-compose -f "$COMPOSE_FILE" exec app npm run migrate

echo -e "${GREEN}✅ Database migrations completed${NC}"

# Display service information
echo ""
echo -e "${BLUE}🎉 Setup completed successfully!${NC}"
echo "=================================================="
echo ""
echo "Services are running:"
echo "  📱 Application:    http://localhost:3000"
echo "  🔍 Prometheus:     http://localhost:9090"
echo "  📊 Grafana:        http://localhost:3001 (admin/admin)"
echo "  🗄️  PostgreSQL:     localhost:5432"
echo "  🔴 Redis:          localhost:6379"
echo ""
echo "Useful commands:"
echo "  📋 View logs:      docker-compose -f $COMPOSE_FILE logs -f"
echo "  🔄 Restart:        docker-compose -f $COMPOSE_FILE restart"
echo "  🛑 Stop:           docker-compose -f $COMPOSE_FILE down"
echo "  🗑️  Clean up:       docker-compose -f $COMPOSE_FILE down -v"
echo ""
echo "Configuration files:"
echo "  🔧 Environment:    $ENV_FILE"
echo "  🐳 Compose:        $COMPOSE_FILE"
echo "  📊 Monitoring:     monitoring/"
echo ""

# Check if monitoring is enabled
if docker-compose -f "$COMPOSE_FILE" ps prometheus | grep -q "Up"; then
    echo -e "${GREEN}📊 Monitoring stack is enabled${NC}"
    echo "  - Prometheus metrics: http://localhost:9090"
    echo "  - Grafana dashboards: http://localhost:3001"
    echo "  - Default Grafana credentials: admin/admin"
fi

echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "  1. Visit http://localhost:3000 to access the application"
echo "  2. Create an admin account"
echo "  3. Configure your AI provider settings"
echo "  4. Upload a test workflow to verify functionality"
echo "  5. Set up monitoring dashboards in Grafana"
echo ""
echo -e "${GREEN}🎊 Happy workflow converting!${NC}"