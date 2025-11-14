/**
 * Client-Side Hash Router
 *
 * Implements hash-based routing for GitHub Pages compatibility.
 * Supports route guards for protected routes.
 */

import { authState } from './services/auth-state.js';

/**
 * Route definition
 * @typedef {Object} Route
 * @property {string} path - Route path (e.g., '/', '/todos')
 * @property {Function} renderFn - Function to render the route
 * @property {boolean} requiresAuth - Whether route requires authentication
 */

/**
 * Hash-based client-side router
 */
class Router {
  constructor() {
    /** @type {Map<string, Route>} */
    this.routes = new Map();

    /** @type {string|null} */
    this.currentRoute = null;

    /** @type {boolean} */
    this.isStarted = false;

    // Bind methods to preserve context
    this.handleRouteChange = this.handleRouteChange.bind(this);
  }

  /**
   * Register a route with path, render function, and optional auth requirement
   * @param {string} path - Route path
   * @param {Function} renderFn - Function to render the route
   * @param {boolean} requiresAuth - Whether route requires authentication
   */
  addRoute(path, renderFn, requiresAuth = false) {
    // Normalize path (remove trailing slash except for root)
    const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');

    this.routes.set(normalizedPath, {
      path: normalizedPath,
      renderFn,
      requiresAuth
    });

    console.log(`📍 Route registered: ${normalizedPath}${requiresAuth ? ' (protected)' : ''}`);
  }

  /**
   * Navigate to a route programmatically
   * @param {string} path - Route path to navigate to
   */
  navigate(path) {
    // Normalize path
    const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');

    // Update hash (this will trigger hashchange event)
    window.location.hash = normalizedPath === '/' ? '' : `#${normalizedPath}`;
  }

  /**
   * Get current route path from hash
   * @returns {string} Current route path
   */
  getCurrentPath() {
    // Get hash without the # symbol
    const hash = window.location.hash.slice(1) || '/';

    // Normalize path (remove trailing slash except for root)
    return hash === '/' ? '/' : hash.replace(/\/$/, '');
  }

  /**
   * Handle hash change events
   */
  handleRouteChange() {
    const path = this.getCurrentPath();

    console.log(`🧭 Route changed to: ${path}`);

    // Get route definition
    const route = this.routes.get(path);

    // Handle unknown routes - redirect to default
    if (!route) {
      console.warn(`⚠️  Unknown route: ${path}, redirecting to /`);
      this.navigate('/');
      return;
    }

    // Check authentication for protected routes
    if (route.requiresAuth && !authState.getIsAuthenticated()) {
      console.warn(`🔒 Protected route requires authentication, redirecting to /login`);
      this.navigate('/login');
      return;
    }

    // Check if authenticated user is trying to access login/register
    if (!route.requiresAuth && authState.getIsAuthenticated() &&
        (path === '/login' || path === '/register')) {
      console.log(`✅ Already authenticated, redirecting to /todos`);
      this.navigate('/todos');
      return;
    }

    // Store current route
    this.currentRoute = path;

    // Clear previous route content
    const outlet = document.getElementById('router-outlet');
    if (outlet) {
      outlet.innerHTML = '';
    }

    // Render the route
    try {
      route.renderFn();
    } catch (error) {
      console.error(`Error rendering route ${path}:`, error);
      this.showRouteError(error.message);
    }
  }

  /**
   * Show route error message
   * @param {string} message - Error message
   */
  showRouteError(message) {
    const outlet = document.getElementById('router-outlet');
    if (!outlet) return;

    outlet.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <div class="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-red-800 mb-2">
            Route Error
          </h3>
          <p class="text-red-700">
            ${message}
          </p>
          <button
            onclick="window.location.reload()"
            class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Reload Page
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Start listening to route changes
   */
  start() {
    if (this.isStarted) {
      console.warn('Router already started');
      return;
    }

    console.log('🚀 Starting router...');

    // Listen to hash changes
    window.addEventListener('hashchange', this.handleRouteChange);

    // Listen to popstate (browser back/forward)
    window.addEventListener('popstate', this.handleRouteChange);

    // Subscribe to auth state changes to re-evaluate current route
    authState.subscribe(() => {
      console.log('🔄 Auth state changed, re-evaluating route...');
      this.handleRouteChange();
    });

    this.isStarted = true;

    // Handle initial route
    this.handleRouteChange();

    console.log('✅ Router started');
  }

  /**
   * Stop listening to route changes (for cleanup)
   */
  stop() {
    if (!this.isStarted) return;

    window.removeEventListener('hashchange', this.handleRouteChange);
    window.removeEventListener('popstate', this.handleRouteChange);

    this.isStarted = false;
    console.log('Router stopped');
  }
}

// Create and export singleton router instance
export const router = new Router();
