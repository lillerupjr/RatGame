// src/game/map/kenneyMapLoader.ts
import type { TableMapDef } from "./tableMapTypes";

export type IsoTileKind = "VOID" | "FLOOR" | "STAIRS" | "SPAWN" | "CONVERTER";
export type StairDir = "N" | "E" | "S" | "W";
/**
 * TEMP: When we "translate" STAIRS tokens into FLOOR tiles,
 * you can adjust the resulting height here.
 *
 * Example:
 *  - offset = +0 keeps authored height
 *  - offset = -1 pulls all former-stairs down 1 level
 *
 * You can also clamp to avoid negative heights.
 */
export let STAIRS_AS_FLOOR_H_OFFSET = -1;
export let STAIRS_AS_FLOOR_MIN_H = 0;
// This mapping is intentional - DON'T change!!
export const STAIR_SKIN_BY_DIR: Record<StairDir, string> = {
    S: "landscape_20",
    E: "landscape_23",
    W: "landscape_19",
    N: "landscape_16",
};

export type IsoTile = {
    kind: IsoTileKind;
    h: number;
    skin?: string;
    dir?: StairDir;
};

export type CompiledKenneyMap = {
    id: string;
    originTx: number;
    originTy: number;

    spawnTx: number;
    spawnTy: number;
    spawnH: number;

    getTile(tx: number, ty: number): IsoTile;
};


function parseToken(t: string, defaultFloorSkin?: string, defaultSpawnSkin?: string): IsoTile | null {
    const tok = (t ?? "").trim();
    if (!tok) return null;

    const up = tok.toUpperCase();

// FLOOR: F<number>
    if (up.startsWith("F")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;
        return { kind: "FLOOR", h, skin: defaultFloorSkin };
    }

// CONVERTER: C<number><dir?>
// Exact copy of FLOOR data-wise, but can carry a dir (N/E/S/W) used for *player-only* height scaling.
    if (up.startsWith("C")) {
        const m = up.match(/^C(\d+)([NESW])?$/);
        if (m) {
            const h = parseInt(m[1], 10) | 0;
            const dir = (m[2] as StairDir | undefined) ?? undefined;
            return { kind: "CONVERTER", h, skin: defaultFloorSkin, dir };
        }

        const cleaned = "C" + up.slice(1).replace(/[^0-9NESW]/g, "");
        const m2 = cleaned.match(/^C(\d+)([NESW])?$/);
        if (m2) {
            const h = parseInt(m2[1], 10) | 0;
            const dir = (m2[2] as StairDir | undefined) ?? undefined;
            return { kind: "CONVERTER", h, skin: defaultFloorSkin, dir };
        }

        return { kind: "CONVERTER", h: 0, skin: defaultFloorSkin };
    }



    // SPAWN: P<number>  (acts like FLOOR for gameplay, but marks the player spawn)
    if (up.startsWith("P")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;


        const skin = defaultSpawnSkin ?? defaultFloorSkin;
        return { kind: "SPAWN", h, skin };
    }

// STAIRS: S<number><dir?>
// TEMP: convert to CONVERTER for gameplay, keeping dir for player-only height scaling.
// ALSO: apply height mapping knobs (offset + clamp).
    if (up.startsWith("S")) {

        const m = up.match(/^S(\d+)([NESW])?$/);
        if (m) {
            const rawH = parseInt(m[1], 10) | 0;
            const dir = (m[2] as StairDir | undefined) ?? undefined;

            const h = Math.max(
                STAIRS_AS_FLOOR_MIN_H | 0,
                (rawH + (STAIRS_AS_FLOOR_H_OFFSET | 0)) | 0
            );

            return { kind: "CONVERTER", h, dir, skin: defaultFloorSkin };
        }

        const cleaned = "S" + up.slice(1).replace(/[^0-9NESW]/g, "");
        const m2 = cleaned.match(/^S(\d+)([NESW])?$/);
        if (m2) {
            const rawH = parseInt(m2[1], 10) | 0;
            const dir = (m2[2] as StairDir | undefined) ?? undefined;

            const h = Math.max(
                STAIRS_AS_FLOOR_MIN_H | 0,
                (rawH + (STAIRS_AS_FLOOR_H_OFFSET | 0)) | 0
            );

            return { kind: "CONVERTER", h, dir, skin: defaultFloorSkin };
        }

        // No number parsed => treat as height 0, then apply mapping knobs
        const h = Math.max(
            STAIRS_AS_FLOOR_MIN_H | 0,
            (0 + (STAIRS_AS_FLOOR_H_OFFSET | 0)) | 0
        );

        return { kind: "CONVERTER", h, skin: defaultFloorSkin };
    }



    return null;
}

export function compileKenneyMapFromTable(def: TableMapDef): CompiledKenneyMap {
    const defaultFloorSkin = def.defaultFloorSkin;
    const defaultSpawnSkin = def.defaultSpawnSkin;


    const placed = new Map<string, IsoTile>();


    let spawnTableX: number | null = null;
    let spawnTableY: number | null = null;
    let spawnH: number = 0;

    for (const c of def.cells) {
        const tile = parseToken(c.t, defaultFloorSkin, defaultSpawnSkin);
        if (!tile) continue;

        if (tile.kind === "SPAWN" && spawnTableX === null) {
            spawnTableX = c.x | 0;
            spawnTableY = c.y | 0;
            spawnH = tile.h | 0;
        }

        placed.set(`${c.x},${c.y}`, tile);
    }

    const originTx = def.centerOnZero ? -Math.floor(def.w / 2) : 0;
    const originTy = def.centerOnZero ? -Math.floor(def.h / 2) : 0;

    function getTile(tx: number, ty: number): IsoTile {
        // Convert tile coords -> table coords
        const x = tx - originTx;
        const y = ty - originTy;

        // Outside selection => VOID
        if (x < 0 || y < 0 || x >= def.w || y >= def.h) return { kind: "VOID", h: 0 };

        return placed.get(`${x},${y}`) ?? { kind: "VOID", h: 0 };
    }

    // Convert authored spawn table coords -> tile coords
    // Fallback: selection center (0,0 in tile-space when centerOnZero=true)
    const spawnTx = (spawnTableX ?? Math.floor(def.w / 2)) + originTx;
    const spawnTy = (spawnTableY ?? Math.floor(def.h / 2)) + originTy;

    return {
        id: def.id,
        originTx,
        originTy,

        spawnTx,
        spawnTy,
        spawnH,

        getTile,
    };
}
