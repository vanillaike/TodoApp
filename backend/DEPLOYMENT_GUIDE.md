# Backend Deployment Guide

This guide provides a complete, step-by-step plan for deploying the Todo API backend to Cloudflare Workers.

## Prerequisites

Before deploying, ensure you have:
- [ ] Cloudflare account with Workers enabled
- [ ] Wrangler CLI installed and authenticated (`wrangler login`)
- [ ] Backend tests passing locally (`npm test`)
- [ ] Local development working (`npm run dev`)

## Deployment Phases

### Phase 1: Pre-Deployment Verification

**1.1 Run All Tests**
```bash
cd backend
npm test
```
Ensure all 124 tests pass before proceeding.

**1.2 Verify Configuration**
```bash
# Check wrangler.jsonc is valid
wrangler deploy --dry-run
```

**1.3 Review Database Binding**
Verify in `wrangler.jsonc`:
- `database_name`: "todo-db"
- `database_id`: "f9c2f5eb-2f25-4d05-9642-d0431583519b"

### Phase 2: Database Setup

**2.1 Verify Production Database Exists**
```bash
# List your D1 databases
wrangler d1 list

# If "todo-db" doesn't exist, create it:
wrangler d1 create todo-db

# Update the database_id in wrangler.jsonc with the output from create
```

**2.2 Apply Initial Schema**
```bash
# Apply the base todos table schema
wrangler d1 execute todo-db --file=./schema.sql
```

**2.3 Apply Authentication Migration**
```bash
# Apply user authentication tables
wrangler d1 execute todo-db --file=./migrations/001_add_users_auth.sql
```

**2.4 Verify Database Schema**
```bash
# List all tables (should show: todos, users, refresh_tokens, token_blacklist)
wrangler d1 execute todo-db --command "SELECT name FROM sqlite_master WHERE type='table'"

# Verify todos table has user_id column
wrangler d1 execute todo-db --command "PRAGMA table_info(todos)"

# Verify indexes exist
wrangler d1 execute todo-db --command "SELECT name FROM sqlite_master WHERE type='index'"
```

### Phase 3: Secrets Configuration

**3.1 Generate Production JWT Secret**
```bash
# Generate a strong, unique secret for production
openssl rand -base64 32

# IMPORTANT: Save this secret securely - you'll need it in the next step
```

**3.2 Set Production Secrets**
```bash
# Set the JWT_SECRET (paste the value from step 3.1 when prompted)
wrangler secret put JWT_SECRET

# Verify the secret was set
wrangler secret list
```

**Expected output:**
```
┌──────────────┬────────────────────┐
│ Name         │ Type               │
├──────────────┼────────────────────┤
│ JWT_SECRET   │ secret_text        │
└──────────────┴────────────────────┘
```

**3.3 Configure CORS Origins**

Edit `wrangler.jsonc` to set production origins:
```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://yourusername.github.io,https://your-custom-domain.com"
}
```

For multiple origins, use comma-separated list.

### Phase 4: Initial Deployment

**4.1 Deploy to Cloudflare Workers**
```bash
npm run deploy
```

**4.2 Verify Deployment**

You should see output like:
```
Published todo-api (X.XX sec)
  https://todo-api.your-subdomain.workers.dev
```

**4.3 Test Health Endpoint**
```bash
# Test that the worker is responding
curl https://todo-api.your-subdomain.workers.dev/

# Expected: 404 Not Found (this is correct - means worker is running)
```

**4.4 Test Authentication Endpoints**

```bash
# Set your API URL as a variable
API_URL="https://todo-api.your-subdomain.workers.dev"

# Test user registration
curl -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123"}'

# Expected: 201 Created with user data and tokens

# Test login
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123"}'

# Expected: 200 OK with user data and tokens
```

### Phase 5: Security Configuration

**5.1 Configure Rate Limiting (Cloudflare Dashboard)**

1. Log in to Cloudflare Dashboard
2. Navigate to: **Security > WAF > Rate limiting rules**
3. Create the following rules:

**Rule 1: Registration Protection**
- Name: "Registration Rate Limit"
- URL path: contains `/auth/register`
- Requests: 3 per hour
- Per: IP address
- Action: Block
- Duration: 1 hour

**Rule 2: Login Protection**
- Name: "Login Rate Limit"
- URL path: contains `/auth/login`
- Requests: 5 per minute
- Per: IP address
- Action: Block
- Duration: 10 minutes

**Rule 3: Token Refresh Protection**
- Name: "Refresh Token Rate Limit"
- URL path: contains `/auth/refresh`
- Requests: 10 per minute
- Per: IP address
- Action: Block
- Duration: 5 minutes

**Rule 4: Todo Creation Protection**
- Name: "Todo Creation Rate Limit"
- URL path: contains `/todos`
- Method: POST
- Requests: 30 per minute
- Per: IP address
- Action: Block
- Duration: 5 minutes

**Rule 5: General API Protection**
- Name: "General API Rate Limit"
- URL path: contains your worker path (e.g., `/`)
- Requests: 100 per minute
- Per: IP address
- Action: Challenge (CAPTCHA)
- Duration: 5 minutes

**5.2 Verify CORS Configuration**

Test from your frontend domain:
```bash
# Replace with your actual frontend URL
curl -X OPTIONS "https://todo-api.your-subdomain.workers.dev/todos" \
  -H "Origin: https://yourusername.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Should see Access-Control-Allow-Origin header in response
```

**5.3 Verify Security Headers**

```bash
curl -I "https://todo-api.your-subdomain.workers.dev/todos"

# Verify these headers are present:
# - Strict-Transport-Security
# - Content-Security-Policy
# - X-Frame-Options
# - X-Content-Type-Options
# - Referrer-Policy
# - Permissions-Policy
```

