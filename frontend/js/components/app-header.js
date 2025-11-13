/**
 * App Header Component
 *
 * Application header with navigation, user info, and auth controls.
 * Shows different content based on authentication state.
 */

import { authState } from '../services/auth-state.js';
import { router } from '../router.js';
import './logout-button.js';

/**
 * App Header Component
 * @element app-header
 *
 * @fires navigate - When navigation link is clicked
 */
class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {Function|null} */
    this.authUnsubscribe = null;
  }

  connectedCallback() {
    // Subscribe to auth state changes
    this.authUnsubscribe = authState.subscribe(() => {
      this.render();
    });

    // Initial render
    this.render();
  }

  disconnectedCallback() {
    // Unsubscribe from auth state
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }
  }

  /**
   * Handle navigation click
   * @param {Event} e - Click event
   */
  handleNavigate(e) {
    e.preventDefault();
    const path = e.currentTarget.getAttribute('data-route');
    if (path) {
      router.navigate(path);
    }
  }

  /**
   * Render the component
   */
  render() {
    const isAuthenticated = authState.getIsAuthenticated();
    const user = authState.getCurrentUser();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .header {
          background-color: white;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        .container {
          max-width: 80rem;
          margin: 0 auto;
          padding: 1rem 1.5rem;
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          color: inherit;
        }

        .logo-icon {
          width: 2rem;
          height: 2rem;
          color: #2563eb;
        }

        .logo-text {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .nav-link {
          font-size: 0.875rem;
          font-weight: 500;
          color: #4b5563;
          text-decoration: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          transition: all 0.2s;
          cursor: pointer;
          background: none;
          border: none;
        }

        .nav-link:hover {
          color: #2563eb;
          background-color: #eff6ff;
        }

        .nav-link:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.5rem 1rem;
          background-color: #f3f4f6;
          border-radius: 0.5rem;
        }

        .user-email {
          font-size: 0.875rem;
          color: #374151;
          font-weight: 500;
        }

        .auth-buttons {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .divider {
          height: 1.5rem;
          width: 1px;
          background-color: #d1d5db;
        }

        @media (max-width: 640px) {
          .container {
            padding: 0.75rem 1rem;
          }

          .logo-text {
            font-size: 1.25rem;
          }

          .nav {
            gap: 0.75rem;
          }

          .nav-link {
            padding: 0.375rem 0.75rem;
            font-size: 0.8125rem;
          }

          .user-email {
            display: none;
          }
        }
      </style>

      <header class="header">
        <div class="container">
          <div class="header-content">
            <!-- Logo -->
            <a href="#/" class="logo" data-route="/" aria-label="Todo App Home">
              <svg class="logo-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span class="logo-text">Todo App</span>
            </a>

            <!-- Navigation & Auth Controls -->
            <nav class="nav">
              ${isAuthenticated ? this.renderAuthenticatedNav(user) : this.renderGuestNav()}
            </nav>
          </div>
        </div>
      </header>
    `;

    // Attach event listeners to navigation links
    this.attachEventListeners();
  }

  /**
   * Render navigation for authenticated users
   * @param {Object} user - Current user
   * @returns {string} HTML for authenticated nav
   */
  renderAuthenticatedNav(user) {
    return `
      <button class="nav-link" data-route="/todos" aria-label="View todos">
        Todos
      </button>
      <div class="divider" aria-hidden="true"></div>
      <div class="user-info">
        <span class="user-email" aria-label="Logged in as ${user.email}">${user.email}</span>
      </div>
      <logout-button variant="secondary"></logout-button>
    `;
  }

  /**
   * Render navigation for guest users
   * @returns {string} HTML for guest nav
   */
  renderGuestNav() {
    return `
      <div class="auth-buttons">
        <button class="nav-link" data-route="/login" aria-label="Log in">
          Log In
        </button>
        <button class="nav-link" data-route="/register" aria-label="Sign up">
          Sign Up
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners to navigation links
   */
  attachEventListeners() {
    const navLinks = this.shadowRoot.querySelectorAll('[data-route]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => this.handleNavigate(e));
    });
  }
}

// Register custom element
customElements.define('app-header', AppHeader);
