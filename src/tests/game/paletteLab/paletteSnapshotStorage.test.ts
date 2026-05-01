import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  countPaletteSnapshotRecords,
  deletePaletteSnapshotRecord,
  getPaletteSnapshotRecord,
  listPaletteSnapshotRecords,
  PALETTE_SNAPSHOT_DB_NAME,
  PALETTE_SNAPSHOT_DB_VERSION,
  PALETTE_SNAPSHOT_MAX_COUNT,
  PALETTE_SNAPSHOT_STORE_NAME,
  renamePaletteSnapshotRecord,
  savePaletteSnapshotArtifact,
} from "../../../game/paletteLab/snapshotStorage";

type FakeStoreData = {
  keyPath: string;
  records: Map<IDBValidKey, unknown>;
};

class FakeRequest<T> {
  result!: T;
  error: DOMException | null = null;
  onsuccess: ((this: IDBRequest<T>, ev: Event) => any) | null = null;
  onerror: ((this: IDBRequest<T>, ev: Event) => any) | null = null;
}

class FakeOpenRequest extends FakeRequest<IDBDatabase> {
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any) | null = null;
}

class FakeObjectStore {
  constructor(private readonly store: FakeStoreData) {}

  put(value: any): IDBRequest<IDBValidKey> {
    const request = new FakeRequest<IDBValidKey>();
    queueMicrotask(() => {
      const key = value?.[this.store.keyPath];
      this.store.records.set(key, value);
      request.result = key;
      request.onsuccess?.call(request as unknown as IDBRequest<IDBValidKey>, {} as Event);
    });
    return request as unknown as IDBRequest<IDBValidKey>;
  }

  get(key: IDBValidKey): IDBRequest<any> {
    const request = new FakeRequest<any>();
    queueMicrotask(() => {
      request.result = this.store.records.get(key);
      request.onsuccess?.call(request as unknown as IDBRequest<any>, {} as Event);
    });
    return request as unknown as IDBRequest<any>;
  }

  getAll(): IDBRequest<any[]> {
    const request = new FakeRequest<any[]>();
    queueMicrotask(() => {
      request.result = Array.from(this.store.records.values());
      request.onsuccess?.call(request as unknown as IDBRequest<any[]>, {} as Event);
    });
    return request as unknown as IDBRequest<any[]>;
  }

  count(): IDBRequest<number> {
    const request = new FakeRequest<number>();
    queueMicrotask(() => {
      request.result = this.store.records.size;
      request.onsuccess?.call(request as unknown as IDBRequest<number>, {} as Event);
    });
    return request as unknown as IDBRequest<number>;
  }

  delete(key: IDBValidKey): IDBRequest<undefined> {
    const request = new FakeRequest<undefined>();
    queueMicrotask(() => {
      this.store.records.delete(key);
      request.result = undefined;
      request.onsuccess?.call(request as unknown as IDBRequest<undefined>, {} as Event);
    });
    return request as unknown as IDBRequest<undefined>;
  }
}

class FakeTransaction {
  constructor(private readonly stores: Map<string, FakeStoreData>) {}

