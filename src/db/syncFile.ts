import { db } from './schema';
import { exportDatabase, type PearExport } from './exportImport';

/**
 * The on-disk envelope is the v3 export envelope plus a monotonic `syncVersion`
 * counter that bumps on every successful save. Schema `version` stays at 3 so
 * the file remains a valid Pear export that can also be imported via the
 * normal Import flow.
 */
export interface SyncEnvelope extends PearExport {
  syncVersion: number;
}

export type SyncResult<T> =
  | { data: T; error: null }
  | { data: null; error: SyncError };

export type SyncError =
  | { kind: 'unsupported'; message: string }
  | { kind: 'permission-lost'; message: string }
  | { kind: 'picker-aborted'; message: string }
  | { kind: 'not-connected'; message: string }
  | { kind: 'write-failed'; message: string }
  | { kind: 'read-failed'; message: string };

const RECORD_ID = 'singleton' as const;
const DEFAULT_FILE_NAME = 'pear-db.json';

/** Feature-detect the File System Access API surface we rely on. */
export function isSyncFileSupported(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
  );
}

/**
 * Ask the browser to confirm we still have write permission on the handle.
 * If permission was revoked (common after a page reload), prompt the user.
 */
export async function ensurePermission(
  handle: FileSystemFileHandle,
): Promise<'granted' | 'denied'> {
  const opts = { mode: 'readwrite' } as const;
  const queryable = handle as unknown as {
    queryPermission?: (o: typeof opts) => Promise<PermissionState>;
    requestPermission?: (o: typeof opts) => Promise<PermissionState>;
  };
  if (queryable.queryPermission) {
    const status = await queryable.queryPermission(opts);
    if (status === 'granted') return 'granted';
  }
  if (queryable.requestPermission) {
    const status = await queryable.requestPermission(opts);
    if (status === 'granted') return 'granted';
  }
  return 'denied';
}

/**
 * Show the save-file picker and persist the chosen handle so it survives a
 * page reload. Returns the stored record on success.
 */
export async function connectSyncFile(): Promise<SyncResult<SyncFileSnapshot>> {
  if (!isSyncFileSupported()) {
    return {
      data: null,
      error: { kind: 'unsupported', message: 'This browser does not support the File System Access API.' },
    };
  }
  type SaveFilePickerFn = (opts: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
  const showSaveFilePicker = (globalThis as unknown as { showSaveFilePicker: SaveFilePickerFn })
    .showSaveFilePicker;

  let handle: FileSystemFileHandle;
  try {
    handle = await showSaveFilePicker({
      suggestedName: DEFAULT_FILE_NAME,
      types: [
        {
          description: 'Pear Tasks sync file',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
  } catch (e) {
    // The user dismissed the picker. Not an error worth surfacing.
    if (e instanceof Error && e.name === 'AbortError') {
      return { data: null, error: { kind: 'picker-aborted', message: 'Picker dismissed.' } };
    }
    return {
      data: null,
      error: { kind: 'write-failed', message: e instanceof Error ? e.message : String(e) },
    };
  }

  const record = {
    id: RECORD_ID,
    handle,
    fileName: handle.name,
    connectedAt: Date.now(),
    lastSyncVersion: 0,
    lastSavedAt: null,
  } as const;
  await db.syncFile.put(record);

  return { data: snapshotOf(record), error: null };
}

/** Clear the persisted handle. */
export async function disconnectSyncFile(): Promise<void> {
  await db.syncFile.delete(RECORD_ID);
}

/** Read the current handle row, if any. */
export async function getSyncFileRecord() {
  return db.syncFile.get(RECORD_ID);
}

/**
 * Lightweight, store-friendly snapshot of the persisted record. We deliberately
 * omit the FileSystemFileHandle itself: handles are not structured-clone safe
 * once they leave the Dexie boundary in some environments, and the UI only
 * needs the metadata.
 */
export interface SyncFileSnapshot {
  fileName: string;
  connectedAt: number;
  lastSyncVersion: number;
  lastSavedAt: number | null;
}

function snapshotOf(record: {
  fileName: string;
  connectedAt: number;
  lastSyncVersion: number;
  lastSavedAt: number | null;
}): SyncFileSnapshot {
  return {
    fileName: record.fileName,
    connectedAt: record.connectedAt,
    lastSyncVersion: record.lastSyncVersion,
    lastSavedAt: record.lastSavedAt,
  };
}

export async function getSyncFileSnapshot(): Promise<SyncFileSnapshot | null> {
  const row = await getSyncFileRecord();
  return row ? snapshotOf(row) : null;
}

/**
 * Write the full v3 envelope to the connected file. The browser's writable
 * stream uses an internal swap file and atomically replaces the target on
 * close — the same guarantee the spec's `db.json.tmp` + rename language
 * describes. The in-envelope `syncVersion` counter is bumped on every
 * successful write.
 */
export async function saveToSyncFile(): Promise<SyncResult<SyncFileSnapshot>> {
  const row = await getSyncFileRecord();
  if (!row) {
    return {
      data: null,
      error: { kind: 'not-connected', message: 'No sync file connected.' },
    };
  }
  const permission = await ensurePermission(row.handle);
  if (permission !== 'granted') {
    return {
      data: null,
      error: {
        kind: 'permission-lost',
        message: 'Write permission for the sync file was revoked. Re-grant access to save.',
      },
    };
  }

  const exported = await exportDatabase();
  const nextVersion = row.lastSyncVersion + 1;
  const envelope: SyncEnvelope = { ...exported, syncVersion: nextVersion };
  const json = JSON.stringify(envelope, null, 2);

  let writable: FileSystemWritableFileStream;
  try {
    writable = await row.handle.createWritable({ keepExistingData: false });
  } catch (e) {
    return {
      data: null,
      error: { kind: 'write-failed', message: e instanceof Error ? e.message : String(e) },
    };
  }
  try {
    await writable.write(json);
    await writable.close();
  } catch (e) {
    try {
      await writable.abort();
    } catch {
      // Ignore — the original error is what matters.
    }
    return {
      data: null,
      error: { kind: 'write-failed', message: e instanceof Error ? e.message : String(e) },
    };
  }

  const updated = {
    ...row,
    lastSyncVersion: nextVersion,
    lastSavedAt: Date.now(),
  };
  await db.syncFile.put(updated);
  return { data: snapshotOf(updated), error: null };
}
