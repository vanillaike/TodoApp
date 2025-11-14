/**
 * Todo Item Component
 *
 * Individual todo item display with actions (toggle, delete).
 * Implements optimistic UI updates.
 */

import { toggleTodoCompleted, deleteTodo } from '../services/todo-api.js';
import { showConfirmDialog } from './confirm-dialog.js';

/**
 * Todo Item Component
 * @element todo-item
 *
 * @attr {string} todo-id - Todo ID
 * @attr {string} title - Todo title
 * @attr {string} description - Todo description (optional)
 * @attr {string} completed - Completed status (0 or 1)
 *
 * @fires todo-updated - When todo is updated
 * @fires todo-deleted - When todo is deleted
 * @fires todo-toggled - When todo is toggled
 */
class TodoItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {boolean} */
    this.isLoading = false;
  }

  /**
   * Observed attributes
   */
  static get observedAttributes() {
    return ['todo-id', 'title', 'description', 'completed'];
  }

  /**
   * Attribute changed callback
   */
  attributeChangedCallback(_name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  /**
   * Get todo data from attributes
   * @returns {Object} Todo data
   */
  getTodoData() {
    return {
      id: parseInt(this.getAttribute('todo-id'), 10),
      title: this.getAttribute('title') || '',
      description: this.getAttribute('description') || '',
      completed: parseInt(this.getAttribute('completed'), 10) || 0
    };
  }

  /**
   * Handle checkbox toggle
   */
  async handleToggle() {
    if (this.isLoading) return;

    const todo = this.getTodoData();
    const newCompleted = todo.completed === 1 ? 0 : 1;

    // Optimistic UI update
    this.setAttribute('completed', newCompleted.toString());
    this.isLoading = true;
    this.render();

    try {
      // Call API
      await toggleTodoCompleted(todo.id);

      // Dispatch event
      this.dispatchEvent(new CustomEvent('todo-toggled', {
        bubbles: true,
        composed: true,
        detail: { todoId: todo.id, completed: newCompleted }
      }));

    } catch (error) {
      console.error('Failed to toggle todo:', error);

      // Revert optimistic update
      this.setAttribute('completed', todo.completed.toString());

      // Show error message
      this.showError('Failed to update todo. Please try again.');
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  /**
   * Handle delete button click
   */
  async handleDelete() {
    if (this.isLoading) return;

    const todo = this.getTodoData();

    // Confirm deletion with custom dialog
    const confirmed = await showConfirmDialog({
      title: 'Delete Todo',
      message: `Are you sure you want to delete "${todo.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });

    if (!confirmed) {
      return;
    }

    this.isLoading = true;
    this.render();

    try {
      // Call API
      await deleteTodo(todo.id);

      // Dispatch event
      this.dispatchEvent(new CustomEvent('todo-deleted', {
        bubbles: true,
        composed: true,
        detail: { todoId: todo.id }
      }));

      // Remove element with animation
      this.classList.add('removing');
      setTimeout(() => {
        this.remove();
      }, 200);

    } catch (error) {
      console.error('Failed to delete todo:', error);
      this.showError('Failed to delete todo. Please try again.');
      this.isLoading = false;
      this.render();
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    // Create temporary error message
    const errorEl = document.createElement('div');
    errorEl.textContent = message;
    errorEl.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: #ef4444;
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 0.375rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      animation: slideIn 0.2s ease-out;
    `;

    document.body.appendChild(errorEl);

    // Remove after 3 seconds
    setTimeout(() => {
      errorEl.style.animation = 'slideOut 0.2s ease-in';
      setTimeout(() => errorEl.remove(), 200);
    }, 3000);
  }

  /**
   * Render the component
   */
  render() {
    const todo = this.getTodoData();
    const isCompleted = todo.completed === 1;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          transition: opacity 0.2s ease-out;
        }

        :host(.removing) {
          opacity: 0;
          transform: translateX(-100%);
        }

        .todo-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          transition: all 0.2s;
        }

        .todo-item:hover {
          border-color: #d1d5db;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .todo-item.loading {
          opacity: 0.6;
          pointer-events: none;
        }

        .checkbox-wrapper {
          flex-shrink: 0;
          padding-top: 0.125rem;
        }

        .checkbox {
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
          accent-color: #2563eb;
        }

        .checkbox:disabled {
          cursor: not-allowed;
        }

        .checkbox:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .content {
          flex: 1;
          min-width: 0;
        }

        .title {
          font-size: 1rem;
          font-weight: 500;
          color: #111827;
          margin: 0 0 0.25rem 0;
          word-wrap: break-word;
        }

        .title.completed {
          text-decoration: line-through;
          color: #6b7280;
        }

        .description {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0;
          word-wrap: break-word;
          white-space: pre-wrap;
        }

        .actions {
          flex-shrink: 0;
          display: flex;
          gap: 0.5rem;
        }

        .btn {
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.375rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          background: none;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .btn-delete {
          color: #dc2626;
        }

        .btn-delete:hover:not(:disabled) {
          background-color: #fef2f2;
        }

        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .todo-item {
            padding: 0.75rem;
          }

          .actions {
            flex-direction: column;
            gap: 0.25rem;
          }

          .btn {
            padding: 0.25rem 0.5rem;
            font-size: 0.8125rem;
          }
        }
      </style>

      <div class="todo-item ${this.isLoading ? 'loading' : ''}">
        <!-- Checkbox -->
        <div class="checkbox-wrapper">
          <input
            type="checkbox"
            class="checkbox"
            ${isCompleted ? 'checked' : ''}
            ${this.isLoading ? 'disabled' : ''}
            aria-label="${isCompleted ? 'Mark as incomplete' : 'Mark as complete'}"
          >
        </div>

        <!-- Content -->
        <div class="content">
          <h3 class="title ${isCompleted ? 'completed' : ''}">${this.escapeHtml(todo.title)}</h3>
          ${todo.description ? `<p class="description">${this.escapeHtml(todo.description)}</p>` : ''}
        </div>

        <!-- Actions -->
        <div class="actions">
          ${this.isLoading ? `
            <div class="spinner" role="status" aria-label="Loading"></div>
          ` : `
            <button
              class="btn btn-delete"
              ${this.isLoading ? 'disabled' : ''}
              aria-label="Delete todo"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
              </svg>
            </button>
          `}
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const checkbox = this.shadowRoot.querySelector('.checkbox');
    const deleteBtn = this.shadowRoot.querySelector('.btn-delete');

    if (checkbox) {
      checkbox.addEventListener('change', () => this.handleToggle());
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.handleDelete());
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Register custom element
customElements.define('todo-item', TodoItem);
