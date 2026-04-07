// src/game/map/kenneyMapLoader.ts
import type {
    SemanticStamp,
    TableMapDef,
    TableMapLightColorMode,
    TableMapLightStrength,
} from "../formats/table/tableMapTypes";
import { KENNEY_TILE_ANCHOR_Y, KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import type { TriggerDef } from "../../triggers/triggerTypes";
import { resolveMapSkin, resolveSemanticSprite, type MapSkinId, MapSkinBundle } from "../../content/mapSkins";
import { resolveTileSpriteId } from "../skins/tileSpriteResolver";
import { TILE_ID_OCEAN } from "../../world/semanticFields";
import {
    BUILDING_PACKS,
    BUILDING_SKINS,
    DEFAULT_BUILDING_PACK_ID,
    HEIGHT_UNIT_PX,
    resolveBuildingCandidates,
    type BuildingSkin,
} from "../../content/buildings";
import { requireProp, resolvePropSprite } from "../../content/props";
import { RNG } from "../../util/rng";
import {getSpriteMeta} from "../../../engine/render/sprites/spriteMeta";
import { seAnchorFromTopLeft } from "../../../engine/render/sprites/structureFootprintOwnership";
import { getFloorVariantCount } from "../../content/runtimeFloorConfig";
import {
    getDecalSpriteId,
    getDecalVariantCount,
    type RuntimeDecalSetId,
} from "../../content/runtimeDecalConfig";
import { buildRoadMarkingsPipeline } from "../../roads/markings/roadMarkingsPipeline";
import { resolveMarkingSprite } from "../../roads/markings/markingSpriteResolver";
import type { MarkingPiece, RoadBand, RoadContext } from "../../roads/markings/types";
import {
    beginLoadProfilerSubphase,
    LOAD_PROFILER_SUBPHASE,
    runWithLoadProfilerSubphase,
} from "../../app/loadingFlow";
import {
    assertMonolithicBuildingSemanticPrepassComplete,
    collectRequiredMonolithicBuildingSkinIdsForMap,
    getRequiredMonolithicBuildingPlacementGeometryForSprite,
} from "../../structures/monolithicBuildingSemanticPrepass";
import type { TileHeightGrid } from "../tileHeightUnits";
import { renderHeightUnitsToSweepTileHeight } from "../tileHeightUnits";

export type IsoTileKind = "VOID" | "FLOOR" | "STAIRS" | "SPAWN" | "GOAL" | typeof TILE_ID_OCEAN;
export type StairDir = "N" | "E" | "S" | "W";
export type WallDir = "N" | "E" | "S" | "W";
type BuildingDir = "N" | "E" | "S" | "W";
type BuildingAxis = "NS" | "EW";

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
    kind: "SQUARE_128_RUNTIME";
    family: "sidewalk" | "asphalt" | "park";
    spriteId: string;
    variantIndex: number;
    rotationQuarterTurns: 0 | 1 | 2 | 3;
};
export type DecalPiece = {
    id: string;
    tx: number;
    ty: number;
    zBase: number;
    zLogical: number;
    setId: RuntimeDecalSetId;
    spriteId: string;
    variantIndex: number;
    semanticType: "sidewalk" | "road" | "asphalt";
    renderAnchorY: number;
    rotationQuarterTurns: 0 | 1 | 2 | 3;
};
export type LightShape = "RADIAL" | "STREET_LAMP";
export type LightFlicker =
    | { kind: "NONE" }
    | { kind: "NOISE"; speed?: number; amount?: number }
    | { kind: "PULSE"; speed?: number; amount?: number };
