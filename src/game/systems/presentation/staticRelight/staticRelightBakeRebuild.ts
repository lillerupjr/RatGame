import { type World } from "../../../../engine/world/world";
import { worldToScreen } from "../../../../engine/math/iso";
import { KENNEY_TILE_ANCHOR_Y, KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import {
  getActiveMap as getActiveCompiledMap,
  heightAtWorld,
  type StampOverlay,
} from "../../../map/compile/kenneyMap";
import {
  getRuntimeDecalSprite,
  getSpriteByIdForDarknessPercent,
  getTileSpriteById,
} from "../../../../engine/render/sprites/renderSprites";
import { getDecalSpriteId, type RuntimeDecalSetId } from "../../../content/runtimeDecalConfig";
import { roadMarkingDecalScale, shouldPixelSnapRoadMarking } from "../../../roads/roadMarkingRender";
import { getUserSettings } from "../../../../userSettings";
import {
  resolveActivePaletteId,
  resolveActivePaletteSwapWeights,
  resolveActivePaletteVariantKey,
} from "../../../render/activePalette";
import { buildFrameWorldLightRegistry } from "../worldLightRenderPieces";
import {
  buildStaticRelightBakeContextKey,
  buildStaticRelightPieceKey,
  type StaticRelightBakeStore,
} from "../staticRelightBake";
import {
  type StaticRelightDarknessBucket,
  type StaticRelightLightCandidate,
} from "../staticRelightPoc";
import { snapPx } from "../../../../engine/render/pixelPerfect";
import {
  classifyStaticRelightBakeAsset,
  createStaticRelightBakeDependencyTracker,
  noteStaticRelightDependencyState,
} from "./staticRelightBakeDependencies";
import {
  hasNearbyStaticRelightTileLight,
  planStaticRelightBlendForPiece,
} from "./staticRelightBlendPlanner";
import { composePieceLocalRelightBakedCanvas } from "./staticRelightBakeComposer";
import {
  type StaticGroundRelightBakeResult,
  type StaticRelightFrameContext,
  type StaticRelightRuntimeState,
} from "./staticRelightTypes";

const STATIC_RELIGHT_MAX_LIGHTS = 2;
const STATIC_RELIGHT_TILE_RADIUS = 6;
const STATIC_RELIGHT_MIN_BLEND_ALPHA = 0.04;
const STATIC_RELIGHT_ELEV_PX = 16;
const STATIC_RELIGHT_SIDEWALK_SRC_SIZE = 128;
const STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT = 64;
const STATIC_RELIGHT_RUNTIME_RETRY_INTERVAL_MS = 50;

export const STATIC_RELIGHT_INCLUDE_STRUCTURES = false;

export type StaticRelightBakeRebuildDeps = {
  bakeStore: StaticRelightBakeStore<HTMLCanvasElement>;
  getRuntimeIsoTopCanvas: (
    src: HTMLImageElement,
    rotationQuarterTurns: 0 | 1 | 2 | 3,
  ) => HTMLCanvasElement | null;
  getRuntimeIsoDecalCanvas: (
    src: HTMLImageElement,
    rotationQuarterTurns: 0 | 1 | 2 | 3,
    decalScale: number,
  ) => HTMLCanvasElement | null;
};

let staticRelightPendingRuntimeRebuildContextKey = "";
let staticRelightPendingRuntimeRebuildAtMs = 0;
let lastStaticRelightLoadingFailureKey = "";
let lastStaticRelightLoadingPendingLogAtMs = 0;
let lastStaticRelightLoadingPendingSignature = "";

export function floorRelightPieceKey(
  tx: number,
  ty: number,
  zBase: number,
  renderAnchorY: number,
  family: "sidewalk" | "asphalt" | "park",
  variantIndex: number,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
): string {
  return buildStaticRelightPieceKey({
    kind: "FLOOR_TOP",
    parts: [tx, ty, zBase, renderAnchorY, family, variantIndex, rotationQuarterTurns],
  });
}

export function decalRelightPieceKey(
  tx: number,
  ty: number,
  zBase: number,
  renderAnchorY: number,
  setId: RuntimeDecalSetId,
  variantIndex: number,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
  decalScale: number,
): string {
  return buildStaticRelightPieceKey({
    kind: "DECAL_TOP",
    parts: [tx, ty, zBase, renderAnchorY, setId, variantIndex, rotationQuarterTurns, decalScale],
  });
}

export function structureSliceRelightPieceKey(
  o: StampOverlay,
  bandIndex: number,
  ownerTx: number,
  ownerTy: number,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  drawW: number,
  drawH: number,
  flipped: boolean,
): string {
  return buildStaticRelightPieceKey({
    kind: "STRUCTURE_SLICE",
    parts: [
      o.id,
      o.spriteId,
      bandIndex,
      ownerTx,
      ownerTy,
      srcX,
      srcY,
      srcW,
      srcH,
      drawW,
      drawH,
      flipped ? 1 : 0,
    ],
  });
}

export function buildRampRoadTiles(compiledMap: ReturnType<typeof getActiveCompiledMap>): Set<string> {
  const rampRoadTiles = new Set<string>();
  if (!compiledMap?.roadSemanticRects) return rampRoadTiles;
  for (let i = 0; i < compiledMap.roadSemanticRects.length; i++) {
    const rr = compiledMap.roadSemanticRects[i];
    const semantic = rr.semantic?.trim().toLowerCase() ?? "";
    if (!(semantic === "ramp" || semantic.startsWith("ramp_"))) continue;
    const minX = rr.x | 0;
    const minY = rr.y | 0;
    const maxX = minX + Math.max(1, rr.w | 0) - 1;
    const maxY = minY + Math.max(1, rr.h | 0) - 1;
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        rampRoadTiles.add(`${tx},${ty}`);
      }
    }
  }
  return rampRoadTiles;
}

