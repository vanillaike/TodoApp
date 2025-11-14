# Schema Design: User Authentication System

## Overview

This document explains the design decisions behind the user authentication schema for the todo-api Cloudflare Workers application.

## Tables

### 1. Users Table

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Design Decisions:**

- **email as TEXT UNIQUE**: Email serves as the unique login identifier. The UNIQUE constraint ensures no duplicate accounts.
- **password_hash as TEXT**: Stores bcrypt hash of the password (never store plain text passwords). Bcrypt produces strings like `$2a$10$...` which are safe to store as TEXT.
- **No additional profile fields**: Kept minimal for Phase 1. Additional fields (name, avatar, etc.) can be added in future migrations.
- **Timestamps**: `created_at` and `updated_at` for audit trail, consistent with existing todos table pattern.

**Index:**
- `idx_users_email`: Accelerates login queries which filter by email. Critical for performance since every login requires an email lookup.

---

### 2. Refresh Tokens Table

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Design Decisions:**

- **Separate table for refresh tokens**: Allows multiple active sessions per user (mobile app, web browser, etc.). Each device/session gets its own refresh token.
- **token as TEXT UNIQUE**: The actual refresh token value (recommend UUID v4 or similar). UNIQUE prevents token collision.
- **expires_at as TEXT**: SQLite/D1 uses TEXT for timestamps (ISO 8601 format: `YYYY-MM-DD HH:MM:SS`). Typically set to 30 days from creation.
- **Foreign key with CASCADE DELETE**: When a user is deleted, all their refresh tokens are automatically deleted. This maintains data integrity and prevents orphaned tokens.
- **No is_revoked column**: Instead of soft-deleting tokens, we physically delete them when revoked. Simpler and reduces table size.

**Indexes:**
- `idx_refresh_tokens_token`: Fast lookup when validating a refresh token (primary use case).
- `idx_refresh_tokens_user_id`: Enables efficient queries like "get all tokens for user X" or "revoke all tokens for user X".

**Typical Workflow:**
1. User logs in → receives JWT (short-lived, 15 min) + refresh token (long-lived, 30 days)
2. JWT expires → client uses refresh token to get new JWT
3. User logs out → refresh token is deleted from this table
4. User changes password → all refresh tokens deleted (force re-login on all devices)

---

### 3. Token Blacklist Table

```sql
CREATE TABLE IF NOT EXISTS token_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  blacklisted_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Design Decisions:**

- **Purpose**: JWTs are stateless and valid until expiration. This table allows invalidating JWTs before their natural expiration (for logout, security breaches, etc.).
- **token as TEXT UNIQUE**: Stores the full JWT string. UNIQUE prevents duplicate entries.
- **expires_at**: Copy of the JWT's expiration time. Allows cleanup of old blacklist entries (no need to keep blacklisted tokens after they naturally expire).
- **blacklisted_at**: Audit trail for when the token was blacklisted.

**Index:**
- `idx_token_blacklist_token`: Every protected API request needs to check if the JWT is blacklisted. This index makes that check fast (O(log n)).
- `idx_token_blacklist_expires_at`: Enables efficient cleanup queries to delete expired blacklist entries.

**Cleanup Strategy:**
Periodically (e.g., daily cron job) run:
```sql
DELETE FROM token_blacklist WHERE expires_at < CURRENT_TIMESTAMP;
```

**Alternative Considered:**
- Using a distributed cache (like Cloudflare KV or Redis) for blacklist instead of database
- **Rejected because**: D1 queries are very fast, and KV has eventual consistency which could allow brief token reuse. Database provides immediate consistency.

---

### 4. Todos Table Update

```sql
ALTER TABLE todos ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
```

**Design Decisions:**

- **ALTER TABLE instead of recreate**: Preserves existing todos data. Recreating would require dropping and copying data.
- **user_id initially nullable**: SQLite doesn't support adding NOT NULL columns to existing tables with data. We add as nullable, then handle existing data, then optionally enforce NOT NULL via table recreation.
- **No foreign key constraint in ALTER**: SQLite limitations - foreign keys must be defined at table creation. To add FK, need to recreate table (documented in migration for future).
- **Index on user_id**: Critical for performance. Queries like "get all todos for user X" will be common and must be fast.

**Handling Existing Data:**

Two strategies provided in migration comments:

1. **Development/Testing**: Delete all existing todos (clean slate)
2. **Production**: Create a default user and assign existing todos to them

**Future Enhancement:**

To fully enforce NOT NULL and add foreign key constraint:

```sql
-- Create new table with proper constraints
CREATE TABLE todos_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER DEFAULT 0,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy data
INSERT INTO todos_new SELECT * FROM todos;

