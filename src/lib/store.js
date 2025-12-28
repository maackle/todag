/**
 * Store for managing todos and the DAG
 * Designed to be easily replaceable with a backend later
 */

import { writable, get } from 'svelte/store';
import { DAG } from './dag.js';

const STORAGE_KEY_TODOS = 'todag-todos';
const STORAGE_KEY_DAG = 'todag-dag';
const STORAGE_KEY_VIEWMODE = 'todag-viewmode';
const STORAGE_KEY_NEXTID = 'todag-nextid';

// Create a unique ID generator
let nextId = 1;
function generateId() {
    return `todo-${nextId++}`;
}

// Load nextId from localStorage
function loadNextId() {
    const stored = localStorage.getItem(STORAGE_KEY_NEXTID);
    if (stored) {
        nextId = parseInt(stored, 10);
    }
}

// Save nextId to localStorage
function saveNextId() {
    localStorage.setItem(STORAGE_KEY_NEXTID, nextId.toString());
}

// Serialize DAG to JSON
function serializeDAG(dagInstance) {
    const edges = [];
    for (const [toId, deps] of dagInstance.edges.entries()) {
        for (const fromId of deps) {
            edges.push([fromId, toId]);
        }
    }
    return {
        nodes: Array.from(dagInstance.nodes),
        edges: edges
    };
}

// Deserialize DAG from JSON
function deserializeDAG(data) {
    const dagInstance = new DAG();
    // Add all nodes
    if (data.nodes) {
        data.nodes.forEach(nodeId => dagInstance.addNode(nodeId));
    }
    // Add all edges
    if (data.edges) {
        data.edges.forEach(([fromId, toId]) => {
            dagInstance.addEdge(fromId, toId);
        });
    }
    return dagInstance;
}

// Load state from localStorage
function loadState() {
    try {
        // Load todos
        const todosData = localStorage.getItem(STORAGE_KEY_TODOS);
        const loadedTodos = todosData ? JSON.parse(todosData) : [];

        // Load DAG
        const dagData = localStorage.getItem(STORAGE_KEY_DAG);
        const loadedDAG = dagData ? deserializeDAG(JSON.parse(dagData)) : new DAG();

        // Load viewMode
        const viewModeData = localStorage.getItem(STORAGE_KEY_VIEWMODE);
        const loadedViewMode = viewModeData || 'list';

        // Load nextId
        loadNextId();

        // Update nextId based on loaded todos
        if (loadedTodos.length > 0) {
            const maxId = Math.max(...loadedTodos.map(t => {
                const match = t.id.match(/^todo-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            }));
            if (maxId >= nextId) {
                nextId = maxId + 1;
            }
        }

        return { todos: loadedTodos, dag: loadedDAG, viewMode: loadedViewMode };
    } catch (error) {
        console.error('Error loading state from localStorage:', error);
        return { todos: [], dag: new DAG(), viewMode: 'list' };
    }
}

// Save state to localStorage
function saveState(currentTodos, currentDAG, currentViewMode) {
    try {
        localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(currentTodos));
        localStorage.setItem(STORAGE_KEY_DAG, JSON.stringify(serializeDAG(currentDAG)));
        localStorage.setItem(STORAGE_KEY_VIEWMODE, currentViewMode);
        saveNextId();
    } catch (error) {
        console.error('Error saving state to localStorage:', error);
    }
}

// Load initial state
const initialState = loadState();

// Todo item structure
export function createTodo(text = '') {
    const newTodo = {
        id: generateId(),
        text,
        completed: false,
        createdAt: Date.now(),
    };
    saveNextId();
    return newTodo;
}

// Create stores with initial state
export const todos = writable(initialState.todos);
export const dag = writable(initialState.dag);
export const viewMode = writable(initialState.viewMode);

// Debounce save to avoid excessive localStorage writes
let saveTimeout = null;
function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        const currentTodos = get(todos);
        const currentDAG = get(dag);
        const currentViewMode = get(viewMode);
        saveState(currentTodos, currentDAG, currentViewMode);
    }, 100);
}

// Subscribe to store changes and save to localStorage
todos.subscribe(() => debouncedSave());
dag.subscribe(() => debouncedSave());
viewMode.subscribe(() => debouncedSave());

// Store actions
export const todoActions = {
    add(text) {
        const newTodo = createTodo(text);
        todos.update(items => {
            return [...items, newTodo];
        });
        // Update DAG separately to ensure reactivity
        dag.update(d => {
            d.addNode(newTodo.id);
            return d;
        });
        // Force DAG reactivity by creating a new reference
        dag.update(d => d);
    },

    remove(id) {
        todos.update(items => items.filter(t => t.id !== id));
        dag.update(d => {
            d.removeNode(id);
            return d;
        });
        // Force DAG reactivity
        dag.update(d => d);
    },

    update(id, updates) {
        todos.update(items =>
            items.map(t => (t.id === id ? { ...t, ...updates } : t))
        );
    },

    toggleComplete(id) {
        todos.update(items =>
            items.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
        );
    },

    clearCompleted() {
        todos.update(items => {
            const completedIds = items.filter(t => t.completed).map(t => t.id);
            // Remove completed todos from DAG
            completedIds.forEach(id => {
                dag.update(d => {
                    d.removeNode(id);
                    return d;
                });
            });
            dag.update(d => d);
            return items.filter(t => !t.completed);
        });
    },

    deleteAll() {
        todos.set([]);
        dag.set(new DAG());
    },
};

export const dagActions = {
    addDependency(fromId, toId) {
        dag.update(d => {
            const success = d.addEdge(fromId, toId);
            if (!success) {
                // Check why it failed
                const existingDeps = d.edges.get(toId);
                if (existingDeps && existingDeps.has(fromId)) {
                    console.warn(`Cannot add dependency ${fromId} -> ${toId}: duplicate edge`);
                } else if (d.wouldCreateCycle(fromId, toId)) {
                    console.warn(`Cannot add dependency ${fromId} -> ${toId}: would create cycle`);
                } else {
                    console.warn(`Cannot add dependency ${fromId} -> ${toId}: unknown reason`);
                }
            }
            // Return a new reference to trigger reactivity
            return d;
        });
        // Force reactivity by updating the store again
        dag.update(d => d);
    },

    removeDependency(fromId, toId) {
        dag.update(d => {
            d.removeEdge(fromId, toId);
            return d;
        });
        // Force reactivity by updating the store again
        dag.update(d => d);
    },
};

