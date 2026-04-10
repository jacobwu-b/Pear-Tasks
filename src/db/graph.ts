import type { DependencyEdge } from '../types';

/** Build adjacency list from edges: fromTaskId → [toTaskId, ...] */
export function buildAdjacencyList(
  edges: Pick<DependencyEdge, 'fromTaskId' | 'toTaskId'>[]
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const successors = adj.get(edge.fromTaskId);
    if (successors) {
      successors.push(edge.toTaskId);
    } else {
      adj.set(edge.fromTaskId, [edge.toTaskId]);
    }
  }
  return adj;
}

/**
 * Returns true if adding the edge (from → to) would create a cycle.
 * Uses DFS from `to` to see if we can reach `from`.
 */
export function wouldCreateCycle(
  edges: Pick<DependencyEdge, 'fromTaskId' | 'toTaskId'>[],
  from: string,
  to: string
): boolean {
  // Self-loop
  if (from === to) return true;

  // Build adjacency list including the proposed edge
  const adj = buildAdjacencyList([...edges, { fromTaskId: from, toTaskId: to }]);

  // DFS from `to` — if we can reach `from`, there's a cycle
  const visited = new Set<string>();
  const stack = [to];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === from) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const neighbors = adj.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        stack.push(neighbor);
      }
    }
  }

  return false;
}

/**
 * Kahn's algorithm for topological sort.
 * Returns task IDs in dependency order (predecessors first).
 * Tasks not in any edge are appended at the end in original order.
 */
export function topologicalSort(
  taskIds: string[],
  edges: Pick<DependencyEdge, 'fromTaskId' | 'toTaskId'>[]
): string[] {
  const taskSet = new Set(taskIds);

  // Filter edges to only include tasks in our set
  const relevantEdges = edges.filter(
    (e) => taskSet.has(e.fromTaskId) && taskSet.has(e.toTaskId)
  );

  // Build adjacency list and in-degree map
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of taskIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of relevantEdges) {
    adj.get(edge.fromTaskId)!.push(edge.toTaskId);
    inDegree.set(edge.toTaskId, inDegree.get(edge.toTaskId)! + 1);
  }

  // Start with nodes that have no incoming edges
  const queue: string[] = [];
  for (const id of taskIds) {
    if (inDegree.get(id) === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of adj.get(node)!) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return sorted;
}

/**
 * Returns the set of task IDs that are currently blocked
 * (have at least one incomplete predecessor).
 */
export function getBlockedTaskIds(
  edges: Pick<DependencyEdge, 'fromTaskId' | 'toTaskId'>[],
  completedTaskIds: Set<string>
): Set<string> {
  const blocked = new Set<string>();
  for (const edge of edges) {
    if (!completedTaskIds.has(edge.fromTaskId)) {
      blocked.add(edge.toTaskId);
    }
  }
  return blocked;
}
