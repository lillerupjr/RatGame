import type { CollectionContext } from "../contracts/collectionContext";
import { enqueueSliceCommand } from "../frame/renderFrameBuilder";
import { getBossDefinitionForEntity, isBossEntity } from "../../../bosses/bossRuntime";
import {
  countRenderDynamicAtlasBypass,
  countRenderDynamicAtlasFallback,
  countRenderDynamicAtlasHit,
  countRenderDynamicAtlasMiss,
  countRenderDynamicAtlasRequest,
} from "../renderPerfCounters";
import {
  PROJECTILE_BASE_DRAW_PX,
  getProjectilePresentation,
  getProjectilePresentationDrawScale,
  resolveProjectileTravelVisualSpriteId,
} from "../../../content/projectilePresentationRegistry";

type RenderKey = any;
type Dir8 = any;

export function collectEntityDrawables(input: CollectionContext): void {
  const {
    w,
    T,
    getPickupWorld,
    KENNEY_TILE_WORLD,
    isTileInRenderRadius,
    tileHAtWorld,
    KindOrder,
    toScreen,
    getCurrencyFrame,
    ctx,
    coinColorFromValue,
    frameBuilder,
    getEnemyWorld,
    ez,
    getEntityFeetPos,
    registry,
    EnemyId,
    getBossAccent,
    LOOT_GOBLIN_GLOW_PULSE_MIN,
    LOOT_GOBLIN_GLOW_PULSE_RANGE,
    LOOT_GOBLIN_GLOW_PULSE_SPEED,
    LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT,
    LOOT_GOBLIN_GLOW_INNER_RADIUS_MULT,
    ISO_X,
    ISO_Y,
    getEnemySpriteFrame,
    RENDER_ENTITY_ANCHORS,
    resolveAnchor01,
    ENTITY_ANCHOR_X01_DEFAULT,
    ENTITY_ANCHOR_Y01_DEFAULT,
    drawEntityAnchorDebug,
    vendorNpcSpritesReady,
    getVendorNpcSpriteFrame,
    snapPx,
    debug,
    toScreenAtZ,
    getProjectileWorld,
    playerTxForProjectileCull,
    playerTyForProjectileCull,
    projectileTileRenderRadius,
    px,
    py,
    getSupportSurfaceAt,
    compiledMap,
    ELEV_PX,
    worldDeltaToScreen,
    getSpriteById,
    playerSpritesReady,
    getPlayerSpriteFrame,
    PLAYER_R,
    getDynamicAtlasFrameForImage,
  } = input as any;

  const resolveSpriteBodyDraw = (
    frame: any,
    anchorXOverride: number | undefined,
    anchorYOverride: number | undefined,
    feetX: number,
    feetY: number,
  ): { dx: number; dy: number; dw: number; dh: number } => {
    const drawWidth = frame.sw * frame.scale;
    const drawHeight = frame.sh * frame.scale;
    const frameAny = frame as any;
    const anchorX = RENDER_ENTITY_ANCHORS
      ? resolveAnchor01(anchorXOverride, frameAny.anchorX01 ?? frame.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
      : (frame.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
    const anchorY = RENDER_ENTITY_ANCHORS
      ? resolveAnchor01(anchorYOverride, frameAny.anchorY01 ?? frame.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
      : (frame.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
    return {
      dx: feetX - drawWidth * anchorX,
      dy: feetY - drawHeight * anchorY,
      dw: drawWidth,
      dh: drawHeight,
    };
  };

  const resolveImageBodyDraw = (
    imageWidth: number,
    imageHeight: number,
    scale: number,
    anchorXOverride: number | undefined,
    anchorYOverride: number | undefined,
    anchorXBase: number | undefined,
    anchorYBase: number | undefined,
    feetX: number,
    feetY: number,
  ): { dx: number; dy: number; dw: number; dh: number } => {
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const anchorX = RENDER_ENTITY_ANCHORS
      ? resolveAnchor01(anchorXOverride, anchorXBase, ENTITY_ANCHOR_X01_DEFAULT)
      : (anchorXBase ?? ENTITY_ANCHOR_X01_DEFAULT);
    const anchorY = RENDER_ENTITY_ANCHORS
      ? resolveAnchor01(anchorYOverride, anchorYBase, ENTITY_ANCHOR_Y01_DEFAULT)
      : (anchorYBase ?? ENTITY_ANCHOR_Y01_DEFAULT);
    return {
      dx: feetX - drawWidth * anchorX,
      dy: feetY - drawHeight * anchorY,
      dw: drawWidth,
      dh: drawHeight,
    };
  };

  const imageSpriteKey = (renderKey: RenderKey, stableOffset = 0): RenderKey => ({
    ...renderKey,
    stableId: Number(renderKey.stableId) + stableOffset,
  });

  const resolveDynamicAtlasImage = (
    image: CanvasImageSource,
    fallbackSw?: number,
    fallbackSh?: number,
  ): {
    image: CanvasImageSource;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  } => {
    countRenderDynamicAtlasRequest();
    const atlasFrame = getDynamicAtlasFrameForImage?.(image as object) ?? null;
    if (atlasFrame) {
      countRenderDynamicAtlasHit();
    } else {
      countRenderDynamicAtlasMiss();
      countRenderDynamicAtlasFallback();
    }
    return {
      image: atlasFrame?.image ?? image,
      sx: atlasFrame?.sx ?? 0,
      sy: atlasFrame?.sy ?? 0,
      sw: atlasFrame?.sw ?? Number(fallbackSw ?? (image as { width?: number }).width ?? 0),
      sh: atlasFrame?.sh ?? Number(fallbackSh ?? (image as { height?: number }).height ?? 0),
    };
  };

  // Collect PICKUPS into slices
  // ----------------------------
  {
    for (let i = 0; i < w.xAlive.length; i++) {
      if (!w.xAlive[i]) continue;

      const pickup = getPickupWorld(w, i, KENNEY_TILE_WORLD);
      const xtx = Math.floor(pickup.wx / T);
      const xty = Math.floor(pickup.wy / T);
      if (!isTileInRenderRadius(xtx, xty)) continue;
      const zAbs = tileHAtWorld(pickup.wx, pickup.wy);

      const renderKey: RenderKey = {
        slice: xtx + xty,
        within: xtx,
        baseZ: zAbs,
        kindOrder: KindOrder.ENTITY,
        stableId: 110000 + i,
      };

      const kind = w.xKind?.[i] ?? 1;
      const p = toScreen(pickup.wx, pickup.wy);
      if (kind === 1) {
        const value = Math.max(1, Math.floor(w.xValue?.[i] ?? 1));
        const sprite = getCurrencyFrame(value, w.time ?? 0);
        if (sprite?.ready && sprite.img) {
          const atlas = resolveDynamicAtlasImage(sprite.img, sprite.img.width, sprite.img.height);
          const size = 16;
          enqueueSliceCommand(frameBuilder, imageSpriteKey(renderKey), {
            semanticFamily: "worldSprite",
            finalForm: "quad",
            payload: {
              image: atlas.image,
              sx: atlas.sx,
              sy: atlas.sy,
              sw: atlas.sw,
              sh: atlas.sh,
              dx: p.x - size * 0.5,
              dy: p.y - size * 0.5,
              dw: size,
              dh: size,
              alpha: 1,
              pickupIndex: i,
              pickupKind: kind,
            },
          });
          continue;
        }
      }

      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          pickupIndex: i,
          pickupKind: kind,
          screenX: p.x,
          screenY: p.y,
        },
      });
      countRenderDynamicAtlasBypass();
    }
  }

  // ----------------------------
  // Collect ENEMIES into slices
  // ----------------------------
  {
    for (let i = 0; i < w.eAlive.length; i++) {
      if (!w.eAlive[i]) continue;

      const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      const etx = Math.floor(ew.wx / T);
      const ety = Math.floor(ew.wy / T);
      if (!isTileInRenderRadius(etx, ety)) continue;
      const zAbs = ez?.[i] ?? tileHAtWorld(ew.wx, ew.wy);
      const feet = getEntityFeetPos(ew.wx, ew.wy, zAbs);

      const renderKey: RenderKey = {
        slice: feet.slice,
        within: feet.within,
        baseZ: zAbs,
        feetSortY: feet.screenY,
        kindOrder: KindOrder.ENTITY,
        stableId: 120000 + i,
      };

      const bossDef = getBossDefinitionForEntity(w, i);
      const def = bossDef ?? registry.enemy(w.eType[i] as any);
      let baseColor: string = def.presentation?.color ?? "#f66";

      const isBoss = isBossEntity(w, i);
      if (isBoss) baseColor = bossDef?.ui?.accent ?? getBossAccent(w) ?? baseColor;

      const faceDx = w.eFaceX?.[i] ?? 0;
      const faceDy = w.eFaceY?.[i] ?? -1;
      const moving = Math.hypot(w.evx?.[i] ?? 0, w.evy?.[i] ?? 0) > 1e-4;
      const frame = bossDef
        ? null
        : getEnemySpriteFrame({
            type: w.eType[i],
            time: w.time ?? 0,
            faceDx,
            faceDy,
            moving,
          });
      if (frame) {
        const atlas = resolveDynamicAtlasImage(frame.img, frame.sw, frame.sh);
        const draw = resolveSpriteBodyDraw(
          frame,
          (w as any).eAnchorX01?.[i],
          (w as any).eAnchorY01?.[i],
          feet.screenX,
          feet.screenY,
        );
        enqueueSliceCommand(frameBuilder, imageSpriteKey(renderKey), {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: {
            image: atlas.image,
            sx: atlas.sx,
            sy: atlas.sy,
            sw: atlas.sw,
            sh: atlas.sh,
            dx: Math.round(draw.dx),
            dy: Math.round(draw.dy),
            dw: draw.dw,
            dh: draw.dh,
            alpha: 1,
            enemyIndex: i,
          },
        });
        continue;
      }

      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          enemyIndex: i,
          feet,
          baseColor,
          isBoss,
        },
      });
      countRenderDynamicAtlasBypass();
    }
  }

  // ----------------------------
  // Collect NPCS into slices
  // ----------------------------
  {
    for (let i = 0; i < w.npcs.length; i++) {
      const npc = w.npcs[i];
      const ntx = Math.floor(npc.wx / T);
      const nty = Math.floor(npc.wy / T);
      if (!isTileInRenderRadius(ntx, nty)) continue;
      const zAbs = tileHAtWorld(npc.wx, npc.wy);
      const feet = getEntityFeetPos(npc.wx, npc.wy, zAbs);

      const renderKey: RenderKey = {
        slice: feet.slice,
        within: feet.within,
        baseZ: zAbs,
        feetSortY: feet.screenY,
        kindOrder: KindOrder.ENTITY,
        stableId: 125000 + i,
      };

      const frame = vendorNpcSpritesReady() ? getVendorNpcSpriteFrame({ dir: npc.dirCurrent, time: w.time ?? 0 }) : null;
      if (frame) {
        const atlas = resolveDynamicAtlasImage(frame.img, frame.sw, frame.sh);
        const draw = resolveSpriteBodyDraw(
          frame,
          (npc as any).anchorX01,
          (npc as any).anchorY01,
          feet.screenX,
          feet.screenY,
        );
        enqueueSliceCommand(frameBuilder, imageSpriteKey(renderKey), {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: {
            image: atlas.image,
            sx: atlas.sx,
            sy: atlas.sy,
            sw: atlas.sw,
            sh: atlas.sh,
            dx: Math.round(draw.dx),
            dy: Math.round(draw.dy),
            dw: draw.dw,
            dh: draw.dh,
            alpha: 1,
            npcIndex: i,
          },
        });
        continue;
      }

      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          npcIndex: i,
          feet,
        },
      });
      countRenderDynamicAtlasBypass();
    }
  }

  // ----------------------------
  // Collect NEUTRAL MOBS into slices
  // ----------------------------
  {
    for (let i = 0; i < w.neutralMobs.length; i++) {
      const mob = w.neutralMobs[i];
      const mtx = Math.floor(mob.pos.wx / T);
      const mty = Math.floor(mob.pos.wy / T);
      if (!isTileInRenderRadius(mtx, mty)) continue;
      const zGround = tileHAtWorld(mob.pos.wx, mob.pos.wy);
      const zAbs = zGround + (mob.pos.wzOffset ?? 0);
      const feet = getEntityFeetPos(mob.pos.wx, mob.pos.wy, zAbs);

      const renderKey: RenderKey = {
        slice: feet.slice,
        within: feet.within,
        baseZ: zAbs,
        feetSortY: feet.screenY,
        kindOrder: KindOrder.ENTITY,
        stableId: 127000 + i,
      };

      const frameCount = mob.spriteFrames.length;
      if (frameCount > 0) {
        const frame = mob.spriteFrames[mob.anim.frameIndex % frameCount];
        if (frame && frame.width > 0 && frame.height > 0) {
          const atlas = resolveDynamicAtlasImage(frame, frame.width, frame.height);
          const draw = resolveImageBodyDraw(
            frame.width,
            frame.height,
            mob.render.scale,
            (mob.render as any).anchorX01,
            (mob.render as any).anchorY01,
            mob.render.anchorX,
            mob.render.anchorY,
            feet.screenX,
            feet.screenY,
          );
          enqueueSliceCommand(frameBuilder, imageSpriteKey(renderKey), {
            semanticFamily: "worldSprite",
            finalForm: "quad",
            payload: {
              image: atlas.image,
              sx: atlas.sx,
              sy: atlas.sy,
              sw: atlas.sw,
              sh: atlas.sh,
              dx: snapPx(draw.dx),
              dy: snapPx(draw.dy),
              dw: draw.dw,
              dh: draw.dh,
              flipX: !!mob.render.flipX,
              alpha: 1,
              neutralMobIndex: i,
            },
          });
          continue;
        }
      }

      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          neutralMobIndex: i,
          feet,
        },
      });
      countRenderDynamicAtlasBypass();
    }
  }

  // ----------------------------
  // Collect PROJECTILES into slices (as VFX, not special cased anymore)
  // ----------------------------
  {
    for (let i = 0; i < w.pAlive.length; i++) {
      if (!w.pAlive[i]) continue;
      if (w.prHidden?.[i]) continue;

      const pp = getProjectileWorld(w, i, KENNEY_TILE_WORLD);
      const ptx = Math.floor(pp.wx / T);
      const pty = Math.floor(pp.wy / T);
      const firePlayerX = w.prPlayerFireX?.[i] ?? px;
      const firePlayerY = w.prPlayerFireY?.[i] ?? py;
      const firePlayerTx = Math.floor(firePlayerX / T);
      const firePlayerTy = Math.floor(firePlayerY / T);
      const inCurrentPlayerRange =
        Math.abs(ptx - playerTxForProjectileCull) <= projectileTileRenderRadius
        && Math.abs(pty - playerTyForProjectileCull) <= projectileTileRenderRadius;
      const inFirePlayerRange =
        Math.abs(ptx - firePlayerTx) <= projectileTileRenderRadius
        && Math.abs(pty - firePlayerTy) <= projectileTileRenderRadius;
      if (!inCurrentPlayerRange && !inFirePlayerRange) continue;
      const baseH = tileHAtWorld(pp.wx, pp.wy);
      const pzAbs = (w.prZVisual?.[i] ?? w.prZ?.[i] ?? baseH) || 0;
      const support = getSupportSurfaceAt(pp.wx, pp.wy, compiledMap, pzAbs);
      const feet = getEntityFeetPos(pp.wx, pp.wy, pzAbs);

      const renderKey: RenderKey = {
        slice: ptx + pty,
        within: ptx,
        baseZ: support.worldZ,
        feetSortY: feet.screenY,
        kindOrder: KindOrder.VFX,
        stableId: 130000 + i,
      };

      const zLift = (pzAbs - baseH) * ELEV_PX;
      const p = toScreen(pp.wx, pp.wy);
      const nowSec = w.timeSec ?? w.time ?? 0;
      const spawnTimeSec = w.prSpawnTime?.[i] ?? nowSec;
      const projectilePresentation = getProjectilePresentation(w.prjKind[i]);
      const bodySpriteId = resolveProjectileTravelVisualSpriteId(projectilePresentation.body, nowSec, spawnTimeSec);
      const bodySprite = bodySpriteId ? getSpriteById(bodySpriteId) : null;
      const delta = worldDeltaToScreen(w.prDirX[i] ?? 1, w.prDirY[i] ?? 0);
      const bodyAngle = Math.atan2(delta.dy, delta.dx);
      const areaMult = Math.max(0.6, Math.min(2.5, (w.prR[i] ?? 4) / 4));
      const bodyTarget = PROJECTILE_BASE_DRAW_PX * areaMult * getProjectilePresentationDrawScale(w.prjKind[i]);
      const bodyScale = bodySprite?.ready && bodySprite.img && bodySprite.img.width > 0 && bodySprite.img.height > 0
        ? bodyTarget / Math.max(bodySprite.img.width, bodySprite.img.height)
        : 0;
      const projectileCenterX = p.x;
      const projectileCenterY = p.y - zLift;

      const emitProjectileSprite = (
        spriteId: string | null,
        angleRad: number,
        centerX: number,
        centerY: number,
        scale: number,
        stableOffset: number,
        alpha = 1,
        blendMode: "normal" | "additive" = "normal",
      ): boolean => {
        if (!spriteId || !(scale > 0)) return false;
        const sprite = getSpriteById(spriteId);
        if (!sprite?.ready || !sprite.img || sprite.img.width <= 0 || sprite.img.height <= 0) return false;
        const atlas = resolveDynamicAtlasImage(sprite.img, sprite.img.width, sprite.img.height);
        const drawWidth = sprite.img.width * scale;
        const drawHeight = sprite.img.height * scale;
        enqueueSliceCommand(frameBuilder, imageSpriteKey(renderKey, stableOffset), {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: {
            image: atlas.image,
            sx: atlas.sx,
            sy: atlas.sy,
            sw: atlas.sw,
            sh: atlas.sh,
            dx: centerX - drawWidth * 0.5,
            dy: centerY - drawHeight * 0.5,
            dw: drawWidth,
            dh: drawHeight,
            rotationRad: angleRad,
            alpha,
            blendMode,
            projectileIndex: i,
          },
        });
        return true;
      };

      const emitProjectileAttachment = (attachment: any, stableOffset: number): void => {
        if (!(bodyScale > 0)) return;
        const spriteId = resolveProjectileTravelVisualSpriteId(attachment.visual, nowSec, spawnTimeSec);
        const attachmentAngle = bodyAngle + Number(attachment.rotationOffsetRad ?? 0);
        const offsetX = Number(attachment.offsetPx?.x ?? 0) * bodyScale;
        const offsetY = Number(attachment.offsetPx?.y ?? 0) * bodyScale;
        const cos = Math.cos(attachmentAngle);
        const sin = Math.sin(attachmentAngle);
        const centerX = projectileCenterX + offsetX * cos - offsetY * sin;
        const centerY = projectileCenterY + offsetX * sin + offsetY * cos;
        emitProjectileSprite(
          spriteId,
          attachmentAngle,
          centerX,
          centerY,
          bodyScale * Number(attachment.scaleMult ?? 1),
          stableOffset,
          Number(attachment.alpha ?? 1),
          attachment.blendMode === "additive" ? "additive" : "normal",
        );
      };

      const behindAttachments = (projectilePresentation.attachments ?? []).filter(
        (attachment) => attachment.renderLayer === "behindBody",
      );
      for (let j = 0; j < behindAttachments.length; j++) {
        emitProjectileAttachment(behindAttachments[j], -50 + j);
      }

      const didEmitBody = emitProjectileSprite(
        bodySpriteId,
        bodyAngle,
        projectileCenterX,
        projectileCenterY,
        bodyScale,
        0,
      );

      const frontAttachments = (projectilePresentation.attachments ?? []).filter(
        (attachment) => attachment.renderLayer !== "behindBody",
      );
      for (let j = 0; j < frontAttachments.length; j++) {
        emitProjectileAttachment(frontAttachments[j], 50 + j);
      }

      if (didEmitBody) continue;

      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          projectileIndex: i,
          screenX: p.x,
          screenY: p.y,
          zLift,
        },
      });
      countRenderDynamicAtlasBypass();
    }
  }

  // ----------------------------
  // Collect PLAYER BEAM into slices
  // ----------------------------
  if (w.playerBeamActive) {
    const zBase = w.pzVisual ?? w.pz ?? tileHAtWorld(w.playerBeamStartX, w.playerBeamStartY);
    const BEAM_HEAD_LIFT_Z = 3;
    const start = toScreenAtZ(w.playerBeamStartX, w.playerBeamStartY, zBase + BEAM_HEAD_LIFT_Z);
    const end = toScreenAtZ(w.playerBeamEndX, w.playerBeamEndY, zBase);
    const midX = (w.playerBeamStartX + w.playerBeamEndX) * 0.5;
    const midY = (w.playerBeamStartY + w.playerBeamEndY) * 0.5;
    const feet = getEntityFeetPos(midX, midY, zBase);

    const renderKey: RenderKey = {
      slice: feet.slice,
      within: feet.within,
      baseZ: zBase,
      feetSortY: feet.screenY,
      kindOrder: KindOrder.VFX,
      stableId: 129500,
    };

    enqueueSliceCommand(frameBuilder, renderKey, {
      semanticFamily: "worldPrimitive",
      finalForm: "primitive",
      payload: {
        start,
        end,
      },
    });
  }

  // ----------------------------
  // Collect PLAYER into slices
  // ----------------------------
  {
    const pzAbs2 = w.pzVisual ?? w.pz ?? tileHAtWorld(px, py);
    const feet = getEntityFeetPos(px, py, pzAbs2);

    const renderKey: RenderKey = {
      slice: feet.slice,
      within: feet.within,
      baseZ: pzAbs2,
      feetSortY: feet.screenY,
      kindOrder: KindOrder.ENTITY,
      stableId: 0,
    };

    const dir = ((w as any)._plDir ?? "N") as string;
    const moving = !!((w as any)._plMoving ?? false);
    const frame = playerSpritesReady() ? getPlayerSpriteFrame({ dir, moving, time: w.time ?? 0 }) : null;
    if (frame) {
      const atlas = resolveDynamicAtlasImage(frame.img, frame.sw, frame.sh);
      const draw = resolveSpriteBodyDraw(
        frame,
        (w as any)._plAnchorX01,
        (w as any)._plAnchorY01,
        feet.screenX,
        feet.screenY,
      );
      enqueueSliceCommand(frameBuilder, imageSpriteKey(renderKey), {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          image: atlas.image,
          sx: atlas.sx,
          sy: atlas.sy,
          sw: atlas.sw,
          sh: atlas.sh,
          dx: Math.round(draw.dx),
          dy: Math.round(draw.dy),
          dw: draw.dw,
          dh: draw.dh,
          alpha: 1,
        },
      });
    } else {
      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          feet,
        },
      });
      countRenderDynamicAtlasBypass();
    }
  }

  // ----------------------------
  // Collect non-wall FACE pieces into slices
}
