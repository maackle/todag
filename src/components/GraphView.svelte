<script>
  import { onMount } from "svelte";
  import dagre from "dagre";
  import { todos, dag, todoActions, dagActions } from "../lib/store.js";
  import TodoCard from "./TodoCard.svelte";

  let arrowDrawing = null;
  let svgElement;
  let containerElement;
  let cardPositions = new Map();
  let isDrawingArrow = false;
  let selectedEdge = null; // [fromId, toId] or null
  let hoveredEdge = null; // [fromId, toId] or null
  let graphLayout = new Map(); // nodeId -> { x, y, width, height }
  let edgePaths = new Map(); // [fromId, toId] -> path string
  let actualCardHeights = new Map(); // nodeId -> actual height in pixels

  $: todoList = $todos;
  $: dagInstance = $dag;
  $: edges = dagInstance ? dagInstance.getAllEdges() : [];

  // Calculate layout using dagre
  function calculateLayout(dagInst, todos, measuredHeights) {
    if (!dagInst || !todos || todos.length === 0) {
      return { positions: new Map(), edgePaths: new Map() };
    }

    // Create a new dagre graph
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: "TB", // Top to bottom
      nodesep: 50, // Horizontal spacing between nodes
      ranksep: 100, // Vertical spacing between ranks
      marginx: 50,
      marginy: 50,
    });

    // Add nodes to the graph
    // Cards will expand up to 333px, so use that as the width for layout
    const cardWidth = 333;
    const defaultCardHeight = 80;

    todos.forEach((todo) => {
      // Use measured height if available, otherwise use default
      const cardHeight = measuredHeights?.get(todo.id) || defaultCardHeight;
      g.setNode(todo.id, {
        width: cardWidth,
        height: cardHeight,
        label: todo.id, // dagre needs a label
      });
    });

    // Add edges to the graph
    const dagEdges = dagInst.getAllEdges();
    dagEdges.forEach(([fromId, toId]) => {
      g.setEdge(fromId, toId);
    });

    // Run dagre layout
    dagre.layout(g);

    // Extract positions from dagre
    const positions = new Map();
    g.nodes().forEach((nodeId) => {
      const node = g.node(nodeId);
      positions.set(nodeId, {
        x: node.x - node.width / 2, // dagre gives center x, we need top-left
        y: node.y - node.height / 2, // dagre gives center y, we need top-left
        width: node.width,
        height: node.height,
        centerX: node.x,
        centerY: node.y,
      });
    });

    // Extract edge paths from dagre
    const paths = new Map();
    g.edges().forEach((edge) => {
      const edgeData = g.edge(edge);
      if (edgeData && edgeData.points && edgeData.points.length > 0) {
        // Use dagre's calculated edge points for smooth curves
        let path = `M ${edgeData.points[0].x} ${edgeData.points[0].y}`;
        for (let i = 1; i < edgeData.points.length; i++) {
          path += ` L ${edgeData.points[i].x} ${edgeData.points[i].y}`;
        }
        paths.set([edge.v, edge.w].join("->"), path);
      } else {
        // Fallback to straight line
        const fromPos = positions.get(edge.v);
        const toPos = positions.get(edge.w);
        if (fromPos && toPos) {
          const fromX = fromPos.centerX || fromPos.x + fromPos.width / 2;
          const fromY = fromPos.y + fromPos.height;
          const toX = toPos.centerX || toPos.x + toPos.width / 2;
          const toY = toPos.y;
          paths.set(
            [edge.v, edge.w].join("->"),
            `M ${fromX} ${fromY} L ${toX} ${toY}`,
          );
        }
      }
    });

    return { positions, edgePaths: paths };
  }

  // Recalculate edge paths function
  function recalculateEdgePaths() {
    if (graphLayout.size === 0 || edges.length === 0) return;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: "TB",
      nodesep: 50,
      ranksep: 100,
      marginx: 50,
      marginy: 50,
    });

    const cardWidth = 333;
    todoList.forEach((todo) => {
      const pos = graphLayout.get(todo.id);
      if (pos) {
        const cardHeight = actualCardHeights.get(todo.id) || pos.height || 80;
        g.setNode(todo.id, {
          width: cardWidth,
          height: cardHeight,
          label: todo.id,
        });
      }
    });

    edges.forEach(([fromId, toId]) => {
      g.setEdge(fromId, toId);
    });

    dagre.layout(g);

    // Update edge paths
    const newPaths = new Map();
    g.edges().forEach((edge) => {
      const edgeData = g.edge(edge);
      if (edgeData && edgeData.points && edgeData.points.length > 0) {
        let path = `M ${edgeData.points[0].x} ${edgeData.points[0].y}`;
        for (let i = 1; i < edgeData.points.length; i++) {
          path += ` L ${edgeData.points[i].x} ${edgeData.points[i].y}`;
        }
        newPaths.set([edge.v, edge.w].join("->"), path);
      } else {
        const fromPos = graphLayout.get(edge.v);
        const toPos = graphLayout.get(edge.w);
        if (fromPos && toPos) {
          const fromX = fromPos.centerX || fromPos.x + fromPos.width / 2;
          const fromY = fromPos.y + fromPos.height;
          const toX = toPos.centerX || toPos.x + toPos.width / 2;
          const toY = toPos.y;
          newPaths.set(
            [edge.v, edge.w].join("->"),
            `M ${fromX} ${fromY} L ${toX} ${toY}`,
          );
        }
      }
    });
    edgePaths = new Map(newPaths);
  }

  // Get edge path from stored paths
  function getEdgePath(fromId, toId) {
    const key = [fromId, toId].join("->");
    const path = edgePaths.get(key);
    if (path) return path;

    // Fallback to simple path
    const fromPos = graphLayout.get(fromId);
    const toPos = graphLayout.get(toId);
    if (!fromPos || !toPos) return "";

    const fromX = fromPos.centerX || fromPos.x + fromPos.width / 2;
    const fromY = fromPos.y + fromPos.height;
    const toX = toPos.centerX || toPos.x + toPos.width / 2;
    const toY = toPos.y;
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  }

  // Measure actual card heights
  function measureCardHeights() {
    if (!containerElement) return new Map();
    const heights = new Map();
    todoList.forEach((todo) => {
      const element = containerElement.querySelector(
        `[data-todo-id="${todo.id}"] .card-inner .todo-card`,
      );
      if (element) {
        const rect = element.getBoundingClientRect();
        heights.set(todo.id, Math.max(80, rect.height));
      }
    });
    return heights;
  }

  // Recalculate layout when heights change
  $: if (dagInstance && todoList) {
    // First pass: use default heights
    const result = calculateLayout(dagInstance, todoList, actualCardHeights);
    graphLayout = new Map(result.positions);
    edgePaths = new Map(result.edgePaths);

    // Then measure actual heights and recalculate
    setTimeout(() => {
      const newHeights = measureCardHeights();
      if (
        Array.from(newHeights.entries()).some(
          ([id, height]) => actualCardHeights.get(id) !== height,
        )
      ) {
        actualCardHeights = new Map(newHeights);
        const updatedResult = calculateLayout(
          dagInstance,
          todoList,
          actualCardHeights,
        );
        graphLayout = new Map(updatedResult.positions);
        edgePaths = new Map(updatedResult.edgePaths);
        // Recalculate edge paths with new layout
        recalculateEdgePaths();
      }
    }, 50);
  }

  // Force edge path recalculation when layout or heights change
  // Create a reactive key that changes when layout updates
  $: layoutKey = JSON.stringify(
    Array.from(graphLayout.entries()).map(([id, pos]) => [
      id,
      pos.x,
      pos.y,
      pos.height,
    ]),
  );
  $: heightsKey = JSON.stringify(Array.from(actualCardHeights.entries()));

  // Recalculate edges when layout or heights change
  $: if (graphLayout.size > 0 && edges.length > 0) {
    // Access layoutKey and heightsKey to make them dependencies
    void layoutKey;
    void heightsKey;
    recalculateEdgePaths();
  }

  // Update SVG size based on layout
  $: if (graphLayout.size > 0) {
    const maxX = Math.max(
      ...Array.from(graphLayout.values()).map((p) => p.x + p.width),
    );
    const maxY = Math.max(
      ...Array.from(graphLayout.values()).map((p) => p.y + p.height),
    );
    if (svgElement) {
      svgElement.setAttribute("width", Math.max(800, maxX + 100));
      svgElement.setAttribute("height", Math.max(600, maxY + 100));
    }
  }

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
    if (
      arrowDrawing &&
      arrowDrawing.targetId &&
      arrowDrawing.fromId !== arrowDrawing.targetId
    ) {
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
    if ((e.key === "Backspace" || e.key === "Delete") && selectedEdge) {
      e.preventDefault();
      handleEdgeDelete();
    }
  }

  function getSimpleArrowPath(fromX, fromY, toX, toY) {
    const midY = (fromY + toY) / 2;
    return `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`;
  }

  onMount(() => {
    // Initial layout calculation
    if (dagInstance && todoList) {
      const result = calculateLayout(dagInstance, todoList, actualCardHeights);
      graphLayout = result.positions;
      edgePaths = result.edgePaths;

      // Measure heights after initial render
      setTimeout(() => {
        actualCardHeights = measureCardHeights();
        const updatedResult = calculateLayout(
          dagInstance,
          todoList,
          actualCardHeights,
        );
        graphLayout = updatedResult.positions;
        edgePaths = updatedResult.edgePaths;
      }, 100);
    }
  });

  // Watch for text changes to remeasure heights
  let heightCheckTimeout;
  $: if (todoList.length > 0 && containerElement) {
    // Debounce height measurement
    if (heightCheckTimeout) clearTimeout(heightCheckTimeout);
    heightCheckTimeout = setTimeout(() => {
      const newHeights = measureCardHeights();
      if (
        Array.from(newHeights.entries()).some(
          ([id, height]) => actualCardHeights.get(id) !== height,
        )
      ) {
        actualCardHeights = new Map(newHeights);
        if (dagInstance) {
          const updatedResult = calculateLayout(
            dagInstance,
            todoList,
            actualCardHeights,
          );
          graphLayout = new Map(updatedResult.positions);
          edgePaths = new Map(updatedResult.edgePaths);
          // Recalculate edge paths with new layout
          recalculateEdgePaths();
        }
      }
    }, 150);
  }

  // Watch todo text changes to trigger remeasurement and edge updates
  $: if (todoList.length > 0) {
    // Create a key from todo texts to detect changes
    const textKey = todoList.map((t) => `${t.id}:${t.text.length}`).join(",");
    void textKey; // Make it a dependency to trigger height remeasurement
  }
