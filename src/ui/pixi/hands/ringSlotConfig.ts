import type { FingerSlotId, HandId } from "../../../game/progression/rings/ringTypes";

export type SlotConfig = {
  slotId: FingerSlotId;
  hand: HandId;
  index: number;
  /** X position as percentage of hands sprite width */
  xPct: number;
  /** Y position as percentage of hands sprite height */
  yPct: number;
  rotationDeg: number;
  scale: number;
  hitRadius: number;
};

// Approximate positions from the HTML prototype (1536×1024 image).
// Tunable via debugSlotTuner.
export const SLOT_CONFIGS: SlotConfig[] = [
  { slotId: "LEFT:0",  hand: "LEFT",  index: 0, xPct: 18.0, yPct: 34.0, rotationDeg: -31, scale: 1.0, hitRadius: 18 },
  { slotId: "LEFT:1",  hand: "LEFT",  index: 1, xPct: 25.0, yPct: 30.5, rotationDeg:   1, scale: 1.0, hitRadius: 18 },
  { slotId: "LEFT:2",  hand: "LEFT",  index: 2, xPct: 32.5, yPct: 33.5, rotationDeg:  23, scale: 1.0, hitRadius: 18 },
  { slotId: "LEFT:3",  hand: "LEFT",  index: 3, xPct: 35.5, yPct: 49.0, rotationDeg:  68, scale: 1.0, hitRadius: 18 },
  { slotId: "RIGHT:0", hand: "RIGHT", index: 0, xPct: 64.0, yPct: 49.0, rotationDeg: -70, scale: 1.0, hitRadius: 18 },
  { slotId: "RIGHT:1", hand: "RIGHT", index: 1, xPct: 67.5, yPct: 33.0, rotationDeg: -28, scale: 1.0, hitRadius: 18 },
  { slotId: "RIGHT:2", hand: "RIGHT", index: 2, xPct: 75.0, yPct: 31.5, rotationDeg:   0, scale: 1.0, hitRadius: 18 },
  { slotId: "RIGHT:3", hand: "RIGHT", index: 3, xPct: 81.5, yPct: 35.5, rotationDeg:  27, scale: 1.0, hitRadius: 18 },
];

// Mutable copy for runtime tuning
let runtimeConfigs: SlotConfig[] = SLOT_CONFIGS.map((c) => ({ ...c }));

export function getSlotConfigs(): readonly SlotConfig[] {
  return runtimeConfigs;
}

export function updateSlotConfig(slotId: FingerSlotId, patch: Partial<SlotConfig>): void {
  const cfg = runtimeConfigs.find((c) => c.slotId === slotId);
  if (cfg) Object.assign(cfg, patch);
}

export function resetSlotConfigs(): void {
  runtimeConfigs = SLOT_CONFIGS.map((c) => ({ ...c }));
}

export function exportSlotConfigsJSON(): string {
  return JSON.stringify(runtimeConfigs, null, 2);
}

/**
 * Generate slot configs for a total slot count that may exceed the base 8.
 * The base 8 slots use their tuned configs; extra fingers are interpolated
 * outward from the existing hand positions.
 */
export function generateDynamicSlotConfigs(totalSlots: number): SlotConfig[] {
  if (totalSlots <= SLOT_CONFIGS.length) {
    return runtimeConfigs.slice();
  }

  const result = runtimeConfigs.slice();

  // Count how many extra slots exist beyond the base per hand.
  // Snapshot slots are ordered LEFT then RIGHT, so we need to figure out
  // per-hand counts from the slotIds in the snapshot. But here we just generate
  // configs for indices beyond the base — the caller passes totalSlots globally.
  // Extra slots are identified by their slotId pattern (e.g. LEFT:4, RIGHT:4).
  for (let i = result.length; i < totalSlots; i++) {
    // Determine hand: extra slots alternate LEFT/RIGHT based on total distribution
    // The snapshot already has the correct slotIds; we just need positional configs.
    // Use a simple heuristic: if we have LEFT:4, it's the 5th left finger, etc.
    // For now, generate placeholders that interpolate outward.
    const isLeft = i % 2 === 0;
    const hand: HandId = isLeft ? "LEFT" : "RIGHT";
    const handBase = SLOT_CONFIGS.filter((c) => c.hand === hand);
    const extraIdx = Math.floor((i - SLOT_CONFIGS.length) / 2);
    const lastSlot = handBase[handBase.length - 1];
    const firstSlot = handBase[0];

    // Extrapolate outward from the outermost finger
    const outerSlot = isLeft ? firstSlot : lastSlot;
    const innerSlot = isLeft ? handBase[1] : handBase[handBase.length - 2];
    const dx = outerSlot.xPct - innerSlot.xPct;
    const dy = outerSlot.yPct - innerSlot.yPct;

    const fingerIndex = handBase.length + extraIdx;
    const slotId: FingerSlotId = `${hand}:${fingerIndex}`;

    result.push({
      slotId,
      hand,
      index: fingerIndex,
      xPct: outerSlot.xPct + dx * (extraIdx + 1),
      yPct: outerSlot.yPct + dy * (extraIdx + 1),
      rotationDeg: outerSlot.rotationDeg,
      scale: 0.9,
      hitRadius: 18,
    });
  }

  return result;
}
