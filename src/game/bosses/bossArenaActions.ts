import type { DamageMeta } from "../events";
import type { World } from "../../engine/world/world";
import type { BossAbilityId } from "./bossAbilities";
import type { BossArena } from "./bossArena";
import { arenaCellToWorldTile } from "./bossArena";
import { generateArenaPattern } from "./bossArenaPatterns";
import type {
  ArenaActionSpec,
  BossArenaActionPhase,
  BossArenaActionRuntimeState,
  BossArenaSequenceRuntimeState,
} from "./bossArenaTypes";
import { removeArenaTileEffectsByIds, upsertArenaTileEffect } from "./arenaTileEffects";

function resolveArenaActionPhase(
  spec: ArenaActionSpec,
  castElapsedSec: number,
): BossArenaActionPhase {
  const warningStart = spec.startAtSec;
  const activeStart = spec.startAtSec + spec.warningSec;
  const activeEnd = activeStart + spec.activeSec;
  if (castElapsedSec < warningStart) return "PENDING";
  if (castElapsedSec < activeStart) return "WARNING";
  if (castElapsedSec < activeEnd) return "ACTIVE";
  return "DONE";
}

export function createBossArenaSequenceRuntime(
  arena: BossArena,
  actions: ArenaActionSpec[],
  args?: { damageMeta?: DamageMeta },
): BossArenaSequenceRuntimeState {
  return {
    arena,
    actions: actions.map((spec) => {
      const selectedCells = generateArenaPattern(arena, spec.patternKind, spec.patternParams);
      return {
        spec,
        selectedCells,
        selectedTiles: selectedCells.map((cell) => arenaCellToWorldTile(arena, cell)),
        effectIds: [],
        phase: "PENDING",
        damageMeta: args?.damageMeta,
      };
    }),
  };
}

export function syncBossArenaSequence(
  world: World,
  args: {
    encounterId: string;
    abilityId: BossAbilityId;
    sequence: BossArenaSequenceRuntimeState;
    castElapsedSec: number;
  },
): { currentTiles: Array<{ tx: number; ty: number }> } {
  let currentTiles: Array<{ tx: number; ty: number }> = [];
  for (let i = 0; i < args.sequence.actions.length; i++) {
    const action = args.sequence.actions[i];
    const nextPhase = resolveArenaActionPhase(action.spec, args.castElapsedSec);
    if (nextPhase === action.phase) {
      if (nextPhase === "WARNING" || nextPhase === "ACTIVE") currentTiles = action.selectedTiles;
      continue;
    }

    if (nextPhase === "PENDING" || nextPhase === "DONE") {
      removeArenaTileEffectsByIds(world, action.effectIds);
      action.phase = nextPhase;
      continue;
    }

    const phaseStartAtSec = nextPhase === "WARNING"
      ? action.spec.startAtSec
      : action.spec.startAtSec + action.spec.warningSec;
    const phaseDurationSec = nextPhase === "WARNING" ? action.spec.warningSec : action.spec.activeSec;
    const ttlSec = Math.max(0.01, phaseDurationSec - Math.max(0, args.castElapsedSec - phaseStartAtSec));
    upsertArenaTileEffect(world, {
      effectIds: action.effectIds,
      encounterId: args.encounterId,
      abilityId: args.abilityId,
      tiles: action.selectedTiles,
      state: nextPhase,
      surfaceId: action.spec.surfaceId,
      ttlSec,
      tickEverySec: action.spec.tickEverySec,
      damagePlayer: nextPhase === "ACTIVE" ? action.spec.damagePlayer : 0,
      playerDamageMeta: action.damageMeta,
    });
    action.phase = nextPhase;
    currentTiles = action.selectedTiles;
  }
  return { currentTiles };
}

export function clearBossArenaSequence(
  world: World,
  sequence: BossArenaSequenceRuntimeState | null,
): void {
  if (!sequence) return;
  for (let i = 0; i < sequence.actions.length; i++) {
    removeArenaTileEffectsByIds(world, sequence.actions[i].effectIds);
    sequence.actions[i].phase = "DONE";
  }
}
