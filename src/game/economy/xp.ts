import { getSettings } from "../../settings/settingsStore";
import { DEFAULT_XP_LEVEL_BASE, DEFAULT_XP_LEVEL_GROWTH } from "../../settings/systemOverrides";
import { addClusterJewelSkillPoints } from "../cluster_jewels/state";
import { enqueueRunEvent } from "../rewards/runEvents";

export type RunProgressionState = {
  runGold: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
};

function getFloorIndex(world: any): number {
  return Number.isFinite(world?.floorIndex) ? (world.floorIndex | 0) : 0;
}

function getXpConfig(): { xpLevelBase: number; xpLevelGrowth: number } {
  const system = getSettings().system;
  return {
    xpLevelBase: Number.isFinite(system?.xpLevelBase)
      ? Math.max(1, Math.round(system.xpLevelBase))
      : DEFAULT_XP_LEVEL_BASE,
    xpLevelGrowth: Number.isFinite(system?.xpLevelGrowth)
      ? Math.max(1, system.xpLevelGrowth)
      : DEFAULT_XP_LEVEL_GROWTH,
  };
}

export function ensureRunProgressionState(world: any): RunProgressionState {
  const config = getXpConfig();
  if (!world.run || typeof world.run !== "object") world.run = {};

  const run = world.run as Partial<RunProgressionState>;
  const legacyLevel = Number.isFinite(world?.level) ? Math.max(1, Math.floor(world.level)) : 1;

  if (!Number.isFinite(run.runGold)) run.runGold = 0;
  if (!Number.isFinite(run.xp) || (run.xp ?? 0) < 0) run.xp = 0;
  if (!Number.isFinite(run.level) || (run.level ?? 0) < 1) run.level = legacyLevel;
  if (!Number.isFinite(run.xpToNextLevel) || (run.xpToNextLevel ?? 0) < 1) {
    run.xpToNextLevel = config.xpLevelBase;
  }

  world.level = Math.max(1, Math.floor(run.level ?? 1));
  return world.run as RunProgressionState;
}

export function grantXp(world: any, amount: number): number {
  const run = ensureRunProgressionState(world);
  const gained = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (gained <= 0) return 0;

  run.xp += gained;

  while (run.xp >= run.xpToNextLevel) {
    run.xp -= run.xpToNextLevel;
    run.level = Math.max(1, Math.floor(run.level)) + 1;
    world.level = run.level;
    run.xpToNextLevel = Math.max(1, Math.ceil(run.xpToNextLevel * getXpConfig().xpLevelGrowth));
    addClusterJewelSkillPoints(world, 1);
    enqueueRunEvent(world, {
      type: "LEVEL_UP",
      floorIndex: getFloorIndex(world),
      level: run.level,
    });
  }

  world.level = run.level;
  return gained;
}
