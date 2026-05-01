import { type Dir8 } from "./dir8";
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

type SpriteFrame = {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  scale: number;
  anchorX: number;
  anchorY: number;
};

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

const FRAME_COUNT = 4;
const SCALE = 1.2;
const ANCHOR_X = 0.5;
const ANCHOR_Y = 0.72;

let warned = false;
const paletteState = createPaletteSwapState(resolveActivePaletteVariantKey());
const framesByPalette = new Map<string, Partial<Record<Dir8, HTMLImageElement[]>>>();
const sizeByPalette = new Map<string, { w: number; h: number }>();
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

function getFrameMap(paletteId: string): Partial<Record<Dir8, HTMLImageElement[]>> {
  const existing = framesByPalette.get(paletteId);
  if (existing) return existing;
  const created: Partial<Record<Dir8, HTMLImageElement[]>> = {};
  framesByPalette.set(paletteId, created);
  return created;
}

function isPaletteReady(paletteId: string): boolean {
  const frameMap = framesByPalette.get(paletteId);
  const size = sizeByPalette.get(paletteId);
  if (!frameMap || !size) return false;
  for (const dir of Object.keys(DIR_TO_PATH) as Dir8[]) {
    const frames = frameMap[dir];
    if (!frames || frames.length < FRAME_COUNT) return false;
  }
  return true;
}

