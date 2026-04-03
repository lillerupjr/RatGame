// src/game/content/floors.ts
import type { World } from "../../engine/world/world";
import type { StageId } from "./stages";
import { EnemyId } from "./enemies";

export type FloorId = "DOCKS" | "SEWERS" | "CHINATOWN";

export type FloorVisual = {
    tint: string;
    tintAlpha: number;

    gridAlpha: number;
    gridColor: string;
    cell: number;

    decalAlpha: number;
    decalColor: string;
    decalEvery: number;
};

export type Weight = { type: EnemyId; w: number };

export type FloorSpawnProfile = {
    cadence: number; // seconds between trickle spawn ticks
    perTickMin: number;
    perTickMax: number;

    ringMin: number;
    ringMax: number;

    early: Weight[];
    mid: Weight[];
    late: Weight[];
};

export type FloorDef = {
    id: FloorId;
    name: string;
    stageId: StageId;
    visual: FloorVisual;
    spawns: FloorSpawnProfile;

    bossTitle: string;
    bossAccent: string;
};

// For 180s floors:
// - Reduce trickle rate vs old 20s tuning, or you get *thousands* of enemies.
// - Ramp counts late so Lv5 evolutions don’t auto-win.
// - Docks: mostly chasers early.
// - Sewers: bruisers show earlier.
// - Chinatown: runner-heavy + bruiser-heavy late.

export const FLOORS: readonly FloorDef[] = [
    {
        id: "DOCKS",
        name: "Docks",
        stageId: "DOCKS",
        visual: {
            tint: "#0d1222",
            tintAlpha: 0.18,
            gridAlpha: 0.18,
            gridColor: "#ffffff",
            cell: 64,
            decalAlpha: 0.12,
            decalColor: "#9fb7ff",
            decalEvery: 180,
        },
        spawns: {
            // ~4 ticks/sec; early = 1, mid/late = 1-2 => ramps naturally
            cadence: 0.25,
            perTickMin: 1,
            perTickMax: 2,
            ringMin: 520,
            ringMax: 680,

            early: [
                { type: EnemyId.MINION, w: 0.74 },
                { type: EnemyId.RUNNER, w: 0.16 },
                { type: EnemyId.SPITTER, w: 0.06 },
                { type: EnemyId.SHARD_RAT, w: 0.04 },
            ],
            mid: [
                { type: EnemyId.MINION, w: 0.44 },
                { type: EnemyId.RUNNER, w: 0.24 },
                { type: EnemyId.TANK, w: 0.08 },
                { type: EnemyId.SPITTER, w: 0.08 },
                { type: EnemyId.LEAPER1, w: 0.04 },
                { type: EnemyId.BURSTER, w: 0.04 },
                { type: EnemyId.SHARD_RAT, w: 0.08 },
            ],
            late: [
                { type: EnemyId.MINION, w: 0.28 },
                { type: EnemyId.RUNNER, w: 0.22 },
                { type: EnemyId.TANK, w: 0.16 },
                { type: EnemyId.SPITTER, w: 0.10 },
                { type: EnemyId.LEAPER1, w: 0.06 },
                { type: EnemyId.BURSTER, w: 0.06 },
                { type: EnemyId.SHARD_RAT, w: 0.12 },
            ],
        },
        bossTitle: "Dock Kingpin",
        bossAccent: "#c8f",
    },

    {
        id: "SEWERS",
        name: "Sewers",
        stageId: "SEWERS",
        visual: {
            tint: "#07150f",
            tintAlpha: 0.22,
            gridAlpha: 0.14,
            gridColor: "#b9ffd6",
            cell: 72,
            decalAlpha: 0.10,
            decalColor: "#37ff6b",
            decalEvery: 160,
        },
        spawns: {
            cadence: 0.23,
            perTickMin: 1,
            perTickMax: 2,
            ringMin: 520,
            ringMax: 700,

            early: [
                { type: EnemyId.MINION, w: 0.49 },
                { type: EnemyId.RUNNER, w: 0.18 },
                { type: EnemyId.TANK, w: 0.12 },
                { type: EnemyId.SPITTER, w: 0.07 },
                { type: EnemyId.BURSTER, w: 0.06 },
                { type: EnemyId.SHARD_RAT, w: 0.08 },
            ],
            mid: [
                { type: EnemyId.MINION, w: 0.31 },
                { type: EnemyId.RUNNER, w: 0.18 },
                { type: EnemyId.TANK, w: 0.18 },
                { type: EnemyId.SPITTER, w: 0.09 },
                { type: EnemyId.LEAPER1, w: 0.07 },
                { type: EnemyId.BURSTER, w: 0.07 },
                { type: EnemyId.SHARD_RAT, w: 0.10 },
            ],
            late: [
                { type: EnemyId.MINION, w: 0.20 },
                { type: EnemyId.RUNNER, w: 0.16 },
                { type: EnemyId.TANK, w: 0.22 },
                { type: EnemyId.SPITTER, w: 0.10 },
                { type: EnemyId.LEAPER1, w: 0.10 },
                { type: EnemyId.BURSTER, w: 0.10 },
                { type: EnemyId.SHARD_RAT, w: 0.12 },
            ],
        },
        bossTitle: "Sludge Matron",
        bossAccent: "#37ff6b",
    },

    {
        id: "CHINATOWN",
        name: "Chinatown",
        stageId: "CHINATOWN",
        visual: {
            tint: "#1a0715",
            tintAlpha: 0.20,
            gridAlpha: 0.16,
            gridColor: "#ffd3f2",
            cell: 60,
            decalAlpha: 0.11,
            decalColor: "#ff4fd2",
            decalEvery: 170,
        },
        spawns: {
            // Chinatown is the “fast” floor: slightly higher trickle
            cadence: 0.20,
            perTickMin: 2,
            perTickMax: 3,
            ringMin: 520,
            ringMax: 720,

            early: [
                { type: EnemyId.RUNNER, w: 0.48 },
                { type: EnemyId.MINION, w: 0.28 },
                { type: EnemyId.TANK, w: 0.05 },
                { type: EnemyId.SPITTER, w: 0.08 },
                { type: EnemyId.LEAPER1, w: 0.05 },
                { type: EnemyId.SHARD_RAT, w: 0.06 },
            ],
            mid: [
                { type: EnemyId.RUNNER, w: 0.32 },
                { type: EnemyId.MINION, w: 0.18 },
                { type: EnemyId.TANK, w: 0.15 },
                { type: EnemyId.SPITTER, w: 0.10 },
                { type: EnemyId.LEAPER1, w: 0.08 },
                { type: EnemyId.BURSTER, w: 0.08 },
                { type: EnemyId.SHARD_RAT, w: 0.09 },
            ],
            late: [
                { type: EnemyId.RUNNER, w: 0.20 },
                { type: EnemyId.MINION, w: 0.14 },
                { type: EnemyId.TANK, w: 0.22 },
                { type: EnemyId.SPITTER, w: 0.10 },
                { type: EnemyId.LEAPER1, w: 0.12 },
                { type: EnemyId.BURSTER, w: 0.12 },
                { type: EnemyId.SHARD_RAT, w: 0.10 },
            ],
        },
        bossTitle: "Neon Triad Captain",
        bossAccent: "#ff4fd2",
    },
] as const;

