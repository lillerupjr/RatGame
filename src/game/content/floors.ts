import type { World } from "../../engine/world/world";
import type { StageId } from "./stages";

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

export type FloorDef = {
    id: FloorId;
    name: string;
    stageId: StageId;
    visual: FloorVisual;

    bossTitle: string;
    bossAccent: string;
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
        bossTitle: "Neon Triad Captain",
        bossAccent: "#ff4fd2",
    },
] as const;

export function floorForIndex(idx: number): FloorDef {
    const i = Math.max(0, Math.min(FLOORS.length - 1, idx | 0));
    return FLOORS[i];
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
