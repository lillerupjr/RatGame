import { type Dir8 } from "./dir8";
import { resolveActivePaletteId } from "../../../game/render/activePalette";
import { getSpriteById } from "./renderSprites";

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

const frameCache: Partial<Record<Dir8, HTMLImageElement[]>> = {};
let ready = false;
let warned = false;
let sizeW = 0;
let sizeH = 0;
let loadedPaletteId = "";

function clearFrames(): void {
  for (const dir of Object.keys(DIR_TO_PATH) as Dir8[]) {
    delete frameCache[dir];
  }
}

function refreshPaletteState(): void {
  const paletteId = resolveActivePaletteId();
  if (paletteId !== loadedPaletteId) {
    loadedPaletteId = paletteId;
    ready = false;
    warned = false;
    sizeW = 0;
    sizeH = 0;
    clearFrames();
  }
}

async function loadImage(spriteId: string): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const started = performance.now();
    const MAX_WAIT_MS = 1500;
    const tick = () => {
      const rec = getSpriteById(spriteId);
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
  refreshPaletteState();
  if (ready) return;
  try {
    for (const [dir, dirPath] of Object.entries(DIR_TO_PATH) as [Dir8, string][]) {
      const frames: HTMLImageElement[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = await loadImage(resolveFrameId(dir, i));
        if (img.decode) await img.decode();
        frames.push(img);
      }
      frameCache[dir] = frames;
    }

    const south = frameCache.S?.[0];
    sizeW = south?.width ?? 0;
    sizeH = south?.height ?? 0;
    ready = true;
  } catch (err) {
    console.warn("[vendorSprites] Failed to preload vendor breathing-idle sprites", err);
    ready = false;
  }
}

export function vendorNpcSpritesReady(): boolean {
  refreshPaletteState();
  return ready;
}

export function getVendorNpcSpriteFrame(args: { dir: Dir8; time: number }): SpriteFrame | null {
  refreshPaletteState();
  if (!ready) return null;
  const frames = frameCache[args.dir] ?? frameCache.S;
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
    sw: sizeW || img.width,
    sh: sizeH || img.height,
    scale: SCALE,
    anchorX: ANCHOR_X,
    anchorY: ANCHOR_Y,
  };
}
