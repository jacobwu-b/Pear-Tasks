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
    // Use cubic bezier through intermediate points
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
  const { selectedTaskId, setSelectedTaskId } = useUiStore();

  const layout = useMemo(() => computeLayout(tasks, edges), [tasks, edges]);

  if (tasks.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: 'var(--color-text-tertiary)' }}
        data-testid="graph-empty"
      >
        <p className="text-sm">No tasks to visualize.</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto"
      data-testid="graph-view"
      style={{ backgroundColor: 'var(--color-surface-secondary)' }}
    >
      <svg
        width={layout.width}
        height={layout.height}
        data-testid="graph-svg"
        style={{ minWidth: '100%', minHeight: '100%' }}
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
              {/* Status icon for completed tasks */}
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
  );
}
