import { emitEvent, type World } from "../world";
import { gridToWorld } from "../coords/grid";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { onEnemyKilledForChallenge } from "./roomChallenge";

function enemyWorld(w: World, e: number) {
    const gx = w.egxi[e] + w.egox[e];
    const gy = w.egyi[e] + w.egoy[e];
    return gridToWorld(gx, gy, KENNEY_TILE_WORLD);
}

export function poisonSystem(w: World, dt: number) {
    for (let e = 0; e < w.eAlive.length; e++) {
        if (!w.eAlive[e]) continue;

        let t = w.ePoisonT[e];
        const dps = w.ePoisonDps[e];
        if (t <= 0 || dps <= 0) continue;

        t -= dt;
        w.ePoisonT[e] = t;

        const dmg = dps * dt;
        if (dmg <= 0) continue;

        w.eHp[e] -= dmg;

        const ew = enemyWorld(w, e);

        emitEvent(w, {
            type: "ENEMY_HIT",
            enemyIndex: e,
            damage: dmg,
            x: ew.wx,
            y: ew.wy,
            isCrit: false, // Poison damage doesn't crit
            source: "OTHER",
        });

        if (w.eHp[e] <= 0) {
            w.eAlive[e] = false;
            w.kills++;
            onEnemyKilledForChallenge(w);

            w.ePoisonedOnDeath[e] = (w.ePoisonT[e] > 0);

            emitEvent(w, {
                type: "ENEMY_KILLED",
                enemyIndex: e,
                x: ew.wx,
                y: ew.wy,
                xpValue: 1,
                source: "OTHER",
            });

            // you can still clear poison here if you want
            // w.ePoisonT[e] = 0;
            // w.ePoisonDps[e] = 0;
        }


        // When poison expires, clear DPS
        if (w.ePoisonT[e] <= 0) {
            w.ePoisonT[e] = 0;
            w.ePoisonDps[e] = 0;
        }
    }
}
