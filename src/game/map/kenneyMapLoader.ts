// src/game/map/kenneyMapLoader.ts
import type { TableMapDef } from "./tableMapTypes";

export type IsoTileKind = "VOID" | "FLOOR" | "STAIRS" | "SPAWN" | "GOAL";
export type StairDir = "N" | "E" | "S" | "W";

// Authoritative stair sprite mapping:
export const STAIR_SKIN_BY_DIR: Record<StairDir, string> = {
    S: "landscape_20",
    E: "landscape_23",
    W: "landscape_19",
    N: "landscape_16",
};

export type IsoTile = {
    kind: IsoTileKind;
    h: number;      // integer base height (authored)
    skin?: string;  // e.g. "landscape_23"
    dir?: StairDir; // stairs direction (optional)
};

export type CompiledKenneyMap = {
    id: string;
    originTx: number;
    originTy: number;

    // Map-authored spawn (tile coords)
    spawnTx: number;
    spawnTy: number;
    spawnH: number;

    // Map-authored goal (tile coords) - for procedural maps
    goalTx: number | null;
    goalTy: number | null;
    goalH: number;

    getTile(tx: number, ty: number): IsoTile;
};

// Parse tokens like: F0, F5, S0W, S3N, S4S, S5, P0, C2E
function parseToken(
    t: string,
    defaultFloorSkin?: string,
    defaultSpawnSkin?: string
): IsoTile | null {
    const tok = (t ?? "").trim();
    if (!tok) return null;

    const up = tok.toUpperCase();

    // FLOOR: F<number>
    if (up.startsWith("F")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;
        return { kind: "FLOOR", h, skin: defaultFloorSkin };
    }

    // SPAWN: P<number> (acts like FLOOR visually/gameplay, but marks spawn)
    if (up.startsWith("P")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;
        const skin = defaultSpawnSkin ?? defaultFloorSkin;
        return { kind: "SPAWN", h, skin };
    }

    // GOAL: G<number> (destination/objective marker)
    if (up.startsWith("G")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;
        const skin = defaultSpawnSkin ?? defaultFloorSkin;
        return { kind: "GOAL", h, skin };
    }

    // STAIRS: S<number><dir?>
    // We load as STAIRS tiles. Direction (when present) determines sprite skin.
    if (up.startsWith("S")) {
        const m = up.match(/^S(\d+)([NESW])?$/);
        if (m) {
            const h = parseInt(m[1], 10) | 0;
            const dir = (m[2] as StairDir | undefined) ?? undefined;
            const skin = dir ? STAIR_SKIN_BY_DIR[dir] : defaultFloorSkin;
            return { kind: "STAIRS", h, dir, skin };
        }

        const cleaned = "S" + up.slice(1).replace(/[^0-9NESW]/g, "");
        const m2 = cleaned.match(/^S(\d+)([NESW])?$/);
        if (m2) {
            const h = parseInt(m2[1], 10) | 0;
            const dir = (m2[2] as StairDir | undefined) ?? undefined;
            const skin = dir ? STAIR_SKIN_BY_DIR[dir] : defaultFloorSkin;
            return { kind: "STAIRS", h, dir, skin };
        }

        // Fallback: stairs at height 0 (no direction)
        return { kind: "STAIRS", h: 0, skin: defaultFloorSkin };
    }

    return null;
}

export function compileKenneyMapFromTable(def: TableMapDef): CompiledKenneyMap {
    const defaultFloorSkin = def.defaultFloorSkin;
    const defaultSpawnSkin = def.defaultSpawnSkin;

    // Keyed by "x,y" in table coords
    const placed = new Map<string, IsoTile>();

    // First SPAWN found becomes the authoritative spawn point
    let spawnTableX: number | null = null;
    let spawnTableY: number | null = null;
    let spawnH: number = 0;

    // First GOAL found becomes the authoritative goal point
    let goalTableX: number | null = null;
    let goalTableY: number | null = null;
    let goalH: number = 0;

    for (const c of def.cells) {
        const tile = parseToken(c.t, defaultFloorSkin, defaultSpawnSkin);
        if (!tile) continue;

        if (tile.kind === "SPAWN" && spawnTableX === null) {
            spawnTableX = c.x | 0;
            spawnTableY = c.y | 0;
            spawnH = tile.h | 0;
        }

        if (tile.kind === "GOAL" && goalTableX === null) {
            goalTableX = c.x | 0;
            goalTableY = c.y | 0;
            goalH = tile.h | 0;
        }

        placed.set(`${c.x},${c.y}`, tile);
    }

    // Decide where table (0,0) lands in tile-space.
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

    // Convert authored spawn table coords -> tile coords.
    // Fallback: selection center.
    const spawnTx = (spawnTableX ?? Math.floor(def.w / 2)) + originTx;
    const spawnTy = (spawnTableY ?? Math.floor(def.h / 2)) + originTy;

    // Convert authored goal table coords -> tile coords.
    // Goal may be null if not defined in map.
    const goalTx = goalTableX !== null ? goalTableX + originTx : null;
    const goalTy = goalTableY !== null ? goalTableY + originTy : null;

    return {
        id: def.id,
        originTx,
        originTy,

        spawnTx,
        spawnTy,
        spawnH,

        goalTx,
        goalTy,
        goalH,

        getTile,
    };
}