export function resolveStaticRelightRuntimeState(w: World): StaticRelightRuntimeState {
  const compiledMap = getActiveCompiledMap();
  const settings = getUserSettings();
  const renderSettings = settings.render;
  const activePaletteId = resolveActivePaletteId();
  const activePaletteVariantKey = resolveActivePaletteVariantKey();
  const activePaletteSwapWeights = resolveActivePaletteSwapWeights();
  const staticRelightEnabled = renderSettings.staticRelightEnabled !== false;
  const baseDarknessBucket = settings.debug.paletteDarknessPercent as StaticRelightDarknessBucket;
  const strengthScale = Math.max(0, Math.min(1, settings.debug.staticRelightStrengthPercent / 100));
  const targetDarknessBucket = settings.debug.staticRelightTargetDarknessPercent as 0 | 25 | 50 | 75;
  const enabled = staticRelightEnabled
    && baseDarknessBucket > 0
    && strengthScale > 0;
  const mapStaticLightRegistry = buildFrameWorldLightRegistry({
    mapId: compiledMap.id,
    tileWorld: KENNEY_TILE_WORLD,
    elevPx: STATIC_RELIGHT_ELEV_PX,
    worldScale: 1,
    streetLampOcclusionEnabled: w.lighting.occlusionEnabled,
    lightOverrides: {
      colorModeOverride: settings.render.lightColorModeOverride,
      strengthOverride: settings.render.lightStrengthOverride,
    },
    lightPalette: {
      paletteId: activePaletteId,
      saturationWeight: activePaletteSwapWeights.sWeight,
    },
    staticLights: compiledMap.lightDefs,
    runtimeBeam: {
      active: false,
      startWorldX: 0,
      startWorldY: 0,
      endWorldX: 0,
      endWorldY: 0,
      zVisual: 0,
      widthPx: 0,
      glowIntensity: 0,
    },
    tileHeightAtWorld: (x: number, y: number) => heightAtWorld(x, y, KENNEY_TILE_WORLD),
    isTileInRenderRadius: () => true,
    projectToScreen: (worldX, worldY, zPx) => {
      const p = worldToScreen(worldX, worldY);
      return { x: p.x, y: p.y - zPx };
    },
  });

  const relightLights: StaticRelightLightCandidate[] = [];
  if (enabled) {
    for (let i = 0; i < mapStaticLightRegistry.lights.length; i++) {
      const light = mapStaticLightRegistry.lights[i];
      if (light.source !== "MAP_STATIC") continue;
      const projected = light.projected;
      const intensity = Math.max(0, projected.intensity ?? 0);
      if (intensity <= 0) continue;
      const radiusPx = projected.shape === "STREET_LAMP"
        ? Math.max(1, projected.pool?.radiusPx ?? projected.radiusPx)
        : Math.max(1, projected.radiusPx);
      const centerY = projected.shape === "STREET_LAMP"
        ? (Number.isFinite(projected.poolSy) ? (projected.poolSy as number) : projected.sy)
        : projected.sy;
      relightLights.push({
        id: light.id,
        tileX: light.anchorTx,
        tileY: light.anchorTy,
        centerX: projected.sx,
        centerY,
        radiusPx,
        yScale: projected.shape === "STREET_LAMP"
          ? Math.max(0.1, Math.min(1.5, projected.pool?.yScale ?? 1))
          : 1,
        intensity,
      });
    }
  }

  let frame: StaticRelightFrameContext | null = null;
  if (enabled && relightLights.length > 0 && targetDarknessBucket < baseDarknessBucket) {
    frame = {
      baseDarknessBucket: baseDarknessBucket,
      targetDarknessBucket: targetDarknessBucket,
      strengthScale: strengthScale,
      lights: relightLights,
      maxLights: STATIC_RELIGHT_MAX_LIGHTS,
      tileInfluenceRadius: STATIC_RELIGHT_TILE_RADIUS,
      minBlendAlpha: STATIC_RELIGHT_MIN_BLEND_ALPHA,
    };
  }

  const contextKey = buildStaticRelightBakeContextKey({
    mapId: compiledMap.id,
    relightEnabled: enabled,
    staticRelightEnabled,
    paletteId: activePaletteId,
    paletteVariantKey: activePaletteVariantKey,
    paletteSwapEnabled: renderSettings.paletteSwapEnabled === true,
    paletteGroup: renderSettings.paletteGroup,
    paletteSelectionId: renderSettings.paletteId,
    saturationWeightPercent: Math.round(activePaletteSwapWeights.sWeight * 100),
    darknessPercent: baseDarknessBucket,
    baseDarknessBucket: baseDarknessBucket,
    staticRelightStrengthPercent: settings.debug.staticRelightStrengthPercent,
    staticRelightTargetDarknessPercent: targetDarknessBucket,
    lightColorModeOverride: settings.render.lightColorModeOverride,
    lightStrengthOverride: settings.render.lightStrengthOverride,
    lights: relightLights,
  });

  return {
    compiledMap,
    enabled,
    frame,
    relightLights,
    contextKey,
    targetDarknessBucket,
    baseDarknessBucket,
    strengthScale,
  };
}

