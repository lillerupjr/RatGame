import { getSpriteById, type LoadedImg } from "../../../engine/render/sprites/renderSprites";

const COIN_FPS = 10;
const COIN_FRAMES = 5;
const GOLD_COIN_VARIANT = 1;

function frameSpriteId(dir: string, n: number, frame: number): string {
  const pad = String(frame).padStart(2, "0");
  return `loot/currency/${dir}/${n}/${n}_frame_${pad}`;
}

export function getCurrencyFrame(_value: number, time: number): LoadedImg {
  const frameIndex = Math.floor(Math.max(0, time) * COIN_FPS) % COIN_FRAMES;
  return getSpriteById(frameSpriteId("coins", GOLD_COIN_VARIANT, frameIndex + 1));
}

export function preloadCurrencySprites(): void {
  for (let f = 1; f <= COIN_FRAMES; f++) {
    getSpriteById(frameSpriteId("coins", GOLD_COIN_VARIANT, f));
  }
}
