<script>
  import { createEventDispatcher } from 'svelte';

  export let todo;
  export let isDragging = false;
  export let isDragTarget = false;
  export let dependencies = new Set();
  export let dependents = new Set();

  const dispatch = createEventDispatcher();

  export let isDrawingArrow = false;

  let arrowZoneHovered = false;

  function handleArrowZoneMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const arrowStartX = rect.left + rect.width / 2;
    const arrowStartY = rect.top + rect.height / 2;
    dispatch('arrowStart', { todoId: todo.id, x: arrowStartX, y: arrowStartY });
  }

  function handleMouseEnter() {
    if (isDrawingArrow) {
      dispatch('arrowTarget', { todoId: todo.id });
    }
  }

  function handleMouseLeave() {
    if (isDrawingArrow) {
      dispatch('arrowTarget', { todoId: null });
    }
  }
</script>

<div
  class="todo-card"
  class:dragging={isDragging}
  class:drag-target={isDragTarget}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  role="button"
  tabindex="0"
>
  <div
    class="arrow-zone"
    class:hovered={arrowZoneHovered}
    role="button"
    tabindex="0"
    on:mousedown={handleArrowZoneMouseDown}
    on:mouseenter={() => arrowZoneHovered = true}
    on:mouseleave={() => arrowZoneHovered = false}
    title="Click and drag to create dependency"
  >
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="4" fill="currentColor" opacity="0.3" />
      <path d="M 4 8 L 12 8 M 8 4 L 12 8 L 8 12" stroke="currentColor" stroke-width="1.5" fill="none" />
    </svg>
  </div>
  
  <div class="card-content">
    <input
      type="checkbox"
      checked={todo.completed}
      on:change={() => dispatch('toggle', { id: todo.id })}
    />
    <input
      type="text"
      class="todo-text"
      class:completed={todo.completed}
      value={todo.text}
      on:input={(e) => dispatch('update', { id: todo.id, text: e.target.value })}
      placeholder="Enter todo..."
    />
    <button
      class="delete-btn"
      on:click={() => dispatch('delete', { id: todo.id })}
      title="Delete todo"
    >
      ×
    </button>
  </div>
</div>

<style>
  .todo-card {
    display: flex;
    align-items: center;
    background: #2a2a2a;
    border: 2px solid #444;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    transition: all 0.2s;
    position: relative;
    color: #e0e0e0;
  }

  .todo-card:hover {
    border-color: #666;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .todo-card.dragging {
    opacity: 0.5;
    transform: scale(0.95);
  }

  .todo-card.drag-target {
    border-color: #4a90e2;
    background: #1a2a3a;
  }

  .arrow-zone {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    cursor: crosshair;
    color: #888;
    border-radius: 4px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .arrow-zone:hover,
  .arrow-zone.hovered {
    background: #1a2a3a;
    color: #4a90e2;
  }

  .card-content {
    display: flex;
    align-items: center;
    flex: 1;
    gap: 12px;
  }

  .todo-text {
    flex: 1;
    border: none;
    outline: none;
    font-size: 16px;
    padding: 4px 0;
    background: transparent;
    color: #e0e0e0;
  }

  .todo-text.completed {
    text-decoration: line-through;
    color: #888;
  }

  .todo-text::placeholder {
    color: #666;
  }

  .delete-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: #888;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .delete-btn:hover {
    background: #3a1a1a;
    color: #ff4444;
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
</style>

