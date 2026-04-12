import { useCallback, useEffect, useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import Sidebar from './Sidebar';
import TaskListPlaceholder from './TaskListPlaceholder';
import DetailPanelPlaceholder from './DetailPanelPlaceholder';

const MOBILE_BREAKPOINT = 640;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

export default function AppShell() {
  const {
    sidebarCollapsed,
    mobileSidebarOpen,
    selectedTaskId,
    toggleSidebar,
    setMobileSidebarOpen,
  } = useUiStore();

  const isMobile = useIsMobile();

  const handleHamburgerClick = useCallback(() => {
    if (isMobile) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      toggleSidebar();
    }
  }, [isMobile, mobileSidebarOpen, setMobileSidebarOpen, toggleSidebar]);

  // Close mobile sidebar when resizing above breakpoint
  useEffect(() => {
    if (!isMobile && mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile, mobileSidebarOpen, setMobileSidebarOpen]);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, [setMobileSidebarOpen]);

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
      {!isMobile && !sidebarCollapsed && (
        <div
          className="shrink-0 h-full"
          style={{ width: 'var(--sidebar-width)' }}
        >
          <Sidebar />
        </div>
      )}

      {/* Mobile sidebar — slide-over overlay */}
      {isMobile && mobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            data-testid="sidebar-backdrop"
            className="fixed inset-0 z-40 transition-opacity"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            onClick={closeMobileSidebar}
          />
          {/* Sidebar drawer */}
          <div
            className="fixed inset-y-0 left-0 z-50 h-full shadow-lg"
            style={{ width: 'var(--sidebar-width)' }}
          >
            <Sidebar onNavigate={closeMobileSidebar} />
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
          <TaskListPlaceholder />
        </div>
      </div>

      {/* Detail panel — shown when a task is selected, hidden on small screens */}
      {selectedTaskId && (
        <div
          className="shrink-0 h-full hidden lg:block"
          style={{
            width: 'var(--detail-panel-width)',
            borderLeft: '1px solid var(--color-border-primary)',
          }}
        >
          <DetailPanelPlaceholder />
        </div>
      )}
    </div>
  );
}
