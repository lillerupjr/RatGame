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
