import type { Dir8 } from "./dir8";
import { resolveActivePaletteId } from "../../../game/render/activePalette";
import { getSpriteById } from "./renderSprites";

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

const pigeonFlyingFramesByDir: Record<Dir8, HTMLImageElement[]> = {
  N: [],
  NE: [],
  E: [],
  SE: [],
  S: [],
  SW: [],
  W: [],
  NW: [],
};

const pigeonIdleFramesByDir: Record<Dir8, HTMLImageElement[]> = {
  N: [],
  NE: [],
  E: [],
  SE: [],
  S: [],
  SW: [],
  W: [],
  NW: [],
};

let preloadStarted = false;
let loadedPaletteId = "";

function clearFrames(): void {
  for (const dir of DIRS) {
    pigeonFlyingFramesByDir[dir].length = 0;
    pigeonIdleFramesByDir[dir].length = 0;
  }
}

function refreshPaletteState(): void {
  const paletteId = resolveActivePaletteId();
  if (paletteId !== loadedPaletteId) {
    loadedPaletteId = paletteId;
    preloadStarted = false;
    clearFrames();
  }
}

function loadImage(spriteId: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const started = performance.now();
    const MAX_WAIT_MS = 1500;
    const tick = () => {
      const rec = getSpriteById(spriteId);
      if (rec.ready) {
        resolve(rec.img);
        return;
      }
      if (performance.now() - started >= MAX_WAIT_MS) {
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
  refreshPaletteState();
  if (clip === "IDLE" || clip === "LAND") {
    return pigeonIdleFramesByDir[dir].length > 0 ? pigeonIdleFramesByDir[dir] : pigeonIdleFramesByDir.E;
  }
  return pigeonFlyingFramesByDir[dir].length > 0 ? pigeonFlyingFramesByDir[dir] : pigeonFlyingFramesByDir.E;
}

export function getPigeonFramesForClip(
  clip: "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND",
): HTMLImageElement[] {
  return getPigeonFramesForClipAndScreenDir(clip, "E");
}

export async function preloadNeutralMobSprites(): Promise<void> {
  refreshPaletteState();
  if (preloadStarted) return;
  preloadStarted = true;

  try {
    for (let i = 0; i < DIRS.length; i++) {
      const dir = DIRS[i];
      const dirPath = DIR_TO_PATH[dir];
      for (let fi = 0; fi < 10; fi++) {
        const flyingId = `entities/animals/pigeon/animations/flying/${dirPath}/frame_${String(fi).padStart(3, "0")}`;
        const img = await loadImage(flyingId);
        if (img.decode) await img.decode();
        pigeonFlyingFramesByDir[dir].push(img);
      }
      for (let ii = 0; ii < 10; ii++) {
        const idleId = `entities/animals/pigeon/rotations/${dirPath}/frame_${String(ii).padStart(3, "0")}`;
        const img = await loadImage(idleId);
        if (img.decode) await img.decode();
        pigeonIdleFramesByDir[dir].push(img);
      }
    }

  } catch (err) {
    void err;
  }
}
