# CLAUDE.md - Monorepo Guide

This file provides guidance to Claude Code when working with code in this monorepo.

## Repository Structure

This is a monorepo containing both backend and frontend applications:

```
todo-api/
├── backend/              # Cloudflare Workers REST API
│   ├── src/             # TypeScript source code
│   ├── test/            # Vitest tests
│   ├── migrations/      # D1 database migrations
│   ├── CLAUDE.md        # Backend-specific instructions
│   └── ...              # Backend configuration and docs
├── frontend/            # Frontend application
│   └── README.md        # Frontend setup guide
└── CLAUDE.md            # This file (monorepo guidance)
```

## Working Directory Guidelines

**IMPORTANT**: Choose the correct working directory based on the task:

### Backend Tasks
When working on backend API, database, authentication, tests, or Cloudflare Workers:
- **Navigate to**: `backend/` directory
- **Run commands from**: `backend/`
- **Read detailed instructions**: `backend/CLAUDE.md`

Examples:
- Adding/modifying API endpoints
- Database migrations
- Authentication logic
- Running tests (`npm test`)
- Starting dev server (`npm run dev`)
- Deploying to Cloudflare (`npm run deploy`)

### Frontend Tasks
When working on UI, components, or frontend application:
- **Navigate to**: `frontend/` directory
- **Run commands from**: `frontend/`
- **Read detailed instructions**: `frontend/README.md` (or `frontend/CLAUDE.md` when created)

Examples:
- Creating UI components
- Styling and responsiveness
- API integration
- Frontend routing
- Frontend build/dev tasks

### Root-Level Tasks
When working on repository-wide concerns:
- **Work from**: Root directory
- **Examples**: Git operations, README updates, monorepo configuration

## Quick Reference

### Backend Commands
```bash
cd backend
npm run dev      # Start development server (http://localhost:8787)
npm test         # Run tests
npm run deploy   # Deploy to Cloudflare Workers
```

### Frontend Commands
```bash
cd frontend
# Commands will be added based on chosen frontend framework
```

## Backend Overview

The backend is a Cloudflare Workers-based REST API with:
- JWT authentication with refresh tokens
- D1 (SQLite) database
- User registration and login
- Todo CRUD operations with user isolation
- Comprehensive security features

**For complete backend documentation, see `backend/CLAUDE.md`**

## Frontend Overview

The frontend directory is ready for implementation. You can use any frontend framework (React, Vue, Svelte, etc.).

The frontend will integrate with the backend API:
- Development API: `http://localhost:8787`
- Production API: Your deployed Cloudflare Workers URL

**For frontend setup guidance, see `frontend/README.md`**

## File Location Reference

If you're looking for specific files:
- **API source code**: `backend/src/`
- **API tests**: `backend/test/`
- **Database migrations**: `backend/migrations/`
- **Backend docs**: `backend/*.md`
- **Frontend code**: `frontend/` (to be implemented)

## Important Notes

1. **Always navigate to the correct directory** before running npm commands
2. **Backend and frontend have separate node_modules** - they are independent projects
3. **Git operations** should be run from the root directory
4. **Read `backend/CLAUDE.md`** for detailed backend architecture, patterns, and conventions
5. **File paths changed** - All backend files are now in `backend/` subdirectory

## Development Workflow

When the user asks you to work on backend features:
1. Navigate to `backend/` directory
2. Read `backend/CLAUDE.md` for detailed instructions
3. Follow the patterns and architecture described there
4. Run commands from the `backend/` directory

When the user asks you to work on frontend features:
1. Navigate to `frontend/` directory
2. Check for frontend-specific instructions
3. Ensure API integration points to the correct backend URL

## Getting Help

- Backend architecture and patterns: `backend/CLAUDE.md`
- Backend secrets setup: `backend/SECRETS_SETUP.md`
- Backend database migrations: `backend/migrations/QUICK_START.md`
- Frontend setup: `frontend/README.md`
- Monorepo overview: Root `README.md`
