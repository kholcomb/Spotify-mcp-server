# Redirect URI Security Guide

This guide explains how to configure secure redirect URIs for the Spotify MCP Server according to Spotify's security requirements and best practices.

## Overview

Spotify requires secure redirect URIs to prevent authorization code interception attacks. This document covers:

- ✅ **Security Requirements**: What Spotify mandates
- 🛠️ **Configuration Options**: How to set up secure URIs
- 🌍 **Environment-Specific Setup**: Development vs. Production
- 🔍 **Validation & Troubleshooting**: Common issues and solutions

## Security Requirements

### Production Requirements (Mandatory)

1. **HTTPS Only**: All production redirect URIs MUST use HTTPS
2. **Valid Domain**: Use a registered domain name (no IP addresses)
3. **Exact Match**: URI must exactly match what's registered in Spotify Dashboard
4. **No Query Parameters**: Avoid query parameters in redirect URIs

### Development Exceptions

- HTTP is allowed for `localhost` and `127.0.0.1` only
- Custom ports are permitted for local development

## Configuration

### Environment Variables

```bash
# Development
NODE_ENV=development
SPOTIFY_REDIRECT_URI=http://localhost:8080/callback

# Staging
NODE_ENV=staging
SPOTIFY_REDIRECT_URI=https://staging.yourdomain.com/callback

# Production
NODE_ENV=production
SPOTIFY_REDIRECT_URI=https://yourdomain.com/callback
```

### Programmatic Configuration

```typescript
import { AuthManager } from './src/auth/authManager.js';
import { RedirectUriValidator } from './src/config/security.js';

// Development configuration
const devConfig = {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'http://localhost:8080/callback',
  allowedDomains: ['localhost', '127.0.0.1']
};

// Production configuration
const prodConfig = {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://yourdomain.com/callback',
  allowedDomains: ['yourdomain.com']
};
```

## Spotify Dashboard Setup

### 1. Register Your Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application or edit existing one
3. Add redirect URIs in the "Redirect URIs" section

### 2. Redirect URI Examples

#### ✅ Valid Production URIs
```
https://yourdomain.com/callback
https://api.yourdomain.com/auth/callback
https://app.yourdomain.com/oauth/callback
```

#### ✅ Valid Development URIs
```
http://localhost:8080/callback
http://127.0.0.1:3000/callback
https://localhost:8443/callback
```

#### ❌ Invalid URIs
```
http://yourdomain.com/callback          # HTTP in production
https://192.168.1.100/callback          # IP address
https://yourdomain.com/callback?param=1 # Query parameters
```

## Environment-Specific Setup

### Development Environment

```bash
# .env.development
NODE_ENV=development
SPOTIFY_CLIENT_ID=your-dev-client-id
SPOTIFY_CLIENT_SECRET=your-dev-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:8080/callback
MCP_SERVER_PORT=3000
```

**Features:**
- HTTP allowed for localhost
- Relaxed validation
- Detailed security warnings in logs

### Staging Environment

```bash
# .env.staging
NODE_ENV=staging
SPOTIFY_CLIENT_ID=your-staging-client-id
SPOTIFY_CLIENT_SECRET=your-staging-client-secret
SPOTIFY_REDIRECT_URI=https://staging.yourdomain.com/callback
MCP_SERVER_PORT=3000
```

**Features:**
- HTTPS recommended but not enforced
- Domain validation enabled
- Security warnings logged

### Production Environment

```bash
# .env.production
NODE_ENV=production
SPOTIFY_CLIENT_ID=your-prod-client-id
SPOTIFY_CLIENT_SECRET=your-prod-client-secret
SPOTIFY_REDIRECT_URI=https://yourdomain.com/callback
MCP_SERVER_PORT=3000
```

**Features:**
- HTTPS strictly enforced
- Comprehensive security validation
- Failed validation blocks server startup

## Common Deployment Scenarios

### 1. Local Development

```typescript
const config = {
  clientId: process.env.SPOTIFY_CLIENT_ID!,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
  redirectUri: 'http://localhost:8080/callback'
};
```

**Spotify Dashboard URI**: `http://localhost:8080/callback`

### 2. Docker Development

```dockerfile
# docker-compose.yml
services:
  spotify-mcp:
    environment:
      - SPOTIFY_REDIRECT_URI=http://localhost:8080/callback
    ports:
      - "8080:8080"
```

**Spotify Dashboard URI**: `http://localhost:8080/callback`

### 3. Cloud Deployment (AWS/GCP/Azure)

```typescript
const config = {
  redirectUri: 'https://your-app.herokuapp.com/callback'
  // or
  redirectUri: 'https://your-subdomain.vercel.app/callback'
  // or
  redirectUri: 'https://your-custom-domain.com/callback'
};
```

**Spotify Dashboard URI**: `https://your-domain.com/callback`

### 4. Custom Domain with SSL

```typescript
const config = {
  redirectUri: 'https://api.mycompany.com/spotify/callback',
  allowedDomains: ['mycompany.com']
};
```

**Spotify Dashboard URI**: `https://api.mycompany.com/spotify/callback`

## SSL/TLS Configuration

### 1. Using Reverse Proxy (Recommended)

```nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location /callback {
        proxy_pass http://localhost:3000/callback;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. Direct HTTPS with Express

```typescript
import https from 'https';
import fs from 'fs';
import express from 'express';

const app = express();

const options = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem')
};

