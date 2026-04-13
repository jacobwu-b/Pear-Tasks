import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import type { Task, DependencyEdge } from '../../types';
import { useUiStore } from '../../store/uiStore';

interface GraphViewProps {
  tasks: Task[];
  edges: DependencyEdge[];
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 44;
const NODE_RX = 8;
const PADDING = 40;
const ARROW_SIZE = 6;

interface LayoutNode {
  task: Task;
  x: number;
  y: number;
  isBlocked: boolean;
}

interface LayoutEdge {
  id: string;
  points: { x: number; y: number }[];
}

function computeLayout(tasks: Task[], edges: DependencyEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: 24,
    ranksep: 60,
    marginx: PADDING,
    marginy: PADDING,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const task of tasks) {
    g.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    if (taskMap.has(edge.fromTaskId) && taskMap.has(edge.toTaskId)) {
      g.setEdge(edge.fromTaskId, edge.toTaskId);
    }
  }

  dagre.layout(g);

  // Determine blocked status
  const completedIds = new Set(
    tasks.filter((t) => t.status === 'completed' || t.status === 'canceled').map((t) => t.id)
  );
  const blockedIds = new Set<string>();
  for (const edge of edges) {
    if (!completedIds.has(edge.fromTaskId)) {
      blockedIds.add(edge.toTaskId);
    }
  }

  const nodes: LayoutNode[] = [];
  for (const task of tasks) {
    const node = g.node(task.id);
    if (node) {
      nodes.push({
        task,
        x: node.x,
        y: node.y,
        isBlocked: blockedIds.has(task.id),
      });
    }
  }

  const layoutEdges: LayoutEdge[] = [];
  for (const edge of edges) {
    const graphEdge = g.edge(edge.fromTaskId, edge.toTaskId);
    if (graphEdge) {
      layoutEdges.push({
        id: edge.id,
        points: graphEdge.points,
      });
    }
  }

  const graphInfo = g.graph();
  const width = (graphInfo.width ?? 400) + PADDING;
  const height = (graphInfo.height ?? 200) + PADDING;

  return { nodes, edges: layoutEdges, width, height };
}

function nodeStroke(task: Task, isBlocked: boolean): string {
  if (task.status === 'completed') return 'var(--color-status-completed)';
  if (task.status === 'canceled') return 'var(--color-status-canceled)';
  if (isBlocked) return 'var(--color-status-blocked)';
  return 'var(--color-border-secondary)';
}

function nodeFill(task: Task, isBlocked: boolean): string {
  if (task.status === 'completed') return 'var(--color-status-completed)';
  if (task.status === 'canceled') return 'var(--color-status-canceled)';
  if (isBlocked) return 'var(--color-status-blocked)';
  return 'var(--color-surface-primary)';
}

function nodeTextColor(task: Task, isBlocked: boolean): string {
  if (task.status === 'completed' || task.status === 'canceled' || isBlocked) {
    return '#ffffff';
  }
  return 'var(--color-text-primary)';
}

function edgePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const [start, ...rest] = points;
  let d = `M ${start.x} ${start.y}`;
  if (rest.length === 1) {
    d += ` L ${rest[0].x} ${rest[0].y}`;
  } else if (rest.length >= 2) {
    for (let i = 0; i < rest.length - 1; i++) {
      const curr = rest[i];
      const next = rest[i + 1];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      d += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
    }
    const last = rest[rest.length - 1];
    d += ` L ${last.x} ${last.y}`;
  }
  return d;
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 1) + '\u2026';
}

export default function GraphView({ tasks, edges }: GraphViewProps) {
  const { selectedTaskId, setSelectedTaskId, graphCollapsed, setGraphCollapsed } = useUiStore();

  const layout = useMemo(() => computeLayout(tasks, edges), [tasks, edges]);

  // Don't render if there are no edges (no dependency graph to show)
  if (edges.length === 0) return null;

  return (
    <div
      data-testid="graph-view"
      style={{ borderBottom: '1px solid var(--color-border-primary)' }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setGraphCollapsed(!graphCollapsed)}
        data-testid="graph-toggle"
        className="flex items-center gap-1.5 w-full px-4 py-2 text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors"
        style={{
          color: 'var(--color-text-tertiary)',
          backgroundColor: 'var(--color-surface-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary)';
        }}
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className="w-3 h-3 transition-transform"
          style={{ transform: graphCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        >
          <path d="M4.646 5.646a.5.5 0 01.708 0L8 8.293l2.646-2.647a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 010-.708z" />
        </svg>
        Dependency Graph
      </button>

      {/* Graph canvas */}
      {!graphCollapsed && (
        <div
          className="overflow-auto"
          data-testid="graph-canvas"
          style={{
            backgroundColor: 'var(--color-surface-secondary)',
            maxHeight: '280px',
          }}
        >
          <svg
            width={layout.width}
            height={layout.height}
            data-testid="graph-svg"
          >
            {/* Arrow marker */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth={ARROW_SIZE}
                markerHeight={ARROW_SIZE}
                refX={ARROW_SIZE}
                refY={ARROW_SIZE / 2}
                orient="auto"
              >
                <polygon
                  points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`}
                  fill="var(--color-text-tertiary)"
                />
              </marker>
            </defs>

            {/* Edges */}
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edgePath(edge.points)}
                fill="none"
                stroke="var(--color-text-tertiary)"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
                data-testid={`graph-edge-${edge.id}`}
              />
            ))}

            {/* Nodes */}
            {layout.nodes.map(({ task, x, y, isBlocked }) => {
              const isSelected = selectedTaskId === task.id;
              const halfW = NODE_WIDTH / 2;
              const halfH = NODE_HEIGHT / 2;

              return (
                <g
                  key={task.id}
                  data-testid={`graph-node-${task.id}`}
                  onClick={() => setSelectedTaskId(task.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x - halfW}
                    y={y - halfH}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={NODE_RX}
                    fill={nodeFill(task, isBlocked)}
                    stroke={isSelected ? 'var(--color-accent)' : nodeStroke(task, isBlocked)}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {task.status === 'completed' && (
                    <text
                      x={x - halfW + 12}
                      y={y + 5}
                      fontSize={14}
                      fill="#ffffff"
                      textAnchor="start"
                    >
                      ✓
                    </text>
                  )}
                  <text
                    x={task.status === 'completed' ? x - halfW + 28 : x - halfW + 12}
                    y={y + 5}
                    fontSize={13}
                    fill={nodeTextColor(task, isBlocked)}
                    textAnchor="start"
                    style={{ fontFamily: 'var(--font-sans)', pointerEvents: 'none' }}
                  >
                    {truncateTitle(task.title, task.status === 'completed' ? 18 : 20)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
