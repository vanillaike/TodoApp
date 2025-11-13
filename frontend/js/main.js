/**
 * Main Application Bootstrap
 *
 * This file initializes the application, sets up error handling,
 * and prepares the environment for web components to load.
 */

import { CONFIG } from './config.js';
import { authState } from './services/auth-state.js';

// Import all components
import './components/register-form.js';
import './components/login-form.js';
import './components/logout-button.js';
import './components/auth-container.js';

/**
 * Global error handler for uncaught errors
 */
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    showErrorBoundary(event.error?.message || 'An unexpected error occurred');
});

/**
 * Global promise rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showErrorBoundary(event.reason?.message || 'An unexpected error occurred');
});

/**
 * Show error boundary UI
 * @param {string} message - Error message to display
 */
function showErrorBoundary(message) {
    const errorBoundary = document.getElementById('error-boundary');
    const errorMessage = document.getElementById('error-message');

    if (errorBoundary && errorMessage) {
        errorMessage.textContent = message;
        errorBoundary.classList.remove('hidden');
    }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    const routerOutlet = document.getElementById('router-outlet');
    if (routerOutlet) {
        routerOutlet.innerHTML = '';
    }
}

/**
 * Render UI based on authentication state
 */
function renderUI() {
    const routerOutlet = document.getElementById('router-outlet');
    if (!routerOutlet) return;

    if (authState.getIsAuthenticated()) {
        // User is authenticated - show welcome message with logout button
        const user = authState.getCurrentUser();
        routerOutlet.innerHTML = `
            <div class="fade-in max-w-2xl mx-auto text-center py-12">
                <h2 class="text-3xl font-bold text-gray-900 mb-4">
                    Welcome, ${user.email}!
                </h2>
                <p class="text-gray-600 mb-8">
                    You are successfully logged in.
                </p>
                <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                    <p class="text-green-800">
                        <strong>Phase 3 & 4 Complete!</strong><br>
                        Authentication components and state management are working.<br>
                        Next: Todo components (Phase 5).
                    </p>
                </div>
                <logout-button variant="primary"></logout-button>
            </div>
        `;
    } else {
        // User is not authenticated - show auth container
        routerOutlet.innerHTML = '<auth-container mode="login"></auth-container>';
    }
}

/**
 * Initialize application
 */
async function initializeApp() {
    console.log('🚀 Initializing Todo App...');

    try {
        // Log environment information
        console.log('Environment:', CONFIG.ENVIRONMENT.IS_PRODUCTION ? 'Production' : 'Development');
        console.log('API Base URL:', CONFIG.API_BASE_URL);

        // Check if web components are supported
        if (!('customElements' in window)) {
            throw new Error(
                'Web Components are not supported in this browser. ' +
                'Please use a modern browser like Chrome, Firefox, Safari, or Edge.'
            );
        }

        // Hide initial loading state
        hideLoadingState();

        // Initialize authentication state
        console.log('Initializing authentication state...');
        authState.initialize();

        // Subscribe to auth state changes
        authState.subscribe((state) => {
            console.log('Auth state changed:', state);
            // Re-render UI when auth state changes
            renderUI();
        });

        // Render initial UI based on auth state
        renderUI();

        console.log('✅ Application initialized successfully');

    } catch (error) {
        console.error('Failed to initialize application:', error);
        showErrorBoundary(error.message);
    }
}

/**
 * Wait for DOM to be ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM already loaded
    initializeApp();
}

/**
 * Export for testing purposes
 */
export { initializeApp, showErrorBoundary };
