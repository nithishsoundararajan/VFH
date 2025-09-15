#!/bin/bash

# Supabase Edge Function Secrets Management Script
# This script helps you manage secrets for your Edge Functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Supabase CLI is installed
check_supabase_cli() {
    if ! command -v supabase &> /dev/null; then
        print_error "Supabase CLI is not installed. Please install it first:"
        echo "npm install -g supabase"
        exit 1
    fi
    print_success "Supabase CLI is installed"
}

# List all current secrets
list_secrets() {
    print_status "Listing current Edge Function secrets..."
    supabase secrets list
}

# Set a secret
set_secret() {
    local secret_name=$1
    local secret_value=$2
    
    if [ -z "$secret_name" ] || [ -z "$secret_value" ]; then
        print_error "Usage: set_secret <SECRET_NAME> <SECRET_VALUE>"
        return 1
    fi
    
    print_status "Setting secret: $secret_name"
    echo "$secret_value" | supabase secrets set "$secret_name"
    print_success "Secret $secret_name has been set"
}

# Set multiple secrets interactively
set_converter_secrets() {
    print_status "Setting up n8n Converter secrets..."
    
    # Required secrets for n8n converter
    declare -A secrets=(
        ["VIRUSTOTAL_API_KEY"]="VirusTotal API key for security scanning"
        ["WEBHOOK_SECRET"]="Secret for webhook validation (32+ characters)"
        ["ENCRYPTION_KEY"]="Encryption key for sensitive data (32+ characters)"
    )
    
    # Optional secrets
    declare -A optional_secrets=(
        ["OPENAI_API_KEY"]="OpenAI API key for AI-assisted code generation"
        ["GITHUB_TOKEN"]="GitHub token for repository integration"
    )
    
    echo
    print_status "Required secrets:"
    for secret_name in "${!secrets[@]}"; do
        echo -e "  ${YELLOW}$secret_name${NC}: ${secrets[$secret_name]}"
        read -p "Enter value for $secret_name (or press Enter to skip): " -s secret_value
        echo
        
        if [ -n "$secret_value" ]; then
            set_secret "$secret_name" "$secret_value"
        else
            print_warning "Skipped $secret_name"
        fi
    done
    
    echo
    print_status "Optional secrets:"
    for secret_name in "${!optional_secrets[@]}"; do
        echo -e "  ${YELLOW}$secret_name${NC}: ${optional_secrets[$secret_name]}"
        read -p "Enter value for $secret_name (or press Enter to skip): " -s secret_value
        echo
        
        if [ -n "$secret_value" ]; then
            set_secret "$secret_name" "$secret_value"
        else
            print_warning "Skipped $secret_name"
        fi
    done
}

# Generate secure random values
generate_secure_key() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Generate and set webhook secret
generate_webhook_secret() {
    local webhook_secret=$(generate_secure_key 32)
    print_status "Generated secure webhook secret"
    set_secret "WEBHOOK_SECRET" "$webhook_secret"
    print_success "Webhook secret has been generated and set"
}

# Generate and set encryption key
generate_encryption_key() {
    local encryption_key=$(generate_secure_key 32)
    print_status "Generated secure encryption key"
    set_secret "ENCRYPTION_KEY" "$encryption_key"
    print_success "Encryption key has been generated and set"
}

# Delete a secret
delete_secret() {
    local secret_name=$1
    
    if [ -z "$secret_name" ]; then
        print_error "Usage: delete_secret <SECRET_NAME>"
        return 1
    fi
    
    print_warning "Deleting secret: $secret_name"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        supabase secrets unset "$secret_name"
        print_success "Secret $secret_name has been deleted"
    else
        print_status "Cancelled"
    fi
}

# Show help
show_help() {
    echo "Supabase Edge Function Secrets Manager"
    echo
    echo "Usage: $0 <command> [arguments]"
    echo
    echo "Commands:"
    echo "  list                     List all current secrets"
    echo "  set <name> <value>       Set a specific secret"
    echo "  delete <name>            Delete a specific secret"
    echo "  setup                    Interactive setup for n8n converter secrets"
    echo "  generate-webhook         Generate and set a secure webhook secret"
    echo "  generate-encryption      Generate and set a secure encryption key"
    echo "  help                     Show this help message"
    echo
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 set VIRUSTOTAL_API_KEY your_api_key_here"
    echo "  $0 setup"
    echo "  $0 generate-webhook"
}

# Main script logic
main() {
    check_supabase_cli
    
    case "${1:-help}" in
        "list")
            list_secrets
            ;;
        "set")
            set_secret "$2" "$3"
            ;;
        "delete")
            delete_secret "$2"
            ;;
        "setup")
            set_converter_secrets
            ;;
        "generate-webhook")
            generate_webhook_secret
            ;;
        "generate-encryption")
            generate_encryption_key
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run the main function with all arguments
main "$@"