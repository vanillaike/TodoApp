# Rate Limiting Setup for Todo API

This API requires rate limiting to prevent abuse and DoS attacks. Rate limiting should be configured using Cloudflare's built-in features.

## Quick Setup via Cloudflare Dashboard

1. Log in to Cloudflare Dashboard
2. Navigate to: **Security > WAF > Rate limiting rules**
3. Click **Create rule**

## Recommended Rate Limits

### Authentication Endpoints (HIGH PRIORITY)

**Rule 1: Registration Rate Limit**
- **Path:** `/auth/register`
- **Limit:** 3 requests per hour per IP
- **Action:** Block
- **Reason:** Prevent spam account creation

**Rule 2: Login Rate Limit**
- **Path:** `/auth/login`
- **Limit:** 5 requests per minute per IP
- **Action:** Block
- **Reason:** Prevent brute force password attacks

**Rule 3: Token Refresh Rate Limit**
- **Path:** `/auth/refresh`
- **Limit:** 10 requests per minute per IP
- **Action:** Block
- **Reason:** Prevent token refresh abuse

### Todo Endpoints (MEDIUM PRIORITY)

**Rule 4: Todo Creation Rate Limit**
- **Path:** `/todos` (POST method)
- **Limit:** 30 requests per minute per IP
- **Action:** Block
- **Reason:** Prevent database spam

**Rule 5: General API Rate Limit**
- **Path:** `/*`
- **Limit:** 100 requests per minute per IP
- **Action:** Challenge (CAPTCHA)
- **Reason:** Prevent general DoS attacks

## Alternative: Cloudflare Workers Rate Limiting

If you prefer code-based rate limiting, see the implementation guide in the security audit report.

## Verification

Test rate limits:
```bash
# Test login rate limit (should block after 5 attempts)
for i in {1..10}; do
  curl -X POST https://your-api.com/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  sleep 1
done
```

## Monitoring

Monitor rate limit hits in Cloudflare Analytics:
- Dashboard > Analytics > Security
- Look for "Rate Limiting" events
