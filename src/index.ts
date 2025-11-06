export interface Env {
  todo_db: D1Database;
}

interface Todo {
  id?: number;
  title: string;
  description?: string;
  completed: number;
  created_at?: string;
  updated_at?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /todos - List all todos
      if (path === '/todos' && method === 'GET') {
        const { results } = await env.todo_db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // POST /todos - Create a new todo
      if (path === '/todos' && method === 'POST') {
        const body: Partial<Todo> = await request.json();

        if (!body.title || body.title.trim() === '') {
          return new Response(JSON.stringify({ error: 'Title is required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const result = await env.todo_db.prepare(
          'INSERT INTO todos (title, description, completed) VALUES (?, ?, ?)'
        )
          .bind(body.title, body.description || null, body.completed || 0)
          .run();

        const todo = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(result.meta.last_row_id)
          .first();

        return new Response(JSON.stringify(todo), {
          status: 201,
          headers: corsHeaders
        });
      }

      // GET /todos/:id - Get a specific todo
      const getTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (getTodoMatch && method === 'GET') {
        const id = getTodoMatch[1];
        const todo = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(id)
          .first();

        if (!todo) {
          return new Response(JSON.stringify({ error: 'Todo not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify(todo), { headers: corsHeaders });
      }

      // PUT /todos/:id - Update a todo
      const putTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (putTodoMatch && method === 'PUT') {
        const id = putTodoMatch[1];
        const body: Partial<Todo> = await request.json();

        // Check if todo exists
        const existing = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(id)
          .first();

        if (!existing) {
          return new Response(JSON.stringify({ error: 'Todo not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        await env.todo_db.prepare(
          'UPDATE todos SET title = ?, description = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        )
          .bind(
            body.title !== undefined ? body.title : existing.title,
            body.description !== undefined ? body.description : existing.description,
            body.completed !== undefined ? body.completed : existing.completed,
            id
          )
          .run();

        const updated = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(id)
          .first();

        return new Response(JSON.stringify(updated), { headers: corsHeaders });
      }

      // DELETE /todos/:id - Delete a todo
      const deleteTodoMatch = path.match(/^\/todos\/(\d+)$/);
      if (deleteTodoMatch && method === 'DELETE') {
        const id = deleteTodoMatch[1];

        const existing = await env.todo_db.prepare('SELECT * FROM todos WHERE id = ?')
          .bind(id)
          .first();

        if (!existing) {
          return new Response(JSON.stringify({ error: 'Todo not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        await env.todo_db.prepare('DELETE FROM todos WHERE id = ?')
          .bind(id)
          .run();

        return new Response(JSON.stringify({ message: 'Todo deleted successfully' }), {
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  },
};
