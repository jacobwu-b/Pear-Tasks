import { useUiStore } from '../../store/uiStore';

export default function LinkModeToolbar() {
  const { linkMode, linkModeFirstTaskId, exitLinkMode } = useUiStore();

  if (!linkMode) return null;

  return (
    <div
      data-testid="link-mode-toolbar"
      className="flex items-center gap-2 px-4 py-2 text-sm"
      style={{
        backgroundColor: 'var(--color-accent-subtle)',
        borderBottom: '2px solid var(--color-accent)',
        color: 'var(--color-accent)',
      }}
    >
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M6.354 5.5H4a3 3 0 000 6h3a3 3 0 002.83-4H8.535a2 2 0 01-1.414.586H4.5a2 2 0 110-4h1.854a4 4 0 01-.001-1.5zM9 4h3a3 3 0 010 6h-1.354a4 4 0 00.001-1.5H12a2 2 0 100-4H9.121A3 3 0 009 4z" />
      </svg>
      <span className="font-medium">
        {linkModeFirstTaskId
          ? 'Now click the task to be blocked'
          : 'Click the blocker task first'}
      </span>
      <div className="flex-1" />
      <button
        onClick={exitLinkMode}
        data-testid="link-mode-cancel"
        className="px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors"
        style={{
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-text-inverse)',
        }}
      >
        Cancel
      </button>
    </div>
  );
}
