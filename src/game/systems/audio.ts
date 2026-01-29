// src/game/systems/audio.ts
import type { World } from "../world";
import { playSfx } from "../audio/sfx";
import type { GameEvent } from "../events";
import { PRJ_KIND } from "../factories/projectileFactory";

export function audioSystem(w: World, dt: number) {
    const anyW = w as any;

    // -------------------------
    // Footsteps (cadenced while moving)
    // -------------------------
    // Only during RUN (avoid menu spam)
    if (w.state === "RUN") {
        const speed = Math.hypot(w.pvx, w.pvy);
        const moving = speed > 12;

        anyW._walkStepT = (anyW._walkStepT ?? 0) - dt;

        if (!moving) {
            // reset so first step happens quickly when you start moving again
            anyW._walkStepT = Math.min(anyW._walkStepT, 0);
        } else if (anyW._walkStepT <= 0) {
            const stepEvery = 0.22; // tweak to taste
            anyW._walkStepT = stepEvery;

            void playSfx("WALK_STEP", {
                vol: 0.22,
                rate: 0.95 + (w.rng?.range?.(0, 0.08) ?? 0),
            });
        }
    }

    // -------------------------
    // Basic throttles to prevent audio spam
    // -------------------------
    anyW._sfxHitCd = Math.max(0, (anyW._sfxHitCd ?? 0) - dt);
    anyW._sfxKillCd = Math.max(0, (anyW._sfxKillCd ?? 0) - dt);
    anyW._sfxExplodeCd = Math.max(0, (anyW._sfxExplodeCd ?? 0) - dt);
    anyW._sfxFireCd = Math.max(0, (anyW._sfxFireCd ?? 0) - dt);
    anyW._sfxXpCd = Math.max(0, (anyW._sfxXpCd ?? 0) - dt);

    // -------------------------
    // Consume events
    // -------------------------
    for (const ev of w.events as GameEvent[]) {
        // Generic SFX trigger
        if (ev.type === "SFX") {
            // Fire SFX mapped from last projectile kind
            if (ev.id.startsWith("FIRE_")) {
                if (anyW._sfxFireCd > 0) continue;
                anyW._sfxFireCd = 0.03;

                const kind = (anyW._lastFireProjKind ?? PRJ_KIND.KNIFE) as number;

                let sfx:
                    | "FIRE_OTHER"
                    | "FIRE_KNIFE"
                    | "FIRE_PISTOL"
                    | "FIRE_SYRINGE"
                    | "FIRE_BOUNCER"
                    | "FIRE_BAZOOKA" = "FIRE_OTHER";

                if (kind === PRJ_KIND.KNIFE) sfx = "FIRE_KNIFE";
                else if (kind === PRJ_KIND.PISTOL) sfx = "FIRE_PISTOL";
                else if (kind === PRJ_KIND.SYRINGE) sfx = "FIRE_SYRINGE";
                else if (kind === PRJ_KIND.BOUNCER) sfx = "FIRE_BOUNCER";
                else if (kind === PRJ_KIND.BAZOOKA) sfx = "FIRE_BAZOOKA";

                void playSfx(sfx, { vol: ev.vol ?? 0.55, rate: ev.rate ?? 1 });
                continue;
            }

            // Explosion variants (bazooka vs syringe)
            if (ev.id === "EXPLOSION_BAZOOKA" || ev.id === "EXPLOSION_SYRINGE") {
                if (anyW._sfxExplodeCd > 0) continue;
                anyW._sfxExplodeCd = 0.06;
                void playSfx(ev.id, { vol: ev.vol ?? 0.75, rate: ev.rate ?? 1 });
                continue;
            }

            // XP pickup (throttled)
            if (ev.id === "XP_PICKUP") {
                if (anyW._sfxXpCd > 0) continue;
                anyW._sfxXpCd = 0.04;
                void playSfx("XP_PICKUP", { vol: ev.vol ?? 0.35, rate: ev.rate ?? 1 });
                continue;
            }

            // Everything else: play as-is
            void playSfx(ev.id as any, { vol: ev.vol ?? 1, rate: ev.rate ?? 1 });
            continue;
        }

        // Derived sounds from game events
        if (ev.type === "PLAYER_HIT") {
            void playSfx("PLAYER_HIT", { vol: 0.9, rate: 1 });
            continue;
        }

        if (ev.type === "ENEMY_HIT") {
            if (anyW._sfxHitCd > 0) continue;
            anyW._sfxHitCd = 0.02;
            void playSfx("ENEMY_HIT", { vol: 0.25, rate: 1 });
            continue;
        }

        if (ev.type === "ENEMY_KILLED") {
            if (anyW._sfxKillCd > 0) continue;
            anyW._sfxKillCd = 0.04;
            void playSfx("ENEMY_KILL", { vol: 0.45, rate: 1 });
            continue;
        }
    }
}
