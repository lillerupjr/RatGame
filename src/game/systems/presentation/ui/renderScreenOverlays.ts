import type { ScreenOverlayContext } from "../contracts/screenOverlayContext";
import { enqueueScreenCommand, enqueueWorldTailCommand } from "../frame/renderFrameBuilder";

export function renderScreenOverlays(input: ScreenOverlayContext): void {
  const {
    w,
    frameBuilder,
    getFloorVisual,
    devW,
    devH,
    debugFrame,
    executeDebugPass,
    debugContext,
    viewRect,
    toScreen,
    T,
    isTileInRenderRadius,
    deferredStructureSliceDebugDraws,
    debugFlags,
    shouldApplyAmbientDarknessOverlay,
    renderSettings,
    setRenderPerfDrawTag,
    renderAmbientDarknessOverlay,
    renderPerfCountersEnabled,
    structureShadowFrame,
    structureV6VerticalShadowDebugData,
    structureV6VerticalShadowDebugDataList,
    structureV6ShadowDebugCandidates,
    structureV6ShadowCacheStats,
    shadowSunModel,
    ambientSunLighting,
    shadowSunDayCycleStatus,
    structureTriangleAdmissionMode,
    sliderPadding,
    playerCameraTx,
    playerCameraTy,
    structureTriangleCutoutEnabled,
    structureTriangleCutoutHalfWidth,
    structureTriangleCutoutHalfHeight,
    structureTriangleCutoutAlpha,
    roadAreaWidthAt,
    playerTx,
    playerTy,
    DEBUG_PLAYER_WEDGE,
    px,
    py,
    worldToTile,
    minSum,
    maxSum,
    minTy,
    maxTy,
    minTx,
    maxTx,
    isTileInPlayerSouthWedge,
    tileHAtWorld,
    tileToScreen,
    worldToScreenPx,
    KENNEY_TILE_WORLD,
    s,
    cssW,
    cssH,
    dpr,
  } = input as any;

  // Optional floor tint overlay
  const floorVis = getFloorVisual(w);
  if (floorVis) {
    enqueueScreenCommand(frameBuilder, {
      semanticFamily: "screenOverlay",
      finalForm: "quad",
      payload: {
        color: floorVis.tint,
        alpha: floorVis.tintAlpha,
        width: devW,
        height: devH,
      },
    });
  }

  const GLOBAL_SCREEN_TINT_ALPHA = (w.lighting.darknessAlpha ?? 0) > 0 ? 0 : 0.3;
  if (GLOBAL_SCREEN_TINT_ALPHA > 0) {
    enqueueScreenCommand(frameBuilder, {
      semanticFamily: "screenOverlay",
      finalForm: "quad",
      payload: {
        color: "#000",
        alpha: GLOBAL_SCREEN_TINT_ALPHA,
        width: devW,
        height: devH,
      },
    });
  }

  if (debugFrame.enabled) {
    enqueueWorldTailCommand(frameBuilder, {
      semanticFamily: "debug",
      finalForm: "primitive",
      payload: {
        phase: "world",
        input: {
          debugContext,
          viewRect,
          toScreen,
          tileWorld: T,
          isTileInRenderRadius,
          deferredStructureSliceDebugDraws,
          flags: debugFlags,
        },
      },
    });
  }

  // Floating combat text: world pass (same camera transform as world content)
  enqueueWorldTailCommand(frameBuilder, {
    semanticFamily: "screenOverlay",
    finalForm: "primitive",
    payload: {},
  });

  // PASS 8: final screen-space ambient darkness/tint only
  if (shouldApplyAmbientDarknessOverlay(renderSettings)) {
    enqueueScreenCommand(frameBuilder, {
      semanticFamily: "screenOverlay",
      finalForm: "primitive",
      payload: {
        darknessAlpha: w.lighting.darknessAlpha ?? 0,
        ambientTint: w.lighting.ambientTint ?? "#000000",
        ambientTintStrength: w.lighting.ambientTintStrength ?? 0,
      },
    });
  }
  // Building-mask debug overlay draw disabled to avoid full-canvas mask artifacts.

  if (debugFrame.enabled || structureShadowFrame.routing.usesV6Debug || shadowSunDayCycleStatus.enabled) {
    enqueueScreenCommand(frameBuilder, {
      semanticFamily: "debug",
      finalForm: "primitive",
      payload: {
        phase: "screen",
        input: {
          cssW,
          cssH,
          dpr,
          flags: debugFlags,
          renderPerfCountersEnabled: false,
          structureShadowRouting: structureShadowFrame.routing,
          structureV6VerticalShadowDebugData,
          structureV6ShadowDebugCandidateCount: structureV6ShadowDebugCandidates.length,
          structureV6ShadowCastCount: structureV6VerticalShadowDebugDataList.length,
          structureV6ShadowCacheStats,
          shadowSunModel,
          ambientSunLighting,
          shadowSunDayCycleStatus,
          structureTriangleAdmissionMode,
          sliderPadding,
          playerCameraTx,
          playerCameraTy,
          structureTriangleCutoutEnabled,
          structureTriangleCutoutHalfWidth,
          structureTriangleCutoutHalfHeight,
          structureTriangleCutoutAlpha,
          roadWidthAtPlayer: roadAreaWidthAt(playerTx, playerTy),
        },
      },
    });
  }

  if (DEBUG_PLAYER_WEDGE) {
    const playerPos = { x: px, y: py };
    const playerTile = worldToTile(playerPos.x, playerPos.y);
    const cells: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let sum = minSum; sum <= maxSum; sum++) {
      const ty0 = Math.max(minTy, sum - maxTx);
      const ty1 = Math.min(maxTy, sum - minTx);
      for (let ty = ty1; ty >= ty0; ty--) {
        const tx = sum - ty;
        if (!isTileInPlayerSouthWedge(tx, ty, playerTile.tx, playerTile.ty)) continue;
        const wx = (tx + 0.5) * T;
        const wy = (ty + 0.5) * T;
        const z = tileHAtWorld(wx, wy);
        const screen = tileToScreen(tx, ty, z);
        const p = worldToScreenPx(screen.x, screen.y);
        cells.push({
          x: Math.floor(p.x),
          y: Math.floor(p.y),
          w: KENNEY_TILE_WORLD * s,
          h: (KENNEY_TILE_WORLD / 2) * s,
        });
      }
    }
    enqueueScreenCommand(frameBuilder, {
      semanticFamily: "debug",
      finalForm: "primitive",
      payload: {
        cells,
      },
    });
  }
}
