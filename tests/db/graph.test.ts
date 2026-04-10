import { describe, it, expect } from 'vitest';
import {
  buildAdjacencyList,
  wouldCreateCycle,
  topologicalSort,
  getBlockedTaskIds,
} from '../../src/db/graph';

// -- helpers --
const edge = (from: string, to: string) => ({ fromTaskId: from, toTaskId: to });

describe('buildAdjacencyList', () => {
  it('returns empty map for no edges', () => {
    expect(buildAdjacencyList([]).size).toBe(0);
  });

  it('builds correct adjacency for simple chain', () => {
    const adj = buildAdjacencyList([edge('a', 'b'), edge('b', 'c')]);
    expect(adj.get('a')).toEqual(['b']);
    expect(adj.get('b')).toEqual(['c']);
    expect(adj.has('c')).toBe(false);
  });

  it('handles multiple successors', () => {
    const adj = buildAdjacencyList([edge('a', 'b'), edge('a', 'c')]);
    expect(adj.get('a')).toEqual(['b', 'c']);
  });
});

describe('wouldCreateCycle', () => {
  it('detects self-loop', () => {
    expect(wouldCreateCycle([], 'a', 'a')).toBe(true);
  });

  it('allows first edge between two nodes', () => {
    expect(wouldCreateCycle([], 'a', 'b')).toBe(false);
  });

  it('detects direct cycle (a→b, b→a)', () => {
    expect(wouldCreateCycle([edge('a', 'b')], 'b', 'a')).toBe(true);
  });

  it('detects indirect cycle (a→b→c, c→a)', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')];
    expect(wouldCreateCycle(edges, 'c', 'a')).toBe(true);
  });

  it('allows non-cyclic addition to existing graph', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')];
    expect(wouldCreateCycle(edges, 'a', 'c')).toBe(false);
  });

  it('allows parallel edges to same target', () => {
    const edges = [edge('a', 'c')];
    expect(wouldCreateCycle(edges, 'b', 'c')).toBe(false);
  });

  it('detects cycle in diamond graph', () => {
    // a→b, a→c, b→d, c→d — adding d→a creates cycle
    const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
    expect(wouldCreateCycle(edges, 'd', 'a')).toBe(true);
  });

  it('allows safe edge in diamond graph', () => {
    const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
    // Adding d→e is safe
    expect(wouldCreateCycle(edges, 'd', 'e')).toBe(false);
  });

  it('handles long chain without false positive', () => {
    const edges = [];
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push(edge(nodes[i], nodes[i + 1]));
    }
    // a→b→c→d→e→f→g — adding a→g is safe (shortcut, not cycle)
    expect(wouldCreateCycle(edges, 'a', 'g')).toBe(false);
    // adding g→a is a cycle
    expect(wouldCreateCycle(edges, 'g', 'a')).toBe(true);
  });
});

describe('topologicalSort', () => {
  it('returns all tasks when no edges', () => {
    const result = topologicalSort(['a', 'b', 'c'], []);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('sorts simple chain correctly', () => {
    const result = topologicalSort(['c', 'a', 'b'], [edge('a', 'b'), edge('b', 'c')]);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('sorts diamond graph correctly', () => {
    const result = topologicalSort(
      ['d', 'b', 'c', 'a'],
      [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')]
    );
    // 'a' must come first, 'd' must come last
    expect(result[0]).toBe('a');
    expect(result[result.length - 1]).toBe('d');
    expect(result).toHaveLength(4);
  });

  it('handles disconnected nodes', () => {
    const result = topologicalSort(['a', 'b', 'x'], [edge('a', 'b')]);
    expect(result.indexOf('a')).toBeLessThan(result.indexOf('b'));
    expect(result).toContain('x');
    expect(result).toHaveLength(3);
  });

  it('ignores edges referencing tasks not in the set', () => {
    const result = topologicalSort(['a', 'b'], [edge('a', 'b'), edge('b', 'z')]);
    expect(result).toEqual(['a', 'b']);
  });
});

describe('getBlockedTaskIds', () => {
  it('returns empty set when no edges', () => {
    expect(getBlockedTaskIds([], new Set())).toEqual(new Set());
  });

  it('marks task as blocked when predecessor is incomplete', () => {
    const blocked = getBlockedTaskIds([edge('a', 'b')], new Set());
    expect(blocked.has('b')).toBe(true);
  });

  it('does not mark task as blocked when predecessor is complete', () => {
    const blocked = getBlockedTaskIds([edge('a', 'b')], new Set(['a']));
    expect(blocked.has('b')).toBe(false);
  });

  it('marks task as blocked if any predecessor is incomplete', () => {
    const edges = [edge('a', 'c'), edge('b', 'c')];
    // Only 'a' is complete, 'b' is not
    const blocked = getBlockedTaskIds(edges, new Set(['a']));
    expect(blocked.has('c')).toBe(true);
  });

  it('unblocks task when all predecessors are complete', () => {
    const edges = [edge('a', 'c'), edge('b', 'c')];
    const blocked = getBlockedTaskIds(edges, new Set(['a', 'b']));
    expect(blocked.has('c')).toBe(false);
  });
});
