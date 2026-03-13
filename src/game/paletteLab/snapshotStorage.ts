import type { PaletteSnapshotArtifact } from "./terminology";
import { PALETTE_SNAPSHOT_SCHEMA_VERSION } from "./snapshotSchema";
import { assertPaletteSnapshotWorldStateScope } from "./scope";

export const PALETTE_SNAPSHOT_DB_NAME = "ratgame.paletteSnapshots";
export const PALETTE_SNAPSHOT_DB_VERSION = 1;
export const PALETTE_SNAPSHOT_STORE_NAME = "snapshots";
export const PALETTE_SNAPSHOT_MAX_COUNT = 50;

export type PaletteSnapshotStorageRecord = {
  id: string;
  metadata: PaletteSnapshotArtifact["metadata"];
  sceneContext: PaletteSnapshotArtifact["sceneContext"];
  cameraState: PaletteSnapshotArtifact["cameraState"];
  worldState: PaletteSnapshotArtifact["worldState"];
  thumbnail: Blob;
};

function normalizeSnapshotName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Palette snapshot name cannot be empty.");
  }
  return normalized;
}

function assertSupportedSnapshotVersion(version: unknown, context: string): void {
  if (!Number.isFinite(version)) {
    throw new Error(`Palette snapshot ${context} is missing metadata.version.`);
  }
  const numericVersion = Number(version);
  if (numericVersion !== PALETTE_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported palette snapshot version ${numericVersion}. Migration required (current=${PALETTE_SNAPSHOT_SCHEMA_VERSION}).`,
    );
  }
}

function normalizePaletteSnapshotRecord(record: unknown, context: string): PaletteSnapshotStorageRecord {
  if (!record || typeof record !== "object") {
    throw new Error(`Palette snapshot ${context} is malformed.`);
  }
  const typed = record as PaletteSnapshotStorageRecord;
  assertSupportedSnapshotVersion((typed as any)?.metadata?.version, context);
  return typed;
}

function ensureIndexedDb(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable for palette snapshot storage.");
  }
  return indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function openPaletteSnapshotDb(): Promise<IDBDatabase> {
  const factory = ensureIndexedDb();
  const request = factory.open(PALETTE_SNAPSHOT_DB_NAME, PALETTE_SNAPSHOT_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(PALETTE_SNAPSHOT_STORE_NAME)) {
      db.createObjectStore(PALETTE_SNAPSHOT_STORE_NAME, { keyPath: "id" });
    }
  };
  return requestToPromise(request);
}

function toStorageRecord(artifact: PaletteSnapshotArtifact): PaletteSnapshotStorageRecord {
  assertSupportedSnapshotVersion(artifact?.metadata?.version, "write payload");
  assertPaletteSnapshotWorldStateScope(artifact.worldState);
  return {
    id: artifact.metadata.id,
    metadata: artifact.metadata,
    sceneContext: artifact.sceneContext,
    cameraState: artifact.cameraState,
    worldState: artifact.worldState,
    thumbnail: artifact.thumbnail,
  };
}

export async function savePaletteSnapshotArtifact(
  artifact: PaletteSnapshotArtifact,
): Promise<PaletteSnapshotStorageRecord> {
  const db = await openPaletteSnapshotDb();
  try {
    const tx = db.transaction(PALETTE_SNAPSHOT_STORE_NAME, "readwrite");
    const store = tx.objectStore(PALETTE_SNAPSHOT_STORE_NAME);
    const record = toStorageRecord(artifact);
    const existing = (await requestToPromise(store.get(record.id))) as PaletteSnapshotStorageRecord | undefined;
    if (existing) {
      throw new Error(
        `Palette snapshot "${record.id}" already exists. Automatic overwrite is disabled.`,
      );
    }
    const count = await requestToPromise(store.count());
    if (count >= PALETTE_SNAPSHOT_MAX_COUNT) {
      throw new Error(
        `Palette snapshot limit reached (${PALETTE_SNAPSHOT_MAX_COUNT}). Delete snapshots before saving new ones.`,
      );
    }
    await requestToPromise(store.put(record));
    return record;
  } finally {
    db.close();
  }
}

export async function getPaletteSnapshotRecord(
  id: string,
): Promise<PaletteSnapshotStorageRecord | undefined> {
  const db = await openPaletteSnapshotDb();
  try {
    const tx = db.transaction(PALETTE_SNAPSHOT_STORE_NAME, "readonly");
    const store = tx.objectStore(PALETTE_SNAPSHOT_STORE_NAME);
    const out = await requestToPromise(store.get(id));
    if (!out) return undefined;
    return normalizePaletteSnapshotRecord(out, `record "${id}"`);
  } finally {
    db.close();
  }
}

export async function listPaletteSnapshotRecords(): Promise<PaletteSnapshotStorageRecord[]> {
  const db = await openPaletteSnapshotDb();
  try {
    const tx = db.transaction(PALETTE_SNAPSHOT_STORE_NAME, "readonly");
    const store = tx.objectStore(PALETTE_SNAPSHOT_STORE_NAME);
    const records = await requestToPromise(store.getAll());
    const normalized = records.map((record) =>
      normalizePaletteSnapshotRecord(record, "record in list"),
    );
    normalized.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
    return normalized;
  } finally {
    db.close();
  }
}

export async function countPaletteSnapshotRecords(): Promise<number> {
  const db = await openPaletteSnapshotDb();
  try {
    const tx = db.transaction(PALETTE_SNAPSHOT_STORE_NAME, "readonly");
    const store = tx.objectStore(PALETTE_SNAPSHOT_STORE_NAME);
    return requestToPromise(store.count());
  } finally {
    db.close();
  }
}

export async function renamePaletteSnapshotRecord(
  id: string,
  nextName: string,
): Promise<PaletteSnapshotStorageRecord> {
  const normalizedName = normalizeSnapshotName(nextName);
  const db = await openPaletteSnapshotDb();
  try {
    const tx = db.transaction(PALETTE_SNAPSHOT_STORE_NAME, "readwrite");
    const store = tx.objectStore(PALETTE_SNAPSHOT_STORE_NAME);
    const existingRaw = await requestToPromise(store.get(id));
    if (!existingRaw) {
      throw new Error(`Palette snapshot "${id}" was not found.`);
    }
    const existing = normalizePaletteSnapshotRecord(existingRaw, `record "${id}"`);
    const renamed: PaletteSnapshotStorageRecord = {
      ...existing,
      metadata: {
        ...existing.metadata,
        name: normalizedName,
      },
    };
    await requestToPromise(store.put(renamed));
    return renamed;
  } finally {
    db.close();
  }
}

export async function deletePaletteSnapshotRecord(id: string): Promise<boolean> {
  const db = await openPaletteSnapshotDb();
  try {
    const tx = db.transaction(PALETTE_SNAPSHOT_STORE_NAME, "readwrite");
    const store = tx.objectStore(PALETTE_SNAPSHOT_STORE_NAME);
    const existing = await requestToPromise(store.get(id));
    if (!existing) return false;
    await requestToPromise(store.delete(id));
    return true;
  } finally {
    db.close();
  }
}
