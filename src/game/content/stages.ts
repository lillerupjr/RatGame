export type SpawnEntry = { t: number; type: number; count: number; radius: number };
export type StageDef = {
  name: string;
  duration: number; // seconds until boss
  spawns: SpawnEntry[];
};

export const stageDocks: StageDef = {
  name: "Docks",
  duration: 8 * 60,
  spawns: [
    { t: 0, type: 1, count: 6, radius: 520 },
    { t: 10, type: 1, count: 8, radius: 520 },
    { t: 20, type: 2, count: 6, radius: 520 },
    { t: 35, type: 1, count: 10, radius: 560 },
    { t: 50, type: 2, count: 8, radius: 560 },
    { t: 70, type: 3, count: 2, radius: 620 },
    // Repeat pressure every 15s via spawnSystem cadence
  ],
};
