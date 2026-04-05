import { getSpriteById } from "../../engine/render/sprites/renderSprites";
import { listProjectileHitVfxEntries } from "./projectilePresentationRegistry";

export type VfxClipDef = {
  spriteIds: string[];
  fps: number;
  loop: boolean;
};

function frames16(root: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 16; i++) out.push(`${root}/1_frame_${String(i).padStart(2, "0")}`);
  return out;
}

const EXPLOSION_SPRITE_IDS = [
  "vfx/explosion_1/1_frame_01",
  "vfx/explosion_1/1_frame_02",
  "vfx/explosion_1/1_frame_03",
  "vfx/explosion_1/1_frame_04",
  "vfx/explosion_1/1_frame_05",
  "vfx/explosion_1/1_frame_06",
  "vfx/explosion_1/1_frame_07",
  "vfx/explosion_1/1_frame_08",
  "vfx/explosion_1/1_frame_09",
  "vfx/explosion_1/1_frame_10",
  "vfx/explosion_1/1_frame_11",
  "vfx/explosion_1/1_frame_12",
  "vfx/explosion_1/1_frame_13",
  "vfx/explosion_1/1_frame_14",
];

const BASE_VFX_CLIP_ENTRIES: ReadonlyArray<readonly [string, VfxClipDef]> = [
  ["EXPLOSION", { spriteIds: EXPLOSION_SPRITE_IDS, fps: 20, loop: false }],
  ["STATUS_BLEED_LOOP", { spriteIds: frames16("vfx/status/bleed_1"), fps: 12, loop: true }],
  ["STATUS_POISON_LOOP", { spriteIds: frames16("vfx/status/poisoned_1"), fps: 12, loop: true }],
  ["STATUS_BURNING_LOOP", { spriteIds: frames16("vfx/status/burning_1"), fps: 12, loop: true }],
];

const mergedEntries: Array<readonly [string, VfxClipDef]> = [...BASE_VFX_CLIP_ENTRIES];
for (const entry of listProjectileHitVfxEntries()) {
  mergedEntries.push([
    entry.key,
    {
      spriteIds: entry.spriteIds,
      fps: entry.fps,
      loop: entry.loop,
    },
  ]);
}

export const VFX_CLIPS: VfxClipDef[] = [];
export const VFX_CLIP_INDEX: Record<string, number> = Object.create(null);

for (let i = 0; i < mergedEntries.length; i++) {
  const [key, clip] = mergedEntries[i];
  VFX_CLIP_INDEX[key] = i;
  VFX_CLIPS.push(clip);
}

export function listVfxSpriteIds(): string[] {
  const ids = new Set<string>();
  for (const clip of VFX_CLIPS) {
    for (const spriteId of clip.spriteIds) ids.add(spriteId);
  }
  return Array.from(ids).sort();
}

export function preloadVfxSprites(): void {
  for (const id of listVfxSpriteIds()) getSpriteById(id);
}
