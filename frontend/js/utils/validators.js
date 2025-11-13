/**
 * Client-Side Validation Utilities
 *
 * Provides validation functions for user input.
 * Validation rules should match backend validation for consistency.
 */

import { CONFIG } from '../config.js';

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
export function validateEmail(email) {
  // Trim whitespace
  const trimmedEmail = email?.trim() || '';

  // Check if email is provided
  if (!trimmedEmail) {
    return { valid: false, error: 'Email is required' };
  }

  // Check max length
  if (trimmedEmail.length > CONFIG.VALIDATION.EMAIL_MAX_LENGTH) {
    return {
      valid: false,
      error: `Email must not exceed ${CONFIG.VALIDATION.EMAIL_MAX_LENGTH} characters`
    };
  }

  // RFC 5322 basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}

/**
 * Validate password length and requirements
 * @param {string} password - Password to validate
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
export function validatePassword(password) {
  // Check if password is provided
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  // Check minimum length
  if (password.length < CONFIG.AUTH.PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${CONFIG.AUTH.PASSWORD_MIN_LENGTH} characters`
    };
  }

  // Check maximum length
  if (password.length > CONFIG.AUTH.PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must not exceed ${CONFIG.AUTH.PASSWORD_MAX_LENGTH} characters`
    };
  }

  return { valid: true };
}

/**
 * Validate password confirmation matches
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
export function validatePasswordMatch(password, confirmPassword) {
  if (!confirmPassword) {
    return { valid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }

  return { valid: true };
}

/**
 * Validate todo title
 * @param {string} title - Todo title to validate
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
export function validateTodoTitle(title) {
  // Trim whitespace
  const trimmedTitle = title?.trim() || '';

  // Check if title is provided
  if (!trimmedTitle) {
    return { valid: false, error: 'Title is required' };
  }

  // Check minimum length (at least 1 character after trim)
  if (trimmedTitle.length < 1) {
    return { valid: false, error: 'Title cannot be empty' };
  }

  // Check maximum length
  if (trimmedTitle.length > CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH) {
    return {
      valid: false,
      error: `Title must not exceed ${CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH} characters`
    };
  }

  return { valid: true };
}

/**
 * Validate todo description (optional field)
 * @param {string} description - Todo description to validate
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
export function validateTodoDescription(description) {
  // Description is optional, so empty/undefined is valid
  if (!description) {
    return { valid: true };
  }

  // Trim whitespace
  const trimmedDescription = description.trim();

  // Check maximum length
  if (trimmedDescription.length > CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH) {
    return {
      valid: false,
      error: `Description must not exceed ${CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH} characters`
    };
  }

  return { valid: true };
}
