// src/game/content/floors.ts
import type { World } from "../world";
import type { StageId } from "./stages";
import { ENEMY_TYPE, type EnemyType } from "../content/enemies";

export type FloorId = "DOCKS" | "SEWERS" | "CHINATOWN";

export type FloorVisual = {
    // background tint overlay
    tint: string;         // css color
    tintAlpha: number;    // 0..1

    // grid styling
    gridAlpha: number;    // 0..1
    gridColor: string;    // css color
    cell: number;         // grid cell size (px)

    // subtle “decal” dots/lines (cheap texture)
    decalAlpha: number;   // 0..1
    decalColor: string;   // css color
    decalEvery: number;   // spacing (px)
};

export type Weight = { type: EnemyType; w: number };

export type FloorSpawnProfile = {
    // how often we spawn trickle enemies (seconds)
    cadence: number;

    // how many enemies per tick (min/max inclusive)
    perTickMin: number;
    perTickMax: number;

    // ring spawn radius
    ringMin: number;
    ringMax: number;

    // weights for early/mid/late segments of the floor
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

    // Used for boss “presence” (visual-only for now)
    bossTitle: string;
    bossAccent: string; // css color
};

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
            cadence: 0.12,
            perTickMin: 1,
            perTickMax: 1,
            ringMin: 520,
            ringMax: 650,
            early: [
                { type: ENEMY_TYPE.CHASER, w: 0.80 },
                { type: ENEMY_TYPE.RUNNER, w: 0.20 },
            ],
            mid: [
                { type: ENEMY_TYPE.CHASER, w: 0.55 },
                { type: ENEMY_TYPE.RUNNER, w: 0.35 },
                { type: ENEMY_TYPE.BRUISER, w: 0.10 },
            ],
            late: [
                { type: ENEMY_TYPE.CHASER, w: 0.45 },
                { type: ENEMY_TYPE.RUNNER, w: 0.38 },
                { type: ENEMY_TYPE.BRUISER, w: 0.17 },
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
            cadence: 0.11,
            perTickMin: 1,
            perTickMax: 2,
            ringMin: 520,
            ringMax: 680,
            early: [
                { type: ENEMY_TYPE.CHASER, w: 0.65 },
                { type: ENEMY_TYPE.RUNNER, w: 0.25 },
                { type: ENEMY_TYPE.BRUISER, w: 0.10 },
            ],
            mid: [
                { type: ENEMY_TYPE.CHASER, w: 0.45 },
                { type: ENEMY_TYPE.RUNNER, w: 0.30 },
                { type: ENEMY_TYPE.BRUISER, w: 0.25 },
            ],
            late: [
                { type: ENEMY_TYPE.CHASER, w: 0.35 },
                { type: ENEMY_TYPE.RUNNER, w: 0.25 },
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
            cadence: 0.10,
            perTickMin: 1,
            perTickMax: 2,
            ringMin: 520,
            ringMax: 700,
            early: [
                { type: ENEMY_TYPE.RUNNER, w: 0.55 },
                { type: ENEMY_TYPE.CHASER, w: 0.40 },
                { type: ENEMY_TYPE.BRUISER, w: 0.05 },
            ],
            mid: [
                { type: ENEMY_TYPE.RUNNER, w: 0.45 },
                { type: ENEMY_TYPE.CHASER, w: 0.35 },
                { type: ENEMY_TYPE.BRUISER, w: 0.20 },
            ],
            late: [
                { type: ENEMY_TYPE.RUNNER, w: 0.34 },
                { type: ENEMY_TYPE.CHASER, w: 0.30 },
                { type: ENEMY_TYPE.BRUISER, w: 0.36 },
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
