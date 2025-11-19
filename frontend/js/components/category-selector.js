/**
 * Category Selector Component
 *
 * Dropdown component for selecting categories when creating or editing todos.
 * Fetches available categories from the API and displays them with visual indicators.
 */

import { getCategories } from '../services/category-api.js';

/**
 * Category Selector Component
 * @element category-selector
 *
 * @attr {string} selected-id - Pre-selected category ID (optional)
 *
 * @fires category-selected - When a category is selected { detail: { category, categoryId } }
 */
class CategorySelector extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {Array} */
    this.categories = [];

    /** @type {boolean} */
    this.isLoading = true;

    /** @type {string|null} */
    this.error = null;

    /** @type {number|null} */
    this.selectedId = null;
  }

  /**
   * Observed attributes
   */
  static get observedAttributes() {
    return ['selected-id'];
  }

  /**
   * Attribute changed callback
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'selected-id' && oldValue !== newValue) {
      this.selectedId = newValue && newValue !== '' ? parseInt(newValue, 10) : null;
      this.render();
    }
  }

  async connectedCallback() {
    // Parse initial selected-id attribute
    const selectedAttr = this.getAttribute('selected-id');
    this.selectedId = selectedAttr && selectedAttr !== '' ? parseInt(selectedAttr, 10) : null;

    await this.loadCategories();
    this.render();
    this.attachEventListeners();
  }

  /**
   * Load categories from API
   */
  async loadCategories() {
    this.isLoading = true;
    this.error = null;
    this.render();

    try {
      const response = await getCategories();

      if (!response.success) {
        throw new Error(response.error || 'Failed to load categories');
      }

      this.categories = response.data || [];
      this.isLoading = false;
      this.error = null;

    } catch (error) {
      console.error('Failed to load categories:', error);
      this.isLoading = false;
      this.error = error.message || 'Failed to load categories';
      this.categories = [];
    }

    this.render();
  }

  /**
   * Handle select change event
   * @param {Event} event - Change event
   */
  handleChange(event) {
    const value = event.target.value;

    if (value === '') {
      // "No category" selected
      this.selectedId = null;
      this.dispatchEvent(new CustomEvent('category-selected', {
        detail: {
          category: null,
          categoryId: null
        },
        bubbles: true,
        composed: true
      }));
    } else {
      // Category selected
      const categoryId = parseInt(value, 10);
      const category = this.categories.find(c => c.id === categoryId);

      this.selectedId = categoryId;
      this.dispatchEvent(new CustomEvent('category-selected', {
        detail: {
          category: category || null,
          categoryId: categoryId
        },
        bubbles: true,
        composed: true
      }));
    }
  }

  /**
   * Render the component
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .selector-wrapper {
          position: relative;
          width: 100%;
        }

        .select {
          width: 100%;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          font-family: inherit;
          color: #111827;
          background-color: white;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
          appearance: none;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 0.5rem center;
          background-repeat: no-repeat;
          background-size: 1.5em 1.5em;
          padding-right: 2.5rem;
        }

        .select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background-color: #f9fafb;
        }

        .select option {
          padding: 0.5rem;
        }

        .loading-state,
        .error-state {
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: #6b7280;
          background-color: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          text-align: center;
        }

        .error-state {
          color: #dc2626;
          background-color: #fef2f2;
          border-color: #fecaca;
        }

        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          margin-right: 0.5rem;
          border: 2px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          vertical-align: middle;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .retry-btn {
          margin-left: 0.5rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          color: #2563eb;
          background: white;
          border: 1px solid #2563eb;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .retry-btn:hover {
          background: #eff6ff;
        }

        .retry-btn:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
      </style>

      <div class="selector-wrapper">
        ${this.renderContent()}
      </div>
    `;

    // Re-attach event listeners after render
    this.attachEventListeners();
  }

  /**
   * Render content based on state
   * @returns {string} HTML content
   */
  renderContent() {
    if (this.isLoading) {
      return `
        <div class="loading-state">
          <span class="spinner" role="status" aria-hidden="true"></span>
          <span>Loading categories...</span>
        </div>
      `;
    }

    if (this.error) {
      return `
        <div class="error-state" role="alert">
          <span>${this.escapeHtml(this.error)}</span>
          <button class="retry-btn" id="retry-btn" type="button">Retry</button>
        </div>
      `;
    }

    // Render select with categories
    return `
      <select
        class="select"
        id="category-select"
        aria-label="Select category"
      >
        <option value="">No category</option>
        ${this.categories.map(category => `
          <option
            value="${category.id}"
            ${this.selectedId === category.id ? 'selected' : ''}
          >
            ${this.escapeHtml(category.icon)} ${this.escapeHtml(category.name)}
          </option>
        `).join('')}
      </select>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const select = this.shadowRoot.getElementById('category-select');
    if (select) {
      select.addEventListener('change', (e) => this.handleChange(e));
    }

    const retryBtn = this.shadowRoot.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadCategories());
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Register custom element
customElements.define('category-selector', CategorySelector);
