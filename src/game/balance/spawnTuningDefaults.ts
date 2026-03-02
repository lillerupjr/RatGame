export type SpawnTuningDefaults = {
  spawnBase: number;
  spawnPerDepth: number;
  hpBase: number;
  hpPerDepth: number;
  pressureAt0Sec: number;
  pressureAt120Sec: number;
};

export const DEFAULT_SPAWN_TUNING: SpawnTuningDefaults = {
  spawnBase: 1.0,
  spawnPerDepth: 1.4,
  hpBase: 1.0,
  hpPerDepth: 1.4,
  pressureAt0Sec: 0.8,
  pressureAt120Sec: 1.4,
};
