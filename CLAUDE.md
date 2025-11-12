# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers-based REST API for managing todos, backed by a D1 (SQLite) database. The worker is written in TypeScript and follows a simple, direct routing pattern without a framework.

## Development Commands

```bash
# Start local development server
npm run dev

# Run tests with Vitest (uses @cloudflare/vitest-pool-workers)
npm test

# Deploy to Cloudflare Workers
npm run deploy

# Generate TypeScript types for Cloudflare bindings
npm run cf-typegen
```

## Architecture

### Worker Structure (src/index.ts)
- Single-file worker with inline routing using regex matching for paths
- No framework - direct use of Cloudflare Workers API
- All routes include CORS headers for cross-origin access
- Error handling wrapped in try-catch with standardized error responses

### Database (D1)
- D1 database binding: `todo_db` (configured in wrangler.jsonc)
- Schema defined in `schema.sql` (not auto-applied; must be manually executed via Wrangler CLI)
- Single table: `todos` with fields: id, title, description, completed, created_at, updated_at
- Completed status is stored as INTEGER (0/1) not boolean

### REST API Endpoints
All endpoints are defined in src/index.ts:

**Authentication Endpoints (Public):**
- `POST /auth/register` - Register new user (email + password)
- `POST /auth/login` - Login and receive access token + refresh token
- `POST /auth/logout` - Logout and blacklist current token
- `POST /auth/refresh` - Refresh access token using refresh token

**Todo Endpoints (Protected - requires authentication):**
- `GET /todos` - List all todos for authenticated user (ordered by created_at DESC)
- `POST /todos` - Create todo for authenticated user (requires title)
- `GET /todos/:id` - Get single todo for authenticated user
- `PUT /todos/:id` - Update todo for authenticated user (partial updates supported)
- `DELETE /todos/:id` - Delete todo for authenticated user

### Authentication & Authorization

The API uses JWT-based authentication with the following features:

**Token System:**
- Access tokens: JWT signed with HS256, 7-day expiration
- Refresh tokens: Random UUID, 30-day expiration
- Token blacklisting: Immediate invalidation on logout

**Authentication Flow:**
1. Register or login to receive access token + refresh token
2. Include `Authorization: Bearer <access_token>` header in protected requests
3. Use refresh token to get new access token when expired
4. Logout to blacklist current access token

**User Isolation:**
- All todo operations are scoped to authenticated user
- Users can only access their own todos
- Database queries filter by user_id

### Security Features

**Authentication & Password Security:**
- JWT Authentication: HS256 signed tokens with 7-day expiration
- Password Hashing: bcrypt with 10 rounds
- Token Blacklisting: Immediate token revocation on logout
- Input Validation: Comprehensive validation on all auth endpoints

**API Security:**
- CORS: Configurable origin whitelisting (development allows localhost)
- Security Headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- Rate Limiting: Configure via Cloudflare Dashboard (see RATE_LIMITING_SETUP.md)
- User Isolation: Users can only access their own todos

**Security Headers:**
- `Strict-Transport-Security`: Enforce HTTPS
- `Content-Security-Policy`: Strict CSP for API
- `X-Frame-Options`: Prevent clickjacking
- `X-Content-Type-Options`: Prevent MIME sniffing
- `Referrer-Policy`: Control referrer information
- `Permissions-Policy`: Disable unnecessary features

### Testing
- Uses Vitest with `@cloudflare/vitest-pool-workers` for integration testing
- Tests run in a simulated Workers environment
- Test config in `vitest.config.mts` references `wrangler.jsonc`
- Tests are located in `test/` directory

### Configuration Files
- `wrangler.jsonc` - Cloudflare Workers configuration with D1 database binding
- `tsconfig.json` - TypeScript config (target: ES2021, strict mode enabled)
- `worker-configuration.d.ts` - Auto-generated types for Cloudflare bindings

## Database Management

To initialize or update the database schema:
```bash
# For local development
wrangler d1 execute todo-db --local --file=./schema.sql

# For production
wrangler d1 execute todo-db --file=./schema.sql
```

Note: Database migrations are manual. The schema.sql file defines the initial table structure.

## Environment Variables

### Required Secrets

**JWT_SECRET** (Required for authentication):
- Secret key for signing JWT access tokens
- Must be cryptographically strong (minimum 32 characters)
- Local development: Add to `.dev.vars` file (not committed to git)
- Production: Use `wrangler secret put JWT_SECRET` to set encrypted secret
- See SECRETS_SETUP.md for detailed instructions

### Optional Configuration

**ALLOWED_ORIGINS** (Optional - CORS configuration):
- Comma-separated list of allowed origins for CORS
- Example: `"https://yourdomain.com,https://app.yourdomain.com"`
- Leave empty or omit for development (allows localhost)
- Set in `wrangler.jsonc` vars section or via environment variable
- Production: Configure specific origins for security

## Type Definitions

The `Env` interface (src/index.ts:1-4) defines Worker bindings:
- `todo_db: D1Database` - The D1 database binding
- `JWT_SECRET: string` - Secret for JWT signing (required)
- `ALLOWED_ORIGINS?: string` - Optional CORS origin whitelist

The `Todo` interface defines the todo data structure with optional id, created_at, and updated_at fields.
