<script>
    import { todos, viewMode, todoActions } from "./lib/store.js";
    import ListView from "./components/ListView.svelte";
    import GraphView from "./components/GraphView.svelte";

    let newTodoText = "";

    function handleAddTodo() {
        if (newTodoText.trim()) {
            todoActions.add(newTodoText.trim());
            newTodoText = "";
        }
    }

    function handleKeyPress(e) {
        if (e.key === "Enter") {
            handleAddTodo();
        }
    }
</script>

<div class="app">
    <header>
        <h1>ToDAG</h1>
        <p class="subtitle">Todo App with Dependency Management</p>
    </header>

    <div class="controls">
        <div class="add-todo">
            <input
                type="text"
                placeholder="Add a new todo..."
                bind:value={newTodoText}
                on:keypress={handleKeyPress}
            />
            <button on:click={handleAddTodo}>Add</button>
        </div>

        <div class="view-toggle">
            <button
                class="toggle-btn"
                class:active={$viewMode === "list"}
                on:click={() => viewMode.set("list")}
            >
                List View
            </button>
            <button
                class="toggle-btn"
                class:active={$viewMode === "graph"}
                on:click={() => viewMode.set("graph")}
            >
                Graph View
            </button>
        </div>
    </div>

    <main>
        {#if $viewMode === "list"}
            <ListView />
        {:else}
            <GraphView />
        {/if}
    </main>
</div>

<style>
    :global(body) {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Oxygen, Ubuntu, Cantarell, sans-serif;
        background: #1a1a1a;
        color: #e0e0e0;
    }

    .app {
        min-height: 100vh;
    }

    header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 2rem;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    h1 {
        margin: 0;
        font-size: 2.5rem;
        font-weight: 700;
    }

    .subtitle {
        margin: 0.5rem 0 0 0;
        opacity: 0.9;
        font-size: 1rem;
    }

    .controls {
        background: #2a2a2a;
        padding: 1.5rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        flex-wrap: wrap;
        gap: 1rem;
    }

    .add-todo {
        display: flex;
        gap: 0.5rem;
        flex: 1;
        min-width: 300px;
    }

    .add-todo input {
        flex: 1;
        padding: 0.75rem 1rem;
        border: 2px solid #444;
        border-radius: 6px;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
        background: #1a1a1a;
        color: #e0e0e0;
    }

    .add-todo input:focus {
        border-color: #667eea;
    }

    .add-todo input::placeholder {
        color: #888;
    }

    .add-todo button {
        padding: 0.75rem 1.5rem;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .add-todo button:hover {
        background: #5568d3;
    }

    .view-toggle {
        display: flex;
        gap: 0.5rem;
    }

    .toggle-btn {
        padding: 0.75rem 1.5rem;
        background: #1a1a1a;
        color: #667eea;
        border: 2px solid #667eea;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .toggle-btn:hover {
        background: #2a2a3a;
    }

    .toggle-btn.active {
        background: #667eea;
        color: white;
    }

    main {
        padding: 2rem 0;
    }
</style>
