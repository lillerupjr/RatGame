import { World, emitEvent } from "../world";

/**
 * Handles projectile ↔ enemy collisions.
 * Emits events instead of spawning XP or doing other cross-system side effects.
 */
export function collisionsSystem(w: World, _dt: number) {
  // Projectiles vs Enemies
  for (let p = 0; p < w.pAlive.length; p++) {
    if (!w.pAlive[p]) continue;

    const px = w.prx[p];
    const py = w.pry[p];
    const pr = w.prR[p];

    // Track whether this projectile hit something this frame
    let hitSomething = false;

    for (let e = 0; e < w.eAlive.length; e++) {
      if (!w.eAlive[e]) continue;

      const dx = w.ex[e] - px;
      const dy = w.ey[e] - py;
      const rr = w.eR[e] + pr;

      if (dx * dx + dy * dy > rr * rr) continue;

      // HIT
      hitSomething = true;

      const dmg = w.prDamage[p];
      w.eHp[e] -= dmg;

      emitEvent(w, {
        type: "ENEMY_HIT",
        enemyIndex: e,
        damage: dmg,
        x: w.ex[e],
        y: w.ey[e],
        source: w.prjKind[p] === 2 ? "PISTOL" : "KNIFE",
      });

      // Pierce handling: pierce is "remaining extra enemies it can pass through"
      // pierce=0 means it dies on first hit
      if (w.prPierce[p] > 0) {
        w.prPierce[p] -= 1;
      } else {
        w.pAlive[p] = false;
      }

      // Death handling
      if (w.eHp[e] <= 0) {
        w.eAlive[e] = false;
        w.kills++;

        emitEvent(w, {
          type: "ENEMY_KILLED",
          enemyIndex: e,
          x: w.ex[e],
          y: w.ey[e],
          xpValue: 1, // tune later or base on enemy type
          source: w.prjKind[p] === 2 ? "PISTOL" : "KNIFE",
        });
      }

      // If projectile died on hit, stop checking further enemies
      if (!w.pAlive[p]) break;
    }

    // Optional: if you want projectiles to despawn when they don't hit anything after some time,
    // that should be handled in projectile movement / lifetime system, not here.
    void hitSomething;
  }

  // Player vs Enemies (if you already have this logic, keep it here, but emit PLAYER_HIT events)
  // NOTE: If you already have player collision damage elsewhere, paste it and I’ll event-ify it.
}

