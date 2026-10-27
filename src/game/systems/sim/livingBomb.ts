// @system   core-simulation/combat-runtime
// @owns     periodic living bomb mark, speed buff, and death explosion for marked enemies
// @doc      docs/canonical/core_simulation_combat_runtime.md
// @agents   no combat rule collection; see combatRules.ts

import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getPlayerWorld, getEnemyWorld } from "../../coords/worldViews";
import { queryCircle } from "../../util/spatialHash";
import { isEnemyInCircle } from "./hitDetection";
import type { CombatRulesSnapshot } from "../../progression/effects/combatRules";

type LivingBombState = {
  cooldown: number;
  markedEnemyIndex: number | null;
};

function ensureState(w: World): LivingBombState {
  if (!(w as any)._livingBomb) {
    (w as any)._livingBomb = { cooldown: 0, markedEnemyIndex: null };
  }
  return (w as any)._livingBomb;
}

export function tickLivingBomb(w: World, dt: number, combatRules: CombatRulesSnapshot): void {
  if (!combatRules.livingBomb) return;

  const state = ensureState(w);
  const { markEvery } = combatRules.livingBomb;

  // If marked enemy is dead, clear the mark
  if (state.markedEnemyIndex != null) {
    if (!w.eAlive[state.markedEnemyIndex]) {
      state.markedEnemyIndex = null;
    }
  }

  // Decrement cooldown
  state.cooldown -= dt;
  if (state.cooldown > 0) return;
  if (state.markedEnemyIndex != null) return;

  // Find nearest alive enemy within 600px of the player
  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const px = pw.wx;
  const py = pw.wy;
  const searchRadius = 600;

  const nearby = queryCircle(w.enemySpatialHash, px, py, searchRadius + 50);
  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < nearby.length; i++) {
    const e = nearby[i];
    if (!w.eAlive[e]) continue;
    if (!isEnemyInCircle(w, e, px, py, searchRadius)) continue;

    const ePos = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
    const dx = ePos.wx - px;
    const dy = ePos.wy - py;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = e;
    }
  }

  if (bestIndex >= 0) {
    state.markedEnemyIndex = bestIndex;
    const ePos = getEnemyWorld(w, bestIndex, KENNEY_TILE_WORLD);
    emitEvent(w, { type: "VFX", id: "LIVING_BOMB_MARK", x: ePos.wx, y: ePos.wy });
  }

  state.cooldown = markEvery;
}

export function isLivingBombMarked(w: World, enemyIndex: number): boolean {
  return (w as any)._livingBomb?.markedEnemyIndex === enemyIndex;
}

export function clearLivingBombMark(w: World, enemyIndex: number): void {
  const state = (w as any)._livingBomb as LivingBombState | undefined;
  if (state && state.markedEnemyIndex === enemyIndex) {
    state.markedEnemyIndex = null;
  }
}
