<script>
    import { onMount } from "svelte";

    export let edges = [];
    export let sortedTodos = [];
    export let arrowDrawing = null;
    export let cardPositions = new Map();
    export let selectedEdge = null; // [fromId, toId] or null
    export let onEdgeSelect = null; // callback
    export let onEdgeDelete = null; // callback

    let svgElement;
    let containerElement;
    let hoveredEdge = null; // [fromId, toId] or null

    $: arrowPaths = calculateArrowPaths(edges, cardPositions);

    function calculateArrowPaths(edgeList, positions) {
        const paths = [];

        if (!positions || positions.size === 0) {
            console.log("ArrowRenderer: No card positions available", {
                edges: edgeList.length,
                positions: positions?.size || 0,
            });
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
        const pow = 0.8;
        // Create a smooth bezier curve that extends 16px to the left of the cards
        const vFactor = Math.pow(Math.abs(fromY - toY) / 100, pow);
        const arcLeft = Math.min(fromX, toX) - 64 * vFactor; // 32px to the left of the leftmost card
        const midY = (fromY + toY) / 2;

        // Use a quadratic bezier curve (Q) with control point at the arc position
        // This creates a smooth curve: start -> control point (arc) -> end
        return `M ${fromX} ${fromY} Q ${arcLeft} ${midY} ${toX} ${toY}`;
    }

    // Use a reactive statement to update positions when cardPositions prop changes
    // The parent component (ListView) is responsible for updating cardPositions
</script>

<div class="arrow-container" bind:this={containerElement}>
    <svg class="arrow-svg" bind:this={svgElement} style="overflow: visible;">
        <!-- Render all dependency arrows -->
        {#each arrowPaths as path (path.fromId + "-" + path.toId)}
            {@const isSelected =
                selectedEdge &&
                selectedEdge[0] === path.fromId &&
                selectedEdge[1] === path.toId}
            {@const isHovered =
                hoveredEdge &&
                hoveredEdge[0] === path.fromId &&
                hoveredEdge[1] === path.toId}
            <g class="arrow-group" class:selected={isSelected}>
                <path
                    d={getArrowPath(path.fromX, path.fromY, path.toX, path.toY)}
                    stroke={isSelected ? "#ff6b6b" : "#4a90e2"}
                    stroke-width="12"
                    fill="none"
                    opacity={isHovered || isSelected ? "1" : "0.5"}
                    marker-end={isSelected
                        ? "url(#arrowhead-selected)"
                        : "url(#arrowhead)"}
                    style="cursor: pointer;"
                    on:click|stopPropagation={() => {
                        if (isSelected) {
                            // Deselect if already selected
                            onEdgeSelect && onEdgeSelect(null);
                        } else {
                            // Select if not selected
                            onEdgeSelect &&
                                onEdgeSelect([path.fromId, path.toId]);
                        }
                    }}
                    on:mouseenter={() =>
                        (hoveredEdge = [path.fromId, path.toId])}
                    on:mouseleave={() => (hoveredEdge = null)}
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
                <polygon
                    points="0 0, 6 1.5, 0 3"
                    fill="#4a90e2"
                    opacity="0.5"
                />
            </marker>
            <marker
                id="arrowhead-selected"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="1.5"
                orient="auto"
            >
                <polygon
                    points="0 0, 6 1.5, 0 3"
                    fill="#ff6b6b"
                    opacity="0.8"
                />
            </marker>
        </defs>
        -->
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
    }

    .arrow-group {
        pointer-events: none;
    }

    .arrow-group.selected path {
        pointer-events: auto;
    }

    .arrow-group path {
        pointer-events: auto;
    }
</style>
