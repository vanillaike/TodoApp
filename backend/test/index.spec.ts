import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper function to register a new user
 * @param email - User email
 * @param password - User password
 * @returns Object with response and data
 */
async function registerUser(email: string, password: string) {
	const response = await SELF.fetch('https://example.com/auth/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	const data = await response.json() as any;
	return { response, data };
}

/**
 * Helper function to login a user
 * @param email - User email
 * @param password - User password
 * @returns Object with response and data
 */
async function loginUser(email: string, password: string) {
	const response = await SELF.fetch('https://example.com/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	const data = await response.json() as any;
	return { response, data };
}

/**
 * Helper function to create a todo with authentication
 * @param token - Access token
 * @param title - Todo title
 * @param description - Optional todo description
 * @returns Object with response and data
 */
async function createTodo(token: string, title: string, description?: string) {
	const response = await SELF.fetch('https://example.com/todos', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify({ title, description })
	});
	const data = await response.json() as any;
	return { response, data };
}

/**
 * Helper function to logout a user
 * @param token - Access token
 * @param refreshToken - Optional refresh token to delete
 * @returns Object with response and data
 */
async function logoutUser(token: string, refreshToken?: string) {
	const body = refreshToken ? { refreshToken } : {};
	const response = await SELF.fetch('https://example.com/auth/logout', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify(body)
	});
	const data = await response.json() as any;
	return { response, data };
}

/**
 * Helper function to refresh access token
 * @param refreshToken - Refresh token
 * @returns Object with response and data
 */
async function refreshToken(refreshToken: string) {
	const response = await SELF.fetch('https://example.com/auth/refresh', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refreshToken })
	});
	const data = await response.json() as any;
	return { response, data };
}

/**
 * Helper function to create a category with authentication
 * @param token - Access token
 * @param name - Category name
 * @param color - Category color (hex)
 * @param icon - Category icon (emoji)
 * @returns Object with response and data
 */
async function createCategory(token: string, name: string, color: string, icon: string) {
	const response = await SELF.fetch('https://example.com/categories', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify({ name, color, icon })
	});
	const data = await response.json() as any;
	return { response, data };
}

/**
 * Helper function to list categories with authentication
 * @param token - Access token
 * @returns Object with response and data
 */
async function listCategories(token: string) {
	const response = await SELF.fetch('https://example.com/categories', {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});
	const data = await response.json() as any;
	return { response, data };
}

/**
 * Helper function to update a category with authentication
 * @param token - Access token
 * @param id - Category ID
 * @param updates - Partial category updates
 * @returns Object with response and data
 */
