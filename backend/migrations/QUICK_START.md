# Quick Start: Applying User Authentication Migration

## TL;DR - Apply Migration Now

### For Local Development

```bash
# Navigate to project root
cd /Users/isaacbailey/projects/todo-api

# Apply the migration
wrangler d1 execute todo-db --local --file=./migrations/001_add_users_auth.sql
```

### For Production (when ready)

```bash
# Apply the migration
wrangler d1 execute todo-db --file=./migrations/001_add_users_auth.sql
```

---

## What This Migration Does

Creates 3 new tables:
1. **users** - Stores user accounts (email + password hash)
2. **refresh_tokens** - Long-lived tokens for getting new JWTs
3. **token_blacklist** - Invalidated JWTs that shouldn't be accepted

Modifies 1 existing table:
- **todos** - Adds `user_id` column to link todos to users

---

## Handling Existing Todos (IMPORTANT!)

If you have existing todos in your database, the migration adds `user_id` as a nullable column. You need to decide what to do with existing todos:

### Option A: Delete Existing Todos (Recommended for Development)

```bash
# Clear existing todos before migration
wrangler d1 execute todo-db --local --command "DELETE FROM todos"

# Then apply migration
wrangler d1 execute todo-db --local --file=./migrations/001_add_users_auth.sql
```

### Option B: Keep Existing Todos

If you want to preserve existing todos, you'll need to:

1. Apply the migration first
2. Create a default user manually
3. Assign existing todos to that user

This is more complex and typically only needed for production databases with real data.

---

## Verifying the Migration

Check that all tables were created:

```bash
# List all tables
wrangler d1 execute todo-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"

# You should see: todos, users, refresh_tokens, token_blacklist
```

Check the todos table has user_id column:

```bash
# Show todos table schema
wrangler d1 execute todo-db --local --command "PRAGMA table_info(todos)"

# You should see user_id in the column list
```

---

## What's Next After Migration

1. **Update TypeScript interfaces** in `src/index.ts`:
   ```typescript
   interface User {
     id?: number;
     email: string;
     password_hash: string;
     created_at?: string;
     updated_at?: string;
   }

   interface RefreshToken {
     id?: number;
     user_id: number;
     token: string;
     expires_at: string;
     created_at?: string;
   }
   ```

2. **Add authentication routes**:
   - `POST /auth/register` - Create new user
   - `POST /auth/login` - Login and get JWT + refresh token
   - `POST /auth/refresh` - Get new JWT using refresh token
   - `POST /auth/logout` - Blacklist JWT and delete refresh token

3. **Install authentication libraries**:
   ```bash
   npm install bcrypt jsonwebtoken uuid
   npm install --save-dev @types/bcrypt @types/jsonwebtoken @types/uuid
   ```

4. **Update existing todo routes** to filter by authenticated user

---

## Troubleshooting

### Error: "table users already exists"

The migration is idempotent. This error means the migration was already applied. Safe to ignore or you can check:

```bash
wrangler d1 execute todo-db --local --command ".schema users"
```

### Error: "duplicate column name: user_id"

The user_id column was already added to todos. Safe to ignore or verify:

```bash
wrangler d1 execute todo-db --local --command "PRAGMA table_info(todos)"
```

### Foreign Keys Not Working

Make sure your code enables foreign keys (Workers should do this automatically):

```typescript
// In your worker, before any DB operations
await env.todo_db.prepare('PRAGMA foreign_keys = ON').run();
```

---

## Need More Info?

- **Full migration details**: See `001_add_users_auth.sql`
- **Design rationale**: See `SCHEMA_DESIGN.md`
- **Migration best practices**: See `README.md`

---

## Common Commands Reference

```bash
# View current schema
wrangler d1 execute todo-db --local --command ".schema"

# List all tables
wrangler d1 execute todo-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"

# Count rows in a table
wrangler d1 execute todo-db --local --command "SELECT COUNT(*) FROM users"

# View table structure
wrangler d1 execute todo-db --local --command "PRAGMA table_info(users)"

# View all indexes
wrangler d1 execute todo-db --local --command "SELECT name FROM sqlite_master WHERE type='index'"

# Clear a table (careful!)
wrangler d1 execute todo-db --local --command "DELETE FROM users"
```
