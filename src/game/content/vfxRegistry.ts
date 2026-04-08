import { getSpriteById } from "../../engine/render/sprites/renderSprites";
import { listProjectileHitVfxEntries } from "./projectilePresentationRegistry";

export type VfxClipDef = {
  spriteIds: string[];
  fps: number;
  loop: boolean;
  projection?: "billboard" | "ground_decal";
};

function frames16(root: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 16; i++) out.push(`${root}/1_frame_${String(i).padStart(2, "0")}`);
  return out;
}

function numberedFrames(root: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) out.push(`${root}/1_frame_${String(i).padStart(2, "0")}`);
  return out;
}

function namedFrames(root: string, stem: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) out.push(`${root}/${stem}${i}`);
  return out;
}

const EXPLOSION_SPRITE_IDS = numberedFrames("vfx/explosion_1", 14);
const RELIC_EXPLODE_ON_KILL_SPRITE_IDS = namedFrames("vfx/explosions/1", "explosion-b", 12);
const RELIC_ALL_HITS_EXPLODE_SPRITE_IDS = namedFrames("vfx/explosions/3", "explosion-f", 8);
const RELIC_BAZOOKA_EXPLOSION_SPRITE_IDS = numberedFrames("vfx/explosions/5", 14);

const GREEN_EXPLOSION_3_SPRITE_IDS = [
  "vfx/explosions/3_green/explosion-f1",
  "vfx/explosions/3_green/explosion-f2",
  "vfx/explosions/3_green/explosion-f3",
  "vfx/explosions/3_green/explosion-f4",
  "vfx/explosions/3_green/explosion-f5",
  "vfx/explosions/3_green/explosion-f6",
  "vfx/explosions/3_green/explosion-f7",
  "vfx/explosions/3_green/explosion-f8",
] as const;

const CHEM_GUY_FLAMETHROWER_LOOP_SPRITE_IDS = [
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable1",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable2",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable3",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable4",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable5",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable6",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable7",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable8",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable9",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable10",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable11",
  "vfx/flamethrower_poison/loop/Acid VFX 02Repeatable12",
] as const;

const CHEM_GUY_FLAMETHROWER_END_SPRITE_IDS = [
  "vfx/flamethrower_poison/ending/Acid VFX 02 Ending1",
  "vfx/flamethrower_poison/ending/Acid VFX 02 Ending2",
  "vfx/flamethrower_poison/ending/Acid VFX 02 Ending3",
  "vfx/flamethrower_poison/ending/Acid VFX 02 Ending4",
  "vfx/flamethrower_poison/ending/Acid VFX 02 Ending5",
  "vfx/flamethrower_poison/ending/Acid VFX 02 Ending6",
] as const;

const SLIME_IDLE_SPRITE_IDS = [
  "vfx/slime/idle/0",
  "vfx/slime/idle/1",
  "vfx/slime/idle/2",
  "vfx/slime/idle/3",
  "vfx/slime/idle/4",
  "vfx/slime/idle/5",
  "vfx/slime/idle/6",
  "vfx/slime/idle/7",
] as const;

const BASE_VFX_CLIP_ENTRIES: ReadonlyArray<readonly [string, VfxClipDef]> = [
  ["EXPLOSION", { spriteIds: EXPLOSION_SPRITE_IDS, fps: 20, loop: false, projection: "billboard" }],
  ["BURSTER_EXPLOSION", { spriteIds: [...GREEN_EXPLOSION_3_SPRITE_IDS], fps: 9, loop: false, projection: "billboard" }],
  ["RELIC_EXPLODE_ON_KILL", { spriteIds: RELIC_EXPLODE_ON_KILL_SPRITE_IDS, fps: 18, loop: false, projection: "billboard" }],
  ["RELIC_ALL_HITS_EXPLODE", { spriteIds: RELIC_ALL_HITS_EXPLODE_SPRITE_IDS, fps: 9, loop: false, projection: "billboard" }],
  ["RELIC_BAZOOKA_EXPLOSION", { spriteIds: RELIC_BAZOOKA_EXPLOSION_SPRITE_IDS, fps: 20, loop: false, projection: "billboard" }],
  ["CHEM_GUY_POISON_RAIN", { spriteIds: [...GREEN_EXPLOSION_3_SPRITE_IDS], fps: 9, loop: false, projection: "ground_decal" }],
  ["CHEM_GUY_FLAMETHROWER_LOOP", { spriteIds: [...CHEM_GUY_FLAMETHROWER_LOOP_SPRITE_IDS], fps: 18, loop: true, projection: "billboard" }],
  ["CHEM_GUY_FLAMETHROWER_END", { spriteIds: [...CHEM_GUY_FLAMETHROWER_END_SPRITE_IDS], fps: 18, loop: false, projection: "billboard" }],
  ["SLIME_IDLE_LOOP", { spriteIds: [...SLIME_IDLE_SPRITE_IDS], fps: 6, loop: true }],
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