  objectStore(name: string): IDBObjectStore {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Missing object store: ${name}`);
    }
    return new FakeObjectStore(store) as unknown as IDBObjectStore;
  }
}

class FakeDb {
  readonly objectStoreNames: { contains(name: string): boolean };

  constructor(private readonly stores: Map<string, FakeStoreData>) {
    this.objectStoreNames = {
      contains: (name: string) => this.stores.has(name),
    };
  }

  createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore {
    const keyPath = typeof options?.keyPath === "string" ? options.keyPath : "id";
    const store: FakeStoreData = { keyPath, records: new Map() };
    this.stores.set(name, store);
    return new FakeObjectStore(store) as unknown as IDBObjectStore;
  }

  transaction(storeNames: string | string[], _mode?: IDBTransactionMode): IDBTransaction {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    for (const name of names) {
      if (!this.stores.has(name)) throw new Error(`Missing object store: ${name}`);
    }
    return new FakeTransaction(this.stores) as unknown as IDBTransaction;
  }

  close(): void {}
}

class FakeIndexedDbFactory {
  readonly openCalls: Array<[string, number | undefined]> = [];
  private readonly dbs = new Map<string, { version: number; stores: Map<string, FakeStoreData> }>();

  open(name: string, version?: number): IDBOpenDBRequest {
    this.openCalls.push([name, version]);
    const request = new FakeOpenRequest();

    queueMicrotask(() => {
      let dbEntry = this.dbs.get(name);
      let shouldUpgrade = false;

      if (!dbEntry) {
        dbEntry = { version: version ?? 1, stores: new Map() };
        this.dbs.set(name, dbEntry);
        shouldUpgrade = true;
      } else if (typeof version === "number" && version > dbEntry.version) {
        dbEntry.version = version;
        shouldUpgrade = true;
      }

      request.result = new FakeDb(dbEntry.stores) as unknown as IDBDatabase;
      if (shouldUpgrade) {
        request.onupgradeneeded?.call(request as unknown as IDBOpenDBRequest, {} as IDBVersionChangeEvent);
      }
      request.onsuccess?.call(request as unknown as IDBRequest<IDBDatabase>, {} as Event);
    });

    return request as unknown as IDBOpenDBRequest;
  }

  seedRecord(dbName: string, storeName: string, record: any): void {
    let dbEntry = this.dbs.get(dbName);
    if (!dbEntry) {
      dbEntry = { version: 1, stores: new Map() };
      this.dbs.set(dbName, dbEntry);
    }
    let store = dbEntry.stores.get(storeName);
    if (!store) {
      store = { keyPath: "id", records: new Map() };
      dbEntry.stores.set(storeName, store);
    }
    const key = record?.[store.keyPath];
    store.records.set(key, record);
  }
}

const localStorageSpy = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};

describe("palette snapshot storage", () => {
  let fakeIndexedDb: FakeIndexedDbFactory;

  beforeEach(() => {
    fakeIndexedDb = new FakeIndexedDbFactory();
    (globalThis as any).indexedDB = fakeIndexedDb;
    (globalThis as any).localStorage = localStorageSpy;
    localStorageSpy.getItem.mockReset();
    localStorageSpy.setItem.mockReset();
    localStorageSpy.removeItem.mockReset();
    localStorageSpy.clear.mockReset();
    localStorageSpy.key.mockReset();
  });

  test("stores snapshot JSON state + thumbnail blob in IndexedDB", async () => {
    const artifact = {
      metadata: { id: "snap-1", version: 1, createdAt: 100, name: "Avenue - 2026-03-13 18:32" },
      sceneContext: { mapId: "Avenue", biomeId: "SEWERS", seed: 42 },
      cameraState: { cameraX: 12, cameraY: 15, cameraZoom: 2 },
      worldState: { player: { pgxi: 1, pgyi: 2 }, enemies: [{ id: 0 }], lighting: { darknessAlpha: 0.5 } },
      thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
    } as any;

    await savePaletteSnapshotArtifact(artifact);
    const found = await getPaletteSnapshotRecord("snap-1");
    const all = await listPaletteSnapshotRecords();
    const count = await countPaletteSnapshotRecords();

    expect(found?.metadata).toEqual(artifact.metadata);
    expect(found?.sceneContext).toEqual(artifact.sceneContext);
    expect(found?.cameraState).toEqual(artifact.cameraState);
    expect(found?.worldState).toEqual(artifact.worldState);
    expect(found?.thumbnail).toBeInstanceOf(Blob);
    expect((found?.thumbnail as Blob).size).toBeGreaterThan(0);
    expect(all).toHaveLength(1);
    expect(count).toBe(1);

    const fakeFactory = (globalThis as any).indexedDB as FakeIndexedDbFactory;
    expect(fakeFactory.openCalls[0]).toEqual([PALETTE_SNAPSHOT_DB_NAME, PALETTE_SNAPSHOT_DB_VERSION]);
    expect(localStorageSpy.setItem).not.toHaveBeenCalled();
  });

  test("throws when IndexedDB is unavailable", async () => {
    delete (globalThis as any).indexedDB;
    await expect(
      savePaletteSnapshotArtifact({
        metadata: { id: "snap-2", version: 1, createdAt: 1, name: "x" },
        sceneContext: { mapId: "x" },
        cameraState: { cameraX: 0, cameraY: 0, cameraZoom: 1 },
        worldState: {},
        thumbnail: new Blob(["x"]),
      } as any),
    ).rejects.toThrow(/indexeddb is unavailable/i);
  });

  test("enforces maximum snapshot count without deleting existing snapshots", async () => {
    for (let i = 0; i < PALETTE_SNAPSHOT_MAX_COUNT; i += 1) {
      await savePaletteSnapshotArtifact({
        metadata: { id: `snap-${i}`, version: 1, createdAt: i, name: `Snapshot ${i}` },
        sceneContext: { mapId: "Avenue", biomeId: "SEWERS", seed: i },
        cameraState: { cameraX: i, cameraY: i, cameraZoom: 2 },
        worldState: { player: { pgxi: i, pgyi: i } },
        thumbnail: new Blob([`thumb-${i}`], { type: "image/jpeg" }),
      } as any);
    }

    await expect(
      savePaletteSnapshotArtifact({
        metadata: { id: "snap-over-limit", version: 1, createdAt: 999, name: "overflow" },
        sceneContext: { mapId: "Avenue" },
        cameraState: { cameraX: 0, cameraY: 0, cameraZoom: 1 },
        worldState: {},
        thumbnail: new Blob(["overflow"], { type: "image/jpeg" }),
      } as any),
    ).rejects.toThrow(new RegExp(`limit reached \\(${PALETTE_SNAPSHOT_MAX_COUNT}\\)`, "i"));

    expect(await countPaletteSnapshotRecords()).toBe(PALETTE_SNAPSHOT_MAX_COUNT);
    expect(await getPaletteSnapshotRecord("snap-0")).toBeTruthy();
    expect(await getPaletteSnapshotRecord(`snap-${PALETTE_SNAPSHOT_MAX_COUNT - 1}`)).toBeTruthy();
  });

  test("refuses automatic overwrite when saving an existing snapshot id", async () => {
    const original = {
      metadata: { id: "snap-dup", version: 1, createdAt: 10, name: "Original Snapshot" },
      sceneContext: { mapId: "Avenue", biomeId: "SEWERS", seed: 11 },
      cameraState: { cameraX: 1, cameraY: 2, cameraZoom: 1 },
      worldState: { player: { pgxi: 2, pgyi: 3 } },
      thumbnail: new Blob(["original"], { type: "image/jpeg" }),
    } as any;
    const duplicate = {
      metadata: { id: "snap-dup", version: 1, createdAt: 20, name: "Overwriting Snapshot" },
      sceneContext: { mapId: "Rest", biomeId: "DOCKS", seed: 22 },
      cameraState: { cameraX: 9, cameraY: 9, cameraZoom: 2 },
      worldState: { player: { pgxi: 9, pgyi: 9 } },
      thumbnail: new Blob(["duplicate"], { type: "image/jpeg" }),
    } as any;

    await savePaletteSnapshotArtifact(original);
    await expect(savePaletteSnapshotArtifact(duplicate)).rejects.toThrow(/automatic overwrite is disabled/i);

    const found = await getPaletteSnapshotRecord("snap-dup");
    expect(found?.metadata.name).toBe("Original Snapshot");
    expect(found?.sceneContext.mapId).toBe("Avenue");
  });

  test("rejects snapshot saves that include non-visual world state fields", async () => {
    await expect(
      savePaletteSnapshotArtifact({
        metadata: { id: "snap-bad-scope", version: 1, createdAt: 77, name: "Bad Scope" },
        sceneContext: { mapId: "Avenue", biomeId: "SEWERS", seed: 77 },
        cameraState: { cameraX: 2, cameraY: 3, cameraZoom: 1 },
        worldState: {
          player: { pgxi: 1, pgyi: 2 },
          enemies: [],
          lighting: { darknessAlpha: 0.5 },
          inventorySave: { gold: 99 },
        },
        thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
      } as any),
    ).rejects.toThrow(/unsupported non-visual fields/i);
  });

  test("fails loudly when reading unsupported snapshot versions", async () => {
    fakeIndexedDb.seedRecord(PALETTE_SNAPSHOT_DB_NAME, PALETTE_SNAPSHOT_STORE_NAME, {
      id: "snap-v2",
      metadata: { id: "snap-v2", version: 2, createdAt: 1, name: "v2" },
      sceneContext: { mapId: "Avenue" },
      cameraState: { cameraX: 0, cameraY: 0, cameraZoom: 1 },
      worldState: {},
      thumbnail: new Blob(["v2"], { type: "image/jpeg" }),
    });

    await expect(getPaletteSnapshotRecord("snap-v2")).rejects.toThrow(/unsupported palette snapshot version 2/i);
  });

  test("renames a snapshot record without changing other fields", async () => {
    const artifact = {
      metadata: { id: "snap-rename", version: 1, createdAt: 100, name: "Original Name" },
      sceneContext: { mapId: "Avenue", biomeId: "SEWERS", seed: 42 },
      cameraState: { cameraX: 12, cameraY: 15, cameraZoom: 2 },
      worldState: { player: { pgxi: 1, pgyi: 2 } },
      thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
    } as any;

    await savePaletteSnapshotArtifact(artifact);
    const renamed = await renamePaletteSnapshotRecord("snap-rename", "Renamed Snapshot");
    const found = await getPaletteSnapshotRecord("snap-rename");

    expect(renamed.metadata.name).toBe("Renamed Snapshot");
    expect(found?.metadata.name).toBe("Renamed Snapshot");
    expect(found?.sceneContext).toEqual(artifact.sceneContext);
    expect(found?.cameraState).toEqual(artifact.cameraState);
    expect(found?.worldState).toEqual(artifact.worldState);
  });

  test("deletes a snapshot record only after explicit delete call", async () => {
    await savePaletteSnapshotArtifact({
      metadata: { id: "snap-delete", version: 1, createdAt: 200, name: "Delete Me" },
      sceneContext: { mapId: "Avenue" },
      cameraState: { cameraX: 0, cameraY: 0, cameraZoom: 1 },
      worldState: {},
      thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
    } as any);

    expect(await countPaletteSnapshotRecords()).toBe(1);
    expect(await deletePaletteSnapshotRecord("missing-id")).toBe(false);
    expect(await countPaletteSnapshotRecords()).toBe(1);

    expect(await deletePaletteSnapshotRecord("snap-delete")).toBe(true);
    expect(await countPaletteSnapshotRecords()).toBe(0);
    expect(await getPaletteSnapshotRecord("snap-delete")).toBeUndefined();
  });
});
