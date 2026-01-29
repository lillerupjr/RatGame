// src/game/content/stages.ts
export type SpawnEntry = { t: number; type: number; count: number; radius: number };

export type StageId = "DOCKS" | "SEWERS" | "CHINATOWN";

export type StageDef = {
  id: StageId;
  name: string;
  duration: number; // seconds until boss
  spawns: SpawnEntry[]; // one-time timeline spawns (the trickle is handled by spawnSystem)
};

export const stageDocks: StageDef = {
  id: "DOCKS",
  name: "Docks",
  duration: 180,
  spawns: [
    { t: 0, type: 1, count: 6, radius: 520 },
    { t: 10, type: 1, count: 8, radius: 520 },
    { t: 20, type: 2, count: 6, radius: 520 },
    { t: 35, type: 1, count: 10, radius: 560 },
    { t: 50, type: 2, count: 8, radius: 560 },
    { t: 70, type: 3, count: 2, radius: 620 },
  ],
};

export const stageSewers: StageDef = {
  id: "SEWERS",
  name: "Sewers",
  duration: 180,
  spawns: [
    { t: 0, type: 1, count: 7, radius: 520 },
    { t: 12, type: 2, count: 6, radius: 520 },
    { t: 26, type: 1, count: 10, radius: 560 },
    { t: 40, type: 3, count: 2, radius: 600 },
    { t: 55, type: 2, count: 9, radius: 600 },
    { t: 75, type: 3, count: 3, radius: 650 },
  ],
};

export const stageChinatown: StageDef = {
  id: "CHINATOWN",
  name: "Chinatown",
  duration: 180,
  spawns: [
    { t: 0, type: 2, count: 8, radius: 520 },
    { t: 14, type: 1, count: 6, radius: 520 },
    { t: 28, type: 2, count: 10, radius: 560 },
    { t: 42, type: 3, count: 2, radius: 620 },
    { t: 60, type: 1, count: 12, radius: 620 },
    { t: 80, type: 3, count: 3, radius: 680 },
  ],
};
