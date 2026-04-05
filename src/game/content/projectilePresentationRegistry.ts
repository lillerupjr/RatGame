import type { ProjectileKind } from "../factories/projectileFactory";

export const PROJECTILE_BASE_DRAW_PX = 36;
export const PROJECTILE_ANIMATED_FPS_DEFAULT = 20;

const PRJ_KIND_IDS = {
  KNIFE: 1,
  PISTOL: 2,
  SWORD: 3,
  KNUCKLES: 4,
  SYRINGE: 5,
  BOUNCER: 6,
  MISSILE: 7,
  DAGGER: 8,
  SPARK: 9,
  ACID: 10,
} as const satisfies Record<string, ProjectileKind>;

export type ProjectileOrientation = "velocity";

export type StaticProjectileTravelVisualDef = {
  mode: "static";
  spriteId: string;
  orientation?: ProjectileOrientation;
};

export type AnimatedProjectileTravelVisualDef = {
  mode: "animated";
  family: string;
  fps: number;
  orientation?: ProjectileOrientation;
  loopSpriteIds: string[];
};

export type ProjectileTravelVisualDef =
  | StaticProjectileTravelVisualDef
  | AnimatedProjectileTravelVisualDef;

export type AnimatedProjectileHitPresentationDef = {
  vfxKey: string;
  fps?: number;
  spriteIds: string[];
};

export type ProjectileAttachmentRenderLayer = "behindBody" | "frontBody";

export type ProjectileAttachmentPresentationDef = {
  visual: ProjectileTravelVisualDef;
  offsetPx: { x: number; y: number };
  scaleMult?: number;
  rotationOffsetRad?: number;
  alpha?: number;
  blendMode?: "normal" | "additive";
  renderLayer?: ProjectileAttachmentRenderLayer;
};

export type ProjectilePresentationDef = {
  body: ProjectileTravelVisualDef;
  attachments?: ProjectileAttachmentPresentationDef[];
  hit?: AnimatedProjectileHitPresentationDef;
};

export type ProjectileHitVfxEntry = {
  key: string;
  fps: number;
  spriteIds: string[];
  loop: false;
};

function orderedIds(prefix: string, frames: readonly string[]): string[] {
  return frames.map((frame) => `${prefix}/${frame}`);
}

const LIGHTNING_LOOP_SPRITE_IDS = orderedIds("vfx/projectiles/lightning/loop", [
  "loop_01",
  "loop_02",
  "loop_03",
  "loop_04",
  "loop_05",
]);

const LIGHTNING_HIT_SPRITE_IDS = orderedIds("vfx/projectiles/lightning/hit", [
  "hit_01",
  "hit_02",
  "hit_03",
  "hit_04",
  "hit_05",
]);

const ACID_LOOP_SPRITE_IDS = orderedIds("vfx/projectiles/acid/loop", [
  "loop_01",
  "loop_02",
  "loop_03",
  "loop_04",
  "loop_05",
  "loop_06",
  "loop_07",
  "loop_08",
  "loop_09",
  "loop_10",
]);

const ACID_HIT_SPRITE_IDS = orderedIds("vfx/projectiles/acid/hit", [
  "hit_01",
  "hit_02",
  "hit_03",
  "hit_04",
  "hit_05",
  "hit_06",
]);

const BAZOOKA_EXHAUST_LOOP_SPRITE_IDS = orderedIds("vfx/bazooka/exhaust_1/loop", [
  "loop_00",
  "loop_01",
  "loop_02",
  "loop_03",
  "loop_04",
  "loop_05",
  "loop_06",
]);

export const PROJECTILE_PRESENTATION_BY_KIND: Record<ProjectileKind, ProjectilePresentationDef> = {
  [PRJ_KIND_IDS.KNIFE]: {
    body: {
      mode: "static",
      spriteId: "projectiles/knife",
    },
  },
  [PRJ_KIND_IDS.PISTOL]: {
    body: {
      mode: "static",
      spriteId: "projectiles/pistol",
    },
  },
  [PRJ_KIND_IDS.SWORD]: {
    body: {
      mode: "static",
      spriteId: "",
    },
  },
  [PRJ_KIND_IDS.KNUCKLES]: {
    body: {
      mode: "static",
      spriteId: "",
    },
  },
  [PRJ_KIND_IDS.SYRINGE]: {
    body: {
      mode: "static",
      spriteId: "projectiles/syringe",
    },
  },
  [PRJ_KIND_IDS.BOUNCER]: {
    body: {
      mode: "static",
      spriteId: "",
    },
  },
  [PRJ_KIND_IDS.MISSILE]: {
    body: {
      mode: "static",
      spriteId: "projectiles/bazooka",
    },
    attachments: [
      // Recovered from the legacy bazooka exhaust renderer in git history:
      // offset (0, 35), half body-scale sizing, +90deg rotation, additive alpha 0.95.
      {
        visual: {
          mode: "animated",
          family: "bazooka/exhaust_1",
          fps: 24,
          loopSpriteIds: BAZOOKA_EXHAUST_LOOP_SPRITE_IDS,
        },
        offsetPx: { x: 0, y: 35 },
        scaleMult: 0.5,
        rotationOffsetRad: Math.PI * 0.5,
        alpha: 0.95,
        blendMode: "additive",
        renderLayer: "behindBody",
      },
    ],
  },
  [PRJ_KIND_IDS.DAGGER]: {
    body: {
      mode: "static",
      spriteId: "projectiles/knife",
    },
  },
  [PRJ_KIND_IDS.SPARK]: {
    body: {
      mode: "animated",
      family: "lightning",
      fps: PROJECTILE_ANIMATED_FPS_DEFAULT,
      loopSpriteIds: LIGHTNING_LOOP_SPRITE_IDS,
    },
    hit: {
      vfxKey: "PROJECTILE_HIT_SPARK",
      spriteIds: LIGHTNING_HIT_SPRITE_IDS,
    },
  },
  [PRJ_KIND_IDS.ACID]: {
    body: {
      mode: "animated",
      family: "acid",
      fps: PROJECTILE_ANIMATED_FPS_DEFAULT,
      loopSpriteIds: ACID_LOOP_SPRITE_IDS,
    },
    hit: {
      vfxKey: "PROJECTILE_HIT_ACID",
      spriteIds: ACID_HIT_SPRITE_IDS,
    },
  },
};

