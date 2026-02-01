// src/game/map/kenneyMapLoader.ts
import type { TableMapDef } from "./tableMapTypes";

export type IsoTileKind = "VOID" | "FLOOR" | "STAIRS" | "SPAWN";
export type StairDir = "N" | "E" | "S" | "W";

// Authoritative stair sprite mapping:
// This mapping is intentional - DON'T change!!
export const STAIR_SKIN_BY_DIR: Record<StairDir, string> = {
    S: "landscape_20",
    E: "landscape_23",
    W: "landscape_19",
    N: "landscape_16",
};

export type IsoTile = {
    kind: IsoTileKind;
    h: number;      // integer base height
    skin?: string;  // e.g. "landscape_23"
    dir?: StairDir; // stairs direction (optional)
};

export type CompiledKenneyMap = {
    id: string;
    originTx: number;
    originTy: number;

    // Map-authored spawn tile (tile-space coords)
    spawnTx: number;
    spawnTy: number;
    spawnH: number;

    getTile(tx: number, ty: number): IsoTile;
};

// Parse tokens like: F0, F5, S0W, S3N, S4, S5, P0, P2
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

    // SPAWN: P<number>  (acts like FLOOR for gameplay, but marks the player spawn)
    if (up.startsWith("P")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;

        // If no explicit spawn skin is provided, fall back to floor skin (so it still looks coherent).
        const skin = defaultSpawnSkin ?? defaultFloorSkin;
        return { kind: "SPAWN", h, skin };
    }

    // STAIRS: S<number><dir?>
    if (up.startsWith("S")) {
        // strict: S3N, S0W, S4, etc.
        const m = up.match(/^S(\d+)([NESW])?$/);
        if (m) {
            const h = parseInt(m[1], 10) | 0;
            const dir = (m[2] as StairDir | undefined) ?? undefined;
            const skin = dir ? STAIR_SKIN_BY_DIR[dir] : undefined;
            return { kind: "STAIRS", h, dir, skin };
        }

        // tolerant: remove junk but KEEP the leading 'S'
        // Example: "S3-N" -> "S3N"
        const cleaned = "S" + up.slice(1).replace(/[^0-9NESW]/g, "");
        const m2 = cleaned.match(/^S(\d+)([NESW])?$/);
        if (m2) {
            const h = parseInt(m2[1], 10) | 0;
            const dir = (m2[2] as StairDir | undefined) ?? undefined;
            const skin = dir ? STAIR_SKIN_BY_DIR[dir] : undefined;
            return { kind: "STAIRS", h, dir, skin };
        }

        // unknown stairs token -> still stairs, no direction/skin
        return { kind: "STAIRS", h: 0 };
    }

    return null;
}

export function compileKenneyMapFromTable(def: TableMapDef): CompiledKenneyMap {
    const defaultFloorSkin = def.defaultFloorSkin;
    const defaultSpawnSkin = def.defaultSpawnSkin;

    // Keyed by "x,y" in table coords (not tile coords)
    const placed = new Map<string, IsoTile>();

    // First SPAWN token found wins (maps should author exactly one)
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

    // Decide where table (0,0) lands in tile-space
    // If centerOnZero=true, the table center becomes tile (0,0).
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
