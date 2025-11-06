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
- `GET /todos` - List all todos (ordered by created_at DESC)
- `POST /todos` - Create todo (requires title)
- `GET /todos/:id` - Get single todo
- `PUT /todos/:id` - Update todo (partial updates supported)
- `DELETE /todos/:id` - Delete todo

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

## Type Definitions

The `Env` interface (src/index.ts:1-3) defines Worker bindings:
- `todo_db: D1Database` - The D1 database binding

The `Todo` interface (src/index.ts:5-12) defines the todo data structure with optional id, created_at, and updated_at fields.
