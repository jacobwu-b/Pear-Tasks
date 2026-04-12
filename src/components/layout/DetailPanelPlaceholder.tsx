import { useUiStore } from '../../store/uiStore';

export default function DetailPanelPlaceholder() {
  const { selectedTaskId, setSelectedTaskId } = useUiStore();

  return (
    <div className="p-6 h-full flex flex-col" style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Task Detail
        </h2>
        <button
          onClick={() => setSelectedTaskId(null)}
          className="p-1 rounded-md transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        Task ID: {selectedTaskId}
      </p>
      <p className="text-sm mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
        Full detail panel coming in the next step.
      </p>
    </div>
  );
}
