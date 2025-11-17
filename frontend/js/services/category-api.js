/**
 * Category API Service
 *
 * Handles all category-related API calls including CRUD operations.
 * All methods require authentication via the Authorization header.
 */

import { CONFIG } from '../config.js';
import { apiClient } from './api-client.js';

/**
 * Get all categories (system + user's categories) for the authenticated user
 * @returns {Promise<Object>} Response object with { success, data: Category[], error? }
 */
export async function getCategories() {
    try {
        // Make authenticated API request
        const response = await apiClient.get('/categories', true);

        if (!response.success) {
            return response;
        }

        // Validate response structure
        const { data } = response;
        if (!data || !data.categories || !Array.isArray(data.categories)) {
            return {
                success: false,
                error: 'Invalid response from server.'
            };
        }

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log(`Fetched ${data.categories.length} categories`);
        }

        return {
            success: true,
            data: data.categories
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Get categories error:', error);
        }
        return {
            success: false,
            error: 'Failed to fetch categories. Please try again.'
        };
    }
}

/**
 * Create a new category
 * @param {string} name - Category name (required, 1-50 characters)
 * @param {string} color - Category color (required, hex format like "#3B82F6")
 * @param {string} icon - Category icon (required, emoji like "📋")
 * @returns {Promise<Object>} Response object with { success, data: Category, error? }
 */
export async function createCategory(name, color, icon) {
    try {
        // Validate name
        if (!name || typeof name !== 'string') {
            return {
                success: false,
                error: 'Category name is required.'
            };
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 1) {
            return {
                success: false,
                error: 'Category name must be at least 1 character long.'
            };
        }

        if (trimmedName.length > 50) {
            return {
                success: false,
                error: 'Category name must not exceed 50 characters.'
            };
        }

        // Validate color (hex format)
        if (!color || typeof color !== 'string') {
            return {
                success: false,
                error: 'Category color is required.'
            };
        }

        const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorRegex.test(color)) {
            return {
                success: false,
                error: 'Category color must be a valid hex color (e.g., #3B82F6).'
            };
        }

        // Validate icon (emoji)
        if (!icon || typeof icon !== 'string') {
            return {
                success: false,
                error: 'Category icon is required.'
            };
        }

        const trimmedIcon = icon.trim();
        if (trimmedIcon.length === 0) {
            return {
                success: false,
                error: 'Category icon cannot be empty.'
            };
        }

        // Prepare request body
        const categoryData = {
            name: trimmedName,
            color: color.toUpperCase(), // Normalize to uppercase
            icon: trimmedIcon
        };

        // Make authenticated API request
        const response = await apiClient.post('/categories', categoryData, true);

        if (!response.success) {
            return response;
        }

        // Validate response structure
        const { data } = response;
        if (!data || typeof data.id !== 'number') {
            return {
                success: false,
                error: 'Invalid response from server.'
            };
        }

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log(`Created category #${data.id}: ${data.name}`);
        }

        return {
            success: true,
            data: data
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Create category error:', error);
        }
        return {
            success: false,
            error: 'Failed to create category. Please try again.'
        };
    }
}

/**
 * Update an existing category
 * @param {number|string} id - Category ID
 * @param {Object} updates - Object with fields to update { name?, color?, icon? }
 * @returns {Promise<Object>} Response object with { success, data: Category, error? }
 */
export async function updateCategory(id, updates) {
    try {
        // Validate ID
        if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
            return {
                success: false,
                error: 'Valid category ID is required.'
            };
        }

        const categoryId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(categoryId) || categoryId < 1) {
            return {
                success: false,
                error: 'Invalid category ID.'
            };
        }

        // Validate updates object
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
            return {
                success: false,
                error: 'Updates object is required.'
            };
        }

        // Build update payload with validation
        const updatePayload = {};

        if (updates.hasOwnProperty('name')) {
            if (typeof updates.name !== 'string') {
                return {
                    success: false,
                    error: 'Category name must be a string.'
                };
            }

            const trimmedName = updates.name.trim();
            if (trimmedName.length < 1) {
                return {
                    success: false,
                    error: 'Category name must be at least 1 character long.'
                };
            }

            if (trimmedName.length > 50) {
                return {
                    success: false,
                    error: 'Category name must not exceed 50 characters.'
                };
            }

            updatePayload.name = trimmedName;
        }

        if (updates.hasOwnProperty('color')) {
            if (typeof updates.color !== 'string') {
                return {
                    success: false,
                    error: 'Category color must be a string.'
                };
            }

            const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
            if (!hexColorRegex.test(updates.color)) {
                return {
                    success: false,
                    error: 'Category color must be a valid hex color (e.g., #3B82F6).'
                };
            }

            updatePayload.color = updates.color.toUpperCase();
        }

        if (updates.hasOwnProperty('icon')) {
            if (typeof updates.icon !== 'string') {
                return {
                    success: false,
                    error: 'Category icon must be a string.'
                };
            }

            const trimmedIcon = updates.icon.trim();
            if (trimmedIcon.length === 0) {
                return {
                    success: false,
                    error: 'Category icon cannot be empty.'
                };
            }

            updatePayload.icon = trimmedIcon;
        }

        // Check if there are any valid updates
        if (Object.keys(updatePayload).length === 0) {
            return {
                success: false,
                error: 'No valid updates provided.'
            };
        }

        // Make authenticated API request
        const response = await apiClient.put(`/categories/${categoryId}`, updatePayload, true);

        if (!response.success) {
            return response;
        }

        // Validate response structure
        const { data } = response;
        if (!data || typeof data.id !== 'number') {
            return {
                success: false,
                error: 'Invalid response from server.'
            };
        }

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log(`Updated category #${categoryId}`);
        }

        return {
            success: true,
            data: data
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Update category error:', error);
        }
        return {
            success: false,
            error: 'Failed to update category. Please try again.'
        };
    }
}

/**
 * Delete a category
 * @param {number|string} id - Category ID
 * @returns {Promise<Object>} Response object with { success, data: any, error? }
 */
export async function deleteCategory(id) {
    try {
        // Validate ID
        if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
            return {
                success: false,
                error: 'Valid category ID is required.'
            };
        }

        const categoryId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(categoryId) || categoryId < 1) {
            return {
                success: false,
                error: 'Invalid category ID.'
            };
        }

        // Make authenticated API request
        const response = await apiClient.delete(`/categories/${categoryId}`, true);

        if (!response.success) {
            return response;
        }

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log(`Deleted category #${categoryId}`);
        }

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Delete category error:', error);
        }
        return {
            success: false,
            error: 'Failed to delete category. Please try again.'
        };
    }
}
