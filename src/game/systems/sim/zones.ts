import { emitEvent, type World } from "../../../engine/world/world";
import { isEnemyInCircle } from "./hitDetection";
import { tickDelayedExplosions } from "./delayedExplosions";
import { queryCircle } from "../../util/spatialHash";
import { onEnemyKilledForChallenge } from "../progression/roomChallenge";
import { anchorFromWorld, writeAnchor } from "../../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getEnemyWorld, getPlayerWorld, getZoneWorld } from "../../coords/worldViews";
import { getUserSettings } from "../../../userSettings";
import { applyPlayerIncomingDamage } from "./playerArmor";
import { breakMomentumOnLifeDamage } from "./momentum";
import { ZONE_KIND } from "../../factories/zoneFactory";

/** Update zones, apply periodic damage, and process delayed explosions. */
export function zonesSystem(w: World, dt: number) {
    const godMode = !!getUserSettings().debug.godMode;
    const PLAYER_R = w.playerR;
    const T = KENNEY_TILE_WORLD;
    const pw = getPlayerWorld(w, T);
    const px = pw.wx;
    const py = pw.wy;

    const syncZoneGrid = (i: number, wx: number, wy: number) => {
        const anchor = anchorFromWorld(wx, wy, T);
        writeAnchor({ gxi: w.zgxi, gyi: w.zgyi, gox: w.zgox, goy: w.zgoy }, i, anchor);
    };

    tickDelayedExplosions(w, dt);


    // Cache zone floor height so we don’t recompute every tick.
    // Stored on world as a private field to avoid touching the World type.
    const zFloorH = ((w as any)._zFloorH ??= []) as number[];

    for (let z = 0; z < w.zAlive.length; z++) {
        if (!w.zAlive[z]) continue;

        // TTL
        const ttl = w.zTtl[z];
        if (ttl !== Infinity) {
            w.zTtl[z] = ttl - dt;
            if (w.zTtl[z] <= 0) {
                w.zAlive[z] = false;
                continue;
            }
        }

        // Follow player
        if (w.zFollowPlayer[z]) {
            syncZoneGrid(z, px, py);

            // If it follows the player, its floor height should follow too
            zFloorH[z] = w.activeFloorH | 0;
        }

        // Tick countdown
        w.zTickLeft[z] -= dt;
        if (w.zTickLeft[z] > 0) continue;

        const every = Math.max(0.02, w.zTickEvery[z]);
        while (w.zTickLeft[z] <= 0) w.zTickLeft[z] += every;

        const zp = getZoneWorld(w, z, T);
        const zx = zp.wx;
        const zy = zp.wy;
        const zr = w.zR[z];

        // Initialize cached zone floor height if missing:
        // Use player-follow height if available, otherwise infer from the CURRENT active floor.
        // (This is correct for your current Sanctuary layout because all combat happens on active floor.)
        if (zFloorH[z] === undefined) zFloorH[z] = w.activeFloorH | 0;

        const zoneFloor = zFloorH[z] | 0;

        // ---------------------------------------------------------
        // SAME-FLOOR GATING (Milestone C)
        // Zones ONLY affect entities on the same integer floor height.
        // ---------------------------------------------------------

        // Player damage (boss hazards) — only if player is on same floor
        const pdmg = w.zDamagePlayer[z] ?? 0;
        if (pdmg > 0 && zr > 0) {
            if ((w.activeFloorH | 0) === zoneFloor) {
                const dx = px - zx;
                const dy = py - zy;
                const rr = zr + PLAYER_R;
                if (dx * dx + dy * dy <= rr * rr) {
                    const lifeDamage = godMode ? 0 : applyPlayerIncomingDamage(w, pdmg);
                    if (!godMode) w.playerHp -= lifeDamage;
                    if (lifeDamage > 0) {
                        breakMomentumOnLifeDamage(w, w.timeSec ?? w.time ?? 0);
                    }
                    emitEvent(w, { type: "PLAYER_HIT", damage: lifeDamage, x: px, y: py });
                }
            }
        }

        // Enemy damage — only enemies on same floor
        const dmg = w.zDamage[z];
        if (dmg <= 0 || zr <= 0) continue;

        const nearbyEnemies = queryCircle(w.enemySpatialHash, zx, zy, zr + 50);
        const checkedEnemies = new Set<number>();

        for (let i = 0; i < nearbyEnemies.length; i++) {
            const e = nearbyEnemies[i];
            if (checkedEnemies.has(e)) continue;
            checkedEnemies.add(e);

            if (!w.eAlive[e]) continue;

            // Gate by floor:
            // enemies store continuous Z in w.ezVisual, and we already have the integer active floor.
            // We’ll treat an enemy as “on a floor” by rounding its z to integer.
            const ez = (w.ezVisual?.[e] ?? 0) as number;
            const enemyFloor = (ez + 0.00001) | 0; // stable int floor

            if (enemyFloor !== zoneFloor) continue;
            if (!isEnemyInCircle(w, e, zx, zy, zr)) continue;

            w.eHp[e] -= dmg;

            const ew = getEnemyWorld(w, e, T);
            emitEvent(w, {
                type: "ENEMY_HIT",
                enemyIndex: e,
                damage: dmg,
                dmgPhys: w.zKind[z] === ZONE_KIND.FIRE ? 0 : dmg,
                dmgFire: w.zKind[z] === ZONE_KIND.FIRE ? dmg : 0,
                dmgChaos: 0,
                x: ew.wx,
                y: ew.wy,
                isCrit: false,
                source: "OTHER",
            });

            if (w.eHp[e] <= 0) {
                w.eAlive[e] = false;
                w.kills++;
                onEnemyKilledForChallenge(w);

                emitEvent(w, {
                    type: "ENEMY_KILLED",
                    enemyIndex: e,
                    x: ew.wx,
                    y: ew.wy,
                    source: "OTHER",
                });
            }
        }
    }

}
