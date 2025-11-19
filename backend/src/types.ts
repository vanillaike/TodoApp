/**
 * Type definitions for the todo API
 */

// Environment bindings
export interface Env {
  todo_db: D1Database;
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string; // Optional: comma-separated list of allowed origins for CORS
}

// Database entities
interface Todo {
  id?: number;
  title: string;
  description?: string;
  completed: number;
  category_id?: number | null;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

// User database record interface
interface User {
  id?: number;
  email: string;
  password_hash?: string; // Optional because we never return this in API responses
  created_at?: string;
  updated_at?: string;
}

// Category database record interface
interface Category {
  id?: number;
  name: string;
  color: string;
  icon: string;
  user_id?: number | null;
  is_system: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// API request/response types

// Authentication request (used by both registration and login)
export interface AuthenticateRequest {
  email: string;
  password: string;
}

// Authentication response (used by both registration and login)
// Excludes password_hash for security
export interface AuthenticateResponse {
  user: {
    id: number;
    email: string;
    created_at: string;
  };
  accessToken: string;
  refreshToken: string;
}

// Validation types

// Password validation result
export interface PasswordValidation {
  valid: boolean;
  error?: string;
}

// Authenticated user info extracted from JWT
export interface AuthenticatedUser {
  userId: number;
  email: string;
}

// Generic validation result interface for input validation
export interface ValidationResult<T = any> {
  valid: boolean;
  error?: string;
  data?: T;
}

// Category input for create/update operations
export interface CategoryInput {
  name: string;
  color: string;
  icon: string;
}

// Export Todo, User, and Category interfaces for use throughout the app
export type { Todo, User, Category };
