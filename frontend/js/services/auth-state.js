/**
 * Authentication State Manager
 *
 * Global authentication state with observer pattern for reactive UI updates.
 * Manages authentication status, current user, and notifies listeners of state changes.
 */

import * as tokenStorage from './token-storage.js';
import { logout as apiLogout } from './auth-api.js';
import { getUserFromToken } from '../utils/jwt-decoder.js';

/**
 * Authentication state singleton class
 */
class AuthState {
  constructor() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.listeners = [];
  }

  /**
   * Initialize authentication state from localStorage
   * Checks for valid tokens and sets initial state
   */
  initialize() {
    // Check if valid access token exists
    const hasValidToken = tokenStorage.hasValidAccessToken();

    if (hasValidToken) {
      // Get user data from JWT token
      const accessToken = tokenStorage.getAccessToken();
      let user = getUserFromToken(accessToken);

      // If JWT decode fails, try to reconstruct from email
      if (!user) {
        const email = tokenStorage.getUserEmail();
        if (email) {
          // We have email but can't get userId - still allow login
          // userId will be available when token is refreshed
          user = { email };
        }
      }

      if (user) {
        this.isAuthenticated = true;
        this.currentUser = user;

        // Migrate old user data to new format (one-time migration)
        if (user.email && !tokenStorage.getUserEmail()) {
          tokenStorage.saveUserEmail(user.email);
        }
      } else {
        // Token exists but invalid, clear everything
        this.clearState();
      }
    } else {
      // No valid token, ensure clean state
      this.clearState();
    }
  }

  /**
   * Handle successful login
   * @param {string} accessToken - JWT access token
   * @param {string} refreshToken - Refresh token UUID
   * @param {object} user - User object with id and email
   */
  login(accessToken, refreshToken, user) {
    // Save tokens to localStorage
    tokenStorage.saveTokens(accessToken, refreshToken);

    // Only save email to localStorage (userId is in JWT)
    if (user && user.email) {
      tokenStorage.saveUserEmail(user.email);
    }

    // Update state
    this.isAuthenticated = true;
    this.currentUser = user;

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Handle logout
   * Calls API, clears tokens, resets state, and notifies listeners
   */
  async logout() {
    try {
      // Get refresh token for API call
      const refreshToken = tokenStorage.getRefreshToken();

      // Call logout API (optional refresh token)
      await apiLogout(refreshToken);
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API fails
    } finally {
      // Clear local state regardless of API result
      this.clearState();
      this.notifyListeners();
    }
  }

  /**
   * Update stored tokens (called after token refresh)
   * @param {string} accessToken - New JWT access token
   * @param {string} refreshToken - New refresh token UUID
   */
  updateTokens(accessToken, refreshToken) {
    tokenStorage.saveTokens(accessToken, refreshToken);

    // Update user data from new token
    const user = getUserFromToken(accessToken);
    if (user) {
      this.currentUser = user;
      // Only save email to localStorage
      if (user.email) {
        tokenStorage.saveUserEmail(user.email);
      }
    }
  }

  /**
   * Subscribe to authentication state changes
   * @param {Function} callback - Function to call when state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    // Prevent duplicate listeners
    if (!this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }

    // Return unsubscribe function
    return () => this.unsubscribe(callback);
  }

  /**
   * Unsubscribe from authentication state changes
   * @param {Function} callback - Callback to remove
   */
  unsubscribe(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Get current user object
   * Reconstructs from JWT token and stored email if needed
   * @returns {object|null} Current user or null if not authenticated
   */
  getCurrentUser() {
    // If we have current user in memory, return it
    if (this.currentUser) {
      return this.currentUser;
    }

    // Try to reconstruct from token and email
    if (this.isAuthenticated) {
      const accessToken = tokenStorage.getAccessToken();
      if (accessToken) {
        const user = getUserFromToken(accessToken);
        if (user) {
          this.currentUser = user;
          return user;
        }
      }

      // Fallback: construct from email only
      const email = tokenStorage.getUserEmail();
      if (email) {
        this.currentUser = { email };
        return this.currentUser;
      }
    }

    return null;
  }

  /**
   * Get current authentication status
   * @returns {boolean} True if authenticated, false otherwise
   */
  getIsAuthenticated() {
    return this.isAuthenticated;
  }

  /**
   * Verify current auth status is valid
   * Checks if tokens exist and are not expired
   * @returns {boolean} True if auth status is valid, false otherwise
   */
  checkAuthStatus() {
    const hasValidToken = tokenStorage.hasValidAccessToken();

    // If token is invalid but we think we're authenticated, fix the state
    if (this.isAuthenticated && !hasValidToken) {
      console.warn('Auth state mismatch: clearing invalid state');
      this.clearState();
      this.notifyListeners();
      return false;
    }

    return hasValidToken;
  }

  /**
   * Clear authentication state
   * Private helper method
   */
  clearState() {
    tokenStorage.clearTokens();
    this.isAuthenticated = false;
    this.currentUser = null;
  }

  /**
   * Notify all listeners of state changes
   * Calls listeners asynchronously to avoid blocking
   */
  notifyListeners() {
    const state = {
      isAuthenticated: this.isAuthenticated,
      currentUser: this.currentUser
    };

    // Call listeners asynchronously
    queueMicrotask(() => {
      this.listeners.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error('Error in auth state listener:', error);
        }
      });
    });
  }
}

// Export singleton instance
export const authState = new AuthState();