async function loadImage(
  spriteId: string,
  paletteVariantKey: string,
): Promise<HTMLImageElement> {
  const cacheKey = resolveSpriteCacheKeyForVariantKey(spriteId, paletteVariantKey);
  const cacheHitAtRequest = hasSpriteRecordForCacheKey(cacheKey);
  return await new Promise<HTMLImageElement>((resolve, reject) => {
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
        reject(new Error(`[vendorSprites] Failed to load ${spriteId} (state=${rec.unsupported ? "UNSUPPORTED" : "FAILED"})`));
        return;
      }
      if (performance.now() - started >= MAX_WAIT_MS) {
        const activePaletteVariantKey = resolveActivePaletteVariantKey();
        const cacheSnapshot = getSpriteCacheDebugSnapshotByKey(cacheKey);
        console.warn("[vendorSprites] preload timeout", {
          spriteId,
          awaitedCacheKey: cacheKey,
          cacheHitAtRequest,
          awaitedPaletteVariantKey: paletteVariantKey,
          activePaletteVariantKey,
          cacheSnapshot,
        });
        reject(new Error(`[vendorSprites] Failed to load ${spriteId}`));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function resolveFrameId(dir: Dir8, frameIndex: number): string {
  const dirPath = DIR_TO_PATH[dir];
  const file = `frame_${String(frameIndex).padStart(3, "0")}.png`;
  return `entities/npc/vendor/breathing-idle/${dirPath}/${file.slice(0, -4)}`;
}

export function listVendorNpcDynamicAtlasSpriteIds(): string[] {
  const ids: string[] = [];
  for (const dir of Object.keys(DIR_TO_PATH) as Dir8[]) {
    for (let i = 0; i < FRAME_COUNT; i++) ids.push(resolveFrameId(dir, i));
  }
  return ids;
}

export async function preloadVendorNpcSprites(
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

  const frameMap = getFrameMap(paletteVariantKey);
  const job = (async () => {
  try {
    for (const [dir] of Object.entries(DIR_TO_PATH) as [Dir8, string][]) {
      const frames: HTMLImageElement[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = await loadImage(resolveFrameId(dir, i), paletteVariantKey);
        if (img.decode) await img.decode();
        frames.push(img);
      }
      frameMap[dir] = frames;
    }

    const south = frameMap.S?.[0];
    sizeByPalette.set(paletteVariantKey, { w: south?.width ?? 0, h: south?.height ?? 0 });
    notePaletteReady(paletteState, paletteVariantKey);
  } catch (err) {
    console.warn("[vendorSprites] Failed to preload vendor breathing-idle sprites", err);
  }
  })().finally(() => {
    preloadByPalette.delete(paletteVariantKey);
  });
  preloadByPalette.set(paletteVariantKey, job);
  await job;
}

async function preloadVendorNpcSpritesForDarknessPercent(
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

  const frameMap = getFrameMap(paletteVariantKey);
  const job = (async () => {
  try {
    for (const [dir] of Object.entries(DIR_TO_PATH) as [Dir8, string][]) {
      const frames: HTMLImageElement[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = await loadImage(resolveFrameId(dir, i), paletteVariantKey);
        if (img.decode) await img.decode();
        frames.push(img);
      }
      frameMap[dir] = frames;
    }

    const south = frameMap.S?.[0];
    sizeByPalette.set(paletteVariantKey, { w: south?.width ?? 0, h: south?.height ?? 0 });
    notePaletteReady(paletteState, paletteVariantKey);
  } catch (err) {
    console.warn("[vendorSprites] Failed to preload vendor breathing-idle sprites", err);
  }
  })().finally(() => {
    preloadByPalette.delete(paletteVariantKey);
  });
  preloadByPalette.set(paletteVariantKey, job);
  await job;
}

export function vendorNpcSpritesReady(paletteVariantKey: string = resolveActivePaletteVariantKey()): boolean {
  notePaletteRequested(paletteState, paletteVariantKey);
  if (isPaletteReady(paletteVariantKey)) return true;
  return isPaletteReady(paletteState.lastReadyPaletteId);
}

export function getVendorNpcSpriteFrame(args: { dir: Dir8; time: number }): SpriteFrame | null {
  const paletteVariantKey = resolveActivePaletteVariantKey();
  notePaletteRequested(paletteState, paletteVariantKey);
  if (!isPaletteReady(paletteVariantKey)) {
    void preloadVendorNpcSprites();
  }
  const activePalette = isPaletteReady(paletteVariantKey) ? paletteVariantKey : paletteState.lastReadyPaletteId;
  const frameMap = getFrameMap(activePalette);
  const size = sizeByPalette.get(activePalette);
  const frames = frameMap[args.dir] ?? frameMap.S;
  if (!frames || frames.length === 0) {
    if (!warned) {
      warned = true;
      console.warn(`[vendorSprites] Missing directional frames for dir=${args.dir}`);
    }
    return null;
  }
  const idx = Math.floor(Math.max(0, args.time) * 8) % frames.length;
  const img = frames[idx];
  return {
    img,
    sx: 0,
    sy: 0,
    sw: size?.w || img.width,
    sh: size?.h || img.height,
    scale: SCALE,
    anchorX: ANCHOR_X,
    anchorY: ANCHOR_Y,
  };
}

export function getVendorNpcSpriteFrameForDarknessPercent(args: {
  dir: Dir8;
  time: number;
  darknessPercent: SpriteDarknessPercent;
}): SpriteFrame | null {
  const paletteVariantKey = resolvePaletteVariantKeyForDarknessPercent(args.darknessPercent);
  notePaletteRequested(paletteState, paletteVariantKey);
  if (!isPaletteReady(paletteVariantKey)) {
    void preloadVendorNpcSpritesForDarknessPercent(args.darknessPercent);
    return null;
  }
  const frameMap = getFrameMap(paletteVariantKey);
  const size = sizeByPalette.get(paletteVariantKey);
  const frames = frameMap[args.dir] ?? frameMap.S;
  if (!frames || frames.length === 0) return null;
  const idx = Math.floor(Math.max(0, args.time) * 8) % frames.length;
  const img = frames[idx];
  return {
    img,
    sx: 0,
    sy: 0,
    sw: size?.w || img.width,
    sh: size?.h || img.height,
    scale: SCALE,
    anchorX: ANCHOR_X,
    anchorY: ANCHOR_Y,
  };
}
