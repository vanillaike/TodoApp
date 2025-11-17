-- Migration 003: Add Foreign Key Constraint to todos.category_id
-- This migration recreates the todos table with a proper foreign key constraint
-- on the category_id column to ensure referential integrity

-- SQLite doesn't support adding foreign keys via ALTER TABLE to existing tables,
-- so we need to recreate the table with the constraint.

-- Security Fix: Add FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
-- This ensures that when a category is deleted, todos have their category_id set to NULL
-- instead of being orphaned with invalid references

-- Enable foreign key constraints (required for D1/SQLite)
PRAGMA foreign_keys = ON;

-- ============================================================================
-- STEP 1: Create new todos table with proper foreign key constraint
-- ============================================================================
CREATE TABLE IF NOT EXISTS todos_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER DEFAULT 0,
  category_id INTEGER,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ============================================================================
-- STEP 2: Copy all data from old table to new table
-- ============================================================================
INSERT INTO todos_new SELECT * FROM todos;

-- ============================================================================
-- STEP 3: Drop old table and rename new table
-- ============================================================================
DROP TABLE todos;
ALTER TABLE todos_new RENAME TO todos;

-- ============================================================================
-- STEP 4: Recreate indexes
-- ============================================================================
-- Index for fast filtering by user_id (user isolation)
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);

-- Index for fast filtering by category
CREATE INDEX IF NOT EXISTS idx_todos_category_id ON todos(category_id);

-- ============================================================================
-- STEP 5: Recreate updated_at trigger
-- ============================================================================
-- Trigger to automatically update updated_at timestamp on todos
CREATE TRIGGER IF NOT EXISTS trigger_todos_updated_at
AFTER UPDATE ON todos
FOR EACH ROW
BEGIN
  UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
