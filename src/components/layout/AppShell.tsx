import { useCallback, useEffect, useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import Sidebar from './Sidebar';
import TaskList from '../tasks/TaskList';
import TaskDetail from '../tasks/TaskDetail';
import TemplatePicker from '../templates/TemplatePicker';

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const MOBILE_MAX = 639;
const TABLET_MAX = 1023;

function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w <= MOBILE_MAX) return 'mobile';
    if (w <= TABLET_MAX) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const tabletMq = window.matchMedia(`(min-width: ${MOBILE_MAX + 1}px) and (max-width: ${TABLET_MAX}px)`);

    const update = () => {
      if (mobileMq.matches) setBp('mobile');
      else if (tabletMq.matches) setBp('tablet');
      else setBp('desktop');
    };

    mobileMq.addEventListener('change', update);
    tabletMq.addEventListener('change', update);
    return () => {
      mobileMq.removeEventListener('change', update);
      tabletMq.removeEventListener('change', update);
    };
  }, []);

  return bp;
}

interface AppShellProps {
  onDataManagement?: () => void;
}

export default function AppShell({ onDataManagement }: AppShellProps = {}) {
  const {
    sidebarCollapsed,
    mobileSidebarOpen,
    selectedTaskId,
    toggleSidebar,
    setMobileSidebarOpen,
    setSelectedTaskId,
  } = useUiStore();

  const bp = useBreakpoint();
  const isCompact = bp === 'mobile' || bp === 'tablet';
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const handleNewProject = useCallback(() => {
    setShowTemplatePicker(true);
    if (isCompact) setMobileSidebarOpen(false);
  }, [isCompact, setMobileSidebarOpen]);

  const handleHamburgerClick = useCallback(() => {
    if (isCompact) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      toggleSidebar();
    }
  }, [isCompact, mobileSidebarOpen, setMobileSidebarOpen, toggleSidebar]);

  // Close sidebar overlay when resizing to desktop
  useEffect(() => {
    if (!isCompact && mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
  }, [isCompact, mobileSidebarOpen, setMobileSidebarOpen]);

  const closeSidebarOverlay = useCallback(() => {
    setMobileSidebarOpen(false);
  }, [setMobileSidebarOpen]);

  const closeDetailOverlay = useCallback(() => {
    setSelectedTaskId(null);
  }, [setSelectedTaskId]);

  // On compact screens, sidebar is always an overlay. On desktop,
  // it's inline and collapsible via the toggle button.
  const sidebarIsInline = !isCompact && !sidebarCollapsed;
  const sidebarIsOverlay = isCompact && mobileSidebarOpen;

  // Detail panel: inline on desktop, slide-over overlay on compact.
  const detailIsInline = !isCompact && !!selectedTaskId;
  const detailIsOverlay = isCompact && !!selectedTaskId;

  return (
    <div
      className="h-screen flex overflow-hidden relative"
      style={{
        backgroundColor: 'var(--color-surface-primary)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Desktop sidebar — inline */}
      {sidebarIsInline && (
        <div
          className="shrink-0 h-full"
          style={{ width: 'var(--sidebar-width)' }}
        >
          <Sidebar onNewProject={handleNewProject} onDataManagement={onDataManagement} />
        </div>
      )}

      {/* Mobile/tablet sidebar — slide-over overlay */}
      {sidebarIsOverlay && (
        <>
          <div
            data-testid="sidebar-backdrop"
            className="fixed inset-0 z-40 transition-opacity"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            onClick={closeSidebarOverlay}
          />
          <div
            className="fixed inset-y-0 left-0 z-50 h-full shadow-lg"
            style={{ width: 'var(--sidebar-width)' }}
          >
            <Sidebar onNavigate={closeSidebarOverlay} onNewProject={handleNewProject} onDataManagement={onDataManagement} />
          </div>
        </>
      )}

      {/* Center column — task list */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        {/* Toolbar */}
        <header
          className="flex items-center gap-2 px-4 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border-primary)' }}
        >
          <button
            onClick={handleHamburgerClick}
            data-testid="toggle-sidebar"
            aria-label="Toggle sidebar"
            className="p-1.5 rounded-md transition-colors cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Toggle sidebar (⌘/)"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
        </header>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          <TaskList />
        </div>
      </div>

      {/* Detail panel — inline third column on desktop */}
      {detailIsInline && (
        <div
          className="shrink-0 h-full"
          style={{
            width: 'var(--detail-panel-width)',
            borderLeft: '1px solid var(--color-border-primary)',
          }}
        >
          <TaskDetail />
        </div>
      )}

      {/* Detail panel — slide-over overlay on mobile/tablet */}
      {detailIsOverlay && (
        <>
          <div
            data-testid="detail-backdrop"
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            onClick={closeDetailOverlay}
          />
          <div
            className="fixed inset-y-0 right-0 z-50 h-full shadow-lg"
            style={{
              width: bp === 'mobile' ? '100%' : 'var(--detail-panel-width)',
              backgroundColor: 'var(--color-surface-secondary)',
            }}
          >
            <TaskDetail />
          </div>
        </>
      )}

      {/* Template picker modal */}
      {showTemplatePicker && (
        <TemplatePicker onClose={() => setShowTemplatePicker(false)} />
      )}
    </div>
  );
}
