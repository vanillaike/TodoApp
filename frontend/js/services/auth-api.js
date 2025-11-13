/**
 * Authentication API Service
 *
 * Handles all authentication-related API calls including registration, login, logout, and token refresh.
 * Uses the base API client for making requests.
 */

import { CONFIG } from '../config.js';
import { apiClient } from './api-client.js';

/**
 * Register a new user account
 * @param {string} email - User email address
 * @param {string} password - User password (min 8 characters)
 * @returns {Promise<Object>} Response object with { success, data: { user, accessToken, refreshToken }, error? }
 */
export async function register(email, password) {
    try {
        // Basic validation
        if (!email || typeof email !== 'string') {
            return {
                success: false,
                error: 'Email is required.'
            };
        }

        if (!password || typeof password !== 'string') {
            return {
                success: false,
                error: 'Password is required.'
            };
        }

        if (password.length < CONFIG.AUTH.MIN_PASSWORD_LENGTH) {
            return {
                success: false,
                error: `Password must be at least ${CONFIG.AUTH.MIN_PASSWORD_LENGTH} characters long.`
            };
        }

        if (password.length > CONFIG.AUTH.MAX_PASSWORD_LENGTH) {
            return {
                success: false,
                error: `Password must not exceed ${CONFIG.AUTH.MAX_PASSWORD_LENGTH} characters.`
            };
        }

        if (email.length > CONFIG.AUTH.EMAIL_MAX_LENGTH) {
            return {
                success: false,
                error: `Email must not exceed ${CONFIG.AUTH.EMAIL_MAX_LENGTH} characters.`
            };
        }

        // Make API request
        const response = await apiClient.post('/auth/register', {
            email: email.trim(),
            password
        }, false);

        if (!response.success) {
            return response;
        }

        // Validate response structure
        const { data } = response;
        if (!data || !data.user || !data.accessToken || !data.refreshToken) {
            return {
                success: false,
                error: 'Invalid response from server.'
            };
        }

        // Store tokens
        apiClient.saveTokens(data.accessToken, data.refreshToken);

        // Store user data
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log('Registration successful:', data.user.email);
        }

        return {
            success: true,
            data: {
                user: data.user,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken
            }
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Registration error:', error);
        }
        return {
            success: false,
            error: 'Registration failed. Please try again.'
        };
    }
}

/**
 * Login with existing user credentials
 * @param {string} email - User email address
 * @param {string} password - User password
 * @returns {Promise<Object>} Response object with { success, data: { user, accessToken, refreshToken }, error? }
 */
export async function login(email, password) {
    try {
        // Basic validation
        if (!email || typeof email !== 'string') {
            return {
                success: false,
                error: 'Email is required.'
            };
        }

        if (!password || typeof password !== 'string') {
            return {
                success: false,
                error: 'Password is required.'
            };
        }

        // Make API request
        const response = await apiClient.post('/auth/login', {
            email: email.trim(),
            password
        }, false);

        if (!response.success) {
            return response;
        }

        // Validate response structure
        const { data } = response;
        if (!data || !data.user || !data.accessToken || !data.refreshToken) {
            return {
                success: false,
                error: 'Invalid response from server.'
            };
        }

        // Store tokens
        apiClient.saveTokens(data.accessToken, data.refreshToken);

        // Store user data
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log('Login successful:', data.user.email);
        }

        return {
            success: true,
            data: {
                user: data.user,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken
            }
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Login error:', error);
        }
        return {
            success: false,
            error: 'Login failed. Please try again.'
        };
    }
}

/**
 * Logout current user and invalidate tokens
 * @param {boolean} includeRefreshToken - Whether to also invalidate the refresh token
 * @returns {Promise<Object>} Response object with { success, error? }
 */
export async function logout(includeRefreshToken = true) {
    try {
        const refreshToken = apiClient.getRefreshToken();

        // Prepare request body
        const body = includeRefreshToken && refreshToken ? { refreshToken } : {};

        // Make API request with authentication
        const response = await apiClient.post('/auth/logout', body, true);

        // Clear tokens from localStorage regardless of response
        // (if the server-side logout fails, we still want to clear local tokens)
        apiClient.clearTokens();

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log('Logout successful');
        }

        if (!response.success) {
            // Even if the API call fails, we've cleared local tokens
            // So we can still consider this a successful logout from the client perspective
            return {
                success: true,
                data: { message: 'Logged out locally (server logout may have failed)' }
            };
        }

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Logout error:', error);
        }

        // Clear tokens even on error
        apiClient.clearTokens();

        return {
            success: true,
            data: { message: 'Logged out locally' }
        };
    }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} Response object with { success, data: { accessToken, refreshToken }, error? }
 */
export async function refreshToken(refreshToken) {
    try {
        // Validation
        if (!refreshToken || typeof refreshToken !== 'string') {
            return {
                success: false,
                error: 'Refresh token is required.'
            };
        }

        // Make API request (no authentication required)
        const response = await apiClient.post('/auth/refresh', {
            refreshToken
        }, false);

        if (!response.success) {
            // Clear tokens on refresh failure
            apiClient.clearTokens();
            return response;
        }

        // Validate response structure
        const { data } = response;
        if (!data || !data.accessToken || !data.refreshToken) {
            apiClient.clearTokens();
            return {
                success: false,
                error: 'Invalid response from server.'
            };
        }

        // Store new tokens
        apiClient.saveTokens(data.accessToken, data.refreshToken);

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log('Token refresh successful');
        }

        return {
            success: true,
            data: {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken
            }
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Token refresh error:', error);
        }

        // Clear tokens on error
        apiClient.clearTokens();

        return {
            success: false,
            error: 'Token refresh failed. Please log in again.'
        };
    }
}

/**
 * Get the currently logged-in user data from localStorage
 * @returns {Object|null} User object or null if not logged in
 */
export function getCurrentUser() {
    try {
        const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);
        if (!userData) {
            return null;
        }
        return JSON.parse(userData);
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Error parsing user data:', error);
        }
        return null;
    }
}

/**
 * Check if user is currently authenticated
 * @returns {boolean} True if user has valid tokens
 */
export function isAuthenticated() {
    const accessToken = apiClient.getAccessToken();
    const refreshToken = apiClient.getRefreshToken();
    return !!(accessToken && refreshToken);
}

/**
 * Clear all authentication data
 * Useful for forcing a fresh login without making an API call
 */
export function clearAuthData() {
    apiClient.clearTokens();
    if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
        console.log('Auth data cleared');
    }
}
