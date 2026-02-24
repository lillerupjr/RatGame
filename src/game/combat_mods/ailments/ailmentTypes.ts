export type AilmentKind = "bleed" | "ignite" | "poison";

export interface AilmentInstance {
  kind: AilmentKind;
  dps: number; // damage per second BEFORE mitigation for this tick (we apply mitigation during ticking)
  tLeft: number; // seconds remaining
}

/** V1 caps */
export const AILMENT_STACK_CAP = 20;

export const AILMENT_DURATIONS: Record<AilmentKind, number> = {
  ignite: 4,
  poison: 2,
  bleed: 6,
};
