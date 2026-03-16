import type { Dir8 } from "./dir8";
import {
  buildPaletteVariantKey,
  resolveActivePaletteId,
  resolveActivePaletteSwapWeightPercents,
  resolveActivePaletteVariantKey,
} from "../../../game/render/activePalette";
import {
  getSpriteByIdForVariantKey,
  getSpriteCacheDebugSnapshotByKey,
  hasSpriteRecordForCacheKey,
  resolveSpriteCacheKeyForVariantKey,
} from "./renderSprites";
import {
  createPaletteSwapState,
  notePaletteReady,
  notePaletteRequested,
} from "./paletteSwapState";

const DIR_TO_PATH: Record<Dir8, string> = {
  N: "north",
  NE: "north-east",
  E: "east",
  SE: "south-east",
  S: "south",
  SW: "south-west",
  W: "west",
  NW: "north-west",
};

const DIRS: Dir8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const paletteState = createPaletteSwapState(resolveActivePaletteVariantKey());
const flyingByPalette = new Map<string, Record<Dir8, HTMLImageElement[]>>();
const idleByPalette = new Map<string, Record<Dir8, HTMLImageElement[]>>();
const preloadByPalette = new Map<string, Promise<void>>();
type SpriteDarknessPercent = 0 | 25 | 50 | 75 | 100;

function resolvePaletteVariantKeyForDarknessPercent(
  darknessPercent?: SpriteDarknessPercent,
): string {
  if (darknessPercent == null) return resolveActivePaletteVariantKey();
  const paletteId = resolveActivePaletteId();
  const active = resolveActivePaletteSwapWeightPercents();
  return buildPaletteVariantKey(paletteId, {
    sWeightPercent: active.sWeightPercent,
    darknessPercent,
  });
}

function createDirFrames(): Record<Dir8, HTMLImageElement[]> {
  return {
    N: [],
    NE: [],
    E: [],
    SE: [],
    S: [],
    SW: [],
    W: [],
    NW: [],
  };
}

function getFlyingFrames(paletteId: string): Record<Dir8, HTMLImageElement[]> {
  const existing = flyingByPalette.get(paletteId);
  if (existing) return existing;
  const created = createDirFrames();
  flyingByPalette.set(paletteId, created);
  return created;
}

function getIdleFrames(paletteId: string): Record<Dir8, HTMLImageElement[]> {
  const existing = idleByPalette.get(paletteId);
  if (existing) return existing;
  const created = createDirFrames();
  idleByPalette.set(paletteId, created);
  return created;
}

function isPaletteReady(paletteId: string): boolean {
  const flying = flyingByPalette.get(paletteId);
  const idle = idleByPalette.get(paletteId);
  if (!flying || !idle) return false;
  for (const dir of DIRS) {
    if (flying[dir].length < 10 || idle[dir].length < 10) return false;
  }
  return true;
}

export function neutralMobSpritesReady(
  paletteVariantKey: string = resolveActivePaletteVariantKey(),
): boolean {
  return isPaletteReady(paletteVariantKey);
}

