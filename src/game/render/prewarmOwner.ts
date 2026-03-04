import type { World } from "../../engine/world/world";
import type { CompiledKenneyMap } from "../map/compile/kenneyMapLoader";
import { collectRuntimeSpriteIdsToPrewarm } from "./prewarmSprites";
import { enqueueSpritePrewarm, tickSpritePrewarm, type PaletteId } from "../../engine/render/sprites/renderSprites";

export type SpriteId = string;

export function collectRuntimeSpriteDeps(world: World, activeMap?: CompiledKenneyMap | null): SpriteId[] {
  return collectRuntimeSpriteIdsToPrewarm(world, activeMap);
}

export function enqueuePrewarm(paletteId: PaletteId, spriteIds: SpriteId[]): void {
  enqueueSpritePrewarm(spriteIds, paletteId);
}

export function tickPrewarm(budgetMs: number): boolean {
  return tickSpritePrewarm(Math.max(0.1, budgetMs));
}

export async function awaitPrewarmDone(timeoutMs: number, budgetMs: number = 4): Promise<boolean> {
  const timeout = Math.max(0, timeoutMs);
  const start = performance.now();
  if (tickPrewarm(budgetMs)) return true;

  return await new Promise<boolean>((resolve) => {
    const step = () => {
      if (tickPrewarm(budgetMs)) {
        resolve(true);
        return;
      }
      if (performance.now() - start >= timeout) {
        resolve(false);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
