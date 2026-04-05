import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getBossDefinitionForEntity, markBossEncounterDefeated } from "../../bosses/bossRuntime";
import { isProcDamage, makeEnemyHitMeta } from "../../combat/damageMeta";
import { registry } from "../../content/registry";
import type { DamageMeta, LegacyDamageSource } from "../../events";
import { getEnemyWorld } from "../../coords/worldViews";
import { spawnProjectile } from "../../factories/projectileFactory";
import type { HostileDeathEffectConfig } from "../../hostiles/hostileTypes";
import { onEnemyKilledForChallenge } from "../progression/roomChallenge";
import { addMomentumOnKill } from "../sim/momentum";
import { clearEnemyTransientState, ensureEnemyBrain, setEnemyBehaviorState } from "./brain";

const ENEMY_DEATH_PROJECTILE_RADIUS = 8;

function executeEnemyDeathEffects(
  w: World,
  enemyIndex: number,
  x: number,
  y: number,
  sourceId: string,
  deathEffects: HostileDeathEffectConfig[],
): void {
  if (deathEffects.length <= 0) return;

  for (let effectIndex = 0; effectIndex < deathEffects.length; effectIndex++) {
    const effect = deathEffects[effectIndex];

    switch (effect.type) {
      case "radial_projectiles": {
        const count = Math.max(1, Math.floor(effect.count));
        const speed = Math.max(0, effect.speed);
        const damage = Math.max(0, effect.damage);
        const ttl = Math.max(0.05, effect.ttl);
        const damageMeta = makeEnemyHitMeta(sourceId, "DEATH_RADIAL_PROJECTILES", {
          category: "HIT",
          mode: "INTRINSIC",
          instigatorId: String(enemyIndex),
        });

        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          spawnProjectile(w, {
            kind: effect.projectileKind,
            x,
            y,
            dirX: Math.cos(angle),
            dirY: Math.sin(angle),
            speed,
            damage,
            dmgPhys: damage,
            dmgFire: 0,
            dmgChaos: 0,
            radius: ENEMY_DEATH_PROJECTILE_RADIUS,
            pierce: 0,
            maxDist: speed * ttl,
            ttl,
            hitsPlayer: true,
            noCollide: true,
            z: (w.ezVisual?.[enemyIndex] ?? 0) + 1,
            zLogical: (w.ezLogical?.[enemyIndex] ?? 0) + 1,
            damageMeta,
          });
        }
        break;
      }
    }
  }
}

export function finalizeEnemyDeath(
  w: World,
  enemyIndex: number,
  options: {
    damageMeta: DamageMeta;
    source?: LegacyDamageSource;
    x?: number;
    y?: number;
    awardMomentum?: boolean;
    countKill?: boolean;
    recordPoisonedOnDeath?: boolean;
  },
): boolean {
  if (!w.eAlive[enemyIndex]) return false;

  w.eAlive[enemyIndex] = false;
  const bossDef = getBossDefinitionForEntity(w, enemyIndex);
  if (!bossDef) {
    const brain = ensureEnemyBrain(w, enemyIndex);
    clearEnemyTransientState(brain);
    brain.cooldownLeftSec = 0;
    brain.windupLeftSec = 0;
    setEnemyBehaviorState(brain, "dead");
  } else if (w.eBrain[enemyIndex]) {
    const brain = w.eBrain[enemyIndex]!;
    clearEnemyTransientState(brain);
    brain.cooldownLeftSec = 0;
    brain.windupLeftSec = 0;
    setEnemyBehaviorState(brain, "dead");
  }

  if (options.countKill !== false) {
    w.kills = (w.kills ?? 0) + 1;
  }
  if (options.awardMomentum && !isProcDamage(options.damageMeta)) {
    addMomentumOnKill(w, w.timeSec ?? w.time ?? 0);
  }
  onEnemyKilledForChallenge(w);

  if (options.recordPoisonedOnDeath !== false) {
    const poisonStacks = w.eAilments?.[enemyIndex]?.poison ?? [];
    w.ePoisonedOnDeath ??= [];
    w.ePoisonedOnDeath[enemyIndex] = poisonStacks.length > 0;
  }

  const pos =
    Number.isFinite(options.x) && Number.isFinite(options.y)
      ? { x: options.x as number, y: options.y as number }
      : (() => {
          const ew = getEnemyWorld(w, enemyIndex, KENNEY_TILE_WORLD);
          return { x: ew.wx, y: ew.wy };
        })();

  const enemyDef = bossDef ? null : registry.enemy(w.eType[enemyIndex] as import("../../content/enemies").EnemyId);
  executeEnemyDeathEffects(
    w,
    enemyIndex,
    pos.x,
    pos.y,
    bossDef?.id ?? String(enemyDef?.id ?? "UNKNOWN"),
    bossDef?.deathEffects ?? enemyDef?.deathEffects ?? [],
  );
  markBossEncounterDefeated(w, enemyIndex);

  emitEvent(w, {
    type: "ENEMY_KILLED",
    enemyIndex,
    x: pos.x,
    y: pos.y,
    spawnTriggerId: w.eSpawnTriggerId[enemyIndex],
    source: options.source,
    damageMeta: options.damageMeta,
  });
  return true;
}
