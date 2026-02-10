// src/game/map/kenneyMapLoader.ts
import type { SemanticStamp, TableMapDef } from "../formats/table/tableMapTypes";
import { KENNEY_TILE_ANCHOR_Y } from "../../../engine/render/kenneyTiles";
import type { TriggerDef } from "../../triggers/triggerTypes";
import { resolveMapSkin, resolveSemanticSprite, type MapSkinBundle, type MapSkinId } from "../../content/mapSkins";
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

export type RenderRole = "SURFACE" | "FACE";
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

export type StampOverlay = {
    id: string;
    tx: number;
    ty: number;
    w: number;
    h: number;
    z: number;
    spriteId: string;
};

export type WallToken = {
    x: number;
    y: number;
    height: number;
    dir: WallDir;
    skin?: string;
    slot?: "wall" | "apron" | "stairApron";
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
    occludersForLayer(layer: number): RenderPiece[];
    occludersInViewForLayer(layer: number, view: ViewRect): RenderPiece[];
    solidFace(tx: number, ty: number, zLogical: number, dir: WallDir): boolean;
    solidFacesInView(view: ViewRect): SolidFaceRec[];
    overlays: StampOverlay[];
    overlaysInView(view: ViewRect): StampOverlay[];
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

    // Excel -> tile mapping:
    // - Excel x (right) becomes tile -y (north)
    // - Excel y (down) becomes tile +x (east)
    const excelToTile = (ex: number, ey: number) => {
        return { tx: ey, ty: -ex };
    };

    type ParsedCell = {
        tx: number;
        ty: number;
        tile: IsoTile | null;
        walls: WallToken[];
    };

    const parsedCells: ParsedCell[] = [];
    const wallTokens: WallToken[] = [];
    let minTx = Number.POSITIVE_INFINITY;
    let maxTx = Number.NEGATIVE_INFINITY;
    let minTy = Number.POSITIVE_INFINITY;
    let maxTy = Number.NEGATIVE_INFINITY;

    // First SPAWN found becomes the authoritative spawn point
    let spawnTableX: number | null = null;
    let spawnTableY: number | null = null;
    let spawnH: number = 0;

    // First GOAL found becomes the authoritative goal point
    let goalTableX: number | null = null;
    let goalTableY: number | null = null;
    let goalH: number = 0;

    for (const c of def.cells) {
        const ex = c.x | 0;
        const ey = c.y | 0;
        const parsed = (() => {
            if (c.t) return parseTokens(c.t);

            const type = (c.type ?? "").toLowerCase();
            const sprite = c.sprite;
            const z = c.z ?? 0;
            const dirFromMeta = (() => {
                const d = (c.meta as any)?.dir;
                if (typeof d === "string") {
                    const up = d.toUpperCase();
                    if (up === "N" || up === "E" || up === "S" || up === "W") return up as WallDir;
                }
                if (Array.isArray(c.tags)) {
                    for (let i = 0; i < c.tags.length; i++) {
                        const up = c.tags[i].toUpperCase();
                        if (up === "N" || up === "E" || up === "S" || up === "W") return up as WallDir;
                    }
                }
                return undefined;
            })();

            if (type === "floor") {
                return { tile: { kind: "FLOOR", h: z, skin: sprite }, walls: [] as WallToken[] };
            }
            if (type === "spawn") {
                return { tile: { kind: "SPAWN", h: z, skin: sprite }, walls: [] as WallToken[] };
            }
            if (type === "goal") {
                return { tile: { kind: "GOAL", h: z, skin: sprite }, walls: [] as WallToken[] };
            }
            if (type === "stairs") {
                const stairDir = dirFromMeta ?? "N";
                return {
                    tile: { kind: "STAIRS", h: z, dir: stairDir as StairDir, skin: sprite },
                    walls: [] as WallToken[],
                };
            }
            if (type === "wall") {
                const height = Math.max(0, z | 0);
                const dir = dirFromMeta ?? "S";
                const wt: WallToken = { x: 0, y: 0, height, dir, skin: sprite, slot: "wall" };
                return { tile: null, walls: [wt] };
            }
            if (type === "void") {
                return { tile: { kind: "VOID", h: 0 }, walls: [] as WallToken[] };
            }

            return { tile: null, walls: [] as WallToken[] };
        })();
        if (!parsed.tile && parsed.walls.length === 0) continue;

        const mapped = excelToTile(ex, ey);
        if (mapped.tx < minTx) minTx = mapped.tx;
        if (mapped.tx > maxTx) maxTx = mapped.tx;
        if (mapped.ty < minTy) minTy = mapped.ty;
        if (mapped.ty > maxTy) maxTy = mapped.ty;

        if (parsed.tile) {
            const tile = parsed.tile;
            if (tile.kind === "SPAWN" && spawnTableX === null) {
                spawnTableX = mapped.tx;
                spawnTableY = mapped.ty;
                spawnH = tile.h | 0;
            }

            if (tile.kind === "GOAL" && goalTableX === null) {
                goalTableX = mapped.tx;
                goalTableY = mapped.ty;
                goalH = tile.h | 0;
            }
        }

        parsedCells.push({
            tx: mapped.tx,
            ty: mapped.ty,
            tile: parsed.tile,
            walls: parsed.walls,
        });
    }

    if (def.stamps && def.stamps.length > 0) {
        for (let i = 0; i < def.stamps.length; i++) {
            const s = def.stamps[i];
            const w = Math.max(1, (s.w ?? 1) | 0);
            const h = Math.max(1, (s.h ?? 1) | 0);
            if (s.x < minTx) minTx = s.x;
            if (s.x + w - 1 > maxTx) maxTx = s.x + w - 1;
            if (s.y < minTy) minTy = s.y;
            if (s.y + h - 1 > maxTy) maxTy = s.y + h - 1;
        }
    }

    if (!Number.isFinite(minTx)) {
        minTx = 0;
        maxTx = def.h - 1;
        minTy = 0;
        maxTy = def.w - 1;
    }

    // Decide where table (0,0) lands in tile-space.
    const boundsCenterTx = (minTx + maxTx) * 0.5;
    const boundsCenterTy = (minTy + maxTy) * 0.5;
    const originTx = def.centerOnZero ? -Math.floor(boundsCenterTx) : 0;
    const originTy = def.centerOnZero ? -Math.floor(boundsCenterTy) : 0;

    const placed = new Map<string, IsoTile>();

    for (let i = 0; i < parsedCells.length; i++) {
        const cell = parsedCells[i];
        const tx = cell.tx + originTx;
        const ty = cell.ty + originTy;
        const tile = cell.tile;
        if (tile) {
            placed.set(`${tx},${ty}`, tile);
        }

        if (cell.walls.length > 0) {
            for (let j = 0; j < cell.walls.length; j++) {
                wallTokens.push({ ...cell.walls[j], x: tx, y: ty });
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
        const dirs = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
        ];

        for (const [k, t0] of placed.entries()) {
            if (!t0 || t0.kind !== "STAIRS") continue;
            if (visited.has(k)) continue;
            const parts = k.split(",");
            const baseX = parseInt(parts[0], 10);
            const baseY = parseInt(parts[1], 10);
            if (!Number.isFinite(baseX) || !Number.isFinite(baseY)) continue;

            const dir = t0.dir;
            if (dir !== "N" && dir !== "E" && dir !== "S" && dir !== "W") continue;

            const stack: Array<{ x: number; y: number }> = [{ x: baseX, y: baseY }];
            const tiles: IsoTile[] = [];
            let minH = t0.h | 0;

            while (stack.length > 0) {
                const cur = stack.pop()!;
                const ck = key(cur.x, cur.y);
                if (visited.has(ck)) continue;

                const t = placed.get(ck);
                if (!t || t.kind !== "STAIRS") continue;
                if ((t.dir ?? undefined) !== (dir ?? undefined)) continue;

                visited.add(ck);
                tiles.push(t);
                const h = t.h | 0;
                if (h < minH) minH = h;

                for (let di = 0; di < dirs.length; di++) {
                    const { dx, dy } = dirs[di];
                    stack.push({ x: cur.x + dx, y: cur.y + dy });
                }
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

    function getTile(tx: number, ty: number): IsoTile {
        return placed.get(`${tx},${ty}`) ?? { kind: "VOID", h: 0 };
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
        const tx = parseInt(parts[0], 10);
        const ty = parseInt(parts[1], 10);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
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

    if (def.stamps && def.stamps.length > 0) {
        for (let i = 0; i < def.stamps.length; i++) {
            compileStamp(def.stamps[i]);
        }
    }

    function surfacesAtXY(tx: number, ty: number): Surface[] {
        return surfacesByKey.get(`${tx},${ty}`) ?? [];
    }

    const apronBaseMode = def.apronBaseMode ?? "ISLANDS";
    const apronBaseZ = (() => {
        // ISLANDS: treat "outside the authored surface" as being 1 level below.
        // This guarantees height-0 platforms still emit visible aprons against VOID.
        if (apronBaseMode !== "PLATEAU") return -1;

        // PLATEAU: baseline is the minimum authored surface height (clamped to >= 0).
        let minZ: number | null = null;
        for (const list of surfacesByKey.values()) {
            for (let i = 0; i < list.length; i++) {
                const z = list[i].zBase | 0;
                if (minZ === null || z < minZ) minZ = z;
            }
        }
        return Math.max(0, minZ ?? 0);
    })();


    const occludersByLayer = new Map<number, RenderPiece[]>();
    const overlays: StampOverlay[] = [];
    const wallFaces = new Set<string>();
    const wallFaceList: SolidFaceRec[] = [];

    function addPieceToLayerMap(map: Map<number, RenderPiece[]>, piece: RenderPiece) {
        const list = map.get(piece.zLogical);
        if (list) list.push(piece);
        else map.set(piece.zLogical, [piece]);
    }


    function addSolidFaceSpan(tx: number, ty: number, zStart: number, zEnd: number, dir: WallDir) {
        const z0 = Math.min(zStart, zEnd);
        const z1 = Math.max(zStart, zEnd);
        for (let z = z0; z < z1; z += 1) {
            addSolidFace(tx, ty, z, dir);
        }
    }

    function addFace(piece: RenderPiece) {
        addPieceToLayerMap(occludersByLayer, piece);
        if ((piece.kind === "FLOOR_APRON" || piece.kind === "STAIR_APRON") && piece.edgeDir) {
            addSolidFaceSpan(piece.tx, piece.ty, piece.zFrom, piece.zTo, piece.edgeDir);
        }
        if (piece.kind === "WALL" && piece.wallDir) {
            addSolidFaceSpan(piece.tx, piece.ty, piece.zFrom, piece.zTo, piece.wallDir);
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

    const buildingHeight = 8;

    function addStampWall(
        tx: number,
        ty: number,
        dir: WallDir,
        spriteId: string,
        zBase: number,
        height: number,
    ) {
        if (!spriteId) return;
        const zFrom = zBase;
        const zTo = zBase + height;
        const zLogical = Math.floor(zFrom + 1e-6);
        addFace({
            id: `stamp_wall_${tx}_${ty}_${dir}_${zFrom}_${zTo}`,
            cls: "FACE",
            kind: "WALL",
            tx,
            ty,
            zFrom,
            zTo,
            zLogical,
            wallDir: dir,
            renderTopKind: "FLOOR",
            renderDir: "N",
            renderAnchorY: floorAnchorY,
            renderDyOffset: 0,
            spriteId,
            apronDyOffset: 0,
            flipX: false,
        });
    }

    function compileStamp(stamp: SemanticStamp) {
        const sx = (stamp.x | 0) + originTx;
        const sy = (stamp.y | 0) + originTy;
        const zBase = stamp.z ?? 0;
        const w = Math.max(1, (stamp.w ?? 1) | 0);
        const h = Math.max(1, (stamp.h ?? 1) | 0);

        if (stamp.type === "building") {
            const wallSouthSlot = "BUILDING_WALL_SOUTH";
            const wallEastSlot = "BUILDING_WALL_EAST";
            for (let i = 0; i < w; i++) {
                const spriteId = resolveSemanticSprite(skinIdToUse, wallSouthSlot, i);
                addStampWall(sx + i, sy + h - 1, "S", spriteId, zBase, buildingHeight);
            }
            for (let j = 0; j < h - 1; j++) {
                const spriteId = resolveSemanticSprite(skinIdToUse, wallEastSlot, j);
                addStampWall(sx + w - 1, sy + j, "E", spriteId, zBase, buildingHeight);
            }

            const roofSlot = `BUILDING_ROOF_${w}x${h}`;
            const roofSprite =
                resolveSemanticSprite(skinIdToUse, roofSlot) ||
                resolveSemanticSprite(skinIdToUse, "BUILDING_ROOF");
            if (roofSprite) {
                overlays.push({
                    id: `roof_${sx}_${sy}_${w}x${h}`,
                    tx: sx,
                    ty: sy,
                    w,
                    h,
                    z: zBase + buildingHeight,
                    spriteId: roofSprite,
                });
            }

            const buildingFloorSprite =
                resolveSemanticSprite(skinIdToUse, "BUILDING_FLOOR") ||
                resolveTileSpriteId({
                    slot: "floor",
                    dir: undefined,
                    mapSkin: resolvedMapSkin,
                    mapDefaults: mapSkinDefaults,
                });
            for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    addSurface({
                        id: `building_floor_${sx + dx}_${sy + dy}_${zBase}`,
                        kind: "TILE_TOP",
                        tx: sx + dx,
                        ty: sy + dy,
                        zBase,
                        zLogical: zBase | 0,
                        tile: { kind: "FLOOR", h: zBase } as IsoTile,
                        renderTopKind: "FLOOR",
                        renderDir: "N",
                        renderAnchorY: floorAnchorY,
                        renderDyOffset: 0,
                        spriteIdTop: buildingFloorSprite,
                    });
                }
            }
            return;
        }

        const slotForType: Record<string, string> = {
            road: "ROAD_FLOOR",
            sidewalk: "SIDEWALK_FLOOR",
            park: "PARK_FLOOR",
            sea: "SEA_FLOOR",
        };
        const slot = slotForType[stamp.type];
        if (!slot) return;

        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < h; dy++) {
                const tx = sx + dx;
                const ty = sy + dy;
                const spriteIdTop =
                    resolveSemanticSprite(skinIdToUse, slot) ||
                    resolveTileSpriteId({
                        slot: "floor",
                        dir: undefined,
                        mapSkin: resolvedMapSkin,
                        mapDefaults: mapSkinDefaults,
                    });
                addSurface({
                    id: `stamp_${stamp.type}_${tx}_${ty}_${zBase}`,
                    kind: "TILE_TOP",
                    tx,
                    ty,
                    zBase,
                    zLogical: zBase | 0,
                    tile: { kind: "FLOOR", h: zBase } as IsoTile,
                    renderTopKind: "FLOOR",
                    renderDir: "N",
                    renderAnchorY: floorAnchorY,
                    renderDyOffset: 0,
                    spriteIdTop,
                });
            }
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

    const DIRS: Array<{ dir: WallDir; dx: number; dy: number }> = [
        { dir: "N", dx: 0, dy: -1 },
        { dir: "E", dx: 1, dy: 0 },
        { dir: "S", dx: 0, dy: 1 },
        { dir: "W", dx: -1, dy: 0 },
    ];

    function highestSurfaceAt(tx: number, ty: number): Surface | null {
        const surfaces = surfacesAtXY(tx, ty);
        if (surfaces.length === 0) return null;
        let best = surfaces[0];
        for (let i = 1; i < surfaces.length; i++) {
            if (surfaces[i].zBase > best.zBase) best = surfaces[i];
        }
        return best;
    }

    const emittedFaces = new Set<string>();
    let faceId = 0;

    for (const [key, list] of surfacesByKey.entries()) {
        if (!list || list.length === 0) continue;
        const [txStr, tyStr] = key.split(",");
        const tx = parseInt(txStr, 10);
        const ty = parseInt(tyStr, 10);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;

        const zHere = maxSurfaceZAt(tx, ty);
        if (zHere === null) continue;

        for (let d = 0; d < DIRS.length; d++) {
            const { dir, dx, dy } = DIRS[d];
            const nTx = tx + dx;
            const nTy = ty + dy;

            const zNeighbor = maxSurfaceZAt(nTx, nTy);
            const neighborZ = zNeighbor === null ? apronBaseZ : zNeighbor;
            const zA = zHere;
            const zB = neighborZ;
            if (zA === zB) continue;

            const ownerIsHere = zA > zB;
            const ownerTx = ownerIsHere ? tx : nTx;
            const ownerTy = ownerIsHere ? ty : nTy;
            const ownerDir = ownerIsHere ? dir : oppositeDir(dir);
            const canonical = canonicalizeEdge(ownerTx, ownerTy, ownerDir);

            const zFrom = Math.min(zA, zB);
            const zTo = Math.max(zA, zB);
            const dedupKey = `${canonical.tx},${canonical.ty},${canonical.dir},${zFrom},${zTo}`;
            if (emittedFaces.has(dedupKey)) continue;
            emittedFaces.add(dedupKey);

            const ownerSurface = highestSurfaceAt(ownerTx, ownerTy);
            const renderTopKind = ownerSurface?.renderTopKind ?? "FLOOR";
            const renderDir = ownerSurface?.renderDir ?? "N";
            const renderAnchorY = ownerSurface?.renderAnchorY ?? floorAnchorY;
            const renderDyOffset = ownerSurface?.renderDyOffset ?? 0;
            const zLogical = ownerSurface?.zLogical ?? Math.floor(zTo);
            const spriteId = resolveTileSpriteId({
                slot: renderTopKind === "STAIR" ? "stairApron" : "apron",
                dir: canonical.dir,
                mapSkin: resolvedMapSkin,
                mapDefaults: mapSkinDefaults,
            });

            addFace({
                id: `face_${canonical.tx}_${canonical.ty}_${canonical.dir}_${zFrom}_${zTo}_${faceId++}`,
                cls: "FACE",
                kind: renderTopKind === "STAIR" ? "STAIR_APRON" : "FLOOR_APRON",
                tx: canonical.tx,
                ty: canonical.ty,
                zFrom,
                zTo,
                zLogical,
                edgeDir: canonical.dir,
                apronKind: canonical.dir,
                apronDyOffset: 0,
                flipX: false,
                renderTopKind,
                renderDir,
                renderAnchorY,
                renderDyOffset,
                spriteId,
            });
        }
    }

    for (let i = 0; i < wallTokens.length; i++) {
        const w = wallTokens[i];
        const canonical = canonicalizeEdge(w.x, w.y, w.dir);
        const tx = canonical.tx;
        const ty = canonical.ty;
        const height = Math.max(0, w.height | 0);
        if (height <= 0) continue;

        const flipX = false;
        const segmentHeight = 2;
        const zFrom = 0;
        const zTo = height;
        const wallSlot: "wall" | "apron" | "stairApron" = w.slot ?? "wall";
        const wallAxis = canonical.dir === "E" || canonical.dir === "W" ? "E" : "S";
        const wallSpriteDir = wallSlot === "stairApron" ? "N" : wallAxis;
        const wallSkin = w.skin;
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
            addFace({
                id: `wall_${tx}_${ty}_${w.dir}_${segFrom}_${segTo}`,
                cls: "FACE",
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

    function overlaysInView(view: ViewRect): StampOverlay[] {
        const out: StampOverlay[] = [];
        for (let i = 0; i < overlays.length; i++) {
            const o = overlays[i];
            if (o.tx > view.maxTx || o.ty > view.maxTy) continue;
            if (o.tx + o.w - 1 < view.minTx || o.ty + o.h - 1 < view.minTy) continue;
            out.push(o);
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
    // Fallback: mapped bounds center.
    const fallbackSpawnTx = Math.floor(boundsCenterTx);
    const fallbackSpawnTy = Math.floor(boundsCenterTy);
    const spawnTx = (spawnTableX ?? fallbackSpawnTx) + originTx;
    const spawnTy = (spawnTableY ?? fallbackSpawnTy) + originTy;

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
        debugApronStats: undefined,
        occludersByLayer,
        occludersForLayer,
        occludersInViewForLayer,
        solidFace,
        solidFacesInView,
        overlays,
        overlaysInView,
    };
}
