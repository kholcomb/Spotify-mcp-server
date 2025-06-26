# Branch Protection Setup Guide

This guide explains how to set up branch protection rules for the Spotify MCP Server repository to enforce the branching strategy.

## GitHub Repository Setup

### 1. Create Repository
```bash
# If you haven't created a GitHub repository yet:
# 1. Go to https://github.com/new
# 2. Create repository (public or private)
# 3. Don't initialize with README (we already have one)
```

### 2. Add Remote Origin
```bash
# Replace with your actual repository URL
git remote add origin https://github.com/yourusername/spotify-mcp-server.git

# Push main branch
git push -u origin main

# Push develop branch
git checkout develop
git push -u origin develop
git checkout main
```

## Branch Protection Rules

### Main Branch Protection

Navigate to your GitHub repository → Settings → Branches → Add rule

**Branch name pattern:** `main`

**Protection settings:**
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: `1`
  - ✅ Dismiss stale PR approvals when new commits are pushed
  - ✅ Require review from code owners (if CODEOWNERS file exists)
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Required status checks:
    - `CI / build`
    - `CI / test`
    - `CI / security-scan`
    - `CI / lint`
- ✅ **Require conversation resolution before merging**
- ✅ **Restrict pushes that create files**
- ✅ **Include administrators** (enforces rules for admin users)
- ✅ **Allow force pushes: NO**
- ✅ **Allow deletions: NO**

### Develop Branch Protection

**Branch name pattern:** `develop`

**Protection settings:**
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: `1`
  - ✅ Dismiss stale PR approvals when new commits are pushed
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Required status checks:
    - `CI / build`
    - `CI / test`
    - `CI / lint`
- ✅ **Require conversation resolution before merging**
- ❌ **Include administrators** (allows admin override for develop)
- ✅ **Allow force pushes: NO**
- ✅ **Allow deletions: NO**

## Branch Protection via GitHub CLI

If you have GitHub CLI installed, you can set up protection rules automatically:

```bash
# Install GitHub CLI first: https://cli.github.com/

# Authenticate
gh auth login

# Protect main branch
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["CI / build","CI / test","CI / security-scan","CI / lint"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false

# Protect develop branch  
gh api repos/:owner/:repo/branches/develop/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["CI / build","CI / test","CI / lint"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

## Repository Settings

### General Settings
- **Default branch**: `main`
- **Allow merge commits**: ✅ (for release merges)
- **Allow squash merging**: ✅ (recommended for features)
- **Allow rebase merging**: ✅ (for clean history)
- **Automatically delete head branches**: ✅

### Security Settings
- **Dependency graph**: ✅ Enabled
- **Dependabot alerts**: ✅ Enabled  
- **Dependabot security updates**: ✅ Enabled
- **Secret scanning**: ✅ Enabled (if available)
- **Code scanning**: ✅ Enable CodeQL

## CODEOWNERS File

Create `.github/CODEOWNERS` to require specific reviewers:

```bash
# Create CODEOWNERS file
cat > .github/CODEOWNERS << 'EOF'
# Global code owners
* @yourusername

# Security-related files require security review
src/auth/ @yourusername @security-team
src/security/ @yourusername @security-team
src/config/security.ts @yourusername @security-team

# Documentation requires documentation review
docs/ @yourusername @docs-team
*.md @yourusername @docs-team

# Configuration files require ops review
Dockerfile @yourusername @ops-team
docker-compose*.yml @yourusername @ops-team
.github/workflows/ @yourusername @ops-team
nginx/ @yourusername @ops-team

# Package files require dependency review
package.json @yourusername
package-lock.json @yourusername
EOF
```

## PR Templates

Create `.github/pull_request_template.md`:

```markdown
## Summary
Brief description of the changes

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔒 Security fix
- [ ] 🎨 Code style/formatting
- [ ] ♻️ Refactoring
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test addition/update

## Testing
- [ ] Unit tests pass locally
- [ ] Integration tests pass locally
- [ ] Manual testing completed
- [ ] New tests added for new functionality

## Security Review
- [ ] No sensitive data exposed in code
- [ ] Authentication/authorization changes reviewed
- [ ] Input validation implemented where needed
- [ ] Error handling doesn't leak sensitive information
- [ ] Dependencies reviewed for vulnerabilities

## Documentation
- [ ] Code comments updated
- [ ] README updated (if needed)
- [ ] API documentation updated (if needed)
- [ ] CHANGELOG.md updated

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings
- [ ] Any dependent changes have been merged and published

## Related Issues
Closes #(issue_number)
```

## Issue Templates

Create `.github/ISSUE_TEMPLATE/`:

### Bug Report Template
```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
name: 🐛 Bug Report
description: File a bug report
title: "[Bug]: "
labels: ["bug", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report!
  
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: A clear description of the bug
      placeholder: Tell us what happened!
    validations:
      required: true
      
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
      description: What should have happened?
    validations:
      required: true
      
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: How can we reproduce this?
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. See error
    validations:
      required: true
      
  - type: input
    id: version
    attributes:
      label: Version
      description: What version are you running?
    validations:
      required: true
```

### Feature Request Template  
```yaml
# .github/ISSUE_TEMPLATE/feature_request.yml
name: ✨ Feature Request
description: Suggest an idea for this project
title: "[Feature]: "
labels: ["enhancement", "needs-triage"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Is your feature request related to a problem?
      description: A clear description of the problem
    validations:
      required: true
      
  - type: textarea
    id: solution
    attributes:
      label: Describe the solution you'd like
      description: A clear description of what you want to happen
    validations:
      required: true
      
  - type: textarea
    id: alternatives
    attributes:
      label: Describe alternatives you've considered
      description: Alternative solutions or features you've considered
      
  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Any other context about the feature request
```

## Enforcement Commands

Once set up, use these commands for development:

```bash
# Start new feature (from develop)
git checkout develop
git pull origin develop
git checkout -b feature/my-new-feature

# Create pull request (feature → develop)
gh pr create --title "feat: add my new feature" --body "Description" --base develop

# Create release (develop → main)
git checkout develop
git checkout -b release/v1.1.0
# ... prepare release
gh pr create --title "release: v1.1.0" --body "Release notes" --base main

# Emergency hotfix (main → main)
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix
# ... fix issue
gh pr create --title "fix: critical security issue" --body "Details" --base main
```

## Verification

After setup, verify protection is working:

1. **Try direct push to main** (should be blocked):
```bash
git checkout main
echo "test" > test.txt
git add test.txt
git commit -m "test commit"
git push origin main  # Should fail
```

2. **Create PR and verify checks** are required before merge

3. **Verify branch protection** in GitHub UI under Settings → Branches

Your repository is now protected with proper branching strategy enforcement! 🛡️