async function updateCategory(token: string, id: number, updates: any) {
	const response = await SELF.fetch(`https://example.com/categories/${id}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify(updates)
	});
	const data = await response.json() as any;
	return { response, data };
}

/**
 * Helper function to delete a category with authentication
 * @param token - Access token
 * @param id - Category ID
 * @returns Object with response and data
 */
async function deleteCategory(token: string, id: number) {
	const response = await SELF.fetch(`https://example.com/categories/${id}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});
	const data = await response.json() as any;
	return { response, data };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Todo API with Authentication', () => {
	beforeAll(async () => {
		// Set up the database schema with all tables
		// Note: D1's exec() doesn't support multi-statement SQL, so we create each table separately
		await env.todo_db.prepare(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT UNIQUE NOT NULL,
				password_hash TEXT NOT NULL,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP
			)
		`).run();

		await env.todo_db.prepare(`
			CREATE TABLE IF NOT EXISTS refresh_tokens (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				token TEXT UNIQUE NOT NULL,
				expires_at TEXT NOT NULL,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`).run();

		await env.todo_db.prepare(`
			CREATE TABLE IF NOT EXISTS token_blacklist (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				token TEXT UNIQUE NOT NULL,
				expires_at TEXT NOT NULL,
				blacklisted_at TEXT DEFAULT CURRENT_TIMESTAMP
			)
		`).run();

		await env.todo_db.prepare(`
			CREATE TABLE IF NOT EXISTS todos (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				description TEXT,
				completed INTEGER DEFAULT 0,
				user_id INTEGER,
				category_id INTEGER,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP
			)
		`).run();

		await env.todo_db.prepare(`
			CREATE TABLE IF NOT EXISTS categories (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				color TEXT NOT NULL,
				icon TEXT NOT NULL,
				user_id INTEGER,
				is_system INTEGER DEFAULT 0,
				sort_order INTEGER DEFAULT 0,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP
			)
		`).run();

		// Create indexes
		await env.todo_db.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)').run();
		await env.todo_db.prepare('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)').run();
		await env.todo_db.prepare('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)').run();
		await env.todo_db.prepare('CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token)').run();
		await env.todo_db.prepare('CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)').run();
		await env.todo_db.prepare('CREATE INDEX IF NOT EXISTS idx_todos_category_id ON todos(category_id)').run();
		await env.todo_db.prepare('CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)').run();

		// Seed system categories
		await env.todo_db.prepare(`
			INSERT INTO categories (name, color, icon, user_id, is_system, sort_order) VALUES
				('Work', '#3B82F6', '📋', NULL, 1, 1),
				('Personal', '#10B981', '🏠', NULL, 1, 2),
				('Shopping', '#F59E0B', '🛒', NULL, 1, 3),
				('Health', '#EF4444', '💪', NULL, 1, 4),
				('Learning', '#8B5CF6', '📚', NULL, 1, 5)
		`).run();
	});

	beforeEach(async () => {
		// Clean up all tables before each test
		// Note: Order matters due to foreign key constraints
		await env.todo_db.prepare('DELETE FROM todos').run();
		await env.todo_db.prepare('DELETE FROM refresh_tokens').run();
		await env.todo_db.prepare('DELETE FROM token_blacklist').run();
		await env.todo_db.prepare('DELETE FROM categories WHERE is_system = 0').run(); // Only delete user categories
		await env.todo_db.prepare('DELETE FROM users').run();
	});

	// ========================================================================
	// AUTHENTICATION ENDPOINTS
	// ========================================================================

	describe('Authentication Endpoints', () => {
		describe('POST /auth/register', () => {
			it('should successfully register with valid credentials', async () => {
				const { response, data } = await registerUser('test@example.com', 'password123');

				expect(response.status).toBe(201);
				expect(data).toHaveProperty('user');
				expect(data.user).toHaveProperty('id');
				expect(data.user.email).toBe('test@example.com');
				expect(data.user).toHaveProperty('created_at');
				expect(data.user).not.toHaveProperty('password_hash');
				expect(data).toHaveProperty('accessToken');
				expect(data).toHaveProperty('refreshToken');
			});

			it('should reject registration with invalid email format', async () => {
				const { response, data } = await registerUser('invalid-email', 'password123');

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Invalid email format');
			});

			it('should reject registration with email that is too long', async () => {
				const longEmail = 'a'.repeat(250) + '@example.com'; // > 255 chars
				const { response, data } = await registerUser(longEmail, 'password123');

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Email must be 255 characters or less');
			});

			it('should reject registration with email missing @ symbol', async () => {
				const { response, data } = await registerUser('emailexample.com', 'password123');

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Invalid email format');
			});

			it('should reject registration with email containing consecutive dots', async () => {
				const { response, data } = await registerUser('test..user@example.com', 'password123');

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Invalid email format');
			});

			it('should reject registration with password that is too short', async () => {
				const { response, data } = await registerUser('test@example.com', 'pass1');

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Password must be at least 8 characters long');
			});

			it('should reject registration with password that is too long', async () => {
				const longPassword = 'a1' + 'b'.repeat(200); // > 128 chars
				const { response, data } = await registerUser('test@example.com', longPassword);

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Password must be 128 characters or less');
			});

			it('should reject registration with password missing a number', async () => {
				const { response, data } = await registerUser('test@example.com', 'passwordonly');

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Password must contain at least one number');
			});

			it('should reject registration with password missing a letter', async () => {
				const { response, data } = await registerUser('test@example.com', '12345678');

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Password must contain at least one letter');
			});

			it('should reject duplicate email registration', async () => {
				// First registration
				await registerUser('duplicate@example.com', 'password123');

				// Second registration with same email
				const { response, data } = await registerUser('duplicate@example.com', 'password456');

				expect(response.status).toBe(409);
				expect(data.error).toBe('Email already exists');
			});

			it('should reject registration with wrong Content-Type', async () => {
				const response = await SELF.fetch('https://example.com/auth/register', {
					method: 'POST',
					headers: { 'Content-Type': 'text/plain' },
					body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(415);
				expect(data.error).toBe('Unsupported Media Type');
				expect(data.message).toContain('Content-Type must be application/json');
			});

			it('should reject registration with unknown fields', async () => {
				const response = await SELF.fetch('https://example.com/auth/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						email: 'test@example.com',
						password: 'password123',
						extraField: 'value'
					})
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Unknown fields: extraField');
			});

			it('should reject registration with invalid JSON', async () => {
				const response = await SELF.fetch('https://example.com/auth/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: 'invalid json'
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Invalid JSON');
				expect(data.message).toContain('Request body must be valid JSON');
			});

			it('should reject registration with missing email field', async () => {
				const response = await SELF.fetch('https://example.com/auth/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ password: 'password123' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Email is required');
			});

			it('should reject registration with missing password field', async () => {
				const response = await SELF.fetch('https://example.com/auth/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: 'test@example.com' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Password is required');
			});

			it('should normalize email to lowercase', async () => {
				const { response, data } = await registerUser('Test@Example.COM', 'password123');

				expect(response.status).toBe(201);
				expect(data.user.email).toBe('test@example.com');
			});

			it('should trim whitespace from email', async () => {
				const { response, data } = await registerUser('  test@example.com  ', 'password123');

				expect(response.status).toBe(201);
				expect(data.user.email).toBe('test@example.com');
			});
		});

		describe('POST /auth/login', () => {
			beforeEach(async () => {
				// Register a user before each login test
				await registerUser('login@example.com', 'password123');
			});

			it('should successfully login with valid credentials', async () => {
				const { response, data } = await loginUser('login@example.com', 'password123');

				expect(response.status).toBe(200);
				expect(data).toHaveProperty('user');
				expect(data.user).toHaveProperty('id');
				expect(data.user.email).toBe('login@example.com');
				expect(data.user).toHaveProperty('created_at');
				expect(data.user).not.toHaveProperty('password_hash');
				expect(data).toHaveProperty('accessToken');
				expect(data).toHaveProperty('refreshToken');
			});

			it('should reject login with invalid email', async () => {
				const { response, data } = await loginUser('wrong@example.com', 'password123');

				expect(response.status).toBe(401);
				expect(data.error).toBe('Invalid credentials');
			});

			it('should reject login with invalid password', async () => {
				const { response, data } = await loginUser('login@example.com', 'wrongpassword123');

				expect(response.status).toBe(401);
				expect(data.error).toBe('Invalid credentials');
			});

			it('should reject login with missing email field', async () => {
				const response = await SELF.fetch('https://example.com/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ password: 'password123' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Email is required');
			});

			it('should reject login with missing password field', async () => {
				const response = await SELF.fetch('https://example.com/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: 'login@example.com' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Password is required');
			});

			it('should reject login with wrong Content-Type', async () => {
				const response = await SELF.fetch('https://example.com/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'text/plain' },
					body: JSON.stringify({ email: 'login@example.com', password: 'password123' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(415);
				expect(data.error).toBe('Unsupported Media Type');
				expect(data.message).toContain('Content-Type must be application/json');
			});

			it('should normalize email to lowercase during login', async () => {
				const { response, data } = await loginUser('Login@Example.COM', 'password123');

				expect(response.status).toBe(200);
				expect(data.user.email).toBe('login@example.com');
			});

			it('should reject login with unknown fields', async () => {
				const response = await SELF.fetch('https://example.com/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						email: 'login@example.com',
						password: 'password123',
						extraField: 'value'
					})
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Unknown fields: extraField');
			});
		});

		describe('POST /auth/logout', () => {
			let userToken: string;
			let userRefreshToken: string;

			beforeEach(async () => {
				// Register and login a user before each logout test
				const { data } = await registerUser('logout@example.com', 'password123');
				userToken = data.accessToken;
				userRefreshToken = data.refreshToken;
			});

			it('should successfully logout and blacklist token', async () => {
				const { response, data } = await logoutUser(userToken);

				expect(response.status).toBe(200);
				expect(data.message).toBe('Logged out successfully');

				// Verify token is blacklisted by trying to use it
				const todoResponse = await SELF.fetch('https://example.com/todos', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				expect(todoResponse.status).toBe(401);
			});

			it('should blacklist token and delete refresh token when provided', async () => {
				const { response, data } = await logoutUser(userToken, userRefreshToken);

				expect(response.status).toBe(200);
				expect(data.message).toBe('Logged out successfully');

				// Verify refresh token is deleted by trying to use it
				const refreshResponse = await refreshToken(userRefreshToken);
				expect(refreshResponse.response.status).toBe(401);
				expect(refreshResponse.data.error).toBe('Invalid refresh token');
			});

			it('should reject logout without authentication token', async () => {
				const response = await SELF.fetch('https://example.com/auth/logout', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' }
				});
				const data = await response.json() as any;

				expect(response.status).toBe(401);
				expect(data.error).toBe('Authorization header required');
			});

			it('should reject logout with invalid token', async () => {
				const response = await SELF.fetch('https://example.com/auth/logout', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer invalid.token.here'
					}
				});
				const data = await response.json() as any;

				expect(response.status).toBe(401);
				expect(data.error).toBe('Invalid or expired token');
			});

			it('should reject logout with unknown fields in body', async () => {
				const response = await SELF.fetch('https://example.com/auth/logout', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${userToken}`
					},
					body: JSON.stringify({
						refreshToken: userRefreshToken,
						extraField: 'value'
					})
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Unknown fields: extraField');
			});

			it('should allow logout without body', async () => {
				const response = await SELF.fetch('https://example.com/auth/logout', {
					method: 'POST',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const data = await response.json() as any;

				expect(response.status).toBe(200);
				expect(data.message).toBe('Logged out successfully');
			});
		});

		describe('POST /auth/refresh', () => {
			let userRefreshToken: string;

			beforeEach(async () => {
				// Register a user to get a refresh token
				const { data } = await registerUser('refresh@example.com', 'password123');
				userRefreshToken = data.refreshToken;
			});

			it('should successfully generate new access token with valid refresh token', async () => {
				const { response, data } = await refreshToken(userRefreshToken);

				expect(response.status).toBe(200);
				expect(data).toHaveProperty('accessToken');
				expect(typeof data.accessToken).toBe('string');
				expect(data.accessToken.length).toBeGreaterThan(0);
			});

			it('should reject refresh with invalid refresh token', async () => {
				// Use a valid UUID format but one that doesn't exist in database
				const { response, data } = await refreshToken('12345678-1234-1234-1234-123456789012');

				expect(response.status).toBe(401);
				expect(data.error).toBe('Invalid refresh token');
			});

			it('should reject refresh with non-UUID format token', async () => {
				const { response, data } = await refreshToken('not-a-uuid');

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('refreshToken must be a valid UUID format');
			});

			it('should reject refresh with missing refreshToken field', async () => {
				const response = await SELF.fetch('https://example.com/auth/refresh', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({})
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('refreshToken is required');
			});

			it('should reject refresh with wrong Content-Type', async () => {
				const response = await SELF.fetch('https://example.com/auth/refresh', {
					method: 'POST',
					headers: { 'Content-Type': 'text/plain' },
					body: JSON.stringify({ refreshToken: userRefreshToken })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(415);
				expect(data.error).toBe('Unsupported Media Type');
			});

			it('should reject expired refresh token', async () => {
				// Insert an expired refresh token directly into database
				const expiredToken = crypto.randomUUID();
				const expiredDate = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago

				await env.todo_db.prepare(
					'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
				).bind(1, expiredToken, expiredDate).run();

				const { response, data } = await refreshToken(expiredToken);

				expect(response.status).toBe(401);
				expect(data.error).toBe('Refresh token expired');
			});

			it('should reject refresh with unknown fields', async () => {
				const response = await SELF.fetch('https://example.com/auth/refresh', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						refreshToken: userRefreshToken,
						extraField: 'value'
					})
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Unknown fields: extraField');
			});

			describe('Refresh Token Rotation', () => {
				it('should invalidate old refresh token after successful rotation', async () => {
					// Use the refresh token to get a new access token
					const { response: firstResponse, data: firstData } = await refreshToken(userRefreshToken);

					expect(firstResponse.status).toBe(200);
					expect(firstData).toHaveProperty('accessToken');
					expect(firstData).toHaveProperty('refreshToken');

					// Try to use the old refresh token again - should fail
					const { response: secondResponse, data: secondData } = await refreshToken(userRefreshToken);

					expect(secondResponse.status).toBe(401);
					expect(secondData.error).toBe('Invalid refresh token');
				});

				it('should return new refresh token that works', async () => {
					// Use the refresh token to get new tokens
					const { response: firstResponse, data: firstData } = await refreshToken(userRefreshToken);

					expect(firstResponse.status).toBe(200);
					const newRefreshToken = firstData.refreshToken;

					// Use the NEW refresh token - should work
					const { response: secondResponse, data: secondData } = await refreshToken(newRefreshToken);

					expect(secondResponse.status).toBe(200);
					expect(secondData).toHaveProperty('accessToken');
					expect(secondData).toHaveProperty('refreshToken');

					// Verify the new token is different from the previous one
					expect(secondData.refreshToken).not.toBe(newRefreshToken);
				});

				it('should support sequential token rotation multiple times', async () => {
					// First rotation
					const { data: firstData } = await refreshToken(userRefreshToken);
					expect(firstData).toHaveProperty('refreshToken');
					const token1 = firstData.refreshToken;

					// Second rotation
					const { data: secondData } = await refreshToken(token1);
					expect(secondData).toHaveProperty('refreshToken');
					const token2 = secondData.refreshToken;

					// Third rotation
					const { response: thirdResponse, data: thirdData } = await refreshToken(token2);
					expect(thirdResponse.status).toBe(200);
					expect(thirdData).toHaveProperty('accessToken');
					expect(thirdData).toHaveProperty('refreshToken');

					// Verify all tokens are unique
					expect(token1).not.toBe(userRefreshToken);
					expect(token2).not.toBe(token1);
					expect(thirdData.refreshToken).not.toBe(token2);
				});
			});
		});
	});

	// ========================================================================
	// JWT TOKEN TESTS
	// ========================================================================

	describe('JWT Token Tests', () => {
		let validToken: string;

		beforeEach(async () => {
			const { data } = await registerUser('token@example.com', 'password123');
			validToken = data.accessToken;
		});

		it('should allow access to protected endpoint with valid token', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${validToken}` }
			});

			expect(response.status).toBe(200);
		});

		it('should reject access without authorization header', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET'
			});
			const data = await response.json() as any;

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authorization header required');
		});

		it('should reject access with invalid token', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': 'Bearer invalid.token.here' }
			});
			const data = await response.json() as any;

			expect(response.status).toBe(401);
			expect(data.error).toBe('Invalid or expired token');
		});

		it('should reject access with malformed authorization header', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': validToken } // Missing "Bearer " prefix
			});
			const data = await response.json() as any;

			expect(response.status).toBe(401);
			expect(data.error).toBe('Invalid authorization format. Use: Bearer <token>');
		});

		it('should reject access with blacklisted token', async () => {
			// Logout to blacklist the token
			await logoutUser(validToken);

			// Try to use the blacklisted token
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${validToken}` }
			});
			const data = await response.json() as any;

			expect(response.status).toBe(401);
			expect(data.error).toBe('Invalid or expired token');
		});

		it('should allow newly generated token after blacklisting old one', async () => {
			// Logout to blacklist the token
			const { data: logoutData } = await logoutUser(validToken);
			expect(logoutData.message).toBe('Logged out successfully');

			// Wait a bit to ensure the new token has a different issued-at timestamp
			await new Promise(resolve => setTimeout(resolve, 1100));

			// Login again to get a new token
			const { data: loginData } = await loginUser('token@example.com', 'password123');
			const newToken = loginData.accessToken;

			// Verify new token works
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${newToken}` }
			});

			expect(response.status).toBe(200);
		});
	});

	// ========================================================================
	// USER ISOLATION TESTS
	// ========================================================================

	describe('User Isolation', () => {
		let userA: { token: string; email: string };
		let userB: { token: string; email: string };

		beforeEach(async () => {
			// Create two users
			const userAData = await registerUser('usera@example.com', 'password123');
			const userBData = await registerUser('userb@example.com', 'password123');

			userA = {
				token: userAData.data.accessToken,
				email: 'usera@example.com'
			};
			userB = {
				token: userBData.data.accessToken,
				email: 'userb@example.com'
			};
		});

		it('should only return todos belonging to the authenticated user', async () => {
			// User A creates a todo
			await createTodo(userA.token, 'User A Todo');

			// User B creates a todo
			await createTodo(userB.token, 'User B Todo');

			// User A gets todos - should only see their own
			const responseA = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${userA.token}` }
			});
			const todosA = await responseA.json() as any;

			expect(todosA.todos).toHaveLength(1);
			expect(todosA.todos[0].title).toBe('User A Todo');

			// User B gets todos - should only see their own
			const responseB = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${userB.token}` }
			});
			const todosB = await responseB.json() as any;

			expect(todosB.todos).toHaveLength(1);
			expect(todosB.todos[0].title).toBe('User B Todo');
		});

		it('should not allow User A to get User B\'s todo by ID', async () => {
			// User B creates a todo
			const { data: todoBData } = await createTodo(userB.token, 'User B Todo');
			const todoBId = todoBData.id;

			// User A tries to get User B's todo
			const response = await SELF.fetch(`https://example.com/todos/${todoBId}`, {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${userA.token}` }
			});
			const data = await response.json() as any;

			expect(response.status).toBe(404);
			expect(data.error).toBe('Todo not found');
		});

		it('should not allow User A to update User B\'s todo', async () => {
			// User B creates a todo
			const { data: todoBData } = await createTodo(userB.token, 'User B Todo');
			const todoBId = todoBData.id;

			// User A tries to update User B's todo
			const response = await SELF.fetch(`https://example.com/todos/${todoBId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${userA.token}`
				},
				body: JSON.stringify({ title: 'Hacked Title' })
			});
			const data = await response.json() as any;

			expect(response.status).toBe(404);
			expect(data.error).toBe('Todo not found');

			// Verify User B's todo is unchanged
			const verifyResponse = await SELF.fetch(`https://example.com/todos/${todoBId}`, {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${userB.token}` }
			});
			const verifyData = await verifyResponse.json() as any;

			expect(verifyData.title).toBe('User B Todo');
		});

		it('should not allow User A to delete User B\'s todo', async () => {
			// User B creates a todo
			const { data: todoBData } = await createTodo(userB.token, 'User B Todo');
			const todoBId = todoBData.id;

			// User A tries to delete User B's todo
			const response = await SELF.fetch(`https://example.com/todos/${todoBId}`, {
				method: 'DELETE',
				headers: { 'Authorization': `Bearer ${userA.token}` }
			});
			const data = await response.json() as any;

			expect(response.status).toBe(404);
			expect(data.error).toBe('Todo not found');

			// Verify User B's todo still exists
			const verifyResponse = await SELF.fetch(`https://example.com/todos/${todoBId}`, {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${userB.token}` }
			});

			expect(verifyResponse.status).toBe(200);
		});

		it('should allow each user to only manage their own todos', async () => {
			// User A creates a todo
			const { data: todoAData } = await createTodo(userA.token, 'User A Todo');

			// User A updates their own todo
			const updateResponse = await SELF.fetch(`https://example.com/todos/${todoAData.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${userA.token}`
				},
				body: JSON.stringify({ title: 'Updated by User A', completed: 1 })
			});
			const updatedTodo = await updateResponse.json() as any;

			expect(updateResponse.status).toBe(200);
			expect(updatedTodo.title).toBe('Updated by User A');
			expect(updatedTodo.completed).toBe(1);

			// User A deletes their own todo
			const deleteResponse = await SELF.fetch(`https://example.com/todos/${todoAData.id}`, {
				method: 'DELETE',
				headers: { 'Authorization': `Bearer ${userA.token}` }
			});

			expect(deleteResponse.status).toBe(200);

			// Verify todo is deleted
			const verifyResponse = await SELF.fetch(`https://example.com/todos/${todoAData.id}`, {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${userA.token}` }
			});

			expect(verifyResponse.status).toBe(404);
		});
	});

	// ========================================================================
	// PROTECTED TODO ENDPOINTS
	// ========================================================================

	describe('Protected Todo Endpoints', () => {
		let userToken: string;
		let userId: number;

		beforeEach(async () => {
			const { data } = await registerUser('todo@example.com', 'password123');
			userToken = data.accessToken;
			userId = data.user.id;
		});

		describe('GET /todos', () => {
			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/todos', {
					method: 'GET'
				});
				const data = await response.json() as any;

				expect(response.status).toBe(401);
				expect(data.error).toBe('Authorization header required');
			});

			it('should return empty array for authenticated user with no todos', async () => {
				const response = await SELF.fetch('https://example.com/todos', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const data = await response.json() as any;

				expect(response.status).toBe(200);
				expect(Array.isArray(data.todos)).toBe(true);
				expect(data.todos).toHaveLength(0);
				expect(data).toHaveProperty('pagination');
			});

			it('should return todos ordered by created_at DESC', async () => {
				// Create multiple todos
				await createTodo(userToken, 'First Todo');
				await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for different timestamp
				await createTodo(userToken, 'Second Todo');

				const response = await SELF.fetch('https://example.com/todos', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const data = await response.json() as any;

				expect(data.todos).toHaveLength(2);
				expect(data.todos[0].title).toBe('Second Todo'); // Most recent first
				expect(data.todos[1].title).toBe('First Todo');
			});

			describe('Pagination Edge Cases', () => {
				it('should reject invalid limit parameter - negative number', async () => {
					const response = await SELF.fetch('https://example.com/todos?limit=-5', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Invalid limit parameter');
					expect(data.message).toContain('Limit must be a positive integer');
				});

				it('should reject invalid limit parameter - zero', async () => {
					const response = await SELF.fetch('https://example.com/todos?limit=0', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Invalid limit parameter');
					expect(data.message).toContain('Limit must be a positive integer');
				});

				it('should reject invalid limit parameter - non-numeric string', async () => {
					const response = await SELF.fetch('https://example.com/todos?limit=abc', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Invalid limit parameter');
					expect(data.message).toContain('Limit must be a positive integer');
				});

				it('should reject invalid offset parameter - negative number', async () => {
					const response = await SELF.fetch('https://example.com/todos?offset=-5', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Invalid offset parameter');
					expect(data.message).toContain('Offset must be a non-negative integer');
				});

				it('should reject invalid offset parameter - non-numeric string', async () => {
					const response = await SELF.fetch('https://example.com/todos?offset=xyz', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Invalid offset parameter');
					expect(data.message).toContain('Offset must be a non-negative integer');
				});

				it('should cap limit at 100 when exceeding maximum', async () => {
					// Create a few todos
					await createTodo(userToken, 'Todo 1');
					await createTodo(userToken, 'Todo 2');

					const response = await SELF.fetch('https://example.com/todos?limit=500', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(200);
					expect(data.pagination.limit).toBe(100); // Should be capped at 100
				});

				it('should return correct pagination metadata with multiple todos', async () => {
					// Create 5 todos
					for (let i = 1; i <= 5; i++) {
						await createTodo(userToken, `Todo ${i}`);
					}

					// Request limit=2, offset=0
					const response = await SELF.fetch('https://example.com/todos?limit=2&offset=0', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(200);
					expect(data.todos).toHaveLength(2);
					expect(data.pagination.limit).toBe(2);
					expect(data.pagination.offset).toBe(0);
					expect(data.pagination.total).toBe(5);
					expect(data.pagination.hasMore).toBe(true); // 0 + 2 < 5
				});

				it('should indicate no more pages when at the end', async () => {
					// Create 5 todos
					for (let i = 1; i <= 5; i++) {
						await createTodo(userToken, `Todo ${i}`);
					}

					// Request limit=2, offset=4 (should get last 1 todo)
					const response = await SELF.fetch('https://example.com/todos?limit=2&offset=4', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(200);
					expect(data.todos).toHaveLength(1);
					expect(data.pagination.limit).toBe(2);
					expect(data.pagination.offset).toBe(4);
					expect(data.pagination.total).toBe(5);
					expect(data.pagination.hasMore).toBe(false); // 4 + 2 >= 5
				});

				it('should handle large offset that exceeds total count', async () => {
					// Create 3 todos
					await createTodo(userToken, 'Todo 1');
					await createTodo(userToken, 'Todo 2');
					await createTodo(userToken, 'Todo 3');

					// Request with offset beyond the total count
					const response = await SELF.fetch('https://example.com/todos?offset=100', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${userToken}` }
					});
					const data = await response.json() as any;

					expect(response.status).toBe(200);
					expect(data.todos).toHaveLength(0); // No todos beyond offset
					expect(data.pagination.total).toBe(3);
					expect(data.pagination.hasMore).toBe(false);
				});
			});
		});

		describe('POST /todos', () => {
			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Test Todo' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(401);
				expect(data.error).toBe('Authorization header required');
			});

			it('should create todo with user_id when authenticated', async () => {
				const { response, data } = await createTodo(userToken, 'Test Todo', 'Test Description');

				expect(response.status).toBe(201);
				expect(data).toHaveProperty('id');
				expect(data.title).toBe('Test Todo');
				expect(data.description).toBe('Test Description');
				expect(data.completed).toBe(0);
				expect(data.user_id).toBe(userId);
				expect(data).toHaveProperty('created_at');
			});

			it('should reject todo creation without title', async () => {
				const response = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${userToken}`
					},
					body: JSON.stringify({ description: 'No title' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(400);
					expect(data.message).toContain('Title is required');
				expect(data.error).toBe('Validation failed');
			});

			it('should create todo without description', async () => {
				const { response, data } = await createTodo(userToken, 'Title Only');

				expect(response.status).toBe(201);
				expect(data.title).toBe('Title Only');
				expect(data.description).toBeNull();
			});

			describe('Title Validation Edge Cases', () => {
				it('should accept title with exactly 200 characters', async () => {
					const title = 'a'.repeat(200);
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(201);
					expect(data.title).toBe(title);
				});

				it('should reject title with 201 characters', async () => {
					const title = 'a'.repeat(201);
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Title must be 200 characters or less');
				});

				it('should reject title with only whitespace', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: '   ' })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Title cannot be empty');
				});

				it('should reject title as non-string type - number', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 12345 })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Title must be a string');
				});

				it('should reject title as non-string type - boolean', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: true })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Title must be a string');
				});

				it('should reject title as non-string type - array', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: ['test'] })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Title must be a string');
				});

				it('should reject empty string title after trim', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: '' })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					// Empty string with no content still has the field, so it checks for empty after trim
					expect(data.message).toMatch(/Title is required|Title cannot be empty/);
				});
			});

			describe('Description Validation Edge Cases', () => {
				it('should accept description with exactly 2000 characters', async () => {
					const description = 'b'.repeat(2000);
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', description })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(201);
					expect(data.description).toBe(description);
				});

				it('should reject description with 2001 characters', async () => {
					const description = 'b'.repeat(2001);
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', description })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Description must be 2000 characters or less');
				});

				it('should accept description explicitly set to null', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', description: null })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(201);
					expect(data.description).toBeNull();
				});

				it('should reject description as non-string type - number', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', description: 12345 })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Description must be a string or null');
				});

				it('should reject description as non-string type - boolean', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', description: false })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Description must be a string or null');
				});

				it('should reject description as non-string type - array', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', description: ['desc'] })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Description must be a string or null');
				});
			});

			describe('Completed Field Validation Edge Cases', () => {
				it('should convert boolean true to 1', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', completed: true })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(201);
					expect(data.completed).toBe(1);
				});

				it('should convert boolean false to 0', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', completed: false })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(201);
					expect(data.completed).toBe(0);
				});

				it('should reject invalid number for completed - value 2', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', completed: 2 })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Completed must be 0 or 1');
				});

				it('should reject invalid number for completed - value -1', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', completed: -1 })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Completed must be 0 or 1');
				});

				it('should reject string "true" for completed', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 'Test', completed: 'true' })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Completed must be a boolean or 0/1');
				});
			});

			describe('General Validation Edge Cases', () => {
				it('should reject request body as array', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify([{ title: 'Test' }])
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Request body must be a JSON object');
				});

				it('should reject request body as null', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify(null)
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Request body must be a JSON object');
				});

				it('should reject unknown fields in request body', async () => {
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({
							title: 'Test',
							extraField: 'value',
							anotherField: 123
						})
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Unknown fields');
				});

				it('should handle multiple validation errors - title too long and unknown field', async () => {
					const title = 'a'.repeat(201);
					const response = await SELF.fetch('https://example.com/todos', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({
							title,
							extraField: 'value'
						})
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					// The validation fails on unknown fields first
					expect(data.message).toContain('Unknown fields');
				});
			});
		});

		describe('GET /todos/:id', () => {
			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/todos/1', {
					method: 'GET'
				});
				const data = await response.json() as any;

				expect(response.status).toBe(401);
				expect(data.error).toBe('Authorization header required');
			});

			it('should return specific todo when authenticated', async () => {
				const { data: created } = await createTodo(userToken, 'Specific Todo');

				const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const todo = await response.json() as any;

				expect(response.status).toBe(200);
				expect(todo.id).toBe(created.id);
				expect(todo.title).toBe('Specific Todo');
			});

			it('should return 404 for non-existent todo', async () => {
				const response = await SELF.fetch('https://example.com/todos/99999', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const data = await response.json() as any;

				expect(response.status).toBe(404);
				expect(data.error).toBe('Todo not found');
			});

			it('should return 404 for non-numeric ID parameter', async () => {
				const response = await SELF.fetch('https://example.com/todos/abc', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const data = await response.json() as any;

				expect(response.status).toBe(404);
				expect(data.error).toBe('Not Found');
			});

			it('should return 404 for negative ID', async () => {
				const response = await SELF.fetch('https://example.com/todos/-5', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const data = await response.json() as any;

				expect(response.status).toBe(404);
				expect(data.error).toBe('Not Found');
			});
		});

		describe('PUT /todos/:id', () => {
			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/todos/1', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Updated' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(401);
				expect(data.error).toBe('Authorization header required');
			});

			it('should update todo when authenticated and owned', async () => {
				const { data: created } = await createTodo(userToken, 'Original Title');

				const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${userToken}`
					},
					body: JSON.stringify({ title: 'Updated Title', completed: 1 })
				});
				const updated = await response.json() as any;

				expect(response.status).toBe(200);
				expect(updated.title).toBe('Updated Title');
				expect(updated.completed).toBe(1);
			});

			it('should handle partial updates', async () => {
				const { data: created } = await createTodo(userToken, 'Original', 'Original Desc');

				const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${userToken}`
					},
					body: JSON.stringify({ description: 'Updated Desc' })
				});
				const updated = await response.json() as any;

				expect(response.status).toBe(200);
				expect(updated.title).toBe('Original'); // Unchanged
				expect(updated.description).toBe('Updated Desc'); // Changed
			});

			it('should return 404 for non-existent todo', async () => {
				const response = await SELF.fetch('https://example.com/todos/99999', {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${userToken}`
					},
					body: JSON.stringify({ title: 'Updated' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(404);
				expect(data.error).toBe('Todo not found');
			});

			it('should return 404 for non-numeric ID parameter', async () => {
				const response = await SELF.fetch('https://example.com/todos/abc', {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${userToken}`
					},
					body: JSON.stringify({ title: 'Updated' })
				});
				const data = await response.json() as any;

				expect(response.status).toBe(404);
				expect(data.error).toBe('Not Found');
			});

			describe('Update Validation Edge Cases', () => {
				it('should allow empty object for update (partial update)', async () => {
					const { data: created } = await createTodo(userToken, 'Original');

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({})
					});
					const updated = await response.json() as any;

					expect(response.status).toBe(200);
					expect(updated.title).toBe('Original'); // Unchanged
				});

				it('should accept title with exactly 200 characters in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');
					const title = 'b'.repeat(200);

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title })
					});
					const updated = await response.json() as any;

					expect(response.status).toBe(200);
					expect(updated.title).toBe(title);
				});

				it('should reject title with 201 characters in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');
					const title = 'b'.repeat(201);

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Title must be 200 characters or less');
				});

				it('should reject title with only whitespace in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: '   ' })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Title cannot be empty');
				});

				it('should accept description with exactly 2000 characters in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');
					const description = 'c'.repeat(2000);

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ description })
					});
					const updated = await response.json() as any;

					expect(response.status).toBe(200);
					expect(updated.description).toBe(description);
				});

				it('should reject description with 2001 characters in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');
					const description = 'c'.repeat(2001);

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ description })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Description must be 2000 characters or less');
				});

				it('should reject title as number in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ title: 789 })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Title must be a string');
				});

				it('should reject description as boolean in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ description: true })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Description must be a string or null');
				});

				it('should reject unknown fields in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({
							title: 'Updated',
							unknownField: 'value'
						})
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Unknown fields');
				});

				it('should convert boolean to number for completed in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ completed: true })
					});
					const updated = await response.json() as any;

					expect(response.status).toBe(200);
					expect(updated.completed).toBe(1);
				});

				it('should reject invalid completed value in update', async () => {
					const { data: created } = await createTodo(userToken, 'Original');

					const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${userToken}`
						},
						body: JSON.stringify({ completed: 5 })
					});
					const data = await response.json() as any;

					expect(response.status).toBe(400);
					expect(data.error).toBe('Validation failed');
					expect(data.message).toContain('Completed must be 0 or 1');
				});
			});
		});

		describe('DELETE /todos/:id', () => {
			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/todos/1', {
					method: 'DELETE'
				});
				const data = await response.json() as any;

				expect(response.status).toBe(401);
				expect(data.error).toBe('Authorization header required');
			});

			it('should delete todo when authenticated and owned', async () => {
				const { data: created } = await createTodo(userToken, 'Todo to Delete');

				const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
					method: 'DELETE',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const data = await response.json() as any;

				expect(response.status).toBe(200);
				expect(data.message).toBe('Todo deleted successfully');

				// Verify deletion
				const verifyResponse = await SELF.fetch(`https://example.com/todos/${created.id}`, {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});

				expect(verifyResponse.status).toBe(404);
			});

			it('should return 404 for non-existent todo', async () => {
				const response = await SELF.fetch('https://example.com/todos/99999', {
					method: 'DELETE',
					headers: { 'Authorization': `Bearer ${userToken}` }
				});
				const data = await response.json() as any;

				expect(response.status).toBe(404);
				expect(data.error).toBe('Todo not found');
			});
		});
	});

	// ========================================================================
	// CORS TESTS
	// ========================================================================

	describe('CORS Headers', () => {
		it('should return proper CORS headers for preflight on auth endpoints', async () => {
			const response = await SELF.fetch('https://example.com/auth/register', {
				method: 'OPTIONS'
			});

			expect(response.status).toBe(200);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
			expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
		});

		it('should return proper CORS headers for preflight on todo endpoints', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'OPTIONS'
			});

			expect(response.status).toBe(200);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
			expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
		});

		it('should include CORS headers in successful responses', async () => {
			const { data } = await registerUser('cors@example.com', 'password123');

			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${data.accessToken}` }
			});

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Content-Type')).toBe('application/json');
		});

		it('should include CORS headers in error responses', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET'
			});

			expect(response.status).toBe(401);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});

		describe('CORS Origin Whitelisting', () => {
			it('should allow wildcard when ALLOWED_ORIGINS is not set', async () => {
				// Default env setup has no ALLOWED_ORIGINS, so should return '*'
				const response = await SELF.fetch('https://example.com/auth/register', {
					method: 'OPTIONS',
					headers: { 'Origin': 'https://evil.com' }
				});

				expect(response.status).toBe(200);
				expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			});

			// Note: The following tests for ALLOWED_ORIGINS whitelisting cannot be properly tested
			// in the Vitest environment because runtime environment variables cannot be dynamically
			// modified. These would need to be tested in a live environment or with wrangler.toml
			// configuration changes. The getCorsHeaders function implementation handles:
			// - Whitelisting specific origins when ALLOWED_ORIGINS is set
			// - Returning 'null' for non-whitelisted origins
			// - Supporting comma-separated multiple origins
		});
	});

	// ========================================================================
	// SECURITY HEADERS TESTS
	// ========================================================================

	describe('Security Headers', () => {
		it('should include all security headers on auth endpoints', async () => {
			const response = await SELF.fetch('https://example.com/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
			});

			expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains; preload');
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(response.headers.get('X-Frame-Options')).toBe('DENY');
			expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
			expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
			expect(response.headers.get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=(), payment=(), usb=()');
			expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; frame-ancestors 'none'");
		});

		it('should include security headers on error responses', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET'
				// No auth header - will return 401
			});

			expect(response.status).toBe(401);
			expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(response.headers.get('X-Frame-Options')).toBe('DENY');
			expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
			expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
		});

		it('should include security headers on successful responses', async () => {
			const { data } = await registerUser('secheader@example.com', 'password123');

			const response = await SELF.fetch('https://example.com/todos', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${data.accessToken}` }
			});

			expect(response.status).toBe(200);
			expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(response.headers.get('X-Frame-Options')).toBe('DENY');
			expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
		});

		it('should include security headers on 400 validation errors', async () => {
			const response = await SELF.fetch('https://example.com/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'invalid-email', password: 'short' })
			});

			expect(response.status).toBe(400);
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(response.headers.get('X-Frame-Options')).toBe('DENY');
			expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
		});

		it('should include security headers on 404 responses', async () => {
			const { data } = await registerUser('notfound@example.com', 'password123');

			const response = await SELF.fetch('https://example.com/todos/99999', {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${data.accessToken}` }
			});

			expect(response.status).toBe(404);
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		});
	});

	// ========================================================================
	// CATEGORY ENDPOINTS
	// ========================================================================

	describe('Category Endpoints', () => {
		describe('GET /categories', () => {
			it('should list system categories for authenticated user', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const { response, data: categoriesData } = await listCategories(data.accessToken);

				expect(response.status).toBe(200);
				expect(categoriesData).toHaveProperty('categories');
				expect(Array.isArray(categoriesData.categories)).toBe(true);
				// Should have 5 system categories
				expect(categoriesData.categories.length).toBe(5);

				// Verify system categories are present
				const categoryNames = categoriesData.categories.map((c: any) => c.name);
				expect(categoryNames).toContain('Work');
				expect(categoryNames).toContain('Personal');
				expect(categoryNames).toContain('Shopping');
				expect(categoryNames).toContain('Health');
				expect(categoryNames).toContain('Learning');

				// Verify all are system categories
				categoriesData.categories.forEach((c: any) => {
					expect(c.is_system).toBe(1);
					expect(c.user_id).toBe(null);
				});
			});

			it('should list system + user categories for authenticated user', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				// Create a user category
				await createCategory(data.accessToken, 'Custom', '#FF0000', '🎨');

				const { response, data: categoriesData } = await listCategories(data.accessToken);

				expect(response.status).toBe(200);
				expect(categoriesData.categories.length).toBe(6); // 5 system + 1 user

				// Find the custom category
				const customCategory = categoriesData.categories.find((c: any) => c.name === 'Custom');
				expect(customCategory).toBeDefined();
				expect(customCategory.is_system).toBe(0);
				expect(customCategory.user_id).toBe(data.user.id);
			});

			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/categories', {
					method: 'GET'
				});

				expect(response.status).toBe(401);
			});
		});

		describe('POST /categories', () => {
			it('should create a category with valid input', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const { response, data: categoryData } = await createCategory(
					data.accessToken,
					'Project',
					'#3B82F6',
					'📁'
				);

				expect(response.status).toBe(201);
				expect(categoryData).toHaveProperty('id');
				expect(categoryData.name).toBe('Project');
				expect(categoryData.color).toBe('#3B82F6');
				expect(categoryData.icon).toBe('📁');
				expect(categoryData.user_id).toBe(data.user.id);
				expect(categoryData.is_system).toBe(0);
				expect(categoryData.sort_order).toBe(0);
			});

			it('should normalize color to uppercase', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const { response, data: categoryData } = await createCategory(
					data.accessToken,
					'Test',
					'#abcdef',
					'🎨'
				);

				expect(response.status).toBe(201);
				expect(categoryData.color).toBe('#ABCDEF');
			});

			it('should reject empty name', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const { response, data: errorData } = await createCategory(
					data.accessToken,
					'',
					'#3B82F6',
					'📁'
				);

				expect(response.status).toBe(400);
				expect(errorData.error).toBe('Validation failed');
				expect(errorData.message).toContain('Name cannot be empty');
			});

			it('should reject name that is too long', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const longName = 'a'.repeat(51);
				const { response, data: errorData } = await createCategory(
					data.accessToken,
					longName,
					'#3B82F6',
					'📁'
				);

				expect(response.status).toBe(400);
				expect(errorData.error).toBe('Validation failed');
				expect(errorData.message).toContain('Name must be 50 characters or less');
			});

			it('should reject invalid hex color format', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const { response, data: errorData } = await createCategory(
					data.accessToken,
					'Test',
					'red',
					'📁'
				);

				expect(response.status).toBe(400);
				expect(errorData.error).toBe('Validation failed');
				expect(errorData.message).toContain('Color must be a valid hex color');
			});

			it('should reject color without hash', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const { response, data: errorData } = await createCategory(
					data.accessToken,
					'Test',
					'3B82F6',
					'📁'
				);

				expect(response.status).toBe(400);
				expect(errorData.error).toBe('Validation failed');
				expect(errorData.message).toContain('Color must be a valid hex color');
			});

			it('should reject missing icon', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const response = await SELF.fetch('https://example.com/categories', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${data.accessToken}`
					},
					body: JSON.stringify({ name: 'Test', color: '#3B82F6' })
				});

				const errorData = await response.json() as any;
				expect(response.status).toBe(400);
				expect(errorData.error).toBe('Validation failed');
				expect(errorData.message).toContain('Icon is required');
			});

			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/categories', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: 'Test', color: '#3B82F6', icon: '📁' })
				});

				expect(response.status).toBe(401);
			});
		});

		describe('PUT /categories/:id', () => {
			it('should update a user category', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				// Create a category
				const { data: created } = await createCategory(
					data.accessToken,
					'Original',
					'#3B82F6',
					'📁'
				);

				// Update it
				const { response, data: updated } = await updateCategory(
					data.accessToken,
					created.id,
					{ name: 'Updated', color: '#FF0000' }
				);

				expect(response.status).toBe(200);
				expect(updated.id).toBe(created.id);
				expect(updated.name).toBe('Updated');
				expect(updated.color).toBe('#FF0000');
				expect(updated.icon).toBe('📁'); // Unchanged
			});

			it('should support partial updates', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				// Create a category
				const { data: created } = await createCategory(
					data.accessToken,
					'Test',
					'#3B82F6',
					'📁'
				);

				// Update only name
				const { response, data: updated } = await updateCategory(
					data.accessToken,
					created.id,
					{ name: 'NewName' }
				);

				expect(response.status).toBe(200);
				expect(updated.name).toBe('NewName');
				expect(updated.color).toBe('#3B82F6'); // Unchanged
				expect(updated.icon).toBe('📁'); // Unchanged
			});

			it('should return 404 for non-existent category', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const { response, data: errorData } = await updateCategory(
					data.accessToken,
					99999,
					{ name: 'Updated' }
				);

				expect(response.status).toBe(404);
				expect(errorData.error).toBe('Not Found');
			});

			it('should return 404 for category not owned by user', async () => {
				const { data: user1 } = await registerUser('user1@example.com', 'password123');
				const { data: user2 } = await registerUser('user2@example.com', 'password123');

				// User 1 creates a category
				const { data: created } = await createCategory(
					user1.accessToken,
					'User1Category',
					'#3B82F6',
					'📁'
				);

				// User 2 tries to update it
				const { response, data: errorData } = await updateCategory(
					user2.accessToken,
					created.id,
					{ name: 'Hacked' }
				);

				expect(response.status).toBe(404);
				expect(errorData.error).toBe('Not Found');
			});

			it('should return 403 for system category', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				// Try to update system category (id 1 is 'Work')
				const { response, data: errorData } = await updateCategory(
					data.accessToken,
					1,
					{ name: 'HackedWork' }
				);

				expect(response.status).toBe(403);
				expect(errorData.error).toBe('Cannot modify system categories');
			});

			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/categories/1', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: 'Updated' })
				});

				expect(response.status).toBe(401);
			});
		});

		describe('DELETE /categories/:id', () => {
			it('should delete a user category', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				// Create a category
				const { data: created } = await createCategory(
					data.accessToken,
					'ToDelete',
					'#3B82F6',
					'📁'
				);

				// Delete it
				const { response, data: deleteData } = await deleteCategory(
					data.accessToken,
					created.id
				);

				expect(response.status).toBe(200);
				expect(deleteData.message).toBe('Category deleted successfully');

				// Verify it's gone
				const { data: categories } = await listCategories(data.accessToken);
				const found = categories.categories.find((c: any) => c.id === created.id);
				expect(found).toBeUndefined();
			});

			it('should unassign todos when category is deleted', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				// Create a category
				const { data: category } = await createCategory(
					data.accessToken,
					'ToDelete',
					'#3B82F6',
					'📁'
				);

				// Create a todo and assign it to the category
				await env.todo_db.prepare(
					'INSERT INTO todos (title, user_id, category_id) VALUES (?, ?, ?)'
				).bind('Test Todo', data.user.id, category.id).run();

				// Delete the category
				await deleteCategory(data.accessToken, category.id);

				// Verify todo's category_id is NULL
				const todo = await env.todo_db.prepare(
					'SELECT * FROM todos WHERE user_id = ?'
				).bind(data.user.id).first() as any;

				expect(todo.category_id).toBe(null);
			});

			it('should return 404 for non-existent category', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				const { response, data: errorData } = await deleteCategory(
					data.accessToken,
					99999
				);

				expect(response.status).toBe(404);
				expect(errorData.error).toBe('Not Found');
			});

			it('should return 404 for category not owned by user', async () => {
				const { data: user1 } = await registerUser('user1@example.com', 'password123');
				const { data: user2 } = await registerUser('user2@example.com', 'password123');

				// User 1 creates a category
				const { data: created } = await createCategory(
					user1.accessToken,
					'User1Category',
					'#3B82F6',
					'📁'
				);

				// User 2 tries to delete it
				const { response, data: errorData } = await deleteCategory(
					user2.accessToken,
					created.id
				);

				expect(response.status).toBe(404);
				expect(errorData.error).toBe('Not Found');

				// Verify it still exists for user 1
				const { data: categories } = await listCategories(user1.accessToken);
				const found = categories.categories.find((c: any) => c.id === created.id);
				expect(found).toBeDefined();
			});

			it('should return 403 for system category', async () => {
				const { data } = await registerUser('user@example.com', 'password123');

				// Try to delete system category (id 1 is 'Work')
				const { response, data: errorData } = await deleteCategory(
					data.accessToken,
					1
				);

				expect(response.status).toBe(403);
				expect(errorData.error).toBe('Cannot delete system categories');

				// Verify system category still exists
				const { data: categories } = await listCategories(data.accessToken);
				const work = categories.categories.find((c: any) => c.name === 'Work');
				expect(work).toBeDefined();
			});

			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/categories/1', {
					method: 'DELETE'
				});

				expect(response.status).toBe(401);
			});
		});

		describe('User Isolation', () => {
			it('should not allow user to see other user categories', async () => {
				const { data: user1 } = await registerUser('user1@example.com', 'password123');
				const { data: user2 } = await registerUser('user2@example.com', 'password123');

				// User 1 creates a category
				await createCategory(user1.accessToken, 'User1Category', '#3B82F6', '📁');

				// User 2 lists categories
				const { data: categories } = await listCategories(user2.accessToken);

				// Should only see system categories (5 total)
				expect(categories.categories.length).toBe(5);
				const user1Category = categories.categories.find((c: any) => c.name === 'User1Category');
				expect(user1Category).toBeUndefined();
			});
		});
	});

	// ========================================================================
	// TODO-CATEGORY INTEGRATION
	// ========================================================================

	describe('Todo-Category Integration', () => {
		describe('POST /todos with category', () => {
			it('should create todo with system category', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create todo with system category (Work, id 1)
				const { response, data: todo } = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						title: 'Work task',
						category_id: 1
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(201);
				expect(todo.title).toBe('Work task');
				expect(todo.category_id).toBe(1);
				expect(todo.category).toBeDefined();
				expect(todo.category.id).toBe(1);
				expect(todo.category.name).toBe('Work');
				expect(todo.category.color).toBe('#3B82F6');
				expect(todo.category.icon).toBe('📋');
			});

			it('should create todo with user-owned category', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create custom category
				const { data: category } = await createCategory(
					user.accessToken,
					'Custom',
					'#FF0000',
					'🎯'
				);

				// Create todo with custom category
				const { response, data: todo } = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						title: 'Custom task',
						category_id: category.id
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(201);
				expect(todo.category_id).toBe(category.id);
				expect(todo.category).toBeDefined();
				expect(todo.category.name).toBe('Custom');
			});

			it('should create todo without category', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				const { response, data: todo } = await createTodo(
					user.accessToken,
					'No category task'
				);

				expect(response.status).toBe(201);
				expect(todo.category_id).toBeNull();
				expect(todo.category).toBeNull();
			});

			it('should reject invalid category_id', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				const { response, data } = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						title: 'Task',
						category_id: 9999
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(400);
				expect(data.error).toBe('Category not found or access denied');
			});

			it('should reject another user category_id', async () => {
				const { data: user1 } = await registerUser('user1@example.com', 'password123');
				const { data: user2 } = await registerUser('user2@example.com', 'password123');

				// User 1 creates a category
				const { data: category } = await createCategory(
					user1.accessToken,
					'User1Category',
					'#3B82F6',
					'📁'
				);

				// User 2 tries to use it
				const { response, data } = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user2.accessToken}`
					},
					body: JSON.stringify({
						title: 'Task',
						category_id: category.id
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(400);
				expect(data.error).toBe('Category not found or access denied');
			});

			it('should reject non-integer category_id', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				const { response, data } = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						title: 'Task',
						category_id: 'invalid'
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Category ID must be an integer');
			});

			it('should reject negative category_id', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				const { response, data } = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						title: 'Task',
						category_id: -1
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(400);
				expect(data.error).toBe('Validation failed');
				expect(data.message).toContain('Category ID must be a positive integer');
			});
		});

		describe('PUT /todos/:id with category', () => {
			it('should update todo to add category', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create todo without category
				const { data: todo } = await createTodo(user.accessToken, 'Task');

				// Update to add category
				const { response, data: updated } = await SELF.fetch(`https://example.com/todos/${todo.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						category_id: 1
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(200);
				expect(updated.category_id).toBe(1);
				expect(updated.category).toBeDefined();
				expect(updated.category.name).toBe('Work');
			});

			it('should update todo to change category', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create todo with category
				const createRes = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						title: 'Task',
						category_id: 1
					})
				});
				const todo = await createRes.json();

				// Change to different category
				const { response, data: updated } = await SELF.fetch(`https://example.com/todos/${todo.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						category_id: 2
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(200);
				expect(updated.category_id).toBe(2);
				expect(updated.category.name).toBe('Personal');
			});

			it('should update todo to remove category', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create todo with category
				const createRes = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						title: 'Task',
						category_id: 1
					})
				});
				const todo = await createRes.json();

				// Remove category
				const { response, data: updated } = await SELF.fetch(`https://example.com/todos/${todo.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						category_id: null
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(200);
				expect(updated.category_id).toBeNull();
				expect(updated.category).toBeNull();
			});

			it('should reject invalid category_id on update', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');
				const { data: todo } = await createTodo(user.accessToken, 'Task');

				const { response, data } = await SELF.fetch(`https://example.com/todos/${todo.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						category_id: 9999
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(400);
				expect(data.error).toBe('Category not found or access denied');
			});

			it('should reject another user category_id on update', async () => {
				const { data: user1 } = await registerUser('user1@example.com', 'password123');
				const { data: user2 } = await registerUser('user2@example.com', 'password123');

				// User 1 creates category and todo
				const { data: category } = await createCategory(
					user1.accessToken,
					'User1Category',
					'#3B82F6',
					'📁'
				);
				const { data: todo } = await createTodo(user2.accessToken, 'Task');

				// User 2 tries to use user 1's category
				const { response, data } = await SELF.fetch(`https://example.com/todos/${todo.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user2.accessToken}`
					},
					body: JSON.stringify({
						category_id: category.id
					})
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(400);
				expect(data.error).toBe('Category not found or access denied');
			});
		});

		describe('GET /todos with category data', () => {
			it('should return todos with nested category object', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create todos with and without categories
				await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ title: 'Work task', category_id: 1 })
				});

				await createTodo(user.accessToken, 'No category task');

				// List todos
				const { response, data } = await SELF.fetch('https://example.com/todos', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(200);
				expect(data.todos).toHaveLength(2);

				const workTodo = data.todos.find((t: any) => t.title === 'Work task');
				expect(workTodo.category).toBeDefined();
				expect(workTodo.category.name).toBe('Work');

				const noCategoryTodo = data.todos.find((t: any) => t.title === 'No category task');
				expect(noCategoryTodo.category).toBeNull();
			});

			it('should filter todos by category_id', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create todos in different categories
				await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ title: 'Work task 1', category_id: 1 })
				});

				await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ title: 'Work task 2', category_id: 1 })
				});

				await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ title: 'Personal task', category_id: 2 })
				});

				// Filter by Work category
				const { response, data } = await SELF.fetch('https://example.com/todos?category_id=1', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(200);
				expect(data.todos).toHaveLength(2);
				expect(data.pagination.total).toBe(2);
				expect(data.todos.every((t: any) => t.category_id === 1)).toBe(true);
			});

			it('should reject invalid category_id filter', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				const { response, data } = await SELF.fetch('https://example.com/todos?category_id=invalid', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(400);
				expect(data.error).toBe('Invalid category_id parameter');
			});
		});

		describe('GET /todos/:id with category data', () => {
			it('should return todo with nested category object', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create todo with category
				const createRes = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ title: 'Work task', category_id: 1 })
				});
				const created = await createRes.json();

				// Get todo by ID
				const { response, data: todo } = await SELF.fetch(`https://example.com/todos/${created.id}`, {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(200);
				expect(todo.category).toBeDefined();
				expect(todo.category.id).toBe(1);
				expect(todo.category.name).toBe('Work');
				expect(todo.category.color).toBe('#3B82F6');
				expect(todo.category.icon).toBe('📋');
			});

			it('should return todo with null category', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');
				const { data: todo } = await createTodo(user.accessToken, 'No category task');

				// Get todo by ID
				const { response, data: fetched } = await SELF.fetch(`https://example.com/todos/${todo.id}`, {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				}).then(async (res) => ({ response: res, data: await res.json() }));

				expect(response.status).toBe(200);
				expect(fetched.category_id).toBeNull();
				expect(fetched.category).toBeNull();
			});
		});

		describe('Category deletion impact on todos', () => {
			it('should set category_id to null when category is deleted', async () => {
				const { data: user } = await registerUser('user@example.com', 'password123');

				// Create custom category
				const { data: category } = await createCategory(
					user.accessToken,
					'Custom',
					'#FF0000',
					'🎯'
				);

				// Create todo with that category
				const createRes = await SELF.fetch('https://example.com/todos', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({
						title: 'Task',
						category_id: category.id
					})
				});
				const todo = await createRes.json();

				// Delete category
				await deleteCategory(user.accessToken, category.id);

				// Fetch todo - should have null category_id
				const fetchRes = await SELF.fetch(`https://example.com/todos/${todo.id}`, {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				});
				const fetched = await fetchRes.json();

				expect(fetched.category_id).toBeNull();
				expect(fetched.category).toBeNull();
			});
		});

		describe('GET /categories/stats', () => {
			it('should require authentication', async () => {
				const response = await SELF.fetch('https://example.com/categories/stats', {
					method: 'GET'
				});

				expect(response.status).toBe(401);
			});

			it('should return stats for all categories with zero counts initially', async () => {
				const { data: user } = await registerUser('stats1@example.com', 'password123');

				const response = await SELF.fetch('https://example.com/categories/stats', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				});

				expect(response.status).toBe(200);
				const data = await response.json();

				// Should have stats array and uncategorized object
				expect(data.stats).toBeDefined();
				expect(Array.isArray(data.stats)).toBe(true);
				expect(data.uncategorized).toBeDefined();

				// System categories should exist with zero counts
				expect(data.stats.length).toBeGreaterThanOrEqual(5);
				data.stats.forEach((stat: any) => {
					expect(stat).toHaveProperty('id');
					expect(stat).toHaveProperty('name');
					expect(stat).toHaveProperty('color');
					expect(stat).toHaveProperty('icon');
					expect(stat).toHaveProperty('is_system');
					expect(stat).toHaveProperty('todo_count');
					expect(stat).toHaveProperty('completed_count');
					expect(stat.todo_count).toBe(0);
					expect(stat.completed_count).toBe(0);
				});

				// Uncategorized should be zero
				expect(data.uncategorized.todo_count).toBe(0);
				expect(data.uncategorized.completed_count).toBe(0);
			});

			it('should return correct counts for categorized todos', async () => {
				const { data: user } = await registerUser('stats2@example.com', 'password123');

				// Get categories to find system category IDs
				const { data: categoriesData } = await listCategories(user.accessToken);
				const workCategory = categoriesData.categories.find((c: any) => c.name === 'Work');

				// Create 3 todos in Work category (2 completed, 1 not completed)
				await createTodo(user.accessToken, 'Work task 1');
				const { data: todo1 } = await createTodo(user.accessToken, 'Work task 2');
				const { data: todo2 } = await createTodo(user.accessToken, 'Work task 3');

				// Update todos to add category and mark some completed
				await SELF.fetch(`https://example.com/todos/${todo1.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ category_id: workCategory.id, completed: 1 })
				});

				await SELF.fetch(`https://example.com/todos/${todo2.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ category_id: workCategory.id, completed: 1 })
				});

				// Get stats
				const response = await SELF.fetch('https://example.com/categories/stats', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				});

				expect(response.status).toBe(200);
				const data = await response.json();

				// Find Work category stats
				const workStats = data.stats.find((s: any) => s.name === 'Work');
				expect(workStats).toBeDefined();
				expect(workStats.todo_count).toBe(2);
				expect(workStats.completed_count).toBe(2);

				// Uncategorized should have 1 todo (the first one we created)
				expect(data.uncategorized.todo_count).toBe(1);
				expect(data.uncategorized.completed_count).toBe(0);
			});

			it('should return correct counts for user custom categories', async () => {
				const { data: user } = await registerUser('stats3@example.com', 'password123');

				// Create custom category
				const { data: customCategory } = await createCategory(
					user.accessToken,
					'Custom',
					'#FF0000',
					'🎯'
				);

				// Create todos with custom category
				const { data: todo1 } = await createTodo(user.accessToken, 'Custom task 1');
				const { data: todo2 } = await createTodo(user.accessToken, 'Custom task 2');

				// Update todos to add category
				await SELF.fetch(`https://example.com/todos/${todo1.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ category_id: customCategory.id, completed: 1 })
				});

				await SELF.fetch(`https://example.com/todos/${todo2.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ category_id: customCategory.id })
				});

				// Get stats
				const response = await SELF.fetch('https://example.com/categories/stats', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				});

				expect(response.status).toBe(200);
				const data = await response.json();

				// Find custom category stats
				const customStats = data.stats.find((s: any) => s.name === 'Custom');
				expect(customStats).toBeDefined();
				expect(customStats.todo_count).toBe(2);
				expect(customStats.completed_count).toBe(1);
				expect(customStats.is_system).toBe(0);
			});

			it('should isolate stats per user', async () => {
				const { data: user1 } = await registerUser('stats4a@example.com', 'password123');
				const { data: user2 } = await registerUser('stats4b@example.com', 'password123');

				// Get Work category for user1
				const { data: categories1 } = await listCategories(user1.accessToken);
				const workCategory1 = categories1.categories.find((c: any) => c.name === 'Work');

				// Create todos for user1
				const { data: todo1 } = await createTodo(user1.accessToken, 'User1 task');
				await SELF.fetch(`https://example.com/todos/${todo1.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user1.accessToken}`
					},
					body: JSON.stringify({ category_id: workCategory1.id })
				});

				// Get stats for user1
				const response1 = await SELF.fetch('https://example.com/categories/stats', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user1.accessToken}` }
				});
				const data1 = await response1.json();

				// Get stats for user2
				const response2 = await SELF.fetch('https://example.com/categories/stats', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user2.accessToken}` }
				});
				const data2 = await response2.json();

				// User1 should have 1 todo in Work category
				const workStats1 = data1.stats.find((s: any) => s.name === 'Work');
				expect(workStats1.todo_count).toBe(1);

				// User2 should have 0 todos in Work category
				const workStats2 = data2.stats.find((s: any) => s.name === 'Work');
				expect(workStats2.todo_count).toBe(0);
			});

			it('should order stats by is_system DESC, sort_order ASC, name ASC', async () => {
				const { data: user } = await registerUser('stats5@example.com', 'password123');

				// Create multiple custom categories
				await createCategory(user.accessToken, 'Zebra', '#FF0000', '🦓');
				await createCategory(user.accessToken, 'Apple', '#00FF00', '🍎');

				// Get stats
				const response = await SELF.fetch('https://example.com/categories/stats', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				});

				const data = await response.json();

				// System categories should come first
				const systemCategories = data.stats.filter((s: any) => s.is_system === 1);
				const userCategories = data.stats.filter((s: any) => s.is_system === 0);

				expect(systemCategories.length).toBeGreaterThan(0);
				expect(userCategories.length).toBe(2);

				// First categories should be system
				expect(data.stats[0].is_system).toBe(1);

				// User categories should be alphabetically sorted
				const userCategoryNames = userCategories.map((c: any) => c.name);
				expect(userCategoryNames).toEqual(['Apple', 'Zebra']);
			});

			it('should include uncategorized count correctly', async () => {
				const { data: user } = await registerUser('stats6@example.com', 'password123');

				// Create uncategorized todos
				await createTodo(user.accessToken, 'Uncategorized 1');
				const { data: todo2 } = await createTodo(user.accessToken, 'Uncategorized 2');

				// Mark one as completed
				await SELF.fetch(`https://example.com/todos/${todo2.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${user.accessToken}`
					},
					body: JSON.stringify({ completed: 1 })
				});

				// Get stats
				const response = await SELF.fetch('https://example.com/categories/stats', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${user.accessToken}` }
				});

				const data = await response.json();

				// Uncategorized should have 2 todos, 1 completed
				expect(data.uncategorized.todo_count).toBe(2);
				expect(data.uncategorized.completed_count).toBe(1);
			});
		});
	});
});
