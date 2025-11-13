/**
 * Todo Form Component
 *
 * Form to create new todos with validation and error handling.
 */

import { createTodo } from '../services/todo-api.js';
import { validateTodoTitle, validateTodoDescription } from '../utils/validators.js';
import { CONFIG } from '../config.js';

/**
 * Todo Form Component
 * @element todo-form
 *
 * @fires todo-created - When todo is successfully created
 * @fires todo-create-error - When todo creation fails
 */
class TodoForm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {boolean} */
    this.isSubmitting = false;

    /** @type {Object} */
    this.errors = {
      title: null,
      description: null
    };
  }

  connectedCallback() {
    this.render();
  }

  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  async handleSubmit(e) {
    e.preventDefault();

    if (this.isSubmitting) return;

    // Get form data
    const formData = new FormData(e.target);
    const title = formData.get('title')?.trim() || '';
    const description = formData.get('description')?.trim() || '';

    // Reset errors
    this.errors = {
      title: null,
      description: null
    };

    // Validate title
    const titleValidation = validateTodoTitle(title);
    if (!titleValidation.valid) {
      this.errors.title = titleValidation.error;
      this.render();
      return;
    }

    // Validate description (optional)
    if (description) {
      const descValidation = validateTodoDescription(description);
      if (!descValidation.valid) {
        this.errors.description = descValidation.error;
        this.render();
        return;
      }
    }

    // Submit to API
    this.isSubmitting = true;
    this.render();

    try {
      const response = await createTodo(title, description || '');

      // Check if creation was successful
      if (!response.success) {
        throw new Error(response.error || 'Failed to create todo');
      }

      // Dispatch success event with the todo data
      this.dispatchEvent(new CustomEvent('todo-created', {
        bubbles: true,
        composed: true,
        detail: { todo: response.data }
      }));

      // Clear form
      this.clearForm();

      // Show success message
      this.showSuccess('Todo created successfully!');

    } catch (error) {
      console.error('Failed to create todo:', error);

      // Dispatch error event
      this.dispatchEvent(new CustomEvent('todo-create-error', {
        bubbles: true,
        composed: true,
        detail: { message: error.message || 'Failed to create todo' }
      }));

      // Show error message
      this.showError(error.message || 'Failed to create todo. Please try again.');
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  /**
   * Clear form fields
   */
  clearForm() {
    const form = this.shadowRoot.querySelector('form');
    if (form) {
      form.reset();
    }
    this.errors = {
      title: null,
      description: null
    };
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.showToast(message, 'error');
  }

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type ('success' or 'error')
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 0.375rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      animation: slideIn 0.2s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.2s ease-in';
      setTimeout(() => toast.remove(), 200);
    }, CONFIG.UI.TOAST_DURATION);
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

        .form-container {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1.5rem;
        }

        .form-header {
          margin-bottom: 1rem;
        }

        .form-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
        }

        .required {
          color: #dc2626;
        }

        .input,
        .textarea {
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          transition: all 0.2s;
          font-family: inherit;
        }

        .input:focus,
        .textarea:focus {
          outline: none;
          border-color: #2563eb;
          ring: 2px solid rgba(37, 99, 235, 0.2);
        }

        .input.error,
        .textarea.error {
          border-color: #dc2626;
        }

        .textarea {
          resize: vertical;
          min-height: 4rem;
        }

        .char-count {
          font-size: 0.75rem;
          color: #6b7280;
          text-align: right;
        }

        .error-message {
          font-size: 0.875rem;
          color: #dc2626;
          margin: 0;
        }

        .submit-btn {
          padding: 0.625rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
          background-color: #2563eb;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .submit-btn:hover:not(:disabled) {
          background-color: #1d4ed8;
        }

        .submit-btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .form-container {
            padding: 1rem;
          }
        }
      </style>

      <div class="form-container">
        <div class="form-header">
          <h2 class="form-title">Create New Todo</h2>
        </div>

        <form>
          <!-- Title Field -->
          <div class="form-group">
            <label class="label" for="title">
              Title <span class="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              class="input ${this.errors.title ? 'error' : ''}"
              placeholder="Enter todo title"
              maxlength="${CONFIG.VALIDATION.TODO_TITLE_MAX_LENGTH}"
              ${this.isSubmitting ? 'disabled' : ''}
              required
              aria-required="true"
              aria-invalid="${this.errors.title ? 'true' : 'false'}"
              aria-describedby="${this.errors.title ? 'title-error' : ''}"
            >
            ${this.errors.title ? `
              <p class="error-message" id="title-error" role="alert">
                ${this.errors.title}
              </p>
            ` : ''}
          </div>

          <!-- Description Field -->
          <div class="form-group">
            <label class="label" for="description">
              Description <span style="color: #6b7280;">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              class="textarea ${this.errors.description ? 'error' : ''}"
              placeholder="Enter todo description (optional)"
              maxlength="${CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH}"
              ${this.isSubmitting ? 'disabled' : ''}
              aria-invalid="${this.errors.description ? 'true' : 'false'}"
              aria-describedby="${this.errors.description ? 'description-error' : ''}"
            ></textarea>
            ${this.errors.description ? `
              <p class="error-message" id="description-error" role="alert">
                ${this.errors.description}
              </p>
            ` : ''}
            <p class="char-count">
              Max ${CONFIG.VALIDATION.TODO_DESCRIPTION_MAX_LENGTH} characters
            </p>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="submit-btn"
            ${this.isSubmitting ? 'disabled' : ''}
            aria-label="${this.isSubmitting ? 'Creating todo...' : 'Create todo'}"
          >
            ${this.isSubmitting ? `
              <span class="spinner" role="status" aria-hidden="true"></span>
              <span>Creating...</span>
            ` : `
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
              </svg>
              <span>Create Todo</span>
            `}
          </button>
        </form>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const form = this.shadowRoot.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }
}

// Register custom element
customElements.define('todo-form', TodoForm);
