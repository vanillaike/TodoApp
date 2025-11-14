/**
 * Token Storage Service
 *
 * LocalStorage wrapper for managing authentication tokens and user data.
 * Provides a clean interface for storing and retrieving tokens.
 */

import { CONFIG } from '../config.js';
import { isTokenExpired } from '../utils/jwt-decoder.js';

/**
 * Save access and refresh tokens to localStorage
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - Refresh token UUID
 */
export function saveTokens(accessToken, refreshToken) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

/**
 * Get access token from localStorage
 * @returns {string|null} Access token or null if not found
 */
export function getAccessToken() {
  try {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

/**
 * Get refresh token from localStorage
 * @returns {string|null} Refresh token or null if not found
 */
export function getRefreshToken() {
  try {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
}

/**
 * Clear all tokens from localStorage
 * Removes access token, refresh token, and user data
 */
export function clearTokens() {
  try {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}

/**
 * Check if a valid (non-expired) access token exists
 * @returns {boolean} True if valid access token exists, false otherwise
 */
export function hasValidAccessToken() {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return false;
  }

  // Check if token is expired
  return !isTokenExpired(accessToken);
}

/**
 * Save user data to localStorage
 * @param {object} user - User object with id and email
 */
export function saveUserData(user) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

/**
 * Get user data from localStorage
 * @returns {object|null} User object or null if not found/invalid
 */
export function getUserData() {
  try {
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);

    if (!userData) {
      return null;
    }

    return JSON.parse(userData);
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

/**
 * Clear user data from localStorage
 */
export function clearUserData() {
  try {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
}
