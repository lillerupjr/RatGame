import type { CollectionContext } from "../contracts/collectionContext";
import { enqueueSliceCommand } from "../frame/renderFrameBuilder";

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
          const tdef = surface.tile;
          const isStairTop = surface.renderTopKind === "STAIR";
          // Skip VOID surfaces entirely (VOID is background now)
          if (tdef.kind === "VOID") continue;

          // Height filtering
          if (RENDER_ALL_HEIGHTS) {
            // noop - render all
          } else {
            // Filter by activeH
            if (!isStairTop) {
              if (surface.zLogical !== activeH) continue;
            } else {
              const hs = tdef.h ?? 0;
              if (Math.abs(hs - activeH) > 1) continue;
            }
          }

          if (surface.id.startsWith("building_floor_") && shouldCullBuildingAt(tx, ty)) continue;
          if (surface.runtimeTop?.kind === "SQUARE_128_RUNTIME") {
            const runtimeTop = surface.runtimeTop;
            const src = getTileSpriteById(`tiles/floor/${runtimeTop.family}/${runtimeTop.variantIndex}`);
            const isRampRoadTile = runtimeTop.family === "asphalt" && rampRoadTiles.has(`${tx},${ty}`);
            const baseBaked = src?.ready && src.img ? getRuntimeIsoTopCanvas(src.img, runtimeTop.rotationQuarterTurns) : null;
            const anchorY = surface.renderAnchorY ?? ANCHOR_Y;
            const pieceKey = staticRelightFrame
              ? floorRelightPieceKey(
                tx,
                ty,
                surface.zBase,
                anchorY,
                runtimeTop.family,
                runtimeTop.variantIndex,
                runtimeTop.rotationQuarterTurns,
              )
              : null;
            const bakedEntry = pieceKey ? staticRelightBakeStore.get(pieceKey) : null;
            const relitCanvas = bakedEntry?.kind === "RELIT" ? bakedEntry.baked : null;
            const finalImage = relitCanvas ?? baseBaked;
            const renderKey: RenderKey = {
              slice: tx + ty,
              within: tx,
              baseZ: surface.zBase,
              kindOrder: KindOrder.FLOOR,
              stableId: (tx * 73856093 ^ ty * 19349663 ^ (surface.zBase * 100 | 0) * 83492791) + 17,
            };
            enqueueSliceCommand(frameBuilder, renderKey, "decal", {
              variant: "runtimeSidewalkTop",
              mode: finalImage && isRampRoadTile ? "projected" : (!isRampRoadTile && finalImage ? "flat" : "projected"),
              tx,
              ty,
              zBase: surface.zBase,
              anchorY,
              family: runtimeTop.family,
              variantIndex: runtimeTop.variantIndex,
              rotationQuarterTurns: runtimeTop.rotationQuarterTurns,
              ...(finalImage && !isRampRoadTile ? (() => {
                const centerX = snapPx(worldToScreen((tx + 0.5) * T, (ty + 0.5) * T).x + camX);
                const centerY = snapPx(
                  worldToScreen((tx + 0.5) * T, (ty + 0.5) * T).y
                  + camY
                  - surface.zBase * ELEV_PX
                  - SIDEWALK_ISO_HEIGHT * (anchorY - 0.5),
                );
                return {
                  image: finalImage,
                  dx: centerX - SIDEWALK_SRC_SIZE * 0.5,
                  dy: centerY - SIDEWALK_ISO_HEIGHT * 0.5,
                  dw: finalImage.width,
                  dh: finalImage.height,
                };
              })() : {}),
              ...(finalImage && isRampRoadTile ? (() => {
                const q = getRampQuadPoints(tx, ty, anchorY);
                return {
                  image: finalImage,
                  sourceWidth: finalImage.width,
                  sourceHeight: finalImage.height,
                  finalVisibleTriangles: [
                    {
                      stableId: renderKey.stableId,
                      srcPoints: [srcUvNW, srcUvNE, srcUvSE],
                      points: [q.nw, q.ne, q.se],
                    },
                    {
                      stableId: Number(renderKey.stableId) + 0.01,
                      srcPoints: [srcUvNW, srcUvSE, srcUvSW],
                      points: [q.nw, q.se, q.sw],
                    },
                  ],
                };
              })() : {}),
            });
            continue;
          }
          const topRec = tdef.kind === TILE_ID_OCEAN
            ? getAnimatedTileFrame("water1", (w.timeSec ?? w.time ?? 0) * OCEAN_ANIM_TIME_SCALE)
            : (surface.spriteIdTop ? getTileSpriteById(surface.spriteIdTop) : null);
          if (!topRec?.ready || !topRec.img || topRec.img.width <= 0 || topRec.img.height <= 0) continue;

          const topScale = tdef.kind === TILE_ID_OCEAN
            ? OCEAN_TOP_SCALE
            : (isStairTop ? STAIR_TOP_SCALE : FLOOR_TOP_SCALE);
          const oceanProjectionScale = tdef.kind === TILE_ID_OCEAN
            ? topScale * (OCEAN_BASE_FRAME_PX / Math.max(1, Math.max(topRec.img.width, topRec.img.height)))
            : 1;
          const projectedOceanTop = tdef.kind === TILE_ID_OCEAN
            ? getRuntimeIsoDecalCanvas(topRec.img, 0, oceanProjectionScale)
            : null;
          const topImg = projectedOceanTop ?? topRec.img;
          const topW = projectedOceanTop ? topImg.width : (topImg.width * topScale);
          const topH = projectedOceanTop ? topImg.height : (topImg.height * topScale);

          const wx = (tx + 0.5) * T;
          const wy = (ty + 0.5) * T;

          const p = worldToScreen(wx, wy);
          const dx = p.x + camX - topW * 0.5;

          const anchorY = surface.renderAnchorY ?? ANCHOR_Y;
          let dy = p.y + camY - topH * anchorY;

          const h = surface.zBase;
          dy -= h * ELEV_PX;

          // Stair render-height tweak (screen-space)
          if (isStairTop) dy += STAIR_TOP_DY;

          // Deterministic stableId based on tile and surface properties
          const topStableId = tx * 73856093 ^ ty * 19349663 ^ (surface.zBase * 100 | 0) * 83492791;

          const renderKey: RenderKey = {
            slice: tx + ty,
            within: tx,
            baseZ: surface.zBase,
            kindOrder: KindOrder.FLOOR,
            stableId: topStableId,
          };
          if (tdef.kind === TILE_ID_OCEAN && projectedOceanTop) {
            enqueueSliceCommand(frameBuilder, renderKey, "decal", {
              variant: "imageTop",
              mode: "flat",
              image: projectedOceanTop,
              dx,
              dy,
              dw: topW,
              dh: topH,
            });
          } else if (tdef.kind === TILE_ID_OCEAN) {
            enqueueSliceCommand(frameBuilder, renderKey, "decal", {
              variant: "imageTop",
              mode: "oceanProjected",
              image: topRec.img,
              tx,
              ty,
              zBase: surface.zBase,
              renderAnchorY: anchorY,
              oceanProjectionScale,
            });
          } else {
            enqueueSliceCommand(frameBuilder, renderKey, "decal", {
              variant: "imageTop",
              mode: "flat",
              image: topImg,
              dx,
              dy,
              dw: topW,
              dh: topH,
            });
          }
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
      if (!RENDER_ALL_HEIGHTS && decal.zLogical !== activeH) continue;
      const renderKey: RenderKey = {
        slice: decal.tx + decal.ty,
        within: decal.tx,
        baseZ: decal.zBase,
        kindOrder: KindOrder.DECAL,
        stableId: (decal.tx * 73856093 ^ decal.ty * 19349663 ^ (decal.zBase * 100 | 0) * 83492791) + 19,
      };

      enqueueSliceCommand(frameBuilder, renderKey, "decal", {
        variant: "runtimeDecalTop",
        mode: "projected",
        tx: decal.tx,
        ty: decal.ty,
        zBase: decal.zBase,
        renderAnchorY: decal.renderAnchorY,
        setId: decal.setId,
        variantIndex: decal.variantIndex,
        rotationQuarterTurns: decal.rotationQuarterTurns,
        ...(() => {
          const src = getRuntimeDecalSprite(decal.setId, decal.variantIndex);
          if (!src?.ready || !src.img || src.img.width <= 0 || src.img.height <= 0) return {};
          const decalScale = roadMarkingDecalScale(decal.setId, decal.variantIndex);
          const baked = getRuntimeIsoDecalCanvas(src.img, decal.rotationQuarterTurns, decalScale);
          if (!baked) return {};
          const pieceKey = staticRelightFrame
            ? decalRelightPieceKey(
              decal.tx,
              decal.ty,
              decal.zBase,
              decal.renderAnchorY,
              decal.setId,
              decal.variantIndex,
              decal.rotationQuarterTurns,
              decalScale,
            )
            : null;
          const bakedEntry = pieceKey ? staticRelightBakeStore.get(pieceKey) : null;
          const relitCanvas = bakedEntry?.kind === "RELIT" ? bakedEntry.baked : null;
          const finalImage = relitCanvas ?? baked;
          if (rampRoadTiles.has(`${decal.tx},${decal.ty}`)) {
            const diamond = getDiamondFitCanvas(finalImage);
            const q = getRampQuadPoints(decal.tx, decal.ty, decal.renderAnchorY);
            return {
              image: diamond,
              sourceWidth: diamond.width,
              sourceHeight: diamond.height,
              finalVisibleTriangles: [
                {
                  stableId: renderKey.stableId,
                  srcPoints: [srcUvNW, srcUvNE, srcUvSE],
                  points: [q.nw, q.ne, q.se],
                },
                {
                  stableId: Number(renderKey.stableId) + 0.01,
                  srcPoints: [srcUvNW, srcUvSE, srcUvSW],
                  points: [q.nw, q.se, q.sw],
                },
              ],
            };
          }
          const rawCenterX = worldToScreen(decal.tx * T, decal.ty * T).x + camX;
          const rawCenterY = worldToScreen(decal.tx * T, decal.ty * T).y + camY - decal.zBase * ELEV_PX - SIDEWALK_ISO_HEIGHT * (decal.renderAnchorY - 0.5);
          const snapRoad = shouldPixelSnapRoadMarking(decal.setId, decal.variantIndex);
          const centerX = snapRoad ? Math.round(rawCenterX) : snapPx(rawCenterX);
          const centerY = snapRoad ? Math.round(rawCenterY) : snapPx(rawCenterY);
          const dx = centerX - baked.width * 0.5;
          const dy = centerY - baked.height * 0.5;
          return {
            mode: "flat",
            image: finalImage,
            dx: snapRoad ? Math.round(dx) : snapPx(dx),
            dy: snapRoad ? Math.round(dy) : snapPx(dy),
            dw: baked.width,
            dh: baked.height,
          };
        })(),
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

        enqueueSliceCommand(frameBuilder, renderKey, "overlay", {
          variant: "zoneObjective",
          zone,
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
      enqueueSliceCommand(frameBuilder, renderKey, "primitive", {
        variant: "entityShadow",
        shadowParams,
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
      enqueueSliceCommand(frameBuilder, renderKey, "primitive", {
        variant: "entityShadow",
        shadowParams,
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
      enqueueSliceCommand(frameBuilder, renderKey, "primitive", {
        variant: "entityShadow",
        shadowParams,
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
      enqueueSliceCommand(frameBuilder, renderKey, "primitive", {
        variant: "entityShadow",
        shadowParams,
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
