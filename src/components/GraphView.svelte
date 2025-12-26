<script>
  import { todos, dag, todoActions, dagActions } from '../lib/store.js';
  import TodoCard from './TodoCard.svelte';

  let arrowDrawing = null;
  let svgElement;
  let containerElement;
  let cardPositions = new Map();
  let isDrawingArrow = false;
  let selectedEdge = null; // [fromId, toId] or null

  $: todoList = $todos;
  $: dagInstance = $dag;
  $: edges = dagInstance ? dagInstance.getAllEdges() : [];
  
  function calculateLayout(dagInst, todos) {
    // Simple layered layout algorithm
    if (!dagInst || !todos) return new Map();
    const nodes = Array.from(dagInst.nodes || []);
    if (nodes.length === 0) return new Map();

    // Calculate layers using BFS
    const layers = new Map();
    const inDegree = new Map();
    
    // Initialize in-degrees
    for (const nodeId of nodes) {
      inDegree.set(nodeId, dagInst.getDependencies(nodeId).size);
    }

    // Find nodes with no dependencies (layer 0)
    const queue = [];
    for (const nodeId of nodes) {
      if (inDegree.get(nodeId) === 0) {
        queue.push({ nodeId, layer: 0 });
        layers.set(nodeId, 0);
      }
    }

    // BFS to assign layers
    while (queue.length > 0) {
      const { nodeId, layer } = queue.shift();
      const dependents = dagInst.getDependents(nodeId);
      
      for (const dependent of dependents) {
        const currentLayer = layers.get(dependent) || -1;
        const newLayer = layer + 1;
        if (newLayer > currentLayer) {
          layers.set(dependent, newLayer);
          queue.push({ nodeId: dependent, layer: newLayer });
        }
      }
    }

    // Assign positions within each layer
    const layerGroups = new Map();
    for (const [nodeId, layer] of layers.entries()) {
      if (!layerGroups.has(layer)) {
        layerGroups.set(layer, []);
      }
      layerGroups.get(layer).push(nodeId);
    }

    const positions = new Map();
    const cardWidth = 250;
    const cardHeight = 80;
    const horizontalSpacing = 20;
    const verticalSpacing = 120;
    const startX = 50;
    const startY = 50;

    for (const [layer, nodeIds] of layerGroups.entries()) {
      const layerWidth = nodeIds.length * (cardWidth + horizontalSpacing) - horizontalSpacing;
      const layerStartX = startX + (800 - layerWidth) / 2; // Center the layer

      nodeIds.forEach((nodeId, index) => {
        positions.set(nodeId, {
          x: layerStartX + index * (cardWidth + horizontalSpacing),
          y: startY + layer * verticalSpacing,
          width: cardWidth,
          height: cardHeight,
        });
      });
    }

    // Position nodes not in the DAG
    const unconnectedNodes = todos.filter(t => !dagInst.nodes.has(t.id));
    unconnectedNodes.forEach((todo, index) => {
      positions.set(todo.id, {
        x: startX + index * (cardWidth + horizontalSpacing),
        y: startY + (layerGroups.size || 0) * verticalSpacing,
        width: cardWidth,
        height: cardHeight,
      });
    });

    return positions;
  }

  $: layout = (dagInstance && todoList) ? calculateLayout(dagInstance, todoList) : new Map();

  function handleArrowStart(e) {
    if (!containerElement) return;
    isDrawingArrow = true;
    const containerRect = containerElement.getBoundingClientRect();
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
    if (arrowDrawing && containerElement) {
      const rect = containerElement.getBoundingClientRect();
      arrowDrawing.currentX = e.clientX - rect.left;
      arrowDrawing.currentY = e.clientY - rect.top;
    }
  }

  function handleMouseUp() {
    if (arrowDrawing) {
      handleArrowEnd();
    }
  }

  function handleEdgeSelect(edge) {
    selectedEdge = edge;
  }

  function handleEdgeDelete() {
    if (selectedEdge) {
      dagActions.removeDependency(selectedEdge[0], selectedEdge[1]);
      selectedEdge = null;
    }
  }

  function handleKeyDown(e) {
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedEdge) {
      e.preventDefault();
      handleEdgeDelete();
    }
  }

  function getArrowPath(fromX, fromY, toX, toY) {
    const midY = (fromY + toY) / 2;
    return `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`;
  }

  function updateCardPositions() {
    if (!containerElement) return;
    const newPositions = new Map();
    todoList.forEach(todo => {
      const element = containerElement.querySelector(`[data-todo-id="${todo.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        const containerRect = containerElement.getBoundingClientRect();
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
    cardPositions = newPositions;
  }

  $: if (todoList.length > 0 || layout.size > 0) {
    setTimeout(updateCardPositions, 0);
  }
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} on:keydown={handleKeyDown} />

<div class="graph-view" bind:this={containerElement} on:click={() => selectedEdge = null} role="application">
  <svg class="graph-svg" bind:this={svgElement}>
    <!-- Render all dependency arrows -->
    {#each edges as [fromId, toId]}
      {@const fromPos = layout.get(fromId) || cardPositions.get(fromId)}
      {@const toPos = layout.get(toId) || cardPositions.get(toId)}
      {@const isSelected = selectedEdge && selectedEdge[0] === fromId && selectedEdge[1] === toId}
      {@const isHovered = hoveredEdge && hoveredEdge[0] === fromId && hoveredEdge[1] === toId}
      {#if fromPos && toPos}
        {@const fromX = fromPos.x + (fromPos.width || 0) / 2}
        {@const fromY = (fromPos.bottom || fromPos.y + (fromPos.height || 0))}
        {@const toX = toPos.x + (toPos.width || 0) / 2}
        {@const toY = toPos.top || toPos.y}
        <path
          d={getArrowPath(fromX, fromY, toX, toY)}
          stroke={isSelected ? "#ff6b6b" : "#4a90e2"}
          stroke-width={isSelected ? "3" : "2"}
          fill="none"
          opacity={isSelected && isHovered ? "1" : isSelected ? "0.8" : "1"}
          marker-end={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
          style="cursor: pointer;"
          on:click={() => {
            if (isSelected) {
              // Deselect if already selected
              handleEdgeSelect(null);
            } else {
              // Select if not selected
              handleEdgeSelect([fromId, toId]);
            }
          }}
          on:mouseenter={() => hoveredEdge = [fromId, toId]}
          on:mouseleave={() => hoveredEdge = null}
          on:mousedown|stopPropagation
        />
      {/if}
    {/each}

    <!-- Render arrow being drawn -->
    {#if arrowDrawing && arrowDrawing.currentX !== undefined && arrowDrawing.currentY !== undefined}
      {@const startX = arrowDrawing.startX}
      {@const startY = arrowDrawing.startY}
      {@const endX = arrowDrawing.currentX}
      {@const endY = arrowDrawing.currentY}
      <path
        d={getArrowPath(startX, startY, endX, endY)}
        stroke="#4a90e2"
        stroke-width="2"
        stroke-dasharray="5,5"
        fill="none"
        opacity="0.7"
      />
    {/if}

    <!-- Arrow head marker definition -->
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="3"
        orient="auto"
      >
        <polygon points="0 0, 10 3, 0 6" fill="#4a90e2" />
      </marker>
      <marker
        id="arrowhead-selected"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="3"
        orient="auto"
      >
        <polygon points="0 0, 10 3, 0 6" fill="#ff6b6b" />
      </marker>
    </defs>
  </svg>

  <div class="cards-container">
    {#each todoList as todo (todo.id)}
      {@const pos = layout.get(todo.id)}
      {#if pos}
        <div
          class="card-wrapper"
          data-todo-id={todo.id}
          style="left: {pos.x}px; top: {pos.y}px; width: {pos.width}px;"
        >
          <TodoCard
            {todo}
            {isDrawingArrow}
            dependencies={dagInstance.getDependencies(todo.id)}
            dependents={dagInstance.getDependents(todo.id)}
            on:arrowStart={handleArrowStart}
            on:arrowTarget={handleArrowTarget}
            on:toggle={({ detail }) => todoActions.toggleComplete(detail.id)}
            on:update={({ detail }) => todoActions.update(detail.id, { text: detail.text })}
            on:delete={({ detail }) => todoActions.remove(detail.id)}
          />
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .graph-view {
    position: relative;
    width: 100%;
    min-height: 600px;
    overflow: auto;
    background: #1a1a1a;
  }

  .graph-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }

  .cards-container {
    position: relative;
    z-index: 1;
    min-height: 100%;
  }

  .card-wrapper {
    position: absolute;
  }
</style>

