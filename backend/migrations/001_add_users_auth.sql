-- Migration 001: Add User Authentication System
-- This migration adds support for user authentication with JWT and refresh tokens
-- It creates users, refresh_tokens, and token_blacklist tables, and adds user_id to todos

-- Enable foreign key constraints (required for D1/SQLite)
PRAGMA foreign_keys = ON;

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user accounts with email-based authentication
-- Password is stored as bcrypt hash for security
-- Indexed on email for fast login lookups
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,           -- User's email (unique login identifier)
  password_hash TEXT NOT NULL,          -- Bcrypt hash of password
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- REFRESH TOKENS TABLE
-- ============================================================================
-- Stores long-lived refresh tokens for obtaining new JWTs
-- Each user can have multiple refresh tokens (multiple devices/sessions)
-- Tokens are indexed for fast validation lookups
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,             -- Foreign key to users table
  token TEXT UNIQUE NOT NULL,           -- The actual refresh token (random UUID or similar)
  expires_at TEXT NOT NULL,             -- Expiration timestamp (typically 30 days from creation)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast token validation lookups
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Index for querying all tokens belonging to a user (for revocation scenarios)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ============================================================================
-- TOKEN BLACKLIST TABLE
-- ============================================================================
-- Stores invalidated JWTs to prevent their use before natural expiration
-- Used for logout functionality and emergency token revocation
-- Tokens can be cleaned up after their natural expiration time
CREATE TABLE IF NOT EXISTS token_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,           -- The blacklisted JWT
  expires_at TEXT NOT NULL,             -- When the token would naturally expire (for cleanup)
  blacklisted_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast token blacklist checks
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);

-- Index for efficient cleanup queries (removing expired blacklisted tokens)
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- ============================================================================
-- UPDATE TODOS TABLE
-- ============================================================================
-- Add user_id column to existing todos table to associate todos with users
-- This is a breaking change - existing todos will need handling

-- Step 1: Add user_id column (nullable initially to handle existing data)
ALTER TABLE todos ADD COLUMN user_id INTEGER;

-- Note: If you have existing todos in your database, you have two options:
-- Option A: Delete existing todos (simplest for development):
--   DELETE FROM todos;
-- Option B: Assign existing todos to a default user (requires creating a user first):
--   UPDATE todos SET user_id = 1 WHERE user_id IS NULL;

-- After handling existing todos, you can enforce the NOT NULL constraint
-- by recreating the table (SQLite doesn't support adding NOT NULL to existing columns)
-- For now, we'll leave it nullable and enforce NOT NULL in application code

-- Step 2: Create index for filtering todos by user
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);

-- Future migration note: To enforce NOT NULL on user_id, you would need to:
-- 1. Create a new table with the proper schema including "user_id INTEGER NOT NULL"
-- 2. Copy data: INSERT INTO todos_new SELECT * FROM todos
-- 3. Drop old table: DROP TABLE todos
-- 4. Rename new table: ALTER TABLE todos_new RENAME TO todos
-- This is recommended for production after all existing todos have user_id values
