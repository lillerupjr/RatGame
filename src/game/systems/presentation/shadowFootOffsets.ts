import { ENEMIES, type EnemyId } from "../../content/enemies";

export type ShadowFootOffset = { x: number; y: number };

const DEFAULT_OFFSET: ShadowFootOffset = { x: 0, y: 0 };

const PLAYER_OFFSETS_BY_SKIN: Record<string, ShadowFootOffset> = {
  jack: { x: 0, y: -6 },
  hobo: { x: 0, y: -2 },
  jamal: { x: 0, y: 4 },
  joey: { x: 0, y: -4 },
  tommy: { x: 0, y: 0 },
};

const VENDOR_OFFSETS_BY_KIND: Record<"vendor" | "healer", ShadowFootOffset> = {
  vendor: { x: 0, y: 0 },
  healer: { x: 0, y: 0 },
};

const NEUTRAL_OFFSETS_BY_KIND: Record<string, ShadowFootOffset> = {
  PIGEON: { x: 4, y: -2 },
};

export function resolvePlayerShadowFootOffset(skin: string | null | undefined): ShadowFootOffset {
  if (!skin) return DEFAULT_OFFSET;
  return PLAYER_OFFSETS_BY_SKIN[skin] ?? DEFAULT_OFFSET;
}

export function resolveEnemyShadowFootOffset(type: EnemyId): ShadowFootOffset {
  const archetypeOffset = ENEMIES[type]?.presentation?.shadowFootOffset;
  if (!archetypeOffset) return DEFAULT_OFFSET;
  return {
    x: Number.isFinite(archetypeOffset.x) ? archetypeOffset.x : 0,
    y: Number.isFinite(archetypeOffset.y) ? archetypeOffset.y : 0,
  };
}

export function resolveVendorShadowFootOffset(kind: "vendor" | "healer"): ShadowFootOffset {
  return VENDOR_OFFSETS_BY_KIND[kind] ?? DEFAULT_OFFSET;
}

export function resolveNeutralShadowFootOffset(kind: string): ShadowFootOffset {
  return NEUTRAL_OFFSETS_BY_KIND[kind] ?? DEFAULT_OFFSET;
}

export function resolveProjectileShadowFootOffset(_kind: number): ShadowFootOffset {
  return DEFAULT_OFFSET;
}
