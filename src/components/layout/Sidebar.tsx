import { useEffect } from 'react';
import { useUiStore, type SidebarView } from '../../store/uiStore';
import { useTaskStore } from '../../store/taskStore';

// ── Icons (simple inline SVGs to avoid dependencies) ───────────────

function InboxIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v1.5H2V6z" />
      <path fillRule="evenodd" d="M2 9.5h4.382l1.276 2.553a.5.5 0 00.447.276h3.79a.5.5 0 00.447-.276L13.618 9.5H18V14a2 2 0 01-2 2H4a2 2 0 01-2-2V9.5z" clipRule="evenodd" />
    </svg>
  );
}

function TodayIcon() {
  const day = new Date().getDate().toString();
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm1 3a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7A.5.5 0 016 6z" clipRule="evenodd" />
      <text x="10" y="14.5" textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--color-surface-primary)">{day}</text>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );
}

function AnytimeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12l-6-3-6 3V4z" />
    </svg>
  );
}

function SomedayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
    </svg>
  );
}

function LogbookIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022 1.005 11.27A2.75 2.75 0 007.77 19h4.46a2.75 2.75 0 002.751-2.527l1.005-11.27.149.022a.75.75 0 10.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 5a41.112 41.112 0 00-4.612.34L6.393 16.6c.058.65.608 1.15 1.26 1.15h4.694c.652 0 1.202-.5 1.26-1.15l1.005-11.26A41.1 41.1 0 0010 5z" clipRule="evenodd" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
    >
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

// ── Smart list config ──────────────────────────────────────────────

const SMART_LISTS: { key: string; label: string; icon: () => React.ReactElement }[] = [
  { key: 'inbox', label: 'Inbox', icon: InboxIcon },
  { key: 'today', label: 'Today', icon: TodayIcon },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarIcon },
  { key: 'anytime', label: 'Anytime', icon: AnytimeIcon },
  { key: 'someday', label: 'Someday', icon: SomedayIcon },
  { key: 'logbook', label: 'Logbook', icon: LogbookIcon },
  { key: 'trash', label: 'Trash', icon: TrashIcon },
];

// ── Helpers ────────────────────────────────────────────────────────

function viewKey(view: SidebarView): string {
  if (typeof view === 'string') return view;
  return `${view.type}:${view.type === 'project' ? view.projectId : view.areaId}`;
}

// ── Component ──────────────────────────────────────────────────────

interface SidebarProps {
  /** Called after any navigation item is selected (used to close mobile overlay) */
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { sidebarView, setSidebarView } = useUiStore();
  const { areas, projects, loadSidebarData } = useTaskStore();

  useEffect(() => {
    loadSidebarData();
  }, [loadSidebarData]);

  const currentKey = viewKey(sidebarView);

  const handleNav = (view: SidebarView) => {
    setSidebarView(view);
    onNavigate?.();
  };

  return (
    <nav
      className="flex flex-col h-full overflow-y-auto select-none"
      style={{
        backgroundColor: 'var(--color-surface-sidebar)',
        borderRight: '1px solid var(--color-border-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Smart lists */}
      <div className="px-2 pt-3 pb-1">
        {SMART_LISTS.map(({ key, label, icon: Icon }) => {
          const active = currentKey === key;
          return (
            <button
              key={key}
              onClick={() => handleNav(key as SidebarView)}
              data-testid={`sidebar-${key}`}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
              style={{
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: active ? 'var(--color-surface-active)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>
                <Icon />
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 my-2" style={{ borderTop: '1px solid var(--color-border-primary)' }} />

      {/* Areas & Projects tree */}
      <div className="px-2 pb-3 flex-1">
        {areas.map((area) => (
          <AreaGroup
            key={area.id}
            area={area}
            projects={projects.filter((p) => p.areaId === area.id)}
            currentKey={currentKey}
            onSelect={handleNav}
          />
        ))}

        {/* Projects without an area */}
        {projects
          .filter((p) => p.areaId === null)
          .map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              active={currentKey === `project:${project.id}`}
              onSelect={() => handleNav({ type: 'project', projectId: project.id })}
            />
          ))}
      </div>
    </nav>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function AreaGroup({
  area,
  projects,
  currentKey,
  onSelect,
}: {
  area: { id: string; title: string };
  projects: { id: string; title: string }[];
  currentKey: string;
  onSelect: (view: SidebarView) => void;
}) {
  const isAreaActive = currentKey === `area:${area.id}`;

  return (
    <div className="mb-1">
      <button
        onClick={() => onSelect({ type: 'area', areaId: area.id })}
        data-testid={`sidebar-area-${area.id}`}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer"
        style={{
          color: isAreaActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          backgroundColor: isAreaActive ? 'var(--color-surface-active)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isAreaActive) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isAreaActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <ChevronIcon expanded={true} />
        {area.title}
      </button>

      <div className="ml-3">
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            active={currentKey === `project:${project.id}`}
            onSelect={() => onSelect({ type: 'project', projectId: project.id })}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectItem({
  project,
  active,
  onSelect,
}: {
  project: { id: string; title: string };
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      data-testid={`sidebar-project-${project.id}`}
      className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-sm transition-colors cursor-pointer"
      style={{
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        backgroundColor: active ? 'var(--color-surface-active)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <span style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>
        <FolderIcon />
      </span>
      {project.title}
    </button>
  );
}
