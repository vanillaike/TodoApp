/**
 * Main Application Bootstrap
 *
 * This file initializes the application, sets up error handling,
 * and prepares the environment for web components to load.
 */

import { CONFIG } from './config.js';
import { authState } from './services/auth-state.js';
import { router } from './router.js';

// Import all components
import './components/confirm-dialog.js';
import './components/register-form.js';
import './components/login-form.js';
import './components/logout-button.js';
import './components/auth-container.js';
import './components/app-header.js';
import './components/todo-item.js';
import './components/todo-list.js';
import './components/todo-form.js';
import './components/protected-route.js';
import './components/todo-page.js';

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
 * Render app header
 */
function renderHeader() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.innerHTML = '<app-header></app-header>';
    }
}

/**
 * Set up error boundary handlers
 */
function setupErrorBoundaryHandlers() {
    const reloadBtn = document.getElementById('error-reload-btn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
}

/**
 * Set up router routes
 */
function setupRouter() {
    // Default route - redirect based on auth state
    router.addRoute('/', () => {
        if (authState.getIsAuthenticated()) {
            router.navigate('/todos');
        } else {
            router.navigate('/login');
        }
    });

    // Login route
    router.addRoute('/login', () => {
        if (authState.getIsAuthenticated()) {
            router.navigate('/todos');
            return;
        }
        const outlet = document.getElementById('router-outlet');
        if (outlet) {
            outlet.innerHTML = '<auth-container mode="login"></auth-container>';
        }
    });

    // Register route
    router.addRoute('/register', () => {
        if (authState.getIsAuthenticated()) {
            router.navigate('/todos');
            return;
        }
        const outlet = document.getElementById('router-outlet');
        if (outlet) {
            outlet.innerHTML = '<auth-container mode="register"></auth-container>';
        }
    });

    // Todos route (protected)
    router.addRoute('/todos', () => {
        const outlet = document.getElementById('router-outlet');
        if (outlet) {
            outlet.innerHTML = '<protected-route><todo-page></todo-page></protected-route>';
        }
    }, true);
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

        // Render app header
        console.log('Rendering app header...');
        renderHeader();

        // Set up router
        console.log('Setting up router...');
        setupRouter();

        // Set up error boundary handlers
        console.log('Setting up error boundary handlers...');
        setupErrorBoundaryHandlers();

        // Subscribe to auth state changes
        authState.subscribe((state) => {
            console.log('Auth state changed:', state);

            // Navigate based on auth state
            if (state.isAuthenticated) {
                // User logged in - navigate to todos
                router.navigate('/todos');
            } else {
                // User logged out - navigate to login
                const currentPath = router.getCurrentPath();
                if (currentPath === '/todos') {
                    router.navigate('/login');
                }
            }
        });

        // Start router (this will handle initial route)
        console.log('Starting router...');
        router.start();

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
