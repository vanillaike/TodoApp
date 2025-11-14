/**
 * JWT Decoder Utility
 *
 * Client-side JWT token decoding and validation.
 * Note: This does NOT verify signatures - only decodes and checks expiration.
 * Signature verification should be done server-side.
 */

/**
 * Decode a JWT token and extract its payload
 * @param {string} token - JWT token string
 * @returns {object|null} Decoded payload object or null if invalid
 */
export function decodeJWT(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];

    // Base64url decode: replace - with + and _ with /
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

    // Decode base64 and parse JSON
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Check if a JWT token is expired
 * @param {string} token - JWT token string
 * @returns {boolean} True if token is expired or invalid, false if still valid
 */
export function isTokenExpired(token) {
  const payload = decodeJWT(token);

  if (!payload || !payload.exp) {
    return true; // Invalid token or missing expiration
  }

  // exp is in seconds, Date.now() is in milliseconds
  const currentTime = Math.floor(Date.now() / 1000);

  return payload.exp < currentTime;
}

/**
 * Get token expiration timestamp
 * @param {string} token - JWT token string
 * @returns {number|null} Expiration timestamp (seconds since epoch) or null if invalid
 */
export function getTokenExpiration(token) {
  const payload = decodeJWT(token);

  if (!payload || !payload.exp) {
    return null;
  }

  return payload.exp;
}

/**
 * Extract user information from JWT token
 * @param {string} token - JWT token string
 * @returns {object|null} User object with { userId, email } or null if invalid
 */
export function getUserFromToken(token) {
  const payload = decodeJWT(token);

  if (!payload) {
    return null;
  }

  // Extract userId and email from payload
  // Server sends: { userId, email, iat, exp }
  const { userId, email } = payload;

  if (!userId || !email) {
    return null;
  }

  return { userId, email };
}