### Phase 6: Monitoring & Verification

**6.1 Test Complete Authentication Flow**

```bash
API_URL="https://todo-api.your-subdomain.workers.dev"

# 1. Register a new user
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"deploy-test@example.com","password":"SecurePassword123"}')

echo "Registration: $REGISTER_RESPONSE"

# 2. Extract access token
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "Access Token: $ACCESS_TOKEN"

# 3. Create a todo
curl -X POST "$API_URL/todos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"title":"Deployment test todo","description":"Testing production deployment"}'

# 4. Get todos
curl -X GET "$API_URL/todos" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 5. Logout
curl -X POST "$API_URL/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{}'
```

**6.2 Enable Cloudflare Analytics**

1. Go to Cloudflare Dashboard > Workers & Pages
2. Click on your worker "todo-api"
3. Navigate to **Metrics** tab
4. Monitor:
   - Request count
   - Error rate
   - Execution time
   - CPU time

**6.3 Set Up Alerts (Optional)**

1. Navigate to **Notifications** in Cloudflare Dashboard
2. Create alerts for:
   - High error rate (> 5%)
   - Unusual traffic spike
   - Rate limit violations

### Phase 7: Post-Deployment Tasks

**7.1 Update Frontend Configuration**

Update `frontend/js/config.js`:
```javascript
const CONFIG = {
  API_BASE_URL: isProduction
    ? 'https://todo-api.your-subdomain.workers.dev'
    : 'http://localhost:8787',
  // ... rest of config
};
```

**7.2 Document Deployment Info**

Create a `DEPLOYMENT_INFO.md` file with:
- Production API URL
- Deployment date
- Database name and ID
- Configured CORS origins
- Rate limit rules in place
- Any custom configuration

**7.3 Secret Rotation Schedule**

Set a reminder to rotate JWT_SECRET every 90 days:
```bash
# When rotating:
# 1. Generate new secret
openssl rand -base64 32

# 2. Update production secret
wrangler secret put JWT_SECRET

# 3. Redeploy
npm run deploy

# Note: This will invalidate all existing tokens and require users to log in again
```

## Troubleshooting

### Issue: "Database not found"

**Solution:**
```bash
# Verify database exists
wrangler d1 list

# Check database_id matches in wrangler.jsonc
wrangler d1 info todo-db
```

### Issue: "JWT_SECRET is not defined"

**Solution:**
```bash
# Verify secret is set
wrangler secret list

# If missing, set it
wrangler secret put JWT_SECRET
```

### Issue: "CORS errors from frontend"

**Solution:**
```bash
# 1. Verify ALLOWED_ORIGINS in wrangler.jsonc includes your frontend domain
# 2. Redeploy after updating
npm run deploy

# 3. Test OPTIONS request
curl -X OPTIONS "https://todo-api.your-subdomain.workers.dev/todos" \
  -H "Origin: https://yourusername.github.io" \
  -v
```

### Issue: "Rate limiting not working"

**Solution:**
1. Ensure rate limit rules are created in Cloudflare Dashboard
2. Wait 1-2 minutes for rules to propagate
3. Test with rapid requests:
```bash
# Should block after 5 attempts
for i in {1..10}; do
  curl -X POST "https://todo-api.your-subdomain.workers.dev/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  sleep 1
done
```

### Issue: "Migrations failed"

**Solution:**
```bash
# Check current schema
wrangler d1 execute todo-db --command ".schema"

# If tables exist, migration already applied
# If needed, manually verify each table exists:
wrangler d1 execute todo-db --command "SELECT * FROM users LIMIT 1"
wrangler d1 execute todo-db --command "SELECT * FROM refresh_tokens LIMIT 1"
wrangler d1 execute todo-db --command "SELECT * FROM token_blacklist LIMIT 1"
```

## Rollback Procedure

If you need to rollback a deployment:

**1. Revert to Previous Version**
```bash
# List recent deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback [deployment-id]
```

**2. Verify Rollback**
```bash
# Test the worker is responding correctly
curl https://todo-api.your-subdomain.workers.dev/
```

## Production Checklist

Before considering deployment complete, verify:

- [ ] All tests passing (`npm test`)
- [ ] Database tables created (users, todos, refresh_tokens, token_blacklist)
- [ ] Database indexes created (check with `.schema`)
- [ ] JWT_SECRET set in production (`wrangler secret list`)
- [ ] ALLOWED_ORIGINS configured in wrangler.jsonc
- [ ] Worker deployed successfully (`npm run deploy`)
- [ ] Rate limiting rules configured (5 rules in Cloudflare Dashboard)
- [ ] Registration endpoint tested
- [ ] Login endpoint tested
- [ ] Todo CRUD operations tested
- [ ] CORS working from frontend domain
- [ ] Security headers present in responses
- [ ] Analytics enabled in Cloudflare Dashboard
- [ ] Frontend updated with production API URL
- [ ] Deployment info documented

## Useful Commands Reference

```bash
# View worker logs in real-time
wrangler tail

# View recent deployments
wrangler deployments list

# Check worker status
wrangler whoami

# Test database connection
wrangler d1 execute todo-db --command "SELECT COUNT(*) FROM users"

# View database tables
wrangler d1 execute todo-db --command ".tables"

# View complete schema
wrangler d1 execute todo-db --command ".schema"

# Delete all data from a table (CAREFUL!)
wrangler d1 execute todo-db --command "DELETE FROM todos"

# Deploy to specific environment (if configured)
wrangler deploy --env staging
```

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Rate Limiting Setup](./RATE_LIMITING_SETUP.md)
- [Secrets Setup](./SECRETS_SETUP.md)
- [Migration Guide](./migrations/QUICK_START.md)
