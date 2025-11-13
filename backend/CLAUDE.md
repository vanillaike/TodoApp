# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers-based REST API for managing todos with user authentication, backed by a D1 (SQLite) database. The worker is written in TypeScript with a modular architecture and follows a direct routing pattern without a framework.

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

### Project Structure
The codebase follows a modular architecture:

```
src/
├── index.ts                 # Main worker entry point with routing
├── types.ts                 # TypeScript type definitions
├── config.ts                # Centralized configuration constants
├── auth.ts                  # Authentication and JWT utilities
├── validation.ts            # Input validation functions
├── utils/
│   └── responses.ts        # Standardized response helpers
└── middleware/
    └── headers.ts          # Security headers middleware
```

### Worker Structure (src/index.ts)
- Modular architecture with separated concerns
- Direct routing using regex matching for paths (no framework)
- All routes include CORS headers for cross-origin access
- Error handling wrapped in try-catch with standardized error responses
- Request size validation to prevent DoS attacks

### Database (D1)
- D1 database binding: `todo_db` (configured in wrangler.jsonc)
- Initial schema in `schema.sql` with `todos` table only
- Complete schema with authentication in `migrations/001_add_users_auth.sql`
- Four tables:
  - `users` - User accounts with email and bcrypt password hash
  - `todos` - Todo items with user_id foreign key
  - `refresh_tokens` - Long-lived refresh tokens for token rotation
  - `token_blacklist` - Blacklisted JWTs for immediate logout
- Completed status stored as INTEGER (0/1) not boolean
- All tables have proper indexes for performance

### REST API Endpoints
All endpoints are defined in src/index.ts:

**Authentication Endpoints (Public):**
- `POST /auth/register` - Register new user (email + password)
- `POST /auth/login` - Login and receive access token + refresh token
- `POST /auth/logout` - Logout and blacklist current token
- `POST /auth/refresh` - Refresh access token using refresh token

**Todo Endpoints (Protected - requires authentication):**
- `GET /todos` - List todos for authenticated user with pagination
  - Query params: `?limit=50&offset=0` (default: limit=50, max=100)
  - Returns: `{ todos: [], pagination: { limit, offset, total, hasMore } }`
  - Ordered by created_at DESC
- `POST /todos` - Create todo for authenticated user (requires title)
- `GET /todos/:id` - Get single todo for authenticated user
- `PUT /todos/:id` - Update todo for authenticated user (partial updates supported)
- `DELETE /todos/:id` - Delete todo for authenticated user

### Authentication & Authorization

The API uses JWT-based authentication with the following features:

**Token System:**
- Access tokens: JWT signed with HS256, 7-day expiration (configurable in config.ts)
- Refresh tokens: Random UUID, 30-day expiration (stored in database)
- Token rotation: New refresh token issued on each refresh (enhanced security)
- Token blacklisting: Immediate invalidation on logout

**Authentication Flow:**
1. Register or login to receive access token + refresh token
2. Include `Authorization: Bearer <access_token>` header in protected requests
3. Use refresh token to get new access token when expired (also rotates refresh token)
4. Logout to blacklist current access token and optionally delete refresh token

**User Isolation:**
- All todo operations are scoped to authenticated user
- Users can only access their own todos
- Database queries filter by user_id

### Security Features

**Authentication & Password Security:**
- JWT Authentication: HS256 signed tokens with 7-day expiration (jose library)
- Password Hashing: bcrypt with 10 rounds (bcryptjs library)
- Token Rotation: Refresh tokens rotated on each use to limit attack window
- Token Blacklisting: Immediate token revocation on logout
- Timing Attack Protection: Constant-time comparison prevents user enumeration
- Input Validation: Comprehensive validation on all auth endpoints

**API Security:**
- CORS: Configurable origin whitelisting (development allows localhost)
- Content-Type Validation: Enforces application/json (returns 415 for invalid types)
- Request Size Limits: 10KB max payload to prevent DoS attacks
- Security Headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Rate Limiting: Configure via Cloudflare Dashboard (see RATE_LIMITING_SETUP.md)
- User Isolation: All database queries filter by user_id to prevent data leakage