export function floorForIndex(idx: number): FloorDef {
    const i = Math.max(0, Math.min(FLOORS.length - 1, idx | 0));
    return FLOORS[i];
}

function pickWeighted(w: World, weights: Weight[]): EnemyId {
    let sum = 0;
    for (const it of weights) sum += Math.max(0, it.w);

    if (sum <= 0) return EnemyId.MINION;

    let r = w.rng.range(0, sum);
    for (const it of weights) {
        r -= Math.max(0, it.w);
        if (r <= 0) return it.type;
    }
    return weights[weights.length - 1]?.type ?? EnemyId.MINION;
}

export function pickFloorEnemyType(w: World): EnemyId {
    const f = floorForIndex(w.floorIndex ?? 0);
    const t = w.phaseTime ?? 0;

    // split floor into thirds by *stage duration* (so tuning duration keeps behavior aligned)
    const dur = Math.max(1, w.floorDuration || w.stage?.duration || 1);
    const p = t / dur;

    const weights = p < 0.33 ? f.spawns.early : p < 0.66 ? f.spawns.mid : f.spawns.late;
    return pickWeighted(w, weights);
}

export function getFloorVisual(w: World): FloorVisual {
    return floorForIndex(w.floorIndex ?? 0).visual;
}

export function getBossAccent(w: World): string {
    return floorForIndex(w.floorIndex ?? 0).bossAccent;
}

export function getBossTitle(w: World): string {
    return floorForIndex(w.floorIndex ?? 0).bossTitle;
}