const PROJECTILE_DRAW_SCALE_BY_KIND: Partial<Record<ProjectileKind, number>> = {
  [PRJ_KIND_IDS.PISTOL]: 0.2,
  [PRJ_KIND_IDS.DAGGER]: 0.9,
  [PRJ_KIND_IDS.SPARK]: 0.6,
};

export function getProjectilePresentation(kind: number): ProjectilePresentationDef {
  const def = PROJECTILE_PRESENTATION_BY_KIND[kind as ProjectileKind];
  if (!def) {
    throw new Error(`Missing projectile presentation for kind ${kind}`);
  }
  return def;
}

export function getProjectilePresentationDrawScale(kind: number): number {
  return PROJECTILE_DRAW_SCALE_BY_KIND[kind as ProjectileKind] ?? 1;
}

export function resolveProjectileTravelVisualSpriteId(
  visual: ProjectileTravelVisualDef,
  nowSec: number,
  spawnTimeSec: number,
): string | null {
  if (visual.mode === "static") {
    return visual.spriteId.trim() || null;
  }
  if (visual.loopSpriteIds.length === 0) return null;
  const fps = Number.isFinite(visual.fps) && visual.fps > 0 ? visual.fps : PROJECTILE_ANIMATED_FPS_DEFAULT;
  const elapsed = Math.max(0, (Number.isFinite(nowSec) ? nowSec : 0) - (Number.isFinite(spawnTimeSec) ? spawnTimeSec : 0));
  const frameIndex = Math.floor(elapsed * fps) % visual.loopSpriteIds.length;
  return visual.loopSpriteIds[frameIndex] ?? null;
}

export function resolveProjectileBodySpriteId(
  kind: number,
  nowSec: number,
  spawnTimeSec: number,
): string | null {
  return resolveProjectileTravelVisualSpriteId(getProjectilePresentation(kind).body, nowSec, spawnTimeSec);
}

export function getProjectileHitVfx(kind: number): AnimatedProjectileHitPresentationDef | null {
  const def = getProjectilePresentation(kind);
  return def.hit ?? null;
}

function addTravelVisualSpriteIds(ids: Set<string>, visual: ProjectileTravelVisualDef): void {
  if (visual.mode === "static") {
    const spriteId = visual.spriteId.trim();
    if (spriteId) ids.add(spriteId);
    return;
  }
  for (const spriteId of visual.loopSpriteIds) {
    if (spriteId.trim()) ids.add(spriteId);
  }
}

export function listProjectileTravelSpriteIds(): string[] {
  const ids = new Set<string>();
  for (const def of Object.values(PROJECTILE_PRESENTATION_BY_KIND)) {
    addTravelVisualSpriteIds(ids, def.body);
    for (const attachment of def.attachments ?? []) {
      addTravelVisualSpriteIds(ids, attachment.visual);
    }
  }
  return Array.from(ids).sort();
}

export function listProjectilePresentationSpriteIds(): string[] {
  const ids = new Set<string>(listProjectileTravelSpriteIds());
  for (const def of Object.values(PROJECTILE_PRESENTATION_BY_KIND)) {
    if (!def.hit) continue;
    for (const spriteId of def.hit.spriteIds) {
      if (spriteId.trim()) ids.add(spriteId);
    }
  }
  return Array.from(ids).sort();
}

export function listProjectileHitVfxEntries(): ProjectileHitVfxEntry[] {
  const entries: ProjectileHitVfxEntry[] = [];
  for (const def of Object.values(PROJECTILE_PRESENTATION_BY_KIND)) {
    if (!def.hit || def.hit.spriteIds.length === 0) continue;
    entries.push({
      key: def.hit.vfxKey,
      fps: def.hit.fps ?? (def.body.mode === "animated" ? def.body.fps : PROJECTILE_ANIMATED_FPS_DEFAULT),
      spriteIds: [...def.hit.spriteIds],
      loop: false,
    });
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}
