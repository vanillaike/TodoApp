/**
 * Application Configuration
 *
 * Centralized configuration for API endpoints, storage keys, and application constants.
 * Automatically detects environment (development vs production) based on hostname.
 */

/**
 * Determine if running in production environment
 */
const isProduction = window.location.hostname !== 'localhost' &&
                     window.location.hostname !== '127.0.0.1' &&
                     window.location.hostname !== '';

/**
 * API Base URL
 * - Development: Local Cloudflare Workers dev server
 * - Production: Deployed Cloudflare Workers URL (update this after deployment)
 */
const API_BASE_URL = isProduction
    ? 'https://todo-api.REPLACE-WITH-YOUR-WORKERS-SUBDOMAIN.workers.dev'
    : 'http://localhost:8787';

/**
 * Application Configuration Object
 */
export const CONFIG = {
    /**
     * API Configuration
     */
    API_BASE_URL,
    API_TIMEOUT: 10000, // 10 seconds

    /**
     * LocalStorage Keys
     */
    STORAGE_KEYS: {
        ACCESS_TOKEN: 'todo_app_access_token',
        REFRESH_TOKEN: 'todo_app_refresh_token',
        USER_DATA: 'todo_app_user_data'
    },

    /**
     * Authentication Configuration
     */
    AUTH: {
        MIN_PASSWORD_LENGTH: 8,
        MAX_PASSWORD_LENGTH: 128,
        EMAIL_MAX_LENGTH: 255,
        TOKEN_REFRESH_BUFFER: 60, // Refresh token 60 seconds before expiry
    },

    /**
     * Validation Configuration
     */
    VALIDATION: {
        TODO_TITLE_MIN_LENGTH: 1,
        TODO_TITLE_MAX_LENGTH: 200,
        TODO_DESCRIPTION_MAX_LENGTH: 1000,
    },

    /**
     * Pagination Configuration
     */
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 50,
        MAX_PAGE_SIZE: 100,
    },

    /**
     * UI Configuration
     */
    UI: {
        TOAST_DURATION: 3000, // milliseconds
        DEBOUNCE_DELAY: 300, // milliseconds
        ANIMATION_DURATION: 200, // milliseconds
    },

    /**
     * Routes Configuration
     */
    ROUTES: {
        LOGIN: '/',
        REGISTER: '/register',
        TODOS: '/todos',
        DEFAULT: '/'
    },

    /**
     * Environment Information
     */
    ENVIRONMENT: {
        IS_PRODUCTION: isProduction,
        IS_DEVELOPMENT: !isProduction,
        HOSTNAME: window.location.hostname
    }
};

/**
 * Validate configuration on load
 */
if (isProduction && API_BASE_URL.includes('REPLACE-WITH-YOUR-WORKERS-SUBDOMAIN')) {
    console.warn(
        '⚠️  Production API URL not configured!',
        '\nPlease update API_BASE_URL in frontend/js/config.js with your Cloudflare Workers URL.',
        '\nCurrently using placeholder:', API_BASE_URL
    );
}

/**
 * Log configuration in development
 */
if (!isProduction) {
    console.log('📝 Application Configuration:', {
        environment: CONFIG.ENVIRONMENT.IS_PRODUCTION ? 'production' : 'development',
        apiBaseUrl: CONFIG.API_BASE_URL,
        hostname: CONFIG.ENVIRONMENT.HOSTNAME
    });
}

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.STORAGE_KEYS);
Object.freeze(CONFIG.AUTH);
Object.freeze(CONFIG.VALIDATION);
Object.freeze(CONFIG.PAGINATION);
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.ROUTES);
Object.freeze(CONFIG.ENVIRONMENT);

/**
 * HTTPS Enforcement for Production
 * Redirects HTTP to HTTPS in production environment
 * Does NOT redirect in development (localhost)
 */
if (isProduction && window.location.protocol === 'http:') {
    console.warn('🔒 Redirecting to HTTPS for security...');
    window.location.href = window.location.href.replace('http:', 'https:');
}
