/**
 * Todo API Service
 *
 * Handles all todo-related API calls including CRUD operations and pagination.
 * All methods require authentication via the Authorization header.
 */

import { CONFIG } from '../config.js';
import { apiClient } from './api-client.js';

/**
 * Get paginated list of todos for the authenticated user
 * @param {number} limit - Number of todos to fetch (max 100)
 * @param {number} offset - Number of todos to skip (for pagination)
 * @returns {Promise<Object>} Response object with { success, data: { todos, pagination }, error? }
 */
export async function getTodos(limit = CONFIG.PAGINATION.DEFAULT_PAGE_SIZE, offset = 0) {
    try {
        // Validate parameters
        if (typeof limit !== 'number' || limit < 1) {
            limit = CONFIG.PAGINATION.DEFAULT_PAGE_SIZE;
        }

        if (limit > CONFIG.PAGINATION.MAX_PAGE_SIZE) {
            limit = CONFIG.PAGINATION.MAX_PAGE_SIZE;
        }

        if (typeof offset !== 'number' || offset < 0) {
            offset = 0;
        }

        // Build query string
        const queryParams = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString()
        });

        // Make authenticated API request
        const response = await apiClient.get(`/todos?${queryParams.toString()}`, true);

        if (!response.success) {
            return response;
        }

        // Validate response structure
        const { data } = response;
        if (!data || !Array.isArray(data.todos) || !data.pagination) {
            return {
                success: false,
                error: 'Invalid response from server.'
            };
        }

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log(`Fetched ${data.todos.length} todos (limit: ${limit}, offset: ${offset})`);
        }

        return {
            success: true,
            data: {
                todos: data.todos,
                pagination: data.pagination
            }
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Get todos error:', error);
        }
        return {
            success: false,
            error: 'Failed to fetch todos. Please try again.'
        };
    }
}

/**
 * Get a single todo by ID
 * @param {number|string} id - Todo ID
 * @returns {Promise<Object>} Response object with { success, data: todo, error? }
 */
export async function getTodo(id) {
    try {
        // Validate ID
        if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
            return {
                success: false,
                error: 'Valid todo ID is required.'
            };
        }

        const todoId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(todoId) || todoId < 1) {
            return {
                success: false,
                error: 'Invalid todo ID.'
            };
        }

        // Make authenticated API request
        const response = await apiClient.get(`/todos/${todoId}`, true);

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
            console.log(`Fetched todo #${todoId}`);
        }

        return {
            success: true,
            data: data
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Get todo error:', error);
        }
        return {
            success: false,
            error: 'Failed to fetch todo. Please try again.'
        };
    }
}

/**
 * Create a new todo
 * @param {string} title - Todo title (required, 1-200 characters)
 * @param {string} description - Todo description (optional, max 1000 characters)
 * @returns {Promise<Object>} Response object with { success, data: todo, error? }
 */
export async function createTodo(title, description = '') {
    try {
        // Validate title
        if (!title || typeof title !== 'string') {
            return {
                success: false,
                error: 'Title is required.'
            };
        }

        const trimmedTitle = title.trim();
        if (trimmedTitle.length < CONFIG.VALIDATION.TODO_TITLE_MIN_LENGTH) {
            return {
                success: false,
                error: `Title must be at least ${CONFIG.VALIDATION.TODO_TITLE_MIN_LENGTH} character long.`
            };
        }

        if (trimmedTitle.length > CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH) {
            return {
                success: false,
                error: `Title must not exceed ${CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH} characters.`
            };
        }

        // Validate description
        let trimmedDescription = '';
        if (description && typeof description === 'string') {
            trimmedDescription = description.trim();
            if (trimmedDescription.length > CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH) {
                return {
                    success: false,
                    error: `Description must not exceed ${CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH} characters.`
                };
            }
        }

        // Prepare request body
        const todoData = {
            title: trimmedTitle,
            completed: 0 // New todos are not completed by default
        };

        if (trimmedDescription) {
            todoData.description = trimmedDescription;
        }

        // Make authenticated API request
        const response = await apiClient.post('/todos', todoData, true);

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
            console.log(`Created todo #${data.id}: ${data.title}`);
        }

        return {
            success: true,
            data: data
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Create todo error:', error);
        }
        return {
            success: false,
            error: 'Failed to create todo. Please try again.'
        };
    }
}

/**
 * Update an existing todo
 * @param {number|string} id - Todo ID
 * @param {Object} updates - Object with fields to update { title?, description?, completed? }
 * @returns {Promise<Object>} Response object with { success, data: todo, error? }
 */
