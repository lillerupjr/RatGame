// src/game/map/kenneyMapLoader.ts
import type { TableMapDef } from "../formats/table/tableMapTypes";
import { KENNEY_TILE_ANCHOR_Y } from "../../../engine/render/kenneyTiles";
import type { TriggerDef } from "../../triggers/triggerTypes";
import { resolveMapSkin, type MapSkinBundle, type MapSkinId } from "../../content/mapSkins";
import { resolveTileSpriteId } from "../skins/tileSpriteResolver";

export type IsoTileKind = "VOID" | "FLOOR" | "STAIRS" | "SPAWN" | "GOAL";
export type StairDir = "N" | "E" | "S" | "W";
export type WallDir = "N" | "E" | "S" | "W";

export type IsoTile = {
    kind: IsoTileKind;
    h: number;      // integer base height (authored)
    skin?: string;  // optional per-tile sprite override id
    dir?: StairDir; // stairs direction (optional)
    stairGroupId?: number;
    stairStepIndex?: number; // 0..n-1 low->high within a staircase group
};

export type SurfaceKind = "TILE_TOP";
export type RenderTopKind = "FLOOR" | "STAIR";

export type RenderRole = "UNDERLAY" | "OCCLUDER";
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
    spriteIdTop: string;
};

export type RenderPieceKind = "FLOOR_APRON" | "STAIR_APRON" | "WALL";

export type RenderPiece = {
    id: string;
    cls: RenderRole;
    kind: RenderPieceKind;
    tx: number;
    ty: number;
    zFrom: number;
    zTo: number;
    zLogical: number;
    ownerStairId?: string;
    sourceFloorTxTy?: string;
    edgeDir?: "E" | "S" | "N" | "W";
    seamZ?: number;
    sortKeyFromFloor?: number;
    apronKind?: "S" | "E";
    apronDyOffset?: number;
    wallDir?: WallDir;
    wallSkin?: string;
    flipX?: boolean;
    renderTopKind: RenderTopKind;
    renderDir: StairDir;
    renderAnchorY: number;
    renderDyOffset: number;
    spriteId: string;
};

export type WallToken = {
    x: number;
    y: number;
    height: number;
    dir: WallDir;
};

export type SolidFaceRec = {
    tx: number;
    ty: number;
    zLogical: number;
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

    triggerDefs: TriggerDef[];

    getTile(tx: number, ty: number): IsoTile;
    surfacesByKey: Map<string, Surface[]>;
    surfacesAtXY(tx: number, ty: number): Surface[];
    topsByLayer: Map<number, Surface[]>;
    underlaysByKey: Map<string, RenderPiece[]>;
    underlays: RenderPiece[];
    deferredApronsByKey: Map<string, RenderPiece[]>;
    debugApronStats?: {
        apronCandidates: number;
        apronScanHits: number;
        apronOwnedByStair: number;
        apronAnyStairHits: number;
        apronSameZHits: number;
        stairDeltaCounts: Array<{ delta: string; count: number }>;
        offsetCountsE: Array<{ offset: string; count: number }>;
        offsetCountsS: Array<{ offset: string; count: number }>;
        pickedOffsetsE: Array<{ offset: string; count: number }>;
        pickedOffsetsS: Array<{ offset: string; count: number }>;
    };
    occludersByLayer: Map<number, RenderPiece[]>;
    apronUnderlaysAtXY(tx: number, ty: number): RenderPiece[];
    deferredApronsAtXY(tx: number, ty: number): RenderPiece[];
    occludersForLayer(layer: number): RenderPiece[];
    occludersInViewForLayer(layer: number, view: ViewRect): RenderPiece[];
    solidFace(tx: number, ty: number, zLogical: number, dir: WallDir): boolean;
    solidFacesInView(view: ViewRect): SolidFaceRec[];
};

