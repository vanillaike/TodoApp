/**
 * Login Form Component
 *
 * Web component for user login with client-side validation.
 * Dispatches custom events on success/error for parent component handling.
 */

import { login } from '../services/auth-api.js';
import { authState } from '../services/auth-state.js';
import { validateEmail } from '../utils/validators.js';

class LoginForm extends HTMLElement {
  constructor() {
    super();
    
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    // Clean up event listeners
    const form = this.querySelector('form');
    if (form) {
      form.removeEventListener('submit', this.handleSubmit);
    }
  }

  render() {
    this.innerHTML = `
      <style>

        /* Additional component-specific styles */
        .error-message {
          display: none;
        }

        .error-message.show {
          display: block;
        }

        .input-error {
          border-color: #ef4444;
        }

        .spinner {
          border: 2px solid #f3f4f6;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>

      <div class="w-full max-w-md mx-auto">
        <div class="bg-white rounded-lg shadow-md p-8">
          <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">
            Welcome Back
          </h2>

          <form id="login-form" class="space-y-4">
            <!-- Email Field -->
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autocomplete="email"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="you@example.com"
              />
              <p class="error-message text-sm text-red-600 mt-1" id="email-error"></p>
            </div>

            <!-- Password Field -->
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autocomplete="current-password"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your password"
              />
              <p class="error-message text-sm text-red-600 mt-1" id="password-error"></p>
            </div>

            <!-- General Error Message -->
            <div class="error-message bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" id="general-error">
              <span class="block sm:inline" id="general-error-text"></span>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              id="submit-button"
              class="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200 flex items-center justify-center"
            >
              <span id="button-text">Log In</span>
              <div class="spinner hidden ml-2" id="spinner"></div>
            </button>
          </form>

          <!-- Switch to Register -->
          <div class="mt-6 text-center">
            <p class="text-sm text-gray-600">
              Don't have an account?
              <button
                id="switch-to-register"
                class="text-primary-600 hover:text-primary-800 font-medium focus:outline-none focus:underline"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const form = this.querySelector('#login-form');
    const switchButton = this.querySelector('#switch-to-register');

    // Handle form submission
    form.addEventListener('submit', this.handleSubmit.bind(this));

    // Handle switch to register
    switchButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('switch-to-register', {
        bubbles: true,
        composed: true
      }));
    });

    // Clear errors when user starts typing
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.clearFieldError(input.id);
      });
    });
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.showLoading(true);
    this.clearErrors();

    // Get form values
    const email = this.querySelector('#email').value.trim();
    const password = this.querySelector('#password').value;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      this.showFieldError('email', emailValidation.error);
      this.showLoading(false);
      return;
    }

    // Validate password is not empty
    if (!password) {
      this.showFieldError('password', 'Password is required');
      this.showLoading(false);
      return;
    }

    try {
      // Call login API
      const result = await login(email, password);

      if (result.success) {
        // Update auth state
        await authState.login(
          result.data.accessToken,
          result.data.refreshToken,
          result.data.user
        );

        // Dispatch success event
        this.dispatchEvent(new CustomEvent('login-success', {
          detail: result.data,
          bubbles: true,
          composed: true
        }));
      } else {
        this.showError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  showError(message) {
    const errorDiv = this.querySelector('#general-error');
    const errorText = this.querySelector('#general-error-text');
    errorText.textContent = message;
    errorDiv.classList.add('show');
  }

  showFieldError(fieldId, message) {
    const input = this.querySelector(`#${fieldId}`);
    const errorElement = this.querySelector(`#${fieldId}-error`);

    if (input && errorElement) {
      input.classList.add('input-error');
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }
  }

  clearFieldError(fieldId) {
    const input = this.querySelector(`#${fieldId}`);
    const errorElement = this.querySelector(`#${fieldId}-error`);

    if (input && errorElement) {
      input.classList.remove('input-error');
      errorElement.textContent = '';
      errorElement.classList.remove('show');
    }
  }

  clearErrors() {
    // Clear general error
    const errorDiv = this.querySelector('#general-error');
    errorDiv.classList.remove('show');

    // Clear field errors
    const errorElements = this.querySelectorAll('.error-message');
    errorElements.forEach(el => {
      el.classList.remove('show');
      el.textContent = '';
    });

    // Remove error styling from inputs
    const inputs = this.querySelectorAll('input');
    inputs.forEach(input => {
      input.classList.remove('input-error');
    });
  }

  showLoading(isLoading) {
    const submitButton = this.querySelector('#submit-button');
    const buttonText = this.querySelector('#button-text');
    const spinner = this.querySelector('#spinner');
    const form = this.querySelector('#login-form');

    if (isLoading) {
      submitButton.disabled = true;
      buttonText.textContent = 'Logging in...';
      spinner.classList.remove('hidden');
      form.querySelectorAll('input').forEach(input => input.disabled = true);
    } else {
      submitButton.disabled = false;
      buttonText.textContent = 'Log In';
      spinner.classList.add('hidden');
      form.querySelectorAll('input').forEach(input => input.disabled = false);
    }
  }
}

// Register custom element
customElements.define('login-form', LoginForm);
