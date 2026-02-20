import { type Dir8 } from "./dir8";
import { resolveActivePaletteId } from "../../../game/render/activePalette";
import { getSpriteByIdForPalette } from "./renderSprites";
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
const paletteState = createPaletteSwapState(resolveActivePaletteId());
const framesByPalette = new Map<string, Partial<Record<Dir8, HTMLImageElement[]>>>();
const sizeByPalette = new Map<string, { w: number; h: number }>();
const preloadByPalette = new Map<string, Promise<void>>();

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

async function loadImage(spriteId: string, paletteId: string): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const started = performance.now();
    const MAX_WAIT_MS = 1500;
    const tick = () => {
      const rec = getSpriteByIdForPalette(spriteId, paletteId);
      if (rec.ready) {
        resolve(rec.img);
        return;
      }
      if (performance.now() - started >= MAX_WAIT_MS) {
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

export async function preloadVendorNpcSprites(): Promise<void> {
  const paletteId = resolveActivePaletteId();
  notePaletteRequested(paletteState, paletteId);
  if (isPaletteReady(paletteId)) {
    notePaletteReady(paletteState, paletteId);
    return;
  }
  const inFlight = preloadByPalette.get(paletteId);
  if (inFlight) {
    await inFlight;
    return;
  }

  const frameMap = getFrameMap(paletteId);
  const job = (async () => {
  try {
    for (const [dir] of Object.entries(DIR_TO_PATH) as [Dir8, string][]) {
      const frames: HTMLImageElement[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = await loadImage(resolveFrameId(dir, i), paletteId);
        if (img.decode) await img.decode();
        frames.push(img);
      }
      frameMap[dir] = frames;
    }

    const south = frameMap.S?.[0];
    sizeByPalette.set(paletteId, { w: south?.width ?? 0, h: south?.height ?? 0 });
    notePaletteReady(paletteState, paletteId);
  } catch (err) {
    console.warn("[vendorSprites] Failed to preload vendor breathing-idle sprites", err);
  }
  })().finally(() => {
    preloadByPalette.delete(paletteId);
  });
  preloadByPalette.set(paletteId, job);
  await job;
}

export function vendorNpcSpritesReady(): boolean {
  const paletteId = resolveActivePaletteId();
  notePaletteRequested(paletteState, paletteId);
  if (isPaletteReady(paletteId)) return true;
  return isPaletteReady(paletteState.lastReadyPaletteId);
}

export function getVendorNpcSpriteFrame(args: { dir: Dir8; time: number }): SpriteFrame | null {
  const paletteId = resolveActivePaletteId();
  notePaletteRequested(paletteState, paletteId);
  if (!isPaletteReady(paletteId)) {
    void preloadVendorNpcSprites();
  }
  const activePalette = isPaletteReady(paletteId) ? paletteId : paletteState.lastReadyPaletteId;
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
