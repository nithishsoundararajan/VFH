#!/bin/bash

# One-click setup script for n8n Workflow Converter
# This script automates the complete installation process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/setup.log"

# Default values
DEPLOYMENT_TYPE="development"
USE_DOCKER="false"
SKIP_DEPENDENCIES="false"
SKIP_DATABASE="false"
INTERACTIVE="true"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
    echo -e "$1"
}

# Function to show help
show_help() {
    cat << EOF
n8n Workflow Converter Setup Script

Usage: $0 [OPTIONS]

Options:
    -t, --type TYPE         Deployment type: development, production, docker (default: development)
    -d, --docker           Use Docker deployment
    -s, --skip-deps        Skip dependency installation
    -b, --skip-db          Skip database setup
    -n, --non-interactive  Run in non-interactive mode
    -h, --help             Show this help message

Examples:
    $0                                    # Interactive development setup
    $0 --type production                  # Production setup
    $0 --docker                          # Docker deployment
    $0 --type production --non-interactive # Automated production setup

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        -d|--docker)
            USE_DOCKER="true"
            shift
            ;;
        -s|--skip-deps)
            SKIP_DEPENDENCIES="true"
            shift
            ;;
        -b|--skip-db)
            SKIP_DATABASE="true"
            shift
            ;;
        -n|--non-interactive)
            INTERACTIVE="false"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate deployment type
if [[ ! "$DEPLOYMENT_TYPE" =~ ^(development|production|docker)$ ]]; then
    log "${RED}❌ Invalid deployment type: $DEPLOYMENT_TYPE${NC}"
    log "Valid types: development, production, docker"
    exit 1
fi

# Set Docker flag based on deployment type
if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
    USE_DOCKER="true"
fi

# Start setup
log "${BLUE}🚀 n8n Workflow Converter Setup${NC}"
log "=================================="
log ""
log "Configuration:"
log "  Deployment Type: $DEPLOYMENT_TYPE"
log "  Use Docker: $USE_DOCKER"
log "  Interactive: $INTERACTIVE"
log "  Project Directory: $PROJECT_DIR"
log ""

# Change to project directory
cd "$PROJECT_DIR"

# Function to check system requirements
check_system_requirements() {
    log "${YELLOW}📋 Checking system requirements...${NC}"
    
    local requirements_met=true
    
    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version | sed 's/v//')
        local required_version="20.0.0"
        
        if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" = "$required_version" ]; then
            log "${GREEN}✅ Node.js $node_version (>= $required_version required)${NC}"
        else
            log "${RED}❌ Node.js $node_version is too old (>= $required_version required)${NC}"
            requirements_met=false
        fi
    else
        log "${RED}❌ Node.js is not installed${NC}"
        requirements_met=false
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        log "${GREEN}✅ npm $npm_version${NC}"
    else
        log "${RED}❌ npm is not installed${NC}"
        requirements_met=false
    fi
    
    # Check Git
    if command -v git &> /dev/null; then
        local git_version=$(git --version | cut -d' ' -f3)
        log "${GREEN}✅ Git $git_version${NC}"
    else
        log "${RED}❌ Git is not installed${NC}"
        requirements_met=false
    fi
    
    # Check Docker (if needed)
    if [[ "$USE_DOCKER" == "true" ]]; then
        if command -v docker &> /dev/null; then
            local docker_version=$(docker --version | cut -d' ' -f3 | sed 's/,//')
            log "${GREEN}✅ Docker $docker_version${NC}"
        else
            log "${RED}❌ Docker is not installed${NC}"
            requirements_met=false
        fi
        
        if command -v docker-compose &> /dev/null; then
            local compose_version=$(docker-compose --version | cut -d' ' -f4 | sed 's/,//')
            log "${GREEN}✅ Docker Compose $compose_version${NC}"
        else
            log "${RED}❌ Docker Compose is not installed${NC}"
            requirements_met=false
        fi
        
        # Check if Docker daemon is running
        if ! docker info &> /dev/null; then
            log "${RED}❌ Docker daemon is not running${NC}"
            requirements_met=false
        fi
    fi
    
    # Check system resources
    local total_memory=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
    local available_disk=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    
    if [[ $total_memory -ge 4 ]]; then
        log "${GREEN}✅ Memory: ${total_memory}GB (>= 4GB required)${NC}"
    else
        log "${YELLOW}⚠️  Memory: ${total_memory}GB (4GB recommended)${NC}"
    fi
    
    if [[ $available_disk -ge 20 ]]; then
        log "${GREEN}✅ Disk Space: ${available_disk}GB (>= 20GB required)${NC}"
    else
        log "${RED}❌ Disk Space: ${available_disk}GB (>= 20GB required)${NC}"
        requirements_met=false
    fi
    
    if [[ "$requirements_met" == "false" ]]; then
        log "${RED}❌ System requirements not met. Please install missing dependencies.${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ System requirements check passed${NC}"
}

