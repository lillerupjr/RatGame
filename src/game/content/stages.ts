// src/game/content/stages.ts
export type StageId = "DOCKS" | "SEWERS" | "CHINATOWN";

export type StageDef = {
  id: StageId;
  name: string;
  duration: number; // seconds until boss (boss system / objectives decide actual end)
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