export function rebuildFullMapStaticGroundRelightBake(
  compiledMap: ReturnType<typeof getActiveCompiledMap>,
  rampRoadTiles: Set<string>,
  staticRelightFrame: StaticRelightFrameContext,
  deps: StaticRelightBakeRebuildDeps,
): StaticGroundRelightBakeResult {
  let needsRetry = false;
  const dependencyTracker = createStaticRelightBakeDependencyTracker();
  const seenSurfaceIds = new Set<string>();

  for (const surfaces of compiledMap.surfacesByKey.values()) {
    for (let i = 0; i < surfaces.length; i++) {
      const surface = surfaces[i];
      if (seenSurfaceIds.has(surface.id)) continue;
      seenSurfaceIds.add(surface.id);
      const runtimeTop = surface.runtimeTop;
      if (runtimeTop?.kind !== "SQUARE_128_RUNTIME") continue;
      const tx = surface.tx;
      const ty = surface.ty;
      const anchorY = surface.renderAnchorY ?? KENNEY_TILE_ANCHOR_Y;
      const pieceKey = floorRelightPieceKey(
        tx,
        ty,
        surface.zBase,
        anchorY,
        runtimeTop.family,
        runtimeTop.variantIndex,
        runtimeTop.rotationQuarterTurns,
      );
      if (deps.bakeStore.get(pieceKey)) continue;
      const isRampRoadTile = runtimeTop.family === "asphalt" && rampRoadTiles.has(`${tx},${ty}`);
      if (isRampRoadTile) continue;
      const wx = (tx + 0.5) * KENNEY_TILE_WORLD;
      const wy = (ty + 0.5) * KENNEY_TILE_WORLD;
      const p = worldToScreen(wx, wy);
      const centerX = snapPx(p.x);
      const centerY = snapPx(
        p.y - surface.zBase * STATIC_RELIGHT_ELEV_PX - STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT * (anchorY - 0.5),
      );
      const drawX = snapPx(centerX - STATIC_RELIGHT_SIDEWALK_SRC_SIZE * 0.5);
      const drawY = snapPx(centerY - STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT * 0.5);
      const relightPlan = planStaticRelightBlendForPiece(
        staticRelightFrame,
        tx,
        ty,
        drawX,
        drawY,
        STATIC_RELIGHT_SIDEWALK_SRC_SIZE,
        STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT,
      );
      if (!relightPlan) {
        deps.bakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const srcId = `tiles/floor/${runtimeTop.family}/${runtimeTop.variantIndex}`;
      const src = getTileSpriteById(srcId);
      const srcKey = `floor-base:${srcId}`;
      const srcState = classifyStaticRelightBakeAsset(src);
      noteStaticRelightDependencyState(dependencyTracker, srcKey, srcState);
      if (srcState !== "READY" || !src?.img || src.img.width <= 0 || src.img.height <= 0) {
        if (srcState === "PENDING") needsRetry = true;
        else deps.bakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const baseBaked = deps.getRuntimeIsoTopCanvas(src.img, runtimeTop.rotationQuarterTurns);
      if (!baseBaked) {
        deps.bakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const lighterRec = getSpriteByIdForDarknessPercent(srcId, relightPlan.targetDarknessBucket);
      const lighterKey = `floor-lit:${srcId}@@dk:${relightPlan.targetDarknessBucket}`;
      const lighterState = classifyStaticRelightBakeAsset(lighterRec);
      noteStaticRelightDependencyState(dependencyTracker, lighterKey, lighterState);
      if (lighterState !== "READY" || !lighterRec?.img || lighterRec.img.width <= 0 || lighterRec.img.height <= 0) {
        if (lighterState === "PENDING") needsRetry = true;
        else deps.bakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const lighterBaked = deps.getRuntimeIsoTopCanvas(lighterRec.img, runtimeTop.rotationQuarterTurns);
      if (!lighterBaked) {
        deps.bakeStore.set(pieceKey, { kind: "BASE" });
        continue;
      }
      const baked = composePieceLocalRelightBakedCanvas(
        relightPlan,
        baseBaked.width,
        baseBaked.height,
        (target) => target.drawImage(baseBaked, 0, 0, baseBaked.width, baseBaked.height),
        (target) => target.drawImage(lighterBaked, 0, 0, baseBaked.width, baseBaked.height),
      );
      if (baked) deps.bakeStore.set(pieceKey, { kind: "RELIT", baked });
      else deps.bakeStore.set(pieceKey, { kind: "BASE" });
    }
  }

  for (let i = 0; i < compiledMap.decals.length; i++) {
    const decal = compiledMap.decals[i];
    if (rampRoadTiles.has(`${decal.tx},${decal.ty}`)) continue;
    if (!hasNearbyStaticRelightTileLight(
      staticRelightFrame,
      Math.floor(decal.tx),
      Math.floor(decal.ty),
    )) {
      continue;
    }
    const decalScale = roadMarkingDecalScale(decal.setId, decal.variantIndex);
    const pieceKey = decalRelightPieceKey(
      decal.tx,
      decal.ty,
      decal.zBase,
      decal.renderAnchorY,
      decal.setId,
      decal.variantIndex,
      decal.rotationQuarterTurns,
      decalScale,
    );
    if (deps.bakeStore.get(pieceKey)) continue;
    const src = getRuntimeDecalSprite(decal.setId, decal.variantIndex);
    const decalSpriteId = getDecalSpriteId(decal.setId, decal.variantIndex);
    if (!decalSpriteId) {
      deps.bakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const srcKey = `decal-base:${decalSpriteId}`;
    const srcState = classifyStaticRelightBakeAsset(src);
    noteStaticRelightDependencyState(dependencyTracker, srcKey, srcState);
    if (srcState !== "READY" || !src?.img || src.img.width <= 0 || src.img.height <= 0) {
      if (srcState === "PENDING") needsRetry = true;
      else deps.bakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const baked = deps.getRuntimeIsoDecalCanvas(src.img, decal.rotationQuarterTurns, decalScale);
    if (!baked) {
      deps.bakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const renderAnchorY = decal.renderAnchorY;
    const wx = decal.tx * KENNEY_TILE_WORLD;
    const wy = decal.ty * KENNEY_TILE_WORLD;
    const p = worldToScreen(wx, wy);
    const rawCenterX = p.x;
    const rawCenterY = p.y - decal.zBase * STATIC_RELIGHT_ELEV_PX - STATIC_RELIGHT_SIDEWALK_ISO_HEIGHT * (renderAnchorY - 0.5);
    const shouldSnapRoadMarking = shouldPixelSnapRoadMarking(decal.setId, decal.variantIndex);
    const centerX = shouldSnapRoadMarking ? Math.round(rawCenterX) : snapPx(rawCenterX);
    const centerY = shouldSnapRoadMarking ? Math.round(rawCenterY) : snapPx(rawCenterY);
    const drawX = shouldSnapRoadMarking ? Math.round(centerX - baked.width * 0.5) : snapPx(centerX - baked.width * 0.5);
    const drawY = shouldSnapRoadMarking ? Math.round(centerY - baked.height * 0.5) : snapPx(centerY - baked.height * 0.5);
    const relightPlan = planStaticRelightBlendForPiece(
      staticRelightFrame,
      Math.floor(decal.tx),
      Math.floor(decal.ty),
      drawX,
      drawY,
      baked.width,
      baked.height,
    );
    if (!relightPlan) {
      deps.bakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const lighterRec = getSpriteByIdForDarknessPercent(decalSpriteId, relightPlan.targetDarknessBucket);
    const lighterKey = `decal-lit:${decalSpriteId}@@dk:${relightPlan.targetDarknessBucket}`;
    const lighterState = classifyStaticRelightBakeAsset(lighterRec);
    noteStaticRelightDependencyState(dependencyTracker, lighterKey, lighterState);
    if (lighterState !== "READY" || !lighterRec?.img || lighterRec.img.width <= 0 || lighterRec.img.height <= 0) {
      if (lighterState === "PENDING") needsRetry = true;
      else deps.bakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const lighterBaked = deps.getRuntimeIsoDecalCanvas(lighterRec.img, decal.rotationQuarterTurns, decalScale);
    if (!lighterBaked) {
      deps.bakeStore.set(pieceKey, { kind: "BASE" });
      continue;
    }
    const bakedCanvas = composePieceLocalRelightBakedCanvas(
      relightPlan,
      baked.width,
      baked.height,
      (target) => target.drawImage(baked, 0, 0, baked.width, baked.height),
      (target) => target.drawImage(lighterBaked, 0, 0, baked.width, baked.height),
    );
    if (bakedCanvas) deps.bakeStore.set(pieceKey, { kind: "RELIT", baked: bakedCanvas });
    else deps.bakeStore.set(pieceKey, { kind: "BASE" });
  }

  return {
    needsRetry,
    requiredKeyCount: dependencyTracker.required.size,
    readyCount: dependencyTracker.ready.size,
    pendingCount: dependencyTracker.pending.size,
    failedCount: dependencyTracker.failed.size,
    pendingKeys: dependencyTracker.pendingSample,
  };
}

export function syncStaticRelightRuntimeForFrame(
  w: World,
  deps: StaticRelightBakeRebuildDeps,
  precomputedRampRoadTiles?: Set<string>,
): StaticRelightRuntimeState {
  const staticRelight = resolveStaticRelightRuntimeState(w);
  const rampRoadTiles = precomputedRampRoadTiles ?? buildRampRoadTiles(staticRelight.compiledMap);
  const staticRelightContextChanged = deps.bakeStore.resetIfContextChanged(staticRelight.contextKey);
  if (staticRelightContextChanged) {
    staticRelightPendingRuntimeRebuildContextKey = "";
    staticRelightPendingRuntimeRebuildAtMs = 0;
  }
  if (staticRelightContextChanged && staticRelight.frame) {
    const result = rebuildFullMapStaticGroundRelightBake(
      staticRelight.compiledMap,
      rampRoadTiles,
      staticRelight.frame,
      deps,
    );
    if (result.needsRetry) {
      staticRelightPendingRuntimeRebuildContextKey = staticRelight.contextKey;
      staticRelightPendingRuntimeRebuildAtMs = performance.now() + STATIC_RELIGHT_RUNTIME_RETRY_INTERVAL_MS;
    }
  } else if (
    staticRelight.frame
    && staticRelightPendingRuntimeRebuildContextKey === staticRelight.contextKey
    && performance.now() >= staticRelightPendingRuntimeRebuildAtMs
  ) {
    const retryResult = rebuildFullMapStaticGroundRelightBake(
      staticRelight.compiledMap,
      rampRoadTiles,
      staticRelight.frame,
      deps,
    );
    if (retryResult.needsRetry) {
      staticRelightPendingRuntimeRebuildAtMs = performance.now() + STATIC_RELIGHT_RUNTIME_RETRY_INTERVAL_MS;
    } else {
      staticRelightPendingRuntimeRebuildContextKey = "";
      staticRelightPendingRuntimeRebuildAtMs = 0;
    }
  } else if (!staticRelight.frame) {
    staticRelightPendingRuntimeRebuildContextKey = "";
    staticRelightPendingRuntimeRebuildAtMs = 0;
  }
  return staticRelight;
}

export async function prepareStaticGroundRelightForLoading(
  w: World,
  deps: StaticRelightBakeRebuildDeps,
): Promise<boolean> {
  const staticRelight = resolveStaticRelightRuntimeState(w);
  deps.bakeStore.resetIfContextChanged(staticRelight.contextKey);
  if (!staticRelight.enabled || !staticRelight.frame) return true;
  const rampRoadTiles = buildRampRoadTiles(staticRelight.compiledMap);
  const result = rebuildFullMapStaticGroundRelightBake(
    staticRelight.compiledMap,
    rampRoadTiles,
    staticRelight.frame,
    deps,
  );
  if (result.pendingCount > 0) {
    const signature = `${staticRelight.contextKey}::${result.pendingCount}::${result.failedCount}::${result.pendingKeys.join("|")}`;
    const now = performance.now();
    if (
      signature !== lastStaticRelightLoadingPendingSignature
      || now - lastStaticRelightLoadingPendingLogAtMs >= 1000
    ) {
      lastStaticRelightLoadingPendingSignature = signature;
      lastStaticRelightLoadingPendingLogAtMs = now;
      console.debug(
        `[static-relight:loading] required=${result.requiredKeyCount} ready=${result.readyCount} pending=${result.pendingCount} failed=${result.failedCount}`,
        result.pendingKeys,
      );
    }
    return false;
  }
  lastStaticRelightLoadingPendingSignature = "";
  if (result.failedCount > 0) {
    const failureKey = `${staticRelight.contextKey}::${result.failedCount}`;
    if (failureKey !== lastStaticRelightLoadingFailureKey) {
      lastStaticRelightLoadingFailureKey = failureKey;
      console.warn(
        `[static-relight:loading] proceeding with ${result.failedCount} failed static relight dependencies (fallback to base)`,
      );
    }
  } else {
    lastStaticRelightLoadingFailureKey = "";
  }
  return true;
}