**Security Headers:**
- `Strict-Transport-Security`: Enforce HTTPS
- `Content-Security-Policy`: Strict CSP for API
- `X-Frame-Options`: Prevent clickjacking
- `X-Content-Type-Options`: Prevent MIME sniffing
- `Referrer-Policy`: Control referrer information
- `Permissions-Policy`: Disable unnecessary features

### Testing
- Uses Vitest with `@cloudflare/vitest-pool-workers` for integration testing
- Tests run in a simulated Workers environment with real D1 database
- Test config in `vitest.config.mts` references `wrangler.jsonc`
- Main test file: `test/index.spec.ts` with comprehensive auth and todo endpoint tests
- Test documentation: `test-auth-flow.md` and `test-validation.md`
- Run tests: `npm test`

### Configuration
- `src/config.ts` - Centralized configuration constants for:
  - Request size limits (10KB max)
  - Token expiration (7d access, 30d refresh)
  - Password requirements (8-128 chars)
  - Validation limits (email, title, description lengths)
  - Pagination defaults (50 default, 100 max)
- `wrangler.jsonc` - Cloudflare Workers configuration with D1 database binding
- `tsconfig.json` - TypeScript config (target: ES2021, strict mode enabled)
- `worker-configuration.d.ts` - Auto-generated types for Cloudflare bindings
- `.dev.vars` - Local development secrets (not committed, see `.dev.vars.example`)

## Database Management

### Initial Setup

For a new database, run migrations in order:

```bash
# Local development - initialize todos table
wrangler d1 execute todo-db --local --file=./schema.sql

# Local development - add authentication tables
wrangler d1 execute todo-db --local --file=./migrations/001_add_users_auth.sql

# Production - initialize todos table
wrangler d1 execute todo-db --file=./schema.sql

# Production - add authentication tables
wrangler d1 execute todo-db --file=./migrations/001_add_users_auth.sql
```

### Database Schema

The database consists of four tables:

1. **users** - User accounts
   - id, email (unique), password_hash, created_at, updated_at
   - Index on email for fast login lookups

2. **todos** - Todo items
   - id, title, description, completed, user_id (FK), created_at, updated_at
   - Index on user_id for filtering user's todos

3. **refresh_tokens** - Long-lived refresh tokens
   - id, user_id (FK), token (unique), expires_at, created_at
   - Indexes on token and user_id for fast validation

4. **token_blacklist** - Invalidated JWTs
   - id, token (unique), expires_at, blacklisted_at
   - Indexes on token and expires_at for fast checks and cleanup

### Migration Notes

- `schema.sql` - Creates initial todos table only (legacy)
- `migrations/001_add_users_auth.sql` - Adds users, refresh_tokens, token_blacklist tables and user_id to todos
- Database migrations are manual - execute SQL files via Wrangler CLI
- See `migrations/QUICK_START.md` and `migrations/SCHEMA_DESIGN.md` for details

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

All type definitions are located in `src/types.ts`:

### Environment Bindings (Env)
```typescript
interface Env {
  todo_db: D1Database;           // D1 database binding
  JWT_SECRET: string;            // Required: JWT signing secret
  ALLOWED_ORIGINS?: string;      // Optional: CORS whitelist (comma-separated)
}
```

### Database Entities
```typescript
interface Todo {
  id?: number;
  title: string;
  description?: string;
  completed: number;             // 0 or 1 (SQLite integer boolean)
  user_id?: number;              // Added by migration 001
  created_at?: string;
  updated_at?: string;
}

interface User {
  id?: number;
  email: string;
  password_hash?: string;        // Never returned in API responses
  created_at?: string;
  updated_at?: string;
}
```

### API Types
- `AuthenticateRequest` - Login/register request with email and password
- `AuthenticateResponse` - Auth response with user info, accessToken, and refreshToken
- `AuthenticatedUser` - Extracted JWT payload with userId and email
- `ValidationResult<T>` - Generic validation result with valid/error/data fields

See `src/types.ts` for complete type definitions.

## Key Modules

### Authentication (src/auth.ts)
Core authentication utilities:
- `hashPassword(password)` - Hash password with bcrypt (10 rounds)
- `verifyPassword(password, hash)` - Verify password against bcrypt hash
- `generateAccessToken(userId, email, env)` - Create JWT access token (7d expiry)
- `generateRefreshToken()` - Generate random UUID refresh token
- `authenticate(request, env)` - Middleware to verify JWT and extract user info

