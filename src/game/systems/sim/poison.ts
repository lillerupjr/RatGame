import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { onEnemyKilledForChallenge } from "../progression/roomChallenge";
import { getEnemyWorld } from "../../coords/worldViews";

/** Tick poison damage and emit poison hit/kill events. */
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

        const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);

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
