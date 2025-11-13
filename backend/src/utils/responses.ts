/**
 * Response helper functions for standardized API responses
 * Ensures consistent JSON structure and headers across all endpoints
 */

/**
 * Create a standardized error response
 * @param message - Error message to return
 * @param status - HTTP status code
 * @param headers - Response headers (should include CORS and security headers)
 * @returns Response object with error JSON
 */
export function errorResponse(
  message: string,
  status: number,
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers
  });
}

/**
 * Create a validation error response (400 Bad Request)
 * Used for input validation failures with detailed error message
 * @param message - Detailed validation error message
 * @param headers - Response headers (should include CORS and security headers)
 * @returns Response object with validation error JSON
 */
export function validationErrorResponse(
  message: string,
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify({
    error: 'Validation failed',
    message
  }), {
    status: 400,
    headers
  });
}

/**
 * Create a standardized success response with data
 * @param data - Data to return in response body
 * @param headers - Response headers (should include CORS and security headers)
 * @param status - HTTP status code (default: 200)
 * @returns Response object with data JSON
 */
export function successResponse<T>(
  data: T,
  headers: Record<string, string>,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

/**
 * Create a 201 Created response
 * Used when a resource is successfully created
 * @param data - Created resource data
 * @param headers - Response headers (should include CORS and security headers)
 * @returns Response object with 201 status and data JSON
 */
export function createdResponse<T>(
  data: T,
  headers: Record<string, string>
): Response {
  return successResponse(data, headers, 201);
}

/**
 * Create a 404 Not Found response
 * @param message - Error message explaining what was not found
 * @param headers - Response headers (should include CORS and security headers)
 * @returns Response object with 404 status and error JSON
 */
export function notFoundResponse(
  message: string,
  headers: Record<string, string>
): Response {
  return errorResponse(message, 404, headers);
}

/**
 * Create a 415 Unsupported Media Type response
 * Used when Content-Type validation fails
 * @param headers - Response headers (should include CORS and security headers)
 * @returns Response object with 415 status and error JSON
 */
export function unsupportedMediaTypeResponse(
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify({
    error: 'Unsupported Media Type',
    message: 'Content-Type must be application/json'
  }), {
    status: 415,
    headers
  });
}

/**
 * Create a 413 Payload Too Large response
 * Used when request size exceeds limits
 * @param headers - Response headers (should include CORS and security headers)
 * @returns Response object with 413 status and error JSON
 */
export function payloadTooLargeResponse(
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify({
    error: 'Payload Too Large',
    message: 'Request body must be 10KB or less'
  }), {
    status: 413,
    headers
  });
}

/**
 * Create a 400 Bad Request response for invalid JSON
 * Used when JSON parsing fails
 * @param headers - Response headers (should include CORS and security headers)
 * @returns Response object with 400 status and error JSON
 */
export function invalidJsonResponse(
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify({
    error: 'Invalid JSON',
    message: 'Request body must be valid JSON'
  }), {
    status: 400,
    headers
  });
}
