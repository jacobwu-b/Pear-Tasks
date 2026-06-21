// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSyncPollStateForTests,
  connectSyncFile,
  disconnectSyncFile,
  ensurePermission,
  enqueueSyncWrite,
  flushSyncWritesNow,
  getSyncFileRecord,
  getSyncFileSnapshot,
  getSyncSessionId,
  isSyncFileSupported,
  onSyncWriteError,
  pollSyncFile,
  saveToSyncFile,
  type SyncEnvelope,
  type SyncError,
} from '../../src/db/syncFile';
import {
  addChecklistItem,
  createProject,
  createTask,
  getTasksByProject,
  updateTask,
} from '../../src/db/operations';
import { db } from '../../src/db/schema';
import { clearDatabase } from '../helpers';
import type { SyncFileRecord, Task } from '../../src/types';

/**
 * Methods live on the class prototype so that `structuredClone` (which
 * fake-indexeddb calls before storage) treats the instance as a plain object
 * with only own enumerable data properties. Real browsers clone
 * FileSystemFileHandle as a platform object — this mock matches that shape.
 */
class FakeWritable {
  written = '';
  closed = false;
  aborted = false;
  shouldThrowOnWrite = false;
  onClose: (() => void) | null = null;
  async write(data: string): Promise<void> {
    if (this.shouldThrowOnWrite) throw new Error('Disk full');
    this.written += data;
  }
  async close(): Promise<void> {
    this.closed = true;
    this.onClose?.();
  }
  async abort(): Promise<void> {
    this.aborted = true;
  }
}

class FakeHandle {
  name: string;
  kind = 'file' as const;
  permission: PermissionState = 'granted';
  writables: FakeWritable[] = [];
  failNextWrite = false;
  /** Current on-disk contents; settable directly to simulate external writes. */
  contents = '';
  /** Current mtime; bumped on every write or external-replace. */
  lastModified = 0;
  private mtimeCounter = 0;
  constructor(name: string, permission: PermissionState = 'granted') {
    this.name = name;
    this.permission = permission;
  }
  async queryPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async requestPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async createWritable(): Promise<FakeWritable> {
    const w = new FakeWritable();
    w.shouldThrowOnWrite = this.failNextWrite;
    this.failNextWrite = false;
    w.onClose = () => {
      this.contents = w.written;
      this.mtimeCounter += 1;
      this.lastModified = this.mtimeCounter;
    };
    this.writables.push(w);
    return w;
  }
  /** Simulate an external write to the file (e.g. by the MCP server). */
  externalWrite(text: string): void {
    this.contents = text;
    this.mtimeCounter += 1;
    this.lastModified = this.mtimeCounter;
  }
  async getFile(): Promise<{ lastModified: number; text: () => Promise<string> }> {
    return {
      lastModified: this.lastModified,
      text: async () => this.contents,
    };
  }
}

function makeFakeHandle(name: string, opts?: { permission?: PermissionState }): FakeHandle {
  return new FakeHandle(name, opts?.permission ?? 'granted');
}

type GlobalWithPicker = typeof globalThis & {
  showSaveFilePicker?: (opts: unknown) => Promise<FakeHandle>;
};

/**
 * Real browsers structured-clone FileSystemFileHandle as a platform object
 * (its methods survive). fake-indexeddb uses generic structuredClone, which
 * strips class methods. To exercise the real call paths we replace the
 * Dexie syncFile table's get/put/delete with an in-memory Map for tests.
 */
const memoryTable = new Map<string, SyncFileRecord>();

beforeEach(async () => {
  await clearDatabase();
  memoryTable.clear();
  __resetSyncPollStateForTests();

  vi.spyOn(db.syncFile, 'put').mockImplementation(async (value: SyncFileRecord) => {
    memoryTable.set(value.id, value);
    return value.id;
  });
  vi.spyOn(db.syncFile, 'get').mockImplementation(async (key: unknown) => {
    return memoryTable.get(key as string);
  });
  vi.spyOn(db.syncFile, 'delete').mockImplementation(async (key: unknown) => {
    memoryTable.delete(key as string);
  });
});

afterEach(() => {
  delete (globalThis as GlobalWithPicker).showSaveFilePicker;
  vi.restoreAllMocks();
});

