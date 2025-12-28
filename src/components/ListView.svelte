<script>
    import { onMount } from "svelte";
    import { todos, dag, todoActions, dagActions } from "../lib/store.js";
    import TodoCard from "./TodoCard.svelte";
    import ArrowRenderer from "./ArrowRenderer.svelte";

    let draggedTodoId = null;
    let dragOverIndex = null;
    let arrowDrawing = null; // { fromId, startX, startY, targetId, currentX, currentY }
    let hoveredCardId = null;
    let isDrawingArrow = false;
    let selectedEdge = null; // [fromId, toId] or null
    let touchDragState = null; // { todoId, startY, currentY, startIndex }

    // Make this reactive to both todos and dag changes
    // The sorted order should respect the current list order when possible
    // Only reorder when necessary to enforce DAG constraints (all arrows point down)
    // IMPORTANT: When deleting arrows, we remove constraints, so current order remains valid
    $: sortedTodos = (() => {
        const todoList = $todos;
        const dagInstance = $dag;
        const edges = dagInstance.getAllEdges();

        // If there are no dependencies, just return todos in their current order
        if (edges.length === 0) {
            return [...todoList];
        }

        // Check if current order violates any dependencies
        // When deleting an arrow, we remove a constraint, so if the order was valid before,
        // it will still be valid after (or even more valid)
        const currentOrder = todoList.map((t) => t.id);
        let needsReorder = false;

        for (const [fromId, toId] of edges) {
            const fromIndex = currentOrder.indexOf(fromId);
            const toIndex = currentOrder.indexOf(toId);
            // If arrow points upward (from lower to upper), we need to reorder
            if (fromIndex > toIndex) {
                needsReorder = true;
                break;
            }
        }

        // If current order is valid (doesn't violate any constraints), keep it
        // This preserves order when deleting arrows (removing constraints)
        if (!needsReorder) {
            return [...todoList];
        }

        // Otherwise, use topological sort to enforce DAG constraints
        const sortedIds = dagInstance.topologicalSort();
        const todoMap = new Map(todoList.map((t) => [t.id, t]));
        const sorted = sortedIds.map((id) => todoMap.get(id)).filter(Boolean);
        const unconnected = todoList.filter(
            (t) => !dagInstance.nodes.has(t.id),
        );

        return [...sorted, ...unconnected];
    })();

    $: edges = $dag.getAllEdges();

    function handleDragStart(e, todoId) {
        if (isDrawingArrow) return;
        draggedTodoId = todoId;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", todoId);
        }
    }

    function handleTouchStart(e, todoId, index) {
        if (isDrawingArrow) return;
        if (e.touches && e.touches.length === 1) {
            touchDragState = {
                todoId,
                startY: e.touches[0].clientY,
                currentY: e.touches[0].clientY,
                startIndex: index,
            };
            draggedTodoId = todoId;
        }
    }

    function handleCardDragStart(e) {
        // This is called from the drag handle in TodoCard
        if (isDrawingArrow) return;
        const todoId =
            e.currentTarget?.closest("[data-todo-id]")?.dataset?.todoId;
        if (todoId) {
            const index = sortedTodos.findIndex((t) => t.id === todoId);
            if (index !== -1 && e.touches && e.touches.length === 1) {
                touchDragState = {
                    todoId,
                    startY: e.touches[0].clientY,
                    currentY: e.touches[0].clientY,
                    startIndex: index,
                };
                draggedTodoId = todoId;
            }
        }
    }

    function handleTouchMoveDrag(e) {
        if (touchDragState && e.touches && e.touches.length === 1) {
            touchDragState.currentY = e.touches[0].clientY;

            // Find the card we're over
            if (listContainer) {
                const cards = listContainer.querySelectorAll(".todo-wrapper");
                let targetIndex = touchDragState.startIndex;

                cards.forEach((card, idx) => {
                    const rect = card.getBoundingClientRect();
                    const cardCenterY = rect.top + rect.height / 2;
                    if (
                        touchDragState.currentY < cardCenterY &&
                        idx < touchDragState.startIndex
                    ) {
                        targetIndex = idx;
                    } else if (
                        touchDragState.currentY > cardCenterY &&
                        idx > touchDragState.startIndex
                    ) {
                        targetIndex = idx + 1;
                    }
                });

                if (targetIndex !== dragOverIndex) {
                    dragOverIndex = targetIndex;
                }
            }
        }
    }

    function handleTouchEndDrag() {
        if (touchDragState) {
            const dropIndex =
                dragOverIndex !== null
                    ? dragOverIndex
                    : touchDragState.startIndex;
            if (dropIndex !== touchDragState.startIndex) {
                // Perform the drop
                const sortedOrder = sortedTodos.map((t) => t.id);
                const draggedIndex = sortedOrder.indexOf(touchDragState.todoId);

                if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
                    if (
                        $dag.canMoveTo(
                            touchDragState.todoId,
                            dropIndex,
                            sortedOrder,
                        )
                    ) {
                        const newSortedOrder = [...sortedTodos];
                        const [draggedItem] = newSortedOrder.splice(
                            draggedIndex,
                            1,
                        );
                        newSortedOrder.splice(dropIndex, 0, draggedItem);

                        todos.update((items) => {
                            const itemMap = new Map(
                                items.map((t) => [t.id, t]),
                            );
                            const reordered = newSortedOrder
                                .map((t) => itemMap.get(t.id))
                                .filter(Boolean);
                            return reordered;
                        });
                    }
                }
            }
            touchDragState = null;
            dragOverIndex = null;
            draggedTodoId = null;
        }
    }

    function handleDragOver(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        dragOverIndex = index;
    }

    function handleDragLeave() {
        dragOverIndex = null;
    }

    function handleDrop(e, dropIndex) {
        e.preventDefault();
        if (!draggedTodoId) return;

        // dropIndex is relative to sortedTodos (the displayed order)
        const sortedOrder = sortedTodos.map((t) => t.id);
        const draggedIndex = sortedOrder.indexOf(draggedTodoId);

        if (draggedIndex === -1 || draggedIndex === dropIndex) {
            dragOverIndex = null;
            draggedTodoId = null;
            return;
        }

        // Check if the move is valid according to DAG constraints
        if ($dag.canMoveTo(draggedTodoId, dropIndex, sortedOrder)) {
            // Reorder based on the sorted order (which is what's displayed)
            const newSortedOrder = [...sortedTodos];
            const [draggedItem] = newSortedOrder.splice(draggedIndex, 1);
            newSortedOrder.splice(dropIndex, 0, draggedItem);

            // Update todos to match the new sorted order
            // This preserves the new order while respecting DAG constraints
            todos.update((items) => {
                const itemMap = new Map(items.map((t) => [t.id, t]));
                const reordered = newSortedOrder
                    .map((t) => itemMap.get(t.id))
                    .filter(Boolean);
                return reordered;
            });
        }

        dragOverIndex = null;
        draggedTodoId = null;
    }

    function handleArrowStart(e) {
        if (!listContainer) return;
        // Stop any drag operation when starting arrow
        draggedTodoId = null;
        dragOverIndex = null;
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
        if (
            arrowDrawing &&
            arrowDrawing.targetId &&
            arrowDrawing.fromId !== arrowDrawing.targetId
        ) {
            const fromId = arrowDrawing.fromId;
            const toId = arrowDrawing.targetId;

            // Check if adding this dependency would require reordering
            const currentTodos = $todos;
            const fromIndex = currentTodos.findIndex((t) => t.id === fromId);
            const toIndex = currentTodos.findIndex((t) => t.id === toId);

            // If arrow points upward (from lower to upper), we need to reorder
            // The source should be directly above the target
            if (fromIndex > toIndex) {
                // Arrow points upward - reorder so fromId is directly above toId
                const newTodos = [...currentTodos];
                const [fromItem] = newTodos.splice(fromIndex, 1);
                // Insert directly before toId (toId is at toIndex, so insert at toIndex)
                newTodos.splice(toIndex, 0, fromItem);
                todos.update(() => newTodos);
            }

            // Add the dependency (this will be validated for cycles)
            dagActions.addDependency(fromId, toId);
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

    function handleTouchMove(e) {
        e.preventDefault(); // Prevent scrolling during touch interactions
        if (
            arrowDrawing &&
            listContainer &&
            e.touches &&
            e.touches.length === 1
        ) {
            const containerRect = listContainer.getBoundingClientRect();
            arrowDrawing.currentX = e.touches[0].clientX - containerRect.left;
            arrowDrawing.currentY = e.touches[0].clientY - containerRect.top;

            // Check which card we're over during arrow drawing
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const elementBelow = document.elementFromPoint(touchX, touchY);
            const cardElement = elementBelow?.closest("[data-todo-id]");
            if (cardElement) {
                const targetId = cardElement.dataset.todoId;
                if (targetId && arrowDrawing.fromId !== targetId) {
                    arrowDrawing.targetId = targetId;
                } else {
                    arrowDrawing.targetId = null;
                }
            } else {
                arrowDrawing.targetId = null;
            }
        }
        if (touchDragState && e.touches && e.touches.length === 1) {
            handleTouchMoveDrag(e);
        }
    }

    function handleMouseUp() {
        if (arrowDrawing) {
            handleArrowEnd();
        }
    }

    function handleTouchEnd(e) {
        if (arrowDrawing) {
            handleArrowEnd();
        }
        if (touchDragState) {
            handleTouchEndDrag();
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

    let listContainer;
    let cardPositions = new Map();
    let positionUpdateInterval;

    function updateCardPositions() {
        if (!listContainer) return;
        const newPositions = new Map();
        sortedTodos.forEach((todo) => {
            const element = listContainer.querySelector(
                `[data-todo-id="${todo.id}"]`,
            );
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

<svelte:window
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:keydown={handleKeyDown}
/>

<div
    class="list-view"
    on:mouseup={handleMouseUp}
    on:touchend={handleTouchEnd}
    on:click={() => (selectedEdge = null)}
    bind:this={listContainer}
    role="application"
    style="touch-action: pan-y;"
>
    <div class="todo-list">
        {#each sortedTodos as todo, index (todo.id)}
            <div
                class="todo-wrapper"
                class:drag-over={dragOverIndex === index}
                draggable="true"
                data-todo-id={todo.id}
                role="listitem"
                on:dragstart|stopPropagation={(e) => {
                    if (isDrawingArrow) {
                        e.preventDefault();
                        return;
                    }
                    handleDragStart(e, todo.id);
                }}
                on:dragover|stopPropagation={(e) => {
                    if (!isDrawingArrow) {
                        handleDragOver(e, index);
                    }
                }}
                on:dragleave={handleDragLeave}
                on:drop|stopPropagation={(e) => {
                    if (!isDrawingArrow) {
                        handleDrop(e, index);
                    }
                }}
            >
                <TodoCard
                    {todo}
                    isDragging={draggedTodoId === todo.id}
                    isDragTarget={dragOverIndex === index}
                    {isDrawingArrow}
                    isHovered={hoveredCardId === todo.id}
                    dependencies={$dag.getDependencies(todo.id)}
                    dependents={$dag.getDependents(todo.id)}
                    onDragStart={handleCardDragStart}
                    on:arrowStart={handleArrowStart}
                    on:arrowTarget={handleArrowTarget}
                    on:mouseenter={() => (hoveredCardId = todo.id)}
                    on:mouseleave={() => (hoveredCardId = null)}
                    on:toggle={({ detail }) =>
                        todoActions.toggleComplete(detail.id)}
                    on:update={({ detail }) =>
                        todoActions.update(detail.id, { text: detail.text })}
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
        {selectedEdge}
        {hoveredCardId}
        onEdgeSelect={handleEdgeSelect}
        onEdgeDelete={handleEdgeDelete}
    />
</div>

<style>
    .list-view {
        position: relative;
        padding: 20px 20px 20px 64px;
        max-width: 800px;
        margin: 0 auto;
        background: #1a1a1a;
        overflow-x: auto;
    }

    @media (max-width: 768px) {
        .list-view {
            padding: 15px 15px 15px 64px;
            max-width: 100%;
        }
    }

    .todo-list {
        position: relative;
        z-index: 2;
    }

    .todo-wrapper {
        position: relative;
    }

    .todo-wrapper.drag-over::before {
        content: "";
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
