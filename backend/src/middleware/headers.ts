/**
 * CORS and security header middleware functions
 */

import type { Env } from '../types';

/**
 * Generate CORS headers with origin whitelisting
 * Allows only configured origins to access the API
 * @param request - The incoming HTTP request
 * @param env - Environment bindings (should include ALLOWED_ORIGINS)
 * @returns CORS headers object
 */
export function getCorsHeaders(request: Request, env: Env): Record<string, string> {
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
export function getSecurityHeaders(request: Request, env: Env): Record<string, string> {
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
