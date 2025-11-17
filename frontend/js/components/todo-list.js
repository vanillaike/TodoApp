/**
 * Todo List Component
 *
 * Displays list of todos with pagination, loading, and error states.
 */

import { getTodos } from '../services/todo-api.js';
import { getCategories } from '../services/category-api.js';
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

    /** @type {Array} All todos loaded from server (for client-side filtering) */
    this.allTodos = [];

    /** @type {Array} Available categories */
    this.categories = [];

    /** @type {number|null} Active filter (null = All, or category ID) */
    this.activeFilter = null;

    /** @type {boolean} */
    this.isLoading = false;

    /** @type {boolean} Mobile sidebar collapsed state */
    this.isSidebarCollapsed = true;

    /** @type {boolean} */
    this.isCategoriesLoading = false;

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
    this.fetchCategories();
    this.fetchTodos();

    // Listen to todo events for real-time updates
    this.addEventListener('todo-toggled', (e) => this.handleTodoToggled(e));
    this.addEventListener('todo-deleted', (e) => this.handleTodoDeleted(e));
    this.addEventListener('todo-updated', (e) => this.handleTodoUpdated(e));

    // Listen for filter-by-category events from category badges
    this.addEventListener('filter-by-category', (e) => {
      const categoryId = e.detail.category.id;
      this.handleFilterClick(categoryId);
      // Scroll to top of list when filter changes
      this.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /**
   * Fetch categories from API
   */
  async fetchCategories() {
    this.isCategoriesLoading = true;

    try {
      const response = await getCategories();

      if (!response.success) {
        console.error('Failed to fetch categories:', response.error);
        return;
      }

      this.categories = response.data || [];
      this.render();

    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      this.isCategoriesLoading = false;
    }
  }

  /**
   * Fetch todos from API
   * @param {boolean} append - Whether to append to existing todos
   */
  async fetchTodos(append = false) {
    // Ensure pagination exists
    if (!this.pagination) {
      this.pagination = {
        limit: CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
        offset: 0,
        total: 0,
        hasMore: false
      };
    }

    this.isLoading = true;
    this.error = null;
    this.render();

    try {
      const response = await getTodos(
        this.pagination.limit,
        append ? this.pagination.offset : 0
      );

      // Check if fetch was successful
      if (!response.success) {
        throw new Error(response.error || 'Failed to load todos');
      }

      // Update allTodos (for client-side filtering)
      if (append) {
        this.allTodos = [...(this.allTodos || []), ...response.data.todos];
      } else {
        this.allTodos = response.data.todos;
      }

      // Update pagination
      this.pagination = response.data.pagination;

      // Apply current filter
      this.applyFilter();

    } catch (error) {
      console.error('Failed to fetch todos:', error);
      this.error = error.message || 'Failed to load todos. Please try again.';
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  /**
   * Apply current filter to todos
   */
  applyFilter() {
    if (this.activeFilter === null) {
      // Show all todos
      this.todos = this.allTodos;
    } else {
      // Filter client-side by category_id
      this.todos = this.allTodos.filter(todo =>
        todo.category_id === this.activeFilter
      );
    }
  }

  /**
   * Handle filter button click
   * @param {number|null} categoryId - Category ID to filter by (null for "All")
   */
  handleFilterClick(categoryId) {
    this.activeFilter = categoryId;
    this.applyFilter();
    this.render();
  }

  /**
   * Clear current filter (show all todos)
   */
  clearFilter() {
    this.handleFilterClick(null);
  }

  /**
   * Handle todo toggled event
   * @param {CustomEvent} event - Todo toggled event
   */
  handleTodoToggled(event) {
    const { todoId, completed } = event.detail;

    // Update the todo in the local array (optimistic update)
    const todo = this.todos.find(t => t.id === todoId);
    if (todo) {
      todo.completed = completed;
      // No need to re-render - the todo-item component handles its own display
    }
  }

  /**
   * Handle todo deleted event
   * @param {CustomEvent} event - Todo deleted event
   */
  handleTodoDeleted(event) {
    const { todoId } = event.detail;

    // Remove the todo from both arrays
    this.allTodos = this.allTodos.filter(t => t.id !== todoId);
    this.todos = this.todos.filter(t => t.id !== todoId);

    // Update the total count
    if (this.pagination) {
      this.pagination.total = Math.max(0, this.pagination.total - 1);
    }

    // Re-render to update the count badge and handle empty state
    this.render();
  }

  /**
   * Handle todo updated event
   * @param {CustomEvent} event - Todo updated event
   */
  handleTodoUpdated(event) {
    const { todoId, todo } = event.detail;

    // Update the todo in allTodos array
    const allTodoIndex = this.allTodos.findIndex(t => t.id === todoId);
    if (allTodoIndex !== -1) {
      this.allTodos[allTodoIndex] = todo;
    }

    // Re-apply filter to update displayed todos
    this.applyFilter();
    this.render();
  }

  /**
   * Handle load more button click
   */
  handleLoadMore() {
    if (!this.pagination) {
      this.pagination = {
        limit: CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
        offset: 0,
        total: 0,
        hasMore: false
      };
    }
    this.pagination.offset += this.pagination.limit;
    this.fetchTodos(true);
  }

  /**
   * Handle retry button click
   */
  handleRetry() {
    if (!this.pagination) {
      this.pagination = {
        limit: CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
        offset: 0,
        total: 0,
        hasMore: false
      };
    }
    this.pagination.offset = 0;
    this.fetchTodos();
  }

  /**
   * Get count of todos for a specific category
   * @param {number|null} categoryId - Category ID (null for all todos)
   * @returns {number} Count of todos
   */
  getCategoryCount(categoryId) {
    if (categoryId === null) {
      return this.allTodos.length;
    }
    return this.allTodos.filter(t => t.category_id === categoryId).length;
  }

  /**
   * Get empty state message based on active filter
   * @returns {string} Empty state message
   */
  getEmptyMessage() {
    if (this.activeFilter === null) {
      return 'No todos yet. Create your first todo!';
    }
    const category = this.categories.find(c => c.id === this.activeFilter);
    return `No todos in ${category?.name || 'this category'}`;
  }

  /**
   * Render the component
   */
  render() {
    // Ensure todos array exists
    if (!this.todos) {
      this.todos = [];
    }

    // Ensure pagination object exists
    if (!this.pagination) {
      this.pagination = {
        limit: CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
        offset: 0,
        total: 0,
        hasMore: false
      };
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        /* Main layout with sidebar */
        .layout-container {
          display: flex;
          gap: 1.5rem;
          align-items: flex-start;
        }

        /* Left Sidebar */
        .sidebar {
          width: 240px;
          flex-shrink: 0;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }

        .sidebar-toggle {
          display: none;
          background: transparent;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #6b7280;
          border-radius: 0.25rem;
          transition: all 0.2s;
        }

        .sidebar-toggle:hover {
          background: #e5e7eb;
          color: #111827;
        }

        .sidebar-toggle svg {
          width: 1.25rem;
          height: 1.25rem;
          transition: transform 0.2s;
        }

        .sidebar.collapsed .sidebar-toggle svg {
          transform: rotate(180deg);
        }

        .sidebar-actions {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .settings-btn {
          background: transparent;
          border: none;
          padding: 0.375rem;
          cursor: pointer;
          color: #6b7280;
          border-radius: 0.25rem;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .settings-btn:hover {
          background: #e5e7eb;
          color: #2563eb;
        }

        .settings-btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .settings-btn svg {
          width: 1.125rem;
          height: 1.125rem;
        }

        .sidebar-content {
          padding: 0.5rem;
        }

        .filter-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #4b5563;
          background: transparent;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
        }

        .filter-btn-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          min-width: 0;
        }

        .filter-btn:hover {
          background: #f3f4f6;
        }

        .filter-btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: -2px;
        }

        .filter-btn.active {
          color: #2563eb;
          background: #eff6ff;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .filter-btn .icon {
          font-size: 1rem;
          line-height: 1;
        }

        .filter-btn .count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.25rem;
          padding: 0.125rem 0.375rem;
          font-size: 0.6875rem;
          font-weight: 600;
          background: #e5e7eb;
          color: #4b5563;
          border-radius: 9999px;
          margin-left: 0.125rem;
        }

        .filter-btn.active .count {
          background: #bfdbfe;
          color: #1e40af;
        }

        /* Main content area */
        .list-container {
          flex: 1;
          min-width: 0;
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

        @media (max-width: 768px) {
          .layout-container {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
          }

          .sidebar-toggle {
            display: block;
          }

          .sidebar-content {
            max-height: 300px;
            overflow-y: auto;
            transition: max-height 0.3s ease, opacity 0.3s ease;
          }

          .sidebar.collapsed .sidebar-content {
            max-height: 0;
            opacity: 0;
            overflow: hidden;
            padding: 0;
          }

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

      <div class="layout-container">
        <!-- Left Sidebar -->
        ${this.renderSidebar()}

        <!-- Main Content -->
        <div class="list-container">
          <!-- Header -->
          <div class="list-header">
            <h2 class="list-title">
              <span>Your Todos</span>
              ${!this.isLoading && this.allTodos.length > 0 ? `
                <span class="count-badge" aria-label="${this.todos.length} ${this.activeFilter !== null ? 'filtered' : ''} todos">
                  ${this.todos.length}
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
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render sidebar with category filters
   * @returns {string} HTML for sidebar
   */
  renderSidebar() {
    // Don't show sidebar if there are no todos and no categories
    if (this.allTodos.length === 0 && this.categories.length === 0) {
      return '';
    }

    return `
      <aside class="sidebar ${this.isSidebarCollapsed ? 'collapsed' : ''}" role="navigation" aria-label="Category filters">
        <div class="sidebar-header">
          <h3 class="sidebar-title">Categories</h3>
          <div class="sidebar-actions">
            <button
              class="settings-btn"
              id="manage-categories-btn"
              aria-label="Manage categories"
              title="Manage categories"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              class="sidebar-toggle"
              id="sidebar-toggle"
              aria-label="${this.isSidebarCollapsed ? 'Expand categories' : 'Collapse categories'}"
              aria-expanded="${!this.isSidebarCollapsed}"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="sidebar-content">
          <div class="filter-buttons">
            <!-- All button -->
            <button
              class="filter-btn ${this.activeFilter === null ? 'active' : ''}"
              data-category-id="null"
              aria-label="Show all todos"
              aria-pressed="${this.activeFilter === null}"
            >
              <div class="filter-btn-content">
                <span class="icon">📋</span>
                <span>All</span>
              </div>
              <span class="count" aria-label="${this.getCategoryCount(null)} todos">
                ${this.getCategoryCount(null)}
              </span>
            </button>

            <!-- Category buttons -->
            ${this.categories.map(category => `
              <button
                class="filter-btn ${this.activeFilter === category.id ? 'active' : ''}"
                data-category-id="${category.id}"
                aria-label="Filter by ${this.escapeHtml(category.name)}"
                aria-pressed="${this.activeFilter === category.id}"
              >
                <div class="filter-btn-content">
                  <span class="icon">${this.escapeHtml(category.icon)}</span>
                  <span>${this.escapeHtml(category.name)}</span>
                </div>
                <span class="count" aria-label="${this.getCategoryCount(category.id)} todos">
                  ${this.getCategoryCount(category.id)}
                </span>
              </button>
            `).join('')}
          </div>
        </div>
      </aside>
    `;
  }

  /**
   * Render content based on state
   * @returns {string} HTML for content
   */
  renderContent() {
    // Ensure todos array exists
    if (!this.todos) {
      this.todos = [];
    }

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
          <h3 class="empty-title">${this.getEmptyMessage()}</h3>
          ${this.activeFilter !== null ? `
            <button class="btn btn-secondary" id="clear-filter-btn" style="margin-top: 1rem;">
              Show all todos
            </button>
          ` : `
            <p class="empty-text">Create your first todo and optionally assign it to a category!</p>
          `}
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
            ${todo.category ? `category='${JSON.stringify(todo.category)}'` : ''}
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
    // Ensure pagination exists
    if (!this.pagination || !this.pagination.hasMore || this.isLoading || this.error) {
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
    const clearFilterBtn = this.shadowRoot.getElementById('clear-filter-btn');
    const sidebarToggle = this.shadowRoot.getElementById('sidebar-toggle');
    const manageCategoriesBtn = this.shadowRoot.getElementById('manage-categories-btn');
    const filterBtns = this.shadowRoot.querySelectorAll('.filter-btn');

    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.handleRetry());
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.handleLoadMore());
    }

    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => this.clearFilter());
    }

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }

    if (manageCategoriesBtn) {
      manageCategoriesBtn.addEventListener('click', () => this.handleManageCategories());
    }

    // Attach filter button click handlers
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const categoryIdStr = btn.getAttribute('data-category-id');
        const categoryId = categoryIdStr === 'null' ? null : parseInt(categoryIdStr, 10);
        this.handleFilterClick(categoryId);
      });
    });
  }

  /**
   * Handle manage categories button click
   */
  handleManageCategories() {
    // Emit event to parent (todo-page)
    this.dispatchEvent(new CustomEvent('manage-categories', {
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Toggle sidebar collapsed state (mobile only)
   */
  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.render();
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
