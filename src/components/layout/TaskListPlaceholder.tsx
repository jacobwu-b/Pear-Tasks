import { useUiStore, type SidebarView } from '../../store/uiStore';
import { useTaskStore } from '../../store/taskStore';

function viewTitle(view: SidebarView, projects: { id: string; title: string }[], areas: { id: string; title: string }[]): string {
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

export default function TaskListPlaceholder() {
  const { sidebarView } = useUiStore();
  const { projects, areas } = useTaskStore();
  const title = viewTitle(sidebarView, projects, areas);

  return (
    <div className="p-6">
      <h1
        className="text-2xl font-bold mb-4"
        data-testid="view-title"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h1>
      <p
        className="text-sm"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        Tasks will appear here.
      </p>
    </div>
  );
}