# Function to install dependencies
install_dependencies() {
    if [[ "$SKIP_DEPENDENCIES" == "true" ]]; then
        log "${YELLOW}⏭️  Skipping dependency installation${NC}"
        return
    fi
    
    log "${YELLOW}📦 Installing dependencies...${NC}"
    
    if [[ "$USE_DOCKER" == "true" ]]; then
        log "Using Docker - skipping npm install"
        return
    fi
    
    # Clean install
    if [[ -d "node_modules" ]]; then
        log "Cleaning existing node_modules..."
        rm -rf node_modules
    fi
    
    if [[ -f "package-lock.json" ]]; then
        log "Removing existing package-lock.json..."
        rm package-lock.json
    fi
    
    # Install dependencies
    log "Running npm install..."
    npm install
    
    log "${GREEN}✅ Dependencies installed${NC}"
}

# Function to setup environment
setup_environment() {
    log "${YELLOW}🔧 Setting up environment...${NC}"
    
    local env_file
    case "$DEPLOYMENT_TYPE" in
        "development")
            env_file=".env.local"
            ;;
        "production")
            env_file=".env.production"
            ;;
        "docker")
            env_file=".env.production"
            ;;
    esac
    
    # Copy environment template if it doesn't exist
    if [[ ! -f "$env_file" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example "$env_file"
            log "Created $env_file from template"
        elif [[ -f ".env.docker" && "$USE_DOCKER" == "true" ]]; then
            cp .env.docker "$env_file"
            log "Created $env_file from Docker template"
        else
            log "${RED}❌ No environment template found${NC}"
            exit 1
        fi
    else
        log "Environment file $env_file already exists"
    fi
    
    # Interactive configuration
    if [[ "$INTERACTIVE" == "true" ]]; then
        log "${CYAN}🔑 Environment Configuration${NC}"
        log "Please configure the following required variables in $env_file:"
        log ""
        
        # Check for required variables
        local required_vars=()
        
        if [[ "$USE_DOCKER" == "true" || "$DEPLOYMENT_TYPE" == "production" ]]; then
            required_vars+=("POSTGRES_PASSWORD")
        fi
        
        required_vars+=("NEXTAUTH_SECRET")
        
        # Check AI provider keys
        local has_ai_key=false
        for key in "OPENAI_API_KEY" "ANTHROPIC_API_KEY" "GOOGLE_AI_API_KEY"; do
            if grep -q "^$key=" "$env_file" && ! grep -q "^$key=$" "$env_file"; then
                has_ai_key=true
                break
            fi
        done
        
        if [[ "$has_ai_key" == "false" ]]; then
            required_vars+=("AI_PROVIDER_KEY")
        fi
        
        for var in "${required_vars[@]}"; do
            if [[ "$var" == "AI_PROVIDER_KEY" ]]; then
                log "  - At least one AI provider key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY)"
            else
                log "  - $var"
            fi
        done
        
        log ""
        read -p "Press Enter to open $env_file for editing, or 'c' to continue without editing: " choice
        
        if [[ "$choice" != "c" ]]; then
            ${EDITOR:-nano} "$env_file"
        fi
    fi
    
    # Generate secrets if needed
    log "Generating missing secrets..."
    
    # Generate NEXTAUTH_SECRET if empty
    if grep -q "^NEXTAUTH_SECRET=$" "$env_file" || ! grep -q "^NEXTAUTH_SECRET=" "$env_file"; then
        local nextauth_secret=$(openssl rand -base64 32)
        if grep -q "^NEXTAUTH_SECRET=" "$env_file"; then
            sed -i "s/^NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$nextauth_secret/" "$env_file"
        else
            echo "NEXTAUTH_SECRET=$nextauth_secret" >> "$env_file"
        fi
        log "Generated NEXTAUTH_SECRET"
    fi
    
    # Generate ENCRYPTION_KEY if empty
    if grep -q "^ENCRYPTION_KEY=$" "$env_file" || ! grep -q "^ENCRYPTION_KEY=" "$env_file"; then
        local encryption_key=$(openssl rand -hex 32)
        if grep -q "^ENCRYPTION_KEY=" "$env_file"; then
            sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$encryption_key/" "$env_file"
        else
            echo "ENCRYPTION_KEY=$encryption_key" >> "$env_file"
        fi
        log "Generated ENCRYPTION_KEY"
    fi
    
    # Generate POSTGRES_PASSWORD if empty (for Docker/production)
    if [[ "$USE_DOCKER" == "true" || "$DEPLOYMENT_TYPE" == "production" ]]; then
        if grep -q "^POSTGRES_PASSWORD=$" "$env_file" || ! grep -q "^POSTGRES_PASSWORD=" "$env_file"; then
            local postgres_password=$(openssl rand -base64 32)
            if grep -q "^POSTGRES_PASSWORD=" "$env_file"; then
                sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$postgres_password/" "$env_file"
            else
                echo "POSTGRES_PASSWORD=$postgres_password" >> "$env_file"
            fi
            log "Generated POSTGRES_PASSWORD"
        fi
    fi
    
    log "${GREEN}✅ Environment setup completed${NC}"
}

# Function to validate environment
validate_environment() {
    log "${YELLOW}🔍 Validating environment...${NC}"
    
    # Run validation script if it exists
    if [[ -f "scripts/validate-env.js" ]]; then
        if command -v node &> /dev/null; then
            node scripts/validate-env.js
        else
            log "${YELLOW}⚠️  Cannot run environment validation (Node.js not available)${NC}"
        fi
    else
        log "${YELLOW}⚠️  Environment validation script not found${NC}"
    fi
    
    log "${GREEN}✅ Environment validation completed${NC}"
}

# Function to setup database
setup_database() {
    if [[ "$SKIP_DATABASE" == "true" ]]; then
        log "${YELLOW}⏭️  Skipping database setup${NC}"
        return
    fi
    
    log "${YELLOW}🗄️  Setting up database...${NC}"
    
    if [[ "$USE_DOCKER" == "true" ]]; then
        log "Database will be set up automatically with Docker"
        return
    fi
    
    # Check if using Supabase or local database
    local env_file
    case "$DEPLOYMENT_TYPE" in
        "development")
            env_file=".env.local"
            ;;
        "production")
            env_file=".env.production"
            ;;
    esac
    
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" "$env_file" && ! grep -q "^NEXT_PUBLIC_SUPABASE_URL=$" "$env_file"; then
        log "Using Supabase - running migrations..."
        
        # Install Supabase CLI if not present
        if ! command -v supabase &> /dev/null; then
            log "Installing Supabase CLI..."
            npm install -g supabase
        fi
        
        # Run migrations
        if [[ -d "supabase/migrations" ]]; then
            supabase db push || log "${YELLOW}⚠️  Migration failed - you may need to run this manually${NC}"
        fi
        
        # Create storage buckets
        log "Creating storage buckets..."
        supabase storage create workflow-files || true
        supabase storage create generated-projects || true
        
    elif grep -q "DATABASE_URL" "$env_file" && ! grep -q "^DATABASE_URL=$" "$env_file"; then
        log "Using PostgreSQL - running migrations..."
        
        # Run database migrations (implement based on your migration system)
        if [[ -f "scripts/migrate.js" ]]; then
            node scripts/migrate.js
        elif command -v npm &> /dev/null && npm run migrate &> /dev/null; then
            npm run migrate
        else
            log "${YELLOW}⚠️  No migration script found - you may need to set up the database manually${NC}"
        fi
    else
        log "${YELLOW}⚠️  No database configuration found - skipping database setup${NC}"
    fi
    
    log "${GREEN}✅ Database setup completed${NC}"
}

