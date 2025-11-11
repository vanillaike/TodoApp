export interface Env {
  todo_db: D1Database;
  JWT_SECRET: string;
}

interface Todo {
  id?: number;
  title: string;
  description?: string;
  completed: number;
  created_at?: string;
  updated_at?: string;
}

// User database record interface
interface User {
  id?: number;
  email: string;
  password_hash?: string; // Optional because we never return this in API responses
  created_at?: string;
  updated_at?: string;
}

// Registration request body
interface RegisterRequest {
  email: string;
  password: string;
}

// Registration response (excludes password_hash)
interface RegisterResponse {
  user: {
    id: number;
    email: string;
    created_at: string;
  };
  accessToken: string;
  refreshToken: string;
}

// Password validation result
interface PasswordValidation {
  valid: boolean;
  error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

import bcrypt from 'bcryptjs';
import * as jose from 'jose';

/**
 * Hash a password using bcrypt with 10 rounds
 * @param password - Plain text password to hash
 * @returns Promise resolving to bcrypt hash string
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Validate email format using regex
 * @param email - Email address to validate
 * @returns true if email format is valid
 */
function validateEmail(email: string): boolean {
  // Standard email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength requirements
 * @param password - Password to validate
 * @returns Object with valid boolean and optional error message
 */
function validatePassword(password: string): PasswordValidation {
  if (!password || password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters long'
    };
  }

  // Check for at least one letter
  if (!/[a-zA-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one letter'
    };
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one number'
    };
  }

  return { valid: true };
}

/**
 * Generate a JWT access token with 7 day expiration
 * @param userId - User's database ID
 * @param email - User's email address
 * @param env - Environment bindings (contains JWT_SECRET)
 * @returns Promise resolving to signed JWT string
 */
async function generateAccessToken(userId: number, email: string, env: Env): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  const token = await new jose.SignJWT({
    userId,
    email,
    type: 'access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 days
    .sign(secret);

  return token;
}

/**
 * Generate a secure random refresh token
 * Uses crypto.randomUUID() for cryptographically secure random string
 * @returns Random UUID string to use as refresh token
 */
function generateRefreshToken(): string {
  return crypto.randomUUID();
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ========================================================================
      // AUTHENTICATION ROUTES
      // ========================================================================

      // POST /auth/register - User registration endpoint
      if (path === '/auth/register' && method === 'POST') {
        // Validate Content-Type header
        const contentType = request.headers.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
          return new Response(JSON.stringify({
            error: 'Content-Type must be application/json'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Parse request body
        let body: RegisterRequest;
        try {
          body = await request.json();
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Invalid JSON in request body'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Validate required fields
        if (!body.email || !body.password) {
          return new Response(JSON.stringify({
            error: 'Email and password are required'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Validate email format
        if (!validateEmail(body.email)) {
          return new Response(JSON.stringify({
            error: 'Invalid email format'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Validate password strength
        const passwordValidation = validatePassword(body.password);
        if (!passwordValidation.valid) {
          return new Response(JSON.stringify({
            error: passwordValidation.error
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Check if email already exists
        const existingUser = await env.todo_db.prepare(
          'SELECT id FROM users WHERE email = ?'
        )
          .bind(body.email.toLowerCase())
          .first();

        if (existingUser) {
          return new Response(JSON.stringify({
            error: 'Email already exists'
          }), {
            status: 409,
            headers: corsHeaders
          });
        }

        // Hash password
        const passwordHash = await hashPassword(body.password);

        // Insert user into database
        const userResult = await env.todo_db.prepare(
          'INSERT INTO users (email, password_hash) VALUES (?, ?)'
        )
          .bind(body.email.toLowerCase(), passwordHash)
          .run();

        const userId = userResult.meta.last_row_id as number;

        // Fetch the created user (excluding password_hash)
        const newUser = await env.todo_db.prepare(
          'SELECT id, email, created_at FROM users WHERE id = ?'
        )
          .bind(userId)
          .first() as { id: number; email: string; created_at: string };

        // Generate access token (JWT)
        const accessToken = await generateAccessToken(newUser.id, newUser.email, env);

        // Generate refresh token
        const refreshToken = generateRefreshToken();

        // Calculate refresh token expiration (30 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const expiresAtISO = expiresAt.toISOString();

        // Store refresh token in database
        await env.todo_db.prepare(
          'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
        )
          .bind(userId, refreshToken, expiresAtISO)
          .run();

        // Prepare response
        const response: RegisterResponse = {
          user: {
            id: newUser.id,
            email: newUser.email,
            created_at: newUser.created_at
          },
          accessToken,
          refreshToken
        };

        return new Response(JSON.stringify(response), {
          status: 201,
          headers: corsHeaders
        });
      }

      // ========================================================================
      // TODO ROUTES
      // ========================================================================

      // GET /todos - List all todos
      if (path === '/todos' && method === 'GET') {
        const { results } = await env.todo_db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // POST /todos - Create a new todo
      if (path === '/todos' && method === 'POST') {
        const body: Partial<Todo> = await request.json();

        if (!body.title || body.title.trim() === '') {
          return new Response(JSON.stringify({ error: 'Title is required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const result = await env.todo_db.prepare(
          'INSERT INTO todos (title, description, completed) VALUES (?, ?, ?)'
        )
          .bind(body.title, body.description || null, body.completed || 0)
          .run();

        const todo = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(result.meta.last_row_id)
          .first();

        return new Response(JSON.stringify(todo), {
          status: 201,
          headers: corsHeaders
        });
      }

      // GET /todos/:id - Get a specific todo
      const getTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (getTodoMatch && method === 'GET') {
        const id = getTodoMatch[1];
        const todo = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(id)
          .first();

        if (!todo) {
          return new Response(JSON.stringify({ error: 'Todo not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify(todo), { headers: corsHeaders });
      }

      // PUT /todos/:id - Update a todo
      const putTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (putTodoMatch && method === 'PUT') {
        const id = putTodoMatch[1];
        const body: Partial<Todo> = await request.json();

        // Check if todo exists
        const existing = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(id)
          .first();

        if (!existing) {
          return new Response(JSON.stringify({ error: 'Todo not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        await env.todo_db.prepare(
          'UPDATE todos SET title = ?, description = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        )
          .bind(
            body.title !== undefined ? body.title : existing.title,
            body.description !== undefined ? body.description : existing.description,
            body.completed !== undefined ? body.completed : existing.completed,
            id
          )
          .run();

        const updated = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(id)
          .first();

        return new Response(JSON.stringify(updated), { headers: corsHeaders });
      }

      // DELETE /todos/:id - Delete a todo
      const deleteTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (deleteTodoMatch && method === 'DELETE') {
        const id = deleteTodoMatch[1];

        const existing = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(id)
          .first();

        if (!existing) {
          return new Response(JSON.stringify({ error: 'Todo not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        await env.todo_db.prepare('DELETE FROM todos WHERE id = ?')
          .bind(id)
          .run();

        return new Response(JSON.stringify({ message: 'Todo deleted successfully' }), {
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  },
};
