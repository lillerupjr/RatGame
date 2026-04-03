import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { type EnemyAbilityConfig, EnemyId } from "../../content/enemies";
import { registry } from "../../content/registry";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { getPoeEnemyLeashAnchor, isPoeEnemyDormant } from "../../objectives/poeMapObjectiveSystem";
import { isLootGoblinEnemy } from "../progression/lootGoblin";
import { clearEnemyTransientState, ensureEnemyBrain, setEnemyBehaviorState } from "./brain";

function surfaceDistanceToPlayer(w: World, enemyIndex: number): number {
  const ew = getEnemyWorld(w, enemyIndex, KENNEY_TILE_WORLD);
  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const centerDist = Math.hypot(pw.wx - ew.wx, pw.wy - ew.wy);
  return Math.max(0, centerDist - ((w.eR[enemyIndex] ?? 0) + (w.playerR ?? 0)));
}

function holdBand(archetype: ReturnType<typeof registry.enemy>): { min: number; max: number } {
  const desiredRange = archetype.movement.desiredRange;
  const tolerance = archetype.movement.tolerance;
  return {
    min: Math.max(0, desiredRange - tolerance),
    max: desiredRange + tolerance,
  };
}

function isWithinBand(archetype: ReturnType<typeof registry.enemy>, surfaceDist: number): boolean {
  const band = holdBand(archetype);
  return surfaceDist >= band.min && surfaceDist <= band.max;
}

function needsRangeCorrection(archetype: ReturnType<typeof registry.enemy>, surfaceDist: number): boolean {
  return !isWithinBand(archetype, surfaceDist);
}

function leapTriggerRange(archetype: ReturnType<typeof registry.enemy>): number {
  return Math.max(0, archetype.movement.desiredRange);
}

function startWindup(brain: ReturnType<typeof ensureEnemyBrain>, ability: EnemyAbilityConfig): void {
  clearEnemyTransientState(brain);
  brain.windupLeftSec = ability.windupSec;
  setEnemyBehaviorState(brain, "windup");
}

export function enemyBehaviorSystem(w: World, dt: number): void {
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const type = w.eType[i] as EnemyId;
    const archetype = registry.enemy(type);
    const brain = ensureEnemyBrain(w, i);
    if (brain.state === "dead") continue;

    brain.stateTimeSec += dt;
    brain.cooldownLeftSec = Math.max(0, brain.cooldownLeftSec - dt);

    if (type === EnemyId.BOSS || isLootGoblinEnemy(w, i)) {
      continue;
    }

    if (archetype.movement.mode === "scripted" || isPoeEnemyDormant(w, i)) {
      continue;
    }

    if (getPoeEnemyLeashAnchor(w, i)) {
      clearEnemyTransientState(brain);
      brain.cooldownLeftSec = 0;
      setEnemyBehaviorState(brain, "move");
      continue;
    }

    const surfaceDist = surfaceDistanceToPlayer(w, i);

    switch (archetype.aiType) {
      case "contact": {
        clearEnemyTransientState(brain);
        brain.cooldownLeftSec = 0;
        setEnemyBehaviorState(brain, "move");
        break;
      }

      case "caster": {
        const ability = archetype.ability;
        if (!ability || ability.kind !== "projectile") {
          setEnemyBehaviorState(brain, "move");
          break;
        }

        if (brain.state === "windup") {
          brain.windupLeftSec = Math.max(0, brain.windupLeftSec - dt);
          if (brain.windupLeftSec <= 0) {
            setEnemyBehaviorState(brain, "acting");
          }
          break;
        }

        if (brain.state === "acting") {
          break;
        }

        if (needsRangeCorrection(archetype, surfaceDist) || surfaceDist > archetype.movement.reengageRange) {
          setEnemyBehaviorState(brain, "move");
          break;
        }

        if (brain.cooldownLeftSec > 0) {
          setEnemyBehaviorState(brain, "cooldown");
          break;
        }

        startWindup(brain, ability);
        break;
      }

      case "suicide": {
        const ability = archetype.ability;
        if (!ability || ability.kind !== "explode") {
          setEnemyBehaviorState(brain, "move");
          break;
        }

        if (brain.state === "windup") {
          brain.windupLeftSec = Math.max(0, brain.windupLeftSec - dt);
          if (brain.windupLeftSec <= 0) {
            setEnemyBehaviorState(brain, "acting");
          }
          break;
        }

        if (brain.state === "acting") {
          break;
        }

        if (!isWithinBand(archetype, surfaceDist)) {
          setEnemyBehaviorState(brain, "move");
          break;
        }

        startWindup(brain, ability);
        break;
      }

      case "leaper": {
        const ability = archetype.ability;
        if (!ability || ability.kind !== "leap") {
          setEnemyBehaviorState(brain, "move");
          break;
        }

        if (brain.state === "windup") {
          brain.windupLeftSec = Math.max(0, brain.windupLeftSec - dt);
          if (brain.windupLeftSec <= 0) {
            setEnemyBehaviorState(brain, "acting");
          }
          break;
        }

        if (brain.state === "acting") {
          break;
        }

        if (brain.cooldownLeftSec > 0) {
          setEnemyBehaviorState(brain, "move");
          break;
        }

        if (surfaceDist > leapTriggerRange(archetype)) {
          setEnemyBehaviorState(brain, "move");
          break;
        }

        startWindup(brain, ability);
        break;
      }

      default: {
        const _never: never = archetype.aiType;
        void _never;
      }
    }
  }
}
