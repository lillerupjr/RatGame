import type { Dir8 } from "./dir8";

const PIGEON_FLYING_FRAME_MODULES = import.meta.glob(
  "../../../assets/animals/pigeon/animations/flying/**/*.png",
  {
    eager: true,
    import: "default",
  },
) as Record<string, string>;

const PIGEON_IDLE_FRAME_MODULES = import.meta.glob(
  "../../../assets/animals/pigeon/rotations/**/*.png",
  {
    eager: true,
    import: "default",
  },
) as Record<string, string>;

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`[neutralSprites] Failed to load ${url}`));
    img.src = url;
  });
}

function sortedEntriesForDir(modules: Record<string, string>, basePath: string): Array<[string, string]> {
  return Object.entries(modules)
    .filter(([k]) => k.includes(basePath))
    .sort((a, b) => a[0].localeCompare(b[0]));
}

export function getPigeonFramesForClipAndScreenDir(
  clip: "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND",
  dir: Dir8,
): HTMLImageElement[] {
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
  if (preloadStarted) return;
  preloadStarted = true;

  try {
    for (let i = 0; i < DIRS.length; i++) {
      const dir = DIRS[i];
      const dirPath = DIR_TO_PATH[dir];
      const flyingEntries = sortedEntriesForDir(
        PIGEON_FLYING_FRAME_MODULES,
        `/animations/flying/${dirPath}/`,
      );
      const idleEntries = sortedEntriesForDir(
        PIGEON_IDLE_FRAME_MODULES,
        `/rotations/${dirPath}/`,
      );

      for (let fi = 0; fi < flyingEntries.length; fi++) {
        const img = await loadImage(flyingEntries[fi][1]);
        if (img.decode) await img.decode();
        pigeonFlyingFramesByDir[dir].push(img);
      }
      for (let ii = 0; ii < idleEntries.length; ii++) {
        const img = await loadImage(idleEntries[ii][1]);
        if (img.decode) await img.decode();
        pigeonIdleFramesByDir[dir].push(img);
      }
    }

  } catch (err) {
    void err;
  }
}
