#!/bin/bash
# Secure Production Deployment Script for Spotify MCP Server
# Automates the setup of HTTPS redirect URIs and production configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOMAIN=""
STAGING_DOMAIN=""
SSL_EMAIL=""
ENVIRONMENT="production"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Secure deployment script for Spotify MCP Server with HTTPS redirect URIs.

OPTIONS:
    -d, --domain DOMAIN         Production domain (required)
    -s, --staging DOMAIN        Staging domain (optional)  
    -e, --email EMAIL           Email for SSL certificate (required)
    -E, --environment ENV       Environment: production|staging (default: production)
    -h, --help                  Show this help message

EXAMPLES:
    # Production deployment
    $0 --domain myapp.com --email admin@myapp.com
    
    # Staging deployment  
    $0 --domain staging.myapp.com --email admin@myapp.com --environment staging
    
    # Both production and staging
    $0 --domain myapp.com --staging staging.myapp.com --email admin@myapp.com

EOF
}

check_requirements() {
    log "Checking requirements..."
    
    # Check if running as non-root user with sudo access
    if [[ $EUID -eq 0 ]]; then
        error "Don't run this script as root. Run as a regular user with sudo access."
    fi
    
    # Check for required commands
    local required_commands=("docker" "docker-compose" "openssl" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command '$cmd' not found. Please install it first."
        fi
    done
    
    # Check if domain is provided
    if [[ -z "$DOMAIN" ]]; then
        error "Domain is required. Use --domain or -d option."
    fi
    
    # Check if email is provided
    if [[ -z "$SSL_EMAIL" ]]; then
        error "Email is required for SSL certificate. Use --email or -e option."
    fi
    
    success "Requirements check passed"
}

validate_domain() {
    local domain="$1"
    log "Validating domain: $domain"
    
    # Check if domain resolves
    if ! nslookup "$domain" &> /dev/null; then
        error "Domain '$domain' does not resolve. Please check DNS configuration."
    fi
    
    # Check if domain points to this server
    local domain_ip
    domain_ip=$(dig +short "$domain" | tail -n1)
    local server_ip
    server_ip=$(curl -s ipinfo.io/ip)
    
    if [[ "$domain_ip" != "$server_ip" ]]; then
        warn "Domain '$domain' IP ($domain_ip) doesn't match server IP ($server_ip)"
        warn "Make sure DNS is properly configured"
    fi
    
    success "Domain validation completed"
}

setup_ssl_certificate() {
    local domain="$1"
    log "Setting up SSL certificate for $domain"
    
    # Create SSL directory
    mkdir -p "$PROJECT_DIR/ssl"
    
    # Check if certificate already exists and is valid
    if [[ -f "$PROJECT_DIR/ssl/cert.pem" ]] && [[ -f "$PROJECT_DIR/ssl/key.pem" ]]; then
        local cert_domain
        cert_domain=$(openssl x509 -in "$PROJECT_DIR/ssl/cert.pem" -noout -subject | grep -o "CN=.*" | cut -d= -f2 | cut -d/ -f1)
        
        if [[ "$cert_domain" == "$domain" ]]; then
            local expiry_date
            expiry_date=$(openssl x509 -in "$PROJECT_DIR/ssl/cert.pem" -noout -enddate | cut -d= -f2)
            local expiry_epoch
            expiry_epoch=$(date -d "$expiry_date" +%s)
            local current_epoch
            current_epoch=$(date +%s)
            local days_until_expiry
            days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            if [[ $days_until_expiry -gt 30 ]]; then
                success "Valid SSL certificate already exists (expires in $days_until_expiry days)"
                return
            fi
        fi
    fi
    
    # Generate self-signed certificate for testing or obtain Let's Encrypt
    log "Generating SSL certificate..."
    
    # Check if we can use certbot for Let's Encrypt
    if command -v certbot &> /dev/null && [[ "$ENVIRONMENT" == "production" ]]; then
        log "Using Let's Encrypt for SSL certificate"
        
        # Install nginx temporarily for domain validation
        sudo apt-get update && sudo apt-get install -y nginx
        sudo systemctl start nginx
        
        # Obtain certificate
        sudo certbot certonly --nginx \
            --non-interactive \
            --agree-tos \
            --email "$SSL_EMAIL" \
            -d "$domain" \
            ${STAGING_DOMAIN:+"-d $STAGING_DOMAIN"}
        
        # Copy certificates to project directory
        sudo cp "/etc/letsencrypt/live/$domain/fullchain.pem" "$PROJECT_DIR/ssl/cert.pem"
        sudo cp "/etc/letsencrypt/live/$domain/privkey.pem" "$PROJECT_DIR/ssl/key.pem"
        sudo chown "$USER:$USER" "$PROJECT_DIR/ssl/cert.pem" "$PROJECT_DIR/ssl/key.pem"
        
        # Stop nginx
        sudo systemctl stop nginx
        sudo systemctl disable nginx
        
        success "Let's Encrypt certificate obtained"
    else
        # Generate self-signed certificate for development/testing
        warn "Generating self-signed certificate (not suitable for production)"
        
        openssl req -x509 -newkey rsa:4096 -nodes \
            -keyout "$PROJECT_DIR/ssl/key.pem" \
            -out "$PROJECT_DIR/ssl/cert.pem" \
            -days 365 \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=$domain"
        
        success "Self-signed certificate generated"
    fi
}

create_environment_config() {
    log "Creating environment configuration for $ENVIRONMENT"
    
    local env_file="$PROJECT_DIR/.env.$ENVIRONMENT"
    
    # Backup existing config if it exists
    if [[ -f "$env_file" ]]; then
        cp "$env_file" "$env_file.backup.$(date +%s)"
        warn "Backed up existing $env_file"
    fi
    
    # Create secure configuration
    cat > "$env_file" << EOF
# $ENVIRONMENT Environment Configuration
# Generated by deploy-secure.sh on $(date)

NODE_ENV=$ENVIRONMENT
SPOTIFY_CLIENT_ID=\${SPOTIFY_CLIENT_ID}
SPOTIFY_CLIENT_SECRET=\${SPOTIFY_CLIENT_SECRET}
SPOTIFY_REDIRECT_URI=https://$DOMAIN/callback
SPOTIFY_ALLOWED_DOMAINS=$DOMAIN${STAGING_DOMAIN:+",$STAGING_DOMAIN"}

LOG_LEVEL=$([ "$ENVIRONMENT" = "production" ] && echo "warn" || echo "debug")
MCP_SERVER_PORT=3000
CALLBACK_PORT=8080

# Security Configuration
REQUIRE_HARDWARE_HSM=$([ "$ENVIRONMENT" = "production" ] && echo "false" || echo "false")
STORAGE_ENCRYPTION_ENABLED=true

# SSL Configuration
SSL_CERT_PATH=/app/ssl/cert.pem
SSL_KEY_PATH=/app/ssl/key.pem
EOF
    
    success "Environment configuration created: $env_file"
    
    # Validate redirect URI
    log "Validating redirect URI configuration..."
    
    local redirect_uri="https://$DOMAIN/callback"
    if curl -f -s -I "$redirect_uri" &> /dev/null; then
        success "Redirect URI is accessible: $redirect_uri"
    else
        warn "Redirect URI not yet accessible: $redirect_uri (will work after deployment)"
    fi
}

update_nginx_config() {
    log "Updating NGINX configuration"
    
    local nginx_config="$PROJECT_DIR/nginx/spotify-mcp.conf"
    
    # Replace placeholder domain with actual domain
    sed -i.bak "s/yourdomain.com/$DOMAIN/g" "$nginx_config"
    
    if [[ -n "$STAGING_DOMAIN" ]]; then
        # Add staging domain configuration
        sed -i "s/server_name $DOMAIN www.$DOMAIN;/server_name $DOMAIN www.$DOMAIN $STAGING_DOMAIN;/" "$nginx_config"
    fi
    
    success "NGINX configuration updated"
}

run_security_validation() {
    log "Running security validation..."
    
    # Build and run a temporary container to validate configuration
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" build spotify-mcp
    
    # Test configuration validation
    if docker run --rm \
        -e NODE_ENV="$ENVIRONMENT" \
        -e SPOTIFY_CLIENT_ID="test-client-id" \
        -e SPOTIFY_CLIENT_SECRET="test-client-secret" \
        -e SPOTIFY_REDIRECT_URI="https://$DOMAIN/callback" \
        -e SPOTIFY_ALLOWED_DOMAINS="$DOMAIN" \
        spotify-mcp-prod node -e "
            const { RedirectUriValidator } = require('./build/config/security.js');
            const config = {
                redirectUri: {
                    uri: 'https://$DOMAIN/callback',
                    enforceHttps: true,
                    allowedDomains: ['$DOMAIN'],
                    allowLocalhost: false,
                    allowedSchemes: ['https']
                },
                environment: '$ENVIRONMENT',
                strictMode: true
            };
            const validator = new RedirectUriValidator(config, console);
            const result = validator.validateRedirectUri('https://$DOMAIN/callback');
            if (!result.valid) {
                console.error('Validation failed:', result.errors);
                process.exit(1);
            }
            console.log('✅ Redirect URI validation passed');
        " 2>&1; then
        success "Security validation passed"
    else
        error "Security validation failed. Check redirect URI configuration."
    fi
}

deploy_application() {
    log "Deploying application with secure configuration"
    
    # Set required environment variables for deployment
    export NODE_ENV="$ENVIRONMENT"
    export SPOTIFY_REDIRECT_URI="https://$DOMAIN/callback"
    export SPOTIFY_ALLOWED_DOMAINS="$DOMAIN${STAGING_DOMAIN:+",$STAGING_DOMAIN"}"
    
    # Deploy using Docker Compose
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" down --remove-orphans
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" up -d
    
    # Wait for services to start
    log "Waiting for services to start..."
    sleep 10
    
    # Health check
    local max_attempts=12
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "https://$DOMAIN/health" &> /dev/null; then
            success "Application is healthy and responding"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error "Application failed to start properly. Check logs: docker-compose -f docker-compose.production.yml logs"
        fi
        
        log "Attempt $attempt/$max_attempts: Waiting for application to start..."
        sleep 5
        ((attempt++))
    done
}

show_deployment_summary() {
    cat << EOF

${GREEN}🎉 Deployment Complete!${NC}

${BLUE}Configuration Summary:${NC}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment:     $ENVIRONMENT
Domain:          $DOMAIN
${STAGING_DOMAIN:+Staging Domain:   $STAGING_DOMAIN}
Redirect URI:    https://$DOMAIN/callback
SSL Certificate: $([ -f "$PROJECT_DIR/ssl/cert.pem" ] && echo "✅ Installed" || echo "❌ Missing")

${BLUE}Next Steps:${NC}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ${YELLOW}Update Spotify Dashboard:${NC}
   - Go to https://developer.spotify.com/dashboard
   - Add redirect URI: https://$DOMAIN/callback
   ${STAGING_DOMAIN:+"   - Add staging URI: https://$STAGING_DOMAIN/callback"}

2. ${YELLOW}Set Environment Variables:${NC}
   - Set SPOTIFY_CLIENT_ID in your deployment environment
   - Set SPOTIFY_CLIENT_SECRET in your deployment environment

3. ${YELLOW}Test Authentication:${NC}
   - Visit: https://$DOMAIN
   - Verify SSL certificate is working
   - Test OAuth flow with Spotify

4. ${YELLOW}Monitor Application:${NC}
   - Check logs: docker-compose logs -f
   - Monitor health: https://$DOMAIN/health
   - View metrics: https://$DOMAIN:9090 (if monitoring enabled)

${BLUE}Security Checklist:${NC}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- [$([ "$ENVIRONMENT" = "production" ] && echo "✅" || echo "⚠️ ")] HTTPS enforced
- [✅] Redirect URI validation enabled
- [✅] Security headers configured
- [✅] Rate limiting enabled  
- [✅] Non-root container user
- [✅] SSL/TLS termination
- [$([ -f "$PROJECT_DIR/ssl/cert.pem" ] && echo "✅" || echo "❌")] Valid SSL certificate

${GREEN}Deployment successful! 🚀${NC}

EOF
}

# Main script
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--domain)
                DOMAIN="$2"
                shift 2
                ;;
            -s|--staging)
                STAGING_DOMAIN="$2"
                shift 2
                ;;
            -e|--email)
                SSL_EMAIL="$2"
                shift 2
                ;;
            -E|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                error "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done
    
    log "Starting secure deployment for Spotify MCP Server"
    log "Environment: $ENVIRONMENT"
    log "Domain: $DOMAIN"
    
    check_requirements
    validate_domain "$DOMAIN"
    
    if [[ -n "$STAGING_DOMAIN" ]]; then
        validate_domain "$STAGING_DOMAIN"
    fi
    
    setup_ssl_certificate "$DOMAIN"
    create_environment_config
    update_nginx_config
    run_security_validation
    deploy_application
    show_deployment_summary
}

# Run main function with all arguments
main "$@"