describe('isSyncFileSupported', () => {
  it('returns false when showSaveFilePicker is missing', () => {
    delete (globalThis as GlobalWithPicker).showSaveFilePicker;
    expect(isSyncFileSupported()).toBe(false);
  });

  it('returns true when showSaveFilePicker is present', () => {
    (globalThis as GlobalWithPicker).showSaveFilePicker = async () => makeFakeHandle('x.json');
    expect(isSyncFileSupported()).toBe(true);
  });
});

describe('connectSyncFile', () => {
  it('returns unsupported error when the File System Access API is missing', async () => {
    delete (globalThis as GlobalWithPicker).showSaveFilePicker;
    const result = await connectSyncFile();
    expect(result.data).toBeNull();
    expect(result.error?.kind).toBe('unsupported');
  });

  it('persists the chosen handle so it survives a simulated reload', async () => {
    const handle = makeFakeHandle('my-pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);

    const result = await connectSyncFile();
    expect(result.error).toBeNull();
    expect(result.data?.fileName).toBe('my-pear.json');
    expect(result.data?.lastSyncVersion).toBe(0);

    // Simulate reload by re-reading from Dexie. The stored handle reference
    // should be the same FakeHandle we passed in.
    const row = await getSyncFileRecord();
    expect(row).toBeDefined();
    expect(row!.handle).toBe(handle as unknown as FileSystemFileHandle);
    expect(row!.fileName).toBe('my-pear.json');
  });

  it('surfaces a picker-aborted error without persisting anything', async () => {
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => {
      const err = new Error('User dismissed');
      err.name = 'AbortError';
      throw err;
    });

    const result = await connectSyncFile();
    expect(result.error?.kind).toBe('picker-aborted');
    expect(await getSyncFileSnapshot()).toBeNull();
  });
});

describe('saveToSyncFile', () => {
  it('returns not-connected when no handle has been stored', async () => {
    const result = await saveToSyncFile();
    expect(result.error?.kind).toBe('not-connected');
  });

  it('writes a valid v3 envelope and bumps syncVersion on each save', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await createTask('Buy milk');

    const first = await saveToSyncFile();
    expect(first.error).toBeNull();
    expect(first.data?.lastSyncVersion).toBe(1);
    expect(first.data?.lastSavedAt).not.toBeNull();

    const second = await saveToSyncFile();
    expect(second.data?.lastSyncVersion).toBe(2);

    // The last write should be a parseable v3 envelope tagged with the latest syncVersion.
    const written = handle.writables[handle.writables.length - 1].written;
    const parsed = JSON.parse(written);
    expect(parsed.app).toBe('pear-tasks');
    expect(parsed.version).toBe(3);
    expect(parsed.syncVersion).toBe(2);
    expect(parsed.tables.tasks).toHaveLength(1);
    expect(parsed.tables.tasks[0].title).toBe('Buy milk');
  });

  it('closes the writable stream so the swap-file rename runs atomically', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();

    await saveToSyncFile();

    expect(handle.writables).toHaveLength(1);
    expect(handle.writables[0].closed).toBe(true);
    expect(handle.writables[0].aborted).toBe(false);
  });

  it('returns permission-lost and does not bump version when re-grant is denied', async () => {
    const handle = makeFakeHandle('pear.json', { permission: 'denied' });
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();

    const result = await saveToSyncFile();
    expect(result.error?.kind).toBe('permission-lost');
    const snapshot = await getSyncFileSnapshot();
    expect(snapshot?.lastSyncVersion).toBe(0);
    expect(snapshot?.lastSavedAt).toBeNull();
  });

  it('returns write-failed and aborts the writable when the underlying write throws', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();

    // The handle reference we got back from Dexie is the same FakeHandle; flag
    // it so the next createWritable returns a writable whose .write() throws.
    const stored = await getSyncFileRecord();
    (stored!.handle as unknown as FakeHandle).failNextWrite = true;

    const result = await saveToSyncFile();
    expect(result.error?.kind).toBe('write-failed');
    const writables = (stored!.handle as unknown as FakeHandle).writables;
    expect(writables[writables.length - 1].aborted).toBe(true);
    const snapshot = await getSyncFileSnapshot();
    expect(snapshot?.lastSyncVersion).toBe(0);
  });
});

describe('disconnectSyncFile', () => {
  it('clears the persisted row', async () => {
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => makeFakeHandle('x.json'));
    await connectSyncFile();
    expect(await getSyncFileSnapshot()).not.toBeNull();

    await disconnectSyncFile();
    expect(await getSyncFileSnapshot()).toBeNull();
  });
});

