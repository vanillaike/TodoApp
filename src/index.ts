export interface Env {
  todo_db: D1Database;
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string; // Optional: comma-separated list of allowed origins for CORS
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

// Authentication request (used by both registration and login)
interface AuthenticateRequest {
  email: string;
  password: string;
}

// Authentication response (used by both registration and login)
// Excludes password_hash for security
interface AuthenticateResponse {
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

// Authenticated user info extracted from JWT
interface AuthenticatedUser {
  userId: number;
  email: string;
}

// Generic validation result interface for input validation
interface ValidationResult<T = any> {
  valid: boolean;
  error?: string;
  data?: T;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { CONFIG } from './config';
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

/**
 * Generate CORS headers with origin whitelisting
 * Allows only configured origins to access the API
 * @param request - The incoming HTTP request
 * @param env - Environment bindings (should include ALLOWED_ORIGINS)
 * @returns CORS headers object
 */
function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');

  // Get allowed origins from environment variable (comma-separated list)
  const allowedOriginsEnv = env.ALLOWED_ORIGINS || '';

  // Parse allowed origins
  const allowedOrigins: string[] = allowedOriginsEnv
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0);

  // Development mode: if ALLOWED_ORIGINS is not set or empty, allow localhost
  const isDevelopment = allowedOrigins.length === 0;

  let allowOrigin = 'null'; // Default: deny all

  if (isDevelopment) {
    // Development: allow localhost and any origin for testing
    if (origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      allowOrigin = origin;
    } else {
      // Fallback for development when no origin header
      allowOrigin = '*';
    }
  } else {
    // Production: strict origin checking
    if (origin && allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    'Content-Type': 'application/json',
  };
}

/**
 * Generate security headers for all responses
 * Implements defense-in-depth security measures
 * @param request - The incoming HTTP request (for CORS)
 * @param env - Environment bindings
 * @returns Combined CORS and security headers
 */
function getSecurityHeaders(request: Request, env: Env): Record<string, string> {
  return {
    ...getCorsHeaders(request, env),

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Prevent clickjacking attacks
    'X-Frame-Options': 'DENY',

    // Enable browser XSS protection (legacy, but doesn't hurt)
    'X-XSS-Protection': '1; mode=block',

    // Enforce HTTPS (only in production, skip for localhost)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    // Content Security Policy (strict for API)
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",

    // Control referrer information
    'Referrer-Policy': 'no-referrer',

    // Disable unnecessary browser features
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',

    // Prevent caching of sensitive responses
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

/**
 * Hash a password using bcrypt with configured rounds
 * @param password - Plain text password to hash
 * @returns Promise resolving to bcrypt hash string
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 * Uses timing-safe comparison via bcrypt.compare()
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate Content-Type header for JSON requests
 * Ensures request has application/json content type
 * @param request - The incoming HTTP request
 * @returns true if Content-Type includes application/json, false otherwise
 */
function validateContentType(request: Request): boolean {
  const contentType = request.headers.get('Content-Type');
  return contentType?.includes('application/json') || false;
}

/**
 * Check if request body size is within acceptable limits
 * Prevents denial-of-service attacks from oversized payloads
 * @param request - The incoming HTTP request
 * @param maxSizeBytes - Maximum allowed size in bytes (default: from CONFIG)
 * @returns true if size is acceptable, false if too large
 */
function checkRequestSize(request: Request, maxSizeBytes: number = CONFIG.MAX_REQUEST_SIZE_BYTES): boolean {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength) {
    const size = parseInt(contentLength);
    return size <= maxSizeBytes;
  }
  // If no Content-Length header, allow the request (will be caught during JSON parsing if too large)
  return true;
}

/**
 * Validate email format using enhanced regex and length constraints
 * Performs normalization checks and validates RFC-compliant email structure
 * @param email - Email address to validate
 * @returns true if email format is valid, false otherwise
 */
function validateEmail(email: string): boolean {
  // Check email length (max per RFC standards)
  if (!email || email.length === 0 || email.length > CONFIG.EMAIL_MAX_LENGTH) {
    return false;
  }

  // More robust email regex pattern
  // Validates: local-part@domain.tld structure
  // Allows alphanumeric, dots, hyphens, underscores, plus signs
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(email)) {
    return false;
  }

  // Additional validation: check for consecutive dots or dots at start/end of local part
  const localPart = email.split('@')[0];
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }

  return true;
}

/**
 * Validate password strength requirements with length constraints
 * Enforces minimum length, at least 1 letter and 1 number
 * Maximum length to prevent DoS attacks
 * @param password - Password to validate
 * @returns Object with valid boolean and optional error message
 */
function validatePassword(password: string): PasswordValidation {
  if (!password || password.length < CONFIG.PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${CONFIG.PASSWORD_MIN_LENGTH} characters long`
    };
  }

  // Enforce maximum length to prevent denial-of-service via bcrypt
  if (password.length > CONFIG.PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must be ${CONFIG.PASSWORD_MAX_LENGTH} characters or less`
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
 * Validate authentication input (used by both register and login)
 * @param body - Request body to validate
 * @param requirePasswordStrength - Whether to enforce password strength rules
 * @returns ValidationResult with validated data or error message
 */
function validateAuthInput(
  body: any,
  requirePasswordStrength: boolean
): ValidationResult<AuthenticateRequest> {
  // Validate body structure
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  // Check for unknown fields
  const allowedFields = ['email', 'password'];
  const providedFields = Object.keys(body);
  const unknownFields = providedFields.filter(f => !allowedFields.includes(f));
  if (unknownFields.length > 0) {
    return {
      valid: false,
      error: `Unknown fields: ${unknownFields.join(', ')}. Only email and password are allowed.`
    };
  }

  // Validate email field
  if (!body.email || typeof body.email !== 'string') {
    return { valid: false, error: 'Email is required and must be a string' };
  }

  const email = body.email.trim().toLowerCase();

  if (email.length === 0) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  if (email.length > CONFIG.EMAIL_MAX_LENGTH) {
    return { valid: false, error: `Email must be ${CONFIG.EMAIL_MAX_LENGTH} characters or less` };
  }

  if (!validateEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Validate password field
  if (!body.password || typeof body.password !== 'string') {
    return { valid: false, error: 'Password is required and must be a string' };
  }

  const password = body.password;

  if (password.length === 0) {
    return { valid: false, error: 'Password cannot be empty' };
  }

  // Optionally validate password strength (for registration only)
  if (requirePasswordStrength) {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return { valid: false, error: passwordValidation.error };
    }
  }

  return { valid: true, data: { email, password } };
}

/**
 * Comprehensive validation for registration input
 * Validates email and password with type checking, length limits, and unknown field rejection
 * @param body - Request body to validate (should contain email and password)
 * @returns ValidationResult with validated data or error message
 */
function validateRegisterInput(body: any): ValidationResult<AuthenticateRequest> {
  return validateAuthInput(body, true);
}

/**
 * Comprehensive validation for login input
 * Validates email and password presence with type checking and unknown field rejection
 * @param body - Request body to validate (should contain email and password)
 * @returns ValidationResult with validated data or error message
 */
function validateLoginInput(body: any): ValidationResult<AuthenticateRequest> {
  return validateAuthInput(body, false);
}

/**
 * Comprehensive validation for logout input
 * Validates optional refreshToken field with type checking and unknown field rejection
 * @param body - Request body to validate (may contain optional refreshToken)
 * @returns ValidationResult with validated data or error message
 */
function validateLogoutInput(body: any): ValidationResult<{ refreshToken?: string }> {
  // Body is optional for logout - if not provided or empty, that's valid
  if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
    return { valid: true, data: {} };
  }

  // Check body is a valid object (not array, null, etc.)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  // Check for unknown fields (security: only allow refreshToken)
  const allowedFields = ['refreshToken'];
  const providedFields = Object.keys(body);
  const unknownFields = providedFields.filter(f => !allowedFields.includes(f));
  if (unknownFields.length > 0) {
    return {
      valid: false,
      error: `Unknown fields: ${unknownFields.join(', ')}. Only refreshToken is allowed.`
    };
  }

  // If refreshToken is provided, validate it's a string
  if (body.refreshToken !== undefined) {
    if (typeof body.refreshToken !== 'string') {
      return { valid: false, error: 'refreshToken must be a string' };
    }

    if (body.refreshToken.trim().length === 0) {
      return { valid: false, error: 'refreshToken cannot be empty' };
    }
  }

  // All validation passed
  return {
    valid: true,
    data: body.refreshToken ? { refreshToken: body.refreshToken } : {}
  };
}

/**
 * Comprehensive validation for refresh token input
 * Validates required refreshToken with UUID format checking and unknown field rejection
 * @param body - Request body to validate (must contain refreshToken)
 * @returns ValidationResult with validated data or error message
 */
function validateRefreshInput(body: any): ValidationResult<{ refreshToken: string }> {
  // Check body is a valid object (not array, null, etc.)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  // Check for unknown fields (security: only allow refreshToken)
  const allowedFields = ['refreshToken'];
  const providedFields = Object.keys(body);
  const unknownFields = providedFields.filter(f => !allowedFields.includes(f));
  if (unknownFields.length > 0) {
    return {
      valid: false,
      error: `Unknown fields: ${unknownFields.join(', ')}. Only refreshToken is allowed.`
    };
  }

  // Validate refreshToken is provided and is a string
  if (!body.refreshToken || typeof body.refreshToken !== 'string') {
    return { valid: false, error: 'refreshToken is required and must be a string' };
  }

  const refreshToken = body.refreshToken.trim();

  // Check refreshToken is not empty after trimming
  if (refreshToken.length === 0) {
    return { valid: false, error: 'refreshToken cannot be empty' };
  }

  // Validate UUID format (since we use crypto.randomUUID())
  // UUID v4 format: 8-4-4-4-12 hexadecimal characters
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(refreshToken)) {
    return { valid: false, error: 'refreshToken must be a valid UUID format' };
  }

  // All validation passed
  return {
    valid: true,
    data: { refreshToken }
  };
}

/**
 * Comprehensive validation for todo input
 * Validates title and description with length limits and type checking
 * @param body - Request body to validate
 * @param isUpdate - Whether this is an update (makes title optional)
 * @returns ValidationResult with validated data or error message
 */
function validateTodoInput(body: any, isUpdate: boolean = false): ValidationResult<{
  title?: string;
  description?: string | null;
  completed?: number;
}> {
  // Check body is a valid object (not array, null, etc.)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  // Check for unknown fields (security: reject extra fields)
  const allowedFields = ['title', 'description', 'completed'];
  const providedFields = Object.keys(body);
  const unknownFields = providedFields.filter(f => !allowedFields.includes(f));
  if (unknownFields.length > 0) {
    return {
      valid: false,
      error: `Unknown fields: ${unknownFields.join(', ')}. Only title, description, and completed are allowed.`
    };
  }

  const validated: any = {};

  // Validate title (required for create, optional for update)
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return { valid: false, error: 'Title must be a string' };
    }

    const title = body.title.trim();

    if (title.length === 0) {
      return { valid: false, error: 'Title cannot be empty' };
    }

    // Enforce maximum title length
    if (title.length > CONFIG.TITLE_MAX_LENGTH) {
      return { valid: false, error: `Title must be ${CONFIG.TITLE_MAX_LENGTH} characters or less` };
    }

    validated.title = title;
  } else if (!isUpdate) {
    return { valid: false, error: 'Title is required' };
  }

  // Validate description (optional)
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return { valid: false, error: 'Description must be a string or null' };
    }

    if (body.description !== null && body.description.length > CONFIG.DESCRIPTION_MAX_LENGTH) {
      return { valid: false, error: `Description must be ${CONFIG.DESCRIPTION_MAX_LENGTH} characters or less` };
    }

    validated.description = body.description;
  }

  // Validate completed (optional)
  if (body.completed !== undefined) {
    // Accept boolean or number (0/1)
    if (typeof body.completed === 'boolean') {
      validated.completed = body.completed ? 1 : 0;
    } else if (typeof body.completed === 'number') {
      if (body.completed !== 0 && body.completed !== 1) {
        return { valid: false, error: 'Completed must be 0 or 1' };
      }
      validated.completed = body.completed;
    } else {
      return { valid: false, error: 'Completed must be a boolean or 0/1' };
    }
  }

  return { valid: true, data: validated };
}

