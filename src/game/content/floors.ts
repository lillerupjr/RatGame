// src/game/content/floors.ts
import type { World } from "../../engine/world/world";
import type { StageId } from "./stages";
import { ENEMY_TYPE, type EnemyType } from "./enemies";

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

export type Weight = { type: EnemyType; w: number };

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
                { type: ENEMY_TYPE.CHASER, w: 0.82 },
                { type: ENEMY_TYPE.RUNNER, w: 0.18 },
            ],
            mid: [
                { type: ENEMY_TYPE.CHASER, w: 0.55 },
                { type: ENEMY_TYPE.RUNNER, w: 0.35 },
                { type: ENEMY_TYPE.BRUISER, w: 0.10 },
            ],
            late: [
                { type: ENEMY_TYPE.CHASER, w: 0.40 },
                { type: ENEMY_TYPE.RUNNER, w: 0.34 },
                { type: ENEMY_TYPE.BRUISER, w: 0.26 },
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
                { type: ENEMY_TYPE.CHASER, w: 0.62 },
                { type: ENEMY_TYPE.RUNNER, w: 0.23 },
                { type: ENEMY_TYPE.BRUISER, w: 0.15 },
            ],
            mid: [
                { type: ENEMY_TYPE.CHASER, w: 0.44 },
                { type: ENEMY_TYPE.RUNNER, w: 0.28 },
                { type: ENEMY_TYPE.BRUISER, w: 0.28 },
            ],
            late: [
                { type: ENEMY_TYPE.CHASER, w: 0.34 },
                { type: ENEMY_TYPE.RUNNER, w: 0.26 },
                { type: ENEMY_TYPE.BRUISER, w: 0.40 },
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
                { type: ENEMY_TYPE.RUNNER, w: 0.60 },
                { type: ENEMY_TYPE.CHASER, w: 0.35 },
                { type: ENEMY_TYPE.BRUISER, w: 0.05 },
            ],
            mid: [
                { type: ENEMY_TYPE.RUNNER, w: 0.46 },
                { type: ENEMY_TYPE.CHASER, w: 0.30 },
                { type: ENEMY_TYPE.BRUISER, w: 0.24 },
            ],
            late: [
                { type: ENEMY_TYPE.RUNNER, w: 0.34 },
                { type: ENEMY_TYPE.CHASER, w: 0.24 },
                { type: ENEMY_TYPE.BRUISER, w: 0.42 },
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

function pickWeighted(w: World, weights: Weight[]): EnemyType {
    let sum = 0;
    for (const it of weights) sum += Math.max(0, it.w);

    if (sum <= 0) return ENEMY_TYPE.CHASER;

    let r = w.rng.range(0, sum);
    for (const it of weights) {
        r -= Math.max(0, it.w);
        if (r <= 0) return it.type;
    }
    return weights[weights.length - 1]?.type ?? ENEMY_TYPE.CHASER;
}

export function pickFloorEnemyType(w: World): EnemyType {
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