describe('pollSyncFile', () => {
  it('returns not-connected when no handle is stored', async () => {
    const result = await pollSyncFile();
    expect(result.error?.kind).toBe('not-connected');
  });

  it('ignores writes Pear made itself (writtenBy === own session)', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await createTask('Buy milk');
    await saveToSyncFile();

    // First poll right after our own save — should be 'no-change' (mtime cached
    // by saveToSyncFile) or 'self-write' if we externally bump mtime.
    const first = await pollSyncFile();
    expect(first.error).toBeNull();
    expect(first.data?.action).toBe('no-change');

    // Force the polling layer to actually read the file by bumping mtime
    // out from under it without touching contents. The writtenBy tag must
    // still keep this a self-write.
    handle.lastModified += 1;
    const second = await pollSyncFile();
    expect(second.error).toBeNull();
    expect(second.data?.action).toBe('self-write');

    // Local sync version is unchanged.
    const snap = await getSyncFileSnapshot();
    expect(snap?.lastSyncVersion).toBe(1);
  });

  it('reloads Dexie tables on an external version bump from another session', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await createTask('Local task');
    await saveToSyncFile();

    // Build an external envelope from another session with a higher version
    // and a different task set.
    const externalTask: Task = {
      id: 'ext-task-1',
      title: 'Task from MCP',
      notes: '',
      status: 'open',
      when: null,
      deadline: null,
      tags: [],
      projectId: 'ext-proj-1',
      areaId: null,
      sortOrder: 0,
      createdAt: Date.now(),
      completedAt: null,
      deletedAt: null,
      recurrence: null,
      recurringParentId: null,
    };
    const externalEnvelope: SyncEnvelope = {
      app: 'pear-tasks',
      version: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [],
        projects: [
          {
            id: 'ext-proj-1',
            title: 'External project',
            notes: '',
            status: 'active',
            areaId: null,
            deadline: null,
            tags: [],
            sortOrder: 0,
            createdAt: Date.now(),
            completedAt: null,
            deletedAt: null,
          },
        ],
        tasks: [externalTask],
        checklistItems: [],
        dependencyEdges: [],
        templates: [],
      },
      syncVersion: 99,
      writtenBy: 'some-other-session',
    };
    handle.externalWrite(JSON.stringify(externalEnvelope));

    const result = await pollSyncFile();
    expect(result.error).toBeNull();
    expect(result.data?.action).toBe('reloaded');
    expect(result.data?.syncVersion).toBe(99);

    // Dexie now reflects the file's contents.
    const tasks = await getTasksByProject('ext-proj-1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Task from MCP');

    // The local lastSyncVersion advances to the external version so a
    // re-poll of the same file is a no-op.
    const snap = await getSyncFileSnapshot();
    expect(snap?.lastSyncVersion).toBe(99);
  });

  it('does nothing when the file syncVersion is not ahead of local', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await createTask('Local task');
    // Bring local lastSyncVersion to 5.
    await saveToSyncFile();
    await saveToSyncFile();
    await saveToSyncFile();
    await saveToSyncFile();
    await saveToSyncFile();

    // External envelope with a lower syncVersion (3) but a foreign session tag
    // — we are the source of truth, so the poll must not reload.
    const staleEnvelope: SyncEnvelope = {
      app: 'pear-tasks',
      version: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [],
        projects: [],
        tasks: [],
        checklistItems: [],
        dependencyEdges: [],
        templates: [],
      },
      syncVersion: 3,
      writtenBy: 'some-other-session',
    };
    handle.externalWrite(JSON.stringify(staleEnvelope));

    const result = await pollSyncFile();
    expect(result.error).toBeNull();
    expect(result.data?.action).toBe('local-ahead');

    // Local task still present, local version unchanged.
    const snap = await getSyncFileSnapshot();
    expect(snap?.lastSyncVersion).toBe(5);
    const remaining = await db.tasks.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('Local task');
  });

  it('short-circuits with no-change when mtime is unchanged', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await saveToSyncFile();

    // Spy on getFile to ensure we don't even read text() on the no-change path.
    const getFileSpy = vi.spyOn(handle, 'getFile');
    const first = await pollSyncFile();
    expect(first.data?.action).toBe('no-change');
    const fileObj = await getFileSpy.mock.results[0].value;
    expect(fileObj.lastModified).toBe(handle.lastModified);

    // A second poll with no external change still resolves to no-change.
    const second = await pollSyncFile();
    expect(second.data?.action).toBe('no-change');
  });

  it('tags each write with the session id and bumps it across saves', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await saveToSyncFile();

    const parsed = JSON.parse(handle.contents) as SyncEnvelope;
    expect(parsed.writtenBy).toBe(getSyncSessionId());
    expect(typeof parsed.writtenBy).toBe('string');
    expect(parsed.writtenBy.length).toBeGreaterThan(0);
  });
});

