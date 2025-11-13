/**
 * Auth Container Component
 *
 * Container component that switches between login and register forms.
 * Manages the authentication UI and handles form switching.
 */

import './login-form.js';
import './register-form.js';

class AuthContainer extends HTMLElement {
  static get observedAttributes() {
    return ['mode'];
  }

  constructor() {
    super();
    this.currentMode = 'login';
  }

  connectedCallback() {
    this.currentMode = this.getAttribute('mode') || 'login';
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    // Clean up event listeners
    this.removeEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'mode' && oldValue !== newValue && this.isConnected) {
      this.currentMode = newValue || 'login';
      this.render();
      this.attachEventListeners();
    }
  }

  render() {
    // Clear existing content
    this.innerHTML = '';

    // Create container with Tailwind classes
    const container = document.createElement('div');
    container.className = 'min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8';

    // Create inner container
    const innerContainer = document.createElement('div');
    innerContainer.className = 'max-w-md w-full space-y-8';
    innerContainer.id = 'form-container';

    // Add appropriate form based on mode
    if (this.currentMode === 'register') {
      const registerForm = document.createElement('register-form');
      innerContainer.appendChild(registerForm);
    } else {
      const loginForm = document.createElement('login-form');
      innerContainer.appendChild(loginForm);
    }

    container.appendChild(innerContainer);
    this.appendChild(container);
  }

  attachEventListeners() {
    // Get the current form
    const formContainer = this.querySelector('#form-container');
    if (!formContainer) return;

    const currentForm = formContainer.firstElementChild;
    if (!currentForm) return;

    // Remove old listeners before adding new ones
    this.removeEventListeners();

    if (this.currentMode === 'register') {
      // Register form listeners
      this.switchToLoginHandler = this.handleSwitchToLogin.bind(this);
      this.registerSuccessHandler = this.handleRegisterSuccess.bind(this);
      this.registerErrorHandler = this.handleRegisterError.bind(this);

      currentForm.addEventListener('switch-to-login', this.switchToLoginHandler);
      currentForm.addEventListener('register-success', this.registerSuccessHandler);
      currentForm.addEventListener('register-error', this.registerErrorHandler);
    } else {
      // Login form listeners
      this.switchToRegisterHandler = this.handleSwitchToRegister.bind(this);
      this.loginSuccessHandler = this.handleLoginSuccess.bind(this);
      this.loginErrorHandler = this.handleLoginError.bind(this);

      currentForm.addEventListener('switch-to-register', this.switchToRegisterHandler);
      currentForm.addEventListener('login-success', this.loginSuccessHandler);
      currentForm.addEventListener('login-error', this.loginErrorHandler);
    }
  }

  removeEventListeners() {
    const formContainer = this.querySelector('#form-container');
    if (!formContainer) return;

    const currentForm = formContainer.firstElementChild;
    if (!currentForm) return;

    // Remove all possible listeners
    if (this.switchToLoginHandler) {
      currentForm.removeEventListener('switch-to-login', this.switchToLoginHandler);
    }
    if (this.switchToRegisterHandler) {
      currentForm.removeEventListener('switch-to-register', this.switchToRegisterHandler);
    }
    if (this.registerSuccessHandler) {
      currentForm.removeEventListener('register-success', this.registerSuccessHandler);
    }
    if (this.registerErrorHandler) {
      currentForm.removeEventListener('register-error', this.registerErrorHandler);
    }
    if (this.loginSuccessHandler) {
      currentForm.removeEventListener('login-success', this.loginSuccessHandler);
    }
    if (this.loginErrorHandler) {
      currentForm.removeEventListener('login-error', this.loginErrorHandler);
    }
  }

  handleSwitchToLogin() {
    this.setAttribute('mode', 'login');
  }

  handleSwitchToRegister() {
    this.setAttribute('mode', 'register');
  }

  handleRegisterSuccess(event) {
    console.log('Registration successful:', event.detail);

    // Dispatch event to parent (app-root or main.js)
    this.dispatchEvent(new CustomEvent('auth-success', {
      detail: {
        type: 'register',
        ...event.detail
      },
      bubbles: true,
      composed: true
    }));
  }

  handleRegisterError(event) {
    console.error('Registration error:', event.detail);

    // Optionally dispatch to parent for global error handling
    this.dispatchEvent(new CustomEvent('auth-error', {
      detail: {
        type: 'register',
        ...event.detail
      },
      bubbles: true,
      composed: true
    }));
  }

  handleLoginSuccess(event) {
    console.log('Login successful:', event.detail);

    // Dispatch event to parent (app-root or main.js)
    this.dispatchEvent(new CustomEvent('auth-success', {
      detail: {
        type: 'login',
        ...event.detail
      },
      bubbles: true,
      composed: true
    }));
  }

  handleLoginError(event) {
    console.error('Login error:', event.detail);

    // Optionally dispatch to parent for global error handling
    this.dispatchEvent(new CustomEvent('auth-error', {
      detail: {
        type: 'login',
        ...event.detail
      },
      bubbles: true,
      composed: true
    }));
  }
}

// Register custom element
customElements.define('auth-container', AuthContainer);
