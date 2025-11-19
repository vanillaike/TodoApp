/**
 * Category Badge Component
 *
 * Displays a category as a colored badge with icon and name.
 * Optionally clickable for filtering or selection.
 */

/**
 * Category Badge Component
 * @element category-badge
 *
 * @attr {string} category - Category object as JSON string (required)
 *   Example: '{"id":1,"name":"Work","color":"#3B82F6","icon":"📋"}'
 * @attr {string} size - Badge size: 'small' | 'medium' (default: 'medium')
 * @attr {boolean} clickable - Whether badge is clickable (default: false)
 *
 * @fires badge-clicked - When badge is clicked (if clickable=true)
 *   Detail: { category: Object }
 */
class CategoryBadge extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {Object|null} */
    this.categoryData = null;

    /** @type {string} */
    this.size = 'medium';

    /** @type {boolean} */
    this.isClickable = false;
  }

  /**
   * Observed attributes
   */
  static get observedAttributes() {
    return ['category', 'size', 'clickable'];
  }

  /**
   * Attribute changed callback
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateProperty(name, newValue);
      this.render();
    }
  }

  connectedCallback() {
    this.updateAllProperties();
    this.render();
  }

  /**
   * Update a single property based on attribute
   * @param {string} name - Attribute name
   * @param {string|null} value - Attribute value
   */
  updateProperty(name, value) {
    switch (name) {
      case 'category':
        try {
          this.categoryData = value ? JSON.parse(value) : null;
        } catch (error) {
          console.error('Invalid category JSON:', error);
          this.categoryData = null;
        }
        break;
      case 'size':
        this.size = value === 'small' ? 'small' : 'medium';
        break;
      case 'clickable':
        this.isClickable = this.hasAttribute('clickable');
        break;
    }
  }

  /**
   * Update all properties from attributes
   */
  updateAllProperties() {
    const categoryAttr = this.getAttribute('category');
    const sizeAttr = this.getAttribute('size');
    this.isClickable = this.hasAttribute('clickable');

    try {
      this.categoryData = categoryAttr ? JSON.parse(categoryAttr) : null;
    } catch (error) {
      console.error('Invalid category JSON:', error);
      this.categoryData = null;
    }

    this.size = sizeAttr === 'small' ? 'small' : 'medium';
  }

  /**
   * Handle badge click
   */
  handleClick() {
    if (!this.isClickable || !this.categoryData) return;

    this.dispatchEvent(new CustomEvent('badge-clicked', {
      bubbles: true,
      composed: true,
      detail: { category: this.categoryData }
    }));
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

  /**
   * Calculate contrast color (black or white) for text based on background
   * @param {string} hexColor - Hex color (e.g., "#3B82F6")
   * @returns {string} "black" or "white"
   */
  getContrastColor(hexColor) {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance (WCAG formula)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for light backgrounds, white for dark backgrounds
    return luminance > 0.5 ? 'black' : 'white';
  }

  /**
   * Render the component
   */
  render() {
    if (!this.categoryData) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: inline-block;
          }
          .empty {
            color: #9ca3af;
            font-size: 0.875rem;
            font-style: italic;
          }
        </style>
        <span class="empty">No category</span>
      `;
      return;
    }

    const { name, color, icon } = this.categoryData;
    const textColor = this.getContrastColor(color);
    const isSmall = this.size === 'small';

    // Inline styles for dynamic colors (Tailwind can't handle runtime colors)
    const badgeStyle = `
      background-color: ${color};
      color: ${textColor};
    `;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          border-radius: 9999px;
          font-weight: 500;
          transition: all 0.2s;
          user-select: none;
        }

        .badge.small {
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
        }

        .badge.medium {
          padding: 0.25rem 0.75rem;
          font-size: 0.875rem;
        }

        .badge.clickable {
          cursor: pointer;
        }

        .badge.clickable:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }

        .badge.clickable:active {
          transform: scale(0.98);
        }

        .badge.clickable:focus {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }

        .icon {
          display: inline-flex;
          align-items: center;
          line-height: 1;
        }

        .name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        @media (max-width: 640px) {
          .name {
            max-width: 120px;
          }
        }
      </style>

      <div
        class="badge ${isSmall ? 'small' : 'medium'} ${this.isClickable ? 'clickable' : ''}"
        style="${badgeStyle}"
        role="${this.isClickable ? 'button' : 'status'}"
        tabindex="${this.isClickable ? '0' : '-1'}"
        aria-label="${this.escapeHtml(name)} category"
      >
        <span class="icon" aria-hidden="true">${this.escapeHtml(icon)}</span>
        <span class="name">${this.escapeHtml(name)}</span>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const badge = this.shadowRoot.querySelector('.badge');
    if (!badge) return;

    if (this.isClickable) {
      badge.addEventListener('click', () => this.handleClick());
      badge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleClick();
        }
      });
    }
  }
}

// Register custom element
customElements.define('category-badge', CategoryBadge);
