import Modal from './Modal';

interface EditRecurrenceDialogProps {
  open: boolean;
  onEditThis: () => void;
  onEditForward: () => void;
  onCancel: () => void;
}

/**
 * Calendar-style "which occurrences should be updated?" confirmation dialog.
 * Shown whenever the user edits the recurrence rule on an existing recurring task.
 */
export default function EditRecurrenceDialog({
  open,
  onEditThis,
  onEditForward,
  onCancel,
}: EditRecurrenceDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      ariaLabel="Edit recurring task"
      maxWidthClass="max-w-xs"
      testId="edit-recurrence-dialog"
    >
      <div className="px-5 py-4 space-y-4">
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Edit recurring task
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Which occurrences should be updated?
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onEditThis}
            data-testid="edit-recurrence-this"
            className="w-full px-4 py-2 rounded-md text-sm text-left cursor-pointer transition-colors"
            style={{
              border: '1px solid var(--color-border-primary)',
              color: 'var(--color-text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            This occurrence only
          </button>

          <button
            type="button"
            onClick={onEditForward}
            data-testid="edit-recurrence-forward"
            className="w-full px-4 py-2 rounded-md text-sm text-left cursor-pointer transition-colors"
            style={{
              border: '1px solid var(--color-border-primary)',
              color: 'var(--color-text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            This and following occurrences
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
