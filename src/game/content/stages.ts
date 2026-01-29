// src/game/content/stages.ts
export type SpawnEntry = { t: number; type: number; count: number; radius: number };

export type StageId = "DOCKS" | "SEWERS" | "CHINATOWN";

export type StageDef = {
  id: StageId;
  name: string;
  duration: number; // seconds until boss
  spawns: SpawnEntry[]; // one-time timeline spawns (the trickle is handled by spawnSystem)
};

// Enemy types (current):
// 1 = CHASER, 2 = RUNNER, 3 = BRUISER
//
// Philosophy for 3:00 floors:
// - Intro waves are small (so early Lv1-3 is survivable)
// - Mid waves force movement (runners show up)
// - Late waves add bruisers so evolutions aren’t an instant win
// - Final 10s spike to “announce” boss

export const stageDocks: StageDef = {
  id: "DOCKS",
  name: "Docks",
  duration: 120,
  spawns: [
    // 0:00–0:30 (settle in)
    { t: 0,  type: 1, count: 10, radius: 560 },
    { t: 10, type: 1, count: 8,  radius: 560 },
    { t: 20, type: 2, count: 6,  radius: 590 },

    // 0:30–1:00 (first spike)
    { t: 30, type: 1, count: 14, radius: 600 },
    { t: 40, type: 2, count: 10, radius: 600 },
    { t: 55, type: 3, count: 2,  radius: 640 },

    // 1:00–1:30 (build check)
    { t: 60, type: 1, count: 16, radius: 620 },
    { t: 75, type: 2, count: 12, radius: 620 },
    { t: 85, type: 3, count: 3,  radius: 650 },

    // 1:30–2:00 (pressure ramps)
    { t: 90,  type: 1, count: 18, radius: 640 },
    { t: 105, type: 2, count: 14, radius: 640 },
    { t: 115, type: 3, count: 4,  radius: 670 },

    // 2:00–2:30 (evo online, bruisers appear more)
    { t: 120, type: 1, count: 18, radius: 660 },
    { t: 135, type: 2, count: 14, radius: 660 },
    { t: 145, type: 3, count: 6,  radius: 690 },

    // 2:30–3:00 (pre-boss surge)
    { t: 150, type: 1, count: 20, radius: 680 },
    { t: 160, type: 2, count: 16, radius: 680 },
    { t: 170, type: 3, count: 8,  radius: 710 },
  ],
};

export const stageSewers: StageDef = {
  id: "SEWERS",
  name: "Sewers",
  duration: 120,
  spawns: [
    // more bruisers earlier than docks
    { t: 0,  type: 1, count: 10, radius: 560 },
    { t: 12, type: 2, count: 8,  radius: 590 },
    { t: 22, type: 3, count: 2,  radius: 630 },

    { t: 30, type: 1, count: 14, radius: 610 },
    { t: 45, type: 2, count: 12, radius: 610 },
    { t: 55, type: 3, count: 3,  radius: 650 },

    { t: 60, type: 1, count: 16, radius: 630 },
    { t: 75, type: 2, count: 14, radius: 630 },
    { t: 85, type: 3, count: 4,  radius: 670 },

    { t: 90,  type: 1, count: 18, radius: 650 },
    { t: 105, type: 2, count: 16, radius: 650 },
    { t: 112, type: 3, count: 6,  radius: 690 },

    { t: 120, type: 1, count: 18, radius: 670 },
    { t: 135, type: 2, count: 16, radius: 670 },
    { t: 145, type: 3, count: 7,  radius: 710 },

    { t: 150, type: 1, count: 20, radius: 690 },
    { t: 160, type: 2, count: 18, radius: 690 },
    { t: 170, type: 3, count: 10, radius: 730 },
  ],
};

export const stageChinatown: StageDef = {
  id: "CHINATOWN",
  name: "Chinatown",
  duration: 120,
  spawns: [
    // runner-heavy identity, bruisers become scary late
    { t: 0,  type: 2, count: 12, radius: 580 },
    { t: 10, type: 1, count: 8,  radius: 580 },
    { t: 20, type: 2, count: 10, radius: 610 },

    { t: 30, type: 2, count: 16, radius: 620 },
    { t: 45, type: 1, count: 10, radius: 620 },
    { t: 55, type: 3, count: 3,  radius: 660 },

    { t: 60, type: 2, count: 18, radius: 640 },
    { t: 75, type: 1, count: 12, radius: 640 },
    { t: 85, type: 3, count: 5,  radius: 680 },

    { t: 90,  type: 2, count: 20, radius: 660 },
    { t: 105, type: 1, count: 12, radius: 660 },
    { t: 112, type: 3, count: 7,  radius: 700 },

    { t: 120, type: 2, count: 22, radius: 680 },
    { t: 135, type: 1, count: 14, radius: 680 },
    { t: 145, type: 3, count: 9,  radius: 720 },

    { t: 150, type: 2, count: 24, radius: 700 },
    { t: 160, type: 1, count: 14, radius: 700 },
    { t: 170, type: 3, count: 12, radius: 740 },
  ],
};
