/**
 * Main Cloudflare Worker entry point for the todo API
 */

import * as jose from 'jose';
import { CONFIG } from './config';
import type {
  Env,
  Todo,
  User,
  Category,
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
  validateTodoInput,
  validateCategoryInput
} from './validation';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  authenticate
} from './auth';
import { getSecurityHeaders } from './middleware/headers';

/**
 * Verify that a category exists and is accessible to the user
 * Categories are accessible if they are system categories (user_id IS NULL) OR owned by the user
 * @param categoryId - The category ID to verify
 * @param userId - The user ID making the request
 * @param db - The D1 database instance
 * @returns true if category is accessible, false otherwise
 */
async function verifyCategoryAccess(categoryId: number, userId: number, db: D1Database): Promise<boolean> {
  const category = await db.prepare(
    'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
  )
    .bind(categoryId, userId)
    .first();

  return category !== null;
}

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

      // GET /todos - List todos for authenticated user with pagination and optional category filtering
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
        const categoryIdParam = url.searchParams.get('category_id');

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

        // Build query with LEFT JOIN to include category data
        let query = `
          SELECT
            todos.id,
            todos.title,
            todos.description,
            todos.completed,
            todos.category_id,
            todos.user_id,
            todos.created_at,
            todos.updated_at,
            categories.id as category__id,
            categories.name as category__name,
            categories.color as category__color,
            categories.icon as category__icon
          FROM todos
          LEFT JOIN categories ON todos.category_id = categories.id
          WHERE todos.user_id = ?
        `;
        const queryParams: any[] = [user.userId];

        // Add category filter if provided
        if (categoryIdParam) {
          const categoryId = parseInt(categoryIdParam);
          if (isNaN(categoryId) || categoryId < 1) {
            return new Response(JSON.stringify({
              error: 'Invalid category_id parameter',
              message: 'Category ID must be a positive integer'
            }), {
              status: 400,
              headers
            });
          }
          query += ' AND todos.category_id = ?';
          queryParams.push(categoryId);
        }

        query += ' ORDER BY todos.created_at DESC LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        // Query todos with pagination and JOIN (filtered by user_id for user isolation)
        const { results } = await env.todo_db.prepare(query).bind(...queryParams).all();

        // Transform results to include nested category object
        const todos = results.map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          completed: row.completed,
          category_id: row.category_id,
          category: row.category__id ? {
            id: row.category__id,
            name: row.category__name,
            color: row.category__color,
            icon: row.category__icon
          } : null,
          user_id: row.user_id,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));

        // Build count query with category filter if applicable
        let countQuery = 'SELECT COUNT(*) as total FROM todos WHERE user_id = ?';
        const countParams: any[] = [user.userId];

        if (categoryIdParam) {
          const categoryId = parseInt(categoryIdParam);
          countQuery += ' AND category_id = ?';
          countParams.push(categoryId);
        }

        // Get total count for pagination metadata
        const countResult = await env.todo_db.prepare(countQuery)
          .bind(...countParams)
          .first() as { total: number } | null;

        const total = countResult?.total || 0;

        // Return paginated response with metadata
        return successResponse({
          todos,
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

        // Validate category access if category_id is provided
        if (validatedData.category_id !== undefined && validatedData.category_id !== null) {
          const hasAccess = await verifyCategoryAccess(validatedData.category_id, user.userId, env.todo_db);
          if (!hasAccess) {
            return errorResponse('Category not found or access denied', 400, headers);
          }
        }

        // Insert todo with validated data and user_id
        const result = await env.todo_db.prepare(
          'INSERT INTO todos (title, description, completed, category_id, user_id) VALUES (?, ?, ?, ?, ?)'
        )
          .bind(
            validatedData.title,
            validatedData.description !== undefined ? validatedData.description : null,
            validatedData.completed !== undefined ? validatedData.completed : 0,
            validatedData.category_id !== undefined ? validatedData.category_id : null,
            user.userId
          )
          .run();

        // Fetch the created todo with category data using LEFT JOIN
        const todoRow = await env.todo_db.prepare(`
          SELECT
            todos.id,
            todos.title,
            todos.description,
            todos.completed,
            todos.category_id,
            todos.user_id,
            todos.created_at,
            todos.updated_at,
            categories.id as category__id,
            categories.name as category__name,
            categories.color as category__color,
            categories.icon as category__icon
          FROM todos
          LEFT JOIN categories ON todos.category_id = categories.id
          WHERE todos.id = ?
        `)
          .bind(result.meta.last_row_id)
          .first();

        // Transform result to include nested category object
        const todo = todoRow ? {
          id: (todoRow as any).id,
          title: (todoRow as any).title,
          description: (todoRow as any).description,
          completed: (todoRow as any).completed,
          category_id: (todoRow as any).category_id,
          category: (todoRow as any).category__id ? {
            id: (todoRow as any).category__id,
            name: (todoRow as any).category__name,
            color: (todoRow as any).category__color,
            icon: (todoRow as any).category__icon
          } : null,
          user_id: (todoRow as any).user_id,
          created_at: (todoRow as any).created_at,
          updated_at: (todoRow as any).updated_at
        } : null;

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

        // Query todo with LEFT JOIN to include category data
        // Returns 404 if todo doesn't exist OR doesn't belong to user (don't reveal existence)
        const todoRow = await env.todo_db.prepare(`
          SELECT
            todos.id,
            todos.title,
            todos.description,
            todos.completed,
            todos.category_id,
            todos.user_id,
            todos.created_at,
            todos.updated_at,
            categories.id as category__id,
            categories.name as category__name,
            categories.color as category__color,
            categories.icon as category__icon
          FROM todos
          LEFT JOIN categories ON todos.category_id = categories.id
          WHERE todos.id = ? AND todos.user_id = ?
        `)
          .bind(id, user.userId)
          .first();

        if (!todoRow) {
          return notFoundResponse('Todo not found', headers);
        }

        // Transform result to include nested category object
        const todo = {
          id: (todoRow as any).id,
          title: (todoRow as any).title,
          description: (todoRow as any).description,
          completed: (todoRow as any).completed,
          category_id: (todoRow as any).category_id,
          category: (todoRow as any).category__id ? {
            id: (todoRow as any).category__id,
            name: (todoRow as any).category__name,
            color: (todoRow as any).category__color,
            icon: (todoRow as any).category__icon
          } : null,
          user_id: (todoRow as any).user_id,
          created_at: (todoRow as any).created_at,
          updated_at: (todoRow as any).updated_at
        };

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

        // Validate category access if category_id is provided and not null
        if (validatedData.category_id !== undefined && validatedData.category_id !== null) {
          const hasAccess = await verifyCategoryAccess(validatedData.category_id, user.userId, env.todo_db);
          if (!hasAccess) {
            return errorResponse('Category not found or access denied', 400, headers);
          }
        }

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
          'UPDATE todos SET title = ?, description = ?, completed = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
        )
          .bind(
            validatedData.title !== undefined ? validatedData.title : existing.title,
            validatedData.description !== undefined ? validatedData.description : existing.description,
            validatedData.completed !== undefined ? validatedData.completed : existing.completed,
            validatedData.category_id !== undefined ? validatedData.category_id : existing.category_id,
            id,
            user.userId
          )
          .run();

        // Fetch updated todo with LEFT JOIN to include category data
        const todoRow = await env.todo_db.prepare(`
          SELECT
            todos.id,
            todos.title,
            todos.description,
            todos.completed,
            todos.category_id,
            todos.user_id,
            todos.created_at,
            todos.updated_at,
            categories.id as category__id,
            categories.name as category__name,
            categories.color as category__color,
            categories.icon as category__icon
          FROM todos
          LEFT JOIN categories ON todos.category_id = categories.id
          WHERE todos.id = ? AND todos.user_id = ?
        `)
          .bind(id, user.userId)
          .first();

        // Transform result to include nested category object
        const updated = todoRow ? {
          id: (todoRow as any).id,
          title: (todoRow as any).title,
          description: (todoRow as any).description,
          completed: (todoRow as any).completed,
          category_id: (todoRow as any).category_id,
          category: (todoRow as any).category__id ? {
            id: (todoRow as any).category__id,
            name: (todoRow as any).category__name,
            color: (todoRow as any).category__color,
            icon: (todoRow as any).category__icon
          } : null,
          user_id: (todoRow as any).user_id,
          created_at: (todoRow as any).created_at,
          updated_at: (todoRow as any).updated_at
        } : null;

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

      // ========================================================================
      // CATEGORY ROUTES (All protected by JWT authentication)
      // ========================================================================

      // GET /categories - List categories for authenticated user (system + user categories)
      if (path === '/categories' && method === 'GET') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        // Query: system categories (user_id IS NULL) + user's custom categories
        // Ordered by: system categories first, then by sort_order, then by name
        const { results } = await env.todo_db.prepare(
          'SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY is_system DESC, sort_order ASC, name ASC'
        ).bind(user.userId).all<Category>();

        return successResponse({ categories: results }, headers);
      }

      // POST /categories - Create a new category for authenticated user
      if (path === '/categories' && method === 'POST') {
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
        const validation = validateCategoryInput(body, false);
        if (!validation.valid) {
          return validationErrorResponse(validation.error!, headers);
        }

        const validatedData = validation.data!;

        // Insert category with validated data and user_id
        // is_system = 0 for user categories, sort_order = 0 by default
        const result = await env.todo_db.prepare(
          'INSERT INTO categories (name, color, icon, user_id, is_system, sort_order) VALUES (?, ?, ?, ?, 0, 0)'
        )
          .bind(
            validatedData.name,
            validatedData.color,
            validatedData.icon,
            user.userId
          )
          .run();

        // Fetch the created category
        const category = await env.todo_db.prepare('SELECT * FROM categories WHERE id = ?')
          .bind(result.meta.last_row_id)
          .first<Category>();

        return createdResponse(category, headers);
      }

      // PUT /categories/:id - Update a category for authenticated user
      const putCategoryMatch = path.match(/^\/categories\/(\d+)$/);
      if (putCategoryMatch && method === 'PUT') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        const id = putCategoryMatch[1];

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

        // Comprehensive input validation (isUpdate = true, all fields optional)
        const validation = validateCategoryInput(body, true);
        if (!validation.valid) {
          return validationErrorResponse(validation.error!, headers);
        }

        const validatedData = validation.data!;

        // First check if category exists
        const existing = await env.todo_db.prepare(
          'SELECT * FROM categories WHERE id = ?'
        )
          .bind(id)
          .first<Category>();

        if (!existing) {
          return notFoundResponse('Not Found', headers);
        }

        // Check if it's a system category (cannot be modified)
        if (existing.is_system === 1) {
          return errorResponse('Cannot modify system categories', 403, headers);
        }

        // Check user ownership (user isolation)
        if (existing.user_id !== user.userId) {
          return notFoundResponse('Not Found', headers);
        }

        // Build dynamic UPDATE query for partial updates
        const updates: string[] = [];
        const values: any[] = [];

        if (validatedData.name !== undefined) {
          updates.push('name = ?');
          values.push(validatedData.name);
        }

        if (validatedData.color !== undefined) {
          updates.push('color = ?');
          values.push(validatedData.color);
        }

        if (validatedData.icon !== undefined) {
          updates.push('icon = ?');
          values.push(validatedData.icon);
        }

        // If no fields to update, return current category
        if (updates.length === 0) {
          return successResponse(existing, headers);
        }

        // Add ID and user_id to values array for WHERE clause
        values.push(id, user.userId);

        // Update category with user_id filter
        await env.todo_db.prepare(
          `UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
        )
          .bind(...values)
          .run();

        // Fetch updated category with user_id filter
        const updated = await env.todo_db.prepare(
          'SELECT * FROM categories WHERE id = ? AND user_id = ?'
        )
          .bind(id, user.userId)
          .first<Category>();

        return successResponse(updated, headers);
      }

      // DELETE /categories/:id - Delete a category for authenticated user
      const deleteCategoryMatch = path.match(/^\/categories\/(\d+)$/);
      if (deleteCategoryMatch && method === 'DELETE') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        const id = deleteCategoryMatch[1];

        // First check if category exists
        const existing = await env.todo_db.prepare(
          'SELECT * FROM categories WHERE id = ?'
        )
          .bind(id)
          .first<Category>();

        if (!existing) {
          return notFoundResponse('Not Found', headers);
        }

        // Check if it's a system category (cannot be deleted)
        if (existing.is_system === 1) {
          return errorResponse('Cannot delete system categories', 403, headers);
        }

        // Check user ownership (user isolation)
        if (existing.user_id !== user.userId) {
          return notFoundResponse('Not Found', headers);
        }

        // Unassign todos from this category (set category_id to NULL)
        await env.todo_db.prepare(
          'UPDATE todos SET category_id = NULL WHERE category_id = ? AND user_id = ?'
        )
          .bind(id, user.userId)
          .run();

        // Delete category with user_id filter to ensure user isolation
        await env.todo_db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?')
          .bind(id, user.userId)
          .run();

        return successResponse({ message: 'Category deleted successfully' }, headers);
      }

      // GET /categories/stats - Get todo counts per category for authenticated user
      if (path === '/categories/stats' && method === 'GET') {
        const headers = getSecurityHeaders(request, env);

        // Authenticate user - verify JWT token
        const authResult = await authenticate(request, env);
        if (authResult instanceof Response) {
          return authResult; // Return 401 error response
        }
        const user = authResult; // Extract authenticated user info

        // Query category stats: count todos and completed todos per category
        // Includes both system categories and user's custom categories
        // Uses LEFT JOIN to include categories with zero todos
        const { results: categoryStats } = await env.todo_db.prepare(`
          SELECT
            c.id,
            c.name,
            c.color,
            c.icon,
            c.is_system,
            c.sort_order,
            COUNT(t.id) as todo_count,
            SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_count
          FROM categories c
          LEFT JOIN todos t ON t.category_id = c.id AND t.user_id = ?
          WHERE c.user_id IS NULL OR c.user_id = ?
          GROUP BY c.id
          ORDER BY c.is_system DESC, c.sort_order ASC, c.name ASC
        `).bind(user.userId, user.userId).all();

        // Query uncategorized todos count (category_id IS NULL)
        const uncategorizedResult = await env.todo_db.prepare(`
          SELECT
            COUNT(*) as todo_count,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_count
          FROM todos
          WHERE user_id = ? AND category_id IS NULL
        `).bind(user.userId).first() as { todo_count: number; completed_count: number | null } | null;

        // Transform results to ensure proper number types and handle nulls
        const stats = categoryStats.map((row: any) => ({
          id: row.id,
          name: row.name,
          color: row.color,
          icon: row.icon,
          is_system: row.is_system,
          sort_order: row.sort_order,
          todo_count: row.todo_count || 0,
          completed_count: row.completed_count || 0
        }));

        const uncategorized = {
          todo_count: uncategorizedResult?.todo_count || 0,
          completed_count: uncategorizedResult?.completed_count || 0
        };

        return successResponse({
          stats,
          uncategorized
        }, headers);
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