### Validation (src/validation.ts)
Comprehensive input validation for all endpoints:
- `validateContentType(request)` - Ensure Content-Type is application/json
- `checkRequestSize(request)` - Enforce 10KB max payload size
- `validateRegisterInput(body)` - Validate registration data (email, password)
- `validateLoginInput(body)` - Validate login data
- `validateLogoutInput(body)` - Validate logout data (optional refresh token)
- `validateRefreshInput(body)` - Validate refresh token request
- `validateTodoInput(body, isUpdate)` - Validate todo creation/update data

All validation functions return `ValidationResult<T>` with `valid`, `error`, and `data` fields.

### Response Utilities (src/utils/responses.ts)
Standardized response helpers with consistent structure:
- `successResponse(data, headers)` - 200 OK response
- `createdResponse(data, headers)` - 201 Created response
- `errorResponse(message, status, headers)` - Error response with message
- `notFoundResponse(message, headers)` - 404 Not Found
- `validationErrorResponse(message, headers)` - 400 Bad Request for validation errors
- `unsupportedMediaTypeResponse(headers)` - 415 Unsupported Media Type
- `payloadTooLargeResponse(headers)` - 413 Payload Too Large
- `invalidJsonResponse(headers)` - 400 Bad Request for invalid JSON

### Security Headers (src/middleware/headers.ts)
- `getSecurityHeaders(request, env)` - Returns Headers object with all security headers
- Handles CORS with configurable origin whitelisting
- Adds HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

### Configuration (src/config.ts)
Centralized constants exported as `CONFIG` object:
- Request limits: `MAX_REQUEST_SIZE_BYTES`
- Token expiration: `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY_DAYS`
- Password security: `BCRYPT_ROUNDS`, `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`
- Validation: `EMAIL_MAX_LENGTH`, `TITLE_MAX_LENGTH`, `DESCRIPTION_MAX_LENGTH`
- Pagination: `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`

## Additional Documentation

The repository includes comprehensive documentation files:

### Setup & Configuration
- `SECRETS_SETUP.md` - Complete guide for setting up JWT_SECRET in local and production
- `.dev.vars.example` - Example local environment variables file
- `RATE_LIMITING_SETUP.md` - How to configure rate limiting via Cloudflare Dashboard

### Database & Migrations
- `migrations/QUICK_START.md` - Quick guide to running database migrations
- `migrations/README.md` - Detailed migration documentation
- `migrations/SCHEMA_DESIGN.md` - Complete database schema design and rationale

### Testing & Implementation
- `test-auth-flow.md` - Authentication flow testing documentation
- `test-validation.md` - Input validation testing documentation
- `MIGRATION_SUMMARY.md` - Summary of major codebase refactoring
- `PHASE6_IMPLEMENTATION.md` - Phase 6 implementation details
- `PHASE6_SUMMARY.md` - Phase 6 summary
- `PHASE7_SUMMARY.md` - Phase 7 summary (latest features)

## Development Tips

### Common Workflows

**Adding a new endpoint:**
1. Add route regex and handler in `src/index.ts`
2. Create validation function in `src/validation.ts` if needed
3. Use standardized responses from `src/utils/responses.ts`
4. Apply `getSecurityHeaders()` to all responses
5. For protected routes, call `authenticate(request, env)` first
6. Add comprehensive tests in `test/index.spec.ts`

**Modifying authentication:**
1. Update logic in `src/auth.ts`
2. Update types in `src/types.ts` if needed
3. Update token expiration in `src/config.ts` if needed
4. Test with existing auth tests in `test/index.spec.ts`

**Database changes:**
1. Create new migration file in `migrations/` (e.g., `002_add_feature.sql`)
2. Update types in `src/types.ts`
3. Update relevant queries in `src/index.ts`
4. Document in migration's README
5. Test locally before deploying to production

### Security Considerations

When adding new features, ensure:
- All user input is validated via validation functions
- Content-Type and request size are checked for POST/PUT routes
- Protected routes call `authenticate()` before processing
- Database queries include `user_id` filter where applicable
- Responses use standardized response helpers with security headers
- Sensitive data (passwords, internal errors) never exposed in responses
- Rate limiting configured for production (see RATE_LIMITING_SETUP.md)
