/**
 * Main Cloudflare Worker entry point for the todo API
 */

import * as jose from 'jose';
import { CONFIG } from './config';
import type {
  Env,
  Todo,
  User,
  AuthenticateResponse
} from './types';
import {
  errorResponse,
  validationErrorResponse,
  successResponse,
  createdResponse,
  notFoundResponse,
  unsupportedMediaTypeResponse,
  payloadTooLargeResponse,
  invalidJsonResponse
} from './utils/responses';
import {
  validateContentType,
  checkRequestSize,
  validateRegisterInput,
  validateLoginInput,
  validateLogoutInput,
  validateRefreshInput,
  validateTodoInput
} from './validation';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  authenticate
} from './auth';
import { getSecurityHeaders } from './middleware/headers';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle preflight OPTIONS requests
    if (method === 'OPTIONS') {
      return new Response(null, { headers: getSecurityHeaders(request, env) });
    }

    try {
      // ========================================================================
      // AUTHENTICATION ROUTES
      // ========================================================================

      // POST /auth/register - User registration endpoint
      if (path === '/auth/register' && method === 'POST') {
        const headers = getSecurityHeaders(request, env);

        // Validate Content-Type header (return 415 for wrong content type)
        if (!validateContentType(request)) {
          return unsupportedMediaTypeResponse(headers);
        }

        // Check request size to prevent DoS attacks
        if (!checkRequestSize(request)) {
          return payloadTooLargeResponse(headers);
        }

        // Parse request body
        let body: any;
        try {
          body = await request.json();
        } catch (error) {
          return invalidJsonResponse(headers);
        }

        // Comprehensive input validation
        const validation = validateRegisterInput(body);
        if (!validation.valid) {
          return validationErrorResponse(validation.error!, headers);
        }

        // Extract validated and normalized data
        const { email, password } = validation.data!;

        // Check if email already exists
        const existingUser = await env.todo_db.prepare(
          'SELECT id FROM users WHERE email = ?'
        )
          .bind(email)
          .first();

        if (existingUser) {
          return errorResponse('Email already exists', 409, headers);
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Insert user into database
        const userResult = await env.todo_db.prepare(
          'INSERT INTO users (email, password_hash) VALUES (?, ?)'
        )
          .bind(email, passwordHash)
          .run();

        const userId = userResult.meta.last_row_id as number;

        // Fetch the created user (excluding password_hash)
        const newUser = await env.todo_db.prepare(
          'SELECT id, email, created_at FROM users WHERE id = ?'
        )
          .bind(userId)
          .first<Omit<User, 'password_hash' | 'updated_at'>>();

        if (!newUser) {
          return errorResponse('Failed to create user', 500, headers);
        }

        // Generate access token (JWT)
        const accessToken = await generateAccessToken(newUser.id!, newUser.email, env);

        // Generate refresh token
        const refreshToken = generateRefreshToken();

        // Calculate refresh token expiration
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS);
        const expiresAtISO = expiresAt.toISOString();

        // Store refresh token in database
        await env.todo_db.prepare(
          'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
        )
          .bind(userId, refreshToken, expiresAtISO)
          .run();

        // Prepare response
        const response: AuthenticateResponse = {
          user: {
            id: newUser.id!,
            email: newUser.email,
            created_at: newUser.created_at!
          },
          accessToken,
          refreshToken
        };

        return createdResponse(response, headers);
      }

      // POST /auth/login - User login endpoint
      if (path === '/auth/login' && method === 'POST') {
        const headers = getSecurityHeaders(request, env);

        // Validate Content-Type header (return 415 for wrong content type)
        if (!validateContentType(request)) {
          return unsupportedMediaTypeResponse(headers);
        }

        // Check request size to prevent DoS attacks
        if (!checkRequestSize(request)) {
          return payloadTooLargeResponse(headers);
        }

        // Parse request body
        let body: any;
        try {
          body = await request.json();
        } catch (error) {
          return invalidJsonResponse(headers);
        }

        // Comprehensive input validation
        const validation = validateLoginInput(body);
        if (!validation.valid) {
          return validationErrorResponse(validation.error!, headers);
        }

        // Extract validated and normalized data
        const { email, password } = validation.data!;

        try {
          // Query database for user by email (already normalized to lowercase)
          // Note: We need to fetch password_hash for verification
          const user = await env.todo_db.prepare(
            'SELECT id, email, password_hash, created_at FROM users WHERE email = ?'
          )
            .bind(email)
            .first<User>();

          // Always run bcrypt comparison, even if user doesn't exist
          // Use a dummy hash that will never match to normalize timing
          // This prevents timing attacks that could enumerate valid email addresses
          const dummyHash = '$2a$10$invalidhashthatshouldnevermatchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
          const hashToCompare = user?.password_hash || dummyHash;
          const isValidPassword = await verifyPassword(password, hashToCompare);

          // Now both paths (user not found OR wrong password) take similar time
          if (!user || !isValidPassword) {
            console.log(`Login failed for email ${email}`);
            return errorResponse('Invalid credentials', 401, headers);
          }

          // Authentication successful - generate tokens
          const accessToken = await generateAccessToken(user.id!, user.email, env);
          const refreshToken = generateRefreshToken();

          // Calculate refresh token expiration
          const expiresAt = new Date(Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
          const expiresAtISO = expiresAt.toISOString();

          // Store refresh token in database
          await env.todo_db.prepare(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
          )
            .bind(user.id!, refreshToken, expiresAtISO)
            .run();

          // Prepare response (exclude password_hash)
          const response: AuthenticateResponse = {
            user: {
              id: user.id!,
              email: user.email,
              created_at: user.created_at!
            },
            accessToken,
            refreshToken
          };

          console.log(`Login successful for user ID ${user.id}`);

          return successResponse(response, headers);

        } catch (error) {
          // Log error details server-side but don't expose to client
          console.error('Login error:', error);
          return errorResponse('Internal server error during login', 500, headers);
        }
      }

      // POST /auth/logout - Logout endpoint with token blacklist
      if (path === '/auth/logout' && method === 'POST') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        // Extract the access token from Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return errorResponse('Token extraction failed', 500, headers);
        }
        const token = authHeader.substring(7); // Remove "Bearer " prefix

        try {
          // Get token expiration from JWT payload to store in blacklist
          const secret = new TextEncoder().encode(env.JWT_SECRET);
          const { payload } = await jose.jwtVerify(token, secret);

          // Convert Unix timestamp (seconds) to ISO date string for D1
          const expiresAt = new Date((payload.exp as number) * 1000).toISOString();

          // Add access token to blacklist table
          // This will be checked by verifyAccessToken() on all authenticated requests
          await env.todo_db.prepare(
            'INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?)'
          ).bind(token, expiresAt).run();

          // Parse request body to check for optional refresh token
          // Body is optional for logout, handle gracefully
          let body: any = {};
          try {
            // Content-Type validation is optional for logout since body is optional
            const contentType = request.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
              body = await request.json().catch(() => ({}));
            }
          } catch {
            // Body is optional, ignore parse errors
            body = {};
          }

          // Validate logout input if body exists
          let validatedData: { refreshToken?: string } = {};
          if (body && Object.keys(body).length > 0) {
            const validation = validateLogoutInput(body);
            if (!validation.valid) {
              return validationErrorResponse(validation.error!, headers);
            }
            validatedData = validation.data || {};
          }

          // If refresh token is provided, delete it from database
          // Only delete if it belongs to the authenticated user (security measure)
          if (validatedData.refreshToken) {
            await env.todo_db.prepare(
              'DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?'
            ).bind(validatedData.refreshToken, user.userId).run();

            console.log(`User ${user.userId} logged out - access token blacklisted, refresh token deleted`);
          } else {
            console.log(`User ${user.userId} logged out - access token blacklisted`);
          }

          return successResponse({ message: 'Logged out successfully' }, headers);

        } catch (error) {
          console.error('Logout error:', error);
          return errorResponse('Internal server error during logout', 500, headers);
        }
      }

      // POST /auth/refresh - Refresh token endpoint to get new access token
      if (path === '/auth/refresh' && method === 'POST') {
        const headers = getSecurityHeaders(request, env);

        // Validate Content-Type header (return 415 for wrong content type)
        if (!validateContentType(request)) {
          return unsupportedMediaTypeResponse(headers);
        }

        // Check request size to prevent DoS attacks
        if (!checkRequestSize(request)) {
          return payloadTooLargeResponse(headers);
        }

        // Parse request body
        let body: any;
        try {
          body = await request.json();
        } catch (error) {
          return invalidJsonResponse(headers);
        }

        // Comprehensive input validation
        const validation = validateRefreshInput(body);
        if (!validation.valid) {
          return validationErrorResponse(validation.error!, headers);
        }

        // Extract validated data
        const { refreshToken } = validation.data!;

        try {
          // Look up refresh token in database
          const tokenRecord = await env.todo_db.prepare(
            'SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?'
          ).bind(refreshToken).first() as { user_id: number; expires_at: string } | null;

          // Check if token exists
          if (!tokenRecord) {
            console.log('Refresh token not found');
            return errorResponse('Invalid refresh token', 401, headers);
          }

          // Check if token has expired
          const expiresAt = new Date(tokenRecord.expires_at);
          if (expiresAt < new Date()) {
            // Token expired - delete it from database
            await env.todo_db.prepare(
              'DELETE FROM refresh_tokens WHERE token = ?'
            ).bind(refreshToken).run();

            console.log('Refresh token expired and deleted');
            return errorResponse('Refresh token expired', 401, headers);
          }

          // Fetch user information to generate new access token
          const user = await env.todo_db.prepare(
            'SELECT id, email FROM users WHERE id = ?'
          ).bind(tokenRecord.user_id).first<Pick<User, 'id' | 'email'>>();

          if (!user) {
            // User doesn't exist (shouldn't happen, but handle gracefully)
            console.log('User not found for refresh token');
            return errorResponse('Invalid refresh token', 401, headers);
          }

          // Generate new access token for the user
          const accessToken = await generateAccessToken(user.id!, user.email, env);

          // REFRESH TOKEN ROTATION (Enhanced Security)
          // Delete the old refresh token and create a new one
          // This limits the attack window if a refresh token is stolen

          // 1. Delete the old refresh token
          await env.todo_db.prepare(
            'DELETE FROM refresh_tokens WHERE token = ?'
          ).bind(refreshToken).run();

          // 2. Generate new refresh token
          const newRefreshToken = generateRefreshToken();

          // 3. Calculate new expiration
          const newExpiresAt = new Date(Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
          const newExpiresAtISO = newExpiresAt.toISOString();

          // 4. Store new refresh token in database
          await env.todo_db.prepare(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
          ).bind(user.id, newRefreshToken, newExpiresAtISO).run();

          console.log(`Tokens rotated for user ${user.id}`);

          // 5. Return BOTH access token and NEW refresh token
          return successResponse({
            accessToken,
            refreshToken: newRefreshToken  // Client must update stored refresh token
          }, headers);

        } catch (error) {
          console.error('Refresh token error:', error);
          return errorResponse('Internal server error during token refresh', 500, headers);
        }
      }

      // ========================================================================
      // TODO ROUTES (All protected by JWT authentication)
      // ========================================================================

      // GET /todos - List todos for authenticated user with pagination
      if (path === '/todos' && method === 'GET') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        // Parse pagination parameters from query string
        const url = new URL(request.url);
        const limitParam = url.searchParams.get('limit');
        const offsetParam = url.searchParams.get('offset');

        // Default pagination values
        let limit = CONFIG.DEFAULT_PAGE_SIZE;
        let offset = 0;

        // Validate and parse limit parameter
        if (limitParam) {
          const parsedLimit = parseInt(limitParam);
          if (isNaN(parsedLimit) || parsedLimit < 1) {
            return new Response(JSON.stringify({
              error: 'Invalid limit parameter',
              message: 'Limit must be a positive integer'
            }), {
              status: 400,
              headers
            });
          }
          // Cap maximum limit to prevent abuse
          limit = Math.min(parsedLimit, CONFIG.MAX_PAGE_SIZE);
        }

        // Validate and parse offset parameter
        if (offsetParam) {
          const parsedOffset = parseInt(offsetParam);
          if (isNaN(parsedOffset) || parsedOffset < 0) {
            return new Response(JSON.stringify({
              error: 'Invalid offset parameter',
              message: 'Offset must be a non-negative integer'
            }), {
              status: 400,
              headers
            });
          }
          offset = parsedOffset;
        }

        // Query todos with pagination (filtered by user_id for user isolation)
        const { results } = await env.todo_db.prepare(
          'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        ).bind(user.userId, limit, offset).all<Todo>();

        // Get total count for pagination metadata
        const countResult = await env.todo_db.prepare(
          'SELECT COUNT(*) as total FROM todos WHERE user_id = ?'
        ).bind(user.userId).first() as { total: number } | null;

        const total = countResult?.total || 0;

        // Return paginated response with metadata
        return successResponse({
          todos: results,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total
          }
        }, headers);
      }

      // POST /todos - Create a new todo for authenticated user
      if (path === '/todos' && method === 'POST') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        // Validate Content-Type header
        if (!validateContentType(request)) {
          return unsupportedMediaTypeResponse(headers);
        }

        // Check request size
        if (!checkRequestSize(request)) {
          return payloadTooLargeResponse(headers);
        }

        // Parse request body
        let body: any;
        try {
          body = await request.json();
        } catch (error) {
          return invalidJsonResponse(headers);
        }

        // Comprehensive input validation
        const validation = validateTodoInput(body, false);
        if (!validation.valid) {
          return validationErrorResponse(validation.error!, headers);
        }

        const validatedData = validation.data!;

        // Insert todo with validated data and user_id
        const result = await env.todo_db.prepare(
          'INSERT INTO todos (title, description, completed, user_id) VALUES (?, ?, ?, ?)'
        )
          .bind(
            validatedData.title,
            validatedData.description !== undefined ? validatedData.description : null,
            validatedData.completed !== undefined ? validatedData.completed : 0,
            user.userId
          )
          .run();

        // Fetch the created todo
        const todo = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(result.meta.last_row_id)
          .first<Todo>();

        return createdResponse(todo, headers);
      }

      // GET /todos/:id - Get a specific todo for authenticated user
      const getTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (getTodoMatch && method === 'GET') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        const id = getTodoMatch[1];

        // Query todo with both id and user_id to ensure user isolation
        // Returns 404 if todo doesn't exist OR doesn't belong to user (don't reveal existence)
        const todo = await env.todo_db.prepare(
          'SELECT * FROM todos WHERE id = ? AND user_id = ?'
        )
          .bind(id, user.userId)
          .first<Todo>();

        if (!todo) {
          return notFoundResponse('Todo not found', headers);
        }

        return successResponse(todo, headers);
      }

      // PUT /todos/:id - Update a todo for authenticated user
      const putTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (putTodoMatch && method === 'PUT') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        const id = putTodoMatch[1];

        // Validate Content-Type header
        if (!validateContentType(request)) {
          return unsupportedMediaTypeResponse(headers);
        }

        // Check request size
        if (!checkRequestSize(request)) {
          return payloadTooLargeResponse(headers);
        }

        // Parse request body
        let body: any;
        try {
          body = await request.json();
        } catch (error) {
          return invalidJsonResponse(headers);
        }

        // Comprehensive input validation (isUpdate = true makes title optional)
        const validation = validateTodoInput(body, true);
        if (!validation.valid) {
          return validationErrorResponse(validation.error!, headers);
        }

        const validatedData = validation.data!;

        // Check if todo exists AND belongs to user (user isolation)
        // Returns 404 if todo doesn't exist OR doesn't belong to user (don't reveal existence)
        const existing = await env.todo_db.prepare(
          'SELECT * FROM todos WHERE id = ? AND user_id = ?'
        )
          .bind(id, user.userId)
          .first<Todo>();

        if (!existing) {
          return notFoundResponse('Todo not found', headers);
        }

        // Update todo with validated data
        await env.todo_db.prepare(
          'UPDATE todos SET title = ?, description = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
        )
          .bind(
            validatedData.title !== undefined ? validatedData.title : existing.title,
            validatedData.description !== undefined ? validatedData.description : existing.description,
            validatedData.completed !== undefined ? validatedData.completed : existing.completed,
            id,
            user.userId
          )
          .run();

        // Fetch updated todo with user_id filter
        const updated = await env.todo_db.prepare(
          'SELECT * FROM todos WHERE id = ? AND user_id = ?'
        )
          .bind(id, user.userId)
          .first<Todo>();

        return successResponse(updated, headers);
      }

      // DELETE /todos/:id - Delete a todo for authenticated user
      const deleteTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (deleteTodoMatch && method === 'DELETE') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        const id = deleteTodoMatch[1];

        // Check if todo exists AND belongs to user (user isolation)
        // Returns 404 if todo doesn't exist OR doesn't belong to user (don't reveal existence)
        const existing = await env.todo_db.prepare(
          'SELECT * FROM todos WHERE id = ? AND user_id = ?'
        )
          .bind(id, user.userId)
          .first<Todo>();

        if (!existing) {
          return notFoundResponse('Todo not found', headers);
        }

        // Delete todo with user_id filter to ensure user isolation
        await env.todo_db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?')
          .bind(id, user.userId)
          .run();

        return successResponse({ message: 'Todo deleted successfully' }, headers);
      }

      return notFoundResponse('Not Found', getSecurityHeaders(request, env));

    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        500,
        getSecurityHeaders(request, env)
      );
    }
  },
};
