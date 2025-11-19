/**
 * API Client Service
 *
 * Base API client with automatic token management, retry logic, and error handling.
 * Provides methods for making HTTP requests with automatic token injection and refresh.
 */

import { CONFIG } from '../config.js';

/**
 * Base API Client class for making authenticated requests
 */
class ApiClient {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
        this.timeout = CONFIG.API_TIMEOUT;
        this.isRefreshing = false;
        this.refreshPromise = null;
    }

    /**
     * Get the stored access token
     * @returns {string|null} The access token or null if not found
     */
    getAccessToken() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
    }

    /**
     * Get the stored refresh token
     * @returns {string|null} The refresh token or null if not found
     */
    getRefreshToken() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    }

    /**
     * Save tokens to localStorage
     * @param {string} accessToken - JWT access token
     * @param {string} refreshToken - Refresh token UUID
     */
    saveTokens(accessToken, refreshToken) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        localStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }

    /**
     * Clear all stored tokens
     */
    clearTokens() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
    }

    /**
     * Create request headers with optional authentication
     * @param {boolean} includeAuth - Whether to include Authorization header
     * @param {Object} additionalHeaders - Additional headers to include
     * @returns {Object} Headers object
     */
    createHeaders(includeAuth = false, additionalHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...additionalHeaders
        };

        if (includeAuth) {
            const token = this.getAccessToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    /**
     * Create an AbortController for request timeout
     * @returns {AbortController}
     */
    createAbortController() {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), this.timeout);
        return controller;
    }

    /**
     * Attempt to refresh the access token
     * @returns {Promise<boolean>} True if refresh succeeded, false otherwise
     */
    async attemptTokenRefresh() {
        // If already refreshing, wait for the existing refresh attempt
        if (this.isRefreshing && this.refreshPromise) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = (async () => {
            try {
                const refreshToken = this.getRefreshToken();
                if (!refreshToken) {
                    if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
                        console.warn('No refresh token available');
                    }
                    this.clearTokens();
                    return false;
                }

                const controller = this.createAbortController();
                const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                    signal: controller.signal
                });

                if (!response.ok) {
                    if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
                        console.warn('Token refresh failed:', response.status);
                    }
                    this.clearTokens();
                    return false;
                }

                const data = await response.json();
                if (data.accessToken && data.refreshToken) {
                    this.saveTokens(data.accessToken, data.refreshToken);
                    return true;
                }

                this.clearTokens();
                return false;
            } catch (error) {
                if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
                    console.error('Token refresh error:', error);
                }
                this.clearTokens();
                return false;
            } finally {
                this.isRefreshing = false;
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    /**
     * Parse error response and return user-friendly message
     * @param {Response} response - Fetch response object
     * @returns {Promise<string>} Error message
     */
    async parseErrorMessage(response) {
        try {
            const data = await response.json();
            if (data.error && typeof data.error === 'string') {
                return data.error;
            }
            if (data.message && typeof data.message === 'string') {
                return data.message;
            }
        } catch (e) {
            // If JSON parsing fails, fall through to default messages
        }

        // Default error messages based on status code
        switch (response.status) {
            case 400:
                return 'Invalid request. Please check your input.';
            case 401:
                return 'Unauthorized. Please log in again.';
            case 403:
                return 'Access denied.';
            case 404:
                return 'Resource not found.';
            case 409:
                return 'Resource already exists.';
            case 413:
                return 'Request too large.';
            case 415:
                return 'Unsupported media type.';
            case 429:
                return 'Too many requests. Please try again later.';
            case 500:
                return 'Server error. Please try again later.';
            case 503:
                return 'Service unavailable. Please try again later.';
            default:
                return `Request failed with status ${response.status}.`;
        }
    }

    /**
     * Make an HTTP request with automatic retry on 401
     * @param {string} endpoint - API endpoint (without base URL)
     * @param {Object} options - Fetch options
     * @param {boolean} requiresAuth - Whether this request requires authentication
     * @param {boolean} isRetry - Internal flag to prevent infinite retry loops
     * @returns {Promise<Object>} Response object with { success, data?, error? }
     */
    async request(endpoint, options = {}, requiresAuth = false, isRetry = false) {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const controller = this.createAbortController();

            const headers = this.createHeaders(requiresAuth, options.headers || {});

            const fetchOptions = {
                ...options,
                headers,
                signal: controller.signal
            };

            const response = await fetch(url, fetchOptions);

            // Handle 401 Unauthorized - attempt token refresh
            if (response.status === 401 && requiresAuth && !isRetry) {
                if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
                    console.log('Received 401, attempting token refresh...');
                }

                const refreshSuccess = await this.attemptTokenRefresh();
                if (refreshSuccess) {
                    // Retry the request with new token
                    return this.request(endpoint, options, requiresAuth, true);
                }

                return {
                    success: false,
                    error: 'Session expired. Please log in again.'
                };
            }

            // Handle non-2xx responses
            if (!response.ok) {
                const errorMessage = await this.parseErrorMessage(response);
                return {
                    success: false,
                    error: errorMessage
                };
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return {
                    success: true,
                    data: null
                };
            }

            // Parse JSON response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                return {
                    success: true,
                    data
                };
            }

            // Non-JSON response
            return {
                success: false,
                error: 'Unexpected response format.'
            };

        } catch (error) {
            if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
                console.error('API request error:', error);
            }

            // Handle specific error types
            if (error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Request timed out. Please try again.'
                };
            }

            if (error instanceof TypeError && error.message.includes('fetch')) {
                return {
                    success: false,
                    error: 'Network error. Please check your connection.'
                };
            }

            return {
                success: false,
                error: 'An unexpected error occurred. Please try again.'
            };
        }
    }

    /**
     * Make a GET request
     * @param {string} endpoint - API endpoint
     * @param {boolean} requiresAuth - Whether authentication is required
     * @returns {Promise<Object>} Response object
     */
    async get(endpoint, requiresAuth = false) {
        return this.request(endpoint, { method: 'GET' }, requiresAuth);
    }

    /**
     * Make a POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @param {boolean} requiresAuth - Whether authentication is required
     * @returns {Promise<Object>} Response object
     */
    async post(endpoint, data = null, requiresAuth = false) {
        const options = {
            method: 'POST'
        };

        if (data !== null) {
            options.body = JSON.stringify(data);
        }

        return this.request(endpoint, options, requiresAuth);
    }

    /**
     * Make a PUT request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @param {boolean} requiresAuth - Whether authentication is required
     * @returns {Promise<Object>} Response object
     */
    async put(endpoint, data, requiresAuth = false) {
        return this.request(
            endpoint,
            {
                method: 'PUT',
                body: JSON.stringify(data)
            },
            requiresAuth
        );
    }

    /**
     * Make a DELETE request
     * @param {string} endpoint - API endpoint
     * @param {boolean} requiresAuth - Whether authentication is required
     * @returns {Promise<Object>} Response object
     */
    async delete(endpoint, requiresAuth = false) {
        return this.request(endpoint, { method: 'DELETE' }, requiresAuth);
    }
}

// Export singleton instance
export const apiClient = new ApiClient();
