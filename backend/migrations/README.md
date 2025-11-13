# Database Migrations

This directory contains SQL migration files for the todo-api D1 database schema.

## Migration Files

- **001_add_users_auth.sql**: Adds user authentication system with users, refresh tokens, token blacklist, and updates todos table to link to users

## How to Apply Migrations

### Local Development (using local D1)

Apply migrations to your local development database:

```bash
# Apply migration 001 (user authentication)
wrangler d1 execute todo-db --local --file=./migrations/001_add_users_auth.sql
```

### Production

Apply migrations to your production D1 database:

```bash
# Apply migration 001 (user authentication)
wrangler d1 execute todo-db --file=./migrations/001_add_users_auth.sql
```

**Warning**: Always test migrations locally before applying to production!

## Initial Setup

If you're setting up a fresh database, you have two options:

### Option 1: Apply migrations in order (Recommended)

```bash
# Local
wrangler d1 execute todo-db --local --file=./schema.sql
wrangler d1 execute todo-db --local --file=./migrations/001_add_users_auth.sql

# Production
wrangler d1 execute todo-db --file=./schema.sql
wrangler d1 execute todo-db --file=./migrations/001_add_users_auth.sql
```

### Option 2: Use combined schema (Future Enhancement)

Once all migrations are stable, we can create a `schema-full.sql` that includes everything for fresh installations.

## Handling Existing Data

### Migration 001 Notes

If you have existing todos in your database when applying migration 001, the `user_id` column will be added as nullable. You need to handle existing todos:

**Option A: Delete existing todos (simplest for development)**
```bash
# Before running migration, clear todos:
wrangler d1 execute todo-db --local --command "DELETE FROM todos"
# Then run migration
wrangler d1 execute todo-db --local --file=./migrations/001_add_users_auth.sql
```

**Option B: Assign to a default user (for preserving data)**
```bash
# First run the migration
wrangler d1 execute todo-db --local --file=./migrations/001_add_users_auth.sql

# Create a default user (you'll need to generate a proper bcrypt hash)
wrangler d1 execute todo-db --local --command "INSERT INTO users (email, password_hash) VALUES ('default@example.com', '\$2a\$10\$...')"

# Assign existing todos to that user (assuming user id = 1)
wrangler d1 execute todo-db --local --command "UPDATE todos SET user_id = 1 WHERE user_id IS NULL"
```

## Migration Best Practices

1. **Always backup production data** before applying migrations
2. **Test locally first** using `--local` flag
3. **Version control** all migration files (they're already in git)
4. **Never modify existing migrations** once applied to production - create new migrations instead
5. **Document breaking changes** clearly in migration comments
6. **Keep migrations idempotent** where possible (use IF NOT EXISTS, IF EXISTS, etc.)

## Checking Current Schema

To verify your current database schema:

```bash
# Local
wrangler d1 execute todo-db --local --command ".schema"

# Production
wrangler d1 execute todo-db --command ".schema"
```

To list all tables:

```bash
# Local
wrangler d1 execute todo-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"

# Production
wrangler d1 execute todo-db --command "SELECT name FROM sqlite_master WHERE type='table'"
```

## Rolling Back Migrations

D1 does not have automatic rollback support. If you need to undo a migration:

1. Create a new migration file with the reverse operations (e.g., `002_rollback_users_auth.sql`)
2. Manually write SQL to undo the changes (DROP TABLE, ALTER TABLE DROP COLUMN, etc.)
3. Apply the rollback migration

**Note**: Some operations cannot be rolled back without data loss (like dropping tables).

## Foreign Keys in D1

D1/SQLite requires foreign keys to be explicitly enabled. Each migration file includes:

```sql
PRAGMA foreign_keys = ON;
```

This ensures referential integrity is maintained. However, note that:
- Foreign keys are enabled per-connection
- Cloudflare Workers automatically enable foreign keys for D1 connections
- You should still include this pragma in migration files for consistency

## Future Enhancements

- Consider creating a migration tracking table to record which migrations have been applied
- Automate migration application with a script
- Create a combined schema file for fresh installations
- Add migration checksum validation
