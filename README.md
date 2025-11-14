# Todo API - Monorepo

This repository contains a full-stack todo application with a Cloudflare Workers backend and a frontend application.

## Repository Structure

```
.
├── backend/          # Cloudflare Workers REST API
│   ├── src/         # TypeScript source code
│   ├── test/        # Vitest tests
│   ├── migrations/  # D1 database migrations
│   └── ...          # Configuration files
├── frontend/         # Frontend application (to be implemented)
└── README.md        # This file
```

## Backend

The backend is a Cloudflare Workers-based REST API for managing todos with user authentication, backed by a D1 (SQLite) database.

### Backend Quick Start

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Deploy to Cloudflare Workers
npm run deploy
```

### Backend Documentation

For detailed backend documentation, see:
- `backend/CLAUDE.md` - Complete project overview and development guide
- `backend/SECRETS_SETUP.md` - JWT secret configuration
- `backend/RATE_LIMITING_SETUP.md` - Rate limiting configuration
- `backend/migrations/QUICK_START.md` - Database migration guide

### Backend Features

- JWT-based authentication with refresh tokens
- User registration and login
- Todo CRUD operations with user isolation
- Comprehensive security headers (CORS, CSP, HSTS, etc.)
- Input validation and request size limits
- Token blacklisting for immediate logout
- Comprehensive test coverage with Vitest

## Frontend

The frontend directory is ready for your frontend application implementation.

### Frontend Setup (Coming Soon)

The frontend will integrate with the backend API to provide a user interface for managing todos.

## Development Workflow

### Working on Backend

```bash
cd backend
npm run dev        # Start backend dev server on http://localhost:8787
npm test           # Run backend tests
```

### Working on Frontend

```bash
cd frontend
# Frontend setup instructions will be added here
```

## Environment Configuration

### Backend Environment

The backend requires a JWT secret for authentication:

1. Local development: Create `backend/.dev.vars` file
   ```
   JWT_SECRET=your-secret-key-here
   ```

2. Production: Use Wrangler secrets
   ```bash
   cd backend
   wrangler secret put JWT_SECRET
   ```

See `backend/SECRETS_SETUP.md` for detailed instructions.

## API Endpoints

The backend API is available at `http://localhost:8787` during development.

### Authentication Endpoints (Public)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and receive tokens
- `POST /auth/logout` - Logout and blacklist token
- `POST /auth/refresh` - Refresh access token

### Todo Endpoints (Protected)
- `GET /todos` - List todos with pagination
- `POST /todos` - Create todo
- `GET /todos/:id` - Get single todo
- `PUT /todos/:id` - Update todo
- `DELETE /todos/:id` - Delete todo

For complete API documentation, see `backend/CLAUDE.md`.

## Technology Stack

### Backend
- Runtime: Cloudflare Workers
- Database: D1 (SQLite)
- Language: TypeScript
- Testing: Vitest with @cloudflare/vitest-pool-workers
- Authentication: JWT with jose library
- Password Hashing: bcryptjs

### Frontend
- (To be determined)

## Git Workflow

The repository is a monorepo with both backend and frontend code. When committing changes:

- Backend changes: All backend files are in the `backend/` directory
- Frontend changes: All frontend files will be in the `frontend/` directory
- Root changes: Configuration files at the root level

## License

(Add your license information here)
