const PIGEON_FLYING_EAST_FRAME_MODULES = import.meta.glob(
  "../../../assets/animals/pigeon/animations/flying/east/frame_*.png",
  {
    eager: true,
    import: "default",
  },
) as Record<string, string>;

const PIGEON_IDLE_EAST_FRAME_MODULES = import.meta.glob(
  "../../../assets/animals/pigeon/rotations/east/frame_*.png",
  {
    eager: true,
    import: "default",
  },
) as Record<string, string>;

const pigeonFlyingEastFrames: HTMLImageElement[] = [];
const pigeonIdleEastFrames: HTMLImageElement[] = [];
let preloadStarted = false;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`[neutralSprites] Failed to load ${url}`));
    img.src = url;
  });
}

export function getPigeonFlyingEastFrames(): HTMLImageElement[] {
  return pigeonFlyingEastFrames;
}

export function getPigeonIdleEastFrames(): HTMLImageElement[] {
  return pigeonIdleEastFrames;
}

export function getPigeonFramesForClip(
  clip: "IDLE" | "WALK_AWAY" | "TAKEOFF" | "FLY_AWAY" | "LAND",
): HTMLImageElement[] {
  if (clip === "IDLE" || clip === "LAND") return pigeonIdleEastFrames;
  return pigeonFlyingEastFrames;
}

export async function preloadNeutralMobSprites(): Promise<void> {
  if (preloadStarted) return;
  preloadStarted = true;

  const flyingEntries = Object.entries(PIGEON_FLYING_EAST_FRAME_MODULES).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const idleEntries = Object.entries(PIGEON_IDLE_EAST_FRAME_MODULES).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  if (flyingEntries.length === 0) {
    console.warn("[neutralSprites] No pigeon flying east frames found in animations/flying/east.");
    return;
  }
  if (idleEntries.length === 0) {
    console.warn("[neutralSprites] No pigeon idle east frames found in rotations/east.");
    return;
  }

  try {
    for (let i = 0; i < flyingEntries.length; i++) {
      const img = await loadImage(flyingEntries[i][1]);
      if (img.decode) await img.decode();
      pigeonFlyingEastFrames.push(img);
    }
    for (let i = 0; i < idleEntries.length; i++) {
      const img = await loadImage(idleEntries[i][1]);
      if (img.decode) await img.decode();
      pigeonIdleEastFrames.push(img);
    }
    console.log(
      `[neutralSprites] Loaded pigeon frames: flying=${pigeonFlyingEastFrames.length} idle=${pigeonIdleEastFrames.length}`,
    );
  } catch (err) {
    console.warn("[neutralSprites] Failed to preload pigeon frames", err);
  }
}
