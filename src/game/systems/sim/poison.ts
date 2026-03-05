import type { World } from "../../../engine/world/world";

/**
 * Legacy shim intentionally disabled.
 * Runtime DoT authority is centralized in combat/dot/dotTickSystem.ts.
 */
export function poisonSystem(_w: World, _dt: number): void {
  // no-op
}