export async function updateTodo(id, updates) {
    try {
        // Validate ID
        if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
            return {
                success: false,
                error: 'Valid todo ID is required.'
            };
        }

        const todoId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(todoId) || todoId < 1) {
            return {
                success: false,
                error: 'Invalid todo ID.'
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

        if (updates.hasOwnProperty('title')) {
            if (typeof updates.title !== 'string') {
                return {
                    success: false,
                    error: 'Title must be a string.'
                };
            }

            const trimmedTitle = updates.title.trim();
            if (trimmedTitle.length < CONFIG.VALIDATION.TODO_TITLE_MIN_LENGTH) {
                return {
                    success: false,
                    error: `Title must be at least ${CONFIG.VALIDATION.TODO_TITLE_MIN_LENGTH} character long.`
                };
            }

            if (trimmedTitle.length > CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH) {
                return {
                    success: false,
                    error: `Title must not exceed ${CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH} characters.`
                };
            }

            updatePayload.title = trimmedTitle;
        }

        if (updates.hasOwnProperty('description')) {
            if (updates.description === null || updates.description === '') {
                updatePayload.description = '';
            } else if (typeof updates.description === 'string') {
                const trimmedDescription = updates.description.trim();
                if (trimmedDescription.length > CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH) {
                    return {
                        success: false,
                        error: `Description must not exceed ${CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH} characters.`
                    };
                }
                updatePayload.description = trimmedDescription;
            } else {
                return {
                    success: false,
                    error: 'Description must be a string.'
                };
            }
        }

        if (updates.hasOwnProperty('completed')) {
            if (typeof updates.completed === 'boolean') {
                updatePayload.completed = updates.completed ? 1 : 0;
            } else if (typeof updates.completed === 'number') {
                updatePayload.completed = updates.completed ? 1 : 0;
            } else {
                return {
                    success: false,
                    error: 'Completed must be a boolean or number.'
                };
            }
        }

        // Check if there are any valid updates
        if (Object.keys(updatePayload).length === 0) {
            return {
                success: false,
                error: 'No valid updates provided.'
            };
        }

        // Make authenticated API request
        const response = await apiClient.put(`/todos/${todoId}`, updatePayload, true);

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
            console.log(`Updated todo #${todoId}`);
        }

        return {
            success: true,
            data: data
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Update todo error:', error);
        }
        return {
            success: false,
            error: 'Failed to update todo. Please try again.'
        };
    }
}

/**
 * Delete a todo
 * @param {number|string} id - Todo ID
 * @returns {Promise<Object>} Response object with { success, error? }
 */
export async function deleteTodo(id) {
    try {
        // Validate ID
        if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
            return {
                success: false,
                error: 'Valid todo ID is required.'
            };
        }

        const todoId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(todoId) || todoId < 1) {
            return {
                success: false,
                error: 'Invalid todo ID.'
            };
        }

        // Make authenticated API request
        const response = await apiClient.delete(`/todos/${todoId}`, true);

        if (!response.success) {
            return response;
        }

        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.log(`Deleted todo #${todoId}`);
        }

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Delete todo error:', error);
        }
        return {
            success: false,
            error: 'Failed to delete todo. Please try again.'
        };
    }
}

/**
 * Toggle a todo's completed status
 * Convenience method that fetches the current state and toggles it
 * @param {number|string} id - Todo ID
 * @returns {Promise<Object>} Response object with { success, data: todo, error? }
 */
export async function toggleTodoCompleted(id) {
    try {
        // Validate ID
        if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
            return {
                success: false,
                error: 'Valid todo ID is required.'
            };
        }

        const todoId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(todoId) || todoId < 1) {
            return {
                success: false,
                error: 'Invalid todo ID.'
            };
        }

        // Get current todo state
        const getTodoResponse = await getTodo(todoId);
        if (!getTodoResponse.success) {
            return getTodoResponse;
        }

        const currentTodo = getTodoResponse.data;
        const newCompletedValue = currentTodo.completed ? 0 : 1;

        // Update with toggled value
        return updateTodo(todoId, { completed: newCompletedValue });
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Toggle todo error:', error);
        }
        return {
            success: false,
            error: 'Failed to toggle todo. Please try again.'
        };
    }
}

/**
 * Get all completed todos for the authenticated user
 * @param {number} limit - Number of todos to fetch
 * @returns {Promise<Object>} Response object with { success, data: { todos, pagination }, error? }
 */
export async function getCompletedTodos(limit = CONFIG.PAGINATION.MAX_PAGE_SIZE) {
    try {
        const response = await getTodos(limit, 0);
        if (!response.success) {
            return response;
        }

        // Filter completed todos on the client side
        const completedTodos = response.data.todos.filter(todo => todo.completed === 1);

        return {
            success: true,
            data: {
                todos: completedTodos,
                pagination: {
                    ...response.data.pagination,
                    total: completedTodos.length
                }
            }
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Get completed todos error:', error);
        }
        return {
            success: false,
            error: 'Failed to fetch completed todos. Please try again.'
        };
    }
}

/**
 * Get all active (not completed) todos for the authenticated user
 * @param {number} limit - Number of todos to fetch
 * @returns {Promise<Object>} Response object with { success, data: { todos, pagination }, error? }
 */
export async function getActiveTodos(limit = CONFIG.PAGINATION.MAX_PAGE_SIZE) {
    try {
        const response = await getTodos(limit, 0);
        if (!response.success) {
            return response;
        }

        // Filter active todos on the client side
        const activeTodos = response.data.todos.filter(todo => todo.completed === 0);

        return {
            success: true,
            data: {
                todos: activeTodos,
                pagination: {
                    ...response.data.pagination,
                    total: activeTodos.length
                }
            }
        };
    } catch (error) {
        if (CONFIG.ENVIRONMENT.IS_DEVELOPMENT) {
            console.error('Get active todos error:', error);
        }
        return {
            success: false,
            error: 'Failed to fetch active todos. Please try again.'
        };
    }
}
