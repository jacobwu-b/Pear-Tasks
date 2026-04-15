import { useMemo, useState } from 'react';
import { useUiStore, type SidebarView } from '../../store/uiStore';
import { useTaskStore } from '../../store/taskStore';
import { useViewTasks } from '../../hooks/useViewTasks';
import { topologicalSort } from '../../db/graph';
import type { Task } from '../../types';
import TaskRow from './TaskRow';
import LinkModeToolbar from '../dependencies/LinkModeToolbar';
import GraphView from '../projects/GraphView';
import SaveAsTemplateDialog from '../templates/SaveAsTemplateDialog';

function viewTitle(
  view: SidebarView,
  projects: { id: string; title: string }[],
  areas: { id: string; title: string }[]
): string {
  if (typeof view === 'string') {
    const labels: Record<string, string> = {
      inbox: 'Inbox',
      today: 'Today',
      upcoming: 'Upcoming',
      anytime: 'Anytime',
      someday: 'Someday',
      logbook: 'Logbook',
      trash: 'Trash',
    };
    return labels[view] ?? view;
  }
  if (view.type === 'project') {
    return projects.find((p) => p.id === view.projectId)?.title ?? 'Project';
  }
  return areas.find((a) => a.id === view.areaId)?.title ?? 'Area';
}

function emptyMessage(view: SidebarView): string {
  if (typeof view === 'string') {
    switch (view) {
      case 'inbox': return 'Your inbox is empty. Nice work!';
      case 'today': return 'Nothing scheduled for today.';
      case 'upcoming': return 'No upcoming tasks.';
      case 'anytime': return 'No open tasks.';
      case 'someday': return 'Nothing deferred to someday.';
      case 'logbook': return 'No completed tasks yet.';
      case 'trash': return 'Trash is empty.';
    }
  }
  return 'No tasks in this view.';
}

export default function TaskList() {
  const { sidebarView, linkMode, enterLinkMode } = useUiStore();
  const { projects, areas, createNewTask, edges } = useTaskStore();
  const tasks = useViewTasks();
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const projectId = typeof sidebarView === 'object' && sidebarView.type === 'project'
    ? sidebarView.projectId
    : null;

  // For project views, order tasks topologically so the list matches the
  // left-to-right ordering of the dependency graph above. Kahn's algorithm
  // preserves original (sortOrder) order among tasks with no dependency
  // relationships, so unconnected tasks stay in their existing positions.
  const orderedTasks = useMemo(() => {
    if (!projectId || edges.length === 0) return tasks;
    const ids = tasks.map((t) => t.id);
    const sortedIds = topologicalSort(ids, edges);
    const byId = new Map(tasks.map((t) => [t.id, t] as const));
    return sortedIds.map((id) => byId.get(id)!).filter(Boolean);
  }, [tasks, edges, projectId]);

  // Compute blocked counts per task
  const blockedCounts = useMemo(() => {
    if (edges.length === 0) return new Map<string, number>();

    const completedIds = new Set(
      tasks.filter((t) => t.status === 'completed').map((t) => t.id)
    );
    const counts = new Map<string, number>();
    for (const edge of edges) {
      if (!completedIds.has(edge.fromTaskId)) {
        counts.set(edge.toTaskId, (counts.get(edge.toTaskId) ?? 0) + 1);
      }
    }
    return counts;
  }, [edges, tasks]);

  const title = viewTitle(sidebarView, projects, areas);
  const isTrash = sidebarView === 'trash';

  // Group upcoming tasks by date
  const isUpcoming = sidebarView === 'upcoming';
  const groupedTasks = useMemo(() => {
    if (!isUpcoming) return null;
    const groups = new Map<string, Task[]>();
    for (const task of tasks) {
      const date = task.when ?? 'Unscheduled';
      const group = groups.get(date);
      if (group) {
        group.push(task);
      } else {
        groups.set(date, [task]);
      }
    }
    return groups;
  }, [isUpcoming, tasks]);

  const handleAddTask = async () => {
    const options: Partial<Pick<Task, 'projectId' | 'areaId' | 'when'>> = {};
    if (typeof sidebarView === 'object' && sidebarView.type === 'project') {
      options.projectId = sidebarView.projectId;
    }
    if (sidebarView === 'today') {
      options.when = new Date().toISOString().split('T')[0];
    }
    if (sidebarView === 'someday') {
      options.when = 'someday';
    }
    await createNewTask('New Task', options);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Link mode toolbar */}
      <LinkModeToolbar />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1
          className="text-2xl font-bold"
          data-testid="view-title"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h1>
        <div className="flex items-center gap-2">
          {/* Link mode button — only for project views */}
          {projectId && !linkMode && (
            <button
              onClick={enterLinkMode}
              data-testid="enter-link-mode-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer"
              style={{
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Link dependencies between tasks"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M6.354 5.5H4a3 3 0 000 6h3a3 3 0 002.83-4H8.535a2 2 0 01-1.414.586H4.5a2 2 0 110-4h1.854a4 4 0 01-.001-1.5zM9 4h3a3 3 0 010 6h-1.354a4 4 0 00.001-1.5H12a2 2 0 100-4H9.121A3 3 0 009 4z" />
              </svg>
              Link
            </button>
          )}
          {/* Save as Template — only for project views */}
          {projectId && (
            <button
              onClick={() => setShowSaveTemplate(true)}
              data-testid="save-as-template-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer"
              style={{
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Save this project as a reusable template"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M2 4a2 2 0 012-2h4.586A2 2 0 0110 2.586L13.414 6A2 2 0 0114 7.414V12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v8h8V7.414L8.586 4H4z" />
              </svg>
              Template
            </button>
          )}
          {!isTrash && (
            <button
              onClick={handleAddTask}
              data-testid="add-task-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer"
              style={{
                color: 'var(--color-accent)',
                backgroundColor: 'var(--color-accent-subtle)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-text-inverse)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-accent-subtle)';
                e.currentTarget.style.color = 'var(--color-accent)';
              }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
              </svg>
              Add Task
            </button>
          )}
        </div>
      </div>

      {/* Dependency graph panel — shown on top for project views with edges */}
      {projectId && (
        <GraphView tasks={orderedTasks} edges={edges} />
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <p
            className="px-4 py-8 text-sm text-center"
            style={{ color: 'var(--color-text-tertiary)' }}
            data-testid="empty-message"
          >
            {emptyMessage(sidebarView)}
          </p>
        ) : isUpcoming && groupedTasks ? (
          Array.from(groupedTasks.entries()).map(([date, dateTasks]) => (
            <div key={date}>
              <div
                className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide sticky top-0"
                style={{
                  color: 'var(--color-text-tertiary)',
                  backgroundColor: 'var(--color-surface-primary)',
                  borderBottom: '1px solid var(--color-border-primary)',
                }}
              >
                {formatGroupDate(date)}
              </div>
              {dateTasks.map((task) => (
                <TaskRow key={task.id} task={task} blockedByCount={blockedCounts.get(task.id) ?? 0} />
              ))}
            </div>
          ))
        ) : (
          orderedTasks.map((task) => (
            <TaskRow key={task.id} task={task} blockedByCount={blockedCounts.get(task.id) ?? 0} />
          ))
        )}
      </div>

      {/* Save as Template dialog */}
      {showSaveTemplate && projectId && (
        <SaveAsTemplateDialog
          projectId={projectId}
          projectName={title}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}
    </div>
  );
}

function formatGroupDate(date: string): string {
  if (date === 'Unscheduled') return date;
  const today = new Date().toISOString().split('T')[0];
  if (date === today) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