https.createServer(options, app).listen(443, () => {
  console.log('HTTPS Server running on port 443');
});
```

## Validation and Troubleshooting

### Automatic Validation

The server automatically validates redirect URIs on startup:

```typescript
// This happens automatically in AuthManager constructor
private validateRedirectUriSecurity(): void {
  const validation = this.redirectUriValidator.validateRedirectUri(this.redirectUri);
  
  if (!validation.valid) {
    throw new AuthError(`Insecure redirect URI: ${validation.errors.join(', ')}`);
  }
}
```

### Manual Validation

```typescript
import { RedirectUriValidator } from './src/config/security.js';

const validator = new RedirectUriValidator(securityConfig, logger);
const result = validator.validateRedirectUri('https://yourdomain.com/callback');

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
if (result.warnings.length > 0) {
  console.warn('Security warnings:', result.warnings);
}
```

### Common Issues

#### 1. "Redirect URI not secure" Error

**Problem**: Using HTTP in production
```
Error: Insecure redirect URI configuration: HTTPS is required for production redirect URIs
```

**Solution**: Use HTTPS redirect URI
```typescript
// ❌ Wrong
redirectUri: 'http://yourdomain.com/callback'

// ✅ Correct
redirectUri: 'https://yourdomain.com/callback'
```

#### 2. "Domain not allowed" Error

**Problem**: Domain not in whitelist
```
Error: Domain 'newdomain.com' is not in allowed domains list
```

**Solution**: Add domain to allowed list
```typescript
const config = {
  redirectUri: 'https://newdomain.com/callback',
  allowedDomains: ['newdomain.com', 'yourdomain.com']
};
```

#### 3. "Invalid redirect_uri" from Spotify

**Problem**: URI doesn't match Spotify Dashboard exactly

**Solution**: Ensure exact match including:
- Protocol (http/https)
- Domain/subdomain
- Port (if non-standard)
- Path
- No trailing slash differences

#### 4. CSRF/State Parameter Issues

**Problem**: State parameter validation failing

**Solution**: Ensure state parameter is properly handled:
```typescript
// The server handles this automatically, but ensure:
// 1. Callback server is running on correct port
// 2. No firewall blocking the callback
// 3. Browser can reach the callback URL
```

## Security Best Practices

### 1. Environment Separation

- **Never** use production credentials in development
- Use different Spotify apps for different environments
- Rotate credentials regularly

### 2. Domain Control

- Own and control your redirect URI domain
- Use HTTPS certificates from trusted CAs
- Monitor certificate expiration

### 3. Network Security

```typescript
const secureConfig = {
  redirectUri: 'https://yourdomain.com/callback',
  allowedDomains: ['yourdomain.com'], // Restrict to your domains only
  // Additional security measures in production
};
```

### 4. Monitoring and Logging

The server logs all redirect URI validation:

```json
{
  "level": "info",
  "message": "Redirect URI validation passed",
  "uri": "https://yourdomain.com/callback",
  "warnings": 0,
  "environment": "production"
}
```

Monitor these logs for:
- Validation failures
- Security warnings
- Suspicious redirect attempts

## Testing

### 1. Development Testing

```bash
# Test local callback server
curl -X GET "http://localhost:8080/callback?code=test&state=test"
```

### 2. Production Testing

```bash
# Test HTTPS callback (should work)
curl -X GET "https://yourdomain.com/callback"

# Test HTTP callback (should redirect to HTTPS or fail)
curl -X GET "http://yourdomain.com/callback"
```

### 3. Validation Testing

```typescript
import { RedirectUriValidator } from './src/config/security.js';

// Test various URIs
const testUris = [
  'http://localhost:8080/callback',     // Valid in dev
  'https://yourdomain.com/callback',    // Valid in prod
  'http://yourdomain.com/callback',     // Invalid in prod
  'https://127.0.0.1/callback'          // Invalid (IP address)
];

testUris.forEach(uri => {
  const result = validator.validateRedirectUri(uri);
  console.log(`${uri}: ${result.valid ? 'VALID' : 'INVALID'}`);
});
```

## Migration Guide

### From Insecure to Secure Setup

1. **Update Spotify Dashboard**
   - Add new HTTPS redirect URI
   - Keep old HTTP URI temporarily

2. **Update Environment Variables**
   ```bash
   # Before
   SPOTIFY_REDIRECT_URI=http://yourdomain.com/callback
   
   # After
   SPOTIFY_REDIRECT_URI=https://yourdomain.com/callback
   ```

3. **Configure HTTPS**
   - Set up SSL certificate
   - Configure reverse proxy or direct HTTPS

4. **Test New Setup**
   - Verify authentication flow works
   - Check logs for validation warnings

5. **Remove Old URI**
   - Remove HTTP URI from Spotify Dashboard
   - Deploy final configuration

### Checklist

- [ ] HTTPS certificate installed and valid
- [ ] Redirect URI updated in Spotify Dashboard  
- [ ] Environment variables updated
- [ ] DNS pointing to correct server
- [ ] Firewall allows HTTPS traffic (port 443)
- [ ] Authentication flow tested end-to-end
- [ ] Security validation passes
- [ ] Monitoring configured for redirect URI logs

## Support

If you encounter issues:

1. Check server logs for validation errors
2. Verify Spotify Dashboard configuration
3. Test with curl or browser developer tools
4. Ensure firewall/network connectivity
5. Check SSL certificate validity

For additional help, see the main README.md or open an issue in the project repository.