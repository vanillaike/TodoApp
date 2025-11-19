/**
 * Todo Form Component
 *
 * Modal form to create new todos with validation and error handling.
 * Triggered by a floating action button (FAB).
 */

import { createTodo } from '../services/todo-api.js';
import { validateTodoTitle, validateTodoDescription } from '../utils/validators.js';
import { CONFIG } from '../config.js';
import './category-selector.js';

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
    this.isModalOpen = false;

    /** @type {boolean} */
    this.isSubmitting = false;

    /** @type {number|null} */
    this.selectedCategoryId = null;

    /** @type {Object} */
    this.errors = {
      title: null,
      description: null
    };
  }

  connectedCallback() {
    this.render();
    this.setupKeyboardListener();
  }

  disconnectedCallback() {
    this.removeKeyboardListener();
  }

  /**
   * Setup keyboard listener for ESC key
   */
  setupKeyboardListener() {
    this.handleKeyDown = (e) => {
      if (e.key === 'Escape' && this.isModalOpen) {
        this.closeModal();
      }
    };
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Remove keyboard listener
   */
  removeKeyboardListener() {
    if (this.handleKeyDown) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  /**
   * Open modal
   */
  openModal() {
    this.isModalOpen = true;
    this.render();
    // Focus on title input when modal opens
    setTimeout(() => {
      const titleInput = this.shadowRoot.querySelector('#title');
      if (titleInput) {
        titleInput.focus();
      }
    }, 100);
  }

  /**
   * Close modal
   */
  closeModal() {
    this.isModalOpen = false;
    this.clearForm();
    this.render();
  }

  /**
   * Handle backdrop click (click outside modal)
   * @param {Event} e - Click event
   */
  handleBackdropClick(e) {
    if (e.target.classList.contains('modal-backdrop')) {
      this.closeModal();
    }
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
      const response = await createTodo(title, description || '', this.selectedCategoryId);

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

      // Show success message
      this.showSuccess('Todo created successfully!');

      // Close modal after successful creation
      this.closeModal();

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
    this.selectedCategoryId = null;

    // Reset category selector
    const selector = this.shadowRoot.querySelector('#category-selector');
    if (selector) {
      selector.setAttribute('selected-id', '');
    }
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

        /* Floating Action Button (FAB) */
        .fab {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 3.5rem;
          height: 3.5rem;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          z-index: 900;
        }

        .fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.5), 0 3px 6px rgba(0, 0, 0, 0.15);
        }

        .fab:active {
          transform: scale(0.95);
        }

        .fab:focus {
          outline: 2px solid #2563eb;
          outline-offset: 3px;
        }

        .fab-icon {
          width: 1.75rem;
          height: 1.75rem;
          color: white;
        }

        /* Modal Overlay */
        .modal-backdrop {
          display: ${this.isModalOpen ? 'flex' : 'none'};
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Modal Card */
        .modal-card {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          max-width: 32rem;
          width: 100%;
          max-height: calc(100vh - 2rem);
          overflow-y: auto;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(1rem);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Modal Header */
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-title-wrapper {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .modal-title-icon {
          width: 1.5rem;
          height: 1.5rem;
          color: #2563eb;
          flex-shrink: 0;
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .close-btn {
          width: 2rem;
          height: 2rem;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .close-btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .close-icon {
          width: 1.25rem;
          height: 1.25rem;
        }

        /* Modal Body */
        .modal-body {
          padding: 1.5rem;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
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
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .input.error,
        .textarea.error {
          border-color: #dc2626;
        }

        .textarea {
          resize: vertical;
          min-height: 5rem;
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

        /* Modal Footer */
        .modal-footer {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .cancel-btn,
        .submit-btn {
          padding: 0.625rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .cancel-btn {
          color: #374151;
          background-color: white;
          border: 1px solid #d1d5db;
        }

        .cancel-btn:hover:not(:disabled) {
          background-color: #f9fafb;
        }

        .cancel-btn:focus {
          outline: 2px solid #6b7280;
          outline-offset: 2px;
        }

        .submit-btn {
          color: white;
          background-color: #2563eb;
        }

        .submit-btn:hover:not(:disabled) {
          background-color: #1d4ed8;
        }

        .submit-btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .submit-btn:disabled,
        .cancel-btn:disabled {
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

        /* Mobile Responsiveness */
        @media (max-width: 640px) {
          .fab {
            bottom: 1.5rem;
            right: 1.5rem;
            width: 3rem;
            height: 3rem;
          }

          .fab-icon {
            width: 1.5rem;
            height: 1.5rem;
          }

          .modal-card {
            max-height: calc(100vh - 1rem);
          }

          .modal-header {
            padding: 1.25rem;
          }

          .modal-title {
            font-size: 1.125rem;
          }

          .modal-body {
            padding: 1.25rem;
          }

          .modal-footer {
            padding: 1rem 1.25rem;
            flex-direction: column;
          }

          .cancel-btn,
          .submit-btn {
            width: 100%;
          }
        }
      </style>

      <!-- Floating Action Button -->
      <button
        class="fab"
        type="button"
        aria-label="Add new todo"
        id="fab-btn"
      >
        <svg class="fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
        </svg>
      </button>

      <!-- Modal Overlay -->
      <div class="modal-backdrop" id="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-card">
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <svg class="modal-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
              <h2 class="modal-title" id="modal-title">Add New Todo</h2>
            </div>
            <button
              class="close-btn"
              type="button"
              aria-label="Close modal"
              id="close-btn"
            >
              <svg class="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
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

              <!-- Category Field -->
              <div class="form-group">
                <label class="label" for="category-selector">
                  Category <span style="color: #6b7280;">(optional)</span>
                </label>
                <category-selector id="category-selector"></category-selector>
              </div>
            </form>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <button
              type="button"
              class="cancel-btn"
              id="cancel-btn"
              ${this.isSubmitting ? 'disabled' : ''}
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="submit-btn"
              id="submit-btn"
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
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Handle category selected
   * @param {CustomEvent} event - Category selected event
   */
  handleCategorySelected(event) {
    this.selectedCategoryId = event.detail.categoryId;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // FAB button
    const fabBtn = this.shadowRoot.querySelector('#fab-btn');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => this.openModal());
    }

    // Close button
    const closeBtn = this.shadowRoot.querySelector('#close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    // Cancel button
    const cancelBtn = this.shadowRoot.querySelector('#cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeModal());
    }

    // Backdrop click
    const backdrop = this.shadowRoot.querySelector('#modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => this.handleBackdropClick(e));
    }

    // Form submission
    const form = this.shadowRoot.querySelector('form');
    const submitBtn = this.shadowRoot.querySelector('#submit-btn');
    if (form && submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSubmit({ target: form, preventDefault: () => {} });
      });
    }

    // Category selector
    const categorySelector = this.shadowRoot.querySelector('#category-selector');
    if (categorySelector) {
      categorySelector.addEventListener('category-selected', (e) => this.handleCategorySelected(e));
    }
  }
}

// Register custom element
customElements.define('todo-form', TodoForm);
