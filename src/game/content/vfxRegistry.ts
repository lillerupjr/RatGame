import { getSpriteById } from "../../engine/render/sprites/renderSprites";

export type VfxClipDef = {
  spriteIds: string[];
  fps: number;
  loop: boolean;
};

const EXPLOSION_FRAMES = 14;
const ROOT = "vfx/explosion_1";

function explosionSpriteIds(): string[] {
  const ids: string[] = [];
  for (let i = 1; i <= EXPLOSION_FRAMES; i++) {
    ids.push(`${ROOT}/1_frame_${String(i).padStart(2, "0")}`);
  }
  return ids;
}

function frames16(root: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 16; i++) out.push(`${root}/1_frame_${String(i).padStart(2, "0")}`);
  return out;
}

export const VFX_CLIPS: VfxClipDef[] = [
  /* 0 = EXPLOSION          */ { spriteIds: explosionSpriteIds(), fps: 20, loop: false },
  /* 1 = STATUS_BLEED_LOOP  */ { spriteIds: frames16("vfx/status/bleed_1"), fps: 12, loop: true },
  /* 2 = STATUS_POISON_LOOP */ { spriteIds: frames16("vfx/status/poisoned_1"), fps: 12, loop: true },
  /* 3 = STATUS_BURNING_LOOP*/ { spriteIds: frames16("vfx/status/burning_1"), fps: 12, loop: true },
];

export const VFX_CLIP_INDEX: Record<string, number> = {
  EXPLOSION: 0,
  STATUS_BLEED_LOOP: 1,
  STATUS_POISON_LOOP: 2,
  STATUS_BURNING_LOOP: 3,
};

export function preloadVfxSprites(): void {
  for (const clip of VFX_CLIPS)
    for (const id of clip.spriteIds)
      getSpriteById(id);
}
