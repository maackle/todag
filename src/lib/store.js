/**
 * Store for managing todos and the DAG
 * Designed to be easily replaceable with a backend later
 */

import { writable } from 'svelte/store';
import { DAG } from './dag.js';

// Create a unique ID generator
let nextId = 1;
function generateId() {
  return `todo-${nextId++}`;
}

// Todo item structure
export function createTodo(text = '') {
  return {
    id: generateId(),
    text,
    completed: false,
    createdAt: Date.now(),
  };
}

// Create stores
export const todos = writable([]);
export const dag = writable(new DAG());
export const viewMode = writable('list'); // 'list' or 'graph'

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
};

export const dagActions = {
  addDependency(fromId, toId) {
    dag.update(d => {
      const success = d.addEdge(fromId, toId);
      if (!success) {
        console.warn(`Cannot add dependency ${fromId} -> ${toId}: would create cycle`);
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

