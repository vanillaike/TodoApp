/**
 * CategoryManager Component
 *
 * Modal dialog for managing user categories
 * Features:
 * - List user categories (editable)
 * - Display system categories (read-only)
 * - Add new categories
 * - Edit existing categories (inline)
 * - Delete categories with confirmation
 * - Color and emoji selection
 */

import { getCategories, createCategory, updateCategory, deleteCategory } from '../services/category-api.js';
import { showConfirmDialog } from './confirm-dialog.js';
import './color-picker.js';
import './emoji-picker.js';

class CategoryManager extends HTMLElement {
  constructor() {
    super();
    this.categories = [];
    this.userCategories = [];
    this.systemCategories = [];
    this.editingId = null;
    this.isAddingNew = false;
    this.isLoading = false;
    this.error = null;

    // Form state
    this.formData = {
      name: '',
      color: '#3B82F6',
      icon: '📋'
    };
  }

  async connectedCallback() {
    this.render();
    await this.loadCategories();
  }

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

      // Separate user and system categories
      this.userCategories = this.categories.filter(cat => cat.is_system === 0);
      this.systemCategories = this.categories.filter(cat => cat.is_system === 1);

      this.isLoading = false;
      this.render();
    } catch (error) {
      console.error('Failed to load categories:', error);
      this.error = error.message || 'Failed to load categories';
      this.isLoading = false;
      this.render();
    }
  }

  handleAddNew() {
    this.isAddingNew = true;
    this.editingId = null;
    this.formData = {
      name: '',
      color: '#3B82F6',
      icon: '📋'
    };
    this.render();
  }

  handleCancelAdd() {
    this.isAddingNew = false;
    this.render();
  }

  async handleCreate() {
    const { name, color, icon } = this.formData;

    if (!name.trim()) {
      this.showToast('Please enter a category name', 'error');
      return;
    }

    if (name.length > 50) {
      this.showToast('Category name must be 50 characters or less', 'error');
      return;
    }

    this.isLoading = true;
    this.render();

    try {
      const response = await createCategory(name.trim(), color, icon);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create category');
      }

      this.showToast('Category created successfully', 'success');
      this.isAddingNew = false;
      await this.loadCategories();
      this.emitCategoriesUpdated();
    } catch (error) {
      console.error('Failed to create category:', error);
      this.showToast(error.message || 'Failed to create category', 'error');
      this.isLoading = false;
      this.render();
    }
  }

  handleEdit(categoryId) {
    const category = this.userCategories.find(cat => cat.id === categoryId);
    if (!category) return;

    this.editingId = categoryId;
    this.isAddingNew = false;
    this.formData = {
      name: category.name,
      color: category.color,
      icon: category.icon
    };
    this.render();
  }

  handleCancelEdit() {
    this.editingId = null;
    this.render();
  }

  async handleUpdate(categoryId) {
    const { name, color, icon } = this.formData;

    if (!name.trim()) {
      this.showToast('Please enter a category name', 'error');
      return;
    }

    if (name.length > 50) {
      this.showToast('Category name must be 50 characters or less', 'error');
      return;
    }

    this.isLoading = true;
    this.render();

    try {
      const response = await updateCategory(categoryId, { name: name.trim(), color, icon });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update category');
      }

      this.showToast('Category updated successfully', 'success');
      this.editingId = null;
      await this.loadCategories();
      this.emitCategoriesUpdated();
    } catch (error) {
      console.error('Failed to update category:', error);
      this.showToast(error.message || 'Failed to update category', 'error');
      this.isLoading = false;
      this.render();
    }
  }

  async handleDelete(categoryId) {
    const category = this.userCategories.find(cat => cat.id === categoryId);
    if (!category) return;

    // Show confirmation dialog
    const confirmed = await showConfirmDialog({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category.name}"? Any todos assigned to this category will be unassigned.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });

    if (!confirmed) return;

    this.isLoading = true;
    this.render();

    try {
      const response = await deleteCategory(categoryId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete category');
      }

      this.showToast('Category deleted successfully', 'success');
      await this.loadCategories();
      this.emitCategoriesUpdated();
    } catch (error) {
      console.error('Failed to delete category:', error);
      this.showToast(error.message || 'Failed to delete category', 'error');
      this.isLoading = false;
      this.render();
    }
  }

  handleFormChange(field, value) {
    this.formData[field] = value;
  }

  close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    this.remove();
  }

  emitCategoriesUpdated() {
    this.dispatchEvent(new CustomEvent('categories-updated', { bubbles: true }));
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('toast-notification');
    toast.message = message;
    toast.type = type;
    document.body.appendChild(toast);
  }

  renderCategoryRow(category) {
    const isEditing = this.editingId === category.id;

    if (isEditing) {
      return `
        <div class="bg-gray-50 border-2 border-blue-500 rounded-lg p-4">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Category name"
                maxlength="50"
                value="${this.formData.name}"
                data-edit-name
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <color-picker data-edit-color></color-picker>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <emoji-picker data-edit-emoji></emoji-picker>
            </div>
            <div class="flex gap-2">
              <button
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-save-edit="${category.id}"
                ${this.isLoading ? 'disabled' : ''}
              >
                ${this.isLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                data-cancel-edit
                ${this.isLoading ? 'disabled' : ''}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
        <div class="flex items-center gap-3">
          <div
            class="w-4 h-4 rounded-full"
            style="background-color: ${category.color}"
          ></div>
          <span class="text-2xl">${category.icon}</span>
          <span class="font-medium text-gray-900">${category.name}</span>
        </div>
        <div class="flex gap-2">
          <button
            class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
            data-edit="${category.id}"
            ${this.isLoading ? 'disabled' : ''}
          >
            Edit
          </button>
          <button
            class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            data-delete="${category.id}"
            ${this.isLoading ? 'disabled' : ''}
          >
            Delete
          </button>
        </div>
      </div>
    `;
  }

  renderAddForm() {
    if (!this.isAddingNew) return '';

    return `
      <div class="bg-blue-50 border-2 border-blue-500 rounded-lg p-4 mb-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-3">New Category</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Category name"
              maxlength="50"
              value="${this.formData.name}"
              data-add-name
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <color-picker data-add-color></color-picker>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <emoji-picker data-add-emoji></emoji-picker>
          </div>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-create
              ${this.isLoading ? 'disabled' : ''}
            >
              ${this.isLoading ? 'Creating...' : 'Create'}
            </button>
            <button
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              data-cancel-add
              ${this.isLoading ? 'disabled' : ''}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    this.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50';

    this.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 class="text-2xl font-bold text-gray-900">Manage Categories</h2>
          <button
            class="p-2 hover:bg-gray-100 rounded-full transition-colors"
            data-close
            ${this.isLoading ? 'disabled' : ''}
            aria-label="Close"
          >
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          ${this.error ? `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p class="text-red-800">${this.error}</p>
              <button
                class="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                data-retry
              >
                Retry
              </button>
            </div>
          ` : ''}

          ${this.isLoading && this.categories.length === 0 ? `
            <div class="text-center py-8">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
              <p class="mt-2 text-gray-600">Loading categories...</p>
            </div>
          ` : `
            <!-- Add Button -->
            ${!this.isAddingNew ? `
              <button
                class="w-full mb-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                data-add-new
                ${this.isLoading ? 'disabled' : ''}
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Category
              </button>
            ` : ''}

            <!-- Add Form -->
            ${this.renderAddForm()}

            <!-- User Categories -->
            ${this.userCategories.length > 0 ? `
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-3">Your Categories</h3>
                <div class="space-y-2">
                  ${this.userCategories.map(cat => this.renderCategoryRow(cat)).join('')}
                </div>
              </div>
            ` : !this.isAddingNew ? `
              <div class="mb-6 text-center py-8 bg-gray-50 rounded-lg">
                <p class="text-gray-600">No custom categories yet.</p>
                <p class="text-sm text-gray-500 mt-1">Click "Add Category" to create one!</p>
              </div>
            ` : ''}

            <!-- System Categories -->
            ${this.systemCategories.length > 0 ? `
              <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-3">System Categories</h3>
                <p class="text-sm text-gray-600 mb-3">These categories are built-in and cannot be modified.</p>
                <div class="flex flex-wrap gap-3">
                  ${this.systemCategories.map(cat => `
                    <div class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg">
                      <div
                        class="w-3 h-3 rounded-full"
                        style="background-color: ${cat.color}"
                      ></div>
                      <span class="text-xl">${cat.icon}</span>
                      <span class="font-medium text-gray-700">${cat.name}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          `}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    // Close button
    const closeBtn = this.querySelector('[data-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Retry button
    const retryBtn = this.querySelector('[data-retry]');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadCategories());
    }

    // Add new button
    const addNewBtn = this.querySelector('[data-add-new]');
    if (addNewBtn) {
      addNewBtn.addEventListener('click', () => this.handleAddNew());
    }

    // Add form handlers
    if (this.isAddingNew) {
      const nameInput = this.querySelector('[data-add-name]');
      const colorPicker = this.querySelector('[data-add-color]');
      const emojiPicker = this.querySelector('[data-add-emoji]');
      const createBtn = this.querySelector('[data-create]');
      const cancelBtn = this.querySelector('[data-cancel-add]');

      if (nameInput) {
        nameInput.addEventListener('input', (e) => {
          this.handleFormChange('name', e.target.value);
        });
      }

      if (colorPicker) {
        colorPicker.selectedColor = this.formData.color;
        colorPicker.addEventListener('color-selected', (e) => {
          this.handleFormChange('color', e.detail.color);
        });
      }

      if (emojiPicker) {
        emojiPicker.selectedEmoji = this.formData.icon;
        emojiPicker.addEventListener('emoji-selected', (e) => {
          this.handleFormChange('icon', e.detail.emoji);
        });
      }

      if (createBtn) {
        createBtn.addEventListener('click', () => this.handleCreate());
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.handleCancelAdd());
      }
    }

    // Edit buttons
    this.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const categoryId = parseInt(btn.dataset.edit);
        this.handleEdit(categoryId);
      });
    });

    // Delete buttons
    this.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const categoryId = parseInt(btn.dataset.delete);
        this.handleDelete(categoryId);
      });
    });

    // Edit form handlers
    if (this.editingId) {
      const nameInput = this.querySelector('[data-edit-name]');
      const colorPicker = this.querySelector('[data-edit-color]');
      const emojiPicker = this.querySelector('[data-edit-emoji]');
      const saveBtn = this.querySelector('[data-save-edit]');
      const cancelBtn = this.querySelector('[data-cancel-edit]');

      if (nameInput) {
        nameInput.addEventListener('input', (e) => {
          this.handleFormChange('name', e.target.value);
        });
      }

      if (colorPicker) {
        colorPicker.selectedColor = this.formData.color;
        colorPicker.addEventListener('color-selected', (e) => {
          this.handleFormChange('color', e.detail.color);
        });
      }

      if (emojiPicker) {
        emojiPicker.selectedEmoji = this.formData.icon;
        emojiPicker.addEventListener('emoji-selected', (e) => {
          this.handleFormChange('icon', e.detail.emoji);
        });
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const categoryId = parseInt(saveBtn.dataset.saveEdit);
          this.handleUpdate(categoryId);
        });
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.handleCancelEdit());
      }
    }

    // Close on backdrop click
    this.addEventListener('click', (e) => {
      if (e.target === this) {
        this.close();
      }
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }
}

customElements.define('category-manager', CategoryManager);

export default CategoryManager;