export type LightColorMode = TableMapLightColorMode;
export type LightStrength = TableMapLightStrength;
export type LightDef = {
    id: string;
    worldX: number;
    worldY: number;
    zBase: number;
    zLogical: number;
    supportHeightUnits?: number;
    heightUnits: number;
    poolHeightOffsetUnits?: number;
    screenOffsetPx?: { x: number; y: number };
    intensity: number;
    radiusPx: number;
    colorMode: LightColorMode;
    strength: LightStrength;
    color?: string;
    tintStrength?: number;
    shape?: LightShape;
    pool?: {
        radiusPx: number;
        yScale?: number;
    };
    cone?: {
        dirRad: number;
        angleRad: number;
        lengthPx: number;
    };
    flicker?: LightFlicker;
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
    zVisualOffsetUnits?: number;
    spriteId: string;
    drawDyOffset?: number;
    drawDxOffset?: number;
    sliceOffsetPx?: { x: number; y: number };
    sliceOriginPx?: { x: number; y: number };
    scale?: number;
    kind?: "ROOF" | "PROP";
    flipX?: boolean;
    monolithicSemanticSkinId?: string;
    monolithicSemanticSpriteId?: string;
    resolvedStructuralRoofHeightUnits?: number;
    applyResolvedStructuralRoofHeightUnits?: (heightUnits: number) => void;
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

export type OcclusionClass = "SURFACE" | "VOLUMETRIC";
export type OcclusionChunkKey = string;
export type OcclusionGeomRect = {
    tx0: number;
    ty0: number;
    tx1: number;
    ty1: number;
    z: number;
    cls: OcclusionClass;
};
export type OcclusionChunkBucket = {
    chunkX: number;
    chunkY: number;
    entries: OcclusionGeomRect[];
};
export type CompiledOcclusionGeometry = {
    chunkSize: number;
    byBandAndClass: Map<number, {
        surface: Map<OcclusionChunkKey, OcclusionChunkBucket>;
        volumetric: Map<OcclusionChunkKey, OcclusionChunkBucket>;
    }>;
    availableBands: number[];
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
    lightDefs: LightDef[];

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
    decals: DecalPiece[];
    decalsInView(view: ViewRect): DecalPiece[];
    blockedTiles: Set<string>;
    blockedTileSpansByKey: Map<string, Array<{ zFrom: number; zTo: number }>>;
    tileHeightGrid: TileHeightGrid;
    roadMarkingContext: RoadContext;
    roadMarkings: MarkingPiece[];
    roadAreaMaskWorld: Uint8Array;
    roadAreaWidthWorld: Uint8Array;
    roadCenterMaskHWorld: Uint8Array;
    roadCenterWidthHWorld: Uint8Array;
    roadCenterMaskVWorld: Uint8Array;
    roadCenterWidthVWorld: Uint8Array;
    roadCenterMaskWorld: Uint8Array;
    roadCenterWidthWorld: Uint8Array;
    roadIntersectionMaskWorld: Uint8Array;
    roadCrossingMaskWorld: Uint8Array;
    roadCrossingDirWorld: Uint8Array;
    roadStopMaskWorld: Uint8Array;
    roadStopDirWorld: Uint8Array;
    roadIntersectionCenterTilesWorld: Array<{ tx: number; ty: number }>;
    roadIntersectionBoundsWorld: Array<{ minX: number; maxX: number; minY: number; maxY: number }>;
    roadIntersectionSeedsWorld: Array<{ tx: number; ty: number }>;
    roadIntersectionClusterCentersWorld: Array<{ worldX: number; worldY: number }>;
    roadSemanticRects: Array<{
        x: number;
        y: number;
        z: number;
        w: number;
        h: number;
        semantic?: string;
        dir?: "N" | "E" | "S" | "W";
        startHeight?: number;
        targetHeight?: number;
    }>;
    occlusionGeometry: CompiledOcclusionGeometry;
    isRoadWorld(x: number, y: number): boolean;
};

function normalizeSkinId(raw: string | undefined): string | undefined {
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    return trimmed
        .replace(/\s*_\s*/g, "_")
        .replace(/\s*\/\s*/g, "/");
}

type RoadRect = {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    semantic?: string;
    dir?: "N" | "E" | "S" | "W";
    startHeight?: number;
    targetHeight?: number;
};
type AuthRoadRect = RoadRect & { orient: "H" | "V"; roadDir?: "N" | "E" | "S" | "W" };

function resolveRoadDirFromSemantic(semantic?: string, dir?: "N" | "E" | "S" | "W"): "N" | "E" | "S" | "W" | undefined {
    const fromDir = dir?.toUpperCase();
    if (fromDir === "N" || fromDir === "E" || fromDir === "S" || fromDir === "W") return fromDir;
    if (!semantic) return undefined;
    const s = semantic.trim().toLowerCase();
    if (!s) return undefined;
    if (s === "n" || s.includes("north")) return "N";
    if (s === "e" || s.includes("east")) return "E";
    if (s === "s" || s.includes("south")) return "S";
    if (s === "w" || s.includes("west")) return "W";
    if (s.endsWith("_n") || s.endsWith(":n")) return "N";
    if (s.endsWith("_e") || s.endsWith(":e")) return "E";
    if (s.endsWith("_s") || s.endsWith(":s")) return "S";
    if (s.endsWith("_w") || s.endsWith(":w")) return "W";
    return undefined;
}

function normalizeBuildingDir(dir?: string): BuildingDir | undefined {
    if (dir === undefined) return undefined;
    const up = dir.trim().toUpperCase();
    if (up === "N" || up === "E" || up === "S" || up === "W") return up;
    if (up === "NE" || up === "NW" || up === "SE" || up === "SW") {
        throw new Error(`[buildings] Unsupported diagonal dir "${dir}". Use N/E/S/W.`);
    }
    throw new Error(`[buildings] Invalid dir "${dir}". Use N/E/S/W.`);
}

function directionSuffix(dir: BuildingDir): "n" | "e" | "s" | "w" {
    if (dir === "N") return "n";
    if (dir === "E") return "e";
    if (dir === "S") return "s";
    return "w";
}

function hasDirectionalVariants(baseId: string): boolean {
    return baseId.endsWith("/images");
}

function resolveBuildingSpriteId(baseId: string, dir?: BuildingDir): string {
    if (!dir) {
        return hasDirectionalVariants(baseId) ? `${baseId}/s` : baseId;
    }
    return hasDirectionalVariants(baseId) ? `${baseId}/${directionSuffix(dir)}` : `${baseId}/${directionSuffix(dir)}`;
}

function axisForBuildingDir(dir: BuildingDir): BuildingAxis {
    return dir === "N" || dir === "S" ? "NS" : "EW";
}

function orientBuildingFootprintByDir(
    w: number,
    h: number,
    defaultFacing: "E" | "S" | undefined,
    dir?: BuildingDir,
): { w: number; h: number } {
    if (!dir) return { w, h };
    const baseAxis: BuildingAxis = (defaultFacing ?? "S") === "E" ? "EW" : "NS";
    const targetAxis = axisForBuildingDir(dir);
    if (baseAxis === targetAxis) return { w, h };
    return { w: h, h: w };
}

function mergeRoadRectsPreserveOrient(rects: AuthRoadRect[]): AuthRoadRect[] {
    const out = rects.map((r) => ({
        x: r.x | 0,
        y: r.y | 0,
        z: r.z | 0,
        w: Math.max(1, r.w | 0),
        h: Math.max(1, r.h | 0),
        orient: r.orient,
        semantic: r.semantic,
        dir: r.dir,
        roadDir: r.roadDir,
        startHeight: r.startHeight,
        targetHeight: r.targetHeight,
    }));
    let changed = true;
    while (changed) {
        changed = false;
        outer: for (let i = 0; i < out.length; i++) {
            for (let j = i + 1; j < out.length; j++) {
                const a = out[i];
                const b = out[j];
                if (a.orient !== b.orient) continue;
                if ((a.roadDir ?? "") !== (b.roadDir ?? "")) continue;
                if ((a.semantic ?? "") !== (b.semantic ?? "")) continue;
                if ((a.z | 0) !== (b.z | 0)) continue;
                if ((a.startHeight ?? 0) !== (b.startHeight ?? 0)) continue;
                if ((a.targetHeight ?? 0) !== (b.targetHeight ?? 0)) continue;
                if (a.orient === "H") {
                    if (a.x !== b.x || a.w !== b.w) continue;
                    if (a.y + a.h !== b.y && b.y + b.h !== a.y) continue;
                    const y0 = Math.min(a.y, b.y);
                    out[i] = {
                        x: a.x,
                        y: y0,
                        z: a.z | 0,
                        w: a.w,
                        h: a.h + b.h,
                        orient: "H",
                        semantic: a.semantic,
                        dir: a.dir,
                        roadDir: a.roadDir,
                        startHeight: a.startHeight,
                        targetHeight: a.targetHeight,
                    };
                    out.splice(j, 1);
                    changed = true;
                    break outer;
                }
                if (a.y !== b.y || a.h !== b.h) continue;
                if (a.x + a.w !== b.x && b.x + b.w !== a.x) continue;
                const x0 = Math.min(a.x, b.x);
                out[i] = {
                    x: x0,
                    y: a.y,
                    z: a.z | 0,
                    w: a.w + b.w,
                    h: a.h,
                    orient: "V",
                    semantic: a.semantic,
                    dir: a.dir,
                    roadDir: a.roadDir,
                    startHeight: a.startHeight,
                    targetHeight: a.targetHeight,
                };
                out.splice(j, 1);
                changed = true;
                break outer;
            }
        }
    }
    return out;
}

/** Compile a table-based map definition into a render/query-friendly map. */
export function compileKenneyMapFromTable(
    def: TableMapDef,
    options?: { runSeed?: number; mapId?: string }
): CompiledKenneyMap {
    const skinIdToUse = def.mapSkinId;
    const resolvedMapSkin = resolveMapSkin(skinIdToUse);
    const mapSkinDefaults = def.mapSkinDefaults;
    const buildingPackId = normalizeSkinId(def.buildingPackId) ?? DEFAULT_BUILDING_PACK_ID;
    const runSeed = options?.runSeed ?? 0;
    const mapId = options?.mapId ?? def.id;
    const requiredBuildingSkinIds = collectRequiredMonolithicBuildingSkinIdsForMap(def);
    assertMonolithicBuildingSemanticPrepassComplete(
        `compileKenneyMapFromTable:${mapId}`,
        requiredBuildingSkinIds,
    );

    const hashString = (s: string): number => {
        let hash = 0;
        for (let i = 0; i < s.length; i++) {
            hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
        }
        return hash >>> 0;
    };
    const INHERIT_DOMINANT_FLOOR_SKIN = "__INHERIT_DOMINANT_FLOOR__";
    const RUNTIME_TILE_SKIN_PREFIX = "__RUNTIME_SQUARE_128__";
    const runtimeTileSkin = (family: RuntimeFloorTop["family"]) => `${RUNTIME_TILE_SKIN_PREFIX}${family}`;
    type HeightStampRec = {
        tx: number;
        ty: number;
        w: number;
        h: number;
        topZ: number;
        baseSweepZ?: number;
        overlay?: StampOverlay;
    };

    const pickRuntimeSquareTop = (family: RuntimeFloorTop["family"], tx: number, ty: number): RuntimeFloorTop => {
        const variantCount = getFloorVariantCount(family);
        const variantSeed = hashString(`${runSeed}:${mapId}:${tx},${ty}:${family}:variant`);
        const variantIndex = (variantSeed % variantCount) + 1;
        const rotationQuarterTurns: 0 | 1 | 2 | 3 = family === "asphalt"
            ? ((hashString(`${runSeed}:${mapId}:${tx},${ty}:${family}:rot`) % 4) as 0 | 1 | 2 | 3)
            : 0;
        return {
            kind: "SQUARE_128_RUNTIME",
            family,
            spriteId: `tiles/floor/${family}/${variantIndex}`,
            variantIndex,
            rotationQuarterTurns,
        };
    };
    const heightStampRecs: HeightStampRec[] = [];
    const recordHeightStamp = (
        tx: number,
        ty: number,
        w: number,
        h: number,
        topZ: number,
        input?: {
            baseSweepZ?: number;
            overlay?: StampOverlay;
        },
    ): void => {
        if (!Number.isFinite(topZ)) return;
        heightStampRecs.push({
            tx: tx | 0,
            ty: ty | 0,
            w: Math.max(1, w | 0),
            h: Math.max(1, h | 0),
            topZ,
            baseSweepZ: input?.baseSweepZ,
            overlay: input?.overlay,
        });
    };
    const hashHeightGrid = (
        heights: Float32Array,
        width: number,
        height: number,
        gridOriginTx: number,
        gridOriginTy: number,
    ): string => {
        let hash = 2166136261;
        const mix = (value: number) => {
            hash ^= value | 0;
            hash = Math.imul(hash, 16777619);
        };
        mix(width);
        mix(height);
        mix(gridOriginTx);
        mix(gridOriginTy);
        for (let i = 0; i < heights.length; i++) {
            mix(Math.round(heights[i] * 1024));
        }
        return `h${(hash >>> 0).toString(16)}`;
    };
    let tileHeightGrid: TileHeightGrid;
    const resolveHeightStampTopZ = (stamp: HeightStampRec): number => {
        const resolvedStructuralRoofHeightUnits = stamp.overlay?.resolvedStructuralRoofHeightUnits;
        if (
            Number.isFinite(resolvedStructuralRoofHeightUnits)
            && resolvedStructuralRoofHeightUnits !== undefined
            && Number.isFinite(stamp.baseSweepZ)
        ) {
            return (stamp.baseSweepZ ?? 0) + resolvedStructuralRoofHeightUnits;
        }
        return stamp.topZ;
    };
    const buildTileHeightGrid = (): TileHeightGrid => {
        const w = def.w;
        const h = def.h;
        const heights = new Float32Array(w * h);
        for (let ty = 0; ty < h; ty++) {
            for (let tx = 0; tx < w; tx++) {
                const atx = tx + originTx;
                const aty = ty + originTy;
                const tile = getTile(atx, aty);
                heights[ty * w + tx] = renderHeightUnitsToSweepTileHeight(tile.h);
            }
        }
        for (let i = 0; i < heightStampRecs.length; i++) {
            const stamp = heightStampRecs[i];
            const topZ = resolveHeightStampTopZ(stamp);
            for (let dy = 0; dy < stamp.h; dy++) {
                for (let dx = 0; dx < stamp.w; dx++) {
                    const lx = stamp.tx + dx - originTx;
                    const ly = stamp.ty + dy - originTy;
                    if (lx < 0 || ly < 0 || lx >= w || ly >= h) continue;
                    const idx = ly * w + lx;
                    if (topZ > heights[idx]) heights[idx] = topZ;
                }
            }
        }
        return {
            originTx,
            originTy,
            width: w,
            height: h,
            version: hashHeightGrid(heights, w, h, originTx, originTy),
            heights,
        };
    };
    const refreshTileHeightGrid = (): void => {
        const nextGrid = buildTileHeightGrid();
        tileHeightGrid.originTx = nextGrid.originTx;
        tileHeightGrid.originTy = nextGrid.originTy;
        tileHeightGrid.width = nextGrid.width;
        tileHeightGrid.height = nextGrid.height;
        tileHeightGrid.version = nextGrid.version;
        tileHeightGrid.heights = nextGrid.heights;
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
    let originTx = 0;
    let originTy = 0;
    let triggerDefs: TriggerDef[] = [];

    const endSourceMapReadOrParse = beginLoadProfilerSubphase(
        LOAD_PROFILER_SUBPHASE.SOURCE_MAP_READ_OR_PARSE,
    );
    try {
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

                const runtimeSquareFamily = (() => {
                    switch (type) {
                        case "sidewalk": return "sidewalk" as const;
                        case "road": return "asphalt" as const;
                        case "asphalt": return "asphalt" as const;
                        case "park": return "park" as const;
                        default: return undefined;
                    }
                })();
                if (runtimeSquareFamily) {
                    return {
                        tile: {
                            kind: "FLOOR" as const,
                            h: z,
                            skin: runtimeTileSkin(runtimeSquareFamily),
                        },
                        walls: [] as WallToken[],
                    };
                }
                if (type === "interact_shop" || type === "interact_rest" || type === "npc_vendor" || type === "npc_healer") {
                    return {
                        tile: {
                            kind: "FLOOR" as const,
                            h: z,
                            skin: INHERIT_DOMINANT_FLOOR_SKIN,
                        },
                        walls: [] as WallToken[],
                    };
                }
                const semanticFloorSlot = (() => {
                    switch (type) {
                        case "sea": return "SEA_FLOOR";
                        default: return undefined;
                    }
                })();
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
                if (type === "water" || type === "ocean") {
                    return {
                        tile: {
                            kind: TILE_ID_OCEAN,
                            h: z,
                            skin: sprite ?? "tiles/animated/water1/1",
                        },
                        walls: [] as WallToken[],
                    };
                }
                if (type === "spawn") {
                    const fallbackFloor = resolveTileSpriteId({
                        slot: "floor",
                        mapSkin: resolvedMapSkin,
                        mapSkinId: skinIdToUse,
                        mapDefaults: mapSkinDefaults,
                    });
                    const spawnSprite = sprite ?? fallbackFloor;
                    return { tile: { kind: "SPAWN" as const, h: z, skin: spawnSprite }, walls: [] as WallToken[] };
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
        originTx = def.centerOnZero ? -Math.floor(boundsCenterTx) : 0;
        originTy = def.centerOnZero ? -Math.floor(boundsCenterTy) : 0;

        triggerDefs = pendingTriggers.map((t) => ({
            id: t.id,
            type: t.type,
            tx: t.tx + originTx,
            ty: t.ty + originTy,
            radius: t.radius,
        }));
    } finally {
        endSourceMapReadOrParse();
    }
    const streetLampPreset = (_semanticType: "street_lamp_n" | "street_lamp_e" | "street_lamp_s" | "street_lamp_w") => {
        return {
            shape: "STREET_LAMP" as const,
            color: "#FFFB74",
            tintStrength: 0.40,
            pool: { radiusPx: 120, yScale: 0.65 },
            cone: { dirRad: Math.PI * 0.5, angleRad: 0.9, lengthPx: 260 },
        };
    };
    const lampPostPreset = () => {
        return {
            spriteId: "light/lamp_post",
            drawDxOffset: 0,
            drawDyOffset: 0,
            groundPool: {
                shape: "RADIAL" as const,
                color: "#FFFB74",
                tintStrength: 0.32,
                radiusPx: 108,
                intensity: 0.58,
                heightUnits: 0,
            },
            topGlow: {
                shape: "RADIAL" as const,
                color: "#FFFB74",
                tintStrength: 0.46,
                radiusPx: 34,
                intensity: 0.95,
                heightUnits: 10,
            },
        };
    };
    const neonPreset = (semanticType: "neon_sign_pink" | "neon_sign_blue" | "neon_sign_green") => {
        const byType: Record<typeof semanticType, { color: string; radiusPx: number; intensity: number; tintStrength: number }> = {
            neon_sign_pink: { color: "#FF4FD8", radiusPx: 220, intensity: 0.75, tintStrength: 0.70 },
            neon_sign_blue: { color: "#4FA8FF", radiusPx: 210, intensity: 0.72, tintStrength: 0.68 },
            neon_sign_green: { color: "#55FF8C", radiusPx: 200, intensity: 0.70, tintStrength: 0.66 },
        };
        return {
            shape: "RADIAL" as const,
            flicker: { kind: "NOISE" as const, speed: 9, amount: 0.25 },
            ...byType[semanticType],
        };
    };
    const normalizeLightColorMode = (value: unknown): LightColorMode =>
        value === "off" || value === "palette" ? value : "standard";
    const normalizeLightStrength = (value: unknown): LightStrength =>
        value === "low" || value === "high" ? value : "medium";
    const resolveLightSortZ = (supportHeightUnits: number | undefined, heightUnits: number): { zBase: number; zLogical: number } => {
        const support = Number.isFinite(supportHeightUnits) ? (supportHeightUnits as number) : heightUnits;
        const zBase = support;
        const zLogical = Math.floor(zBase + 1e-3);
        return { zBase, zLogical };
    };
    let lightDefs: LightDef[] = [];
    const endShadowOrLightPrecompute = beginLoadProfilerSubphase(
        LOAD_PROFILER_SUBPHASE.SHADOW_OR_LIGHT_PRECOMPUTE,
    );
    try {
        lightDefs = (def.lights ?? []).map((light, lightIndex) => {
            const semanticPreset: Partial<Pick<LightDef, "shape" | "color" | "tintStrength" | "pool" | "cone" | "radiusPx" | "intensity" | "flicker">> = (() => {
                const t = light.semanticType;
                if (!t) return {};
                if (t === "street_lamp_n" || t === "street_lamp_e" || t === "street_lamp_s" || t === "street_lamp_w") {
                    return streetLampPreset(t);
                }
                if (t === "neon_sign_pink" || t === "neon_sign_blue" || t === "neon_sign_green") {
                    return neonPreset(t);
                }
                return {};
            })();
            const isStreetLampSemantic =
                light.semanticType === "street_lamp_n"
                || light.semanticType === "street_lamp_e"
                || light.semanticType === "street_lamp_s"
                || light.semanticType === "street_lamp_w";
            const supportHeightUnits = light.heightUnits ?? 0;
            const heightUnits = light.heightUnits ?? 0;
            const { zBase, zLogical } = resolveLightSortZ(supportHeightUnits, heightUnits);
            return {
                id: `authored_light_${mapId}_${lightIndex}`,
                worldX: (light.x + originTx + (isStreetLampSemantic ? 0 : 0.5)) * KENNEY_TILE_WORLD,
                worldY: (light.y + originTy + (isStreetLampSemantic ? 0 : 0.5)) * KENNEY_TILE_WORLD,
                zBase,
                zLogical,
                supportHeightUnits,
                heightUnits,
                poolHeightOffsetUnits: light.poolHeightOffsetUnits ?? 0,
                intensity: semanticPreset?.intensity ?? light.intensity,
                radiusPx: semanticPreset?.radiusPx ?? light.radiusPx,
                colorMode: normalizeLightColorMode(light.colorMode),
                strength: normalizeLightStrength(light.strength),
                color: light.color ?? semanticPreset?.color,
                tintStrength: light.tintStrength ?? semanticPreset?.tintStrength,
                shape: light.shape ?? semanticPreset?.shape ?? "RADIAL",
                pool: light.pool ?? semanticPreset?.pool,
                cone: light.cone ?? semanticPreset?.cone,
                flicker: light.flicker ?? semanticPreset?.flicker ?? { kind: "NONE" },
            };
        });
    } finally {
        endShadowOrLightPrecompute();
    }

    const placed = new Map<string, IsoTile>();
    const placedStacks = new Map<string, IsoTile[]>();
    const setPlacedTile = (tx: number, ty: number, tile: IsoTile) => {
        const key = `${tx},${ty}`;
        const stack = placedStacks.get(key);
        if (stack) stack.push(tile);
        else placedStacks.set(key, [tile]);
        const current = placed.get(key);
        if (!current) {
            placed.set(key, tile);
            return;
        }
        if (current.kind === "VOID" && tile.kind !== "VOID") {
            placed.set(key, tile);
            return;
        }
        if (tile.kind !== "VOID" && (tile.h | 0) >= (current.h | 0)) {
            placed.set(key, tile);
        }
    };

    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (let i = 0; i < parsedCells.length; i++) {
            const cell = parsedCells[i];
            const tx = cell.tx + originTx;
            const ty = cell.ty + originTy;
            const tile = cell.tile;
            if (tile) setPlacedTile(tx, ty, tile);

            if (cell.walls.length > 0) {
                for (let j = 0; j < cell.walls.length; j++) {
                    wallTokens.push({ ...cell.walls[j], x: tx, y: ty });
                }
            }
        }
    });

    const isRampSemantic = (semantic?: string): boolean => {
        if (!semantic) return false;
        const s = semantic.trim().toLowerCase();
        return s === "ramp" || s.startsWith("ramp_");
    };
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        if (def.roadSemanticRects && def.roadSemanticRects.length > 0) {
            for (let i = 0; i < def.roadSemanticRects.length; i++) {
                const rect = def.roadSemanticRects[i];
                if (!isRampSemantic(rect.semantic)) continue;
                const dir = rect.dir;
                if (dir !== "N" && dir !== "E" && dir !== "S" && dir !== "W") continue;
                const minX = (rect.x | 0) + originTx;
                const minY = (rect.y | 0) + originTy;
                const w = Math.max(1, (rect.w ?? 1) | 0);
                const h = Math.max(1, (rect.h ?? 1) | 0);
                const maxX = minX + w - 1;
                const maxY = minY + h - 1;
                const axisLen = dir === "N" || dir === "S" ? h : w;
                const sampleStartX = dir === "E" ? minX : dir === "W" ? maxX : minX;
                const sampleStartY = dir === "S" ? minY : dir === "N" ? maxY : minY;
                const sampledStart = placed.get(`${sampleStartX},${sampleStartY}`)?.h ?? 0;
                const startH = Number.isFinite(rect.startHeight) ? (rect.startHeight as number) : sampledStart;
                const targetH = Number.isFinite(rect.targetHeight) ? (rect.targetHeight as number) : startH;
                const deltaH = targetH - startH;

                for (let y = minY; y <= maxY; y++) {
                    for (let x = minX; x <= maxX; x++) {
                        const key = `${x},${y}`;
                        const stack = placedStacks.get(key);
                        const tile = stack && stack.length > 0
                            ? (() => {
                                const targetZ = Number.isFinite(rect.z) ? ((rect.z as number) | 0) : null;
                                if (targetZ !== null) {
                                    for (let si = 0; si < stack.length; si++) {
                                        const cand = stack[si];
                                        if (cand.kind === "VOID") continue;
                                        if ((cand.h | 0) === targetZ) return cand;
                                    }
                                }
                                const top = placed.get(key);
                                return top && top.kind !== "VOID" ? top : null;
                            })()
                            : null;
                        if (!tile) continue;
                        const axisIndex = (() => {
                            if (dir === "N") return maxY - y;
                            if (dir === "S") return y - minY;
                            if (dir === "E") return x - minX;
                            return maxX - x;
                        })();
                        const stepped = axisLen <= 0
                            ? targetH
                            : (() => {
                                // Quantize monotonically across tile slots to avoid mid-ramp 2-step jumps.
                                const numer = deltaH * (axisIndex + 1);
                                if (deltaH >= 0) return startH + Math.floor(numer / axisLen);
                                return startH + Math.ceil(numer / axisLen);
                            })();
                        tile.h = stepped;
                    }
                }
            }
        }
    });

    // Group contiguous stair tiles into staircase runs (for render ordering).
    // Group rule: 4-neighbor connected components with matching dir.
    // Step index is based on height within the group (low->high).
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
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
    });

    function getTile(tx: number, ty: number): IsoTile {
        return placed.get(`${tx},${ty}`) ?? { kind: "VOID", h: 0 };
    }

    const worldW = def.w | 0;
    const worldH = def.h | 0;
    const roadAreaMaskWorld = new Uint8Array(worldW * worldH);
    const roadAreaWidthWorld = new Uint8Array(worldW * worldH);
    const roadCenterMaskHWorld = new Uint8Array(worldW * worldH);
    const roadCenterWidthHWorld = new Uint8Array(worldW * worldH);
    const roadCenterMaskVWorld = new Uint8Array(worldW * worldH);
    const roadCenterWidthVWorld = new Uint8Array(worldW * worldH);
    const roadCenterMaskWorld = new Uint8Array(worldW * worldH);
    const roadCenterWidthWorld = new Uint8Array(worldW * worldH);
    const roadIntersectionMaskWorld = new Uint8Array(worldW * worldH);
    const roadCrossingMaskWorld = new Uint8Array(worldW * worldH);
    const roadCrossingDirWorld = new Uint8Array(worldW * worldH);
    const roadStopMaskWorld = new Uint8Array(worldW * worldH);
    const roadStopDirWorld = new Uint8Array(worldW * worldH);
    const roadIntersectionCenterTilesWorld: Array<{ tx: number; ty: number }> = [];
    const roadIntersectionBoundsWorld: Array<{ minX: number; maxX: number; minY: number; maxY: number }> = [];
    const roadIntersectionHeightsWorld: number[] = [];
    const roadIntersectionSeedsWorld: Array<{ tx: number; ty: number }> = [];
    const roadIntersectionClusterCentersWorld: Array<{ worldX: number; worldY: number }> = [];
    const ROAD_DIR_NONE = 0;
    const ROAD_DIR_N = 1;
    const ROAD_DIR_E = 2;
    const ROAD_DIR_S = 3;
    const ROAD_DIR_W = 4;
    const worldMaxTx = originTx + worldW - 1;
    const worldMaxTy = originTy + worldH - 1;
    const worldIndex = (txWorld: number, tyWorld: number): number => {
        const lx = txWorld - originTx;
        const ly = tyWorld - originTy;
        return ly * worldW + lx;
    };
    const worldInBounds = (txWorld: number, tyWorld: number): boolean => {
        return txWorld >= originTx && txWorld <= worldMaxTx && tyWorld >= originTy && tyWorld <= worldMaxTy;
    };
    const centerHByZ = new Map<number, Uint8Array>();
    const centerVByZ = new Map<number, Uint8Array>();
    const roadAreaByZ = new Map<number, Uint8Array>();
    const layerMask = (m: Map<number, Uint8Array>, z: number): Uint8Array => {
        const key = z | 0;
        const hit = m.get(key);
        if (hit) return hit;
        const created = new Uint8Array(worldW * worldH);
        m.set(key, created);
        return created;
    };
    const authRoadRects = (() => {
        const authoredRects = def.roadSemanticRects && def.roadSemanticRects.length > 0
            ? def.roadSemanticRects
            : null;
        if (authoredRects) {
            return authoredRects.map((r) => {
                const w = Math.max(1, (r.w ?? 1) | 0);
                const h = Math.max(1, (r.h ?? 1) | 0);
                const orient: "H" | "V" = w >= h ? "H" : "V";
                return {
                    x: r.x | 0,
                    y: r.y | 0,
                    z: (r.z ?? 0) | 0,
                    w,
                    h,
                    orient,
                    semantic: r.semantic,
                    dir: r.dir,
                    roadDir: resolveRoadDirFromSemantic(r.semantic, r.dir),
                    startHeight: r.startHeight,
                    targetHeight: r.targetHeight,
                };
            });
        }
        if (!def.stamps || def.stamps.length === 0) return [];
        const out: AuthRoadRect[] = [];
        for (let i = 0; i < def.stamps.length; i++) {
            const s = def.stamps[i];
            if (s.type !== "road") continue;
            const w = Math.max(1, (s.w ?? 1) | 0);
            const h = Math.max(1, (s.h ?? 1) | 0);
            const orient: "H" | "V" = w >= h ? "H" : "V";
            out.push({
                x: s.x | 0,
                y: s.y | 0,
                z: (s.z ?? 0) | 0,
                w,
                h,
                orient,
                semantic: s.semantic,
                roadDir: resolveRoadDirFromSemantic(s.semantic, (() => {
                    const d = s.dir?.toUpperCase();
                    return d === "N" || d === "E" || d === "S" || d === "W" ? d : undefined;
                })()),
                startHeight: s.startHeight,
                targetHeight: s.targetHeight,
            });
        }
        return out;
    })();
    const mergedRoadRects = mergeRoadRectsPreserveOrient(authRoadRects);
    const roadSemanticRectsCompiled = (def.roadSemanticRects ?? []).map((r) => ({
        x: (r.x | 0) + originTx,
        y: (r.y | 0) + originTy,
        z: (r.z ?? 0) | 0,
        w: Math.max(1, (r.w ?? 1) | 0),
        h: Math.max(1, (r.h ?? 1) | 0),
        semantic: r.semantic,
        dir: r.dir,
        startHeight: r.startHeight,
        targetHeight: r.targetHeight,
    }));
    const roadBands: RoadBand[] = mergedRoadRects.map((r) => {
        const x0 = (r.x | 0) + originTx;
        const y0 = (r.y | 0) + originTy;
        const w = Math.max(1, (r.w ?? 1) | 0);
        const h = Math.max(1, (r.h ?? 1) | 0);
        return {
            x0,
            y0,
            x1: x0 + w - 1,
            y1: y0 + h - 1,
            orient: r.orient,
            roadW: r.orient === "H" ? h : w,
            roadL: r.orient === "H" ? w : h,
            roadZ: (r.z ?? 0) | 0,
            roadDir: r.roadDir,
            semantic: r.semantic,
            startHeight: r.startHeight,
            targetHeight: r.targetHeight,
        };
    });
    const isRampBand = (band: RoadBand): boolean => {
        const s = band.semantic?.trim().toLowerCase();
        return !!s && (s === "ramp" || s.startsWith("ramp_"));
    };
    const roadBandHeightAt = (band: RoadBand, txWorld: number, tyWorld: number): number => {
        if (!isRampBand(band)) return (band.roadZ ?? 0) | 0;
        const dir = band.roadDir;
        const rampStart = band.startHeight;
        const rampTarget = band.targetHeight;
        if (!Number.isFinite(rampStart) || !Number.isFinite(rampTarget)) return (band.roadZ ?? 0) | 0;
        if (dir !== "N" && dir !== "E" && dir !== "S" && dir !== "W") return (band.roadZ ?? 0) | 0;
        const startH = rampStart as number;
        const targetH = rampTarget as number;
        const axisLen = dir === "N" || dir === "S"
            ? (band.y1 - band.y0 + 1)
            : (band.x1 - band.x0 + 1);
        if (axisLen <= 0) return startH | 0;
        const axisIndex = (() => {
            if (dir === "N") return band.y1 - tyWorld;
            if (dir === "S") return tyWorld - band.y0;
            if (dir === "E") return txWorld - band.x0;
            return band.x1 - txWorld;
        })();
        const deltaH = targetH - startH;
        const numer = deltaH * (axisIndex + 1);
        const stepped = deltaH >= 0
            ? startH + Math.floor(numer / axisLen)
            : startH + Math.ceil(numer / axisLen);
        return stepped | 0;
    };
    const markRoadAreaWorld = (txWorld: number, tyWorld: number, width: number, z: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const idx = worldIndex(txWorld, tyWorld);
        roadAreaMaskWorld[idx] = 1;
        const w = Math.max(0, Math.min(255, width | 0));
        if (w > roadAreaWidthWorld[idx]) roadAreaWidthWorld[idx] = w;
        layerMask(roadAreaByZ, z)[idx] = 1;
    };
    const markRoadCenterHWorld = (txWorld: number, tyWorld: number, width: number, z: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const idx = worldIndex(txWorld, tyWorld);
        if (roadAreaMaskWorld[idx] !== 1) return;
        roadCenterMaskHWorld[idx] = 1;
        const w = Math.max(0, Math.min(255, width | 0));
        if (w > roadCenterWidthHWorld[idx]) roadCenterWidthHWorld[idx] = w;
        layerMask(centerHByZ, z)[idx] = 1;
        roadCenterMaskWorld[idx] = (roadCenterMaskHWorld[idx] | roadCenterMaskVWorld[idx]) as 0 | 1;
        const mergedW = Math.max(roadCenterWidthHWorld[idx], roadCenterWidthVWorld[idx]) | 0;
        roadCenterWidthWorld[idx] = mergedW;
    };
    const markRoadCenterVWorld = (txWorld: number, tyWorld: number, width: number, z: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const idx = worldIndex(txWorld, tyWorld);
        if (roadAreaMaskWorld[idx] !== 1) return;
        roadCenterMaskVWorld[idx] = 1;
        const w = Math.max(0, Math.min(255, width | 0));
        if (w > roadCenterWidthVWorld[idx]) roadCenterWidthVWorld[idx] = w;
        layerMask(centerVByZ, z)[idx] = 1;
        roadCenterMaskWorld[idx] = (roadCenterMaskHWorld[idx] | roadCenterMaskVWorld[idx]) as 0 | 1;
        const mergedW = Math.max(roadCenterWidthHWorld[idx], roadCenterWidthVWorld[idx]) | 0;
        roadCenterWidthWorld[idx] = mergedW;
    };
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (let i = 0; i < roadBands.length; i++) {
            const band = roadBands[i];
            const sx = band.x0;
            const sy = band.y0;
            const rw = band.x1 - band.x0 + 1;
            const rh = band.y1 - band.y0 + 1;
            const areaWidth = band.roadW;
            for (let dx = 0; dx < rw; dx++) {
                for (let dy = 0; dy < rh; dy++) {
                    markRoadAreaWorld(sx + dx, sy + dy, areaWidth, roadBandHeightAt(band, sx + dx, sy + dy));
                }
            }
            if (band.orient === "H") {
                const y0 = sy + Math.floor((rh - 1) / 2);
                const y1 = sy + Math.floor(rh / 2);
                for (let yy = y0; yy <= y1; yy++) {
                    for (let xx = sx; xx <= band.x1; xx++) {
                        markRoadCenterHWorld(xx, yy, rh, roadBandHeightAt(band, xx, yy));
                    }
                }
            } else {
                const x0 = sx + Math.floor((rw - 1) / 2);
                const x1 = sx + Math.floor(rw / 2);
                for (let xx = x0; xx <= x1; xx++) {
                    for (let yy = sy; yy <= band.y1; yy++) {
                        markRoadCenterVWorld(xx, yy, rw, roadBandHeightAt(band, xx, yy));
                    }
                }
            }
        }
    });
    const roadIntersectionMaskByZ = new Map<number, Uint8Array>();
    const roadCrossingMaskByZ = new Map<number, Uint8Array>();
    const roadCrossingDirByZ = new Map<number, Uint8Array>();
    const roadStopMaskByZ = new Map<number, Uint8Array>();
    const roadStopDirByZ = new Map<number, Uint8Array>();

    const neighbors4 = [
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
    ];
    const centerHKeys = Array.from(centerHByZ.keys());
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (let zi = 0; zi < centerHKeys.length; zi++) {
            const z = centerHKeys[zi] | 0;
            const hMask = centerHByZ.get(z);
            const vMask = centerVByZ.get(z);
            if (!hMask || !vMask) continue;
            const areaMask = roadAreaByZ.get(z);
            if (!areaMask) continue;
            const interMask = layerMask(roadIntersectionMaskByZ, z);
            const visitedOverlap = new Uint8Array(worldW * worldH);
            const qx: number[] = [];
            const qy: number[] = [];

            for (let tyWorld = originTy; tyWorld <= worldMaxTy; tyWorld++) {
                for (let txWorld = originTx; txWorld <= worldMaxTx; txWorld++) {
                    const startIdx = worldIndex(txWorld, tyWorld);
                    if (hMask[startIdx] !== 1 || vMask[startIdx] !== 1) continue;
                    if (visitedOverlap[startIdx] === 1) continue;
                    visitedOverlap[startIdx] = 1;
                    qx.length = 0;
                    qy.length = 0;
                    qx.push(txWorld);
                    qy.push(tyWorld);
                    let qHead = 0;

                    let minX = txWorld;
                    let maxX = txWorld;
                    let minY = tyWorld;
                    let maxY = tyWorld;
                    let wH = 0;
                    let wV = 0;

                    while (qHead < qx.length) {
                        const cx = qx[qHead];
                        const cy = qy[qHead];
                        qHead++;
                        const ci = worldIndex(cx, cy);

                        if (cx < minX) minX = cx;
                        if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy;
                        if (cy > maxY) maxY = cy;

                        if (vMask[ci] === 1) {
                            const w = roadCenterWidthVWorld[ci] | 0;
                            if (w > wH) wH = w;
                        }
                        if (hMask[ci] === 1) {
                            const w = roadCenterWidthHWorld[ci] | 0;
                            if (w > wV) wV = w;
                        }

                        for (let ni = 0; ni < neighbors4.length; ni++) {
                            const nx = cx + neighbors4[ni].dx;
                            const ny = cy + neighbors4[ni].dy;
                            if (!worldInBounds(nx, ny)) continue;
                            const niIdx = worldIndex(nx, ny);
                            if (hMask[niIdx] !== 1 || vMask[niIdx] !== 1) continue;
                            if (visitedOverlap[niIdx] === 1) continue;
                            visitedOverlap[niIdx] = 1;
                            qx.push(nx);
                            qy.push(ny);
                        }
                    }

                    wH = Math.max(1, wH | 0);
                    wV = Math.max(1, wV | 0);
                    const anchor2X = minX + maxX + 1;
                    const anchor2Y = minY + maxY + 1;
                    const rectBoundsFromCenter2 = (c2: number, w: number): { a: number; b: number } => {
                        const a = Math.floor((c2 - w) / 2);
                        return { a, b: a + w - 1 };
                    };
                    const xb = rectBoundsFromCenter2(anchor2X, wH);
                    const yb = rectBoundsFromCenter2(anchor2Y, wV);
                    for (let yy = yb.a; yy <= yb.b; yy++) {
                        for (let xx = xb.a; xx <= xb.b; xx++) {
                            if (!worldInBounds(xx, yy)) continue;
                            const ii = worldIndex(xx, yy);
                            if (areaMask[ii] !== 1) continue;
                            interMask[ii] = 1;
                        }
                    }
                    roadIntersectionSeedsWorld.push({
                        tx: Math.floor((anchor2X - 1) / 2),
                        ty: Math.floor((anchor2Y - 1) / 2),
                    });
                    roadIntersectionClusterCentersWorld.push({
                        worldX: (anchor2X * 0.5) * KENNEY_TILE_WORLD,
                        worldY: (anchor2Y * 0.5) * KENNEY_TILE_WORLD,
                    });
                }
            }
        }
    });

    // Build intersection-component bounds per height-layer.
    const intersectionZKeys = Array.from(roadIntersectionMaskByZ.keys());
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (let zi = 0; zi < intersectionZKeys.length; zi++) {
            const z = intersectionZKeys[zi] | 0;
            const interMask = roadIntersectionMaskByZ.get(z);
            if (!interMask) continue;
            const visitedIntersection = new Uint8Array(worldW * worldH);
            const qx: number[] = [];
            const qy: number[] = [];
            const tilesX: number[] = [];
            const tilesY: number[] = [];

            for (let tyWorld = originTy; tyWorld <= worldMaxTy; tyWorld++) {
                for (let txWorld = originTx; txWorld <= worldMaxTx; txWorld++) {
                    const startIdx = worldIndex(txWorld, tyWorld);
                    if (interMask[startIdx] !== 1) continue;
                    if (visitedIntersection[startIdx] === 1) continue;
                    visitedIntersection[startIdx] = 1;
                    qx.length = 0;
                    qy.length = 0;
                    tilesX.length = 0;
                    tilesY.length = 0;
                    qx.push(txWorld);
                    qy.push(tyWorld);
                    let qHead = 0;
                    let minX = txWorld;
                    let maxX = txWorld;
                    let minY = tyWorld;
                    let maxY = tyWorld;
                    while (qHead < qx.length) {
                        const cx = qx[qHead];
                        const cy = qy[qHead];
                        qHead++;
                        tilesX.push(cx);
                        tilesY.push(cy);
                        if (cx < minX) minX = cx;
                        if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy;
                        if (cy > maxY) maxY = cy;
                        for (let ni = 0; ni < neighbors4.length; ni++) {
                            const nx = cx + neighbors4[ni].dx;
                            const ny = cy + neighbors4[ni].dy;
                            if (!worldInBounds(nx, ny)) continue;
                            const niIdx = worldIndex(nx, ny);
                            if (interMask[niIdx] !== 1) continue;
                            if (visitedIntersection[niIdx] === 1) continue;
                            visitedIntersection[niIdx] = 1;
                            qx.push(nx);
                            qy.push(ny);
                        }
                    }
                    const targetX = Math.floor((minX + maxX) / 2);
                    const targetY = Math.floor((minY + maxY) / 2);
                    let best = 0;
                    let bestDist = Number.POSITIVE_INFINITY;
                    for (let ti = 0; ti < tilesX.length; ti++) {
                        const tx = tilesX[ti];
                        const ty = tilesY[ti];
                        const d = Math.abs(tx - targetX) + Math.abs(ty - targetY);
                        const bestX = tilesX[best];
                        const bestY = tilesY[best];
                        if (d < bestDist || (d === bestDist && (ty < bestY || (ty === bestY && tx < bestX)))) {
                            best = ti;
                            bestDist = d;
                        }
                    }
                    const center = { cx: tilesX[best], cy: tilesY[best] };
                    roadIntersectionBoundsWorld.push({ minX, maxX, minY, maxY });
                    roadIntersectionCenterTilesWorld.push({ tx: center.cx, ty: center.cy });
                    roadIntersectionHeightsWorld.push(z);
                }
            }
        }
    });

    const writeCrossing = (txWorld: number, tyWorld: number, dir: number, expectedZ: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const i = worldIndex(txWorld, tyWorld);
        const areaMask = roadAreaByZ.get(expectedZ | 0);
        if (!areaMask || areaMask[i] !== 1) return;
        const interMask = layerMask(roadIntersectionMaskByZ, expectedZ);
        if (interMask[i] === 1) return;
        const crossingMask = layerMask(roadCrossingMaskByZ, expectedZ);
        if (crossingMask[i] === 1) return;
        crossingMask[i] = 1;
        layerMask(roadCrossingDirByZ, expectedZ)[i] = dir;
    };
    const writeStop = (txWorld: number, tyWorld: number, dir: number, expectedZ: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const i = worldIndex(txWorld, tyWorld);
        const areaMask = roadAreaByZ.get(expectedZ | 0);
        if (!areaMask || areaMask[i] !== 1) return;
        const interMask = layerMask(roadIntersectionMaskByZ, expectedZ);
        if (interMask[i] === 1) return;
        const crossingMask = layerMask(roadCrossingMaskByZ, expectedZ);
        if (crossingMask[i] === 1) return;
        const stopMask = layerMask(roadStopMaskByZ, expectedZ);
        if (stopMask[i] === 1) return;
        stopMask[i] = 1;
        layerMask(roadStopDirByZ, expectedZ)[i] = dir;
    };

    // Build directional halos from bounds; direction is assigned only here.
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (let bi = 0; bi < roadIntersectionBoundsWorld.length; bi++) {
            const b = roadIntersectionBoundsWorld[bi];
            const intersectionZ = roadIntersectionHeightsWorld[bi] | 0;

            // Crossing ring (distance 1).
            for (let x = b.minX; x <= b.maxX; x++) {
                writeCrossing(x, b.minY - 1, ROAD_DIR_N, intersectionZ);
                writeCrossing(x, b.maxY + 1, ROAD_DIR_S, intersectionZ);
            }
            for (let y = b.minY; y <= b.maxY; y++) {
                writeCrossing(b.minX - 1, y, ROAD_DIR_W, intersectionZ);
                writeCrossing(b.maxX + 1, y, ROAD_DIR_E, intersectionZ);
            }

            // Stop-bar ring (distance 2).
            for (let x = b.minX; x <= b.maxX; x++) {
                writeStop(x, b.minY - 2, ROAD_DIR_N, intersectionZ);
                writeStop(x, b.maxY + 2, ROAD_DIR_S, intersectionZ);
            }
            for (let y = b.minY; y <= b.maxY; y++) {
                writeStop(b.minX - 2, y, ROAD_DIR_W, intersectionZ);
                writeStop(b.maxX + 2, y, ROAD_DIR_E, intersectionZ);
            }
        }
    });

    // Project layered 3D road-network masks onto the active tile height layer for compatibility.
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (let tyWorld = originTy; tyWorld <= worldMaxTy; tyWorld++) {
            for (let txWorld = originTx; txWorld <= worldMaxTx; txWorld++) {
                const i = worldIndex(txWorld, tyWorld);
                const z = getTile(txWorld, tyWorld).h | 0;
                const inter = roadIntersectionMaskByZ.get(z);
                const cross = roadCrossingMaskByZ.get(z);
                const crossDir = roadCrossingDirByZ.get(z);
                const stop = roadStopMaskByZ.get(z);
                const stopDir = roadStopDirByZ.get(z);
                roadIntersectionMaskWorld[i] = inter?.[i] === 1 ? 1 : 0;
                roadCrossingMaskWorld[i] = cross?.[i] === 1 ? 1 : 0;
                roadCrossingDirWorld[i] = crossDir?.[i] ?? 0;
                roadStopMaskWorld[i] = stop?.[i] === 1 ? 1 : 0;
                roadStopDirWorld[i] = stopDir?.[i] ?? 0;
            }
        }
    });

    const isRoadWorld = (txWorld: number, tyWorld: number): boolean => {
        if (!worldInBounds(txWorld, tyWorld)) return false;
        return roadAreaMaskWorld[worldIndex(txWorld, tyWorld)] === 1;
    };

    const surfacesByKey = new Map<string, Surface[]>();
    const surfacesByCoord = new Map<number, Map<number, Surface[]>>();
    const surfaceCoords: Array<{ tx: number; ty: number }> = [];
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
        const byZAsc = (a: Surface, b: Surface) => {
            if (a.zBase !== b.zBase) return a.zBase - b.zBase;
            if (a.zLogical !== b.zLogical) return a.zLogical - b.zLogical;
            return a.id.localeCompare(b.id);
        };
        const k = `${surface.tx},${surface.ty}`;
        const list = surfacesByKey.get(k);
        if (list) {
            list.push(surface);
            list.sort(byZAsc);
        } else {
            surfacesByKey.set(k, [surface]);
            surfaceCoords.push({ tx: surface.tx, ty: surface.ty });
        }

        let byTy = surfacesByCoord.get(surface.tx);
        if (!byTy) {
            byTy = new Map<number, Surface[]>();
            surfacesByCoord.set(surface.tx, byTy);
        }
        const byTyList = byTy.get(surface.ty);
        if (byTyList) {
            byTyList.push(surface);
            byTyList.sort(byZAsc);
        }
        else byTy.set(surface.ty, [surface]);

        const layerList = topsByLayer.get(surface.zLogical);
        if (layerList) layerList.push(surface);
        else topsByLayer.set(surface.zLogical, [surface]);
    }

    function resolveSpawnSurfaceTop(tx: number, ty: number): {
        runtimeTop?: RuntimeFloorTop;
        spriteIdTop: string;
    } {
        const runtimeCounts = new Map<RuntimeFloorTop["family"], number>();
        const skinCounts = new Map<string, number>();
        const neighborOffsets = [
            { dx: 0, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
            { dx: 1, dy: 1 },
            { dx: 1, dy: -1 },
            { dx: -1, dy: 1 },
            { dx: -1, dy: -1 },
        ];
        for (let i = 0; i < neighborOffsets.length; i++) {
            const nt = placed.get(`${tx + neighborOffsets[i].dx},${ty + neighborOffsets[i].dy}`);
            if (!nt || nt.kind === "VOID" || nt.kind === TILE_ID_OCEAN || nt.kind === "SPAWN") continue;
            const skin = nt.skin ?? "";
            if (!skin || skin === INHERIT_DOMINANT_FLOOR_SKIN) continue;
            if (skin.startsWith(RUNTIME_TILE_SKIN_PREFIX)) {
                const family = skin.slice(RUNTIME_TILE_SKIN_PREFIX.length);
                if (family === "sidewalk" || family === "asphalt" || family === "park") {
                    runtimeCounts.set(family, (runtimeCounts.get(family) ?? 0) + 1);
                    continue;
                }
            }
            if (skin) skinCounts.set(skin, (skinCounts.get(skin) ?? 0) + 1);
        }

        let bestRuntimeFamily: RuntimeFloorTop["family"] | null = null;
        let bestRuntimeCount = -1;
        for (const [family, count] of runtimeCounts.entries()) {
            if (count > bestRuntimeCount) {
                bestRuntimeCount = count;
                bestRuntimeFamily = family;
            }
        }
        if (bestRuntimeFamily) {
            const runtimeTop = pickRuntimeSquareTop(bestRuntimeFamily, tx, ty);
            return { runtimeTop, spriteIdTop: runtimeTop.spriteId };
        }

        let bestSkin = "";
        let bestSkinCount = -1;
        for (const [skin, count] of skinCounts.entries()) {
            if (count > bestSkinCount) {
                bestSkinCount = count;
                bestSkin = skin;
            }
        }
        if (bestSkin) {
            return { spriteIdTop: bestSkin };
        }

        return {
            spriteIdTop: resolveTileSpriteId({
                slot: "floor",
                mapSkin: resolvedMapSkin,
                mapSkinId: skinIdToUse,
                mapDefaults: mapSkinDefaults,
            }),
        };
    }

    const decals: DecalPiece[] = [];
    const decalTileKeys = new Set<string>();
    const semanticDecalConfig: Record<"sidewalk" | "road" | "asphalt", { chance: number; setId: RuntimeDecalSetId }> = {
        sidewalk: { chance: 0.10, setId: "sidewalk" },
        road: { chance: 0.02, setId: "asphalt" },
        asphalt: { chance: 0.02, setId: "asphalt" },
    };
    const maybeAddSemanticDecal = (
        tx: number,
        ty: number,
        zBase: number,
        zLogical: number,
        semanticType: "sidewalk" | "road" | "asphalt",
        renderAnchorY: number,
    ) => {
        const cfg = semanticDecalConfig[semanticType];
        if (!cfg) return;
        const variantCount = getDecalVariantCount(cfg.setId);
        if (variantCount <= 0) return;

        const dedupKey = `${tx},${ty},${zLogical}`;
        if (decalTileKeys.has(dedupKey)) return;

        const spawnHash = hashString(`${runSeed}:${mapId}:${tx},${ty}:${semanticType}:decal:spawn`);
        const roll = (spawnHash % 10000) / 10000;
        if (roll >= cfg.chance) return;

        const pickHash = hashString(`${runSeed}:${mapId}:${tx},${ty}:${semanticType}:decal:pick`);
        const variantIndex = (pickHash % variantCount) + 1;
        const spriteId = getDecalSpriteId(cfg.setId, variantIndex);
        if (!spriteId) return;
        const rotationHash = hashString(`${runSeed}:${mapId}:${tx},${ty}:${semanticType}:decal:rot`);
        const rotationQuarterTurns = (rotationHash % 4) as 0 | 1 | 2 | 3;

        decalTileKeys.add(dedupKey);
        decals.push({
            id: `decal_${semanticType}_${tx}_${ty}_${zLogical}`,
            tx: tx + 0.5,
            ty: ty + 0.5,
            zBase,
            zLogical,
            setId: cfg.setId,
            spriteId,
            variantIndex,
            semanticType,
            renderAnchorY,
            rotationQuarterTurns,
        });
    };
    const emptyMask = new Uint8Array(worldW * worldH);
    const roadMarkingsAll: MarkingPiece[] = [];
    const roadContextByZ = new Map<number, RoadContext>();
    const roadZKeys = Array.from(roadAreaByZ.keys()).sort((a, b) => a - b);
    const bandIntersectsZ = (band: RoadBand, z: number): boolean => {
        if (!isRampBand(band)) return ((band.roadZ ?? 0) | 0) === (z | 0);
        for (let ty = band.y0; ty <= band.y1; ty++) {
            for (let tx = band.x0; tx <= band.x1; tx++) {
                if (!worldInBounds(tx, ty)) continue;
                if ((roadBandHeightAt(band, tx, ty) | 0) === (z | 0)) return true;
            }
        }
        return false;
    };
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (let zi = 0; zi < roadZKeys.length; zi++) {
            const z = roadZKeys[zi] | 0;
            const areaMask = roadAreaByZ.get(z);
            if (!areaMask) continue;
            const bandsForZ = roadBands.filter((b) => bandIntersectsZ(b, z));
            if (bandsForZ.length === 0) continue;
            const layerPipeline = buildRoadMarkingsPipeline({
                w: worldW,
                h: worldH,
                originTx,
                originTy,
                isRoadFromSemantics: (x, y) => {
                    if (!worldInBounds(x, y)) return false;
                    return areaMask[worldIndex(x, y)] === 1;
                },
                roadBands: bandsForZ,
                roadIntersectionMaskWorld: roadIntersectionMaskByZ.get(z) ?? emptyMask,
                roadCrossingMaskWorld: roadCrossingMaskByZ.get(z) ?? emptyMask,
                roadCrossingDirWorld: roadCrossingDirByZ.get(z) ?? emptyMask,
                roadStopMaskWorld: roadStopMaskByZ.get(z) ?? emptyMask,
                roadStopDirWorld: roadStopDirByZ.get(z) ?? emptyMask,
                emitStopbarCrossingOverlay: true,
                getTileZAt: () => z,
            });
            roadContextByZ.set(z, layerPipeline.context);
            for (let mi = 0; mi < layerPipeline.markings.length; mi++) {
                roadMarkingsAll.push(layerPipeline.markings[mi]);
            }
        }
    });

    // Compatibility context projection for UI/debug consumers expecting a single 2D context.
    const roadContextCompatIsRoad = new Uint8Array(worldW * worldH);
    const roadContextCompatAxis = new Uint8Array(worldW * worldH);
    for (let tyWorld = originTy; tyWorld <= worldMaxTy; tyWorld++) {
        for (let txWorld = originTx; txWorld <= worldMaxTx; txWorld++) {
            const i = worldIndex(txWorld, tyWorld);
            const z = getTile(txWorld, tyWorld).h | 0;
            const ctxAtZ = roadContextByZ.get(z);
            if (!ctxAtZ) continue;
            roadContextCompatIsRoad[i] = ctxAtZ.isRoad[i] | 0;
            roadContextCompatAxis[i] = ctxAtZ.axis[i] | 0;
        }
    }
    const roadMarkingContextCompat: RoadContext = {
        w: worldW,
        h: worldH,
        originTx,
        originTy,
        isRoad: roadContextCompatIsRoad,
        axis: roadContextCompatAxis,
    };

    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (let i = 0; i < roadMarkingsAll.length; i++) {
            const m = roadMarkingsAll[i];
            const sprite = resolveMarkingSprite(m.variant);
            if (!sprite) continue;
            const zBase = m.zBase ?? 0;
            const zLogical = m.zLogical ?? zBase;
            const dedupeKey = `${sprite.variantIndex}:${Math.round(m.tx * 1024)}:${Math.round(m.ty * 1024)}:${zLogical}:${m.rot}`;
            if (decalTileKeys.has(dedupeKey)) continue;
            decalTileKeys.add(dedupeKey);
            decals.push({
                id: m.key ? `marking_${m.key}` : `marking_${i}`,
                tx: m.tx,
                ty: m.ty,
                zBase,
                zLogical,
                setId: sprite.setId,
                spriteId: sprite.spriteId,
                variantIndex: sprite.variantIndex,
                semanticType: "road",
                renderAnchorY: floorAnchorY,
                rotationQuarterTurns: m.rot,
            });
        }
    });

    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TILE_OR_SURFACE_EXPANSION, () => {
        for (const [key, stack] of placedStacks.entries()) {
            if (!stack || stack.length === 0) continue;
            const parts = key.split(",");
            const tx = parseInt(parts[0], 10);
            const ty = parseInt(parts[1], 10);
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
            for (let si = 0; si < stack.length; si++) {
                const tile = stack[si];
                if (!tile || tile.kind === "VOID") continue;
                const zBase = tile.h | 0;
                const renderTopKind: RenderTopKind = tile.kind === "STAIRS" ? "STAIR" : "FLOOR";
                const renderDir = (tile.dir ?? "N") as StairDir;
                const renderAnchorY = renderTopKind === "STAIR" ? stairAnchorY : floorAnchorY;
                const renderDyOffset = renderTopKind === "STAIR" ? (stairDyByDir[renderDir] ?? 16) : 0;

                const zLogical = renderTopKind === "STAIR" ? Math.max(0, zBase - 1) : zBase;
                const runtimeFamilyFromTileSkin = (() => {
                    if (renderTopKind !== "FLOOR") return undefined;
                    const skin = tile.skin ?? "";
                    if (!skin.startsWith(RUNTIME_TILE_SKIN_PREFIX)) return undefined;
                    const family = skin.slice(RUNTIME_TILE_SKIN_PREFIX.length);
                    if (family === "sidewalk" || family === "asphalt" || family === "park") return family;
                    return undefined;
                })();
                const runtimeTop = runtimeFamilyFromTileSkin ? pickRuntimeSquareTop(runtimeFamilyFromTileSkin, tx, ty) : undefined;
                if (runtimeFamilyFromTileSkin === "sidewalk") {
                    maybeAddSemanticDecal(tx, ty, zBase, zLogical, "sidewalk", renderAnchorY);
                } else if (runtimeFamilyFromTileSkin === "asphalt") {
                    maybeAddSemanticDecal(tx, ty, zBase, zLogical, "asphalt", renderAnchorY);
                }
                const tileOverride: MapSkinBundle | undefined = tile.skin && !runtimeTop
                    ? (renderTopKind === "STAIR" ? { stair: tile.skin } : { floor: tile.skin })
                    : undefined;
                const useDominantFloorTop = tile.kind === "SPAWN" || tile.skin === INHERIT_DOMINANT_FLOOR_SKIN;
                const spawnResolvedTop = useDominantFloorTop ? resolveSpawnSurfaceTop(tx, ty) : null;
                const spriteIdTop = spawnResolvedTop
                    ? spawnResolvedTop.spriteIdTop
                    : runtimeTop
                    ? runtimeTop.spriteId
                    : resolveTileSpriteId({
                        slot: renderTopKind === "STAIR" ? "stair" : "floor",
                        dir: renderTopKind === "STAIR" ? renderDir : undefined,
                        mapSkin: resolvedMapSkin,
                        mapSkinId: skinIdToUse,
                        mapDefaults: mapSkinDefaults,
                        tileOverride,
                    });
                const finalRuntimeTop = spawnResolvedTop?.runtimeTop ?? runtimeTop;

                addSurface({
                    id: `tile_${tx}_${ty}_${si}_${tile.kind}_${zBase}`,
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
                    runtimeTop: finalRuntimeTop,
                });
            }
        }
    });


    function surfacesAtXY(tx: number, ty: number): Surface[] {
        return surfacesByCoord.get(tx)?.get(ty) ?? [];
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
    const blockedTileSpansByKey = new Map<string, Array<{ zFrom: number; zTo: number }>>();
    const nonFlippableWarned = new Set<string>();
    const buildingDimensionOverrideWarned = new Set<string>();
    const perimeterGlobalUsageBySkin = new Map<string, number>();
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

    const addBlockedSpan = (tx: number, ty: number, zFrom: number, zTo: number): void => {
        const key = `${tx},${ty}`;
        const lo = Math.min(zFrom, zTo);
        const hi = Math.max(zFrom, zTo);
        const spans = blockedTileSpansByKey.get(key);
        if (spans) spans.push({ zFrom: lo, zTo: hi });
        else blockedTileSpansByKey.set(key, [{ zFrom: lo, zTo: hi }]);
    };

    const bakeBlockedFootprint = (tx: number, ty: number, w: number, h: number, zFrom?: number, zTo?: number): void => {
        runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.COLLISION_NAV_OR_BLOCKER_GENERATION, () => {
            for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    const bx = tx + dx;
                    const by = ty + dy;
                    blockedTiles.add(`${bx},${by}`);
                    if (Number.isFinite(zFrom) && Number.isFinite(zTo)) {
                        addBlockedSpan(bx, by, zFrom as number, zTo as number);
                    }
                }
            }
        });
    };
    const warnBuildingDimensionOverride = (input: {
        stamp: SemanticStamp;
        skinId: string;
        source: PlacementGeometry["source"];
        spriteId: string;
        authoredW: number;
        authoredH: number;
        placedW: number;
        placedH: number;
        mapId: string;
    }): void => {
        if (input.authoredW === input.placedW && input.authoredH === input.placedH) return;
        const key = [
            input.mapId,
            input.stamp.x | 0,
            input.stamp.y | 0,
            input.skinId,
            `${input.authoredW}x${input.authoredH}`,
            `${input.placedW}x${input.placedH}`,
            input.source,
            input.spriteId,
        ].join(":");
        if (buildingDimensionOverrideWarned.has(key)) return;
        buildingDimensionOverrideWarned.add(key);
        console.warn(
            `[buildings] Dimension override for skin=${input.skinId} at stamp (${input.stamp.x},${input.stamp.y}) `
            + `on map=${input.mapId}: authored ${input.authoredW}x${input.authoredH} -> placed ${input.placedW}x${input.placedH} `
            + `(source=${input.source}, sprite=${input.spriteId}).`,
        );
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

    type PlacementGeometry = {
        w: number;
        h: number;
        heightUnits: number;
        tileHeightUnits: number;
        source: "semantic" | "legacy";
        spriteId: string;
    };
    const requireLegacySkinGeometry = (
        skin: BuildingSkin,
        context: string,
    ): { w: number; h: number; heightUnits: number; tileHeightUnits: number } => {
        const rawW = skin.w;
        const rawH = skin.h;
        const rawHeightUnits = skin.heightUnits;
        if (!Number.isFinite(rawW) || !Number.isFinite(rawH) || !Number.isFinite(rawHeightUnits)) {
            throw new Error(
                `[buildings] Missing legacy geometry metadata for ${skin.id} (${context}).`,
            );
        }
        return {
            w: Math.max(1, (rawW as number) | 0),
            h: Math.max(1, (rawH as number) | 0),
            heightUnits: Math.max(1, (rawHeightUnits as number) | 0),
            tileHeightUnits: Math.max(
                renderHeightUnitsToSweepTileHeight(1),
                renderHeightUnitsToSweepTileHeight(rawHeightUnits as number),
            ),
        };
    };
    const placementGeometryByKey = new Map<string, PlacementGeometry>();
    const warnedLegacyGeometryBySkinId = new Set<string>();
    const isMonolithicBuildingSkin = (skin: BuildingSkin): boolean =>
        skin.wallSouth.every((id) => id === skin.roof) && skin.wallEast.every((id) => id === skin.roof);
    const resolvePlacementGeometryForSkin = (
        skin: BuildingSkin,
        context: string,
        resolvedSpriteId?: string,
    ): PlacementGeometry => {
        const semanticSpriteId = (resolvedSpriteId ?? skin.roof).trim().replace(/\.png$/i, "");
        const cacheKey = `${skin.id}::${semanticSpriteId}`;
        const cached = placementGeometryByKey.get(cacheKey);
        if (cached) return cached;
        const isBuildingSkin = !!BUILDING_SKINS[skin.id];
        if (isBuildingSkin) {
            const semantic = getRequiredMonolithicBuildingPlacementGeometryForSprite(
                skin.id,
                semanticSpriteId,
                `compile-map:${context}`,
            );
            const resolved: PlacementGeometry = {
                w: semantic.w,
                h: semantic.h,
                heightUnits: semantic.heightUnits,
                tileHeightUnits: semantic.tileHeightUnits,
                source: "semantic",
                spriteId: semanticSpriteId,
            };
            placementGeometryByKey.set(cacheKey, resolved);
            return resolved;
        }
        if (!warnedLegacyGeometryBySkinId.has(skin.id)) {
            warnedLegacyGeometryBySkinId.add(skin.id);
            console.warn(
                `[buildings] Legacy geometry metadata read for non-building skin ${skin.id} in ${context}.`,
            );
        }
        const legacyGeometry = requireLegacySkinGeometry(skin, `legacy-placement:${context}`);
        const resolved: PlacementGeometry = {
            w: legacyGeometry.w,
            h: legacyGeometry.h,
            heightUnits: legacyGeometry.heightUnits,
            tileHeightUnits: legacyGeometry.tileHeightUnits,
            source: "legacy",
            spriteId: semanticSpriteId,
        };
        placementGeometryByKey.set(cacheKey, resolved);
        return resolved;
    };

    const EMIT_STRUCTURE_SUPPORT_TOPS = false;
    const resolveCandidateSkinIdsForStamp = (stamp: SemanticStamp): string[] => {
        const explicitPoolIds = (Array.isArray(stamp.pool) ? stamp.pool : [])
            .map((id) => normalizeSkinId(id))
            .filter((id): id is string => !!id);
        if (explicitPoolIds.length <= 0) {
            return resolveBuildingCandidates(buildingPackId);
        }
        const candidateIds = new Set<string>();
        for (let i = 0; i < explicitPoolIds.length; i++) {
            const poolId = explicitPoolIds[i];
            const pack = BUILDING_PACKS[poolId];
            if (!pack) continue;
            for (let j = 0; j < pack.length; j++) {
                candidateIds.add(pack[j]);
            }
        }
        if (candidateIds.size <= 0) {
            throw new Error(`[buildings] No candidates for explicit pool [${explicitPoolIds.join(", ")}] at stamp (${stamp.x},${stamp.y}).`);
        }
        return Array.from(candidateIds);
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
        const buildingDir = stamp.type === "building" ? normalizeBuildingDir(stamp.dir) : undefined;
        if (buildingDir && typeof stamp.flipped === "boolean") {
            throw new Error(`[buildings] Building stamp at (${stamp.x},${stamp.y}) cannot combine dir with flipped.`);
        }
        if (stamp.type === "building") {
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

            const forcedSkinId = normalizeSkinId(skinOverride ?? stamp.skinId);
            const buildingLayout = stamp.type === "building" ? stamp.layout : undefined;
            if (buildingLayout === "perimeter_outward" && typeof stamp.flipped === "boolean") {
                throw new Error(`[buildings] Building stamp at (${stamp.x},${stamp.y}) cannot combine layout=perimeter_outward with flipped.`);
            }

            if (buildingLayout === "perimeter_outward") {
                const assertHeightRange = (skin: BuildingSkin): void => {
                    const geometry = resolvePlacementGeometryForSkin(skin, `perimeter-height-range:${skin.id}`);
                    if (stamp.heightUnitsMin !== undefined && geometry.heightUnits < stamp.heightUnitsMin) {
                        throw new Error(`Building skin "${skin.id}" heightUnits ${geometry.heightUnits} is below minimum ${stamp.heightUnitsMin}.`);
                    }
                    if (stamp.heightUnitsMax !== undefined && geometry.heightUnits > stamp.heightUnitsMax) {
                        throw new Error(`Building skin "${skin.id}" heightUnits ${geometry.heightUnits} is above maximum ${stamp.heightUnitsMax}.`);
                    }
                };
                const candidateSkins: BuildingSkin[] = (() => {
                    if (forcedSkinId) {
                        const forced = BUILDING_SKINS[forcedSkinId];
                        if (!forced) {
                            throw new Error(`[buildings] Missing skin entry for id=${forcedSkinId} (stamp (${stamp.x},${stamp.y}))`);
                        }
                        assertHeightRange(forced);
                        return [forced];
                    }
                    return resolveCandidateSkinIdsForStamp(stamp)
                        .map((id) => BUILDING_SKINS[id])
                        .filter((skin): skin is BuildingSkin => !!skin)
                        .filter((skin) => {
                            const geometry = resolvePlacementGeometryForSkin(skin, `perimeter-candidate-filter:${skin.id}`);
                            return stamp.heightUnitsMin === undefined || geometry.heightUnits >= stamp.heightUnitsMin;
                        })
                        .filter((skin) => {
                            const geometry = resolvePlacementGeometryForSkin(skin, `perimeter-candidate-filter:${skin.id}`);
                            return stamp.heightUnitsMax === undefined || geometry.heightUnits <= stamp.heightUnitsMax;
                        });
                })();
                const occupied = new Array(w * h).fill(false);
                const canPlace = (x0: number, y0: number, cw: number, ch: number): boolean => {
                    if (x0 < 0 || y0 < 0) return false;
                    if (x0 + cw > w || y0 + ch > h) return false;
                    for (let dy = 0; dy < ch; dy++) {
                        for (let dx = 0; dx < cw; dx++) {
                            if (occupied[(y0 + dy) * w + (x0 + dx)]) return false;
                        }
                    }
                    return true;
                };
                const occupy = (x0: number, y0: number, cw: number, ch: number): void => {
                    for (let dy = 0; dy < ch; dy++) {
                        for (let dx = 0; dx < cw; dx++) {
                            occupied[(y0 + dy) * w + (x0 + dx)] = true;
                        }
                    }
                };
                const placements: Array<{ x: number; y: number; w: number; h: number; skinId: string; dir: BuildingDir }> = [];
                const baseSideOrder: BuildingDir[] = ["S", "E", "N", "W"];
                const perimeterPriorityDir: BuildingDir | undefined = buildingDir;
                const sideOrder: BuildingDir[] = (() => {
                    if (!perimeterPriorityDir) return baseSideOrder;
                    const start = baseSideOrder.indexOf(perimeterPriorityDir);
                    if (start < 0) return baseSideOrder;
                    return [
                        ...baseSideOrder.slice(start),
                        ...baseSideOrder.slice(0, start),
                    ];
                })();
                type PerimeterPickCandidate = {
                    x: number;
                    y: number;
                    w: number;
                    h: number;
                    coverage: number;
                    skinId: string;
                    dir: BuildingDir;
                };
                const fieldUsageBySkin = new Map<string, number>();
                const sideUsageBySkin: Record<BuildingDir, Map<string, number>> = {
                    S: new Map<string, number>(),
                    E: new Map<string, number>(),
                    N: new Map<string, number>(),
                    W: new Map<string, number>(),
                };
                const recentUsageScoreBySkin = new Map<string, number>();
                const COVERAGE_WEIGHT_GAMMA = 1.35;
                const GLOBAL_USAGE_PENALTY = 0.32;
                const FIELD_USAGE_PENALTY = 0.55;
                const SIDE_USAGE_PENALTY = 0.75;
                const RECENT_USAGE_PENALTY = 1.25;
                const RECENT_USAGE_DECAY = 0.72;
                const PRIORITY_DIR_BOOST = 1.6;
                const decayRecentUsage = (): void => {
                    for (const [skinId, score] of recentUsageScoreBySkin.entries()) {
                        const decayed = score * RECENT_USAGE_DECAY;
                        if (decayed <= 1e-4) recentUsageScoreBySkin.delete(skinId);
                        else recentUsageScoreBySkin.set(skinId, decayed);
                    }
                };
                const registerPerimeterPick = (skinId: string, side: BuildingDir): void => {
                    decayRecentUsage();
                    fieldUsageBySkin.set(skinId, (fieldUsageBySkin.get(skinId) ?? 0) + 1);
                    const bySide = sideUsageBySkin[side];
                    bySide.set(skinId, (bySide.get(skinId) ?? 0) + 1);
                    recentUsageScoreBySkin.set(skinId, (recentUsageScoreBySkin.get(skinId) ?? 0) + 1);
                    perimeterGlobalUsageBySkin.set(skinId, (perimeterGlobalUsageBySkin.get(skinId) ?? 0) + 1);
                };
                const choosePenalizedWeightedCandidate = (
                    candidates: PerimeterPickCandidate[],
                    cursorTag: string,
                ): PerimeterPickCandidate => {
                    const seed = hashString(
                        `${runSeed}:${mapId}:${stampIndex}:perimeter:${stamp.x},${stamp.y}:${w}x${h}:${cursorTag}`,
                    );
                    const rng = new RNG(seed);
                    let totalWeight = 0;
                    const weights: number[] = new Array(candidates.length);
                    for (let i = 0; i < candidates.length; i++) {
                        const c = candidates[i];
                        const coverageWeight = Math.pow(Math.max(1, c.coverage), COVERAGE_WEIGHT_GAMMA);
                        const globalUsage = perimeterGlobalUsageBySkin.get(c.skinId) ?? 0;
                        const fieldUsage = fieldUsageBySkin.get(c.skinId) ?? 0;
                        const sideUsage = sideUsageBySkin[c.dir].get(c.skinId) ?? 0;
                        const recentUsageScore = recentUsageScoreBySkin.get(c.skinId) ?? 0;
                        const penalty = Math.exp(
                            -(
                                globalUsage * GLOBAL_USAGE_PENALTY
                                + fieldUsage * FIELD_USAGE_PENALTY
                                + sideUsage * SIDE_USAGE_PENALTY
                                + recentUsageScore * RECENT_USAGE_PENALTY
                            ),
                        );
                        const priorityBoost =
                            perimeterPriorityDir !== undefined && c.dir === perimeterPriorityDir
                                ? PRIORITY_DIR_BOOST
                                : 1;
                        const weight = Math.max(1e-6, coverageWeight * penalty * priorityBoost);
                        weights[i] = weight;
                        totalWeight += weight;
                    }
                    let roll = rng.next() * Math.max(1e-6, totalWeight);
                    for (let i = 0; i < candidates.length; i++) {
                        roll -= weights[i];
                        if (roll <= 0) return candidates[i];
                    }
                    return candidates[candidates.length - 1] ?? candidates[0];
                };
                const collectCornerCandidates = (
                    cornerX: number,
                    cornerY: number,
                    dirs: readonly BuildingDir[],
                ): PerimeterPickCandidate[] => {
                    const candidates: PerimeterPickCandidate[] = [];
                    const seen = new Set<string>();
                    for (let di = 0; di < dirs.length; di++) {
                        const dir = dirs[di];
                        for (let i = 0; i < candidateSkins.length; i++) {
                            const skin = candidateSkins[i];
                            const monolithicSkin = isMonolithicBuildingSkin(skin);
                            const directionalSpriteId = monolithicSkin
                                ? resolveBuildingSpriteId(skin.roof, dir)
                                : undefined;
                            const geometry = resolvePlacementGeometryForSkin(
                                skin,
                                `perimeter-corner:${skin.id}`,
                                directionalSpriteId,
                            );
                            const oriented = monolithicSkin
                                ? { w: geometry.w, h: geometry.h }
                                : orientBuildingFootprintByDir(geometry.w, geometry.h, skin.defaultFacing, dir);
                            const cw = oriented.w;
                            const ch = oriented.h;
                            const xCandidates = dir === "E"
                                ? [w - cw]
                                : dir === "W"
                                    ? [0]
                                    : [Math.max(0, Math.min(cornerX, w - cw)), Math.max(0, Math.min(cornerX - cw + 1, w - cw))];
                            const yCandidates = dir === "S"
                                ? [h - ch]
                                : dir === "N"
                                    ? [0]
                                    : [Math.max(0, Math.min(cornerY, h - ch)), Math.max(0, Math.min(cornerY - ch + 1, h - ch))];
                            for (let xi = 0; xi < xCandidates.length; xi++) {
                                for (let yi = 0; yi < yCandidates.length; yi++) {
                                    const px = xCandidates[xi];
                                    const py = yCandidates[yi];
                                    if (px > cornerX || cornerX >= px + cw || py > cornerY || cornerY >= py + ch) continue;
                                    if (!canPlace(px, py, cw, ch)) continue;
                                    const coverage = dir === "N" || dir === "S" ? cw : ch;
                                    const key = `${px},${py}:${cw}x${ch}:${skin.id}:${dir}`;
                                    if (seen.has(key)) continue;
                                    seen.add(key);
                                    candidates.push({ x: px, y: py, w: cw, h: ch, coverage, skinId: skin.id, dir });
                                }
                            }
                        }
                    }
                    return candidates;
                };
                const collectSideCandidates = (side: BuildingDir, cursor: number): PerimeterPickCandidate[] => {
                    const candidates: PerimeterPickCandidate[] = [];
                    for (let i = 0; i < candidateSkins.length; i++) {
                        const skin = candidateSkins[i];
                        const monolithicSkin = isMonolithicBuildingSkin(skin);
                        const directionalSpriteId = monolithicSkin
                            ? resolveBuildingSpriteId(skin.roof, side)
                            : undefined;
                        const geometry = resolvePlacementGeometryForSkin(
                            skin,
                            `perimeter-side:${skin.id}`,
                            directionalSpriteId,
                        );
                        const oriented = monolithicSkin
                            ? { w: geometry.w, h: geometry.h }
                            : orientBuildingFootprintByDir(geometry.w, geometry.h, skin.defaultFacing, side);
                        const cw = oriented.w;
                        const ch = oriented.h;
                        const px = side === "N" || side === "S" ? cursor : (side === "E" ? w - cw : 0);
                        const py = side === "E" || side === "W" ? cursor : (side === "S" ? h - ch : 0);
                        if (!canPlace(px, py, cw, ch)) continue;
                        const coverage = side === "N" || side === "S" ? cw : ch;
                        candidates.push({ x: px, y: py, w: cw, h: ch, coverage, skinId: skin.id, dir: side });
                    }
                    return candidates;
                };

                // Pass 1: corners first, with priority seeded by dir (if present).
                type CornerTag = "SW" | "SE" | "NE" | "NW";
                const cornersByTag: Record<CornerTag, { x: number; y: number; dirs: readonly BuildingDir[] }> = {
                    SW: { x: 0, y: h - 1, dirs: ["S", "W"] },
                    SE: { x: w - 1, y: h - 1, dirs: ["S", "E"] },
                    NE: { x: w - 1, y: 0, dirs: ["E", "N"] },
                    NW: { x: 0, y: 0, dirs: ["N", "W"] },
                };
                const sideToCorners: Record<BuildingDir, readonly CornerTag[]> = {
                    S: ["SW", "SE"],
                    E: ["SE", "NE"],
                    N: ["NE", "NW"],
                    W: ["NW", "SW"],
                };
                const seenCornerTags = new Set<CornerTag>();
                const cornerOrder: CornerTag[] = [];
                for (let i = 0; i < sideOrder.length; i++) {
                    const side = sideOrder[i];
                    const tags = sideToCorners[side];
                    for (let j = 0; j < tags.length; j++) {
                        const tag = tags[j];
                        if (seenCornerTags.has(tag)) continue;
                        seenCornerTags.add(tag);
                        cornerOrder.push(tag);
                    }
                }
                for (let i = 0; i < cornerOrder.length; i++) {
                    const tag = cornerOrder[i];
                    const corner = cornersByTag[tag];
                    if (corner.x < 0 || corner.y < 0 || corner.x >= w || corner.y >= h) continue;
                    if (occupied[corner.y * w + corner.x]) continue;
                    const candidates = collectCornerCandidates(corner.x, corner.y, corner.dirs);
                    if (candidates.length === 0) continue;
                    const picked = choosePenalizedWeightedCandidate(candidates, `corner:${tag}:${corner.x},${corner.y}`);
                    placements.push({ x: picked.x, y: picked.y, w: picked.w, h: picked.h, skinId: picked.skinId, dir: picked.dir });
                    occupy(picked.x, picked.y, picked.w, picked.h);
                    registerPerimeterPick(picked.skinId, picked.dir);
                }

                // Pass 2: fill remaining side spans in priority side order.
                for (let sideIndex = 0; sideIndex < sideOrder.length; sideIndex++) {
                    const side = sideOrder[sideIndex];
                    const limit = side === "S" || side === "N" ? w : h;
                    let cursor = 0;
                    while (cursor < limit) {
                        const candidates = collectSideCandidates(side, cursor);
                        if (candidates.length === 0) {
                            cursor++;
                            continue;
                        }
                        const picked = choosePenalizedWeightedCandidate(candidates, `side:${side}:${cursor}`);
                        placements.push({ x: picked.x, y: picked.y, w: picked.w, h: picked.h, skinId: picked.skinId, dir: picked.dir });
                        occupy(picked.x, picked.y, picked.w, picked.h);
                        registerPerimeterPick(picked.skinId, picked.dir);
                        cursor += picked.coverage;
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
                        dir: p.dir,
                        collision: stamp.collision,
                        blocksMovement: stamp.blocksMovement,
                    }, stampIndex);
                }
                return;
            }

            if (!forcedSkinId) {
                const candidateIds = resolveCandidateSkinIdsForStamp(stamp);
                const candidates = candidateIds
                    .map((id) => BUILDING_SKINS[id])
                    .filter((skin): skin is BuildingSkin => !!skin)
                    .flatMap((skin) => {
                        const monolithicSkin = isMonolithicBuildingSkin(skin);
                        const directionalSpriteId = monolithicSkin && buildingDir
                            ? resolveBuildingSpriteId(skin.roof, buildingDir)
                            : undefined;
                        const geometry = resolvePlacementGeometryForSkin(
                            skin,
                            `candidate-select:${skin.id}`,
                            directionalSpriteId,
                        );
                        if (buildingDir) {
                            const oriented = monolithicSkin
                                ? { w: geometry.w, h: geometry.h }
                                : orientBuildingFootprintByDir(geometry.w, geometry.h, skin.defaultFacing, buildingDir);
                            if (oriented.w <= w && oriented.h <= h) {
                                return [{ skin, oriented: { ...oriented, flipped: false } }];
                            }
                            return [];
                        }
                        if (typeof stamp.flipped === "boolean") {
                            const oriented = resolveFlippedFootprint(geometry.w, geometry.h, skin.isFlippable, stamp.flipped);
                            if (oriented.w <= w && oriented.h <= h) return [{ skin, oriented }];
                            return [];
                        }

                        const fitsNormal =
                            geometry.w <= w &&
                            geometry.h <= h;
                        const fitsFlipped =
                            skin.isFlippable &&
                            geometry.h <= w &&
                            geometry.w <= h;

                        if (fitsNormal) {
                            return [{ skin, oriented: { w: geometry.w, h: geometry.h, flipped: false } }];
                        }
                        if (fitsFlipped) {
                            return [{ skin, oriented: { w: geometry.h, h: geometry.w, flipped: true } }];
                        }
                        return [];
                    })
                    .filter(({ skin }) => {
                        const geometry = resolvePlacementGeometryForSkin(skin, `candidate-height-filter:${skin.id}`);
                        return stamp.heightUnitsMin === undefined || geometry.heightUnits >= stamp.heightUnitsMin;
                    })
                    .filter(({ skin }) => {
                        const geometry = resolvePlacementGeometryForSkin(skin, `candidate-height-filter:${skin.id}`);
                        return stamp.heightUnitsMax === undefined || geometry.heightUnits <= stamp.heightUnitsMax;
                    });

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
                        ...(buildingDir ? { dir: buildingDir } : { flipped: p.flipped }),
                        collision: stamp.collision,
                        blocksMovement: stamp.blocksMovement,
                    }, stampIndex);
                }

                if (EMIT_STRUCTURE_SUPPORT_TOPS && gaps.length > 0) {
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
            const skin = BUILDING_SKINS[forcedSkinId];
            if (!skin) {
                throw new Error(`[buildings] Missing skin entry for id=${forcedSkinId} (stamp (${stamp.x},${stamp.y}))`);
            }
            const isMonolithicSkin = isMonolithicBuildingSkin(skin);
            const resolvedPlacementSpriteId = isMonolithicSkin
                ? resolveBuildingSpriteId(skin.roof, buildingDir)
                : undefined;
            const skinGeometry = resolvePlacementGeometryForSkin(
                skin,
                `forced-placement:${skin.id}`,
                resolvedPlacementSpriteId,
            );
            const orientedByDir = isMonolithicSkin
                ? { w: skinGeometry.w, h: skinGeometry.h }
                : orientBuildingFootprintByDir(skinGeometry.w, skinGeometry.h, skin.defaultFacing, buildingDir);
            const oriented = buildingDir
                ? { ...orientedByDir, flipped: false }
                : resolveFlippedFootprint(skinGeometry.w, skinGeometry.h, skin.isFlippable, !!stamp.flipped);
            const placeW = oriented.w;
            const placeH = oriented.h;
            if (stamp.type === "building") {
                warnBuildingDimensionOverride({
                    stamp,
                    skinId: skin.id,
                    source: skinGeometry.source,
                    spriteId: skinGeometry.spriteId,
                    authoredW: w,
                    authoredH: h,
                    placedW: placeW,
                    placedH: placeH,
                    mapId,
                });
            }
            if (stamp.heightUnitsMin !== undefined && skinGeometry.heightUnits < stamp.heightUnitsMin) {
                throw new Error(`Building skin "${skin.id}" heightUnits ${skinGeometry.heightUnits} is below minimum ${stamp.heightUnitsMin}.`);
            }
            if (stamp.heightUnitsMax !== undefined && skinGeometry.heightUnits > stamp.heightUnitsMax) {
                throw new Error(`Building skin "${skin.id}" heightUnits ${skinGeometry.heightUnits} is above maximum ${stamp.heightUnitsMax}.`);
            }

            const heightUnits = skinGeometry.heightUnits | 0;
            const tileHeightUnits = Math.max(0, skinGeometry.tileHeightUnits);
            const scale = skin.spriteScale ?? 1;
            const anchorLiftPx = isMonolithicSkin
                ? 0
                : (((skin.anchorLiftUnits ?? 0) | 0) * HEIGHT_UNIT_PX);
            const wallLiftPx = ((skin.wallLiftUnits ?? 0) | 0) * HEIGHT_UNIT_PX;
            const roofLiftPx = (skin.roofLiftPx ?? (((skin.roofLiftUnits ?? 0) | 0) * HEIGHT_UNIT_PX)) * scale;
            const offsetPx = skin.offsetPx ?? { x: 0, y: 0 };
            const anchorOffsetPx = skin.anchorOffsetPx ?? { x: 0, y: 0 };
            const sliceOffsetPx = skin.slice?.offsetPx ?? { x: 0, y: 0 };
            const sliceOriginPx =
                (buildingDir ? skin.slice?.originPxByDir?.[buildingDir] : undefined) ??
                skin.slice?.originPx;

            if (skin.wallSouth.length === 0 || skin.wallEast.length === 0 || !skin.roof) {
                throw new Error(`Building skin "${skin.id}" is missing required sprites.`);
            }

            const roofSpriteId = resolveBuildingSpriteId(skin.roof, buildingDir);

            if (isMonolithicSkin) {
                const seAnchor = seAnchorFromTopLeft(sx, sy, placeW, placeH);
                const overlay: StampOverlay = {
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
                    spriteId: roofSpriteId,
                    drawDxOffset: offsetPx.x + anchorOffsetPx.x,
                    drawDyOffset: anchorLiftPx + offsetPx.y + anchorOffsetPx.y,
                    sliceOffsetPx,
                    sliceOriginPx,
                    flipX: oriented.flipped,
                    scale,
                    kind: "ROOF",
                    monolithicSemanticSkinId: skin.id,
                    monolithicSemanticSpriteId: roofSpriteId,
                    layerRole: "STRUCTURE",
                };
                overlay.applyResolvedStructuralRoofHeightUnits = (heightUnits: number): void => {
                    if (!Number.isFinite(heightUnits)) return;
                    const normalizedHeightUnits = Math.max(0, heightUnits | 0);
                    if (overlay.resolvedStructuralRoofHeightUnits === normalizedHeightUnits) return;
                    overlay.resolvedStructuralRoofHeightUnits = normalizedHeightUnits;
                    refreshTileHeightGrid();
                };
                overlays.push(overlay);
                recordHeightStamp(
                    sx,
                    sy,
                    placeW,
                    placeH,
                    renderHeightUnitsToSweepTileHeight(zBase) + tileHeightUnits,
                    {
                        baseSweepZ: renderHeightUnitsToSweepTileHeight(zBase),
                        overlay,
                    },
                );

                if (EMIT_STRUCTURE_SUPPORT_TOPS) {
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
                }
                if (stampBlocksMovement(stamp, true)) {
                    bakeBlockedFootprint(sx, sy, placeW, placeH, zBase, zBase + Math.max(1, heightUnits));
                }
                return;
            }

            // South edge (bottom row)
            for (let i = 0; i < placeW; i++) {
                const spriteId = resolveBuildingSpriteId(
                    skin.wallSouth[Math.min(i, skin.wallSouth.length - 1)],
                    buildingDir,
                );
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
                const spriteId = resolveBuildingSpriteId(
                    skin.wallEast[Math.min(j, skin.wallEast.length - 1)],
                    buildingDir,
                );
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
                spriteId: roofSpriteId,
                drawDyOffset: anchorLiftPx + roofLiftPx + offsetPx.y + anchorOffsetPx.y,
                drawDxOffset: offsetPx.x + anchorOffsetPx.x,
                sliceOffsetPx,
                sliceOriginPx,
                flipX: oriented.flipped,
                scale,
                kind: "ROOF",
                layerRole: "STRUCTURE",
            });
            recordHeightStamp(
                sx,
                sy,
                placeW,
                placeH,
                renderHeightUnitsToSweepTileHeight(zBase) + tileHeightUnits,
            );

            if (EMIT_STRUCTURE_SUPPORT_TOPS) {
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
            }
            if (stampBlocksMovement(stamp, true)) {
                bakeBlockedFootprint(sx, sy, placeW, placeH, zBase, zBase + Math.max(1, heightUnits));
            }
            return;
        }

        const slotForType: Record<string, string> = {
            sea: "SEA_FLOOR",
        };
        const runtimeFamilyForStamp = (() => {
            if (stamp.type === "sidewalk") return "sidewalk" as const;
            if (stamp.type === "road") return "asphalt" as const;
            if (stamp.type === "asphalt") return "asphalt" as const;
            if (stamp.type === "park") return "park" as const;
            return undefined;
        })();
        if (runtimeFamilyForStamp) {
            for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    const tx = sx + dx;
                    const ty = sy + dy;
                    const runtimeTop = pickRuntimeSquareTop(runtimeFamilyForStamp, tx, ty);
                    if (runtimeFamilyForStamp === "sidewalk") {
                        maybeAddSemanticDecal(tx, ty, zBase, zBase | 0, "sidewalk", floorAnchorY);
                    } else if (runtimeFamilyForStamp === "asphalt") {
                        maybeAddSemanticDecal(tx, ty, zBase, zBase | 0, "asphalt", floorAnchorY);
                    }
                    addSurface({
                        id: `stamp_${runtimeFamilyForStamp}_${tx}_${ty}_${zBase}`,
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
        if (stamp.type === "lamp_post") {
            const w = Math.max(1, (stamp.w ?? 1) | 0);
            const h = Math.max(1, (stamp.h ?? 1) | 0);
            const sx = (stamp.x | 0) + originTx;
            const sy = (stamp.y | 0) + originTy;
            const zBase = stamp.z ?? 0;
            const seAnchor = seAnchorFromTopLeft(sx, sy, w, h);
            const preset = lampPostPreset();
            overlays.push({
                id: `lamp_post_${sx}_${sy}_${zBase}`,
                tx: sx,
                ty: sy,
                w,
                h,
                seTx: seAnchor.anchorTx,
                seTy: seAnchor.anchorTy,
                anchorTx: seAnchor.anchorTx,
                anchorTy: seAnchor.anchorTy,
                z: zBase,
                spriteId: preset.spriteId,
                drawDxOffset: preset.drawDxOffset,
                drawDyOffset: preset.drawDyOffset,
                scale: 1,
                kind: "PROP",
            });
            recordHeightStamp(
                sx,
                sy,
                w,
                h,
                renderHeightUnitsToSweepTileHeight(Math.max(zBase + 1, preset.topGlow.heightUnits)),
            );
            runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.SHADOW_OR_LIGHT_PRECOMPUTE, () => {
                lightDefs.push({
                    id: `lamp_post_ground_${sx}_${sy}_${zBase}`,
                    worldX: sx * KENNEY_TILE_WORLD,
                    worldY: sy * KENNEY_TILE_WORLD,
                    zBase: preset.groundPool.heightUnits,
                    zLogical: Math.floor(preset.groundPool.heightUnits + 1e-3),
                    heightUnits: preset.groundPool.heightUnits,
                    intensity: preset.groundPool.intensity,
                    radiusPx: preset.groundPool.radiusPx,
                    colorMode: "standard",
                    strength: "medium",
                    color: preset.groundPool.color,
                    tintStrength: preset.groundPool.tintStrength,
                    shape: preset.groundPool.shape,
                    flicker: { kind: "NONE" },
                });
                lightDefs.push({
                    id: `lamp_post_top_${sx}_${sy}_${zBase}`,
                    worldX: sx * KENNEY_TILE_WORLD,
                    worldY: sy * KENNEY_TILE_WORLD,
                    zBase: preset.topGlow.heightUnits,
                    zLogical: Math.floor(preset.topGlow.heightUnits + 1e-3),
                    heightUnits: preset.topGlow.heightUnits,
                    intensity: preset.topGlow.intensity,
                    radiusPx: preset.topGlow.radiusPx,
                    colorMode: "standard",
                    strength: "medium",
                    color: preset.topGlow.color,
                    tintStrength: preset.topGlow.tintStrength,
                    shape: preset.topGlow.shape,
                    flicker: { kind: "NONE" },
                });
            });
            if (stampBlocksMovement(stamp, false)) {
                bakeBlockedFootprint(sx, sy, w, h, zBase, zBase + 1);
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
            const isStreetLampProp = prop.id.startsWith("street_lamp_");
            const propDir = stamp.dir as import("../../../engine/render/sprites/dir8").Dir8 | undefined;
            const resolvedSpriteId = resolvePropSprite(prop, propDir);

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
                zVisualOffsetUnits: stamp.zVisualOffsetUnits,
                spriteId: resolvedSpriteId,
                drawDyOffset: anchorLiftPx + offset.y,
                drawDxOffset: offset.x,
                flipX: propOriented.flipped,
                scale: 1,
                kind: "PROP",
            });
            if (typeof prop.lightHeightOffsetUnits === "number") {
                recordHeightStamp(
                    (stamp.x | 0) + originTx,
                    (stamp.y | 0) + originTy,
                    w,
                    h,
                    renderHeightUnitsToSweepTileHeight(zBase + Math.max(1, prop.lightHeightOffsetUnits)),
                );
            }

            if (isStreetLampProp) {
                const semanticType = prop.id as "street_lamp_n" | "street_lamp_e" | "street_lamp_s" | "street_lamp_w";
                const preset = streetLampPreset(semanticType);
                const lightHeightOffsetUnits = prop.lightHeightOffsetUnits ?? 0;
                const supportHeightUnits = zBase;
                const heightUnits = zBase + (prop.anchorLiftUnits ?? 0) + lightHeightOffsetUnits;
                runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.SHADOW_OR_LIGHT_PRECOMPUTE, () => {
                    lightDefs.push({
                        id: `prop_light_${prop.id}_${anchorTx}_${anchorTy}_${zBase}`,
                        worldX: ((stamp.x | 0) + originTx) * KENNEY_TILE_WORLD,
                        worldY: ((stamp.y | 0) + originTy) * KENNEY_TILE_WORLD,
                        zBase: supportHeightUnits,
                        zLogical: Math.floor(supportHeightUnits + 1e-3),
                        supportHeightUnits,
                        heightUnits,
                        poolHeightOffsetUnits: prop.lightPoolHeightOffsetUnits ?? -lightHeightOffsetUnits,
                        screenOffsetPx: prop.lightScreenOffsetPx ?? { x: 0, y: 0 },
                        intensity: 0.85,
                        radiusPx: 140,
                        colorMode: "standard",
                        strength: "medium",
                        color: preset.color,
                        tintStrength: preset.tintStrength,
                        shape: preset.shape,
                        pool: preset.pool,
                        cone: preset.cone,
                        flicker: { kind: "NONE" },
                    });
                });
            }

            if (stampBlocksMovement(stamp, !isStreetLampProp)) {
                bakeBlockedFootprint((stamp.x | 0) + originTx, (stamp.y | 0) + originTy, w, h);
            }
            return;
        }
        if (stamp.type === "building") {
            compileBuildingStamp(stamp, stampIndex);
            return;
        }
        compileBuildingStamp(stamp, stampIndex);
    };
    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.STRUCTURE_PLACEMENT, () => {
        if (def.stamps && def.stamps.length > 0) {
            for (let i = 0; i < def.stamps.length; i++) {
                const s = def.stamps[i];
                compileStamp(s, i);
            }
        }
    });

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

    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.COLLISION_NAV_OR_BLOCKER_GENERATION, () => {
        for (let coordI = 0; coordI < surfaceCoords.length; coordI++) {
            const tx = surfaceCoords[coordI].tx;
            const ty = surfaceCoords[coordI].ty;
            const hereSurface = highestSurfaceAt(tx, ty);
            if (!hereSurface) continue;
            const zHere = hereSurface.zBase;
            const hereIsOcean = hereSurface.tile.kind === TILE_ID_OCEAN;

            for (let d = 0; d < DIRS.length; d++) {
                const { dir, dx, dy } = DIRS[d];
                const nTx = tx + dx;
                const nTy = ty + dy;

                const neighborSurface = highestSurfaceAt(nTx, nTy);
                const neighborIsOcean = neighborSurface?.tile.kind === TILE_ID_OCEAN;
                if (hereIsOcean && neighborIsOcean) continue;

                const neighborZ = neighborSurface?.zBase ?? apronBaseZ;
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

                const ownerSurface = ownerIsHere ? hereSurface : neighborSurface;
                if (ownerSurface?.tile.kind === TILE_ID_OCEAN) continue;
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
    });

    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.COLLISION_NAV_OR_BLOCKER_GENERATION, () => {
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
    });

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

    function decalsInView(view: ViewRect): DecalPiece[] {
        if (decals.length === 0) return [];
        const out: DecalPiece[] = [];
        for (let i = 0; i < decals.length; i++) {
            const d = decals[i];
            if (d.tx < view.minTx || d.tx > view.maxTx) continue;
            if (d.ty < view.minTy || d.ty > view.maxTy) continue;
            out.push(d);
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

    const OCCLUSION_CHUNK_SIZE = 16;
    const occlusionByBandAndClass = new Map<number, {
        surface: Map<OcclusionChunkKey, OcclusionChunkBucket>;
        volumetric: Map<OcclusionChunkKey, OcclusionChunkBucket>;
    }>();
    const ensureOcclusionBand = (z: number) => {
        let band = occlusionByBandAndClass.get(z);
        if (!band) {
            band = { surface: new Map(), volumetric: new Map() };
            occlusionByBandAndClass.set(z, band);
        }
        return band;
    };
    const addOcclusionRect = (
        z: number,
        cls: OcclusionClass,
        tx0In: number,
        ty0In: number,
        tx1In: number,
        ty1In: number,
    ) => {
        const tx0 = Math.floor(Math.min(tx0In, tx1In));
        const ty0 = Math.floor(Math.min(ty0In, ty1In));
        const tx1 = Math.ceil(Math.max(tx0In, tx1In));
        const ty1 = Math.ceil(Math.max(ty0In, ty1In));
        if (tx1 <= tx0 || ty1 <= ty0) return;

        const band = ensureOcclusionBand(z);
        const classMap = cls === "SURFACE" ? band.surface : band.volumetric;
        const cx0 = Math.floor(tx0 / OCCLUSION_CHUNK_SIZE);
        const cy0 = Math.floor(ty0 / OCCLUSION_CHUNK_SIZE);
        const cx1 = Math.floor((tx1 - 1) / OCCLUSION_CHUNK_SIZE);
        const cy1 = Math.floor((ty1 - 1) / OCCLUSION_CHUNK_SIZE);
        for (let cy = cy0; cy <= cy1; cy++) {
            for (let cx = cx0; cx <= cx1; cx++) {
                const chunkTx0 = cx * OCCLUSION_CHUNK_SIZE;
                const chunkTy0 = cy * OCCLUSION_CHUNK_SIZE;
                const chunkTx1 = chunkTx0 + OCCLUSION_CHUNK_SIZE;
                const chunkTy1 = chunkTy0 + OCCLUSION_CHUNK_SIZE;
                const clipTx0 = Math.max(tx0, chunkTx0);
                const clipTy0 = Math.max(ty0, chunkTy0);
                const clipTx1 = Math.min(tx1, chunkTx1);
                const clipTy1 = Math.min(ty1, chunkTy1);
                if (clipTx1 <= clipTx0 || clipTy1 <= clipTy0) continue;
                const key = `${cx},${cy}`;
                let bucket = classMap.get(key);
                if (!bucket) {
                    bucket = { chunkX: cx, chunkY: cy, entries: [] };
                    classMap.set(key, bucket);
                }
                bucket.entries.push({
                    tx0: clipTx0,
                    ty0: clipTy0,
                    tx1: clipTx1,
                    ty1: clipTy1,
                    z,
                    cls,
                });
            }
        }
    };

    runWithLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.COLLISION_NAV_OR_BLOCKER_GENERATION, () => {
        for (const surfaces of surfacesByKey.values()) {
            for (let i = 0; i < surfaces.length; i++) {
                const s = surfaces[i];
                if ((s.zBase | 0) <= 0) continue;
                const isBuildingSurface = s.id.startsWith("building_floor_");
                addOcclusionRect(
                    s.zBase | 0,
                    isBuildingSurface ? "VOLUMETRIC" : "SURFACE",
                    s.tx,
                    s.ty,
                    s.tx + 1,
                    s.ty + 1,
                );
            }
        }
        for (let i = 0; i < decals.length; i++) {
            const d = decals[i];
            const z = d.zBase | 0;
            if (z <= 0) continue;
            const tx = Math.floor(d.tx);
            const ty = Math.floor(d.ty);
            addOcclusionRect(z, "SURFACE", tx, ty, tx + 1, ty + 1);
        }
        for (const list of occludersByLayer.values()) {
            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                const tw = p.tw ?? 1;
                const th = p.th ?? 1;
                const z = Math.floor((p.zTo ?? p.zFrom) + 1e-3);
                addOcclusionRect(z, "VOLUMETRIC", p.tx, p.ty, p.tx + tw, p.ty + th);
            }
        }
        for (const list of facePiecesByLayer.values()) {
            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                if (p.layerRole !== "STRUCTURE") continue;
                const tw = p.tw ?? 1;
                const th = p.th ?? 1;
                const z = Math.floor((p.zTo ?? p.zFrom) + 1e-3);
                addOcclusionRect(z, "VOLUMETRIC", p.tx, p.ty, p.tx + tw, p.ty + th);
            }
        }
        for (let i = 0; i < overlays.length; i++) {
            const o = overlays[i];
            if (!(o.layerRole === "STRUCTURE" || (o.kind ?? "ROOF") === "ROOF")) continue;
            const z = Math.floor(o.z + 1e-3);
            addOcclusionRect(z, "VOLUMETRIC", o.tx, o.ty, o.tx + o.w, o.ty + o.h);
        }
    });
    const occlusionGeometry: CompiledOcclusionGeometry = {
        chunkSize: OCCLUSION_CHUNK_SIZE,
        byBandAndClass: occlusionByBandAndClass,
        availableBands: Array.from(occlusionByBandAndClass.keys()).sort((a, b) => a - b),
    };
    const compiled = runWithLoadProfilerSubphase(
        LOAD_PROFILER_SUBPHASE.POST_COMPILE_INDEXING_OR_FINALIZATION,
        (): CompiledKenneyMap => {
            tileHeightGrid = buildTileHeightGrid();

            return {
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
                lightDefs,

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
                decals,
                decalsInView,
                blockedTiles,
                blockedTileSpansByKey,
                tileHeightGrid,
                roadMarkingContext: roadMarkingContextCompat,
                roadMarkings: roadMarkingsAll,
                roadAreaMaskWorld,
                roadAreaWidthWorld,
                roadCenterMaskHWorld,
                roadCenterWidthHWorld,
                roadCenterMaskVWorld,
                roadCenterWidthVWorld,
                roadCenterMaskWorld,
                roadCenterWidthWorld,
                roadIntersectionMaskWorld,
                roadCrossingMaskWorld,
                roadCrossingDirWorld,
                roadStopMaskWorld,
                roadStopDirWorld,
                roadIntersectionCenterTilesWorld,
                roadIntersectionBoundsWorld,
                roadIntersectionSeedsWorld,
                roadIntersectionClusterCentersWorld,
                roadSemanticRects: roadSemanticRectsCompiled,
                occlusionGeometry,
                isRoadWorld,
            };
        },
    );

    return compiled;
}
