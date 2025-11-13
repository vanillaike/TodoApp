/**
 * Main Application Bootstrap
 *
 * This file initializes the application, sets up error handling,
 * and prepares the environment for web components to load.
 */

import { CONFIG } from './config.js';

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

        // Show a temporary welcome message until components are loaded
        const routerOutlet = document.getElementById('router-outlet');
        if (routerOutlet) {
            routerOutlet.innerHTML = `
                <div class="fade-in max-w-2xl mx-auto text-center py-12">
                    <h2 class="text-3xl font-bold text-gray-900 mb-4">
                        Welcome to Todo App
                    </h2>
                    <p class="text-lg text-gray-600 mb-8">
                        A modern todo application with authentication
                    </p>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                        <p class="text-blue-800">
                            <strong>Phase 1 Complete!</strong><br>
                            Project structure and configuration are ready.<br>
                            Next: API client and authentication components.
                        </p>
                    </div>
                    <div class="space-y-2 text-sm text-gray-500">
                        <p>✅ HTML structure with Tailwind CSS</p>
                        <p>✅ Configuration system</p>
                        <p>✅ Error handling</p>
                        <p>✅ Accessibility features</p>
                    </div>
                </div>
            `;
        }

        console.log('✅ Application initialized successfully');

        // In future phases, this is where we will:
        // 1. Load web component definitions
        // 2. Initialize auth state manager
        // 3. Set up router
        // 4. Render initial route

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
