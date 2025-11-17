/**
 * ColorPicker Component
 *
 * A simple color picker that displays preset color swatches
 * Emits 'color-selected' event when a color is chosen
 */

const PRESET_COLORS = [
  { hex: '#EF4444', name: 'Red' },
  { hex: '#F59E0B', name: 'Orange' },
  { hex: '#EAB308', name: 'Yellow' },
  { hex: '#10B981', name: 'Green' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#8B5CF6', name: 'Purple' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#6B7280', name: 'Gray' },
];

class ColorPicker extends HTMLElement {
  constructor() {
    super();
    this._selectedColor = PRESET_COLORS[0].hex;
  }

  connectedCallback() {
    this.render();
  }

  set selectedColor(color) {
    this._selectedColor = color;
    this.render();
  }

  get selectedColor() {
    return this._selectedColor;
  }

  handleColorSelect(color) {
    this._selectedColor = color;
    this.render();

    // Emit custom event
    this.dispatchEvent(new CustomEvent('color-selected', {
      detail: { color },
      bubbles: true
    }));
  }

  render() {
    this.className = 'flex flex-wrap gap-2';

    this.innerHTML = PRESET_COLORS.map(({ hex, name }) => `
      <button
        type="button"
        class="w-8 h-8 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
          hex === this._selectedColor ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-300'
        }"
        style="background-color: ${hex}"
        title="${name}"
        data-color="${hex}"
        aria-label="${name}"
      ></button>
    `).join('');

    // Add event listeners
    this.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        this.handleColorSelect(color);
      });
    });
  }
}

customElements.define('color-picker', ColorPicker);

export default ColorPicker;
