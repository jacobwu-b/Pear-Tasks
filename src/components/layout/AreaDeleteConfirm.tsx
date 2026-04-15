interface Props {
  areaTitle: string;
  projectCount: number;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function AreaDeleteConfirm({ areaTitle, projectCount, onCancel, onConfirm }: Props) {
  const message =
    projectCount === 0
      ? `Delete the area "${areaTitle}"? It has no projects.`
      : `Delete the area "${areaTitle}"? Its ${projectCount} project${projectCount === 1 ? '' : 's'} will be moved to "No Area" and can be reassigned later.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="area-delete-confirm"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
    >
      <div
        className="w-[400px] max-w-[90vw] rounded-lg shadow-lg p-5"
        style={{ backgroundColor: 'var(--color-surface-primary)', color: 'var(--color-text-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-2">Delete area</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            data-testid="area-delete-cancel"
            className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-primary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            data-testid="area-delete-confirm-btn"
            className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer"
            style={{
              backgroundColor: 'var(--color-danger, #dc2626)',
              color: 'white',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
