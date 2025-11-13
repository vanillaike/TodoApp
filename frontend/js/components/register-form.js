/**
 * Register Form Component
 *
 * Web component for user registration with client-side validation.
 * Dispatches custom events on success/error for parent component handling.
 */

import { register } from '../services/auth-api.js';
import { authState } from '../services/auth-state.js';
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch
} from '../utils/validators.js';

class RegisterForm extends HTMLElement {
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
            Create Account
          </h2>

          <form id="register-form" class="space-y-4">
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
                autocomplete="new-password"
                minlength="8"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="At least 8 characters"
              />
              <p class="error-message text-sm text-red-600 mt-1" id="password-error"></p>
            </div>

            <!-- Confirm Password Field -->
            <div>
              <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirm-password"
                name="confirm-password"
                required
                autocomplete="new-password"
                minlength="8"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Confirm your password"
              />
              <p class="error-message text-sm text-red-600 mt-1" id="confirm-password-error"></p>
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
              <span id="button-text">Sign Up</span>
              <div class="spinner hidden ml-2" id="spinner"></div>
            </button>
          </form>

          <!-- Switch to Login -->
          <div class="mt-6 text-center">
            <p class="text-sm text-gray-600">
              Already have an account?
              <button
                id="switch-to-login"
                class="text-primary-600 hover:text-primary-800 font-medium focus:outline-none focus:underline"
              >
                Log in
              </button>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const form = this.querySelector('#register-form');
    const switchButton = this.querySelector('#switch-to-login');

    // Handle form submission
    form.addEventListener('submit', this.handleSubmit.bind(this));

    // Handle switch to login
    switchButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('switch-to-login', {
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
    const confirmPassword = this.querySelector('#confirm-password').value;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      this.showFieldError('email', emailValidation.error);
      this.showLoading(false);
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      this.showFieldError('password', passwordValidation.error);
      this.showLoading(false);
      return;
    }

    // Validate password match
    const matchValidation = validatePasswordMatch(password, confirmPassword);
    if (!matchValidation.valid) {
      this.showFieldError('confirm-password', matchValidation.error);
      this.showLoading(false);
      return;
    }

    try {
      // Call register API
      const result = await register(email, password);

      if (result.success) {
        // Update auth state
        await authState.login(
          result.data.accessToken,
          result.data.refreshToken,
          result.data.user
        );

        // Dispatch success event
        this.dispatchEvent(new CustomEvent('register-success', {
          detail: result.data,
          bubbles: true,
          composed: true
        }));
      } else {
        this.showError(result.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
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
    const form = this.querySelector('#register-form');

    if (isLoading) {
      submitButton.disabled = true;
      buttonText.textContent = 'Signing up...';
      spinner.classList.remove('hidden');
      form.querySelectorAll('input').forEach(input => input.disabled = true);
    } else {
      submitButton.disabled = false;
      buttonText.textContent = 'Sign Up';
      spinner.classList.add('hidden');
      form.querySelectorAll('input').forEach(input => input.disabled = false);
    }
  }
}

// Register custom element
customElements.define('register-form', RegisterForm);
