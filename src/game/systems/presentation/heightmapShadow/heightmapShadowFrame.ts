import { getHeightmapForSprite } from "../../../../engine/render/sprites/heightmapLoader";
import type { ShadowSunV1Model } from "../../../../shadowSunV1";
import type { CompiledKenneyMap, ViewRect } from "../../../map/compile/kenneyMap";
import { buildRuntimeStructureProjectedDraw } from "../../../structures/monolithicStructureGeometry";
import type { RenderDebugFlags } from "../debug/debugRenderTypes";
import { computeHeightmapShadowMask, DEFAULT_HEIGHTMAP_SHADOW_PARAMS, type HeightmapShadowMask } from "./heightmapRayMarch";
import { compositeSceneHeightBuffer, type HeightmapStructureInstance } from "./sceneHeightBuffer";

type HeightmapShadowFrameInput = {
  enabled: boolean;
  shadowSunModel: ShadowSunV1Model;
  debugFlags: RenderDebugFlags;
  compiledMap: CompiledKenneyMap;
  viewRect: ViewRect;
  viewport: {
    camTx: number;
    camTy: number;
    zoom: number;
  };
  cssW: number;
  cssH: number;
  getTileSpriteById: (spriteId: string) => {
    ready: boolean;
    img?: HTMLImageElement | null;
  };
};

export function resolveHeightmapShadowMaskForFrame(input: HeightmapShadowFrameInput): HeightmapShadowMask | null {
  const {
    enabled,
    shadowSunModel,
    debugFlags,
    compiledMap,
    viewRect,
    viewport,
    cssW,
    cssH,
    getTileSpriteById,
  } = input;

  if (!enabled || !shadowSunModel.castsShadows) return null;

  const heightmapStructures: HeightmapStructureInstance[] = [];
  const visibleOverlays = compiledMap.overlaysInView(viewRect);
  const hmViewX = -viewport.camTx;
  const hmViewY = -viewport.camTy;
  const hmViewW = cssW / viewport.zoom;
  const hmViewH = cssH / viewport.zoom;

  for (let i = 0; i < visibleOverlays.length; i++) {
    const overlay = visibleOverlays[i];
    if (!overlay.spriteId) continue;
    const heightmap = getHeightmapForSprite(overlay.spriteId);
    if (!heightmap) continue;
    const rec = getTileSpriteById(overlay.spriteId);
    if (!rec?.ready || !rec.img || rec.img.width <= 0 || rec.img.height <= 0) continue;
    const projected = buildRuntimeStructureProjectedDraw(overlay, rec.img);
    const drawScale = projected.scale ?? 1;
    heightmapStructures.push({
      heightmap,
      screenX: projected.dx - hmViewX,
      screenY: projected.dy - hmViewY,
      drawWidth: projected.dw * drawScale,
      drawHeight: projected.dh * drawScale,
      flipX: projected.flipX,
      colorSpriteImg: rec.img,
    });
  }

  if (heightmapStructures.length <= 0) return null;

  const resolutionDivisor = Number.isFinite(Number(debugFlags.heightmapShadowResolutionDivisor))
    && Number(debugFlags.heightmapShadowResolutionDivisor) >= 1
    ? Number(debugFlags.heightmapShadowResolutionDivisor)
    : 2;
  const heightBuffer = compositeSceneHeightBuffer(
    hmViewW,
    hmViewH,
    resolutionDivisor,
    heightmapStructures,
  );
  if (!heightBuffer) return null;

  const stepSize = Number.isFinite(Number(debugFlags.heightmapShadowStepSize))
    && Number(debugFlags.heightmapShadowStepSize) > 0
    ? Number(debugFlags.heightmapShadowStepSize)
    : DEFAULT_HEIGHTMAP_SHADOW_PARAMS.stepSize;
  const maxSteps = Number.isFinite(Number(debugFlags.heightmapShadowMaxSteps))
    && Number(debugFlags.heightmapShadowMaxSteps) > 0
    ? Number(debugFlags.heightmapShadowMaxSteps)
    : DEFAULT_HEIGHTMAP_SHADOW_PARAMS.maxSteps;
  const shadowIntensity = Number.isFinite(Number(debugFlags.heightmapShadowIntensity))
    ? Number(debugFlags.heightmapShadowIntensity)
    : DEFAULT_HEIGHTMAP_SHADOW_PARAMS.shadowIntensity;
  const params = {
    stepSize,
    maxSteps,
    shadowIntensity,
  };
  const hmCacheKey = `${compiledMap.id}:${shadowSunModel.stepKey}:hm:${cssW}x${cssH}:cam${viewport.camTx},${viewport.camTy}:d${resolutionDivisor}:s${params.stepSize}:m${params.maxSteps}:i${params.shadowIntensity}`;

  return computeHeightmapShadowMask(
    heightBuffer,
    shadowSunModel,
    params,
    hmCacheKey,
  );
}
