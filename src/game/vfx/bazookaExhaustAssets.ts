import type { BazookaExhaustSpec, ExhaustFrames } from "./bazookaExhaust";

const BAZOOKA_EXHAUST_SPEC: BazookaExhaustSpec = {
  basePath: "/assets-runtime/vfx/bazooka/exhaust_1",
  fps: 24,
  // Center-on-center anchoring by default (projectile center -> exhaust center).
  anchorExhaust: [0, 0],
};

type FrameHandle = HTMLImageElement;

// Manual tuning knobs for bazooka exhaust placement.
// Values are in projectile-local sprite pixels (before scale).
// +x = forward along rocket facing, +y = down in local rotated space.
export const BAZOOKA_EXHAUST_OFFSET = {
  x: 0,
  y: 35,
} as const;

const withBaseUrl = (path: string): string => {
  const root = import.meta.env.BASE_URL ?? "/";
  const normalizedRoot = root.endsWith("/") ? root : `${root}/`;
  return `${normalizedRoot}${path.replace(/^\//, "")}`;
};

function makeFrame(path: string): FrameHandle {
  const img = new Image();
  img.src = withBaseUrl(path);
  return img;
}

function buildStageFrames(stage: "ignite" | "loop" | "shutdown", count: number): FrameHandle[] {
  const files: string[] = [];
  for (let i = 0; i < count; i++) {
    const frame = String(i).padStart(2, "0");
    files.push(`${BAZOOKA_EXHAUST_SPEC.basePath}/${stage}/${stage}_${frame}.png`);
  }
  files.sort((a, b) => a.localeCompare(b));
  return files.map((file) => makeFrame(file));
}

const frames: ExhaustFrames<FrameHandle> = {
  ignite: buildStageFrames("ignite", 6),
  loop: buildStageFrames("loop", 7),
  shutdown: buildStageFrames("shutdown", 5),
};

export const bazookaExhaustAssets = {
  spec: BAZOOKA_EXHAUST_SPEC,
  frames,
};

export function preloadBazookaExhaustAssets(): void {
  // Frames are eagerly constructed above; this exists to mirror preload entrypoints.
}

export function bazookaExhaustAssetsReady(): boolean {
  const all = [...frames.ignite, ...frames.loop, ...frames.shutdown];
  return all.every((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
}