// Parse tokens like: F0, F5, S0W, S3N, S4S, S5, P0, C2E
function parseToken(t: string): IsoTile | null {
    const tok = (t ?? "").trim();
    if (!tok) return null;

    const up = tok.toUpperCase();

    // FLOOR: F<number>
    if (up.startsWith("F")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;
        return { kind: "FLOOR", h };
    }

    // SPAWN: P<number> (acts like FLOOR visually/gameplay, but marks spawn)
    if (up.startsWith("P")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;
        return { kind: "SPAWN", h };
    }

    // GOAL: G<number> (destination/objective marker)
    if (up.startsWith("G")) {
        const n = parseInt(up.slice(1), 10);
        const h = Number.isFinite(n) ? (n | 0) : 0;
        return { kind: "GOAL", h };
    }

    // STAIRS: S<number><dir?>
    // We load as STAIRS tiles. Direction (when present) determines sprite skin.
    if (up.startsWith("S")) {
        const m = up.match(/^S(\d+)([NESW])?$/);
        if (m) {
            const h = parseInt(m[1], 10) | 0;
            const dir = (m[2] as StairDir | undefined) ?? undefined;
            return { kind: "STAIRS", h, dir };
        }

        const cleaned = "S" + up.slice(1).replace(/[^0-9NESW]/g, "");
        const m2 = cleaned.match(/^S(\d+)([NESW])?$/);
        if (m2) {
            const h = parseInt(m2[1], 10) | 0;
            const dir = (m2[2] as StairDir | undefined) ?? undefined;
            return { kind: "STAIRS", h, dir };
        }

        // Fallback: stairs at height 0 (no direction)
        return { kind: "STAIRS", h: 0 };
    }

    return null;
}

// Parse multi-tokens like: F0|W4S
function parseTokens(t: string): { tile: IsoTile | null; walls: WallToken[] } {
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
            tile = parseToken(tok);
        }
    }

    return { tile, walls };
}

/** Compile a table-based map definition into a render/query-friendly map. */
function mapSkinDefaultsFromDef(def: TableMapDef): MapSkinBundle {
    const defaults: MapSkinBundle = { ...(def.mapSkinDefaults ?? {}) };
    if (!defaults.floor && def.defaultFloorSkin) defaults.floor = def.defaultFloorSkin;
    return defaults;
}

