// src/game/map/kenneyMapLoader.ts
import type { SemanticStamp, TableMapDef } from "../formats/table/tableMapTypes";
import { KENNEY_TILE_ANCHOR_Y } from "../../../engine/render/kenneyTiles";
import type { TriggerDef } from "../../triggers/triggerTypes";
import { resolveMapSkin, resolveSemanticSprite, type MapSkinId, MapSkinBundle } from "../../content/mapSkins";
import { resolveTileSpriteId } from "../skins/tileSpriteResolver";
import {
    BUILDING_SKINS,
    DEFAULT_BUILDING_PACK_ID,
    HEIGHT_UNIT_PX,
    resolveBuildingCandidates,
    type BuildingSkin,
    type BuildingSkinId,
} from "../../content/buildings";
import { CONTAINER_PACKS, CONTAINER_SKINS, CONTAINER_PACK_ID } from "../../content/containers";
import { requireProp } from "../../content/props";
import { RNG } from "../../util/rng";
import {getSpriteMeta} from "../../../engine/render/sprites/spriteMeta";
import { seAnchorFromTopLeft } from "../../../engine/render/sprites/structureFootprintOwnership";

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
export type RuntimeFloorTop = {
    kind: "SIDEWALK_SQUARE_128";
    spriteId: string;
    variantIndex: number;
    rotationQuarterTurns: 0 | 1 | 2 | 3;
};

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
    runtimeTop?: RuntimeFloorTop;
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
    scale?: number;
    renderTopKind: RenderTopKind;
    renderDir: StairDir;
    renderAnchorY: number;
    renderDyOffset: number;
    spriteId: string;
    /** Tile-width span for multi-tile sprites (undefined = 1). */
    tw?: number;
    /** Tile-height span for multi-tile sprites (undefined = 1). */
    th?: number;
    /** Z-levels the sprite image covers (undefined = 1). */
    zSpan?: number;
    /** Semantic render routing for face pieces. */
    layerRole?: "STRUCTURE" | "OCCLUDER";
};

export type StampOverlay = {
    id: string;
    tx: number;
    ty: number;
    w: number;
    h: number;
    /** Canonical SE anchor tile for slice ownership. */
    seTx: number;
    /** Canonical SE anchor tile for slice ownership. */
    seTy: number;
    anchorTx?: number;
    anchorTy?: number;
    z: number;
    spriteId: string;
    drawDyOffset?: number;
    drawDxOffset?: number;
    sliceOffsetPx?: { x: number; y: number };
    scale?: number;
    kind?: "ROOF" | "PROP";
    flipX?: boolean;
    /** Semantic render routing for overlay pieces. */
    layerRole?: "STRUCTURE" | "OVERLAY";
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
    facePiecesByLayer: Map<number, RenderPiece[]>;
    facePiecesForLayer(layer: number): RenderPiece[];
    facePiecesInViewForLayer(layer: number, view: ViewRect): RenderPiece[];
    solidFace(tx: number, ty: number, zLogical: number, dir: WallDir): boolean;
    solidFacesInView(view: ViewRect): SolidFaceRec[];
    overlays: StampOverlay[];
    overlaysInView(view: ViewRect): StampOverlay[];
    blockedTiles: Set<string>;
};

