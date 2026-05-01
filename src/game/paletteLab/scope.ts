import type { PaletteSnapshotWorldState } from "./terminology";

export const PALETTE_SNAPSHOT_PURPOSE = "visual-scene-reproduction" as const;

export const PALETTE_LAB_ALLOWED_CAPABILITIES = [
  "snapshot.capture",
  "snapshot.store",
  "snapshot.browse",
  "comparison.adjust",
] as const;

export const PALETTE_LAB_FORBIDDEN_CAPABILITIES = [
  "gameplay.saveLoad",
  "run.persistence",
  "progression.persistence",
  "inventory.persistence",
] as const;

export type PaletteLabAllowedCapability = (typeof PALETTE_LAB_ALLOWED_CAPABILITIES)[number];
export type PaletteLabForbiddenCapability = (typeof PALETTE_LAB_FORBIDDEN_CAPABILITIES)[number];

const VISUAL_WORLD_STATE_KEYS = [
  "player",
  "enemies",
  "lighting",
] as const;

const FORBIDDEN_WORLD_STATE_KEYS = [
  "gameplaySave",
  "saveSlot",
  "runPersistence",
  "progression",
  "inventory",
  "checkpoint",
] as const;

/**
 * Prevent palette snapshots from turning into gameplay persistence payloads.
 */
export function assertPaletteSnapshotWorldStateScope(worldState: PaletteSnapshotWorldState): void {
  const typedWorldState =
    worldState && typeof worldState === "object"
      ? (worldState as Record<string, unknown>)
      : {};

  const forbidden = FORBIDDEN_WORLD_STATE_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(typedWorldState, key),
  );

  if (forbidden.length > 0) {
    throw new Error(
      `Palette snapshot world state includes forbidden persistence fields: ${forbidden.join(", ")}`,
    );
  }

  const unsupported = Object.keys(typedWorldState)
    .filter((key) => !VISUAL_WORLD_STATE_KEYS.includes(key as (typeof VISUAL_WORLD_STATE_KEYS)[number]));
  if (unsupported.length === 0) return;

  throw new Error(
    `Palette snapshot world state includes unsupported non-visual fields: ${unsupported.join(", ")}`,
  );
}
