// src/game/map/kenneyMapLoader.ts
import type { SemanticStamp, TableMapDef } from "../formats/table/tableMapTypes";
import { KENNEY_TILE_ANCHOR_Y, KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
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
export type LightDef = {
    worldX: number;
    worldY: number;
    heightUnits: number;
    poolHeightOffsetUnits?: number;
    screenOffsetPx?: { x: number; y: number };
    intensity: number;
    radiusPx: number;
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
    isRoadWorld(x: number, y: number): boolean;
};

type RoadRect = { x: number; y: number; w: number; h: number };
type AuthRoadRect = RoadRect & { orient: "H" | "V" };

function mergeRoadRectsPreserveOrient(rects: AuthRoadRect[]): AuthRoadRect[] {
    const out = rects.map((r) => ({
        x: r.x | 0,
        y: r.y | 0,
        w: Math.max(1, r.w | 0),
        h: Math.max(1, r.h | 0),
        orient: r.orient,
    }));
    let changed = true;
    while (changed) {
        changed = false;
        outer: for (let i = 0; i < out.length; i++) {
            for (let j = i + 1; j < out.length; j++) {
                const a = out[i];
                const b = out[j];
                if (a.orient !== b.orient) continue;
                if (a.orient === "H") {
                    if (a.x !== b.x || a.w !== b.w) continue;
                    if (a.y + a.h !== b.y && b.y + b.h !== a.y) continue;
                    const y0 = Math.min(a.y, b.y);
                    out[i] = { x: a.x, y: y0, w: a.w, h: a.h + b.h, orient: "H" };
                    out.splice(j, 1);
                    changed = true;
                    break outer;
                }
                if (a.y !== b.y || a.h !== b.h) continue;
                if (a.x + a.w !== b.x && b.x + b.w !== a.x) continue;
                const x0 = Math.min(a.x, b.x);
                out[i] = { x: x0, y: a.y, w: a.w + b.w, h: a.h, orient: "V" };
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
    const INHERIT_DOMINANT_FLOOR_SKIN = "__INHERIT_DOMINANT_FLOOR__";
    const RUNTIME_TILE_SKIN_PREFIX = "__RUNTIME_SQUARE_128__";
    const runtimeTileSkin = (family: RuntimeFloorTop["family"]) => `${RUNTIME_TILE_SKIN_PREFIX}${family}`;

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
    const originTx = def.centerOnZero ? -Math.floor(boundsCenterTx) : 0;
    const originTy = def.centerOnZero ? -Math.floor(boundsCenterTy) : 0;

    const triggerDefs: TriggerDef[] = pendingTriggers.map((t) => ({
        id: t.id,
        type: t.type,
        tx: t.tx + originTx,
        ty: t.ty + originTy,
        radius: t.radius,
    }));
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
    const lightDefs: LightDef[] = (def.lights ?? []).map((light) => {
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
        return {
            worldX: (light.x + originTx + (isStreetLampSemantic ? 0 : 0.5)) * KENNEY_TILE_WORLD,
            worldY: (light.y + originTy + (isStreetLampSemantic ? 0 : 0.5)) * KENNEY_TILE_WORLD,
            heightUnits: light.heightUnits ?? 0,
            poolHeightOffsetUnits: light.poolHeightOffsetUnits ?? 0,
            intensity: semanticPreset?.intensity ?? light.intensity,
            radiusPx: semanticPreset?.radiusPx ?? light.radiusPx,
            color: light.color ?? semanticPreset?.color,
            tintStrength: light.tintStrength ?? semanticPreset?.tintStrength,
            shape: light.shape ?? semanticPreset?.shape ?? "RADIAL",
            pool: light.pool ?? semanticPreset?.pool,
            cone: light.cone ?? semanticPreset?.cone,
            flicker: light.flicker ?? semanticPreset?.flicker ?? { kind: "NONE" },
        };
    });

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
    const authRoadRects = (() => {
        const authoredRects = def.roadSemanticRects && def.roadSemanticRects.length > 0
            ? def.roadSemanticRects
            : null;
        if (authoredRects) {
            return authoredRects.map((r) => {
                const w = Math.max(1, (r.w ?? 1) | 0);
                const h = Math.max(1, (r.h ?? 1) | 0);
                const orient: "H" | "V" = w >= h ? "H" : "V";
                return { x: r.x | 0, y: r.y | 0, w, h, orient };
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
                w,
                h,
                orient,
            });
        }
        return out;
    })();
    const mergedRoadRects = mergeRoadRectsPreserveOrient(authRoadRects);
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
        };
    });
    const markRoadAreaWorld = (txWorld: number, tyWorld: number, width: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const idx = worldIndex(txWorld, tyWorld);
        roadAreaMaskWorld[idx] = 1;
        const w = Math.max(0, Math.min(255, width | 0));
        if (w > roadAreaWidthWorld[idx]) roadAreaWidthWorld[idx] = w;
    };
    const markRoadCenterHWorld = (txWorld: number, tyWorld: number, width: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const idx = worldIndex(txWorld, tyWorld);
        if (roadAreaMaskWorld[idx] !== 1) return;
        roadCenterMaskHWorld[idx] = 1;
        const w = Math.max(0, Math.min(255, width | 0));
        if (w > roadCenterWidthHWorld[idx]) roadCenterWidthHWorld[idx] = w;
        roadCenterMaskWorld[idx] = (roadCenterMaskHWorld[idx] | roadCenterMaskVWorld[idx]) as 0 | 1;
        const mergedW = Math.max(roadCenterWidthHWorld[idx], roadCenterWidthVWorld[idx]) | 0;
        roadCenterWidthWorld[idx] = mergedW;
    };
    const markRoadCenterVWorld = (txWorld: number, tyWorld: number, width: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const idx = worldIndex(txWorld, tyWorld);
        if (roadAreaMaskWorld[idx] !== 1) return;
        roadCenterMaskVWorld[idx] = 1;
        const w = Math.max(0, Math.min(255, width | 0));
        if (w > roadCenterWidthVWorld[idx]) roadCenterWidthVWorld[idx] = w;
        roadCenterMaskWorld[idx] = (roadCenterMaskHWorld[idx] | roadCenterMaskVWorld[idx]) as 0 | 1;
        const mergedW = Math.max(roadCenterWidthHWorld[idx], roadCenterWidthVWorld[idx]) | 0;
        roadCenterWidthWorld[idx] = mergedW;
    };
    for (let i = 0; i < roadBands.length; i++) {
        const band = roadBands[i];
        const sx = band.x0;
        const sy = band.y0;
        const rw = band.x1 - band.x0 + 1;
        const rh = band.y1 - band.y0 + 1;
        const areaWidth = band.roadW;
        for (let dx = 0; dx < rw; dx++) {
            for (let dy = 0; dy < rh; dy++) {
                markRoadAreaWorld(sx + dx, sy + dy, areaWidth);
            }
        }
        if (band.orient === "H") {
            const y0 = sy + Math.floor((rh - 1) / 2);
            const y1 = sy + Math.floor(rh / 2);
            for (let yy = y0; yy <= y1; yy++) {
                for (let xx = sx; xx <= band.x1; xx++) {
                    markRoadCenterHWorld(xx, yy, rh);
                }
            }
        } else {
            const x0 = sx + Math.floor((rw - 1) / 2);
            const x1 = sx + Math.floor(rw / 2);
            for (let xx = x0; xx <= x1; xx++) {
                for (let yy = sy; yy <= band.y1; yy++) {
                    markRoadCenterVWorld(xx, yy, rw);
                }
            }
        }
    }
    const isOverlapAt = (x: number, y: number): boolean => {
        if (!worldInBounds(x, y)) return false;
        const i = worldIndex(x, y);
        return roadCenterMaskHWorld[i] === 1 && roadCenterMaskVWorld[i] === 1;
    };
    {
        const visitedOverlap = new Uint8Array(worldW * worldH);
        const qx: number[] = [];
        const qy: number[] = [];
        const neighbors4 = [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
        ];

        for (let tyWorld = originTy; tyWorld <= worldMaxTy; tyWorld++) {
            for (let txWorld = originTx; txWorld <= worldMaxTx; txWorld++) {
                const startIdx = worldIndex(txWorld, tyWorld);
                if (!isOverlapAt(txWorld, tyWorld)) continue;
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

                    // Footprint axis widths:
                    // X span (wH) comes from vertical-road band width.
                    if (roadCenterMaskVWorld[ci] === 1) {
                        const w = roadCenterWidthVWorld[ci] | 0;
                        if (w > wH) wH = w;
                    }
                    // Y span (wV) comes from horizontal-road band width.
                    if (roadCenterMaskHWorld[ci] === 1) {
                        const w = roadCenterWidthHWorld[ci] | 0;
                        if (w > wV) wV = w;
                    }

                    for (let ni = 0; ni < neighbors4.length; ni++) {
                        const nx = cx + neighbors4[ni].dx;
                        const ny = cy + neighbors4[ni].dy;
                        if (!isOverlapAt(nx, ny)) continue;
                        const niIdx = worldIndex(nx, ny);
                        if (visitedOverlap[niIdx] === 1) continue;
                        visitedOverlap[niIdx] = 1;
                        qx.push(nx);
                        qy.push(ny);
                    }
                }

                wH = Math.max(1, wH | 0);
                wV = Math.max(1, wV | 0);

                // Half-tile anchor in tile-center space (x2 units).
                const anchor2X = minX + maxX + 1;
                const anchor2Y = minY + maxY + 1;

                const rectBoundsFromCenter2 = (c2: number, w: number): { a: number; b: number } => {
                    // Convert half-tile center (2x units) into inclusive tile bounds.
                    const a = Math.floor((c2 - w) / 2);
                    return { a, b: a + w - 1 };
                };

                const xb = rectBoundsFromCenter2(anchor2X, wH);
                const yb = rectBoundsFromCenter2(anchor2Y, wV);

                const x0 = xb.a;
                const x1 = xb.b;
                const y0 = yb.a;
                const y1 = yb.b;

                for (let yy = y0; yy <= y1; yy++) {
                    for (let xx = x0; xx <= x1; xx++) {
                        if (!worldInBounds(xx, yy)) continue;
                        const ii = worldIndex(xx, yy);
                        if (roadAreaMaskWorld[ii] !== 1) continue;
                        roadIntersectionMaskWorld[ii] = 1;
                    }
                }

                // Debug markers consumed by overlay.
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

    // Build intersection-component bounds (AABB) from the final intersection mask.
    {
        const visitedIntersection = new Uint8Array(worldW * worldH);
        const qx: number[] = [];
        const qy: number[] = [];
        const tilesX: number[] = [];
        const tilesY: number[] = [];
        const neighbors4 = [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
        ];

        for (let tyWorld = originTy; tyWorld <= worldMaxTy; tyWorld++) {
            for (let txWorld = originTx; txWorld <= worldMaxTx; txWorld++) {
                const startIdx = worldIndex(txWorld, tyWorld);
                if (roadIntersectionMaskWorld[startIdx] !== 1) continue;
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
                        if (roadIntersectionMaskWorld[niIdx] !== 1) continue;
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
            }
        }
    }

    const writeCrossing = (txWorld: number, tyWorld: number, dir: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const i = worldIndex(txWorld, tyWorld);
        if (roadAreaMaskWorld[i] !== 1) return;
        if (roadIntersectionMaskWorld[i] === 1) return;
        if (roadCrossingMaskWorld[i] === 1) return;
        roadCrossingMaskWorld[i] = 1;
        roadCrossingDirWorld[i] = dir;
    };
    const writeStop = (txWorld: number, tyWorld: number, dir: number) => {
        if (!worldInBounds(txWorld, tyWorld)) return;
        const i = worldIndex(txWorld, tyWorld);
        if (roadAreaMaskWorld[i] !== 1) return;
        if (roadIntersectionMaskWorld[i] === 1) return;
        if (roadCrossingMaskWorld[i] === 1) return;
        if (roadStopMaskWorld[i] === 1) return;
        roadStopMaskWorld[i] = 1;
        roadStopDirWorld[i] = dir;
    };

    // Build directional halos from bounds; direction is assigned only here.
    for (let bi = 0; bi < roadIntersectionBoundsWorld.length; bi++) {
        const b = roadIntersectionBoundsWorld[bi];

        // Crossing ring (distance 1).
        for (let x = b.minX; x <= b.maxX; x++) {
            writeCrossing(x, b.minY - 1, ROAD_DIR_N);
            writeCrossing(x, b.maxY + 1, ROAD_DIR_S);
        }
        for (let y = b.minY; y <= b.maxY; y++) {
            writeCrossing(b.minX - 1, y, ROAD_DIR_W);
            writeCrossing(b.maxX + 1, y, ROAD_DIR_E);
        }

        // Stop-bar ring (distance 2).
        for (let x = b.minX; x <= b.maxX; x++) {
            writeStop(x, b.minY - 2, ROAD_DIR_N);
            writeStop(x, b.maxY + 2, ROAD_DIR_S);
        }
        for (let y = b.minY; y <= b.maxY; y++) {
            writeStop(b.minX - 2, y, ROAD_DIR_W);
            writeStop(b.maxX + 2, y, ROAD_DIR_E);
        }
    }

    const isRoadWorld = (txWorld: number, tyWorld: number): boolean => {
        if (!worldInBounds(txWorld, tyWorld)) return false;
        return roadAreaMaskWorld[worldIndex(txWorld, tyWorld)] === 1;
    };

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
            if (!nt || nt.kind === "VOID" || nt.kind === "SPAWN") continue;
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
    const roadMarkingPipeline = buildRoadMarkingsPipeline({
        w: worldW,
        h: worldH,
        originTx,
        originTy,
        isRoadFromSemantics: (x, y) => isRoadWorld(x, y),
        roadBands,
        roadIntersectionMaskWorld,
        roadCrossingMaskWorld,
        roadCrossingDirWorld,
        roadStopMaskWorld,
        roadStopDirWorld,
        emitStopbarCrossingOverlay: true,
        getTileZAt: (x, y) => {
            const tile = getTile(x, y);
            return tile.kind === "VOID" ? 0 : (tile.h | 0);
        },
    });
    for (let i = 0; i < roadMarkingPipeline.markings.length; i++) {
        const m = roadMarkingPipeline.markings[i];
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
            runtimeTop: finalRuntimeTop,
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

    const EMIT_STRUCTURE_SUPPORT_TOPS = false;

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
            if (stampBlocksMovement(stamp, true)) bakeBlockedFootprint(sx, sy, placeW, placeH);
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
            lightDefs.push({
                worldX: sx * KENNEY_TILE_WORLD,
                worldY: sy * KENNEY_TILE_WORLD,
                heightUnits: preset.groundPool.heightUnits,
                intensity: preset.groundPool.intensity,
                radiusPx: preset.groundPool.radiusPx,
                color: preset.groundPool.color,
                tintStrength: preset.groundPool.tintStrength,
                shape: preset.groundPool.shape,
                flicker: { kind: "NONE" },
            });
            lightDefs.push({
                worldX: sx * KENNEY_TILE_WORLD,
                worldY: sy * KENNEY_TILE_WORLD,
                heightUnits: preset.topGlow.heightUnits,
                intensity: preset.topGlow.intensity,
                radiusPx: preset.topGlow.radiusPx,
                color: preset.topGlow.color,
                tintStrength: preset.topGlow.tintStrength,
                shape: preset.topGlow.shape,
                flicker: { kind: "NONE" },
            });
            if (stampBlocksMovement(stamp, false)) {
                bakeBlockedFootprint(sx, sy, w, h);
            }
            return;
        }
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

            if (isStreetLampProp) {
                const semanticType = prop.id as "street_lamp_n" | "street_lamp_e" | "street_lamp_s" | "street_lamp_w";
                const preset = streetLampPreset(semanticType);
                const lightHeightOffsetUnits = prop.lightHeightOffsetUnits ?? 0;
                lightDefs.push({
                    worldX: ((stamp.x | 0) + originTx) * KENNEY_TILE_WORLD,
                    worldY: ((stamp.y | 0) + originTy) * KENNEY_TILE_WORLD,
                    heightUnits: (prop.anchorLiftUnits ?? 0) + lightHeightOffsetUnits,
                    poolHeightOffsetUnits: prop.lightPoolHeightOffsetUnits ?? -lightHeightOffsetUnits,
                    screenOffsetPx: prop.lightScreenOffsetPx ?? { x: 0, y: 0 },
                    intensity: 0.85,
                    radiusPx: 140,
                    color: preset.color,
                    tintStrength: preset.tintStrength,
                    shape: preset.shape,
                    pool: preset.pool,
                    cone: preset.cone,
                    flicker: { kind: "NONE" },
                });
            }

            if (stampBlocksMovement(stamp, !isStreetLampProp)) {
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
        roadMarkingContext: roadMarkingPipeline.context,
        roadMarkings: roadMarkingPipeline.markings,
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
        isRoadWorld,
    };

    const getTileWithRunResolver = (tx: number, ty: number): IsoTile => {
        return getTile(tx, ty);
    };

    (compiled as any).getTileWithRunResolver = getTileWithRunResolver;

    return compiled;
}
