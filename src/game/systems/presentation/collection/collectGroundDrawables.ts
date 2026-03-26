import type { CollectionContext } from "../contracts/collectionContext";
import { enqueueSliceCommand } from "../frame/renderFrameBuilder";
import {
  resolveGroundDecalProjectedCommand,
  resolveGroundSurfaceProjectedCommand,
  shouldRenderGroundDecalForFrame,
  shouldRenderGroundSurfaceForFrame,
} from "../groundCommandResolver";

type RenderKey = any;
type ShadowParams = any;
type Dir8 = any;

export function collectGroundDrawables(input: CollectionContext): void {
  const {
    w,
    minSum,
    maxSum,
    minTy,
    maxTy,
    minTx,
    maxTx,
    isTileInRenderRadius,
    countRenderTileLoopIteration,
    surfacesAtXYCached,
    RENDER_ALL_HEIGHTS,
    activeH,
    shouldCullBuildingAt,
    frameBuilder,
    ANCHOR_Y,
    TILE_ID_OCEAN,
    getAnimatedTileFrame,
    OCEAN_ANIM_TIME_SCALE,
    getTileSpriteById,
    getRuntimeIsoTopCanvas,
    OCEAN_TOP_SCALE,
    STAIR_TOP_SCALE,
    FLOOR_TOP_SCALE,
    OCEAN_BASE_FRAME_PX,
    getRuntimeIsoDecalCanvas,
    getDiamondFitCanvas,
    getRuntimeDecalSprite,
    T,
    worldToScreen,
    camX,
    camY,
    ELEV_PX,
    STAIR_TOP_DY,
    decalsInView,
    viewRect,
    KindOrder,
    getZoneTrialObjectiveState,
    compiledMap,
    tileHAtWorld,
    RENDER_ENTITY_SHADOWS,
    getEnemyWorld,
    KENNEY_TILE_WORLD,
    ez,
    getSupportSurfaceAt,
    getEnemySpriteFrame,
    resolveEnemyShadowFootOffset,
    entitySilhouetteMaskDraws,
    getEntityFeetPos,
    RENDER_ENTITY_ANCHORS,
    resolveAnchor01,
    ENTITY_ANCHOR_X01_DEFAULT,
    ENTITY_ANCHOR_Y01_DEFAULT,
    ISO_X,
    ISO_Y,
    vendorNpcSpritesReady,
    getVendorNpcSpriteFrame,
    resolveVendorShadowFootOffset,
    snapPx,
    resolveNeutralShadowFootOffset,
    playerSpritesReady,
    getPlayerSpriteFrame,
    getPlayerSkin,
    resolvePlayerShadowFootOffset,
    px,
    py,
    PLAYER_R,
    rampRoadTiles,
    staticRelightFrame,
    staticRelightBakeStore,
    floorRelightPieceKey,
    decalRelightPieceKey,
    roadMarkingDecalScale,
    shouldPixelSnapRoadMarking,
    SIDEWALK_SRC_SIZE,
    SIDEWALK_ISO_HEIGHT,
    srcUvNW,
    srcUvNE,
    srcUvSE,
    srcUvSW,
    getRampQuadPoints,
  } = input as any;

  // Collect TOPS (surfaces) into slices
  // ----------------------------
  {
    for (let s = minSum; s <= maxSum; s++) {
      const ty0 = Math.max(minTy, s - maxTx);
      const ty1 = Math.min(maxTy, s - minTx);

      for (let ty = ty1; ty >= ty0; ty--) {
        const tx = s - ty;
        if (!isTileInRenderRadius(tx, ty)) continue;
        countRenderTileLoopIteration();

        const surfaces = surfacesAtXYCached(tx, ty);
        if (surfaces.length === 0) continue;

        for (let si = 0; si < surfaces.length; si++) {
          const surface = surfaces[si];
          if (!shouldRenderGroundSurfaceForFrame(surface, RENDER_ALL_HEIGHTS, activeH, shouldCullBuildingAt)) continue;
          const resolved = resolveGroundSurfaceProjectedCommand(surface, {
            w,
            ANCHOR_Y,
            TILE_ID_OCEAN,
            getAnimatedTileFrame,
            OCEAN_ANIM_TIME_SCALE,
            getTileSpriteById,
            getRuntimeIsoTopCanvas,
            OCEAN_TOP_SCALE,
            STAIR_TOP_SCALE,
            FLOOR_TOP_SCALE,
            OCEAN_BASE_FRAME_PX,
            getRuntimeIsoDecalCanvas,
            getDiamondFitCanvas,
            getRuntimeDecalSprite,
            T,
            worldToScreen,
            camX,
            camY,
            ELEV_PX,
            STAIR_TOP_DY,
            SIDEWALK_ISO_HEIGHT,
            rampRoadTiles,
            staticRelightFrame,
            staticRelightBakeStore,
            floorRelightPieceKey,
            decalRelightPieceKey,
            roadMarkingDecalScale,
            shouldPixelSnapRoadMarking,
            snapPx,
            getRampQuadPoints,
          });
          if (!resolved) continue;
          const anchorY = Number.isFinite(Number(surface.renderAnchorY))
            ? Number(surface.renderAnchorY)
            : ANCHOR_Y;
          const extraDy = surface.renderTopKind === "STAIR" ? STAIR_TOP_DY : 0;
          const groundDiagStore = ((globalThis as any).__groundProjectedSurfaceEmitterDiagnostics ??= new Map());
          groundDiagStore.set(resolved.key.stableId, {
            surfaceId: surface.id,
            tx,
            ty,
            destinationQuadInputs: {
              zBase: surface.zBase,
              renderAnchorY: anchorY,
              tileWorld: T,
              elevPx: ELEV_PX,
              isoHeight: SIDEWALK_ISO_HEIGHT,
              camX,
              camY,
              extraDy,
            },
            destinationQuad: resolved.destinationQuad,
            payloadDstPoints: resolved.payload.triangles.map((triangle) => triangle.dstPoints),
          });
          enqueueSliceCommand(frameBuilder, resolved.key, {
            semanticFamily: resolved.semanticFamily,
            finalForm: resolved.finalForm,
            payload: resolved.payload,
          });
        }
      }
    }
  }

  // ----------------------------
  // Collect DECALS into slices (after floor, before entities)
  // ----------------------------
  {
    const decals = decalsInView(viewRect);
    for (let i = 0; i < decals.length; i++) {
      const decal = decals[i];
      if (!isTileInRenderRadius(decal.tx, decal.ty)) continue;
      if (!shouldRenderGroundDecalForFrame(decal, RENDER_ALL_HEIGHTS, activeH)) continue;
      const resolved = resolveGroundDecalProjectedCommand(decal, {
        w,
        ANCHOR_Y,
        TILE_ID_OCEAN,
        getAnimatedTileFrame,
        OCEAN_ANIM_TIME_SCALE,
        getTileSpriteById,
        getRuntimeIsoTopCanvas,
        OCEAN_TOP_SCALE,
        STAIR_TOP_SCALE,
        FLOOR_TOP_SCALE,
        OCEAN_BASE_FRAME_PX,
        getRuntimeIsoDecalCanvas,
        getDiamondFitCanvas,
        getRuntimeDecalSprite,
        T,
        worldToScreen,
        camX,
        camY,
        ELEV_PX,
        STAIR_TOP_DY,
        SIDEWALK_ISO_HEIGHT,
        rampRoadTiles,
        staticRelightFrame,
        staticRelightBakeStore,
        floorRelightPieceKey,
        decalRelightPieceKey,
        roadMarkingDecalScale,
        shouldPixelSnapRoadMarking,
        snapPx,
        getRampQuadPoints,
      });
      if (!resolved) continue;

      enqueueSliceCommand(frameBuilder, resolved.key, {
        semanticFamily: resolved.semanticFamily,
        finalForm: resolved.finalForm,
        payload: resolved.payload,
      });
    }
  }

  // ----------------------------
  // Collect ZONE OBJECTIVES into slices (after floor/decals, before entities)
  // ----------------------------
  {
    const zoneTrial = getZoneTrialObjectiveState(w);
    if (zoneTrial && zoneTrial.zones.length > 0) {
      for (let i = 0; i < zoneTrial.zones.length; i++) {
        const zone = zoneTrial.zones[i];
        const absZoneX = compiledMap.originTx + zone.tileX;
        const absZoneY = compiledMap.originTy + zone.tileY;
        const centerTx = absZoneX + Math.floor(zone.tileW * 0.5);
        const centerTy = absZoneY + Math.floor(zone.tileH * 0.5);
        if (!isTileInRenderRadius(centerTx, centerTy)) continue;
        const centerWx = (centerTx + 0.5) * T;
        const centerWy = (centerTy + 0.5) * T;
        const centerZ = tileHAtWorld(centerWx, centerWy);
        const renderKey: RenderKey = {
          slice: centerTx + centerTy,
          within: centerTx,
          baseZ: centerZ,
          kindOrder: KindOrder.ZONE_OBJECTIVE,
          stableId: 210000 + zone.id,
        };

        enqueueSliceCommand(frameBuilder, renderKey, {
          semanticFamily: "worldPrimitive",
          finalForm: "primitive",
          payload: {
            zone,
          },
        });
      }
    }
  }

  // ----------------------------
  // Collect ENTITY SHADOWS into slices (after floor/decals, before entities)
  // ----------------------------
  if (RENDER_ENTITY_SHADOWS) {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;
      const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      const zAbs = ez?.[i] ?? tileHAtWorld(ew.wx, ew.wy);
      const support = getSupportSurfaceAt(ew.wx, ew.wy, compiledMap, zAbs);
      const tx = Math.floor(ew.wx / T);
      const ty = Math.floor(ew.wy / T);
      if (!isTileInRenderRadius(tx, ty)) continue;
      const faceDx = w.eFaceX?.[i] ?? 0;
      const faceDy = w.eFaceY?.[i] ?? -1;
      const moving = Math.hypot(w.evx?.[i] ?? 0, w.evy?.[i] ?? 0) > 1e-4;
      const fr = getEnemySpriteFrame({ type: w.eType[i] as any, time: w.time ?? 0, faceDx, faceDy, moving });
      const spriteW = fr ? fr.sw * fr.scale : Math.max(16, (w.eR[i] ?? 10) * 2.4);
      const enemyShadowOffset = resolveEnemyShadowFootOffset(w.eType[i] as any);
      const renderKey: RenderKey = {
        slice: tx + ty,
        within: tx,
        baseZ: support.worldZ,
        feetSortY: support.screenY + camY,
        kindOrder: KindOrder.SHADOW,
        stableId: 220000 + i,
      };
      const shadowParams: ShadowParams = {
        worldX: ew.wx,
        worldY: ew.wy,
        worldZ: zAbs,
        spriteWidth: spriteW,
        shadowFootOffsetX: enemyShadowOffset.x,
        shadowFootOffsetY: enemyShadowOffset.y,
        screenOffsetX: camX,
        screenOffsetY: camY,
      };
      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: {
          shadowParams,
        },
      });
      const feet = getEntityFeetPos(ew.wx, ew.wy, zAbs);
      entitySilhouetteMaskDraws.push((maskCtx: any) => {
        const frSilhouette = getEnemySpriteFrame({
          type: w.eType[i] as any,
          time: w.time ?? 0,
          faceDx,
          faceDy,
          moving,
        });
        if (frSilhouette) {
          const dw = frSilhouette.sw * frSilhouette.scale;
          const dh = frSilhouette.sh * frSilhouette.scale;
          const frAny = frSilhouette as any;
          const anchorX = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any).eAnchorX01?.[i], frAny.anchorX01 ?? frSilhouette.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
            : (frSilhouette.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
          const anchorY = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any).eAnchorY01?.[i], frAny.anchorY01 ?? frSilhouette.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
            : (frSilhouette.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
          const dx = feet.screenX - dw * anchorX;
          const dy = feet.screenY - dh * anchorY;
          maskCtx.drawImage(
            frSilhouette.img,
            frSilhouette.sx,
            frSilhouette.sy,
            frSilhouette.sw,
            frSilhouette.sh,
            Math.round(dx),
            Math.round(dy),
            dw,
            dh,
          );
          return;
        }
        maskCtx.fillStyle = "rgba(255,255,255,1)";
        maskCtx.beginPath();
        maskCtx.ellipse(
          feet.screenX,
          feet.screenY,
          (w.eR[i] ?? 10) * ISO_X,
          (w.eR[i] ?? 10) * ISO_Y,
          0,
          0,
          Math.PI * 2,
        );
        maskCtx.fill();
      });
    }

    for (let i = 0; i < w.npcs.length; i++) {
      const npc = w.npcs[i];
      const zAbs = tileHAtWorld(npc.wx, npc.wy);
      const support = getSupportSurfaceAt(npc.wx, npc.wy, compiledMap, zAbs);
      const tx = Math.floor(npc.wx / T);
      const ty = Math.floor(npc.wy / T);
      if (!isTileInRenderRadius(tx, ty)) continue;
      const fr = vendorNpcSpritesReady()
        ? getVendorNpcSpriteFrame({ dir: npc.dirCurrent, time: w.time ?? 0 })
        : null;
      const spriteW = fr ? fr.sw * fr.scale : 24;
      const vendorShadowOffset = resolveVendorShadowFootOffset(npc.kind);
      const renderKey: RenderKey = {
        slice: tx + ty,
        within: tx,
        baseZ: support.worldZ,
        feetSortY: support.screenY + camY,
        kindOrder: KindOrder.SHADOW,
        stableId: 225000 + i,
      };
      const shadowParams: ShadowParams = {
        worldX: npc.wx,
        worldY: npc.wy,
        worldZ: zAbs,
        spriteWidth: spriteW,
        shadowRadiusX: npc.shadowRadiusX,
        shadowRadiusY: npc.shadowRadiusY,
        castsShadow: npc.castsShadow,
        shadowFootOffsetX: vendorShadowOffset.x,
        shadowFootOffsetY: vendorShadowOffset.y,
        screenOffsetX: camX,
        screenOffsetY: camY,
      };
      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: {
          shadowParams,
        },
      });
      const feet = getEntityFeetPos(npc.wx, npc.wy, zAbs);
      entitySilhouetteMaskDraws.push((maskCtx: any) => {
        const frSilhouette = vendorNpcSpritesReady()
          ? getVendorNpcSpriteFrame({ dir: npc.dirCurrent, time: w.time ?? 0 })
          : null;
        if (!frSilhouette) return;
        const dw = frSilhouette.sw * frSilhouette.scale;
        const dh = frSilhouette.sh * frSilhouette.scale;
        const frAny = frSilhouette as any;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((npc as any).anchorX01, frAny.anchorX01 ?? frSilhouette.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (frSilhouette.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((npc as any).anchorY01, frAny.anchorY01 ?? frSilhouette.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (frSilhouette.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
        const dx = feet.screenX - dw * anchorX;
        const dy = feet.screenY - dh * anchorY;
        maskCtx.drawImage(
          frSilhouette.img,
          frSilhouette.sx,
          frSilhouette.sy,
          frSilhouette.sw,
          frSilhouette.sh,
          Math.round(dx),
          Math.round(dy),
          dw,
          dh,
        );
      });
    }

    for (let i = 0; i < w.neutralMobs.length; i++) {
      const mob = w.neutralMobs[i];
      const zGround = tileHAtWorld(mob.pos.wx, mob.pos.wy);
      const zAbs = zGround + (mob.pos.wzOffset ?? 0);
      const support = getSupportSurfaceAt(mob.pos.wx, mob.pos.wy, compiledMap, zAbs);
      const tx = Math.floor(mob.pos.wx / T);
      const ty = Math.floor(mob.pos.wy / T);
      if (!isTileInRenderRadius(tx, ty)) continue;
      const frameCount = mob.spriteFrames.length;
      const frame = frameCount > 0 ? mob.spriteFrames[mob.anim.frameIndex % frameCount] : null;
      const spriteW = frame ? frame.width * mob.render.scale : 24;
      const neutralShadowOffset = resolveNeutralShadowFootOffset(mob.kind);
      const renderKey: RenderKey = {
        slice: tx + ty,
        within: tx,
        baseZ: support.worldZ,
        feetSortY: support.screenY + camY,
        kindOrder: KindOrder.SHADOW,
        stableId: 226000 + i,
      };
      const shadowParams: ShadowParams = {
        worldX: mob.pos.wx,
        worldY: mob.pos.wy,
        worldZ: zAbs,
        spriteWidth: spriteW,
        shadowRadiusX: mob.shadowRadiusX,
        shadowRadiusY: mob.shadowRadiusY,
        castsShadow: mob.castsShadow,
        shadowFootOffsetX: neutralShadowOffset.x,
        shadowFootOffsetY: neutralShadowOffset.y,
        screenOffsetX: camX,
        screenOffsetY: camY,
      };
      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: {
          shadowParams,
        },
      });
      const feet = getEntityFeetPos(mob.pos.wx, mob.pos.wy, zAbs);
      entitySilhouetteMaskDraws.push((maskCtx: any) => {
        const frameCountSilhouette = mob.spriteFrames.length;
        if (frameCountSilhouette <= 0) return;
        const frameSilhouette = mob.spriteFrames[mob.anim.frameIndex % frameCountSilhouette];
        if (!frameSilhouette || frameSilhouette.width <= 0 || frameSilhouette.height <= 0) return;
        const dw = frameSilhouette.width * mob.render.scale;
        const dh = frameSilhouette.height * mob.render.scale;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((mob.render as any).anchorX01, mob.render.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (mob.render.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((mob.render as any).anchorY01, mob.render.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (mob.render.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
        const dx = feet.screenX - dw * anchorX;
        const dy = feet.screenY - dh * anchorY;
        if (mob.render.flipX) {
          maskCtx.save();
          maskCtx.translate(snapPx(dx + dw), snapPx(dy));
          maskCtx.scale(-1, 1);
          maskCtx.drawImage(frameSilhouette, 0, 0, dw, dh);
          maskCtx.restore();
          return;
        }
        maskCtx.drawImage(frameSilhouette, snapPx(dx), snapPx(dy), dw, dh);
      });
    }

    {
      const pzAbs = w.pzVisual ?? w.pz ?? tileHAtWorld(px, py);
      const support = getSupportSurfaceAt(px, py, compiledMap, pzAbs);
      const tx = Math.floor(px / T);
      const ty = Math.floor(py / T);
      const dir = ((w as any)._plDir ?? "N") as Dir8;
      const moving = (w as any)._plMoving ?? false;
      const fr = playerSpritesReady()
        ? getPlayerSpriteFrame({ dir, moving, time: w.time ?? 0 })
        : null;
      const spriteW = fr ? fr.sw * fr.scale : Math.max(16, PLAYER_R * 2.4);
      const playerSkin = getPlayerSkin();
      const playerShadowOffset = resolvePlayerShadowFootOffset(playerSkin);
      const renderKey: RenderKey = {
        slice: tx + ty,
        within: tx,
        baseZ: support.worldZ,
        feetSortY: support.screenY + camY,
        kindOrder: KindOrder.SHADOW,
        stableId: 200001,
      };
      const shadowParams: ShadowParams = {
        worldX: px,
        worldY: py,
        worldZ: pzAbs,
        spriteWidth: spriteW,
        shadowFootOffsetX: playerShadowOffset.x,
        shadowFootOffsetY: playerShadowOffset.y,
        screenOffsetX: camX,
        screenOffsetY: camY,
      };
      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: {
          shadowParams,
        },
      });
      const feet = getEntityFeetPos(px, py, pzAbs);
      entitySilhouetteMaskDraws.push((maskCtx: any) => {
        const dirSilhouette = ((w as any)._plDir ?? "N") as Dir8;
        const movingSilhouette = (w as any)._plMoving ?? false;
        const frSilhouette = playerSpritesReady()
          ? getPlayerSpriteFrame({ dir: dirSilhouette, moving: movingSilhouette, time: w.time ?? 0 })
          : null;
        if (frSilhouette) {
          const dw = frSilhouette.sw * frSilhouette.scale;
          const dh = frSilhouette.sh * frSilhouette.scale;
          const frAny = frSilhouette as any;
          const anchorX = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any)._plAnchorX01, frAny.anchorX01 ?? frSilhouette.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
            : (frSilhouette.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
          const anchorY = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any)._plAnchorY01, frAny.anchorY01 ?? frSilhouette.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
            : (frSilhouette.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
          const dx = Math.round(feet.screenX - dw * anchorX);
          const dy = Math.round(feet.screenY - dh * anchorY);
          maskCtx.drawImage(
            frSilhouette.img,
            frSilhouette.sx,
            frSilhouette.sy,
            frSilhouette.sw,
            frSilhouette.sh,
            dx,
            dy,
            dw,
            dh,
          );
          return;
        }
        maskCtx.fillStyle = "rgba(255,255,255,1)";
        maskCtx.beginPath();
        maskCtx.ellipse(feet.screenX, feet.screenY, PLAYER_R * ISO_X, PLAYER_R * ISO_Y, 0, 0, Math.PI * 2);
        maskCtx.fill();
      });
    }
  }

}
