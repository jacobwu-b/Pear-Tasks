import { useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
import type { SyncError } from '../../db/syncFile';

const AUTO_DISMISS_MS = 6000;

function messageFor(error: SyncError): string {
  if (error.kind === 'permission-lost') {
    return 'Sync file permission was revoked. Open Data settings to re-grant.';
  }
  if (error.kind === 'write-failed') {
    return `Couldn't save to sync file: ${error.message}`;
  }
  return error.message;
}

export default function SyncToast() {
  const syncError = useUiStore((s) => s.syncError);
  const setSyncError = useUiStore((s) => s.setSyncError);

  useEffect(() => {
    if (!syncError) return;
    const id = window.setTimeout(() => setSyncError(null), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [syncError, setSyncError]);

  if (!syncError) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sync-toast"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md px-4 py-3 shadow-lg text-sm"
      style={{
        backgroundColor: 'var(--color-status-overdue)',
        color: 'white',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="flex-1">{messageFor(syncError)}</span>
        <button
          type="button"
          onClick={() => setSyncError(null)}
          aria-label="Dismiss"
          className="opacity-80 cursor-pointer"
          style={{ color: 'white' }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