export function compileKenneyMapFromTable(
    def: TableMapDef,
    options?: { mapSkinId?: MapSkinId }
): CompiledKenneyMap {
    const mapSkinDefaults = mapSkinDefaultsFromDef(def);
    // Priority: def.mapSkinId (authored) > options.mapSkinId (runtime override)
    // This allows authored maps to specify their own skin, while procedural maps use runtime selection
    const skinIdToUse = def.mapSkinId ?? options?.mapSkinId;
    const resolvedMapSkin = resolveMapSkin(skinIdToUse);

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
        const parsed = parseTokens(c.t);
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
    const topsByLayer = new Map<number, Surface[]>();

    const floorAnchorY = KENNEY_TILE_ANCHOR_Y;
    const stairAnchorY = floorAnchorY;
    const stairDyByDir: Record<StairDir, number> = {
        N: 0,
        E: 0,
        S: 0,
        W: 0,
    };

    function addSurface(surface: Surface) {
        const k = `${surface.tx},${surface.ty}`;
        const list = surfacesByKey.get(k);
        if (list) list.push(surface);
        else surfacesByKey.set(k, [surface]);

        const layerList = topsByLayer.get(surface.zLogical);
        if (layerList) layerList.push(surface);
        else topsByLayer.set(surface.zLogical, [surface]);
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
        const tileOverride: MapSkinBundle | undefined = tile.skin
            ? (renderTopKind === "STAIR" ? { stair: tile.skin } : { floor: tile.skin })
            : undefined;
        const spriteIdTop = resolveTileSpriteId({
            slot: renderTopKind === "STAIR" ? "stair" : "floor",
            dir: renderTopKind === "STAIR" ? renderDir : undefined,
            mapSkin: resolvedMapSkin,
            mapDefaults: mapSkinDefaults,
            tileOverride,
        });

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
            spriteIdTop,
        });
    }

    function surfacesAtXY(tx: number, ty: number): Surface[] {
        return surfacesByKey.get(`${tx},${ty}`) ?? [];
    }

    const apronBaseMode = def.apronBaseMode ?? "ISLANDS";
    const apronBaseZ = (() => {
        if (apronBaseMode !== "PLATEAU") return 0;
        let minZ: number | null = null;
        for (const list of surfacesByKey.values()) {
            for (let i = 0; i < list.length; i++) {
                const z = list[i].zBase | 0;
                if (minZ === null || z < minZ) minZ = z;
            }
        }
        return Math.max(0, minZ ?? 0);
    })();

    const underlaysByKey = new Map<string, RenderPiece[]>();
    const underlays: RenderPiece[] = [];
    const deferredApronsByKey = new Map<string, RenderPiece[]>();
    const occludersByLayer = new Map<number, RenderPiece[]>();
    const wallFaces = new Set<string>();
    const wallFaceList: SolidFaceRec[] = [];

    function addPieceToLayerMap(map: Map<number, RenderPiece[]>, piece: RenderPiece) {
        const list = map.get(piece.zLogical);
        if (list) list.push(piece);
        else map.set(piece.zLogical, [piece]);
    }

    const APRON_FACE_HEIGHT = 2;
    const WALL_FACE_HEIGHT = 2;

    function addSolidFaceSpan(tx: number, ty: number, zStart: number, zEnd: number, dir: WallDir) {
        const z0 = Math.min(zStart, zEnd);
        const z1 = Math.max(zStart, zEnd);
        for (let z = z0; z < z1; z += 1) {
            addSolidFace(tx, ty, z, dir);
        }
    }

    function addUnderlay(piece: RenderPiece) {
        underlays.push(piece);
        const k = `${piece.tx},${piece.ty}`;
        const list = underlaysByKey.get(k);
        if (list) list.push(piece);
        else underlaysByKey.set(k, [piece]);
        if ((piece.kind === "FLOOR_APRON" || piece.kind === "STAIR_APRON") && piece.edgeDir) {
            addSolidFaceSpan(
                piece.tx,
                piece.ty,
                piece.zLogical - APRON_FACE_HEIGHT,
                piece.zLogical,
                piece.edgeDir,
            );
        }
    }

    function addDeferredApron(ownerTx: number, ownerTy: number, piece: RenderPiece) {
        const k = `${ownerTx},${ownerTy}`;
        const list = deferredApronsByKey.get(k);
        if (list) list.push(piece);
        else deferredApronsByKey.set(k, [piece]);
        if ((piece.kind === "FLOOR_APRON" || piece.kind === "STAIR_APRON") && piece.edgeDir) {
            addSolidFaceSpan(
                piece.tx,
                piece.ty,
                piece.zLogical - APRON_FACE_HEIGHT,
                piece.zLogical,
                piece.edgeDir,
            );
        }
    }

    function addOccluder(piece: RenderPiece) {
        addPieceToLayerMap(occludersByLayer, piece);
        if (piece.kind === "WALL" && piece.wallDir) {
            addSolidFaceSpan(
                piece.tx,
                piece.ty,
                piece.zLogical,
                piece.zLogical + WALL_FACE_HEIGHT,
                piece.wallDir,
            );
        }
    }

    function maxSurfaceZAt(tx: number, ty: number): number | null {
        const surfaces = surfacesAtXY(tx, ty);
        if (surfaces.length === 0) return null;
        let best = surfaces[0].zBase;
        for (let i = 1; i < surfaces.length; i++) {
            const z = surfaces[i].zBase;
            if (z > best) best = z;
        }
        return best;
    }

    function maxNonStairSurfaceZAt(tx: number, ty: number): number | null {
        const surfaces = surfacesAtXY(tx, ty);
        if (surfaces.length === 0) return null;
        let best: number | null = null;
        for (let i = 0; i < surfaces.length; i++) {
            const s = surfaces[i];
            if (s.tile.kind === "STAIRS") continue;
            const z = s.zBase;
            if (best === null || z > best) best = z;
        }
        return best;
    }

    function dirToDelta(dir: WallDir): { dx: number; dy: number } {
        switch (dir) {
            case "N": return { dx: 0, dy: -1 };
            case "E": return { dx: 1, dy: 0 };
            case "S": return { dx: 0, dy: 1 };
            case "W": return { dx: -1, dy: 0 };
        }
    }

    function oppositeDir(dir: WallDir): WallDir {
        switch (dir) {
            case "N": return "S";
            case "S": return "N";
            case "E": return "W";
            case "W": return "E";
        }
    }

    function canonicalizeEdge(tx: number, ty: number, dir: WallDir): { tx: number; ty: number; dir: WallDir } {
        if (dir === "N") return { tx, ty: ty - 1, dir: "S" };
        if (dir === "W") return { tx: tx - 1, ty, dir: "E" };
        return { tx, ty, dir };
    }

    function addSolidFace(tx: number, ty: number, zLogical: number, dir: WallDir) {
        const canonical = canonicalizeEdge(tx, ty, dir);
        const key = `${canonical.tx},${canonical.ty},${zLogical | 0},${canonical.dir}`;
        if (wallFaces.has(key)) return;
        wallFaces.add(key);
        wallFaceList.push({
            tx: canonical.tx,
            ty: canonical.ty,
            zLogical: zLogical | 0,
            dir: canonical.dir,
        });
    }

    const FLOOR_SORT_MULT = 1000000;
    const FLOOR_SORT_TY_OFFSET = 100000;

    function floorSortKey(tx: number, ty: number): number {
        const sum = tx + ty;
        return sum * FLOOR_SORT_MULT + (FLOOR_SORT_TY_OFFSET - ty);
    }

    function hasBlockingStairForApron(edgeDir: "E" | "S", floorSurface: Surface): boolean {
        const seamZ = (floorSurface.zBase | 0) - 1;
        const { dx, dy } = dirToDelta(edgeDir);
        const nTx = floorSurface.tx + dx;
        const nTy = floorSurface.ty + dy;
        const surfaces = surfacesAtXY(nTx, nTy);
        if (surfaces.length === 0) return false;

        const relDir = oppositeDir(edgeDir);
        for (let i = 0; i < surfaces.length; i++) {
            const s = surfaces[i];
            if (s.tile.kind !== "STAIRS") continue;
            if ((s.zLogical | 0) !== seamZ) continue;
            if (!s.tile.dir) continue;
            if (s.tile.dir !== relDir) continue;
            return true;
        }

        return false;
    }

    type StairScanEntry = {
        ox: number;
        oy: number;
        surface: Surface;
    };

    type StairScanResult = {
        floorSurface: Surface;
        entries: StairScanEntry[];
        anyStairHits: boolean;
        sameZHits: boolean;
        deltaCounts: Map<string, number>;
    };

    function scanStairsAtSeamForApron(edgeDir: "E" | "S", floorSurface: Surface): StairScanResult {
        const entries: StairScanEntry[] = [];
        const seamZ = (floorSurface.zBase | 0) - 1;
        const deltaCounts = new Map<string, number>();
        let anyStairHits = false;
        let sameZHits = false;

        const offsets = edgeDir === "E"
            ? [{ ox: 1, oy: -1 }, { ox: 1, oy: 0 }, { ox: 1, oy: 1 }]
            : [{ ox: -1, oy: 1 }, { ox: 0, oy: 1 }, { ox: 1, oy: 1 }];

        for (let i = 0; i < offsets.length; i++) {
            const { ox, oy } = offsets[i];
            const tx = floorSurface.tx + ox;
            const ty = floorSurface.ty + oy;
            const surfaces = surfacesAtXY(tx, ty);
            for (let j = 0; j < surfaces.length; j++) {
                const s = surfaces[j];
                if (s.tile.kind !== "STAIRS") continue;
                anyStairHits = true;
                const delta = (s.zLogical | 0) - seamZ;
                const deltaKey = `${delta}`;
                deltaCounts.set(deltaKey, (deltaCounts.get(deltaKey) ?? 0) + 1);
                if (delta === 0) sameZHits = true;
                if ((s.zLogical | 0) !== seamZ) continue;
                entries.push({ ox, oy, surface: s });
            }
        }

        return { floorSurface, entries, anyStairHits, sameZHits, deltaCounts };
    }

    function pickBestStairForApron(edgeDir: "E" | "S", scan: StairScanResult): Surface | null {
        void edgeDir;
        return scan.entries[0]?.surface ?? null;
    }

    const DIRS: Array<{ dir: WallDir; dx: number; dy: number }> = [
        { dir: "N", dx: 0, dy: -1 },
        { dir: "E", dx: 1, dy: 0 },
        { dir: "S", dx: 0, dy: 1 },
        { dir: "W", dx: -1, dy: 0 },
    ];

    const offsetCountsE = new Map<string, number>();
    const offsetCountsS = new Map<string, number>();
    const pickedOffsetsE = new Map<string, number>();
    const pickedOffsetsS = new Map<string, number>();
    const stairDeltaCounts = new Map<string, number>();

    const bumpOffset = (map: Map<string, number>, ox: number, oy: number) => {
        const key = `${ox},${oy}`;
        map.set(key, (map.get(key) ?? 0) + 1);
    };

    const toSortedOffsets = (map: Map<string, number>) => {
        const entries = Array.from(map.entries()).map(([offset, count]) => ({ offset, count }));
        entries.sort((a, b) => b.count - a.count);
        return entries;
    };

    const debugApronStats = {
        apronCandidates: 0,
        apronScanHits: 0,
        apronOwnedByStair: 0,
        apronAnyStairHits: 0,
        apronSameZHits: 0,
        stairDeltaCounts: [] as Array<{ delta: string; count: number }>,
        offsetCountsE: [] as Array<{ offset: string; count: number }>,
        offsetCountsS: [] as Array<{ offset: string; count: number }>,
        pickedOffsetsE: [] as Array<{ offset: string; count: number }>,
        pickedOffsetsS: [] as Array<{ offset: string; count: number }>,
    };

    for (const list of surfacesByKey.values()) {
        for (let i = 0; i < list.length; i++) {
            const surface = list[i];
            const surfaceZ = surface.zBase;
            const isStair = surface.tile.kind === "STAIRS";

            const stairUphillDir = isStair ? ((surface.tile.dir ?? "N") as StairDir) : null;
            const stairDownhillDir = stairUphillDir ? oppositeDir(stairUphillDir) : null;

            for (let d = 0; d < DIRS.length; d++) {
                const { dir, dx, dy } = DIRS[d];
                if (isStair) {
                    if (stairDownhillDir && dir !== stairDownhillDir) continue;
                } else {
                    if (dir !== "E" && dir !== "S") continue;
                }

                const nTx = surface.tx + dx;
                const nTy = surface.ty + dy;
                const neighborZ = isStair ? maxSurfaceZAt(nTx, nTy) : maxNonStairSurfaceZAt(nTx, nTy);
                if (neighborZ !== null && neighborZ === surfaceZ) continue;
                if (!isStair && (dir === "E" || dir === "S")) {
                    if (hasBlockingStairForApron(dir, surface)) continue;
                }
                if (!isStair && (dir === "E" || dir === "S")) {
                    debugApronStats.apronCandidates += 1;
                    const scan = scanStairsAtSeamForApron(dir, surface);
                    if (scan.entries.length > 0) debugApronStats.apronScanHits += 1;
                    if (scan.anyStairHits) debugApronStats.apronAnyStairHits += 1;
                    if (scan.sameZHits) debugApronStats.apronSameZHits += 1;
                    for (const [delta, count] of scan.deltaCounts.entries()) {
                        stairDeltaCounts.set(delta, (stairDeltaCounts.get(delta) ?? 0) + count);
                    }
                    for (let si = 0; si < scan.entries.length; si++) {
                        const entry = scan.entries[si];
                        if (dir === "E") bumpOffset(offsetCountsE, entry.ox, entry.oy);
                        else bumpOffset(offsetCountsS, entry.ox, entry.oy);
                    }
                    const stairOwner = pickBestStairForApron(dir, scan);
                    if (stairOwner) {
                        debugApronStats.apronOwnedByStair += 1;
                        const picked = scan.entries.find((entry) => entry.surface.id === stairOwner.id);
                        if (picked) {
                            if (dir === "E") bumpOffset(pickedOffsetsE, picked.ox, picked.oy);
                            else bumpOffset(pickedOffsetsS, picked.ox, picked.oy);
                        }
                        addDeferredApron(stairOwner.tx, stairOwner.ty, {
                            id: `deferred_apron_${surface.tx}_${surface.ty}_${surfaceZ}_${dir}`,
                            cls: "UNDERLAY",
                            kind: "FLOOR_APRON",
                            tx: surface.tx,
                            ty: surface.ty,
                            zFrom: apronBaseZ,
                            zTo: surfaceZ,
                            zLogical: surface.zLogical,
                            ownerStairId: stairOwner.id,
                            sourceFloorTxTy: `${surface.tx},${surface.ty}`,
                            edgeDir: dir,
                            seamZ: surfaceZ,
                            sortKeyFromFloor: floorSortKey(surface.tx, surface.ty),
                            apronKind: dir,
                            apronDyOffset: -100,
                            flipX: false,
                            renderTopKind: "FLOOR",
                            renderDir: "N",
                            renderAnchorY: floorAnchorY,
                            renderDyOffset: 0,
                            spriteId: resolveTileSpriteId({
                                slot: "apron",
                                dir,
                                mapSkin: resolvedMapSkin,
                                mapDefaults: mapSkinDefaults,
                            }),
                        });
                        continue;
                    }
                }

                // Skip underlay creation for stairs; their tread is rendered as a surface.
                // Only create underlays for floors and other surfaces.
                if (isStair) continue;

                addUnderlay({
                    id: `apron_${surface.tx}_${surface.ty}_${surfaceZ}_${dir}`,
                    cls: "UNDERLAY",
                    kind: "FLOOR_APRON",
                    tx: surface.tx,
                    ty: surface.ty,
                    zFrom: apronBaseZ,
                    zTo: surfaceZ,
                    zLogical: surface.zLogical,
                    edgeDir: dir,
                    apronKind: dir === "E" || dir === "S" ? dir : undefined,
                    apronDyOffset: -100,
                    flipX: false,
                    renderTopKind: surface.renderTopKind,
                    renderDir: surface.renderDir,
                    renderAnchorY: surface.renderAnchorY,
                    renderDyOffset: surface.renderDyOffset,
                    spriteId: resolveTileSpriteId({
                        slot: "apron",
                        dir: dir === "E" || dir === "S" ? dir : "S",
                        mapSkin: resolvedMapSkin,
                        mapDefaults: mapSkinDefaults,
                    }),
                });
            }
        }
    }

    // Create stair apron pieces for vertical stair faces (renders after entities as occluders/deferred)
    for (const list of surfacesByKey.values()) {
        for (let i = 0; i < list.length; i++) {
            const surface = list[i];
            if (surface.tile.kind !== "STAIRS") continue;

            const surfaceZ = surface.zBase;
            const stairDir = surface.tile.dir ?? "N";

            // Stair aprons face in the downhill direction
            const stairDownhillDir = oppositeDir(stairDir);

            const nTx = surface.tx + dirToDelta(stairDownhillDir).dx;
            const nTy = surface.ty + dirToDelta(stairDownhillDir).dy;
            const neighborZ = maxSurfaceZAt(nTx, nTy);

            // Only create apron if there's a height difference (vertical face exists)
            if (neighborZ !== null && neighborZ === surfaceZ) continue;

            // Create STAIR_APRON as deferred/occluder piece (renders after entities)
            addDeferredApron(surface.tx, surface.ty, {
                id: `stair_apron_${surface.tx}_${surface.ty}_${surfaceZ}_${stairDownhillDir}`,
                cls: "UNDERLAY",
                kind: "STAIR_APRON",
                tx: surface.tx,
                ty: surface.ty,
                zFrom: apronBaseZ,
                zTo: surfaceZ,
                zLogical: surface.zLogical,
                edgeDir: stairDownhillDir,
                apronKind: stairDownhillDir === "E" || stairDownhillDir === "S" ? stairDownhillDir : undefined,
                apronDyOffset: 0,
                flipX: false,
                renderTopKind: "STAIR",
                renderDir: surface.renderDir,
                renderAnchorY: surface.renderAnchorY,
                renderDyOffset: surface.renderDyOffset,
                spriteId: resolveTileSpriteId({
                    slot: "stairApron",
                    dir: stairDownhillDir,
                    mapSkin: resolvedMapSkin,
                    mapDefaults: mapSkinDefaults,
                }),
            });
        }
    }

    for (let i = 0; i < wallTokens.length; i++) {
        const w = wallTokens[i];
        const rawTx = w.x + originTx;
        const rawTy = w.y + originTy;
        const canonical = canonicalizeEdge(rawTx, rawTy, w.dir);
        const tx = canonical.tx;
        const ty = canonical.ty;
        const height = Math.max(0, w.height | 0);
        if (height <= 0) continue;

        const flipX = false;
        const segmentHeight = 2;
        const zFrom = 0;
        const zTo = height;
        const wallSkin = "WALL";
        const wallAxis = canonical.dir === "E" || canonical.dir === "W" ? "E" : "S";
        const wallSlot = wallSkin === "FLOOR_EDGE"
            ? "apron"
            : wallSkin === "STAIR_FACE"
                ? "stairApron"
                : "wall";
        const wallSpriteDir = wallSlot === "stairApron" ? "N" : wallAxis;
        const spriteId = resolveTileSpriteId({
            slot: wallSlot,
            dir: wallSpriteDir,
            mapSkin: resolvedMapSkin,
            mapDefaults: mapSkinDefaults,
        });

        for (let z = zFrom; z < zTo; z += segmentHeight) {
            const segFrom = z;
            const segTo = Math.min(z + segmentHeight, zTo);
            const zLogical = Math.floor(segFrom + 1e-6);
            addOccluder({
                id: `wall_${tx}_${ty}_${w.dir}_${segFrom}_${segTo}`,
                cls: "OCCLUDER",
                kind: "WALL",
                tx,
                ty,
                zFrom: segFrom,
                zTo: segTo,
                zLogical,
                wallDir: canonical.dir,
                wallSkin,
                apronDyOffset: 0,
                flipX,
                renderTopKind: "FLOOR",
                renderDir: "N",
                renderAnchorY: floorAnchorY,
                renderDyOffset: 0,
                spriteId,
            });
        }
    }

    function occludersForLayer(layer: number): RenderPiece[] {
        return occludersByLayer.get(layer) ?? [];
    }

    function apronUnderlaysAtXY(tx: number, ty: number): RenderPiece[] {
        return underlaysByKey.get(`${tx},${ty}`) ?? [];
    }

    function deferredApronsAtXY(tx: number, ty: number): RenderPiece[] {
        return deferredApronsByKey.get(`${tx},${ty}`) ?? [];
    }

    function pieceInView(piece: RenderPiece, view: ViewRect): boolean {
        return piece.tx >= view.minTx
            && piece.tx <= view.maxTx
            && piece.ty >= view.minTy
            && piece.ty <= view.maxTy;
    }

    function occludersInViewForLayer(layer: number, view: ViewRect): RenderPiece[] {
        const list = occludersByLayer.get(layer);
        if (!list || list.length === 0) return [];
        const out: RenderPiece[] = [];
        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            if (pieceInView(c, view)) out.push(c);
        }
        return out;
    }

    function solidFace(tx: number, ty: number, zLogical: number, dir: WallDir): boolean {
        const canonical = canonicalizeEdge(tx, ty, dir);
        const key = `${canonical.tx},${canonical.ty},${zLogical | 0},${canonical.dir}`;
        return wallFaces.has(key);
    }

    function solidFacesInView(view: ViewRect): SolidFaceRec[] {
        const out: SolidFaceRec[] = [];
        for (let i = 0; i < wallFaceList.length; i++) {
            const rec = wallFaceList[i];
            if (rec.tx < view.minTx || rec.tx > view.maxTx) continue;
            if (rec.ty < view.minTy || rec.ty > view.maxTy) continue;
            out.push(rec);
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

    const triggerDefs: TriggerDef[] = [];
    for (const c of def.cells) {
        if (!c.triggerId || !c.triggerType) continue;
        const fx = (def.w - 1) - (c.x | 0);
        const fy = (def.h - 1) - (c.y | 0);
        triggerDefs.push({
            id: c.triggerId,
            type: c.triggerType,
            tx: fx + originTx,
            ty: fy + originTy,
            radius: c.radius,
        });
    }

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

        triggerDefs,

        getTile,
        surfacesByKey,
        surfacesAtXY,
        topsByLayer,
        underlaysByKey,
        underlays,
        deferredApronsByKey,
        debugApronStats: {
            ...debugApronStats,
            stairDeltaCounts: Array.from(stairDeltaCounts.entries())
                .map(([delta, count]) => ({ delta, count }))
                .sort((a, b) => b.count - a.count),
            offsetCountsE: toSortedOffsets(offsetCountsE),
            offsetCountsS: toSortedOffsets(offsetCountsS),
            pickedOffsetsE: toSortedOffsets(pickedOffsetsE),
            pickedOffsetsS: toSortedOffsets(pickedOffsetsS),
        },
        occludersByLayer,
        apronUnderlaysAtXY,
        deferredApronsAtXY,
        occludersForLayer,
        occludersInViewForLayer,
        solidFace,
        solidFacesInView,
    };
}