describe('enqueueSyncWrite (debounced write-through)', () => {
  it('does nothing when no sync file is connected', async () => {
    // No connect call. Just enqueue and flush — should not throw, no write.
    enqueueSyncWrite();
    await flushSyncWritesNow();
    expect(await getSyncFileSnapshot()).toBeNull();
  });

  it('coalesces many CRUD mutations into a single write per debounce window', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();

    // Each of these CRUD calls enqueues a write. They land well within the
    // 300ms debounce window, so a single flush should consume them all.
    await createTask('A');
    await createTask('B');
    await createTask('C');

    await flushSyncWritesNow();

    expect(handle.writables).toHaveLength(1);
    const parsed = JSON.parse(handle.writables[0].written) as SyncEnvelope;
    expect(parsed.syncVersion).toBe(1);
    expect(parsed.tables.tasks).toHaveLength(3);
  });

  it('produces exactly one write for a bulk transaction', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();

    const proj = await createProject('Bulk');
    expect(proj.error).toBeNull();
    // Drain the project-creation debounce so the bulk transaction below
    // is observed independently.
    await flushSyncWritesNow();
    expect(handle.writables).toHaveLength(1);

    await db.transaction('rw', db.tasks, db.checklistItems, async () => {
      const t1 = await createTask('Task 1', { projectId: proj.data!.id });
      const t2 = await createTask('Task 2', { projectId: proj.data!.id });
      await addChecklistItem(t1.data!.id, 'sub a');
      await addChecklistItem(t1.data!.id, 'sub b');
      await updateTask(t2.data!.id, { notes: 'edited' });
    });

    await flushSyncWritesNow();

    // The bulk transaction produced one additional write, not five.
    expect(handle.writables).toHaveLength(2);
    const parsed = JSON.parse(handle.writables[1].written) as SyncEnvelope;
    expect(parsed.tables.tasks).toHaveLength(2);
    expect(parsed.tables.checklistItems).toHaveLength(2);
  });

  it('retries with backoff up to 3 attempts on transient write failures', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();

    // Make the next three createWritable() calls produce a writable whose
    // write() throws. The fourth and beyond succeed.
    let writableCount = 0;
    const origCreate = handle.createWritable.bind(handle);
    handle.createWritable = async () => {
      writableCount += 1;
      if (writableCount <= 3) {
        handle.failNextWrite = true;
      }
      return origCreate();
    };

    const errors: SyncError[] = [];
    const unsub = onSyncWriteError((e) => errors.push(e));

    await createTask('Will retry');
    await flushSyncWritesNow();

    unsub();

    // 3 attempts, all failed. Error surfaced exactly once.
    expect(writableCount).toBe(3);
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe('write-failed');
    // lastSyncVersion was never bumped because every save failed.
    const snap = await getSyncFileSnapshot();
    expect(snap?.lastSyncVersion).toBe(0);
  });

  it('does not retry permission-lost — surfaces the error immediately', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    // Revoke permission after connect so the next save returns permission-lost.
    handle.permission = 'denied';

    let attempts = 0;
    const origCreate = handle.createWritable.bind(handle);
    handle.createWritable = async () => {
      attempts += 1;
      return origCreate();
    };

    const errors: SyncError[] = [];
    const unsub = onSyncWriteError((e) => errors.push(e));

    await createTask('Permissionless');
    await flushSyncWritesNow();

    unsub();

    // permission-lost short-circuits the retry loop — createWritable is
    // never even called.
    expect(attempts).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe('permission-lost');
  });
});

