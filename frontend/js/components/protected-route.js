/**
 * Protected Route Component
 *
 * Wrapper component that shows content only when authenticated.
 * Redirects to login if user is not authenticated.
 */

import { authState } from '../services/auth-state.js';
import { router } from '../router.js';

/**
 * Protected Route Component
 * @element protected-route
 *
 * Usage:
 * <protected-route>
 *   <todo-page></todo-page>
 * </protected-route>
 */
class ProtectedRoute extends HTMLElement {
  constructor() {
    super();

    /** @type {Function|null} */
    this.authUnsubscribe = null;

    /** @type {boolean} */
    this.isChecking = true;
  }

  connectedCallback() {
    // Subscribe to auth state changes
    this.authUnsubscribe = authState.subscribe(() => {
      this.checkAuthentication();
    });

    // Initial check
    this.checkAuthentication();
  }

  disconnectedCallback() {
    // Unsubscribe from auth state
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }
  }

  /**
   * Check authentication and show/hide content
   */
  checkAuthentication() {
    const isAuthenticated = authState.getIsAuthenticated();

    this.isChecking = false;

    if (!isAuthenticated) {
      // Hide content and redirect to login
      this.style.display = 'none';
      console.log('🔒 Protected route: User not authenticated, redirecting to login');
      router.navigate('/login');
    } else {
      // Show content
      this.style.display = 'block';
    }
  }

  /**
   * Render loading state
   */
  renderLoadingState() {
    this.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3rem;
      ">
        <div style="text-align: center;">
          <div style="
            display: inline-block;
            width: 2.5rem;
            height: 2.5rem;
            border: 3px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
          "></div>
          <p style="
            margin-top: 1rem;
            color: #6b7280;
            font-size: 0.875rem;
          ">Checking authentication...</p>
        </div>
      </div>
    `;
  }
}

// Register custom element
customElements.define('protected-route', ProtectedRoute);