/** Compile a table-based map definition into a render/query-friendly map. */
export function compileKenneyMapFromTable(
    def: TableMapDef,
    options?: { runSeed?: number; mapId?: string }
): CompiledKenneyMap {
    const skinIdToUse = def.mapSkinId;
    const resolvedMapSkin = resolveMapSkin(skinIdToUse);
    const mapSkinDefaults = def.mapSkinDefaults;
    const buildingPackId = (def.buildingPackId ?? DEFAULT_BUILDING_PACK_ID).trim() || DEFAULT_BUILDING_PACK_ID;
    const runSeed = options?.runSeed ?? 0;
    const mapId = options?.mapId ?? def.id;

    const hashString = (s: string): number => {
        let hash = 0;
        for (let i = 0; i < s.length; i++) {
            hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
        }
        return hash >>> 0;
    };
    const RUNTIME_SIDEWALK_TILE_SKIN = "__RUNTIME_SIDEWALK_SQUARE_128__";

    const pickRuntimeSidewalkTop = (tx: number, ty: number): RuntimeFloorTop => {
        const variantSeed = hashString(`${runSeed}:${mapId}:${tx},${ty}:sidewalk:variant`);
        const variantIndex = (variantSeed % 6) + 1;
        const rotationQuarterTurns: 0 = 0;
        return {
            kind: "SIDEWALK_SQUARE_128",
            spriteId: `tiles/floor/sidewalk/${variantIndex}`,
            variantIndex,
            rotationQuarterTurns,
        };
    };

    // Excel/table coords are tile coords (identity mapping).

    type ParsedCell = {
        tx: number;
        ty: number;
        tile: IsoTile | null;
        walls: WallToken[];
    };

    const parsedCells: ParsedCell[] = [];
    const wallTokens: WallToken[] = [];
    const pendingTriggers: Array<{ tx: number; ty: number; id: string; type: string; radius?: number }> = [];
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
        const tx = c.x | 0;
        const ty = c.y | 0;
        const triggerType = c.triggerType;
        const triggerId = c.triggerId;
        if (triggerType) {
            const id = triggerId && triggerId.trim() ? triggerId : `trigger_${triggerType}_${tx}_${ty}`;
            pendingTriggers.push({ tx, ty, id, type: triggerType, radius: c.radius });
        }
        const parsed: { tile: IsoTile | null; walls: WallToken[] } = (() => {
            const type = (c.type ?? "floor").toLowerCase();
            const sprite = c.sprite;
            const z = c.z ?? 0;
            const parsedDir = (() => {
                const rawDir = c.dir;
                if (typeof rawDir === "string") {
                    const up = rawDir.toUpperCase();
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

            const semanticFloorSlot = (() => {
                switch (type) {
                    case "road": return "ROAD_FLOOR";
                    case "park": return "PARK_FLOOR";
                    case "sea": return "SEA_FLOOR";
                    default: return undefined;
                }
            })();
            if (type === "sidewalk") {
                return {
                    tile: {
                        kind: "FLOOR" as const,
                        h: z,
                        skin: RUNTIME_SIDEWALK_TILE_SKIN,
                    },
                    walls: [] as WallToken[],
                };
            }
            if (type === "floor" || semanticFloorSlot) {
                const semanticSprite = semanticFloorSlot ? resolveSemanticSprite(skinIdToUse, semanticFloorSlot) : "";
                const fallbackFloor = resolveTileSpriteId({
                    slot: "floor",
                    mapSkin: resolvedMapSkin,
                    mapSkinId: skinIdToUse,
                    mapDefaults: mapSkinDefaults,
                });
                const floorSprite = sprite ?? semanticSprite ?? fallbackFloor;
                return { tile: { kind: "FLOOR" as const, h: z, skin: floorSprite }, walls: [] as WallToken[] };
            }
            if (type === "spawn") {
                return { tile: { kind: "SPAWN" as const, h: z, skin: sprite }, walls: [] as WallToken[] };
            }
            if (type === "goal") {
                return { tile: { kind: "GOAL" as const, h: z, skin: sprite }, walls: [] as WallToken[] };
            }
            if (type === "stairs") {
                const stairDir = parsedDir ?? "N";
                return {
                    tile: { kind: "STAIRS" as const, h: z, dir: stairDir as StairDir, skin: sprite },
                    walls: [] as WallToken[],
                };
            }
            if (type === "wall") {
                const height = Math.max(0, (c.height ?? z) | 0);
                const dir = parsedDir ?? "S";
                const wt: WallToken = { x: 0, y: 0, height, dir, skin: sprite, slot: "wall" };
                return { tile: null, walls: [wt] };
            }
            if (type === "void") {
                return { tile: { kind: "VOID", h: 0 }, walls: [] as WallToken[] };
            }

            return { tile: null, walls: [] as WallToken[] };
        })();
        if (!parsed.tile && parsed.walls.length === 0) continue;

        if (tx < minTx) minTx = tx;
        if (tx > maxTx) maxTx = tx;
        if (ty < minTy) minTy = ty;
        if (ty > maxTy) maxTy = ty;

        if (parsed.tile) {
            const tile = parsed.tile;
            if (tile.kind === "SPAWN" && spawnTableX === null) {
                spawnTableX = tx;
                spawnTableY = ty;
                spawnH = tile.h | 0;
            }

            if (tile.kind === "GOAL" && goalTableX === null) {
                goalTableX = tx;
                goalTableY = ty;
                goalH = tile.h | 0;
            }
        }

        parsedCells.push({
            tx,
            ty,
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
        maxTx = def.w - 1;
        minTy = 0;
        maxTy = def.h - 1;
    }

    // Decide where table (0,0) lands in tile-space.
    const boundsCenterTx = (minTx + maxTx) * 0.5;
    const boundsCenterTy = (minTy + maxTy) * 0.5;
    const originTx = def.centerOnZero ? -Math.floor(boundsCenterTx) : 0;
    const originTy = def.centerOnZero ? -Math.floor(boundsCenterTy) : 0;

    const triggerDefs: TriggerDef[] = pendingTriggers.map((t) => ({
        id: t.id,
        type: t.type,
        tx: t.tx + originTx,
        ty: t.ty + originTy,
        radius: t.radius,
    }));

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
        const isRuntimeSidewalkTop = renderTopKind === "FLOOR" && tile.skin === RUNTIME_SIDEWALK_TILE_SKIN;
        const runtimeTop = isRuntimeSidewalkTop ? pickRuntimeSidewalkTop(tx, ty) : undefined;
        const tileOverride: MapSkinBundle | undefined = tile.skin && !isRuntimeSidewalkTop
            ? (renderTopKind === "STAIR" ? { stair: tile.skin } : { floor: tile.skin })
            : undefined;
        const spriteIdTop = runtimeTop
            ? runtimeTop.spriteId
            : resolveTileSpriteId({
                slot: renderTopKind === "STAIR" ? "stair" : "floor",
                dir: renderTopKind === "STAIR" ? renderDir : undefined,
                mapSkin: resolvedMapSkin,
                mapSkinId: skinIdToUse,
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
            runtimeTop,
        });
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
    const facePiecesByLayer = new Map<number, RenderPiece[]>();
    const overlays: StampOverlay[] = [];
    const blockedTiles = new Set<string>();
    const nonFlippableWarned = new Set<string>();
    const wallFaces = new Set<string>();
    const wallFaceList: SolidFaceRec[] = [];

    function addPieceToLayerMap(map: Map<number, RenderPiece[]>, piece: RenderPiece) {
        const list = map.get(piece.zLogical);
        if (list) list.push(piece);
        else map.set(piece.zLogical, [piece]);
    }

    function addSolidFace(tx: number, ty: number, zLogical: number, dir: WallDir) {
        const key = `${tx},${ty},${zLogical},${dir}`;
        if (wallFaces.has(key)) return;
        wallFaces.add(key);
        wallFaceList.push({ tx, ty, zLogical, dir });
    }


    function addSolidFaceSpan(tx: number, ty: number, zStart: number, zEnd: number, dir: WallDir) {
        const z0 = Math.min(zStart, zEnd);
        const z1 = Math.max(zStart, zEnd);
        for (let z = z0; z < z1; z += 1) {
            addSolidFace(tx, ty, z, dir);
        }
    }

    function addFace(piece: RenderPiece) {
        if (piece.kind === "WALL") addPieceToLayerMap(occludersByLayer, piece);
        else addPieceToLayerMap(facePiecesByLayer, piece);
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

    const addStampWall = (
        tx: number,
        ty: number,
        dir: WallDir,
        spriteId: string,
        zBase: number,
        height: number,
        drawDyOffset: number,
        scale: number,
    ) => {
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
            scale,
            renderTopKind: "FLOOR",
            renderDir: "N",
            renderAnchorY: floorAnchorY,
            renderDyOffset: drawDyOffset,
            spriteId,
            apronDyOffset: 0,
            flipX: false,
            layerRole: "STRUCTURE",
        });
    };

    const stampBlocksMovement = (stamp: SemanticStamp, defaultValue: boolean): boolean => {
        if (stamp.blocksMovement !== undefined) return !!stamp.blocksMovement;
        if (stamp.collision === "BLOCK") return true;
        if (stamp.collision === "PASS") return false;
        return defaultValue;
    };

    const bakeBlockedFootprint = (tx: number, ty: number, w: number, h: number): void => {
        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < h; dy++) {
                blockedTiles.add(`${tx + dx},${ty + dy}`);
            }
        }
    };

    const resolveFlippedFootprint = (w: number, h: number, isFlippable: boolean, flippedRequested: boolean) => {
        if (flippedRequested && !isFlippable) {
            const key = `${w}x${h}`;
            if (!nonFlippableWarned.has(key)) {
                nonFlippableWarned.add(key);
                // eslint-disable-next-line no-console
                console.warn(`[map] flipped=true ignored for non-flippable footprint ${key}`);
            }
        }
        const useFlipped = !!(flippedRequested && isFlippable);
        return {
            flipped: useFlipped,
            w: useFlipped ? h : w,
            h: useFlipped ? w : h,
        };
    };

    const compileBuildingStamp = (
        stamp: SemanticStamp,
        stampIndex: number,
        skinOverride?: string
    ) => {
        const sx = (stamp.x | 0) + originTx;
        const sy = (stamp.y | 0) + originTy;
        const zBase = stamp.z ?? 0;
        const w = Math.max(1, (stamp.w ?? 1) | 0);
        const h = Math.max(1, (stamp.h ?? 1) | 0);
        if (stamp.type === "building" || stamp.type === "container") {
            if (stamp.w === undefined || stamp.h === undefined) {
                throw new Error(`Building stamp at (${stamp.x},${stamp.y}) must define w/h.`);
            }
            const buildingFloorSemantic = resolveSemanticSprite(skinIdToUse, "BUILDING_FLOOR");
            const buildingFloorSprite = buildingFloorSemantic || resolveTileSpriteId({
                slot: "floor",
                mapSkin: resolvedMapSkin,
                mapSkinId: skinIdToUse,
                mapDefaults: mapSkinDefaults,
            });

            const forcedSkinId = skinOverride ?? stamp.skinId;

            if (!forcedSkinId) {
                const candidateIds = resolveBuildingCandidates(buildingPackId);
                const candidates = candidateIds
                    .map((id) => BUILDING_SKINS[id])
                    .filter((skin): skin is BuildingSkin => !!skin)
                    .flatMap((skin) => {
                        if (typeof stamp.flipped === "boolean") {
                            const oriented = resolveFlippedFootprint(skin.w, skin.h, skin.isFlippable, stamp.flipped);
                            if (oriented.w <= w && oriented.h <= h) return [{ skin, oriented }];
                            return [];
                        }

                        const fitsNormal =
                            skin.w <= w &&
                            skin.h <= h;
                        const fitsFlipped =
                            skin.isFlippable &&
                            skin.h <= w &&
                            skin.w <= h;

                        if (fitsNormal) {
                            return [{ skin, oriented: { w: skin.w, h: skin.h, flipped: false } }];
                        }
                        if (fitsFlipped) {
                            return [{ skin, oriented: { w: skin.h, h: skin.w, flipped: true } }];
                        }
                        return [];
                    })
                    .filter(({ skin }) => stamp.heightUnitsMin === undefined || skin.heightUnits >= stamp.heightUnitsMin)
                    .filter(({ skin }) => stamp.heightUnitsMax === undefined || skin.heightUnits <= stamp.heightUnitsMax);

                const occupied = new Array(w * h).fill(false);
                const placements: Array<{ x: number; y: number; w: number; h: number; skinId: string; flipped: boolean }> = [];
                const gaps: Array<{ x: number; y: number }> = [];

                if (candidates.length > 0) {
                    const seed = hashString(`${runSeed}:${mapId}:${stampIndex}:${stamp.x},${stamp.y}:${w}x${h}`);
                    const rng = new RNG(seed);

                    const fitsAt = (x0: number, y0: number, candidate: { skin: BuildingSkin; oriented: { w: number; h: number; flipped: boolean } }) => {
                        const cw = candidate.oriented.w;
                        const ch = candidate.oriented.h;
                        if (x0 + cw > w || y0 + ch > h) return false;
                        for (let dy = 0; dy < ch; dy++) {
                            for (let dx = 0; dx < cw; dx++) {
                                if (occupied[(y0 + dy) * w + (x0 + dx)]) return false;
                            }
                        }
                        return true;
                    };

                    const occupy = (x0: number, y0: number, candidate: { skin: BuildingSkin; oriented: { w: number; h: number; flipped: boolean } }) => {
                        const cw = candidate.oriented.w;
                        const ch = candidate.oriented.h;
                        for (let dy = 0; dy < ch; dy++) {
                            for (let dx = 0; dx < cw; dx++) {
                                occupied[(y0 + dy) * w + (x0 + dx)] = true;
                            }
                        }
                    };

                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            const idx = y * w + x;
                            if (occupied[idx]) continue;

                            const fitList = candidates.filter((candidate) => fitsAt(x, y, candidate));
                            if (fitList.length === 0) {
                                occupied[idx] = true;
                                gaps.push({ x, y });
                                continue;
                            }

                            const chosen = fitList[rng.int(0, fitList.length - 1)];
                            placements.push({
                                x,
                                y,
                                w: chosen.oriented.w,
                                h: chosen.oriented.h,
                                skinId: chosen.skin.id,
                                flipped: chosen.oriented.flipped,
                            });
                            occupy(x, y, chosen);
                        }
                    }
                } else {
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            gaps.push({ x, y });
                        }
                    }
                }

                for (let i = 0; i < placements.length; i++) {
                    const p = placements[i];
                    compileBuildingStamp({
                        x: stamp.x + p.x,
                        y: stamp.y + p.y,
                        z: zBase,
                        type: "building",
                        w: p.w,
                        h: p.h,
                        skinId: p.skinId,
                        flipped: p.flipped,
                        collision: stamp.collision,
                        blocksMovement: stamp.blocksMovement,
                    }, stampIndex);
                }

                if (gaps.length > 0) {
                    for (let i = 0; i < gaps.length; i++) {
                        const g = gaps[i];
                        addSurface({
                            id: `building_gap_${sx + g.x}_${sy + g.y}_${zBase}`,
                            kind: "TILE_TOP",
                            tx: sx + g.x,
                            ty: sy + g.y,
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
            const skin = BUILDING_SKINS[forcedSkinId] ?? CONTAINER_SKINS[forcedSkinId];
            if (!skin) {
                throw new Error(`[buildings] Missing skin entry for id=${forcedSkinId} (stamp (${stamp.x},${stamp.y}))`);
            }
            const oriented = resolveFlippedFootprint(skin.w, skin.h, skin.isFlippable, !!stamp.flipped);
            const placeW = oriented.w;
            const placeH = oriented.h;
            if (stamp.heightUnitsMin !== undefined && skin.heightUnits < stamp.heightUnitsMin) {
                throw new Error(`Building skin "${skin.id}" heightUnits ${skin.heightUnits} is below minimum ${stamp.heightUnitsMin}.`);
            }
            if (stamp.heightUnitsMax !== undefined && skin.heightUnits > stamp.heightUnitsMax) {
                throw new Error(`Building skin "${skin.id}" heightUnits ${skin.heightUnits} is above maximum ${stamp.heightUnitsMax}.`);
            }

            const heightUnits = skin.heightUnits | 0;
            const anchorLiftPx = (skin.anchorLiftUnits | 0) * HEIGHT_UNIT_PX;
            const wallLiftPx = ((skin.wallLiftUnits ?? 0) | 0) * HEIGHT_UNIT_PX;
            const scale = skin.spriteScale ?? 1;
            const roofLiftPx = (skin.roofLiftPx ?? (((skin.roofLiftUnits ?? 0) | 0) * HEIGHT_UNIT_PX)) * scale;
            const offsetPx = skin.offsetPx ?? { x: 0, y: 0 };
            const anchorOffsetPx = skin.anchorOffsetPx ?? { x: 0, y: 0 };
            const sliceOffsetPx = skin.slice?.offsetPx ?? { x: 0, y: 0 };

            if (skin.wallSouth.length === 0 || skin.wallEast.length === 0 || !skin.roof) {
                throw new Error(`Building skin "${skin.id}" is missing required sprites.`);
            }

            const isMonolithicSkin =
                skin.wallSouth.every((id) => id === skin.roof) &&
                skin.wallEast.every((id) => id === skin.roof);

            if (isMonolithicSkin) {
                const seAnchor = seAnchorFromTopLeft(sx, sy, placeW, placeH);
                overlays.push({
                    id: `building_${skin.id}_${sx}_${sy}_${w}x${h}`,
                    tx: sx,
                    ty: sy,
                    w: placeW,
                    h: placeH,
                    seTx: seAnchor.anchorTx,
                    seTy: seAnchor.anchorTy,
                    anchorTx: seAnchor.anchorTx,
                    anchorTy: seAnchor.anchorTy,
                    z: zBase,
                    spriteId: skin.roof,
                    drawDxOffset: offsetPx.x + anchorOffsetPx.x,
                    drawDyOffset: anchorLiftPx + offsetPx.y + anchorOffsetPx.y,
                    sliceOffsetPx,
                    flipX: oriented.flipped,
                    scale,
                    kind: "ROOF",
                    layerRole: "STRUCTURE",
                });

                for (let dx = 0; dx < placeW; dx++) {
                    for (let dy = 0; dy < placeH; dy++) {
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
                if (stampBlocksMovement(stamp, true)) bakeBlockedFootprint(sx, sy, placeW, placeH);
                return;
            }

            // South edge (bottom row)
            for (let i = 0; i < placeW; i++) {
                const spriteId = skin.wallSouth[Math.min(i, skin.wallSouth.length - 1)];
                addStampWall(
                    sx + i,
                    sy + placeH - 1,
                    "S",
                    spriteId,
                    zBase,
                    heightUnits,
                    anchorLiftPx + wallLiftPx,
                    scale
                );
            }
            // East edge (right column)
            for (let j = 0; j < placeH; j++) {
                const spriteId = skin.wallEast[Math.min(j, skin.wallEast.length - 1)];
                addStampWall(
                    sx + placeW - 1,
                    sy + j,
                    "E",
                    spriteId,
                    zBase,
                    heightUnits,
                    anchorLiftPx + wallLiftPx,
                    scale
                );
            }

            const roofAnchor = seAnchorFromTopLeft(sx, sy, placeW, placeH);
            overlays.push({
                id: `roof_${sx}_${sy}_${placeW}x${placeH}`,
                tx: sx,
                ty: sy,
                w: placeW,
                h: placeH,
                seTx: roofAnchor.anchorTx,
                seTy: roofAnchor.anchorTy,
                anchorTx: roofAnchor.anchorTx,
                anchorTy: roofAnchor.anchorTy,
                z: zBase + heightUnits,
                spriteId: skin.roof,
                drawDyOffset: anchorLiftPx + roofLiftPx + offsetPx.y + anchorOffsetPx.y,
                drawDxOffset: offsetPx.x + anchorOffsetPx.x,
                sliceOffsetPx,
                flipX: oriented.flipped,
                scale,
                kind: "ROOF",
                layerRole: "STRUCTURE",
            });

            for (let dx = 0; dx < placeW; dx++) {
                for (let dy = 0; dy < placeH; dy++) {
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
            if (stampBlocksMovement(stamp, true)) bakeBlockedFootprint(sx, sy, placeW, placeH);
            return;
        }

        const slotForType: Record<string, string> = {
            road: "ROAD_FLOOR",
            park: "PARK_FLOOR",
            sea: "SEA_FLOOR",
        };
        if (stamp.type === "sidewalk") {
            for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    const tx = sx + dx;
                    const ty = sy + dy;
                    const runtimeTop = pickRuntimeSidewalkTop(tx, ty);
                    addSurface({
                        id: `stamp_sidewalk_${tx}_${ty}_${zBase}`,
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
                        spriteIdTop: runtimeTop.spriteId,
                        runtimeTop,
                    });
                }
            }
            return;
        }
        const slot = slotForType[stamp.type];
        if (!slot) return;

        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < h; dy++) {
                const tx = sx + dx;
                const ty = sy + dy;
                const semanticSprite = resolveSemanticSprite(skinIdToUse, slot);
                const spriteIdTop = semanticSprite || resolveTileSpriteId({
                    slot: "floor",
                    dir: undefined,
                    mapSkin: resolvedMapSkin,
                    mapSkinId: skinIdToUse,
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
    };
    const compileStamp = (stamp: SemanticStamp, stampIndex: number) => {
        if (stamp.type === "container") {
            const w = stamp.w ?? 2;
            const h = stamp.h ?? 3;
            const pool = stamp.pool ?? [CONTAINER_PACK_ID];
            const flippedRequested = typeof stamp.flipped === "boolean" ? stamp.flipped : undefined;
            let chosen: BuildingSkin;
            let chosenFlipped = false;
            if (stamp.skinId) {
                const forced = CONTAINER_SKINS[stamp.skinId];
                if (!forced) {
                    throw new Error(`Container selection: unknown skinId "${stamp.skinId}".`);
                }
                if (flippedRequested !== undefined) {
                    const oriented = resolveFlippedFootprint(forced.w, forced.h, forced.isFlippable, flippedRequested);
                    if (oriented.w !== w || oriented.h !== h) {
                        throw new Error(`Container selection: forced skin "${forced.id}" with flipped=${flippedRequested} does not match stamp ${w}x${h}.`);
                    }
                    chosenFlipped = oriented.flipped;
                } else {
                    const fitsNormal = forced.w === w && forced.h === h;
                    const fitsFlipped = forced.isFlippable && forced.h === w && forced.w === h;
                    if (!fitsNormal && !fitsFlipped) {
                        throw new Error(`Container selection: forced skin "${forced.id}" does not match stamp ${w}x${h} in either orientation.`);
                    }
                    chosenFlipped = !fitsNormal && fitsFlipped;
                }
                chosen = forced;
            } else {
                const poolIds = pool.map((id) => id.trim()).filter(Boolean);
                const candidatesById = new Map<BuildingSkinId, BuildingSkin>();
                for (let i = 0; i < poolIds.length; i++) {
                    const pack = CONTAINER_PACKS[poolIds[i]];
                    if (!pack) continue;
                    for (let j = 0; j < pack.length; j++) {
                        const containerId = pack[j];
                        const skin = CONTAINER_SKINS[containerId];
                        if (skin) candidatesById.set(containerId, skin);
                    }
                }
                const candidates = Array.from(candidatesById.values())
                    .flatMap((skin) => {
                        if (flippedRequested !== undefined) {
                            const oriented = resolveFlippedFootprint(skin.w, skin.h, skin.isFlippable, flippedRequested);
                            if (oriented.w === w && oriented.h === h) {
                                return [{ skin, flipped: oriented.flipped }];
                            }
                            return [];
                        }
                        const fitsNormal = skin.w === w && skin.h === h;
                        const fitsFlipped = skin.isFlippable && skin.h === w && skin.w === h;
                        if (fitsNormal) return [{ skin, flipped: false }];
                        if (fitsFlipped) return [{ skin, flipped: true }];
                        return [];
                    })
                    .filter(({ skin }) => stamp.heightUnitsMin === undefined || skin.heightUnits >= stamp.heightUnitsMin)
                    .filter(({ skin }) => stamp.heightUnitsMax === undefined || skin.heightUnits <= stamp.heightUnitsMax)
                    .sort((a, b) => a.skin.id.localeCompare(b.skin.id));
                if (candidates.length === 0) {
                    throw new Error(`Container selection: no candidates for stamp ${w}x${h} with pool [${pool.join(", ")}].`);
                }
                const seed = hashString(`${runSeed}:${mapId}:${stampIndex}:container:${stamp.x},${stamp.y}:${w}x${h}`);
                const rng = new RNG(seed);
                const picked = candidates[rng.int(0, candidates.length - 1)] ?? candidates[0];
                chosen = picked.skin;
                chosenFlipped = picked.flipped;
            }

            const stackLevel = Math.max(0, Math.trunc(stamp.stackLevel ?? 0));
            const zStackUnits = Math.trunc(stamp.zStackUnits ?? (stackLevel * chosen.heightUnits));
            const baseStamp: SemanticStamp = {
                ...stamp,
                type: "building",
                w,
                h,
                z: (stamp.z ?? 0) + zStackUnits,
                pool,
                skinId: chosen.id,
                flipped: chosenFlipped,
            };
            compileBuildingStamp(baseStamp, stampIndex, chosen.id);

            const chance = Math.max(0, Math.min(1, stamp.stackChance ?? 0.2));
            if (chance > 0) {
                const seed = hashString(`${runSeed}:${mapId}:${stampIndex}:stack:${stamp.x},${stamp.y}`);
                const roll = (seed % 10000) / 10000;
                if (roll < chance) {
                    compileBuildingStamp(
                        { ...baseStamp, z: (stamp.z ?? 0) + chosen.heightUnits },
                        stampIndex,
                        chosen.id
                    );
                }
            }
            return;
        }
        if (stamp.type === "prop") {
            const propId = stamp.propId ?? "";
            const prop = requireProp(propId, "prop stamp");
            const propBaseW = stamp.w ?? prop.w;
            const propBaseH = stamp.h ?? prop.h;
            const propOriented = resolveFlippedFootprint(propBaseW, propBaseH, prop.isFlippable, !!stamp.flipped);
            const w = propOriented.w;
            const h = propOriented.h;
            const seAnchor = seAnchorFromTopLeft(stamp.x | 0, stamp.y | 0, w, h);
            const anchorTx = seAnchor.anchorTx;
            const anchorTy = seAnchor.anchorTy;
            const zBase = stamp.z ?? 0;
            const anchorLiftPx = (prop.anchorLiftUnits ?? 0) * HEIGHT_UNIT_PX;
            const offset = prop.anchorOffsetPx ?? { x: 0, y: 0 };

            overlays.push({
                id: `prop_${prop.id}_${anchorTx}_${anchorTy}_${zBase}`,
                tx: stamp.x | 0,
                ty: stamp.y | 0,
                w,
                h,
                seTx: anchorTx,
                seTy: anchorTy,
                anchorTx,
                anchorTy,
                z: zBase,
                spriteId: prop.sprite,
                drawDyOffset: anchorLiftPx + offset.y,
                drawDxOffset: offset.x,
                flipX: propOriented.flipped,
                scale: 1,
                kind: "PROP",
            });

            if (stampBlocksMovement(stamp, true)) {
                bakeBlockedFootprint((stamp.x | 0) + originTx, (stamp.y | 0) + originTy, w, h);
            }
            return;
        }
        if (stamp.type === "building") {
            const zStackUnits = Math.trunc(stamp.zStackUnits ?? 0);
            compileBuildingStamp(
                {
                    ...stamp,
                    z: (stamp.z ?? 0) + zStackUnits,
                },
                stampIndex
            );
            return;
        }
        compileBuildingStamp(stamp, stampIndex);
    };
    if (def.stamps && def.stamps.length > 0) {
        for (let i = 0; i < def.stamps.length; i++) {
            const s = def.stamps[i];
            compileStamp(s, i);
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
                mapSkinId: skinIdToUse,
                mapDefaults: mapSkinDefaults,
            });

            const faceMeta = getSpriteMeta(spriteId);
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
                apronKind: canonical.dir === "E" || canonical.dir === "W" ? "E" : "S",
                apronDyOffset: 0,
                flipX: false,
                renderTopKind,
                renderDir,
                renderAnchorY,
                renderDyOffset,
                spriteId,
                tw: faceMeta.tileWidth > 1 ? faceMeta.tileWidth : undefined,
                th: faceMeta.tileHeight > 1 ? faceMeta.tileHeight : undefined,
                zSpan: faceMeta.zHeight > 1 ? faceMeta.zHeight : undefined,
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
            mapSkinId: skinIdToUse,
            mapDefaults: mapSkinDefaults,
        });
        const wallMeta = getSpriteMeta(spriteId);

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
                tw: wallMeta.tileWidth > 1 ? wallMeta.tileWidth : undefined,
                th: wallMeta.tileHeight > 1 ? wallMeta.tileHeight : undefined,
                zSpan: wallMeta.zHeight > 1 ? wallMeta.zHeight : undefined,
                layerRole: "OCCLUDER",
            });
        }
    }

    function occludersForLayer(layer: number): RenderPiece[] {
        return occludersByLayer.get(layer) ?? [];
    }

    function pieceInView(piece: RenderPiece, view: ViewRect): boolean {
        const tw = piece.tw ?? 1;
        const th = piece.th ?? 1;
        return piece.tx + tw - 1 >= view.minTx
            && piece.tx <= view.maxTx
            && piece.ty + th - 1 >= view.minTy
            && piece.ty <= view.maxTy;
    }

    function occludersInViewForLayer(layer: number, view: ViewRect): RenderPiece[] {
        const list = occludersForLayer(layer);
        if (list.length === 0) return [];
        const out: RenderPiece[] = [];
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (p.tx < view.minTx || p.tx > view.maxTx) continue;
            if (p.ty < view.minTy || p.ty > view.maxTy) continue;
            out.push(p);
        }
        return out;
    }

    function facePiecesForLayer(layer: number): RenderPiece[] {
        return facePiecesByLayer.get(layer) ?? [];
    }

    function facePiecesInViewForLayer(layer: number, view: ViewRect): RenderPiece[] {
        const list = facePiecesForLayer(layer);
        if (list.length === 0) return [];
        const out: RenderPiece[] = [];
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (p.tx < view.minTx || p.tx > view.maxTx) continue;
            if (p.ty < view.minTy || p.ty > view.maxTy) continue;
            out.push(p);
        }
        return out;
    }

    function overlaysInView(view: ViewRect): StampOverlay[] {
        const out: StampOverlay[] = [];
        for (let i = 0; i < overlays.length; i++) {
            const o = overlays[i];
            const minTx = o.tx;
            const minTy = o.ty;
            const maxTx = o.tx + o.w - 1;
            const maxTy = o.ty + o.h - 1;
            if (maxTx < view.minTx || minTx > view.maxTx) continue;
            if (maxTy < view.minTy || minTy > view.maxTy) continue;
            out.push(o);
        }
        return out;
    }

    function solidFace(tx: number, ty: number, zLogical: number, dir: WallDir): boolean {
        return wallFaces.has(`${tx},${ty},${zLogical},${dir}`);
    }

    function solidFacesInView(view: ViewRect): SolidFaceRec[] {
        const out: SolidFaceRec[] = [];
        for (let i = 0; i < wallFaceList.length; i++) {
            const f = wallFaceList[i];
            if (f.tx < view.minTx || f.tx > view.maxTx) continue;
            if (f.ty < view.minTy || f.ty > view.maxTy) continue;
            out.push(f);
        }
        return out;
    }

    const compiled: CompiledKenneyMap = {
        id: def.id,
        originTx,
        originTy,
        width: def.w,
        height: def.h,

        spawnTx: (spawnTableX ?? 0) + originTx,
        spawnTy: (spawnTableY ?? 0) + originTy,
        spawnH: spawnH | 0,

        goalTx: goalTableX === null ? null : goalTableX + originTx,
        goalTy: goalTableY === null ? null : goalTableY + originTy,
        goalH: goalH | 0,

        triggerDefs,

        getTile,
        surfacesByKey,
        surfacesAtXY,
        topsByLayer,
        occludersByLayer,
        occludersForLayer,
        occludersInViewForLayer,
        facePiecesByLayer,
        facePiecesForLayer,
        facePiecesInViewForLayer,
        solidFace,
        solidFacesInView,
        overlays,
        overlaysInView,
        blockedTiles,
    };

    const getTileWithRunResolver = (tx: number, ty: number): IsoTile => {
        return getTile(tx, ty);
    };

    (compiled as any).getTileWithRunResolver = getTileWithRunResolver;

    return compiled;
}
