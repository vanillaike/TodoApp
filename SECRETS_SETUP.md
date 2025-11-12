# Secrets Setup Guide

This guide explains how to properly configure secrets for the Todo API, particularly the JWT_SECRET used for authentication token signing.

## Overview

The JWT_SECRET is a critical security credential that must be:
- Cryptographically strong (minimum 32 bytes)
- Never committed to version control
- Different between local development and production
- Stored securely using Cloudflare's secret management in production

## Local Development Setup

### 1. Create the .dev.vars file

The `.dev.vars` file stores secrets for local development. This file is automatically loaded by Wrangler and is already excluded from git.

Create a `.dev.vars` file in the project root:

```bash
# Generate a strong random secret and save it to .dev.vars
echo "JWT_SECRET=$(openssl rand -base64 32)" > .dev.vars
```

Or manually create the file with this content:

```
JWT_SECRET=your-strong-secret-here-at-least-32-characters
```

### 2. Generate a Strong Secret

Use one of these methods to generate a cryptographically strong secret:

```bash
# Using OpenSSL (recommended)
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Verify Local Setup

After creating `.dev.vars`:

```bash
# Start the local development server
npm run dev

# The JWT_SECRET from .dev.vars will be automatically loaded
```

## Production Deployment

### Setting Production Secrets

For production, secrets must be set using Wrangler's secret management. These are encrypted and never stored in your codebase.

```bash
# Generate a NEW strong secret for production (don't reuse the dev secret)
openssl rand -base64 32

# Set the production secret
wrangler secret put JWT_SECRET

# When prompted, paste the generated secret
```

### Setting Staging/Preview Secrets

If you have staging or preview environments:

```bash
# For staging environment
wrangler secret put JWT_SECRET --env staging

# For preview environment
wrangler secret put JWT_SECRET --env preview
```

### Listing Secrets

To see which secrets are configured (values are not shown):

```bash
# List production secrets
wrangler secret list

# List staging secrets
wrangler secret list --env staging
```

### Deleting Secrets

If you need to remove a secret:

```bash
# Delete production secret
wrangler secret delete JWT_SECRET

# Delete staging secret
wrangler secret delete JWT_SECRET --env staging
```

## Security Best Practices

### DO

- Generate a unique, cryptographically strong secret for each environment
- Use secrets that are at least 32 bytes (256 bits) in length
- Rotate secrets periodically (e.g., every 90 days)
- Use `wrangler secret put` for production environments
- Keep `.dev.vars` in your `.gitignore` file
- Share setup instructions, not the actual secrets
- Generate new secrets if they are ever accidentally exposed

### DO NOT

- Never commit `.dev.vars` to version control
- Never hardcode secrets in `wrangler.jsonc` or source code
- Never share secrets via email, Slack, or other unsecured channels
- Never reuse the same secret across multiple environments
- Never use weak or predictable secrets like "secret123" or "password"
- Never push secrets to public repositories

## Troubleshooting

### Local Development Issues

**Problem**: JWT authentication not working locally

**Solution**:
1. Verify `.dev.vars` exists in the project root
2. Ensure `JWT_SECRET` is set in `.dev.vars`
3. Restart the development server (`npm run dev`)

**Problem**: `.dev.vars` changes not being picked up

**Solution**: Restart the Wrangler dev server. Changes to `.dev.vars` require a restart.

### Production Issues

**Problem**: Authentication not working after deployment

**Solution**:
1. Verify the secret is set: `wrangler secret list`
2. If not listed, set it: `wrangler secret put JWT_SECRET`
3. Redeploy: `npm run deploy`

**Problem**: Need to update the production secret

**Solution**:
```bash
# Generate a new secret
openssl rand -base64 32

# Update the secret
wrangler secret put JWT_SECRET

# Deploy to apply changes
npm run deploy
```

## Team Onboarding

When a new developer joins the team:

1. Clone the repository
2. Run `npm install`
3. Create their own `.dev.vars` file:
   ```bash
   echo "JWT_SECRET=$(openssl rand -base64 32)" > .dev.vars
   ```
4. Start development: `npm run dev`

Each developer should generate their own local secret. These do not need to match across team members for local development.

## Secret Rotation

To rotate the JWT_SECRET in production:

1. Generate a new secret: `openssl rand -base64 32`
2. Update the secret: `wrangler secret put JWT_SECRET`
3. Deploy the application: `npm run deploy`

Note: Rotating the JWT_SECRET will invalidate all existing JWT tokens, requiring users to log in again.

## Additional Resources

- [Cloudflare Workers Secrets Documentation](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler Configuration Guide](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
