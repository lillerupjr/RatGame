// src/game/systems/audio.ts
import type { World } from "../../../engine/world/world";
import { playSfx } from "../../../engine/audio/sfx";
import { clamp01 } from "../../../engine/util/clamp";
import type { GameEvent } from "../../events";
import { PRJ_KIND } from "../../factories/projectileFactory";

type VolMap = Record<string, number>;

/** Play SFX based on queued events and throttles. */
export function audioSystem(w: World, dt: number) {
    const anyW = w as any;

    // -------------------------
    // Global + per-SFX volume controls
    // -------------------------
    // Master SFX volume (0..1)
    if (anyW.sfxMaster === undefined) anyW.sfxMaster = 0.3;

    // Per SFX id volume multipliers (0..1)
    // You can tweak these at runtime: (world as any).sfxVol["FIRE_PISTOL"] = 0.6;
    if (!anyW.sfxVol) {
        anyW.sfxVol = {
            // fire
            FIRE_KNIFE: 1.0,
            FIRE_PISTOL: 0.2,
            FIRE_SYRINGE: 1.0,
            FIRE_BOUNCER: 1.0,
            FIRE_BAZOOKA: 1.0,
            FIRE_OTHER: 1.0,

            // movement
            WALK_STEP: 1.0,

            // explosions
            EXPLOSION_BAZOOKA: 1.0,
            EXPLOSION_SYRINGE: 1.0,

            // hits / kills
            ENEMY_HIT: 1.0,
            ENEMY_KILL: 0,
            PLAYER_HIT: 1.0,

            // progression
            XP_PICKUP: 1.0,
            LEVEL_UP: 1.0,
            CHEST_PICKUP: 1.0,

            // structure
            FLOOR_START: 1.0,
            BOSS_START: 1.0,
            RUN_WIN: 1.0,
            RUN_LOSE: 1.0,

            // ui
            UI_CLICK: 1.0,
        } satisfies VolMap;
    }

    const master = clamp01(Number(anyW.sfxMaster ?? 1));
    const per: VolMap = anyW.sfxVol as VolMap;

    function volFor(id: string, base: number): number {
        const baseV = clamp01(base);
        const perV = clamp01(Number(per[id] ?? 1));
        return baseV * master * perV;
    }

    // -------------------------
    // Footsteps (cadenced while moving)
    // -------------------------
    if (w.state === "RUN") {
        const speed = Math.hypot(w.pvx, w.pvy);
        const moving = speed > 12;

        anyW._walkStepT = (anyW._walkStepT ?? 0) - dt;

        if (!moving) {
            anyW._walkStepT = Math.min(anyW._walkStepT, 0);
        } else if (anyW._walkStepT <= 0) {
            const stepEvery = 0.22;
            anyW._walkStepT = stepEvery;

            void playSfx("WALK_STEP", {
                vol: volFor("WALK_STEP", 0.22),
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

                const base = ev.vol ?? 0.55;
                void playSfx(sfx, { vol: volFor(sfx, base), rate: ev.rate ?? 1 });
                continue;
            }

            // Explosion variants
            if (ev.id === "EXPLOSION_BAZOOKA" || ev.id === "EXPLOSION_SYRINGE") {
                if (anyW._sfxExplodeCd > 0) continue;
                anyW._sfxExplodeCd = 0.06;

                const base = ev.vol ?? 0.75;
                void playSfx(ev.id as any, { vol: volFor(ev.id, base), rate: ev.rate ?? 1 });
                continue;
            }

            // XP pickup (throttled)
            if (ev.id === "XP_PICKUP") {
                if (anyW._sfxXpCd > 0) continue;
                anyW._sfxXpCd = 0.04;

                const base = ev.vol ?? 0.35;
                void playSfx("XP_PICKUP", { vol: volFor("XP_PICKUP", base), rate: ev.rate ?? 1 });
                continue;
            }

            // Everything else: play as-is, but apply volume controls
            const base = ev.vol ?? 1;
            void playSfx(ev.id as any, { vol: volFor(ev.id, base), rate: ev.rate ?? 1 });
            continue;
        }

        // Derived sounds from game events (also routed through volume controls)
        if (ev.type === "PLAYER_HIT") {
            void playSfx("PLAYER_HIT", { vol: volFor("PLAYER_HIT", 0.9), rate: 1 });
            continue;
        }

        if (ev.type === "ENEMY_HIT") {
            if (anyW._sfxHitCd > 0) continue;
            anyW._sfxHitCd = 0.02;
            void playSfx("ENEMY_HIT", { vol: volFor("ENEMY_HIT", 0.25), rate: 1 });
            continue;
        }

        if (ev.type === "ENEMY_KILLED") {
            if (anyW._sfxKillCd > 0) continue;
            anyW._sfxKillCd = 0.04;
            void playSfx("ENEMY_KILL", { vol: volFor("ENEMY_KILL", 0.45), rate: 1 });
            continue;
        }
    }
}