/**
 * Generate a JWT access token with configured expiration
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
    .setExpirationTime(CONFIG.ACCESS_TOKEN_EXPIRY)
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

/**
 * Verify a JWT access token and return user information
 * Checks token signature, expiration, and blacklist status
 *
 * TODO: Implement periodic cleanup of expired tokens from token_blacklist table.
 * This can be done via a Cloudflare scheduled worker or cron trigger:
 * DELETE FROM token_blacklist WHERE expires_at < CURRENT_TIMESTAMP
 * Recommended frequency: daily or weekly depending on logout volume
 *
 * @param token - JWT access token to verify
 * @param env - Environment bindings (contains JWT_SECRET and todo_db)
 * @returns User info { userId, email } if valid, null if invalid/expired/blacklisted
 */
async function verifyAccessToken(token: string, env: Env): Promise<{ userId: number; email: string } | null> {
  try {
    // Convert JWT_SECRET string to Uint8Array for jose library
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    // Verify token signature and expiration using jose library
    const { payload } = await jose.jwtVerify(token, secret);

    // Check if token has been blacklisted (user logged out)
    const blacklisted = await env.todo_db.prepare(
      'SELECT 1 FROM token_blacklist WHERE token = ?'
    ).bind(token).first();

    if (blacklisted) {
      console.log('Token verification failed: Token is blacklisted');
      return null;
    }

    // Extract and return user information from JWT payload
    return {
      userId: payload.userId as number,
      email: payload.email as string
    };
  } catch (error) {
    // Token is invalid, expired, or malformed
    console.log('Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Authentication middleware - extracts and verifies JWT from Authorization header
 * Returns user info if valid, or 401 Response if authentication fails
 * @param request - The incoming HTTP request
 * @param env - Environment bindings
 * @returns User info { userId, email } or 401 Response with error message
 */
async function authenticate(request: Request, env: Env): Promise<AuthenticatedUser | Response> {
  // Get security headers for error responses
  const headers = getSecurityHeaders(request, env);

  // Extract Authorization header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return errorResponse('Authorization header required', 401, headers);
  }

  // Check if header starts with "Bearer "
  if (!authHeader.startsWith('Bearer ')) {
    return errorResponse('Invalid authorization format. Use: Bearer <token>', 401, headers);
  }

  // Extract token from "Bearer <token>"
  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Verify the token
  const userInfo = await verifyAccessToken(token, env);

  if (!userInfo) {
    return errorResponse('Invalid or expired token', 401, headers);
  }

  // Return authenticated user info
  return userInfo;
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
