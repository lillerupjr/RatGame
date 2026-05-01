export type FloorArchetype =
  | "SURVIVE"
  | "TIME_TRIAL"
  | "VENDOR"
  | "HEAL"
  | "ACT_BOSS"
  | "RARE_TRIPLE";

export const FLOOR_ARCHETYPES: FloorArchetype[] = [
  "SURVIVE",
  "TIME_TRIAL",
  "VENDOR",
  "HEAL",
  "ACT_BOSS",
  "RARE_TRIPLE",
];

const FLOOR_ARCHETYPE_DISPLAY_LABEL: Record<FloorArchetype, string> = {
  SURVIVE: "Survive",
  TIME_TRIAL: "Zone Trial",
  VENDOR: "Vendor",
  HEAL: "Heal",
  ACT_BOSS: "Boss",
  RARE_TRIPLE: "3 Rares",
};

export function floorArchetypeDisplayLabel(archetype: FloorArchetype): string {
  return FLOOR_ARCHETYPE_DISPLAY_LABEL[archetype] ?? archetype;
}
