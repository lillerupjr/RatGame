import {
  getSpriteById,
  getSpriteByIdForDarknessPercent,
  type LoadedImg,
} from "../../../engine/render/sprites/renderSprites";

const COIN_FPS = 10;
const GEM_FPS = 10;
const COIN_FRAMES = 5;
const GEM_FRAMES = 4;

export type CurrencyTierInfo = {
  dir: "coins" | "gems";
  n: number;
  frameCount: number;
  fps: number;
};

export function currencyTierForValue(value: number): CurrencyTierInfo {
  const v = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  if (v <= 3) {
    return { dir: "coins", n: v, frameCount: COIN_FRAMES, fps: COIN_FPS };
  }
  const gemTier = Math.min(5, v - 3);
  return { dir: "gems", n: gemTier, frameCount: GEM_FRAMES, fps: GEM_FPS };
}

function frameSpriteId(dir: string, n: number, frame: number): string {
  const pad = String(frame).padStart(2, "0");
  return `loot/currency/${dir}/${n}/${n}_frame_${pad}`;
}

function getCurrencyFrameSpriteIdForTime(value: number, time: number): string {
  const tier = currencyTierForValue(value);
  const frameIndex = Math.floor(Math.max(0, time) * tier.fps) % tier.frameCount;
  return frameSpriteId(tier.dir, tier.n, frameIndex + 1);
}

export function listCurrencyDynamicAtlasSpriteIds(): string[] {
  const ids: string[] = [];
  for (let n = 1; n <= 3; n++) {
    for (let f = 1; f <= COIN_FRAMES; f++) ids.push(frameSpriteId("coins", n, f));
  }
  for (let n = 1; n <= 5; n++) {
    for (let f = 1; f <= GEM_FRAMES; f++) ids.push(frameSpriteId("gems", n, f));
  }
  return ids;
}

export function getCurrencyFrame(value: number, time: number): LoadedImg {
  return getSpriteById(getCurrencyFrameSpriteIdForTime(value, time));
}

export function getCurrencyFrameForDarknessPercent(
  value: number,
  time: number,
  darknessPercent: 0 | 25 | 50 | 75 | 100,
): LoadedImg {
  return getSpriteByIdForDarknessPercent(
    getCurrencyFrameSpriteIdForTime(value, time),
    darknessPercent,
  );
}

export function preloadCurrencySprites(): void {
  for (const spriteId of listCurrencyDynamicAtlasSpriteIds()) getSpriteById(spriteId);
}