function loadImage(
  spriteId: string,
  paletteVariantKey: string,
): Promise<HTMLImageElement> {
  const cacheKey = resolveSpriteCacheKeyForVariantKey(spriteId, paletteVariantKey);
  const cacheHitAtRequest = hasSpriteRecordForCacheKey(cacheKey);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const started = performance.now();
    const MAX_WAIT_MS = 1500;
    const tick = () => {
      const rec = getSpriteByIdForVariantKey(spriteId, paletteVariantKey);
      const validReady = rec.ready && rec.img && rec.img.naturalWidth > 0 && rec.img.naturalHeight > 0;
      if (validReady) {
        resolve(rec.img);
        return;
      }
      if (rec.unsupported || rec.failed || rec.ready) {
        reject(new Error(`[neutralSprites] Failed to load ${spriteId} (state=${rec.unsupported ? "UNSUPPORTED" : "FAILED"})`));
        return;
      }
      if (performance.now() - started >= MAX_WAIT_MS) {
        const activePaletteVariantKey = resolveActivePaletteVariantKey();
        const cacheSnapshot = getSpriteCacheDebugSnapshotByKey(cacheKey);
        console.warn("[neutralSprites] preload timeout", {
          spriteId,
          awaitedCacheKey: cacheKey,
          cacheHitAtRequest,
          awaitedPaletteVariantKey: paletteVariantKey,
          activePaletteVariantKey,
          cacheSnapshot,
        });
        reject(new Error(`[neutralSprites] Failed to load ${spriteId}`));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function getPigeonFramesForClipAndScreenDir(
  clip: "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND",
  dir: Dir8,
): HTMLImageElement[] {
  const paletteVariantKey = resolveActivePaletteVariantKey();
  notePaletteRequested(paletteState, paletteVariantKey);
  if (!isPaletteReady(paletteVariantKey)) {
    void preloadNeutralMobSprites();
  }
  const activePalette = isPaletteReady(paletteVariantKey) ? paletteVariantKey : paletteState.lastReadyPaletteId;
  const flying = getFlyingFrames(activePalette);
  const idle = getIdleFrames(activePalette);
  if (clip === "IDLE" || clip === "LAND") {
    return idle[dir].length > 0 ? idle[dir] : idle.E;
  }
  return flying[dir].length > 0 ? flying[dir] : flying.E;
}

export function getPigeonFramesForClipAndScreenDirForDarknessPercent(
  clip: "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND",
  dir: Dir8,
  darknessPercent: SpriteDarknessPercent,
): HTMLImageElement[] {
  const paletteVariantKey = resolvePaletteVariantKeyForDarknessPercent(darknessPercent);
  notePaletteRequested(paletteState, paletteVariantKey);
  if (!isPaletteReady(paletteVariantKey)) {
    void preloadNeutralMobSpritesForDarknessPercent(darknessPercent);
    return [];
  }
  const flying = getFlyingFrames(paletteVariantKey);
  const idle = getIdleFrames(paletteVariantKey);
  if (clip === "IDLE" || clip === "LAND") {
    return idle[dir].length > 0 ? idle[dir] : idle.E;
  }
  return flying[dir].length > 0 ? flying[dir] : flying.E;
}

export function getPigeonFramesForClip(
  clip: "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND",
): HTMLImageElement[] {
  return getPigeonFramesForClipAndScreenDir(clip, "E");
}

export async function preloadNeutralMobSprites(
  requestedPaletteVariantKey?: string,
): Promise<void> {
  const paletteVariantKey = requestedPaletteVariantKey ?? resolvePaletteVariantKeyForDarknessPercent();
  notePaletteRequested(paletteState, paletteVariantKey);
  if (isPaletteReady(paletteVariantKey)) {
    notePaletteReady(paletteState, paletteVariantKey);
    return;
  }
  const inFlight = preloadByPalette.get(paletteVariantKey);
  if (inFlight) {
    await inFlight;
    return;
  }

  const job = (async () => {
  try {
    const flying = getFlyingFrames(paletteVariantKey);
    const idle = getIdleFrames(paletteVariantKey);
    for (let i = 0; i < DIRS.length; i++) {
      const dir = DIRS[i];
      const dirPath = DIR_TO_PATH[dir];
      const flyingFrames: HTMLImageElement[] = [];
      for (let fi = 0; fi < 10; fi++) {
        const flyingId = `entities/animals/pigeon/animations/flying/${dirPath}/frame_${String(fi).padStart(3, "0")}`;
        const img = await loadImage(flyingId, paletteVariantKey);
        if (img.decode) await img.decode();
        flyingFrames.push(img);
      }
      flying[dir] = flyingFrames;
      const idleFrames: HTMLImageElement[] = [];
      for (let ii = 0; ii < 10; ii++) {
        const idleId = `entities/animals/pigeon/rotations/${dirPath}/frame_${String(ii).padStart(3, "0")}`;
        const img = await loadImage(idleId, paletteVariantKey);
        if (img.decode) await img.decode();
        idleFrames.push(img);
      }
      idle[dir] = idleFrames;
    }
    notePaletteReady(paletteState, paletteVariantKey);
  } catch (err) {
    void err;
  }
  })().finally(() => {
    preloadByPalette.delete(paletteVariantKey);
  });
  preloadByPalette.set(paletteVariantKey, job);
  await job;
}

async function preloadNeutralMobSpritesForDarknessPercent(
  darknessPercent: SpriteDarknessPercent,
): Promise<void> {
  const paletteVariantKey = resolvePaletteVariantKeyForDarknessPercent(darknessPercent);
  notePaletteRequested(paletteState, paletteVariantKey);
  if (isPaletteReady(paletteVariantKey)) {
    notePaletteReady(paletteState, paletteVariantKey);
    return;
  }
  const inFlight = preloadByPalette.get(paletteVariantKey);
  if (inFlight) {
    await inFlight;
    return;
  }

  const job = (async () => {
  try {
    const flying = getFlyingFrames(paletteVariantKey);
    const idle = getIdleFrames(paletteVariantKey);
    for (let i = 0; i < DIRS.length; i++) {
      const dir = DIRS[i];
      const dirPath = DIR_TO_PATH[dir];
      const flyingFrames: HTMLImageElement[] = [];
      for (let fi = 0; fi < 10; fi++) {
        const flyingId = `entities/animals/pigeon/animations/flying/${dirPath}/frame_${String(fi).padStart(3, "0")}`;
        const img = await loadImage(flyingId, paletteVariantKey);
        if (img.decode) await img.decode();
        flyingFrames.push(img);
      }
      flying[dir] = flyingFrames;
      const idleFrames: HTMLImageElement[] = [];
      for (let ii = 0; ii < 10; ii++) {
        const idleId = `entities/animals/pigeon/rotations/${dirPath}/frame_${String(ii).padStart(3, "0")}`;
        const img = await loadImage(idleId, paletteVariantKey);
        if (img.decode) await img.decode();
        idleFrames.push(img);
      }
      idle[dir] = idleFrames;
    }
    notePaletteReady(paletteState, paletteVariantKey);
  } catch (err) {
    void err;
  }
  })().finally(() => {
    preloadByPalette.delete(paletteVariantKey);
  });
  preloadByPalette.set(paletteVariantKey, job);
  await job;
}
