/**
 * Directed Acyclic Graph (DAG) data structure for managing dependencies
 * 
 * The DAG is represented as an adjacency list where:
 * - Each node has a set of dependencies (nodes that must come before it)
 * - edges[u] = Set of nodes that u depends on (u -> v means v blocks u)
 */

export class DAG {
  constructor() {
    // Map from node ID to Set of dependency IDs (nodes that this node depends on)
    this.edges = new Map();
    // Set of all node IDs
    this.nodes = new Set();
  }

  /**
   * Add a node to the DAG
   */
  addNode(nodeId) {
    if (!this.nodes.has(nodeId)) {
      this.nodes.add(nodeId);
      this.edges.set(nodeId, new Set());
    }
  }

  /**
   * Remove a node and all its edges
   */
  removeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    
    this.nodes.delete(nodeId);
    this.edges.delete(nodeId);
    
    // Remove all edges pointing to or from this node
    for (const [id, deps] of this.edges.entries()) {
      deps.delete(nodeId);
    }
  }

  /**
   * Add a dependency edge: fromId -> toId means "fromId blocks toId"
   * Returns true if edge was added, false if it would create a cycle
   */
  addEdge(fromId, toId) {
    if (fromId === toId) return false; // Self-loops not allowed
    
    if (!this.nodes.has(fromId)) this.addNode(fromId);
    if (!this.nodes.has(toId)) this.addNode(toId);
    
    // Check if adding this edge would create a cycle
    if (this.wouldCreateCycle(fromId, toId)) {
      return false;
    }
    
    // Add the edge: toId depends on fromId
    this.edges.get(toId).add(fromId);
    return true;
  }

  /**
   * Remove a dependency edge
   */
  removeEdge(fromId, toId) {
    const deps = this.edges.get(toId);
    if (deps) {
      deps.delete(fromId);
    }
  }

  /**
   * Check if adding an edge would create a cycle
   */
  wouldCreateCycle(fromId, toId) {
    // If toId can reach fromId, adding fromId -> toId would create a cycle
    return this.canReach(toId, fromId);
  }

  /**
   * Check if there's a path from startId to targetId
   */
  canReach(startId, targetId) {
    if (startId === targetId) return true;
    
    const visited = new Set();
    const stack = [startId];
    
    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      
      const deps = this.edges.get(current);
      if (deps) {
        for (const dep of deps) {
          if (dep === targetId) return true;
          if (!visited.has(dep)) {
            stack.push(dep);
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Get all dependencies of a node (nodes that must come before it)
   */
  getDependencies(nodeId) {
    return this.edges.get(nodeId) || new Set();
  }

  /**
   * Get all dependents of a node (nodes that depend on it)
   */
  getDependents(nodeId) {
    const dependents = new Set();
    for (const [id, deps] of this.edges.entries()) {
      if (deps.has(nodeId)) {
        dependents.add(id);
      }
    }
    return dependents;
  }

  /**
   * Get all edges as an array of [fromId, toId] pairs
   */
  getAllEdges() {
    const edges = [];
    for (const [toId, deps] of this.edges.entries()) {
      for (const fromId of deps) {
        edges.push([fromId, toId]);
      }
    }
    return edges;
  }

  /**
   * Topological sort using Kahn's algorithm
   * Returns an array of node IDs in topological order
   */
  topologicalSort() {
    // Calculate in-degrees
    const inDegree = new Map();
    for (const nodeId of this.nodes) {
      inDegree.set(nodeId, 0);
    }
    
    for (const [toId, deps] of this.edges.entries()) {
      for (const fromId of deps) {
        inDegree.set(toId, (inDegree.get(toId) || 0) + 1);
      }
    }
    
    // Find all nodes with no incoming edges
    const queue = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    const result = [];
    while (queue.length > 0) {
      const node = queue.shift();
      result.push(node);
      
      // Remove this node and update in-degrees
      const dependents = this.getDependents(node);
      for (const dependent of dependents) {
        const newDegree = inDegree.get(dependent) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }
    
    // If we didn't process all nodes, there's a cycle (shouldn't happen in a DAG)
    if (result.length !== this.nodes.size) {
      console.warn('Cycle detected in DAG');
      // Return all nodes anyway
      return Array.from(this.nodes);
    }
    
    return result;
  }

  /**
   * Check if a node can be moved to a new position without violating dependencies
   */
  canMoveTo(nodeId, newIndex, currentOrder) {
    const deps = this.getDependencies(nodeId);
    const dependents = this.getDependents(nodeId);
    
    // All dependencies must come before the new position
    for (const dep of deps) {
      const depIndex = currentOrder.indexOf(dep);
      if (depIndex === -1) continue;
      if (depIndex >= newIndex) {
        return false;
      }
    }
    
    // All dependents must come after the new position
    for (const dependent of dependents) {
      const depIndex = currentOrder.indexOf(dependent);
      if (depIndex === -1) continue;
      if (depIndex < newIndex) {
        return false;
      }
    }
    
    return true;
  }
}

