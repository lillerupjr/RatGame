import { World, spawnXp } from "../world";

export function collisionsSystem(w: World, _dt: number) {
  // Player ↔ enemies
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;
    const dx = w.ex[i] - w.px;
    const dy = w.ey[i] - w.py;
    const r = w.eR[i] + 14; // player radius ~14
    if (dx * dx + dy * dy <= r * r) {
      // Simple contact damage with per-frame tick (tune later)
      w.playerHp -= w.eDamage[i] * 0.016;
    }
  }

  // Projectiles ↔ enemies
  for (let p = 0; p < w.pAlive.length; p++) {
    if (!w.pAlive[p]) continue;
    for (let e = 0; e < w.eAlive.length; e++) {
      if (!w.eAlive[e]) continue;
      const dx = w.ex[e] - w.prx[p];
      const dy = w.ey[e] - w.pry[p];
      const r = w.eR[e] + w.prR[p];
      if (dx * dx + dy * dy <= r * r) {
        w.eHp[e] -= w.prDamage[p];
        if (w.prPierce[p] > 0) {
          w.prPierce[p]--;
        } else {
          w.pAlive[p] = false;
        }

        if (w.eHp[e] <= 0) {
          w.eAlive[e] = false;
          w.kills++;
          spawnXp(w, w.ex[e], w.ey[e], 1);
        }

        if (!w.pAlive[p]) break;
      }
    }
  }
}
