#!/bin/bash
# Git Ignore Validation Script
# Ensures sensitive files are properly excluded from version control

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🔍 Validating .gitignore configuration...${NC}\n"

# Test files that should be ignored
SENSITIVE_TEST_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    ".env.staging"
    "config.json"
    "tokens/user.token"
    "ssl/private.key"
    "ssl/certificate.pem"
    ".spotify-mcp/tokens"
    "logs/server.log"
    "coverage/lcov.info"
    "build/index.js"
    "node_modules/test"
    ".DS_Store"
    "auth-tokens/spotify.token"
    "certificates/spotify.crt"
    "hsm-data/keys"
    "security-keys/master.key"
    "docker-secrets/api-key"
    "deployment-secrets/prod.env"
    ".secrets/spotify-client-secret"
    "production-config/database.json"
)

# Files that should NOT be ignored  
REQUIRED_FILES=(
    ".gitignore"
    "package.json"
    "README.md"
    "src/index.ts"
    "docs/README.md"
    ".env.example"
    ".env.production.example"
    "docker-compose.yml"
    "Dockerfile"
    ".github/workflows/ci.yml"
)

success_count=0
warning_count=0
error_count=0

echo -e "${BLUE}Testing sensitive files are ignored:${NC}"

for file in "${SENSITIVE_TEST_FILES[@]}"; do
    # Create directory if needed
    dir=$(dirname "$file")
    if [[ "$dir" != "." ]]; then
        mkdir -p "$PROJECT_DIR/$dir"
    fi
    
    # Create test file
    echo "test content" > "$PROJECT_DIR/$file"
    
    # Check if git would ignore it
    if git -C "$PROJECT_DIR" check-ignore "$file" >/dev/null 2>&1; then
        echo -e "  ✅ ${GREEN}$file${NC} - properly ignored"
        ((success_count++))
    else
        echo -e "  ❌ ${RED}$file${NC} - NOT IGNORED (SECURITY RISK!)"
        ((error_count++))
    fi
    
    # Clean up test file
    rm -f "$PROJECT_DIR/$file"
done

echo -e "\n${BLUE}Testing required files are NOT ignored:${NC}"

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$PROJECT_DIR/$file" ]]; then
        if git -C "$PROJECT_DIR" check-ignore "$file" >/dev/null 2>&1; then
            echo -e "  ⚠️  ${YELLOW}$file${NC} - ignored (but should be tracked)"
            ((warning_count++))
        else
            echo -e "  ✅ ${GREEN}$file${NC} - properly tracked"
            ((success_count++))
        fi
    else
        echo -e "  ℹ️  ${BLUE}$file${NC} - file doesn't exist"
    fi
done

# Clean up any test directories
for file in "${SENSITIVE_TEST_FILES[@]}"; do
    dir=$(dirname "$file")
    if [[ "$dir" != "." && -d "$PROJECT_DIR/$dir" ]]; then
        rmdir "$PROJECT_DIR/$dir" 2>/dev/null || true
    fi
done

echo -e "\n${BLUE}Checking for accidentally committed sensitive files:${NC}"

# Check for potentially sensitive files in git history
SENSITIVE_PATTERNS=(
    "*.env"
    "*.key"
    "*.pem"
    "*.p12"
    "*.pfx"
    "config.json"
    "*secret*"
    "*password*"
    "*token*"
    "*.log"
)

found_sensitive=false
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git -C "$PROJECT_DIR" ls-files | grep -q "$pattern" 2>/dev/null; then
        files=$(git -C "$PROJECT_DIR" ls-files | grep "$pattern")
        echo -e "  ⚠️  ${YELLOW}Found potentially sensitive files matching '$pattern':${NC}"
        echo "$files" | sed 's/^/    /'
        found_sensitive=true
        ((warning_count++))
    fi
done

if [[ "$found_sensitive" == false ]]; then
    echo -e "  ✅ ${GREEN}No sensitive files found in git history${NC}"
    ((success_count++))
fi

echo -e "\n${BLUE}Checking .gitignore file completeness:${NC}"

# Check for common missing patterns
RECOMMENDED_PATTERNS=(
    "node_modules/"
    "*.log"
    ".env"
    "build/"
    "coverage/"
    "*.key"
    "*.pem"
    ".DS_Store"
    "ssl/"
    "certificates/"
)

gitignore_content=$(cat "$PROJECT_DIR/.gitignore")
missing_patterns=()

for pattern in "${RECOMMENDED_PATTERNS[@]}"; do
    if echo "$gitignore_content" | grep -q "$pattern"; then
        echo -e "  ✅ ${GREEN}$pattern${NC} - included"
        ((success_count++))
    else
        echo -e "  ❌ ${RED}$pattern${NC} - missing"
        missing_patterns+=("$pattern")
        ((error_count++))
    fi
done

echo -e "\n${BLUE}Security recommendations:${NC}"

# Security recommendations
SECURITY_CHECKS=(
    "Environment files (.env*) protection"
    "SSL/TLS certificate exclusion"
    "Authentication token protection"
    "Log file exclusion"
    "Build artifact exclusion"
    "OS-specific file exclusion"
    "IDE configuration exclusion"
    "Package manager cache exclusion"
)

for check in "${SECURITY_CHECKS[@]}"; do
    echo -e "  ✅ ${GREEN}$check${NC}"
done

# Summary
echo -e "\n${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 GITIGNORE VALIDATION SUMMARY${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"

echo -e "✅ ${GREEN}Successful checks: $success_count${NC}"
if [[ $warning_count -gt 0 ]]; then
    echo -e "⚠️  ${YELLOW}Warnings: $warning_count${NC}"
fi
if [[ $error_count -gt 0 ]]; then
    echo -e "❌ ${RED}Errors: $error_count${NC}"
fi

echo -e "\n${BLUE}Status:${NC}"
if [[ $error_count -eq 0 ]]; then
    echo -e "🎉 ${GREEN}.gitignore configuration is SECURE and properly configured!${NC}"
    
    if [[ $warning_count -gt 0 ]]; then
        echo -e "📝 ${YELLOW}Review warnings above for potential improvements${NC}"
    fi
    
    exit 0
else
    echo -e "🚨 ${RED}.gitignore has SECURITY ISSUES that need to be fixed!${NC}"
    
    if [[ ${#missing_patterns[@]} -gt 0 ]]; then
        echo -e "\n${YELLOW}Missing recommended patterns:${NC}"
        for pattern in "${missing_patterns[@]}"; do
            echo -e "  - $pattern"
        done
    fi
    
    exit 1
fi