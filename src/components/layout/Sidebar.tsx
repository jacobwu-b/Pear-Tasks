import { useEffect, useState } from 'react';
import { useUiStore, type SidebarView } from '../../store/uiStore';
import { useTaskStore } from '../../store/taskStore';
import AreaDeleteConfirm from './AreaDeleteConfirm';

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
  /** Called when the user clicks "New Project" to open the template picker */
  onNewProject?: () => void;
  /** Called when the user clicks "Data" to open export/import */
  onDataManagement?: () => void;
}

export default function Sidebar({ onNavigate, onNewProject, onDataManagement }: SidebarProps) {
  const { sidebarView, setSidebarView } = useUiStore();
  const { areas, projects, loadSidebarData, createNewArea, renameArea, removeArea } = useTaskStore();
  const [renamingAreaId, setRenamingAreaId] = useState<string | null>(null);
  const [confirmingDeleteAreaId, setConfirmingDeleteAreaId] = useState<string | null>(null);

  useEffect(() => {
    loadSidebarData();
  }, [loadSidebarData]);

  const currentKey = viewKey(sidebarView);

  const handleNav = (view: SidebarView) => {
    setSidebarView(view);
    onNavigate?.();
  };

  const handleNewArea = async () => {
    const area = await createNewArea('New Area');
    if (area) setRenamingAreaId(area.id);
  };

  const confirmingArea = confirmingDeleteAreaId
    ? areas.find((a) => a.id === confirmingDeleteAreaId) ?? null
    : null;
  const confirmingProjectCount = confirmingArea
    ? projects.filter((p) => p.areaId === confirmingArea.id).length
    : 0;

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

      {/* New Project / New Area buttons */}
      <div className="px-2 pb-1">
        {onNewProject && (
          <button
            onClick={onNewProject}
            data-testid="sidebar-new-project"
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
            style={{
              color: 'var(--color-accent)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
            </svg>
            New Project
          </button>
        )}
        <button
          onClick={handleNewArea}
          data-testid="sidebar-new-area"
          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
          style={{
            color: 'var(--color-accent)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
          </svg>
          New Area
        </button>
      </div>

      {/* Areas & Projects tree */}
      <div className="px-2 pb-3 flex-1">
        {areas.map((area) => (
          <AreaGroup
            key={area.id}
            area={area}
            projects={projects.filter((p) => p.areaId === area.id)}
            currentKey={currentKey}
            onSelect={handleNav}
            renaming={renamingAreaId === area.id}
            onRequestRename={() => setRenamingAreaId(area.id)}
            onCommitRename={async (title) => {
              const trimmed = title.trim();
              if (trimmed && trimmed !== area.title) {
                await renameArea(area.id, trimmed);
              }
              setRenamingAreaId(null);
            }}
            onCancelRename={() => setRenamingAreaId(null)}
            onRequestDelete={() => setConfirmingDeleteAreaId(area.id)}
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

      {/* Data management button */}
      <div
        className="px-2 py-2 mt-auto shrink-0"
        style={{ borderTop: '1px solid var(--color-border-primary)' }}
      >
        <button
          onClick={() => onDataManagement?.()}
          data-testid="sidebar-data-btn"
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-sm transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
            <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Data
        </button>
      </div>

      {confirmingArea && (
        <AreaDeleteConfirm
          areaTitle={confirmingArea.title}
          projectCount={confirmingProjectCount}
          onCancel={() => setConfirmingDeleteAreaId(null)}
          onConfirm={async () => {
            const id = confirmingArea.id;
            setConfirmingDeleteAreaId(null);
            await removeArea(id);
          }}
        />
      )}
    </nav>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function AreaGroup({
  area,
  projects,
  currentKey,
  onSelect,
  renaming,
  onRequestRename,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
}: {
  area: { id: string; title: string };
  projects: { id: string; title: string }[];
  currentKey: string;
  onSelect: (view: SidebarView) => void;
  renaming: boolean;
  onRequestRename: () => void;
  onCommitRename: (title: string) => void | Promise<void>;
  onCancelRename: () => void;
  onRequestDelete: () => void;
}) {
  const isAreaActive = currentKey === `area:${area.id}`;
  const [hovered, setHovered] = useState(false);

  // Callback ref: focus + select the input the moment it mounts (when
  // renaming flips true). Keeps focus logic out of useEffect to avoid
  // set-state-in-effect patterns.
  const focusInput = (el: HTMLInputElement | null) => {
    if (el) {
      el.focus();
      el.select();
    }
  };

  return (
    <div
      className="mb-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flex items-center gap-1 w-full px-2.5 py-1.5 rounded-md"
        style={{
          color: isAreaActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          backgroundColor: isAreaActive ? 'var(--color-surface-active)' : 'transparent',
        }}
      >
        <ChevronIcon expanded={true} />

        {renaming ? (
          <input
            key={area.id}
            ref={focusInput}
            defaultValue={area.title}
            data-testid={`sidebar-area-rename-${area.id}`}
            onBlur={(e) => onCommitRename(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitRename(e.currentTarget.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelRename();
              }
            }}
            className="flex-1 bg-transparent outline-none text-xs font-semibold uppercase tracking-wide"
            style={{
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: '4px',
              padding: '1px 4px',
            }}
          />
        ) : (
          <>
            <button
              onClick={() => onSelect({ type: 'area', areaId: area.id })}
              data-testid={`sidebar-area-${area.id}`}
              className="flex-1 text-left text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer"
              style={{ color: 'inherit', background: 'transparent' }}
            >
              {area.title}
            </button>

            {hovered && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestRename();
                  }}
                  data-testid={`sidebar-area-rename-btn-${area.id}`}
                  title="Rename area"
                  className="p-1 rounded cursor-pointer"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M12.146 1.146a.5.5 0 01.708 0l2 2a.5.5 0 010 .708l-9 9a.5.5 0 01-.168.11l-4 1.5A.5.5 0 011 13.5l1.5-4a.5.5 0 01.11-.168l9-9zM11.5 3L13 4.5 4.914 12.586l-1.829.686.686-1.829L11.5 3z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDelete();
                  }}
                  data-testid={`sidebar-area-delete-btn-${area.id}`}
                  title="Delete area"
                  className="p-1 rounded cursor-pointer"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M6.5 1a1 1 0 00-1 1v.5H3a.5.5 0 000 1h.472l.658 9.211A2 2 0 006.126 14.5h3.748a2 2 0 001.996-1.789L12.528 3.5H13a.5.5 0 000-1h-2.5V2a1 1 0 00-1-1h-3zm3 1.5h-3V2h3v.5z" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

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
