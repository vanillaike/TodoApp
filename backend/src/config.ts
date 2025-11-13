/**
 * Application configuration constants
 * Centralizes all magic numbers and configuration values for easier maintenance
 */
export const CONFIG = {
  // Request limits
  MAX_REQUEST_SIZE_BYTES: 10_240 as number, // 10KB - Prevents DoS attacks from oversized payloads

  // Authentication
  ACCESS_TOKEN_EXPIRY: '7d' as string, // 7 days - JWT access token expiration
  REFRESH_TOKEN_EXPIRY_DAYS: 30 as number, // 30 days - Refresh token expiration
  BCRYPT_ROUNDS: 10 as number, // bcrypt hashing rounds

  // Validation limits
  EMAIL_MAX_LENGTH: 255 as number, // Maximum email length per RFC standards
  PASSWORD_MIN_LENGTH: 8 as number, // Minimum password length for security
  PASSWORD_MAX_LENGTH: 128 as number, // Maximum password length to prevent DoS via bcrypt
  TITLE_MAX_LENGTH: 200 as number, // Maximum todo title length
  DESCRIPTION_MAX_LENGTH: 2000 as number, // Maximum todo description length

  // Pagination
  DEFAULT_PAGE_SIZE: 50 as number, // Default number of items per page
  MAX_PAGE_SIZE: 100 as number, // Maximum page size to prevent abuse
};
