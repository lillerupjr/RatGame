import { ENEMY_TYPE, type EnemyType } from "../../content/enemies";

export type ShadowFootOffset = { x: number; y: number };

const DEFAULT_OFFSET: ShadowFootOffset = { x: 0, y: 0 };

const PLAYER_OFFSETS_BY_SKIN: Record<string, ShadowFootOffset> = {
  jack: { x: 0, y: -6 },
  hobo: { x: 0, y: -2 },
  jamal: { x: 0, y: 4 },
  joey: { x: 0, y: -4 },
  tommy: { x: 0, y: 0 },
};

const ENEMY_OFFSETS_BY_SKIN: Record<string, ShadowFootOffset> = {
  rat1: { x: 0, y: 0 },
  rat2: { x: 0, y: 0 },
  rat4: { x: 0, y: 0 },
  lootGoblin: { x: 0, y: 0 },
  infested: { x: 0, y: 0 },
};

const VENDOR_OFFSETS_BY_KIND: Record<"vendor" | "healer", ShadowFootOffset> = {
  vendor: { x: 0, y: 0 },
  healer: { x: 0, y: 0 },
};

const NEUTRAL_OFFSETS_BY_KIND: Record<string, ShadowFootOffset> = {
  PIGEON: { x: 4, y: -2 },
};

const PROJECTILE_OFFSETS_BY_KIND: Record<number, ShadowFootOffset> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: 0 },
  3: { x: 0, y: 0 },
  4: { x: 0, y: 0 },
  5: { x: 0, y: 0 },
  6: { x: 0, y: 0 },
};

export function resolvePlayerShadowFootOffset(skin: string | null | undefined): ShadowFootOffset {
  if (!skin) return DEFAULT_OFFSET;
  return PLAYER_OFFSETS_BY_SKIN[skin] ?? DEFAULT_OFFSET;
}

export function resolveEnemyShadowFootOffset(type: EnemyType): ShadowFootOffset {
  switch (type) {
    case ENEMY_TYPE.CHASER:
      return ENEMY_OFFSETS_BY_SKIN.rat1 ?? DEFAULT_OFFSET;
    case ENEMY_TYPE.RUNNER:
      return ENEMY_OFFSETS_BY_SKIN.rat2 ?? DEFAULT_OFFSET;
    case ENEMY_TYPE.BRUISER:
      return ENEMY_OFFSETS_BY_SKIN.rat4 ?? DEFAULT_OFFSET;
    case ENEMY_TYPE.LOOT_GOBLIN:
      return ENEMY_OFFSETS_BY_SKIN.lootGoblin ?? DEFAULT_OFFSET;
    case ENEMY_TYPE.BOSS:
      return ENEMY_OFFSETS_BY_SKIN.infested ?? DEFAULT_OFFSET;
    default:
      return DEFAULT_OFFSET;
  }
}

export function resolveVendorShadowFootOffset(kind: "vendor" | "healer"): ShadowFootOffset {
  return VENDOR_OFFSETS_BY_KIND[kind] ?? DEFAULT_OFFSET;
}

export function resolveNeutralShadowFootOffset(kind: string): ShadowFootOffset {
  return NEUTRAL_OFFSETS_BY_KIND[kind] ?? DEFAULT_OFFSET;
}

export function resolveProjectileShadowFootOffset(kind: number): ShadowFootOffset {
  return PROJECTILE_OFFSETS_BY_KIND[kind] ?? DEFAULT_OFFSET;
}
