# .gitignore Guidelines

This document explains the `.gitignore` configuration for the Spotify MCP Server project and provides guidelines for developers on what should and shouldn't be committed to version control.

## 🛡️ Security-First Approach

Our `.gitignore` follows a **security-first approach** to prevent sensitive data from being accidentally committed to the repository.

## 🚫 Files That Must NEVER Be Committed

### **Environment and Configuration Files**
```
.env
.env.local
.env.development
.env.staging
.env.production
.env.test
config.json
config-*.json
```
**Why**: These files contain API keys, secrets, database URLs, and environment-specific configuration that should never be public.

### **Authentication and Security Files**
```
*.token
*.key
*.pem
*.crt
*.p12
*.pfx
.spotify-mcp/
auth-tokens/
certificates/
ssl/
security-keys/
hsm-data/
```
**Why**: These contain authentication tokens, private keys, and certificates that would compromise security if exposed.

### **Production Deployment Files**
```
production-config/
staging-config/
deployment-secrets/
.secrets/
docker-secrets/
k8s-secrets/
```
**Why**: Production configurations often contain sensitive deployment information, database credentials, and infrastructure details.

### **Personal and Local Development Files**
```
.vscode/ (except specific settings)
.idea/
*.swp
*.swo
.DS_Store
local-*/
dev-scripts/
```
**Why**: These are developer-specific and shouldn't affect other team members.

## ✅ Files That Should Be Committed

### **Configuration Templates**
```
.env.example
.env.production.example
.env.staging.example
```
**Why**: These provide templates for other developers to set up their environment without exposing actual secrets.

### **Source Code and Documentation**
```
src/
docs/
tests/
README.md
package.json
tsconfig.json
```
**Why**: These are the core project files that all developers need.

### **Build and Deployment Configuration**
```
Dockerfile
docker-compose.yml
docker-compose.production.yml
.github/workflows/
nginx/
```
**Why**: These define how the application is built and deployed (without secrets).

## 🔍 Validation Tools

### **Automatic Validation**
We provide a validation script to check your `.gitignore` configuration:

```bash
# Run gitignore validation
npm run validate:gitignore

# Run before commits
npm run precommit
```

### **Manual Checks**
```bash
# Check if a file would be ignored
git check-ignore filename

# See what files git is tracking
git ls-files

# Find potentially sensitive files
git ls-files | grep -E "\.(env|key|pem|token)$"
```

## 🚨 Common Mistakes to Avoid

### **1. Committing .env Files**
```bash
# ❌ WRONG - This exposes your API keys
git add .env
git commit -m "add configuration"

# ✅ CORRECT - Use the example template
cp .env .env.example
# Remove sensitive values from .env.example
git add .env.example
```

### **2. Committing Certificates**
```bash
# ❌ WRONG - Private keys should never be public
git add ssl/private.key

# ✅ CORRECT - Use secure deployment methods
# Store certificates in secure deployment tools
# Document certificate requirements in README
```

### **3. Committing Log Files**
```bash
# ❌ WRONG - Logs may contain sensitive information
git add logs/app.log

# ✅ CORRECT - Logs are automatically ignored
# Use centralized logging in production
```

### **4. Committing Build Artifacts**
```bash
# ❌ WRONG - Build files should be generated
git add build/index.js
git add node_modules/

# ✅ CORRECT - Let CI/CD build from source
npm run build  # Generates build/ locally
# build/ is ignored and generated on deployment
```

## 📋 Environment File Guidelines

### **.env File Structure**
```bash
# Development environment
NODE_ENV=development

# Spotify API credentials (get from https://developer.spotify.com)
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:8080/callback

# Optional configuration
LOG_LEVEL=debug
CALLBACK_PORT=8080
```

### **Never Commit These Values**
- ❌ Actual Spotify Client ID/Secret
- ❌ Database passwords or connection strings
- ❌ API keys or tokens
- ❌ Private encryption keys
- ❌ Production URLs or endpoints

### **Safe to Commit in Examples**
- ✅ Placeholder values (`your_client_id_here`)
- ✅ Default development ports (`8080`)
- ✅ Public configuration options
- ✅ Documentation about required variables

## 🔧 IDE Configuration

### **VS Code Settings**
We allow certain VS Code settings to be shared:
```
!.vscode/settings.json    # Shared project settings
!.vscode/tasks.json       # Build tasks
!.vscode/launch.json      # Debug configuration
!.vscode/extensions.json  # Recommended extensions
```

But exclude personal settings:
```
.vscode/settings.json.user  # Personal settings
.vscode/*.log               # Debug logs
```

## 🚀 Deployment Considerations

### **Production Secrets Management**
```bash
# ❌ WRONG - Secrets in code
SPOTIFY_CLIENT_SECRET=abc123

# ✅ CORRECT - Use environment injection
SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}

# ✅ CORRECT - Use secret management
# AWS Secrets Manager, Azure Key Vault, etc.
```

### **Docker Secrets**
```dockerfile
# ❌ WRONG - Secrets in Dockerfile
ENV SPOTIFY_CLIENT_SECRET=abc123

# ✅ CORRECT - Runtime secrets
ENV SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
```

## 📊 Security Checklist

Before committing, always verify:

- [ ] **No `.env` files** with real values
- [ ] **No private keys** or certificates  
- [ ] **No authentication tokens** or sessions
- [ ] **No database files** with real data
- [ ] **No log files** that might contain secrets
- [ ] **No API keys** in source code
- [ ] **No production configurations** with real endpoints
- [ ] **No personal development files**

## 🛠️ Git Hooks for Safety

### **Pre-commit Hook**
Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Validate gitignore before commit
npm run validate:gitignore
```

### **Pre-push Hook**
Create `.git/hooks/pre-push`:
```bash
#!/bin/bash
# Security check before push
npm run security:check
```

## 🚨 Emergency: Accidentally Committed Secrets

If you accidentally commit sensitive data:

### **1. Immediate Action**
```bash
# Remove from latest commit (if not pushed)
git reset --soft HEAD~1
git reset HEAD .env  # unstage the sensitive file
```

### **2. If Already Pushed**
```bash
# Rewrite history (DANGEROUS - coordinate with team)
git filter-branch --index-filter 'git rm --cached --ignore-unmatch .env' HEAD

# Or create new commit removing the file
git rm .env
git commit -m "remove accidentally committed env file"
```

### **3. Security Response**
1. **Rotate all compromised secrets immediately**
2. **Check access logs** for unauthorized usage
3. **Update authentication credentials**
4. **Notify team and security personnel**
5. **Review commit history** for other potential leaks

## 📚 References

- [Git Ignore Patterns](https://git-scm.com/docs/gitignore)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [Secrets Management Guide](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Spotify API Security](https://developer.spotify.com/documentation/general/guides/app-settings/)

---

**Remember**: When in doubt, don't commit it. It's better to exclude a file unnecessarily than to accidentally expose sensitive information. 🔒