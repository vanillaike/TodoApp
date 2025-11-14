/**
 * Authentication and JWT functions for the todo API
 * Handles password hashing, token generation, and verification
 */

import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { CONFIG } from './config';
import type { Env, AuthenticatedUser } from './types';
import { errorResponse } from './utils/responses';
import { getCorsHeaders } from './middleware/headers';

/**
 * Hash a password using bcrypt with configured rounds
 * @param password - Plain text password to hash
 * @returns Promise resolving to bcrypt hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 * Uses timing-safe comparison via bcrypt.compare()
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT access token with configured expiration
 * @param userId - User's database ID
 * @param email - User's email address
 * @param env - Environment bindings (contains JWT_SECRET)
 * @returns Promise resolving to signed JWT string
 */
export async function generateAccessToken(userId: number, email: string, env: Env): Promise<string> {
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
export function generateRefreshToken(): string {
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
export async function verifyAccessToken(token: string, env: Env): Promise<{ userId: number; email: string } | null> {
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
export async function authenticate(request: Request, env: Env): Promise<AuthenticatedUser | Response> {
  // Get security headers for error responses
  const headers = {
    ...getCorsHeaders(request, env),
    'Content-Type': 'application/json',

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
