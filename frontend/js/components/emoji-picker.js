/**
 * EmojiPicker Component
 *
 * A simple emoji picker that displays common emoji categories
 * Emits 'emoji-selected' event when an emoji is chosen
 */

const EMOJI_CATEGORIES = {
  productivity: {
    label: 'Productivity',
    emojis: ['📋', '📝', '✅', '⭐', '🎯', '🏆', '💼', '🏢']
  },
  home: {
    label: 'Home & Shopping',
    emojis: ['🏠', '🏡', '🛋️', '🍽️', '🛒', '🛍️', '💰', '💳']
  },
  activities: {
    label: 'Activities',
    emojis: ['💪', '🏋️', '🧘', '🏃', '🎮', '🎬', '📚', '✏️']
  },
  symbols: {
    label: 'Symbols & Objects',
    emojis: ['❤️', '🎨', '🎵', '✈️', '🚗', '📱', '💻', '🔧']
  }
};

class EmojiPicker extends HTMLElement {
  constructor() {
    super();
    this._selectedEmoji = '📋';
  }

  connectedCallback() {
    this.render();
  }

  set selectedEmoji(emoji) {
    this._selectedEmoji = emoji;
    this.render();
  }

  get selectedEmoji() {
    return this._selectedEmoji;
  }

  handleEmojiSelect(emoji) {
    this._selectedEmoji = emoji;
    this.render();

    // Emit custom event
    this.dispatchEvent(new CustomEvent('emoji-selected', {
      detail: { emoji },
      bubbles: true
    }));
  }

  render() {
    this.className = 'space-y-3';

    const categoriesHTML = Object.entries(EMOJI_CATEGORIES).map(([key, { label, emojis }]) => `
      <div class="emoji-category">
        <div class="text-xs text-gray-600 mb-1">${label}</div>
        <div class="flex flex-wrap gap-1">
          ${emojis.map(emoji => `
            <button
              type="button"
              class="w-10 h-10 text-2xl rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                emoji === this._selectedEmoji ? 'bg-blue-100 ring-2 ring-blue-500' : ''
              }"
              data-emoji="${emoji}"
              title="${emoji}"
              aria-label="Select ${emoji} emoji"
            >${emoji}</button>
          `).join('')}
        </div>
      </div>
    `).join('');

    this.innerHTML = `
      <div class="max-h-64 overflow-y-auto">
        ${categoriesHTML}
      </div>
      <div class="pt-2 border-t border-gray-200">
        <label class="block text-xs text-gray-600 mb-1">Or type/paste any emoji:</label>
        <input
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type emoji here..."
          maxlength="2"
          value="${this._selectedEmoji}"
          data-custom-input
        />
      </div>
    `;

    // Add event listeners for emoji buttons
    this.querySelectorAll('button[data-emoji]').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        this.handleEmojiSelect(emoji);
      });
    });

    // Add event listener for custom input
    const customInput = this.querySelector('[data-custom-input]');
    if (customInput) {
      customInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (value) {
          this.handleEmojiSelect(value);
        }
      });
    }
  }
}

customElements.define('emoji-picker', EmojiPicker);

export default EmojiPicker;
