/**
 * Confirm Dialog Component
 *
 * A reusable modal dialog for confirming user actions.
 * Provides a Promise-based API for easy integration.
 */

/**
 * Confirm Dialog Component
 * @element confirm-dialog
 *
 * Singleton component that provides confirmation dialogs.
 * Use the static show() method to display a confirmation dialog.
 */
class ConfirmDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {boolean} */
    this.isOpen = false;

    /** @type {Function|null} */
    this.resolvePromise = null;

    /** @type {Object} */
    this.options = {
      title: 'Confirm Action',
      message: 'Are you sure you want to proceed?',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      variant: 'danger' // 'danger' | 'warning' | 'info'
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
      if (e.key === 'Escape' && this.isOpen) {
        this.handleCancel();
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
   * Show the confirm dialog
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message
   * @param {string} [options.confirmText='Confirm'] - Confirm button text
   * @param {string} [options.cancelText='Cancel'] - Cancel button text
   * @param {string} [options.variant='danger'] - Dialog variant ('danger' | 'warning' | 'info')
   * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
   */
  show(options = {}) {
    this.options = {
      title: options.title || 'Confirm Action',
      message: options.message || 'Are you sure you want to proceed?',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      variant: options.variant || 'danger'
    };

    this.isOpen = true;
    this.render();

    // Focus on cancel button when dialog opens (safer default for destructive actions)
    setTimeout(() => {
      const cancelBtn = this.shadowRoot.querySelector('#cancel-btn');
      if (cancelBtn) {
        cancelBtn.focus();
      }
    }, 100);

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  /**
   * Handle confirm button click
   */
  handleConfirm() {
    this.isOpen = false;
    this.render();
    if (this.resolvePromise) {
      this.resolvePromise(true);
      this.resolvePromise = null;
    }
  }

  /**
   * Handle cancel button click or backdrop click
   */
  handleCancel() {
    this.isOpen = false;
    this.render();
    if (this.resolvePromise) {
      this.resolvePromise(false);
      this.resolvePromise = null;
    }
  }

  /**
   * Handle backdrop click (click outside dialog)
   * @param {Event} e - Click event
   */
  handleBackdropClick(e) {
    if (e.target.classList.contains('dialog-backdrop')) {
      this.handleCancel();
    }
  }

  /**
   * Get icon based on variant
   * @returns {string} SVG icon HTML
   */
  getIcon() {
    switch (this.options.variant) {
      case 'danger':
        return `
          <svg class="dialog-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        `;
      case 'warning':
        return `
          <svg class="dialog-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        `;
      case 'info':
        return `
          <svg class="dialog-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        `;
      default:
        return '';
    }
  }

  /**
   * Get icon color based on variant
   * @returns {string} CSS color value
   */
  getIconColor() {
    switch (this.options.variant) {
      case 'danger':
        return '#dc2626';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#2563eb';
      default:
        return '#6b7280';
    }
  }

  /**
   * Get confirm button style based on variant
   * @returns {string} CSS class names
   */
  getConfirmButtonClass() {
    switch (this.options.variant) {
      case 'danger':
        return 'confirm-btn confirm-btn-danger';
      case 'warning':
        return 'confirm-btn confirm-btn-warning';
      case 'info':
        return 'confirm-btn confirm-btn-info';
      default:
        return 'confirm-btn';
    }
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

        /* Dialog Overlay */
        .dialog-backdrop {
          display: ${this.isOpen ? 'flex' : 'none'};
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          align-items: center;
          justify-content: center;
          z-index: 1100;
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

        /* Dialog Card */
        .dialog-card {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          max-width: 28rem;
          width: 100%;
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

        /* Dialog Content */
        .dialog-content {
          padding: 1.5rem;
          text-align: center;
        }

        .icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3.5rem;
          height: 3.5rem;
          margin: 0 auto 1rem;
          background-color: ${this.getIconColor()}15;
          border-radius: 50%;
        }

        .dialog-icon {
          width: 2rem;
          height: 2rem;
          color: ${this.getIconColor()};
        }

        .dialog-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.75rem 0;
        }

        .dialog-message {
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.5;
          margin: 0;
        }

        /* Dialog Footer */
        .dialog-footer {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          border-bottom-left-radius: 0.75rem;
          border-bottom-right-radius: 0.75rem;
        }

        .cancel-btn,
        .confirm-btn {
          padding: 0.625rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .cancel-btn {
          color: #374151;
          background-color: white;
          border: 1px solid #d1d5db;
        }

        .cancel-btn:hover {
          background-color: #f9fafb;
        }

        .cancel-btn:focus {
          outline: 2px solid #6b7280;
          outline-offset: 2px;
        }

        .confirm-btn {
          color: white;
        }

        .confirm-btn-danger {
          background-color: #dc2626;
        }

        .confirm-btn-danger:hover {
          background-color: #b91c1c;
        }

        .confirm-btn-danger:focus {
          outline: 2px solid #dc2626;
          outline-offset: 2px;
        }

        .confirm-btn-warning {
          background-color: #f59e0b;
        }

        .confirm-btn-warning:hover {
          background-color: #d97706;
        }

        .confirm-btn-warning:focus {
          outline: 2px solid #f59e0b;
          outline-offset: 2px;
        }

        .confirm-btn-info {
          background-color: #2563eb;
        }

        .confirm-btn-info:hover {
          background-color: #1d4ed8;
        }

        .confirm-btn-info:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        /* Mobile Responsiveness */
        @media (max-width: 640px) {
          .dialog-card {
            max-width: calc(100vw - 2rem);
          }

          .dialog-content {
            padding: 1.25rem;
          }

          .dialog-footer {
            flex-direction: column-reverse;
            padding: 1rem 1.25rem;
          }

          .cancel-btn,
          .confirm-btn {
            width: 100%;
          }
        }
      </style>

      <!-- Dialog Overlay -->
      <div
        class="dialog-backdrop"
        id="dialog-backdrop"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
      >
        <div class="dialog-card">
          <!-- Dialog Content -->
          <div class="dialog-content">
            <div class="icon-wrapper">
              ${this.getIcon()}
            </div>
            <h2 class="dialog-title" id="dialog-title">${this.escapeHtml(this.options.title)}</h2>
            <p class="dialog-message" id="dialog-message">${this.escapeHtml(this.options.message)}</p>
          </div>

          <!-- Dialog Footer -->
          <div class="dialog-footer">
            <button
              type="button"
              class="cancel-btn"
              id="cancel-btn"
              aria-label="${this.escapeHtml(this.options.cancelText)}"
            >
              ${this.escapeHtml(this.options.cancelText)}
            </button>
            <button
              type="button"
              class="${this.getConfirmButtonClass()}"
              id="confirm-btn"
              aria-label="${this.escapeHtml(this.options.confirmText)}"
            >
              ${this.escapeHtml(this.options.confirmText)}
            </button>
          </div>
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
    // Cancel button
    const cancelBtn = this.shadowRoot.querySelector('#cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.handleCancel());
    }

    // Confirm button
    const confirmBtn = this.shadowRoot.querySelector('#confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.handleConfirm());
    }

    // Backdrop click
    const backdrop = this.shadowRoot.querySelector('#dialog-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => this.handleBackdropClick(e));
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
customElements.define('confirm-dialog', ConfirmDialog);

/**
 * Singleton instance of ConfirmDialog
 * This ensures only one confirm dialog exists in the DOM
 */
let confirmDialogInstance = null;

/**
 * Get or create the singleton confirm dialog instance
 * @returns {ConfirmDialog} The confirm dialog instance
 */
function getConfirmDialog() {
  if (!confirmDialogInstance) {
    confirmDialogInstance = document.createElement('confirm-dialog');
    document.body.appendChild(confirmDialogInstance);
  }
  return confirmDialogInstance;
}

/**
 * Show a confirm dialog
 * @param {Object} options - Dialog options
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
export async function showConfirmDialog(options) {
  const dialog = getConfirmDialog();
  return await dialog.show(options);
}

// Export for testing
export { ConfirmDialog };
