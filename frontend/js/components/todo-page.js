/**
 * Todo Page Component
 *
 * Main todo page that combines todo-form and todo-list.
 * Handles event communication between form and list.
 */

import './todo-form.js';
import './todo-list.js';
import './category-manager.js';

/**
 * Todo Page Component
 * @element todo-page
 */
class TodoPage extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  /**
   * Handle todo created event
   * @param {CustomEvent} e - Todo created event
   */
  handleTodoCreated(e) {
    console.log('Todo created:', e.detail.todo);

    // Refresh the todo list
    const todoList = this.querySelector('todo-list');
    if (todoList) {
      // Trigger a refresh by calling fetchTodos
      todoList.fetchTodos();
    }
  }

  /**
   * Handle todo create error event
   * @param {CustomEvent} e - Todo create error event
   */
  handleTodoCreateError(e) {
    console.error('Todo create error:', e.detail.message);
  }

  /**
   * Handle manage categories button click
   * Opens the category manager modal
   */
  handleManageCategories() {
    const manager = document.createElement('category-manager');
    document.body.appendChild(manager);

    manager.addEventListener('close', () => {
      manager.remove();
    });

    manager.addEventListener('categories-updated', () => {
      // Refresh todos to get updated category data
      this.refreshTodos();
    });
  }

  /**
   * Refresh the todo list and categories
   */
  refreshTodos() {
    const todoList = this.querySelector('todo-list');
    if (todoList) {
      todoList.fetchCategories(); // Refresh categories sidebar
      todoList.fetchTodos();
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.addEventListener('todo-created', (e) => this.handleTodoCreated(e));
    this.addEventListener('todo-create-error', (e) => this.handleTodoCreateError(e));
  }

  /**
   * Render the component
   */
  render() {
    this.innerHTML = `
      <div class="todo-page">
        <!-- Page Header -->
        <div class="page-header" style="margin-bottom: 2rem;">
          <h1 style="
            font-size: 2rem;
            font-weight: 700;
            color: #111827;
            margin: 0 0 0.5rem 0;
          ">Manage Your Todos</h1>
          <p style="
            font-size: 1rem;
            color: #6b7280;
            margin: 0;
          ">Create, organize, and track your tasks efficiently.</p>
        </div>

        <!-- Todo Form -->
        <div style="margin-bottom: 2rem;">
          <todo-form></todo-form>
        </div>

        <!-- Todo List -->
        <div>
          <todo-list></todo-list>
        </div>
      </div>
    `;

    // Listen for manage-categories events from todo-list
    const todoList = this.querySelector('todo-list');
    if (todoList) {
      todoList.addEventListener('manage-categories', () => this.handleManageCategories());
    }
  }
}

// Register custom element
customElements.define('todo-page', TodoPage);
