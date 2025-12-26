<script>
  import { onMount } from 'svelte';
  import { todos, dag, todoActions, dagActions } from '../lib/store.js';
  import TodoCard from './TodoCard.svelte';
  import ArrowRenderer from './ArrowRenderer.svelte';

  let draggedTodoId = null;
  let dragOverIndex = null;
  let arrowDrawing = null; // { fromId, startX, startY, targetId, currentX, currentY }
  let hoveredCardId = null;
  let isDrawingArrow = false;

  // Make this reactive to both todos and dag changes
  $: sortedTodos = (() => {
    const todoList = $todos;
    const dagInstance = $dag;
    const sortedIds = dagInstance.topologicalSort();
    
    // Create a map for quick lookup
    const todoMap = new Map(todoList.map(t => [t.id, t]));
    
    // Return todos in topological order
    return sortedIds
      .map(id => todoMap.get(id))
      .filter(Boolean)
      .concat(todoList.filter(t => !dagInstance.nodes.has(t.id)));
  })();
  
  $: edges = $dag.getAllEdges();

  function handleDragStart(e, todoId) {
    draggedTodoId = todoId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todoId);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    if (!draggedTodoId) return;

    const currentOrder = sortedTodos.map(t => t.id);
    const draggedIndex = currentOrder.indexOf(draggedTodoId);

    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      dragOverIndex = null;
      draggedTodoId = null;
      return;
    }

    // Check if the move is valid
    if ($dag.canMoveTo(draggedTodoId, dropIndex, currentOrder)) {
      // Get the target position in the sorted order
      const targetId = sortedTodos[dropIndex]?.id;
      if (!targetId) {
        dragOverIndex = null;
        draggedTodoId = null;
        return;
      }
      
      // Reorder based on the sorted order, then update todos to match
      const newSortedOrder = [...sortedTodos];
      const [draggedItem] = newSortedOrder.splice(draggedIndex, 1);
      newSortedOrder.splice(dropIndex, 0, draggedItem);
      
      // Update todos to match the new sorted order
      todos.update(items => {
        // Create a map for quick lookup
        const itemMap = new Map(items.map(t => [t.id, t]));
        // Return items in the new sorted order
        return newSortedOrder.map(t => itemMap.get(t.id)).filter(Boolean);
      });
    }

    dragOverIndex = null;
    draggedTodoId = null;
  }

  function handleArrowStart(e) {
    if (!listContainer) return;
    isDrawingArrow = true;
    const containerRect = listContainer.getBoundingClientRect();
    arrowDrawing = {
      fromId: e.detail.todoId,
      startX: e.detail.x - containerRect.left,
      startY: e.detail.y - containerRect.top,
      targetId: null,
      currentX: e.detail.x - containerRect.left,
      currentY: e.detail.y - containerRect.top,
    };
  }

  function handleArrowTarget(e) {
    if (arrowDrawing) {
      arrowDrawing.targetId = e.detail.todoId;
    }
  }

  function handleArrowEnd() {
    if (arrowDrawing && arrowDrawing.targetId && arrowDrawing.fromId !== arrowDrawing.targetId) {
      dagActions.addDependency(arrowDrawing.fromId, arrowDrawing.targetId);
    }
    arrowDrawing = null;
    isDrawingArrow = false;
  }

  function handleMouseMove(e) {
    if (arrowDrawing && listContainer) {
      const containerRect = listContainer.getBoundingClientRect();
      arrowDrawing.currentX = e.clientX - containerRect.left;
      arrowDrawing.currentY = e.clientY - containerRect.top;
    }
  }

  function handleMouseUp() {
    if (arrowDrawing) {
      handleArrowEnd();
    }
  }

  let listContainer;
  let cardPositions = new Map();
  let positionUpdateInterval;

  function updateCardPositions() {
    if (!listContainer) return;
    const newPositions = new Map();
    sortedTodos.forEach(todo => {
      const element = listContainer.querySelector(`[data-todo-id="${todo.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        const containerRect = listContainer.getBoundingClientRect();
        newPositions.set(todo.id, {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          right: rect.right - containerRect.left,
          bottom: rect.bottom - containerRect.top,
          width: rect.width,
          height: rect.height,
        });
      }
    });
    // Force reactivity by creating a new Map
    cardPositions = new Map(newPositions);
  }

  onMount(() => {
    // Update positions periodically and on changes
    positionUpdateInterval = setInterval(updateCardPositions, 100);
    updateCardPositions();
    
    // Also update on window resize
    const resizeObserver = new ResizeObserver(updateCardPositions);
    if (listContainer) {
      resizeObserver.observe(listContainer);
    }
    
    return () => {
      if (positionUpdateInterval) clearInterval(positionUpdateInterval);
      resizeObserver.disconnect();
    };
  });

  // Update positions when todos or dag changes
  $: if (sortedTodos.length >= 0) {
    // Use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      setTimeout(updateCardPositions, 100);
    });
  }
  
  // Also update when edges change
  $: if (edges.length >= 0) {
    requestAnimationFrame(() => {
      setTimeout(updateCardPositions, 100);
    });
  }
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div class="list-view" on:mouseup={handleMouseUp} bind:this={listContainer} role="application">
  <div class="todo-list">
    {#each sortedTodos as todo, index (todo.id)}
      <div
        class="todo-wrapper"
        class:drag-over={dragOverIndex === index}
        draggable="true"
        data-todo-id={todo.id}
        role="listitem"
        on:dragstart={(e) => handleDragStart(e, todo.id)}
        on:dragover={(e) => handleDragOver(e, index)}
        on:dragleave={handleDragLeave}
        on:drop={(e) => handleDrop(e, index)}
      >
        <TodoCard
          {todo}
          isDragging={draggedTodoId === todo.id}
          isDragTarget={dragOverIndex === index}
          isDrawingArrow={isDrawingArrow}
          dependencies={$dag.getDependencies(todo.id)}
          dependents={$dag.getDependents(todo.id)}
          on:arrowStart={handleArrowStart}
          on:arrowTarget={handleArrowTarget}
          on:toggle={({ detail }) => todoActions.toggleComplete(detail.id)}
          on:update={({ detail }) => todoActions.update(detail.id, { text: detail.text })}
          on:delete={({ detail }) => todoActions.remove(detail.id)}
        />
      </div>
    {/each}
  </div>

  <ArrowRenderer
    {edges}
    {sortedTodos}
    {arrowDrawing}
    {cardPositions}
  />
</div>

<style>
  .list-view {
    position: relative;
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
    background: #1a1a1a;
  }

  .todo-list {
    position: relative;
    z-index: 2;
  }

  .todo-wrapper {
    position: relative;
  }

  .todo-wrapper.drag-over::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -4px;
    height: 4px;
    background: #4a90e2;
    border-radius: 2px;
    z-index: 10;
  }
</style>

