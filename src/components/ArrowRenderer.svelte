<script>
  import { onMount } from 'svelte';

  export let edges = [];
  export let sortedTodos = [];
  export let arrowDrawing = null;
  export let cardPositions = new Map();

  let svgElement;
  let containerElement;

  $: arrowPaths = calculateArrowPaths(edges, cardPositions);

  function calculateArrowPaths(edgeList, positions) {
    const paths = [];
    
    if (!positions || positions.size === 0) {
      console.log('ArrowRenderer: No card positions available', { edges: edgeList.length, positions: positions?.size || 0 });
      return paths;
    }
    
    if (edgeList.length === 0) {
      return paths;
    }
    
    // Calculate positions for all edges
    for (const [fromId, toId] of edgeList) {
      const fromRect = positions.get(fromId);
      const toRect = positions.get(toId);
      
      if (fromRect && toRect) {
        // Start from left edge (arrow zone), end at left edge of target
        const fromX = fromRect.left; // Left edge where arrow zone is
        const fromY = fromRect.top + fromRect.height / 2; // Middle of card vertically
        const toX = toRect.left; // Left edge of target
        const toY = toRect.top + toRect.height / 2; // Middle of target card
        
        paths.push({
          fromId,
          toId,
          fromX,
          fromY,
          toX,
          toY,
        });
      }
    }
    
    return paths;
  }

  function getArrowPath(fromX, fromY, toX, toY) {
    // Create an angled arrow that extends 16px to the left of the cards
    // Use two line segments: start -> left point -> target
    const arcLeft = Math.min(fromX, toX) - 16; // 16px to the left of the leftmost card
    const midY = (fromY + toY) / 2;
    
    // Path: Start -> extend left 16px -> go to target
    return `M ${fromX} ${fromY} L ${arcLeft} ${midY} L ${toX} ${toY}`;
  }

  function getArrowHeadPath(x, y, direction) {
    const size = 8;
    if (direction === 'down') {
      return `M ${x} ${y} L ${x - size/2} ${y - size} L ${x + size/2} ${y - size} Z`;
    }
    return `M ${x} ${y} L ${x - size} ${y - size/2} L ${x - size} ${y + size/2} Z`;
  }

  // Use a reactive statement to update positions when cardPositions prop changes
  // The parent component (ListView) is responsible for updating cardPositions
</script>

<div class="arrow-container" bind:this={containerElement}>
  <svg class="arrow-svg" bind:this={svgElement} style="overflow: visible;">
    <!-- Render all dependency arrows -->
    {#each arrowPaths as path (path.fromId + '-' + path.toId)}
      <g class="arrow-group">
        <path
          d={getArrowPath(path.fromX, path.fromY, path.toX, path.toY)}
          stroke="#4a90e2"
          stroke-width="2"
          fill="none"
          opacity="0.5"
          marker-end="url(#arrowhead)"
        />
      </g>
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
        <polygon points="0 0, 10 3, 0 6" fill="#4a90e2" opacity="0.5" />
      </marker>
    </defs>
  </svg>
</div>

<style>
  .arrow-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1;
    overflow: visible;
  }

  .arrow-svg {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .arrow-group {
    pointer-events: none;
  }
</style>

