import { getCombatModsSnapshot } from "../../../combat_mods/debug/combatModsSnapshot";

export type DpsSpawnBudgetDebugInfo = {
  estimatedDps: number;
  damagePerHit: number;
  shotsPerSecond: number;
  projectiles: number;
  critFactor: number;
  liveDps: number;
  liveDpsInstant: number;
  spawnHpPerSecond: number;
  margin: number;
  ratio: number;
};

export function computeDpsSpawnBudgetDebugInfo(w: any): DpsSpawnBudgetDebugInfo {
  const snapshot = getCombatModsSnapshot(w);
  const stats = snapshot.weaponStats;
  const damagePerHit = Math.max(
    0,
    (stats.baseDamage.physical ?? 0) + (stats.baseDamage.fire ?? 0) + (stats.baseDamage.chaos ?? 0),
  );
  const shotsPerSecond = Math.max(0, stats.shotsPerSecond ?? 0);
  const projectiles = Math.max(1, stats.projectiles ?? 1);
  const critFactor = Math.max(1, 1 + (stats.critChance ?? 0) * ((stats.critMulti ?? 1) - 1));
  const estimatedDps = damagePerHit * shotsPerSecond * projectiles * critFactor;
  const liveDps = Math.max(0, w.metrics?.dps?.dpsSmoothed ?? 0);
  const liveDpsInstant = Math.max(0, w.metrics?.dps?.dpsInstant ?? 0);
  const spawnHpPerSecond = Math.max(0, w.spawnDirectorDebug?.spawnHpPerSecond ?? 0);
  const margin = estimatedDps - spawnHpPerSecond;
  const ratio = spawnHpPerSecond > 0 ? estimatedDps / spawnHpPerSecond : 0;

  return {
    estimatedDps,
    damagePerHit,
    shotsPerSecond,
    projectiles,
    critFactor,
    liveDps,
    liveDpsInstant,
    spawnHpPerSecond,
    margin,
    ratio,
  };
}
