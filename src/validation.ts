/**
 * Validation functions for the todo API
 * Handles input validation for authentication, todos, and request format
 */

import { CONFIG } from './config';
import type {
  ValidationResult,
  AuthenticateRequest,
  PasswordValidation
} from './types';

/**
 * Validate Content-Type header for JSON requests
 * Ensures request has application/json content type
 * @param request - The incoming HTTP request
 * @returns true if Content-Type includes application/json, false otherwise
 */
export function validateContentType(request: Request): boolean {
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
export function checkRequestSize(request: Request, maxSizeBytes: number = CONFIG.MAX_REQUEST_SIZE_BYTES): boolean {
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
export function validateEmail(email: string): boolean {
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
export function validatePassword(password: string): PasswordValidation {
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
export function validateRegisterInput(body: any): ValidationResult<AuthenticateRequest> {
  return validateAuthInput(body, true);
}

/**
 * Comprehensive validation for login input
 * Validates email and password presence with type checking and unknown field rejection
 * @param body - Request body to validate (should contain email and password)
 * @returns ValidationResult with validated data or error message
 */
export function validateLoginInput(body: any): ValidationResult<AuthenticateRequest> {
  return validateAuthInput(body, false);
}

/**
 * Comprehensive validation for logout input
 * Validates optional refreshToken field with type checking and unknown field rejection
 * @param body - Request body to validate (may contain optional refreshToken)
 * @returns ValidationResult with validated data or error message
 */
export function validateLogoutInput(body: any): ValidationResult<{ refreshToken?: string }> {
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
export function validateRefreshInput(body: any): ValidationResult<{ refreshToken: string }> {
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
export function validateTodoInput(body: any, isUpdate: boolean = false): ValidationResult<{
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
