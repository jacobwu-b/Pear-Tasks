import { db } from './schema';
import { exportDatabase, importDatabase, type PearExport } from './exportImport';

/**
 * The on-disk envelope is the v3 export envelope plus a monotonic `syncVersion`
 * counter that bumps on every successful save, and a `writtenBy` session tag
 * so a tab can tell its own writes apart from external ones during polling.
 * Schema `version` stays at 3 so the file remains a valid Pear export that
 * can also be imported via the normal Import flow.
 */
export interface SyncEnvelope extends PearExport {
  syncVersion: number;
  /** Session ID of the tab that produced this write. */
  writtenBy: string;
}

/**
 * Per-page-load session ID. Used as the `writtenBy` tag on every write so the
 * polling loop can ignore writes we made ourselves and avoid a self-reload.
 */
const SESSION_ID: string = (() => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}-${Date.now()}`;
})();

export function getSyncSessionId(): string {
  return SESSION_ID;
}

/**
 * Last file mtime we observed. Used by the poll loop to short-circuit the
 * common "file unchanged" path before parsing. Module-scoped: there is at most
 * one sync file per tab.
 */
let lastSeenMtime: number | null = null;

/** Test seam — reset module state so each test starts from a clean slate. */
export function __resetSyncPollStateForTests(): void {
  lastSeenMtime = null;
  resetSyncQueueState();
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
  const envelope: SyncEnvelope = {
    ...exported,
    syncVersion: nextVersion,
    writtenBy: SESSION_ID,
  };
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

  // Update the cached mtime so the next poll's mtime-equal short-circuit
  // catches our own write without re-parsing the envelope. The writtenBy tag
  // check is the real guard, but this avoids the extra work in the hot path.
  try {
    const f = await row.handle.getFile();
    lastSeenMtime = f.lastModified;
  } catch {
    // If we can't read the file back, the next poll will simply re-parse.
  }

  return { data: snapshotOf(updated), error: null };
}

/**
 * Result of a single poll tick.
 * - 'no-change'   — mtime matched the last seen value; nothing was read.
 * - 'self-write'  — file changed but the envelope's writtenBy tag is ours.
 * - 'local-ahead' — file's syncVersion is not greater than what we last saved;
 *                   the in-memory DB is the source.
 * - 'reloaded'    — external bump detected; Dexie tables were atomically
 *                   replaced from the file.
 */
export type PollAction = 'no-change' | 'self-write' | 'local-ahead' | 'reloaded';

export interface PollOutcome {
  action: PollAction;
  syncVersion: number | null;
}

/**
 * Read the connected sync file once and reconcile it with the local DB.
 *
 * Spec (0002 §M2): every 3s while the tab is visible, check the file's mtime.
 * On an external version bump (writtenBy !== our session AND syncVersion >
 * local lastSyncVersion), atomically replace Dexie tables in a transaction
 * and bump the local lastSyncVersion. Self-writes and stale files are no-ops.
 */
export async function pollSyncFile(): Promise<SyncResult<PollOutcome>> {
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
        message: 'Read permission for the sync file was revoked.',
      },
    };
  }

  let file: { lastModified: number; text: () => Promise<string> };
  try {
    file = await row.handle.getFile();
  } catch (e) {
    return {
      data: null,
      error: { kind: 'read-failed', message: e instanceof Error ? e.message : String(e) },
    };
  }

  if (lastSeenMtime !== null && file.lastModified === lastSeenMtime) {
    return {
      data: { action: 'no-change', syncVersion: row.lastSyncVersion },
      error: null,
    };
  }
  lastSeenMtime = file.lastModified;

  let parsed: SyncEnvelope;
  try {
    const text = await file.text();
    parsed = JSON.parse(text) as SyncEnvelope;
  } catch (e) {
    return {
      data: null,
      error: { kind: 'read-failed', message: e instanceof Error ? e.message : String(e) },
    };
  }

  if (parsed.writtenBy === SESSION_ID) {
    return {
      data: { action: 'self-write', syncVersion: parsed.syncVersion ?? null },
      error: null,
    };
  }

  if (typeof parsed.syncVersion !== 'number' || parsed.syncVersion <= row.lastSyncVersion) {
    return {
      data: { action: 'local-ahead', syncVersion: parsed.syncVersion ?? null },
      error: null,
    };
  }

  const importResult = await importDatabase(parsed);
  if (!importResult.ok) {
    return {
      data: null,
      error: { kind: 'read-failed', message: importResult.error },
    };
  }
  await db.syncFile.put({ ...row, lastSyncVersion: parsed.syncVersion });
  return {
    data: { action: 'reloaded', syncVersion: parsed.syncVersion },
    error: null,
  };
}

// ── Debounced write-through queue ──────────────────────────────────
//
// Spec 0002 §M2: every Dexie mutation enqueues a sync write. Writes
// coalesce on a 300ms debounce so a bulk operation inside a single
// `db.transaction('rw', …)` produces exactly one file write. On failure,
// the flush retries with exponential backoff up to MAX_ATTEMPTS times
// before surfacing the error to registered listeners.

const DEBOUNCE_MS = 300;
const MAX_ATTEMPTS = 3;
/** Backoff between retries. Indexed by attempt number (1-based). */
const BACKOFF_MS = [0, 600, 1200];

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let pendingAfterFlight = false;

type SyncErrorListener = (error: SyncError) => void;
type SyncSuccessListener = (snapshot: SyncFileSnapshot) => void;
const errorListeners = new Set<SyncErrorListener>();
const successListeners = new Set<SyncSuccessListener>();

/**
 * Subscribe to write-through failures that have exhausted all retries.
 * Returns an unsubscribe function. Used by the UI to surface a toast.
 */
export function onSyncWriteError(listener: SyncErrorListener): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

/**
 * Subscribe to successful write-through flushes. Used by the UI to refresh
 * the displayed lastSyncVersion / lastSavedAt without polling Dexie.
 */
export function onSyncWriteSuccess(listener: SyncSuccessListener): () => void {
  successListeners.add(listener);
  return () => successListeners.delete(listener);
}

function notifyError(error: SyncError): void {
  for (const l of errorListeners) {
    try {
      l(error);
    } catch {
      // A bad listener should never break the sync loop.
    }
  }
}

/**
 * Enqueue a sync-file write. Coalesces multiple calls within DEBOUNCE_MS into
 * a single save. No-op if no sync file is connected.
 *
 * Safe to call from any CRUD function. Errors are routed to listeners — the
 * caller's Result<T> is not affected by the eventual write outcome.
 */
export function enqueueSyncWrite(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
  }
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void runFlush();
  }, DEBOUNCE_MS);
}

async function runFlush(): Promise<void> {
  if (inFlight) {
    // A flush is already running; record that more work arrived so we run
    // again after it completes. Otherwise we could lose the most recent edit.
    pendingAfterFlight = true;
    return;
  }
  inFlight = true;
  try {
    // Skip silently if no sync file is connected — write-through is an
    // opt-in feature. The user has not asked us to save anywhere.
    const row = await getSyncFileRecord();
    if (!row) return;

    let lastError: SyncError | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        await delay(BACKOFF_MS[attempt - 1]);
      }
      const result = await saveToSyncFile();
      if (!result.error) {
        lastError = null;
        for (const l of successListeners) {
          try {
            l(result.data);
          } catch {
            // A bad listener should never break the sync loop.
          }
        }
        break;
      }
      lastError = result.error;
      // Don't burn retries on errors that can't be fixed by retrying.
      if (
        result.error.kind === 'not-connected' ||
        result.error.kind === 'permission-lost' ||
        result.error.kind === 'unsupported'
      ) {
        break;
      }
    }
    if (lastError) notifyError(lastError);
  } finally {
    inFlight = false;
    if (pendingAfterFlight) {
      pendingAfterFlight = false;
      // A new edit landed during the flush — run another debounced save so
      // the file catches up. Use the same debounce window so further edits
      // can still coalesce into it.
      enqueueSyncWrite();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Force the pending debounced write to fire immediately. Used by tests. */
export async function flushSyncWritesNow(): Promise<void> {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  await runFlush();
}

function resetSyncQueueState(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  inFlight = false;
  pendingAfterFlight = false;
  errorListeners.clear();
  successListeners.clear();
}

export interface StartSyncPollingOptions {
  /** Poll interval in ms. Defaults to 3000 per spec 0002. */
  intervalMs?: number;
  /** Called when an external version bump has been applied to Dexie. */
  onReload?: (outcome: PollOutcome) => void;
  /** Called for any poll error worth surfacing to the user (e.g. permission). */
  onError?: (error: SyncError) => void;
}

/**
 * Start polling the connected sync file. The loop is gated by the Page
 * Visibility API: polls only fire while document.visibilityState === 'visible',
 * and an immediate tick fires whenever the tab returns to visible.
 *
 * Returns a stop function that removes the visibility listener and clears the
 * interval. Safe to call in environments without `document` (the loop just
 * runs unconditionally) so the same hook works for tests.
 */
export function startSyncPolling(opts: StartSyncPollingOptions = {}): () => void {
  const intervalMs = opts.intervalMs ?? 3000;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  const tick = async (): Promise<void> => {
    if (inFlight) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    inFlight = true;
    try {
      const result = await pollSyncFile();
      if (result.error) {
        // 'not-connected' is the steady state before the user picks a file;
        // it's not worth surfacing.
        if (result.error.kind !== 'not-connected') opts.onError?.(result.error);
        return;
      }
      if (result.data.action === 'reloaded') opts.onReload?.(result.data);
    } finally {
      inFlight = false;
    }
  };

  const start = (): void => {
    if (timer !== null) return;
    timer = setInterval(() => {
      void tick();
    }, intervalMs);
  };
  const stop = (): void => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  const onVisibility = (): void => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      void tick();
      start();
    } else {
      stop();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'visible') start();
  } else {
    start();
  }

  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    stop();
  };
}
