// src/game/content/stages.ts
export type StageId = "DOCKS" | "SEWERS" | "CHINATOWN";

export type StageDef = {
  id: StageId;
  name: string;
  duration: number; // baseline floor duration; objective flow decides the actual end
};

export const stageDocks: StageDef = {
  id: "DOCKS",
  name: "Docks",
  duration: 120,
};

export const stageSewers: StageDef = {
  id: "SEWERS",
  name: "Sewers",
  duration: 120,
};

export const stageChinatown: StageDef = {
  id: "CHINATOWN",
  name: "Chinatown",
  duration: 120,
};
