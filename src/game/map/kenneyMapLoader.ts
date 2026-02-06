// src/game/map/kenneyMapLoader.ts
import type { TableMapDef } from "./tableMapTypes";
import { KENNEY_TILE_ANCHOR_Y } from "../visual/kenneyTiles";

export type IsoTileKind = "VOID" | "FLOOR" | "STAIRS" | "SPAWN" | "GOAL";
export type StairDir = "N" | "E" | "S" | "W";
export type WallDir = "N" | "E" | "S" | "W";

// Authoritative stair sprite mapping:
export const STAIR_SKIN_BY_DIR: Record<StairDir, string> = {
    S: "wedgeTest20",
    E: "wedgeTest23",
    W: "wedgeTest19",
    N: "wedgeTest16",
};

export type IsoTile = {
    kind: IsoTileKind;
    h: number;      // integer base height (authored)
    skin?: string;  // e.g. "landscape_23"
    dir?: StairDir; // stairs direction (optional)
    stairGroupId?: number;
    stairStepIndex?: number; // 0..n-1 low->high within a staircase group
};

export type SurfaceKind = "TILE_TOP";
export type RenderTopKind = "FLOOR" | "STAIR";

export type Surface = {
    id: string;
    kind: SurfaceKind;
    tx: number;
    ty: number;
    zBase: number;
    zLogical: number;
    tile: IsoTile;
    renderTopKind: RenderTopKind;
    renderDir: StairDir;
    renderAnchorY: number;
    renderDyOffset: number;
};

export type CurtainKind = "FLOOR_APRON" | "STAIR_APRON" | "WALL";

export type Curtain = {
    id: string;
    kind: CurtainKind;
    tx: number;
    ty: number;
    zFrom: number;
    zTo: number;
    zLogical: number;
    apronKind?: "S" | "DIAG";
    dir?: StairDir;
    wallDir?: WallDir;
    flipX?: boolean;
    renderTopKind: RenderTopKind;
    renderDir: StairDir;
    renderAnchorY: number;
    renderDyOffset: number;
    apronDyOffset: number;
    wallKind?: "S" | "DIAG";
};

export type WallToken = {
    x: number;
    y: number;
    height: number;
    dir: WallDir;
};

