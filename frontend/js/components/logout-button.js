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
    this.attachShadow({ mode: 'open' });
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
    const button = this.shadowRoot.querySelector('button');
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

    // Determine button styles based on variant
    const buttonClasses = variant === 'secondary'
      ? 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';

    this.shadowRoot.innerHTML = `
      <style>
        @import url('https://cdn.tailwindcss.com');

        .spinner {
          border: 2px solid #f3f4f6;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      </style>

      <button
        id="logout-button"
        class="${buttonClasses} text-white py-2 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="button-text">Log Out</span>
        <div class="spinner hidden ml-2" id="spinner"></div>
      </button>
    `;
  }

  attachEventListeners() {
    const button = this.shadowRoot.getElementById('logout-button');
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
    const button = this.shadowRoot.getElementById('logout-button');
    const buttonText = this.shadowRoot.getElementById('button-text');
    const spinner = this.shadowRoot.getElementById('spinner');

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