-- Swap tables
DROP TABLE todos;
ALTER TABLE todos_new RENAME TO todos;

-- Recreate indexes
CREATE INDEX idx_todos_user_id ON todos(user_id);
```

This will be migration 002 or 003 after all todos have user_id values.

---

## Security Considerations

### Password Storage

- **Never store plain text passwords**: Use bcrypt with appropriate cost factor (10-12 for 2024 standards)
- **Bcrypt is slow intentionally**: Protects against brute force attacks
- **Example bcrypt hash**: `$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

### Token Security

- **JWTs should be short-lived**: Recommend 15-30 minutes max
- **Refresh tokens are long-lived**: 30 days is reasonable, but consider security vs. UX trade-offs
- **Store tokens securely on client**: httpOnly cookies (if same-origin) or secure localStorage with XSS protections
- **Blacklist on logout**: Always blacklist JWTs when user logs out (don't rely on client-side deletion)

### SQL Injection Protection

- **Always use prepared statements**: The existing codebase follows this pattern:
  ```typescript
  env.todo_db.prepare('SELECT * FROM users WHERE email = ?').bind(email)
  ```
- **Never interpolate user input**: Never do `WHERE email = '${email}'`

### Foreign Key Cascading

- **ON DELETE CASCADE**: When a user is deleted, their refresh tokens are auto-deleted. Consider also adding CASCADE for todos (delete user → delete their todos) or SET NULL (preserve todos but orphan them).

---

## Data Types: TEXT vs INTEGER for Timestamps

**Decision**: Use TEXT for timestamps (following D1/SQLite conventions)

**Rationale:**

- SQLite doesn't have a native DATETIME type
- TEXT with ISO 8601 format (`YYYY-MM-DD HH:MM:SS`) is human-readable
- SQLite's `CURRENT_TIMESTAMP` returns TEXT in ISO 8601 format
- JavaScript's `new Date().toISOString()` is compatible
- Can still perform date comparisons: `WHERE expires_at > CURRENT_TIMESTAMP`

**Alternative Considered:**
- INTEGER (Unix timestamp in milliseconds)
- **Rejected because**: Less readable, existing todos table uses TEXT, consistency matters

---

## Indexing Strategy

**Indexes Created:**

1. `idx_users_email` - Every login queries by email
2. `idx_refresh_tokens_token` - Every token refresh validates the token
3. `idx_refresh_tokens_user_id` - Token revocation queries by user
4. `idx_token_blacklist_token` - Every authenticated request checks blacklist
5. `idx_token_blacklist_expires_at` - Cleanup queries filter by expiration
6. `idx_todos_user_id` - Every todo query filters by user

**Performance Impact:**

- **Read performance**: Significantly improved (O(log n) instead of O(n))
- **Write performance**: Slightly degraded (indexes must be updated on INSERT/UPDATE/DELETE)
- **Storage**: Indexes consume additional space

**Trade-off**: For this application, reads vastly outnumber writes, so indexes are a clear win.

---

## Scalability Considerations

### Current Design (Suitable for)

- Small to medium applications (up to 100K users)
- D1 is serverless and auto-scales
- Indexes ensure good query performance

### Future Enhancements (If scaling beyond 100K users)

1. **Partition refresh_tokens by user_id**: D1 doesn't support partitioning yet, but if migrating to another DB, this would help.
2. **Move blacklist to faster storage**: Consider Cloudflare KV or Durable Objects for blacklist once scale demands it.
3. **Add token_blacklist TTL**: Automatically expire entries (some databases support this natively).
4. **Rate limiting table**: Track login attempts per email to prevent brute force (could be another table or use Cloudflare Rate Limiting).

---

## Migration Safety

**This migration is**:

- **Additive**: Adds new tables and columns, doesn't remove existing data
- **Idempotent**: Uses `IF NOT EXISTS` - safe to run multiple times
- **Reversible**: Can be rolled back by dropping new tables and column (though data would be lost)

**Breaking Change:**

- Adding `user_id` to todos is technically breaking if application code assumes todos don't have this field
- API will need updates to filter todos by authenticated user
- Existing todos without user_id need handling

**Recommended Deployment Strategy:**

1. Apply migration to production database
2. Handle existing todos (assign to default user or delete)
3. Deploy updated API code that enforces user authentication
4. Update frontend to send authentication headers

---

## Comparison with Alternatives

### Alternative 1: Stateful Sessions (rejected)

Store sessions in database instead of JWTs.

**Pros**: Easy token revocation (just delete session)
**Cons**:
- Requires DB query for every authenticated request (slower)
- Doesn't scale as well as stateless JWTs
- More complex in serverless environment

### Alternative 2: Single Token Type (rejected)

Use only JWTs, no refresh tokens.

**Pros**: Simpler implementation
**Cons**:
- Either tokens are short-lived (poor UX, frequent re-login)
- Or tokens are long-lived (security risk if stolen)
- Can't revoke tokens (no blacklist would help since tokens are long-lived)

### Alternative 3: OAuth Only (rejected for Phase 1)

Only support third-party OAuth (Google, GitHub, etc.), no email/password.

**Pros**: No password storage concerns
**Cons**:
- Requires external service dependency
- More complex initial setup
- Phase 1 requirement is email/password

**Future**: Can add OAuth in Phase 2+ alongside email/password auth.

---

## Compliance Considerations

### GDPR / Privacy

- **Right to deletion**: Foreign key CASCADE makes it easy - delete user, all related data is deleted
- **Data minimization**: Only store necessary fields (email, password hash)
- **Secure storage**: Password hashes (not plain text), tokens are random/encrypted

### Audit Trail

- `created_at` / `updated_at` / `blacklisted_at` provide basic audit trail
- Future enhancement: Add audit_log table for compliance-heavy applications

---

## Testing Recommendations

After applying this migration, test:

1. **User creation**: INSERT into users with bcrypt hash
2. **Email uniqueness**: Try duplicate email (should fail with UNIQUE constraint)
3. **Refresh token creation**: INSERT linked to user_id
4. **Foreign key cascade**: DELETE user, verify refresh_tokens are deleted
5. **Token blacklist**: INSERT JWT, verify fast lookup
6. **Todos with user_id**: INSERT/SELECT todos with user_id filter
7. **Index usage**: Use SQLite EXPLAIN QUERY PLAN to verify indexes are used

---

## Conclusion

This schema design provides a solid foundation for JWT-based authentication with refresh tokens in a Cloudflare Workers + D1 environment. It balances:

- **Security**: Bcrypt, token blacklist, foreign keys
- **Performance**: Strategic indexing
- **Scalability**: Stateless JWTs, D1 auto-scaling
- **Maintainability**: Clear naming, comprehensive documentation
- **Compatibility**: Follows SQLite/D1 conventions and existing project patterns

Phase 2+ can build on this foundation to add OAuth, role-based access control, multi-factor authentication, etc.
