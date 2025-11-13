/**
 * Todo List Component
 *
 * Displays list of todos with pagination, loading, and error states.
 */

import { todoApi } from '../services/todo-api.js';
import { CONFIG } from '../config.js';
import './todo-item.js';

/**
 * Todo List Component
 * @element todo-list
 */
class TodoList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {Array} */
    this.todos = [];

    /** @type {boolean} */
    this.isLoading = false;

    /** @type {string|null} */
    this.error = null;

    /** @type {Object} */
    this.pagination = {
      limit: CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
      offset: 0,
      total: 0,
      hasMore: false
    };
  }

  connectedCallback() {
    this.render();
    this.fetchTodos();

    // Listen to todo events for real-time updates
    this.addEventListener('todo-toggled', () => this.handleTodoUpdate());
    this.addEventListener('todo-deleted', () => this.handleTodoUpdate());
  }

  /**
   * Fetch todos from API
   * @param {boolean} append - Whether to append to existing todos
   */
  async fetchTodos(append = false) {
    this.isLoading = true;
    this.error = null;
    this.render();

    try {
      const response = await todoApi.getTodos({
        limit: this.pagination.limit,
        offset: append ? this.pagination.offset : 0
      });

      // Update todos
      if (append) {
        this.todos = [...this.todos, ...response.todos];
      } else {
        this.todos = response.todos;
      }

      // Update pagination
      this.pagination = response.pagination;

    } catch (error) {
      console.error('Failed to fetch todos:', error);
      this.error = error.message || 'Failed to load todos. Please try again.';
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  /**
   * Handle todo update (refresh list)
   */
  handleTodoUpdate() {
    // Refresh the list after a short delay to allow animation
    setTimeout(() => {
      this.fetchTodos();
    }, 300);
  }

  /**
   * Handle load more button click
   */
  handleLoadMore() {
    this.pagination.offset += this.pagination.limit;
    this.fetchTodos(true);
  }

  /**
   * Handle retry button click
   */
  handleRetry() {
    this.pagination.offset = 0;
    this.fetchTodos();
  }

  /**
   * Render the component
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .list-container {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .list-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .list-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.5rem;
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #2563eb;
          background-color: #dbeafe;
          border-radius: 9999px;
        }

        .list-content {
          padding: 1rem;
        }

        .todos {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* Loading State */
        .loading {
          padding: 3rem 1.5rem;
          text-align: center;
        }

        .spinner {
          display: inline-block;
          width: 2.5rem;
          height: 2.5rem;
          border: 3px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        .loading-text {
          margin-top: 1rem;
          color: #6b7280;
          font-size: 0.875rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Empty State */
        .empty-state {
          padding: 3rem 1.5rem;
          text-align: center;
        }

        .empty-icon {
          width: 4rem;
          height: 4rem;
          margin: 0 auto 1rem;
          color: #d1d5db;
        }

        .empty-title {
          font-size: 1rem;
          font-weight: 500;
          color: #111827;
          margin: 0 0 0.5rem 0;
        }

        .empty-text {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0;
        }

        /* Error State */
        .error-state {
          padding: 2rem 1.5rem;
          text-align: center;
        }

        .error-icon {
          width: 3rem;
          height: 3rem;
          margin: 0 auto 1rem;
          color: #dc2626;
        }

        .error-title {
          font-size: 1rem;
          font-weight: 500;
          color: #991b1b;
          margin: 0 0 0.5rem 0;
        }

        .error-text {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0 0 1rem 0;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.375rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .btn-primary {
          color: white;
          background-color: #2563eb;
        }

        .btn-primary:hover {
          background-color: #1d4ed8;
        }

        .btn-secondary {
          color: #374151;
          background-color: #f3f4f6;
        }

        .btn-secondary:hover {
          background-color: #e5e7eb;
        }

        /* Pagination */
        .pagination {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: center;
        }

        @media (max-width: 640px) {
          .list-header {
            padding: 1rem;
          }

          .list-content {
            padding: 0.75rem;
          }

          .empty-state,
          .error-state {
            padding: 2rem 1rem;
          }
        }
      </style>

      <div class="list-container">
        <!-- Header -->
        <div class="list-header">
          <h2 class="list-title">
            <span>Your Todos</span>
            ${!this.isLoading && this.todos.length > 0 ? `
              <span class="count-badge" aria-label="${this.pagination.total} todos">
                ${this.pagination.total}
              </span>
            ` : ''}
          </h2>
        </div>

        <!-- Content -->
        <div class="list-content">
          ${this.renderContent()}
        </div>

        <!-- Pagination -->
        ${this.renderPagination()}
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render content based on state
   * @returns {string} HTML for content
   */
  renderContent() {
    // Loading state (initial load)
    if (this.isLoading && this.todos.length === 0) {
      return `
        <div class="loading">
          <div class="spinner" role="status" aria-label="Loading todos"></div>
          <p class="loading-text">Loading your todos...</p>
        </div>
      `;
    }

    // Error state
    if (this.error) {
      return `
        <div class="error-state">
          <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="error-title">Failed to load todos</h3>
          <p class="error-text">${this.escapeHtml(this.error)}</p>
          <button class="btn btn-primary" id="retry-btn">
            Try Again
          </button>
        </div>
      `;
    }

    // Empty state
    if (this.todos.length === 0) {
      return `
        <div class="empty-state">
          <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 class="empty-title">No todos yet</h3>
          <p class="empty-text">Get started by creating your first todo above.</p>
        </div>
      `;
    }

    // Todos list
    return `
      <div class="todos" role="list" aria-label="Todo list">
        ${this.todos.map(todo => `
          <todo-item
            todo-id="${todo.id}"
            title="${this.escapeHtml(todo.title)}"
            description="${this.escapeHtml(todo.description || '')}"
            completed="${todo.completed}"
            role="listitem"
          ></todo-item>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render pagination controls
   * @returns {string} HTML for pagination
   */
  renderPagination() {
    if (!this.pagination.hasMore || this.isLoading || this.error) {
      return '';
    }

    return `
      <div class="pagination">
        <button class="btn btn-secondary" id="load-more-btn">
          ${this.isLoading ? 'Loading...' : 'Load More'}
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const retryBtn = this.shadowRoot.getElementById('retry-btn');
    const loadMoreBtn = this.shadowRoot.getElementById('load-more-btn');

    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.handleRetry());
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.handleLoadMore());
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Register custom element
customElements.define('todo-list', TodoList);
