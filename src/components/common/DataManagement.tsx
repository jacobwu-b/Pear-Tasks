import { useRef, useState } from 'react';
import Modal from './Modal';
import {
  exportDatabase,
  downloadJson,
  importDatabase,
  readJsonFile,
  validateExport,
  type PearExport,
} from '../../db/exportImport';
import {
  connectSyncFile,
  disconnectSyncFile,
  isSyncFileSupported,
  saveToSyncFile,
} from '../../db/syncFile';
import { useTaskStore } from '../../store/taskStore';
import { useUiStore } from '../../store/uiStore';

interface DataManagementProps {
  open: boolean;
  onClose: () => void;
}

type ImportStage =
  | { step: 'idle' }
  | { step: 'confirm'; file: File; data: PearExport }
  | { step: 'importing' }
  | { step: 'done' }
  | { step: 'error'; message: string };

function DataManagementBody({ onClose }: { onClose: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage>({ step: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSidebarData = useTaskStore((s) => s.loadSidebarData);
  const refreshTasks = useTaskStore((s) => s.refreshTasks);

  const syncFile = useUiStore((s) => s.syncFile);
  const syncError = useUiStore((s) => s.syncError);
  const syncSaving = useUiStore((s) => s.syncSaving);
  const setSyncFile = useUiStore((s) => s.setSyncFile);
  const setSyncError = useUiStore((s) => s.setSyncError);
  const setSyncSaving = useUiStore((s) => s.setSyncSaving);
  const supported = isSyncFileSupported();

  const handleConnectSync = async () => {
    setSyncError(null);
    const result = await connectSyncFile();
    if (result.error) {
      if (result.error.kind !== 'picker-aborted') setSyncError(result.error);
      return;
    }
    setSyncFile(result.data);
  };

  const handleDisconnectSync = async () => {
    await disconnectSyncFile();
    setSyncFile(null);
    setSyncError(null);
  };

  const handleSaveSync = async () => {
    setSyncError(null);
    setSyncSaving(true);
    const result = await saveToSyncFile();
    setSyncSaving(false);
    if (result.error) {
      setSyncError(result.error);
      return;
    }
    setSyncFile(result.data);
  };

  const handleExport = async () => {
    setExporting(true);
    const data = await exportDatabase();
    downloadJson(data);
    setExporting(false);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected.
    e.target.value = '';

    try {
      const raw = await readJsonFile(file);
      const validation = validateExport(raw);
      if (!validation.ok) {
        setImportStage({ step: 'error', message: validation.error });
        return;
      }
      setImportStage({ step: 'confirm', file, data: raw as PearExport });
    } catch (err) {
      setImportStage({
        step: 'error',
        message: err instanceof Error ? err.message : 'Failed to read file.',
      });
    }
  };

  const handleConfirmImport = async () => {
    if (importStage.step !== 'confirm') return;
    const { data } = importStage;
    setImportStage({ step: 'importing' });
    const result = await importDatabase(data);
    if (!result.ok) {
      setImportStage({ step: 'error', message: result.error });
      return;
    }
    await loadSidebarData();
    await refreshTasks();
    setImportStage({ step: 'done' });
    setTimeout(onClose, 1200);
  };

  const labelStyle = { color: 'var(--color-text-tertiary)' } as const;

  return (
    <div data-testid="data-management-dialog">
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--color-border-primary)' }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Data
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1 rounded-md cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Sync file */}
        {supported && (
          <div data-testid="sync-file-section">
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>
              Sync File
            </h3>
            <p className="text-xs mb-2" style={labelStyle}>
              Keep a copy of your database in a local JSON file. The file's handle
              is remembered across reloads so you can save without re-picking it.
            </p>

            {!syncFile && (
              <button
                type="button"
                onClick={handleConnectSync}
                data-testid="sync-connect-btn"
                className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
                style={{
                  border: '1px solid var(--color-border-secondary)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Connect sync file...
              </button>
            )}

            {syncFile && (
              <div className="space-y-2">
                <p className="text-xs" style={labelStyle} data-testid="sync-file-status">
                  Connected: <span style={{ color: 'var(--color-text-secondary)' }}>{syncFile.fileName}</span>
                  {syncFile.lastSavedAt !== null && (
                    <>
                      {' · '}saved v{syncFile.lastSyncVersion} at{' '}
                      {new Date(syncFile.lastSavedAt).toLocaleTimeString()}
                    </>
                  )}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSync}
                    disabled={syncSaving}
                    data-testid="sync-save-btn"
                    className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-text-inverse)',
                      opacity: syncSaving ? 0.6 : 1,
                    }}
                  >
                    {syncSaving ? 'Saving...' : 'Save to sync file'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectSync}
                    data-testid="sync-disconnect-btn"
                    className="px-3 py-1.5 rounded-md text-sm cursor-pointer"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}

            {syncError && (
              <div className="mt-2 space-y-1">
                <p
                  className="text-sm"
                  data-testid="sync-error"
                  style={{ color: 'var(--color-status-overdue)' }}
                >
                  {syncError.kind === 'permission-lost'
                    ? 'Write permission for the sync file was revoked. Click "Save to sync file" again to re-grant access.'
                    : syncError.message}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Export */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>
            Export
          </h3>
          <p className="text-xs mb-2" style={labelStyle}>
            Download all your data as a JSON file. Includes tasks, projects, areas, checklists, dependencies, and templates.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            data-testid="export-btn"
            className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
            style={{
              backgroundColor: exportDone ? 'var(--color-status-completed)' : 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {exportDone ? 'Downloaded!' : exporting ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>

        {/* Import */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>
            Import
          </h3>
          <p className="text-xs mb-2" style={labelStyle}>
            Replace all current data with a previously exported JSON file. This action cannot be undone.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="import-file-input"
          />

          {importStage.step === 'idle' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="import-btn"
              className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
              style={{
                border: '1px solid var(--color-border-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Choose File...
            </button>
          )}

          {importStage.step === 'confirm' && (
            <div
              className="rounded-md p-3 space-y-2"
              style={{
                border: '1px solid var(--color-status-overdue)',
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--color-status-overdue)' }}>
                This will replace all current data
              </p>
              <p className="text-xs" style={labelStyle}>
                File: {importStage.file.name} (exported {new Date(importStage.data.exportedAt).toLocaleDateString()})
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  data-testid="import-confirm-btn"
                  className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-status-overdue)',
                    color: 'white',
                  }}
                >
                  Replace All Data
                </button>
                <button
                  type="button"
                  onClick={() => setImportStage({ step: 'idle' })}
                  data-testid="import-cancel-btn"
                  className="px-3 py-1.5 rounded-md text-sm cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {importStage.step === 'importing' && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Importing...
            </p>
          )}

          {importStage.step === 'done' && (
            <p
              className="text-sm font-medium"
              data-testid="import-success"
              style={{ color: 'var(--color-status-completed)' }}
            >
              Import complete! Reloading...
            </p>
          )}

          {importStage.step === 'error' && (
            <div className="space-y-2">
              <p
                className="text-sm"
                data-testid="import-error"
                style={{ color: 'var(--color-status-overdue)' }}
              >
                {importStage.message}
              </p>
              <button
                type="button"
                onClick={() => setImportStage({ step: 'idle' })}
                className="text-xs underline cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DataManagement({ open, onClose }: DataManagementProps) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="Data management" maxWidthClass="max-w-sm" testId="data-management-backdrop">
      <DataManagementBody onClose={onClose} />
    </Modal>
  );
}
