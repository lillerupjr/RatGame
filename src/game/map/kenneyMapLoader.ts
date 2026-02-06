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

export type CurtainClass = "UNDERLAY" | "OCCLUDER";
export type ViewRect = {
    minTx: number;
    maxTx: number;
    minTy: number;
    maxTy: number;
};
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
    cls: CurtainClass;
    kind: CurtainKind;
    tx: number;
    ty: number;
    zFrom: number;
    zTo: number;
    zLogical: number;
    apronKind?: "S" | "E";
    dir?: StairDir;
    wallDir?: WallDir;
    flipX?: boolean;
    renderTopKind: RenderTopKind;
    renderDir: StairDir;
    renderAnchorY: number;
    renderDyOffset: number;
    apronDyOffset: number;
    wallKind?: "S" | "E";
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
    underlays: Curtain[];
    occludersByLayer: Map<number, Curtain[]>;
    occludersForLayer(layer: number): Curtain[];
    apronUnderlaysInView(view: ViewRect): Curtain[];
    occludersInViewForLayer(layer: number, view: ViewRect): Curtain[];
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
        const fx = (def.w - 1) - (c.x | 0);
        const fy = (def.h - 1) - (c.y | 0);
        const parsed = parseTokens(c.t, defaultFloorSkin, defaultSpawnSkin);
        if (!parsed.tile && parsed.walls.length === 0) continue;

        const tile = parsed.tile;
        if (tile) {
            if (tile.kind === "SPAWN" && spawnTableX === null) {
                spawnTableX = fx;
                spawnTableY = fy;
                spawnH = tile.h | 0;
            }

            if (tile.kind === "GOAL" && goalTableX === null) {
                goalTableX = fx;
                goalTableY = fy;
                goalH = tile.h | 0;
            }

            placed.set(`${fx},${fy}`, tile);
        }

        if (parsed.walls.length > 0) {
            for (let i = 0; i < parsed.walls.length; i++) {
                wallTokens.push({ ...parsed.walls[i], x: fx, y: fy });
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

        const zLogical = renderTopKind === "STAIR" ? Math.max(0, zBase - 1) : zBase;

        addSurface({
            id: `tile_${tx}_${ty}_${tile.kind}_${zBase}`,
            kind: "TILE_TOP",
            tx,
            ty,
            zBase,
            zLogical,
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
    const underlays: Curtain[] = [];
    const occludersByLayer = new Map<number, Curtain[]>();

    function addCurtainToLayerMap(map: Map<number, Curtain[]>, curtain: Curtain) {
        const list = map.get(curtain.zLogical);
        if (list) list.push(curtain);
        else map.set(curtain.zLogical, [curtain]);
    }

    function addLegacyCurtain(curtain: Curtain) {
        curtains.push(curtain);
        addCurtainToLayerMap(curtainsByLayer, curtain);
    }

    function addUnderlay(curtain: Curtain) {
        underlays.push(curtain);
        addLegacyCurtain(curtain);
    }

    function addOccluder(curtain: Curtain) {
        addCurtainToLayerMap(occludersByLayer, curtain);
        addLegacyCurtain(curtain);
    }

    function hasSurfaceAtZ(tx: number, ty: number, zBase: number): boolean {
        const surfaces = surfacesAtXY(tx, ty);
        for (let i = 0; i < surfaces.length; i++) {
            if (surfaces[i].zBase === zBase) return true;
        }
        return false;
    }

    function hasStairAtZ(tx: number, ty: number, zBase: number): boolean {
        const surfaces = surfacesAtXY(tx, ty);
        for (let i = 0; i < surfaces.length; i++) {
            const s = surfaces[i];
            if (s.zBase === zBase && s.tile.kind === "STAIRS") return true;
        }
        return false;
    }

    function stairApronNeighborDelta(dir: StairDir): { dx: number; dy: number } {
        switch (dir) {
            case "N": return { dx: 1, dy: 0 };  // apron faces along E edge
            case "E": return { dx: 0, dy: -1 }; // apron faces along S edge
            case "S": return { dx: -1, dy: 0 }; // apron faces along W edge
            case "W": return { dx: 0, dy: 1 };  // apron faces along N edge
        }
    }

    for (const list of surfacesByKey.values()) {
        for (let i = 0; i < list.length; i++) {
            const surface = list[i];
            const tile = surface.tile;

            if (tile.kind === "STAIRS") {
                const dir = (tile.dir ?? "N") as StairDir;
                const delta = stairApronNeighborDelta(dir);
                if (hasSurfaceAtZ(surface.tx + delta.dx, surface.ty + delta.dy, surface.zBase)) {
                    continue;
                }
                addUnderlay({
                    id: `curtain_stair_${surface.tx}_${surface.ty}_${surface.zBase}`,
                    cls: "UNDERLAY",
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

            const southMissing = !hasSurfaceAtZ(surface.tx, surface.ty + 1, surface.zBase)
                || hasStairAtZ(surface.tx, surface.ty + 1, surface.zBase);
            if (southMissing) {
                const apronKind: "S" = "S";
                const apronDyOffset = -100;
                addUnderlay({
                    id: `curtain_floor_${surface.tx}_${surface.ty}_${surface.zBase}_S`,
                    cls: "UNDERLAY",
                    kind: "FLOOR_APRON",
                    tx: surface.tx,
                    ty: surface.ty,
                    zFrom: surface.zBase - 1,
                    zTo: surface.zBase,
                    zLogical: surface.zLogical,
                    apronKind,
                    flipX: false,
                    renderTopKind: "FLOOR",
                    renderDir: "N",
                    renderAnchorY: floorAnchorY,
                    renderDyOffset: 0,
                    apronDyOffset,
                });
            }

            const eastMissing = !hasSurfaceAtZ(surface.tx + 1, surface.ty, surface.zBase)
                || hasStairAtZ(surface.tx + 1, surface.ty, surface.zBase);
            if (eastMissing) {
                const apronKind: "E" = "E";
                const apronDyOffset = -100;
                addUnderlay({
                    id: `curtain_floor_${surface.tx}_${surface.ty}_${surface.zBase}_E`,
                    cls: "UNDERLAY",
                    kind: "FLOOR_APRON",
                    tx: surface.tx,
                    ty: surface.ty,
                    zFrom: surface.zBase - 1,
                    zTo: surface.zBase,
                    zLogical: surface.zLogical,
                    apronKind,
                    flipX: false,
                    renderTopKind: "FLOOR",
                    renderDir: "N",
                    renderAnchorY: floorAnchorY,
                    renderDyOffset: 0,
                    apronDyOffset,
                });
            }
        }
    }

    for (let i = 0; i < wallTokens.length; i++) {
        const w = wallTokens[i];
        const tx = w.x + originTx;
        const ty = w.y + originTy;
        const height = Math.max(0, w.height | 0);
        if (height <= 0) continue;

        const wallKind: "S" | "E" = (w.dir === "N" || w.dir === "S") ? "S" : "E";
        const flipX = false;
        const segmentHeight = 2;
        const zFrom = 0;
        const zTo = height;

        for (let z = zFrom; z < zTo; z += segmentHeight) {
            const segFrom = z;
            const segTo = Math.min(z + segmentHeight, zTo);
            const zLogical = Math.floor(segFrom + 1e-6);
            addOccluder({
                id: `curtain_wall_${tx}_${ty}_${w.dir}_${segFrom}_${segTo}`,
                cls: "OCCLUDER",
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

    function occludersForLayer(layer: number): Curtain[] {
        return occludersByLayer.get(layer) ?? [];
    }

    function curtainInView(curtain: Curtain, view: ViewRect): boolean {
        return curtain.tx >= view.minTx
            && curtain.tx <= view.maxTx
            && curtain.ty >= view.minTy
            && curtain.ty <= view.maxTy;
    }

    function apronUnderlaysInView(view: ViewRect): Curtain[] {
        const out: Curtain[] = [];
        for (let i = 0; i < underlays.length; i++) {
            const c = underlays[i];
            if (curtainInView(c, view)) out.push(c);
        }
        return out;
    }

    function occludersInViewForLayer(layer: number, view: ViewRect): Curtain[] {
        const list = occludersByLayer.get(layer);
        if (!list || list.length === 0) return [];
        const out: Curtain[] = [];
        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            if (curtainInView(c, view)) out.push(c);
        }
        return out;
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
        underlays,
        occludersByLayer,
        occludersForLayer,
        apronUnderlaysInView,
        occludersInViewForLayer,
    };
}