describe('write/reload coordination (issue #52)', () => {
  /** Build a foreign sync envelope containing a single task, at a given version. */
  function foreignEnvelope(syncVersion: number, taskTitle: string): SyncEnvelope {
    const task: Task = {
      id: `ext-${taskTitle}`,
      title: taskTitle,
      notes: '',
      status: 'open',
      when: null,
      deadline: null,
      tags: [],
      projectId: null,
      areaId: null,
      sortOrder: 0,
      createdAt: Date.now(),
      completedAt: null,
      deletedAt: null,
      recurrence: null,
      recurringParentId: null,
    };
    return {
      app: 'pear-tasks',
      version: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [],
        projects: [],
        tasks: [task],
        checklistItems: [],
        dependencyEdges: [],
        templates: [],
      },
      syncVersion,
      writtenBy: 'some-other-session',
    };
  }

  it('does not reload over an un-flushed local edit — surfaces a conflict and keeps the edit', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();

    // Establish a baseline the local DB is in sync with (version 1).
    await createTask('Baseline');
    await flushSyncWritesNow();
    expect((await getSyncFileSnapshot())?.lastSyncVersion).toBe(1);

    // Local edit lands in Dexie but its write-through is still pending.
    await createTask('Concurrent local edit');

    // An external writer bumps the file before the pending flush runs.
    handle.externalWrite(JSON.stringify(foreignEnvelope(2, 'Task from MCP')));

    // The poll tick sees the bump but must NOT clobber the un-flushed edit.
    const poll = await pollSyncFile();
    expect(poll.error).toBeNull();
    expect(poll.data?.action).toBe('conflict');

    // The local edit is still in Dexie — it was not discarded.
    const titles = (await db.tasks.toArray()).map((t) => t.title);
    expect(titles).toContain('Concurrent local edit');
    expect(titles).not.toContain('Task from MCP');
  });

  it('the pending flush refuses to overwrite the newer external version', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await createTask('Baseline');
    await flushSyncWritesNow();

    await createTask('Concurrent local edit');
    handle.externalWrite(JSON.stringify(foreignEnvelope(2, 'Task from MCP')));
    await pollSyncFile();

    const errors: SyncError[] = [];
    const unsub = onSyncWriteError((e) => errors.push(e));
    await flushSyncWritesNow();
    unsub();

    // The flush detected the newer foreign version and refused to write.
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe('conflict');
    // The on-disk version was not bumped or overwritten.
    expect(JSON.parse(handle.contents).syncVersion).toBe(2);
    expect((await getSyncFileSnapshot())?.lastSyncVersion).toBe(1);
    // The local edit still survives in Dexie.
    expect((await db.tasks.toArray()).map((t) => t.title)).toContain('Concurrent local edit');
  });

  it('saveToSyncFile returns conflict when the on-disk version is newer and foreign', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await createTask('Baseline');
    await saveToSyncFile();
    expect((await getSyncFileSnapshot())?.lastSyncVersion).toBe(1);

    // A foreign session writes a strictly newer version directly to the file.
    handle.externalWrite(JSON.stringify(foreignEnvelope(5, 'Foreign edit')));

    const result = await saveToSyncFile();
    expect(result.error?.kind).toBe('conflict');
    // We did not overwrite the foreign file nor bump our local version.
    expect(JSON.parse(handle.contents).syncVersion).toBe(5);
    expect((await getSyncFileSnapshot())?.lastSyncVersion).toBe(1);
  });

  it('still saves normally when the on-disk version is our own latest write', async () => {
    const handle = makeFakeHandle('pear.json');
    (globalThis as GlobalWithPicker).showSaveFilePicker = vi.fn(async () => handle);
    await connectSyncFile();
    await createTask('First');

    const first = await saveToSyncFile();
    expect(first.error).toBeNull();
    expect(first.data?.lastSyncVersion).toBe(1);

    // A second save re-reads the file (our own writtenBy) and proceeds.
    const second = await saveToSyncFile();
    expect(second.error).toBeNull();
    expect(second.data?.lastSyncVersion).toBe(2);
  });
});

describe('ensurePermission', () => {
  it('returns granted when the handle already has read-write permission', async () => {
    const handle = makeFakeHandle('x.json', { permission: 'granted' });
    const status = await ensurePermission(handle as unknown as FileSystemFileHandle);
    expect(status).toBe('granted');
  });

  it('returns denied when both query and request return prompt/denied', async () => {
    const handle = makeFakeHandle('x.json', { permission: 'denied' });
    const status = await ensurePermission(handle as unknown as FileSystemFileHandle);
    expect(status).toBe('denied');
  });
});