export type CompiledKenneyMap = {
    id: string;
    originTx: number;
    originTy: number;
    width: number;
    height: number;

    // Map-authored spawn (tile coords)
    spawnTx: number;
    spawnTy: number;
    spawnH: number;

    // Map-authored goal (tile coords) - for procedural maps
    goalTx: number | null;
    goalTy: number | null;
    goalH: number;

    getTile(tx: number, ty: number): IsoTile;
    surfacesByKey: Map<string, Surface[]>;
    surfacesAtXY(tx: number, ty: number): Surface[];
    curtains: Curtain[];
    curtainsByLayer: Map<number, Curtain[]>;
    curtainsForLayer(layer: number): Curtain[];
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

// Parse multi-tokens like: F0|W4S
function parseTokens(
    t: string,
    defaultFloorSkin?: string,
    defaultSpawnSkin?: string
): { tile: IsoTile | null; walls: WallToken[] } {
    const raw = (t ?? "").trim();
    if (!raw) return { tile: null, walls: [] };

    const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
    let tile: IsoTile | null = null;
    const walls: WallToken[] = [];

    for (let i = 0; i < parts.length; i++) {
        const tok = parts[i];
        const up = tok.toUpperCase();

        if (up.startsWith("W")) {
            const m = up.match(/^W(\d+)([NESW])$/);
            if (m) {
                const height = parseInt(m[1], 10) | 0;
                const dir = (m[2] as WallDir) ?? "S";
                walls.push({ x: 0, y: 0, height, dir });
            }
            continue;
        }

        if (!tile) {
            tile = parseToken(tok, defaultFloorSkin, defaultSpawnSkin);
        }
    }

    return { tile, walls };
}

/** Compile a table-based map definition into a render/query-friendly map. */
export function compileKenneyMapFromTable(def: TableMapDef): CompiledKenneyMap {
    const defaultFloorSkin = def.defaultFloorSkin;
    const defaultSpawnSkin = def.defaultSpawnSkin;

    // Keyed by "x,y" in table coords
    const placed = new Map<string, IsoTile>();
    const wallTokens: WallToken[] = [];

    // First SPAWN found becomes the authoritative spawn point
    let spawnTableX: number | null = null;
    let spawnTableY: number | null = null;
    let spawnH: number = 0;

    // First GOAL found becomes the authoritative goal point
    let goalTableX: number | null = null;
    let goalTableY: number | null = null;
    let goalH: number = 0;

    for (const c of def.cells) {
        const parsed = parseTokens(c.t, defaultFloorSkin, defaultSpawnSkin);
        if (!parsed.tile && parsed.walls.length === 0) continue;

        const tile = parsed.tile;
        if (tile) {
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

        if (parsed.walls.length > 0) {
            for (let i = 0; i < parsed.walls.length; i++) {
                wallTokens.push({ ...parsed.walls[i], x: c.x | 0, y: c.y | 0 });
            }
        }
    }

    // Group contiguous stair tiles into staircase runs (for render ordering).
    // Group rule: 4-neighbor connected components with matching dir.
    // Step index is based on height within the group (low->high).
    {
        let nextGroupId = 1;
        const visited = new Set<string>();

        const key = (x: number, y: number) => `${x},${y}`;
        const getPlaced = (x: number, y: number) => placed.get(key(x, y));

        for (let y = 0; y < def.h; y++) {
            for (let x = 0; x < def.w; x++) {
                const t0 = getPlaced(x, y);
                if (!t0 || t0.kind !== "STAIRS") continue;
                if (visited.has(key(x, y))) continue;

                const dir = t0.dir;
                if (dir !== "N" && dir !== "E" && dir !== "S" && dir !== "W") continue;
                const stack: Array<{ x: number; y: number }> = [{ x, y }];
                const tiles: IsoTile[] = [];
                let minH = t0.h | 0;

                while (stack.length > 0) {
                    const cur = stack.pop()!;
                    const k = key(cur.x, cur.y);
                    if (visited.has(k)) continue;

                    const t = getPlaced(cur.x, cur.y);
                    if (!t || t.kind !== "STAIRS") continue;
                    if ((t.dir ?? undefined) !== (dir ?? undefined)) continue;

                    visited.add(k);
                    tiles.push(t);
                    const h = t.h | 0;
                    if (h < minH) minH = h;

                    stack.push({ x: cur.x + 1, y: cur.y });
                    stack.push({ x: cur.x - 1, y: cur.y });
                    stack.push({ x: cur.x, y: cur.y + 1 });
                    stack.push({ x: cur.x, y: cur.y - 1 });
                }

                if (tiles.length === 0) continue;

                const gid = nextGroupId++;
                for (let i = 0; i < tiles.length; i++) {
                    const t = tiles[i];
                    t.stairGroupId = gid;
                    t.stairStepIndex = (t.h | 0) - minH;
                }
            }
        }
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

    const surfacesByKey = new Map<string, Surface[]>();

    const floorAnchorY = KENNEY_TILE_ANCHOR_Y;
    const stairAnchorY = 0.62;
    const stairDyByDir: Record<StairDir, number> = {
        N: 24,
        E: 16,
        S: 16,
        W: 24,
    };

    function addSurface(surface: Surface) {
        const k = `${surface.tx},${surface.ty}`;
        const list = surfacesByKey.get(k);
        if (list) list.push(surface);
        else surfacesByKey.set(k, [surface]);
    }

    for (const [key, tile] of placed.entries()) {
        if (tile.kind === "VOID") continue;
        const parts = key.split(",");
        const tableX = parseInt(parts[0], 10);
        const tableY = parseInt(parts[1], 10);
        if (!Number.isFinite(tableX) || !Number.isFinite(tableY)) continue;

        const tx = tableX + originTx;
        const ty = tableY + originTy;
        const zBase = tile.h | 0;
        const renderTopKind: RenderTopKind = tile.kind === "STAIRS" ? "STAIR" : "FLOOR";
        const renderDir = (tile.dir ?? "N") as StairDir;
        const renderAnchorY = renderTopKind === "STAIR" ? stairAnchorY : floorAnchorY;
        const renderDyOffset = renderTopKind === "STAIR" ? (stairDyByDir[renderDir] ?? 16) : 0;

        addSurface({
            id: `tile_${tx}_${ty}_${tile.kind}_${zBase}`,
            kind: "TILE_TOP",
            tx,
            ty,
            zBase,
            zLogical: zBase,
            tile,
            renderTopKind,
            renderDir,
            renderAnchorY,
            renderDyOffset,
        });
    }

    function surfacesAtXY(tx: number, ty: number): Surface[] {
        return surfacesByKey.get(`${tx},${ty}`) ?? [];
    }

    const curtains: Curtain[] = [];
    const curtainsByLayer = new Map<number, Curtain[]>();

    function addCurtain(curtain: Curtain) {
        curtains.push(curtain);
        const list = curtainsByLayer.get(curtain.zLogical);
        if (list) list.push(curtain);
        else curtainsByLayer.set(curtain.zLogical, [curtain]);
    }

    function maxNonStairSurfaceZ(tx: number, ty: number): number | null {
        const surfaces = surfacesAtXY(tx, ty);
        if (surfaces.length === 0) return null;
        let best: number | null = null;
        for (let i = 0; i < surfaces.length; i++) {
            const s = surfaces[i];
            if (s.tile.kind === "STAIRS") continue;
            if (best === null || s.zBase > best) best = s.zBase;
        }
        return best;
    }

    for (const list of surfacesByKey.values()) {
        for (let i = 0; i < list.length; i++) {
            const surface = list[i];
            const tile = surface.tile;

            if (tile.kind === "STAIRS") {
                const dir = (tile.dir ?? "N") as StairDir;
                addCurtain({
                    id: `curtain_stair_${surface.tx}_${surface.ty}_${surface.zBase}`,
                    kind: "STAIR_APRON",
                    tx: surface.tx,
                    ty: surface.ty,
                    zFrom: surface.zBase - 1,
                    zTo: surface.zBase,
                    zLogical: surface.zLogical,
                    dir,
                    renderTopKind: "STAIR",
                    renderDir: dir,
                    renderAnchorY: stairAnchorY,
                    renderDyOffset: stairDyByDir[dir] ?? 16,
                    apronDyOffset: 0,
                });
                continue;
            }

            const hHere = surface.zBase;

            const checkDrop = (nx: number, ny: number) => {
                const nMax = maxNonStairSurfaceZ(nx, ny);
                if (nMax === null) return true;
                return nMax < hHere;
            };

            let apronKind: "S" | "DIAG" | null = null;
            let flipX = false;

            if (checkDrop(surface.tx, surface.ty + 1)) {
                apronKind = "S";
                flipX = false;
            } else if (checkDrop(surface.tx + 1, surface.ty + 1)) {
                apronKind = "DIAG";
                flipX = false; // SE
            } else if (checkDrop(surface.tx - 1, surface.ty + 1)) {
                apronKind = "DIAG";
                flipX = false; // SW mirror
            }

            if (!apronKind) continue;

            const neighborZ = maxNonStairSurfaceZ(
                surface.tx + (apronKind === "S" ? 0 : flipX ? -1 : 1),
                surface.ty + 1
            );
            const zFrom = neighborZ ?? (surface.zBase - 1);
            const apronDyOffset = apronKind === "S" ? -100 : -100;

            addCurtain({
                id: `curtain_floor_${surface.tx}_${surface.ty}_${surface.zBase}_${apronKind}_${flipX ? "L" : "R"}`,
                kind: "FLOOR_APRON",
                tx: surface.tx,
                ty: surface.ty,
                zFrom,
                zTo: surface.zBase,
                zLogical: surface.zLogical,
                apronKind,
                flipX,
                renderTopKind: "FLOOR",
                renderDir: "N",
                renderAnchorY: floorAnchorY,
                renderDyOffset: 0,
                apronDyOffset,
            });
        }
    }

    for (let i = 0; i < wallTokens.length; i++) {
        const w = wallTokens[i];
        const tx = w.x + originTx;
        const ty = w.y + originTy;
        const height = Math.max(0, w.height | 0);
        if (height <= 0) continue;

        const wallKind: "S" | "DIAG" = (w.dir === "N" || w.dir === "S") ? "S" : "DIAG";
        const flipX = w.dir === "N" || w.dir === "W";
        const segmentHeight = 2;
        const zFrom = 0;
        const zTo = height;

        for (let z = zFrom; z < zTo; z += segmentHeight) {
            const segFrom = z;
            const segTo = Math.min(z + segmentHeight, zTo);
            const zLogical = Math.floor(segFrom + 1e-6);
            addCurtain({
                id: `curtain_wall_${tx}_${ty}_${w.dir}_${segFrom}_${segTo}`,
                kind: "WALL",
                tx,
                ty,
                zFrom: segFrom,
                zTo: segTo,
                zLogical,
                wallDir: w.dir,
                wallKind,
                flipX,
                renderTopKind: "FLOOR",
                renderDir: "N",
                renderAnchorY: floorAnchorY,
                renderDyOffset: 0,
                apronDyOffset: 0,
            });
        }
    }

    function curtainsForLayer(layer: number): Curtain[] {
        return curtainsByLayer.get(layer) ?? [];
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
        width: def.w,
        height: def.h,

        spawnTx,
        spawnTy,
        spawnH,

        goalTx,
        goalTy,
        goalH,

        getTile,
        surfacesByKey,
        surfacesAtXY,
        curtains,
        curtainsByLayer,
        curtainsForLayer,
    };
}
