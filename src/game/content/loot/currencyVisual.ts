import { getSpriteById, type LoadedImg } from "../../../engine/render/sprites/renderSprites";

const COIN_FPS = 10;
const GEM_FPS = 10;
const COIN_FRAMES = 5;
const GEM_FRAMES = 4;

type TierInfo = { dir: string; n: number; frameCount: number; fps: number };

function tierForValue(value: number): TierInfo {
  const v = Math.max(1, Math.floor(value));
  if (v <= 3) return { dir: "coins", n: v, frameCount: COIN_FRAMES, fps: COIN_FPS };
  const gem = Math.min(5, v - 3);
  return { dir: "gems", n: gem, frameCount: GEM_FRAMES, fps: GEM_FPS };
}

function frameSpriteId(dir: string, n: number, frame: number): string {
  const pad = String(frame).padStart(2, "0");
  return `loot/currency/${dir}/${n}/${n}_frame_${pad}`;
}

export function getCurrencyFrame(value: number, time: number): LoadedImg {
  const tier = tierForValue(value);
  const frameIndex = Math.floor(Math.max(0, time) * tier.fps) % tier.frameCount;
  return getSpriteById(frameSpriteId(tier.dir, tier.n, frameIndex + 1));
}

export function preloadCurrencySprites(): void {
  for (let n = 1; n <= 3; n++)
    for (let f = 1; f <= COIN_FRAMES; f++)
      getSpriteById(frameSpriteId("coins", n, f));
  for (let n = 1; n <= 5; n++)
    for (let f = 1; f <= GEM_FRAMES; f++)
      getSpriteById(frameSpriteId("gems", n, f));
}
