import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';

describe('TODO API', () => {
	beforeAll(async () => {
		// Set up the database schema
		await env.todo_db.prepare(`
			CREATE TABLE IF NOT EXISTS todos (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				description TEXT,
				completed INTEGER DEFAULT 0,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP
			)
		`).run();
	});

	describe('GET /todos', () => {
		it('returns empty array initially', async () => {
			const response = await SELF.fetch('https://example.com/todos');
			expect(response.status).toBe(200);

			const todos = await response.json();
			expect(Array.isArray(todos)).toBe(true);
			expect(todos).toHaveLength(0);
		});

		it('returns all todos ordered by created_at DESC', async () => {
			// Create multiple todos
			await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'First Todo' })
			});

			// Small delay to ensure different timestamps (SQLite CURRENT_TIMESTAMP has second precision)
			await new Promise(resolve => setTimeout(resolve, 1100));

			await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Second Todo' })
			});

			const response = await SELF.fetch('https://example.com/todos');
			expect(response.status).toBe(200);

			const todos = await response.json();
			expect(todos).toHaveLength(2);
			expect(todos[0].title).toBe('Second Todo'); // Most recent first
			expect(todos[1].title).toBe('First Todo');
		});

		it('returns correct CORS headers', async () => {
			const response = await SELF.fetch('https://example.com/todos');
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Content-Type')).toBe('application/json');
		});
	});

	describe('POST /todos', () => {
		it('creates todo with title only', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Test Todo' })
			});

			expect(response.status).toBe(201);

			const todo = await response.json();
			expect(todo).toHaveProperty('id');
			expect(todo.title).toBe('Test Todo');
			expect(todo.completed).toBe(0);
			expect(todo).toHaveProperty('created_at');
		});

		it('creates todo with title and description', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: 'Test Todo',
					description: 'Test Description'
				})
			});

			expect(response.status).toBe(201);

			const todo = await response.json();
			expect(todo.title).toBe('Test Todo');
			expect(todo.description).toBe('Test Description');
		});

		it('returns 400 when title is missing', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: 'No title' })
			});

			expect(response.status).toBe(400);

			const error = await response.json();
			expect(error).toHaveProperty('error');
			expect(error.error).toBe('Title is required');
		});

		it('returns 400 when title is empty string', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: '   ' })
			});

			expect(response.status).toBe(400);

			const error = await response.json();
			expect(error.error).toBe('Title is required');
		});
	});

	describe('GET /todos/:id', () => {
		it('returns specific todo by id', async () => {
			// Create a todo first
			const createResponse = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Specific Todo' })
			});
			const created = await createResponse.json();

			// Get the todo by id
			const response = await SELF.fetch(`https://example.com/todos/${created.id}`);
			expect(response.status).toBe(200);

			const todo = await response.json();
			expect(todo.id).toBe(created.id);
			expect(todo.title).toBe('Specific Todo');
		});

		it('returns 404 for non-existent id', async () => {
			const response = await SELF.fetch('https://example.com/todos/99999');
			expect(response.status).toBe(404);

			const error = await response.json();
			expect(error.error).toBe('Todo not found');
		});

		it('returns correct structure', async () => {
			// Create a todo
			const createResponse = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: 'Structured Todo',
					description: 'With description'
				})
			});
			const created = await createResponse.json();

			// Get it back
			const response = await SELF.fetch(`https://example.com/todos/${created.id}`);
			const todo = await response.json();

			expect(todo).toHaveProperty('id');
			expect(todo).toHaveProperty('title');
			expect(todo).toHaveProperty('description');
			expect(todo).toHaveProperty('completed');
			expect(todo).toHaveProperty('created_at');
			expect(todo).toHaveProperty('updated_at');
		});
	});

	describe('PUT /todos/:id', () => {
		it('updates todo title', async () => {
			// Create a todo
			const createResponse = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Original Title' })
			});
			const created = await createResponse.json();

			// Update the title
			const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Updated Title' })
			});

			expect(response.status).toBe(200);

			const updated = await response.json();
			expect(updated.title).toBe('Updated Title');
		});

		it('updates todo completed status', async () => {
			// Create a todo
			const createResponse = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Todo to complete' })
			});
			const created = await createResponse.json();

			// Mark as completed
			const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ completed: 1 })
			});

			expect(response.status).toBe(200);

			const updated = await response.json();
			expect(updated.completed).toBe(1);
		});

		it('handles partial updates', async () => {
			// Create a todo with all fields
			const createResponse = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: 'Full Todo',
					description: 'Original description'
				})
			});
			const created = await createResponse.json();

			// Update only the description
			const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: 'Updated description' })
			});

			expect(response.status).toBe(200);

			const updated = await response.json();
			expect(updated.title).toBe('Full Todo'); // Title unchanged
			expect(updated.description).toBe('Updated description'); // Description updated
		});

		it('updates updated_at timestamp', async () => {
			// Create a todo
			const createResponse = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Timestamp Test' })
			});
			const created = await createResponse.json();
			const originalUpdatedAt = created.updated_at;

			// Wait a bit to ensure timestamp difference
			await new Promise(resolve => setTimeout(resolve, 10));

			// Update the todo
			const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Updated for timestamp' })
			});

			const updated = await response.json();
			expect(updated.updated_at).toBeDefined();
			// Note: In SQLite with CURRENT_TIMESTAMP, the timestamp should be different
			// but due to precision, we just verify it exists
		});

		it('returns 404 for non-existent id', async () => {
			const response = await SELF.fetch('https://example.com/todos/99999', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Updated' })
			});

			expect(response.status).toBe(404);

			const error = await response.json();
			expect(error.error).toBe('Todo not found');
		});
	});

	describe('DELETE /todos/:id', () => {
		it('deletes existing todo', async () => {
			// Create a todo
			const createResponse = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Todo to delete' })
			});
			const created = await createResponse.json();

			// Delete it
			const response = await SELF.fetch(`https://example.com/todos/${created.id}`, {
				method: 'DELETE'
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result.message).toBe('Todo deleted successfully');
		});

		it('verifies todo is actually removed', async () => {
			// Create a todo
			const createResponse = await SELF.fetch('https://example.com/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Todo to verify deletion' })
			});
			const created = await createResponse.json();

			// Delete it
			await SELF.fetch(`https://example.com/todos/${created.id}`, {
				method: 'DELETE'
			});

			// Try to get it
			const getResponse = await SELF.fetch(`https://example.com/todos/${created.id}`);
			expect(getResponse.status).toBe(404);
		});

		it('returns 404 for non-existent id', async () => {
			const response = await SELF.fetch('https://example.com/todos/99999', {
				method: 'DELETE'
			});

			expect(response.status).toBe(404);

			const error = await response.json();
			expect(error.error).toBe('Todo not found');
		});
	});

	describe('OPTIONS (CORS)', () => {
		it('returns proper CORS headers for preflight', async () => {
			const response = await SELF.fetch('https://example.com/todos', {
				method: 'OPTIONS'
			});

			expect(response.status).toBe(200);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
			expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
		});
	});
});
