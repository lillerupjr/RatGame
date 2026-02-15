import { type Dir8 } from "./dir8";

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

const NPC_MODULES = import.meta.glob("../../../assets/npc/vendor/breathing-idle/**/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

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

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`[vendorSprites] Failed to load ${url}`));
    img.src = url;
  });
}

function resolveFrameUrl(dir: Dir8, frameIndex: number): string | null {
  const dirPath = DIR_TO_PATH[dir];
  const file = `frame_${String(frameIndex).padStart(3, "0")}.png`;
  const key = `../../../assets/npc/vendor/breathing-idle/${dirPath}/${file}`;
  return NPC_MODULES[key] ?? null;
}

export async function preloadVendorNpcSprites(): Promise<void> {
  if (ready) return;
  try {
    for (const [dir, dirPath] of Object.entries(DIR_TO_PATH) as [Dir8, string][]) {
      const frames: HTMLImageElement[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        const url = resolveFrameUrl(dir, i);
        if (!url) {
          throw new Error(
            `[vendorSprites] Missing frame file for ${dirPath}/frame_${String(i).padStart(3, "0")}.png`,
          );
        }
        const img = await loadImage(url);
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
  return ready;
}

export function getVendorNpcSpriteFrame(args: { dir: Dir8; time: number }): SpriteFrame | null {
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