</script>

<svelte:window
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:keydown={handleKeyDown}
/>

<div
  class="graph-view"
  bind:this={containerElement}
  on:click={() => (selectedEdge = null)}
  role="application"
>
  <svg class="graph-svg" bind:this={svgElement}>
    <!-- Render all dependency arrows -->
    {#each edges as [fromId, toId]}
      {@const fromPos = graphLayout.get(fromId)}
      {@const toPos = graphLayout.get(toId)}
      {@const isSelected =
        selectedEdge && selectedEdge[0] === fromId && selectedEdge[1] === toId}
      {@const isHovered =
        hoveredEdge && hoveredEdge[0] === fromId && hoveredEdge[1] === toId}
      {#if fromPos && toPos}
        {@const path = getEdgePath(fromId, toId)}
        <path
          d={path}
          stroke={isSelected ? "#ff6b6b" : "#4a90e2"}
          stroke-width="12"
          fill="none"
          opacity={isSelected && isHovered ? "1" : isSelected ? "0.8" : "0.7"}
          marker-end={isSelected
            ? "url(#arrowhead-selected)"
            : "url(#arrowhead)"}
          style="cursor: pointer; pointer-events: stroke;"
          on:click={() => {
            if (isSelected) {
              handleEdgeSelect(null);
            } else {
              handleEdgeSelect([fromId, toId]);
            }
          }}
          on:mouseenter={() => (hoveredEdge = [fromId, toId])}
          on:mouseleave={() => (hoveredEdge = null)}
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
        d={getSimpleArrowPath(startX, startY, endX, endY)}
        stroke="#4a90e2"
        stroke-width="2"
        stroke-dasharray="5,5"
        fill="none"
        opacity="0.7"
        style="pointer-events: none;"
      />
    {/if}

    <!-- Arrow head marker definition 
    <defs>
      <marker
        id="arrowhead"
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="1.5"
        orient="auto"
      >
        <polygon points="0 0, 6 1.5, 0 3" fill="#4a90e2" opacity="0.7" />
      </marker>
      <marker
        id="arrowhead-selected"
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="1.5"
        orient="auto"
      >
        <polygon points="0 0, 6 1.5, 0 3" fill="#ff6b6b" opacity="0.8" />
      </marker>
    </defs>
        -->
  </svg>

  <div class="cards-container">
    {#each todoList as todo (todo.id)}
      {@const pos = graphLayout.get(todo.id)}
      {#if pos}
        <div
          class="card-wrapper"
          data-todo-id={todo.id}
          style="left: {pos.x}px; top: {pos.y}px;"
        >
          <div class="card-inner">
            <TodoCard
              {todo}
              {isDrawingArrow}
              useTextarea={true}
              dependencies={dagInstance.getDependencies(todo.id)}
              dependents={dagInstance.getDependents(todo.id)}
              on:arrowStart={handleArrowStart}
              on:arrowTarget={handleArrowTarget}
              on:toggle={({ detail }) => todoActions.toggleComplete(detail.id)}
              on:update={({ detail }) =>
                todoActions.update(detail.id, { text: detail.text })}
              on:delete={({ detail }) => todoActions.remove(detail.id)}
            />
          </div>
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
    padding-left: 64px;
  }

  @media (max-width: 768px) {
    .graph-view {
      padding-left: 64px;
      padding-right: 15px;
    }
  }

  .graph-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }

  .graph-svg path {
    pointer-events: stroke;
  }

  .cards-container {
    position: relative;
    z-index: 2;
    min-height: 100%;
    pointer-events: none;
  }

  .card-wrapper {
    position: absolute;
    pointer-events: auto;
    min-width: 200px;
    max-width: 333px;
    width: fit-content;
  }

  @media (min-width: 768px) {
    .card-wrapper {
      min-width: 250px;
    }
  }

  .card-inner {
    width: 100%;
    box-sizing: border-box;
    overflow: visible;
  }

  .card-inner :global(.todo-card) {
    margin-bottom: 0;
    width: fit-content;
    min-width: 250px;
    max-width: 333px;
    box-sizing: border-box;
    overflow: visible;
    height: auto;
  }

  .card-inner :global(.card-content) {
    flex-wrap: nowrap;
    min-width: 0;
    align-items: center;
  }

  .card-inner :global(.todo-text) {
    min-width: 100px;
    width: auto;
    max-width: calc(
      333px - 120px
    ); /* 333px card - arrow zone - checkbox - delete - gaps */
    flex: 0 1 auto;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    line-height: 1.4;
    overflow: hidden;
    resize: none;
  }

  /* Auto-resize textarea to fit content */
  .card-inner :global(textarea.todo-text) {
    height: auto;
    min-height: 1.4em;
    max-height: 200px;
  }

  .card-inner :global(.delete-btn) {
    flex-shrink: 0;
  }
</style>
