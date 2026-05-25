// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectSyncFile,
  disconnectSyncFile,
  ensurePermission,
  getSyncFileRecord,
  getSyncFileSnapshot,
  isSyncFileSupported,
  saveToSyncFile,
} from '../../src/db/syncFile';
import { createTask } from '../../src/db/operations';
import { db } from '../../src/db/schema';
import { clearDatabase } from '../helpers';
import type { SyncFileRecord } from '../../src/types';

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
  async write(data: string): Promise<void> {
    if (this.shouldThrowOnWrite) throw new Error('Disk full');
    this.written += data;
  }
  async close(): Promise<void> {
    this.closed = true;
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
    this.writables.push(w);
    return w;
  }
  async getFile(): Promise<{ text: () => Promise<string> }> {
    const last = this.writables[this.writables.length - 1];
    return { text: async () => last?.written ?? '' };
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
