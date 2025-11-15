/**
 * Todo Item Component
 *
 * Individual todo item display with actions (toggle, delete, edit).
 * Implements optimistic UI updates and inline editing.
 */

import { toggleTodoCompleted, deleteTodo, updateTodo } from '../services/todo-api.js';
import { showConfirmDialog } from './confirm-dialog.js';
import { CONFIG } from '../config.js';

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

    /** @type {boolean} */
    this.isEditing = false;

    /** @type {string} */
    this.editTitle = '';

    /** @type {string} */
    this.editDescription = '';
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
   * Handle edit button click
   */
  handleEdit() {
    if (this.isLoading || this.isEditing) return;

    const todo = this.getTodoData();

    // Store current values for editing
    this.editTitle = todo.title;
    this.editDescription = todo.description;

    // Enter edit mode
    this.isEditing = true;
    this.render();

    // Focus on title input after render
    setTimeout(() => {
      const titleInput = this.shadowRoot.getElementById('edit-title');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 0);
  }

  /**
   * Handle cancel edit
   */
  handleCancelEdit() {
    this.isEditing = false;
    this.editTitle = '';
    this.editDescription = '';
    this.render();
  }

  /**
   * Handle save edit
   */
  async handleSaveEdit() {
    if (this.isLoading) return;

    const todo = this.getTodoData();

    // Get input values
    const titleInput = this.shadowRoot.getElementById('edit-title');
    const descriptionInput = this.shadowRoot.getElementById('edit-description');

    if (!titleInput) return;

    const newTitle = titleInput.value.trim();
    const newDescription = descriptionInput ? descriptionInput.value.trim() : '';

    // Validate title
    if (newTitle.length < CONFIG.VALIDATION.TODO_TITLE_MIN_LENGTH) {
      this.showError(`Title must be at least ${CONFIG.VALIDATION.TODO_TITLE_MIN_LENGTH} character long.`);
      titleInput.focus();
      return;
    }

    if (newTitle.length > CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH) {
      this.showError(`Title must not exceed ${CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH} characters.`);
      titleInput.focus();
      return;
    }

    // Validate description
    if (newDescription.length > CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH) {
      this.showError(`Description must not exceed ${CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH} characters.`);
      if (descriptionInput) descriptionInput.focus();
      return;
    }

    // Check if anything changed
    if (newTitle === todo.title && newDescription === todo.description) {
      // No changes, just exit edit mode
      this.handleCancelEdit();
      return;
    }

    this.isLoading = true;
    this.render();

    try {
      // Build update object
      const updates = {
        title: newTitle,
        description: newDescription
      };

      // Call API
      const response = await updateTodo(todo.id, updates);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update todo');
      }

      // Update attributes with new values
      this.setAttribute('title', newTitle);
      this.setAttribute('description', newDescription);

      // Exit edit mode
      this.isEditing = false;
      this.editTitle = '';
      this.editDescription = '';

      // Dispatch event
      this.dispatchEvent(new CustomEvent('todo-updated', {
        bubbles: true,
        composed: true,
        detail: { todoId: todo.id, todo: response.data }
      }));

    } catch (error) {
      console.error('Failed to update todo:', error);
      this.showError(error.message || 'Failed to update todo. Please try again.');
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  /**
   * Handle Enter key in edit mode (save)
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleEditKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Save on Enter (but allow Shift+Enter for new lines in description)
      if (event.target.id === 'edit-title') {
        event.preventDefault();
        this.handleSaveEdit();
      }
    } else if (event.key === 'Escape') {
      // Cancel on Escape
      event.preventDefault();
      this.handleCancelEdit();
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

        .todo-item.editing {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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

        /* Edit Mode Styles */
        .edit-form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .form-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
        }

        .form-input,
        .form-textarea {
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-family: inherit;
          transition: all 0.2s;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-textarea {
          resize: vertical;
          min-height: 4rem;
        }

        .char-count {
          font-size: 0.75rem;
          color: #6b7280;
          text-align: right;
        }

        .char-count.warning {
          color: #f59e0b;
        }

        .char-count.error {
          color: #dc2626;
        }

        .edit-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
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
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .btn-edit {
          color: #2563eb;
        }

        .btn-edit:hover:not(:disabled) {
          background-color: #eff6ff;
        }

        .btn-delete {
          color: #dc2626;
        }

        .btn-delete:hover:not(:disabled) {
          background-color: #fef2f2;
        }

        .btn-primary {
          color: white;
          background-color: #2563eb;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #1d4ed8;
        }

        .btn-secondary {
          color: #374151;
          background-color: #f3f4f6;
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: #e5e7eb;
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

          .edit-actions {
            flex-direction: column;
          }

          .btn-primary,
          .btn-secondary {
            width: 100%;
            justify-content: center;
          }
        }
      </style>

      <div class="todo-item ${this.isLoading ? 'loading' : ''} ${this.isEditing ? 'editing' : ''}">
        ${this.isEditing ? this.renderEditMode(todo) : this.renderViewMode(todo, isCompleted)}
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render view mode
   * @param {Object} todo - Todo data
   * @param {boolean} isCompleted - Whether todo is completed
   * @returns {string} HTML for view mode
   */
  renderViewMode(todo, isCompleted) {
    return `
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
            class="btn btn-edit"
            aria-label="Edit todo"
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
              <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
            </svg>
          </button>
          <button
            class="btn btn-delete"
            aria-label="Delete todo"
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        `}
      </div>
    `;
  }

  /**
   * Render edit mode
   * @param {Object} todo - Todo data
   * @returns {string} HTML for edit mode
   */
  renderEditMode(todo) {
    const titleLength = this.editTitle.length;
    const descriptionLength = this.editDescription.length;
    const titleMaxLength = CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH;
    const descriptionMaxLength = CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH;

    return `
      <div class="content">
        <form class="edit-form" id="edit-form">
          <div class="form-group">
            <label for="edit-title" class="form-label">Title *</label>
            <input
              type="text"
              id="edit-title"
              class="form-input"
              value="${this.escapeHtml(this.editTitle)}"
              maxlength="${titleMaxLength}"
              required
              ${this.isLoading ? 'disabled' : ''}
              aria-label="Todo title"
            >
            <span class="char-count ${titleLength > titleMaxLength * 0.9 ? 'warning' : ''} ${titleLength >= titleMaxLength ? 'error' : ''}">
              ${titleLength} / ${titleMaxLength}
            </span>
          </div>

          <div class="form-group">
            <label for="edit-description" class="form-label">Description</label>
            <textarea
              id="edit-description"
              class="form-textarea"
              maxlength="${descriptionMaxLength}"
              ${this.isLoading ? 'disabled' : ''}
              aria-label="Todo description"
            >${this.escapeHtml(this.editDescription)}</textarea>
            <span class="char-count ${descriptionLength > descriptionMaxLength * 0.9 ? 'warning' : ''} ${descriptionLength >= descriptionMaxLength ? 'error' : ''}">
              ${descriptionLength} / ${descriptionMaxLength}
            </span>
          </div>

          <div class="edit-actions">
            <button
              type="button"
              class="btn btn-secondary"
              id="cancel-btn"
              ${this.isLoading ? 'disabled' : ''}
              aria-label="Cancel editing"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              id="save-btn"
              ${this.isLoading ? 'disabled' : ''}
              aria-label="Save changes"
            >
              ${this.isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (this.isEditing) {
      // Edit mode listeners
      const editForm = this.shadowRoot.getElementById('edit-form');
      const cancelBtn = this.shadowRoot.getElementById('cancel-btn');
      const titleInput = this.shadowRoot.getElementById('edit-title');
      const descriptionInput = this.shadowRoot.getElementById('edit-description');

      if (editForm) {
        editForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSaveEdit();
        });
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.handleCancelEdit());
      }

      if (titleInput) {
        titleInput.addEventListener('keydown', (e) => this.handleEditKeyDown(e));
        titleInput.addEventListener('input', (e) => {
          this.editTitle = e.target.value;
          this.updateCharCount();
        });
      }

      if (descriptionInput) {
        descriptionInput.addEventListener('keydown', (e) => this.handleEditKeyDown(e));
        descriptionInput.addEventListener('input', (e) => {
          this.editDescription = e.target.value;
          this.updateCharCount();
        });
      }
    } else {
      // View mode listeners
      const checkbox = this.shadowRoot.querySelector('.checkbox');
      const editBtn = this.shadowRoot.querySelector('.btn-edit');
      const deleteBtn = this.shadowRoot.querySelector('.btn-delete');

      if (checkbox) {
        checkbox.addEventListener('change', () => this.handleToggle());
      }

      if (editBtn) {
        editBtn.addEventListener('click', () => this.handleEdit());
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.handleDelete());
      }
    }
  }

  /**
   * Update character count display
   */
  updateCharCount() {
    const titleLength = this.editTitle.length;
    const descriptionLength = this.editDescription.length;
    const titleMaxLength = CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH;
    const descriptionMaxLength = CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH;

    const charCounts = this.shadowRoot.querySelectorAll('.char-count');
    if (charCounts[0]) {
      charCounts[0].textContent = `${titleLength} / ${titleMaxLength}`;
      charCounts[0].className = 'char-count';
      if (titleLength > titleMaxLength * 0.9) charCounts[0].classList.add('warning');
      if (titleLength >= titleMaxLength) charCounts[0].classList.add('error');
    }

    if (charCounts[1]) {
      charCounts[1].textContent = `${descriptionLength} / ${descriptionMaxLength}`;
      charCounts[1].className = 'char-count';
      if (descriptionLength > descriptionMaxLength * 0.9) charCounts[1].classList.add('warning');
      if (descriptionLength >= descriptionMaxLength) charCounts[1].classList.add('error');
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
