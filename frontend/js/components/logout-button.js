/**
 * Logout Button Component
 *
 * Web component for logout functionality with loading state.
 * Dispatches custom events on success/error for parent component handling.
 */

import { authState } from '../services/auth-state.js';

class LogoutButton extends HTMLElement {
  constructor() {
    super();
  }

  static get observedAttributes() {
    return ['variant'];
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    // Clean up event listeners
    const button = this.querySelector('button');
    if (button) {
      button.removeEventListener('click', this.handleLogout);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'variant' && oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const variant = this.getAttribute('variant') || 'primary';

    // Since this component is used in Shadow DOM (app-header), we need inline styles
    // that match the header's nav-link styling
    const buttonStyle = variant === 'secondary'
      ? `
        font-size: 0.875rem;
        font-weight: 500;
        color: #4b5563;
        background: none;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      `
      : `
        font-size: 0.875rem;
        font-weight: 500;
        color: white;
        background-color: #2563eb;
        border: none;
        padding: 0.5rem 1.5rem;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      `;

    this.innerHTML = `
      <style>
        #logout-button {
          ${buttonStyle}
        }

        #logout-button:hover {
          ${variant === 'secondary'
            ? 'color: #2563eb; background-color: #eff6ff;'
            : 'background-color: #1d4ed8;'
          }
        }

        #logout-button:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        #logout-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .logout-spinner {
          border: 2px solid #f3f4f6;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }

        .logout-spinner.hidden {
          display: none;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>

      <button id="logout-button">
        <span id="button-text">Log Out</span>
        <span class="logout-spinner hidden" id="spinner"></span>
      </button>
    `;
  }

  attachEventListeners() {
    const button = this.querySelector('#logout-button');
    button.addEventListener('click', this.handleLogout.bind(this));
  }

  async handleLogout(event) {
    event.preventDefault();
    this.showLoading(true);

    try {
      // Call authState logout (handles API call and state cleanup)
      await authState.logout();

      // Dispatch success event
      this.dispatchEvent(new CustomEvent('logout-success', {
        bubbles: true,
        composed: true
      }));
    } catch (error) {
      console.error('Logout error:', error);

      // Dispatch error event
      this.dispatchEvent(new CustomEvent('logout-error', {
        detail: { message: error.message || 'Logout failed. Please try again.' },
        bubbles: true,
        composed: true
      }));
    } finally {
      this.showLoading(false);
    }
  }

  showLoading(isLoading) {
    const button = this.querySelector('#logout-button');
    const buttonText = this.querySelector('#button-text');
    const spinner = this.querySelector('#spinner');

    if (isLoading) {
      button.disabled = true;
      buttonText.textContent = 'Logging out...';
      spinner.classList.remove('hidden');
    } else {
      button.disabled = false;
      buttonText.textContent = 'Log Out';
      spinner.classList.add('hidden');
    }
  }
}

// Register custom element
customElements.define('logout-button', LogoutButton);
