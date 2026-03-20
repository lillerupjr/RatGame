export type RenderScreenOverlaysContext = Record<string, any>;

export function renderScreenOverlays(input: RenderScreenOverlaysContext): void {
  const {
    w,
    ctx,
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
    structureV6ShadowDebugCandidates,
    v5ShadowAnchorDiagnostic,
    shadowSunModel,
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
    hybridShadowDiagnosticStats,
    v4ShadowDiagnosticStats,
    v5ShadowDiagnosticStats,
    endRenderPerfFrame,
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
  } = input as any;

  // Optional floor tint overlay
  const floorVis = getFloorVisual(w);
  if (floorVis) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = floorVis.tintAlpha;
    ctx.fillStyle = floorVis.tint;
    ctx.fillRect(0, 0, devW, devH);
    ctx.restore();
  }

  const GLOBAL_SCREEN_TINT_ALPHA = (w.lighting.darknessAlpha ?? 0) > 0 ? 0 : 0.3;
  if (GLOBAL_SCREEN_TINT_ALPHA > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = GLOBAL_SCREEN_TINT_ALPHA;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, devW, devH);
    ctx.restore();
  }

  if (debugFrame.enabled) {
    executeDebugPass({
      phase: "world",
      input: {
        ctx,
        debugContext,
        viewRect,
        toScreen,
        tileWorld: T,
        isTileInRenderRadius,
        deferredStructureSliceDebugDraws,
        flags: debugFlags,
      },
    });
  }

  // Floating combat text: world pass (same camera transform as world content)
  drawFloatingText(w, ctx, toScreen);

  // Restore camera transform before drawing screen-space overlays / HUD.
  ctx.restore();

  // PASS 8: final screen-space ambient darkness/tint only
  if (shouldApplyAmbientDarknessOverlay(renderSettings)) {
    setRenderPerfDrawTag("lighting");
    renderAmbientDarknessOverlay(ctx, w.lighting, devW, devH);
    setRenderPerfDrawTag(null);
  }
  // Building-mask debug overlay draw disabled to avoid full-canvas mask artifacts.

  if (debugFrame.enabled || renderPerfCountersEnabled || structureShadowFrame.routing.usesV6) {
    executeDebugPass({
      phase: "screen",
      input: {
        ctx,
        cssW: input.cssW,
        cssH: input.cssH,
        dpr: input.dpr,
        flags: debugFlags,
        renderPerfCountersEnabled,
        structureShadowRouting: structureShadowFrame.routing,
        structureV6VerticalShadowDebugData,
        structureV6ShadowDebugCandidateCount: structureV6ShadowDebugCandidates.length,
        v5ShadowAnchorDiagnostic,
        shadowSunModel,
        structureTriangleAdmissionMode,
        sliderPadding,
        playerCameraTx,
        playerCameraTy,
        structureTriangleCutoutEnabled,
        structureTriangleCutoutHalfWidth,
        structureTriangleCutoutHalfHeight,
        structureTriangleCutoutAlpha,
        roadWidthAtPlayer: roadAreaWidthAt(playerTx, playerTy),
        hybridShadowDiagnosticStats,
        v4ShadowDiagnosticStats,
        v5ShadowDiagnosticStats,
      },
    });
  }
  endRenderPerfFrame(w.timeSec ?? 0);

  if (DEBUG_PLAYER_WEDGE) {
    const playerPos = { x: px, y: py };
    const playerTile = worldToTile(playerPos.x, playerPos.y);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 0, 0, 0.18)";
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
        ctx.fillRect(
          Math.floor(p.x),
          Math.floor(p.y),
          KENNEY_TILE_WORLD * s,
          (KENNEY_TILE_WORLD / 2) * s
        );
      }
    }
    ctx.restore();
  }
}

function drawFloatingText(
  w: any,
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => { x: number; y: number },
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = w.floatTextX.length - 1; i >= 0; i--) {
    const ttl = w.floatTextTtl[i];
    if (ttl <= 0) continue;

    const p = toScreen(w.floatTextX[i], w.floatTextY[i]);
    const x = p.x;
    const y = p.y;

    const value = w.floatTextValue[i];
    const color = w.floatTextColor[i];
    const size = w.floatTextSize[i] ?? (w.floatTextIsCrit[i] ? 16 : 12);
    const isPlayer = w.floatTextIsPlayer[i] ?? false;

    const maxTtl = 0.8;
    const progress = 1 - ttl / maxTtl;

    const rise = progress * 0.35;
    const alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${size}px monospace`;
    ctx.fillText(isPlayer ? `-${value}` : `${value}`, x, y - rise);
  }
  ctx.restore();
}