# Function to build application
build_application() {
    if [[ "$USE_DOCKER" == "true" ]]; then
        log "${YELLOW}🔨 Building Docker images...${NC}"
        
        # Build Docker images
        if [[ -f "docker-compose.full-stack.yml" ]]; then
            docker-compose -f docker-compose.full-stack.yml build
        else
            docker-compose build
        fi
        
        log "${GREEN}✅ Docker images built${NC}"
        return
    fi
    
    if [[ "$DEPLOYMENT_TYPE" == "production" ]]; then
        log "${YELLOW}🔨 Building application for production...${NC}"
        
        # Build the application
        npm run build
        
        log "${GREEN}✅ Application built${NC}"
    else
        log "${YELLOW}⏭️  Skipping build for development${NC}"
    fi
}

# Function to start services
start_services() {
    log "${YELLOW}🚀 Starting services...${NC}"
    
    if [[ "$USE_DOCKER" == "true" ]]; then
        # Start Docker services
        if [[ -f "docker-compose.full-stack.yml" ]]; then
            docker-compose -f docker-compose.full-stack.yml up -d
        else
            docker-compose up -d
        fi
        
        # Wait for services to be ready
        log "Waiting for services to start..."
        sleep 10
        
        # Check service health
        if [[ -f "scripts/docker-health-check.sh" ]]; then
            bash scripts/docker-health-check.sh
        fi
        
    else
        # Start development server
        if [[ "$DEPLOYMENT_TYPE" == "development" ]]; then
            log "Starting development server..."
            log "Run 'npm run dev' to start the development server"
        else
            log "For production, use a process manager like PM2:"
            log "  npm install -g pm2"
            log "  pm2 start npm --name 'n8n-converter' -- start"
        fi
    fi
    
    log "${GREEN}✅ Services started${NC}"
}

