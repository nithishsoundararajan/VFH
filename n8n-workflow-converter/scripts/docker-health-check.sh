#!/bin/bash

# Docker health check script for n8n Workflow Converter
# This script checks the health of all Docker services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE=${1:-docker-compose.full-stack.yml}
VERBOSE=${2:-false}

echo -e "${BLUE}🏥 Docker Health Check${NC}"
echo "======================"

# Function to check service health
check_service_health() {
    local service=$1
    local container_name=$2
    
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${YELLOW}Checking $service...${NC}"
    fi
    
    # Check if container is running
    if ! docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        echo -e "${RED}❌ $service: Container not running${NC}"
        return 1
    fi
    
    # Check container health status
    health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "no-health-check")
    
    case $health_status in
        "healthy")
            echo -e "${GREEN}✅ $service: Healthy${NC}"
            return 0
            ;;
        "unhealthy")
            echo -e "${RED}❌ $service: Unhealthy${NC}"
            if [ "$VERBOSE" = "true" ]; then
                echo "   Last health check output:"
                docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' "$container_name" | tail -1
            fi
            return 1
            ;;
        "starting")
            echo -e "${YELLOW}⏳ $service: Starting${NC}"
            return 1
            ;;
        "no-health-check")
            # For services without health checks, just check if they're running
            echo -e "${GREEN}✅ $service: Running (no health check)${NC}"
            return 0
            ;;
        *)
            echo -e "${YELLOW}⚠️  $service: Unknown health status ($health_status)${NC}"
            return 1
            ;;
    esac
}

# Function to check service connectivity
check_service_connectivity() {
    local service=$1
    local url=$2
    local expected_status=${3:-200}
    
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${YELLOW}Testing connectivity to $service...${NC}"
    fi
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ $service: Connectivity OK${NC}"
        return 0
    else
        echo -e "${RED}❌ $service: Connectivity failed (HTTP $response)${NC}"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${YELLOW}Checking database connectivity...${NC}"
    fi
    
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL: Connection OK${NC}"
        
        # Check database size and connections
        if [ "$VERBOSE" = "true" ]; then
            db_size=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -t -c "SELECT pg_size_pretty(pg_database_size('n8n_converter'));" 2>/dev/null | xargs)
            active_connections=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | xargs)
            total_connections=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs)
            
            echo "   Database size: $db_size"
            echo "   Active connections: $active_connections"
            echo "   Total connections: $total_connections"
        fi
        
        return 0
    else
        echo -e "${RED}❌ PostgreSQL: Connection failed${NC}"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${YELLOW}Checking Redis connectivity...${NC}"
    fi
    
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis: Connection OK${NC}"
        
        # Check Redis info
        if [ "$VERBOSE" = "true" ]; then
            memory_usage=$(docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
            connected_clients=$(docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli info clients | grep connected_clients | cut -d: -f2 | tr -d '\r')
            
            echo "   Memory usage: $memory_usage"
            echo "   Connected clients: $connected_clients"
        fi
        
        return 0
    else
        echo -e "${RED}❌ Redis: Connection failed${NC}"
        return 1
    fi
}

# Function to get container resource usage
get_resource_usage() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${BLUE}📊 Resource Usage${NC}"
        echo "=================="
        
        # Get container stats
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" $(docker-compose -f "$COMPOSE_FILE" ps -q) 2>/dev/null || echo "Unable to get container stats"
        echo ""
    fi
}

# Function to check disk usage
check_disk_usage() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${BLUE}💾 Disk Usage${NC}"
        echo "============="
        
        # Check Docker system usage
        docker system df
        echo ""
        
        # Check volume usage
        echo "Volume usage:"
        docker volume ls -q | grep "n8n-workflow-converter" | while read volume; do
            size=$(docker run --rm -v "$volume":/data alpine du -sh /data 2>/dev/null | cut -f1 || echo "Unknown")
            echo "  $volume: $size"
        done
        echo ""
    fi
}

# Main health check
echo "Checking service health..."
echo ""

# Track overall health
overall_health=0

# Check individual services
services=(
    "app:n8n-workflow-converter_app_1"
    "postgres:n8n-workflow-converter_postgres_1"
    "redis:n8n-workflow-converter_redis_1"
    "nginx:n8n-workflow-converter_nginx_1"
)

for service_info in "${services[@]}"; do
    IFS=':' read -r service container <<< "$service_info"
    if ! check_service_health "$service" "$container"; then
        overall_health=1
    fi
done

echo ""

# Check connectivity
echo "Checking service connectivity..."
echo ""

# Application health endpoint
if ! check_service_connectivity "Application" "http://localhost:3000/api/health"; then
    overall_health=1
fi

# Database connectivity
if ! check_database; then
    overall_health=1
fi

# Redis connectivity
if ! check_redis; then
    overall_health=1
fi

# Nginx (optional)
check_service_connectivity "Nginx" "http://localhost:80/health" || true

# Prometheus (if enabled)
if docker-compose -f "$COMPOSE_FILE" ps prometheus | grep -q "Up"; then
    check_service_connectivity "Prometheus" "http://localhost:9090/-/healthy" || true
fi

# Grafana (if enabled)
if docker-compose -f "$COMPOSE_FILE" ps grafana | grep -q "Up"; then
    check_service_connectivity "Grafana" "http://localhost:3001/api/health" || true
fi

echo ""

# Get resource usage if verbose
get_resource_usage

# Check disk usage if verbose
check_disk_usage

# Summary
echo -e "${BLUE}📋 Health Check Summary${NC}"
echo "======================="

if [ $overall_health -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical services are healthy!${NC}"
else
    echo -e "${RED}⚠️  Some services have issues. Check the details above.${NC}"
fi

echo ""
echo "Timestamp: $(date)"
echo "Compose file: $COMPOSE_FILE"

# Additional information
if [ "$VERBOSE" = "true" ]; then
    echo ""
    echo -e "${BLUE}🔧 Troubleshooting Commands${NC}"
    echo "==========================="
    echo "View logs:           docker-compose -f $COMPOSE_FILE logs -f [service]"
    echo "Restart service:     docker-compose -f $COMPOSE_FILE restart [service]"
    echo "Check service status: docker-compose -f $COMPOSE_FILE ps"
    echo "Execute in container: docker-compose -f $COMPOSE_FILE exec [service] [command]"
    echo ""
fi

exit $overall_health