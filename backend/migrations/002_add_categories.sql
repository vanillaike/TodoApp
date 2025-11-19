-- Migration 002: Add Categories Feature
-- This migration adds support for categorizing todos with system and user-defined categories
-- It creates the categories table and adds category_id to todos table

-- Enable foreign key constraints (required for D1/SQLite)
PRAGMA foreign_keys = ON;

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
-- Stores both system-defined and user-defined categories
-- System categories are shared across all users (user_id = NULL, is_system = 1)
-- User categories are isolated per user (user_id = X, is_system = 0)
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- Category name (e.g., "Work", "Personal")
  color TEXT NOT NULL,                   -- Hex color code (e.g., "#3B82F6")
  icon TEXT NOT NULL,                    -- Emoji icon (e.g., "📋")
  user_id INTEGER,                       -- NULL for system categories, foreign key to users for user categories
  is_system INTEGER DEFAULT 0,           -- 0 = user category, 1 = system category
  sort_order INTEGER DEFAULT 0,          -- User-defined ordering (lower numbers first)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast filtering by user_id (system + user categories)
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Index for efficient sorting and filtering
CREATE INDEX IF NOT EXISTS idx_categories_is_system_sort ON categories(is_system, sort_order);

-- ============================================================================
-- SEED SYSTEM CATEGORIES
-- ============================================================================
-- Insert 5 predefined system categories available to all users
INSERT INTO categories (name, color, icon, user_id, is_system, sort_order) VALUES
  ('Work', '#3B82F6', '📋', NULL, 1, 1),
  ('Personal', '#10B981', '🏠', NULL, 1, 2),
  ('Shopping', '#F59E0B', '🛒', NULL, 1, 3),
  ('Health', '#EF4444', '💪', NULL, 1, 4),
  ('Learning', '#8B5CF6', '📚', NULL, 1, 5);

-- ============================================================================
-- UPDATE TODOS TABLE
-- ============================================================================
-- Add category_id column to todos table to link todos with categories
-- Nullable to allow todos without categories

-- Add category_id column (nullable, optional categorization)
ALTER TABLE todos ADD COLUMN category_id INTEGER;

-- Create index for fast filtering by category
CREATE INDEX IF NOT EXISTS idx_todos_category_id ON todos(category_id);

-- Note: We don't add a foreign key constraint here because SQLite doesn't support
-- adding foreign keys to existing tables via ALTER TABLE. If you want to enforce
-- referential integrity, you would need to recreate the table.
-- The application code will handle validation instead.

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Trigger to automatically update updated_at timestamp on categories
CREATE TRIGGER IF NOT EXISTS trigger_categories_updated_at
AFTER UPDATE ON categories
FOR EACH ROW
BEGIN
  UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