# Function to run post-setup tasks
post_setup() {
    log "${YELLOW}🎯 Running post-setup tasks...${NC}"
    
    # Create necessary directories
    local directories=("logs" "backups" "storage")
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log "Created directory: $dir"
        fi
    done
    
    # Set permissions
    if [[ "$USE_DOCKER" == "false" ]]; then
        chmod -R 755 scripts/ || true
        log "Set script permissions"
    fi
    
    # Create systemd service (Linux only)
    if [[ "$DEPLOYMENT_TYPE" == "production" && "$USE_DOCKER" == "false" && -f "/etc/systemd/system" ]]; then
        if [[ "$INTERACTIVE" == "true" ]]; then
            read -p "Create systemd service? (y/N): " create_service
            if [[ "$create_service" =~ ^[Yy]$ ]]; then
                bash scripts/create-systemd-service.sh || log "${YELLOW}⚠️  Failed to create systemd service${NC}"
            fi
        fi
    fi
    
    log "${GREEN}✅ Post-setup tasks completed${NC}"
}

# Function to show completion message
show_completion() {
    log ""
    log "${GREEN}🎉 Setup completed successfully!${NC}"
    log "=================================="
    log ""
    
    case "$DEPLOYMENT_TYPE" in
        "development")
            log "Development setup complete!"
            log ""
            log "Next steps:"
            log "  1. Start the development server: ${CYAN}npm run dev${NC}"
            log "  2. Open your browser to: ${CYAN}http://localhost:3000${NC}"
            log "  3. Create an admin account"
            log "  4. Configure your AI provider settings"
            ;;
        "production")
            if [[ "$USE_DOCKER" == "true" ]]; then
                log "Docker production setup complete!"
                log ""
                log "Services are running:"
                log "  📱 Application:    ${CYAN}http://localhost:3000${NC}"
                log "  📊 Grafana:        ${CYAN}http://localhost:3001${NC} (admin/admin)"
                log "  🔍 Prometheus:     ${CYAN}http://localhost:9090${NC}"
                log ""
                log "Useful commands:"
                log "  📋 View logs:      ${CYAN}docker-compose logs -f${NC}"
                log "  🔄 Restart:        ${CYAN}docker-compose restart${NC}"
                log "  🛑 Stop:           ${CYAN}docker-compose down${NC}"
            else
                log "Production setup complete!"
                log ""
                log "Next steps:"
                log "  1. Start the application: ${CYAN}npm start${NC}"
                log "  2. Set up a reverse proxy (Nginx/Apache)"
                log "  3. Configure SSL certificates"
                log "  4. Set up monitoring and backups"
            fi
            ;;
    esac
    
    log ""
    log "Configuration files:"
    log "  🔧 Environment:    ${CYAN}.env.local${NC} or ${CYAN}.env.production${NC}"
    log "  📚 Documentation:  ${CYAN}docs/${NC}"
    log "  🐛 Troubleshooting: ${CYAN}docs/TROUBLESHOOTING.md${NC}"
    log ""
    log "For help and support:"
    log "  📖 Documentation: ${CYAN}https://github.com/your-org/n8n-workflow-converter/docs${NC}"
    log "  🐛 Issues: ${CYAN}https://github.com/your-org/n8n-workflow-converter/issues${NC}"
    log ""
    log "${PURPLE}Happy workflow converting! 🎊${NC}"
}

# Main execution
main() {
    # Create log file
    touch "$LOG_FILE"
    
    # Run setup steps
    check_system_requirements
    install_dependencies
    setup_environment
    validate_environment
    setup_database
    build_application
    start_services
    post_setup
    show_completion
    
    log ""
    log "Setup log saved to: $LOG_FILE"
}

# Handle interruption
trap 'log "${RED}Setup interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"