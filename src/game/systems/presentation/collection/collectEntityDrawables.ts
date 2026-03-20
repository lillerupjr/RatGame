import type { CollectionContext } from "../contracts/collectionContext";

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
    resolveDynamicSpriteRelightAlpha,
    getCurrencyFrame,
    ctx,
    dynamicSpriteRelightFrame,
    getCurrencyFrameForDarknessPercent,
    coinColorFromValue,
    addToSlice,
    getEnemyWorld,
    ez,
    getEntityFeetPos,
    registry,
    ENEMY_TYPE,
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
    getEnemySpriteFrameForDarknessPercent,
    drawEntityAnchorDebug,
    vendorNpcSpritesReady,
    getVendorNpcSpriteFrame,
    getVendorNpcSpriteFrameForDarknessPercent,
    getPigeonFramesForClipAndScreenDirForDarknessPercent,
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
    resolveProjectileShadowFootOffset,
    getProjectileSpriteByKind,
    PROJECTILE_BASE_DRAW_PX,
    getProjectileDrawScale,
    bazookaExhaustAssets,
    BAZOOKA_EXHAUST_OFFSET,
    PRJ_KIND,
    VFX_CLIPS,
    VFX_CLIP_INDEX,
    getSpriteById,
    snapToNearestWalkableGround,
    playerSpritesReady,
    getPlayerSpriteFrame,
    getPlayerSpriteFrameForDarknessPercent,
    PLAYER_R,
    worldLightRegistry,
    drawPendingLightRenderPieceFn,
  } = input as any;

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

      const drawClosure = () => {
        if (kind === 1) {
          const value = Math.max(1, Math.floor(w.xValue?.[i] ?? 1));
          const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(p.x, p.y);
          const sprite = getCurrencyFrame(value, w.time ?? 0);
          if (sprite.ready) {
            const S = 16;
            ctx.globalAlpha = 1;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprite.img, p.x - S / 2, p.y - S / 2, S, S);
            if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
              const litSprite = getCurrencyFrameForDarknessPercent(
                value,
                w.time ?? 0,
                dynamicSpriteRelightFrame.targetDarknessBucket,
              );
              if (litSprite.ready) {
                ctx.save();
                ctx.globalAlpha = dynamicRelightAlpha;
                ctx.drawImage(litSprite.img, p.x - S / 2, p.y - S / 2, S, S);
                ctx.restore();
              }
            }
          } else {
            const fill = coinColorFromValue(value);
            ctx.globalAlpha = 1;
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fdc";
          ctx.fillRect(p.x - 10, p.y - 8, 20, 16);

          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x - 10, p.y - 8, 20, 16);

          ctx.strokeStyle = "#b85";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x - 10, p.y);
          ctx.lineTo(p.x + 10, p.y);
          ctx.stroke();
        }
      };

      addToSlice(xtx + xty, renderKey, drawClosure);
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

      const def = registry.enemy(w.eType[i] as any);
      let baseColor: string = (def as any).color ?? "#f66";

      const isBoss = w.eType[i] === ENEMY_TYPE.BOSS;
      if (isBoss) baseColor = getBossAccent(w) ?? baseColor;

      const drawClosure = () => {
        const faceDx = w.eFaceX?.[i] ?? 0;
        const faceDy = w.eFaceY?.[i] ?? -1;
        const moving = Math.hypot(w.evx?.[i] ?? 0, w.evy?.[i] ?? 0) > 1e-4;
        const isLootGoblin = w.eType[i] === ENEMY_TYPE.LOOT_GOBLIN;

        if (isLootGoblin) {
          const pulse =
            LOOT_GOBLIN_GLOW_PULSE_MIN
            + LOOT_GOBLIN_GLOW_PULSE_RANGE * (0.5 + 0.5 * Math.sin((w.time ?? 0) * LOOT_GOBLIN_GLOW_PULSE_SPEED + i * 0.37));
          const enemyR = Math.max(8, w.eR[i] ?? 10);
          const outerRx = enemyR * ISO_X * LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT;
          const outerRy = enemyR * ISO_Y * LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT;
          const innerR = Math.max(1, enemyR * LOOT_GOBLIN_GLOW_INNER_RADIUS_MULT);
          const glow = ctx.createRadialGradient(
            feet.screenX,
            feet.screenY - enemyR * 0.25,
            innerR,
            feet.screenX,
            feet.screenY,
            Math.max(outerRx, outerRy),
          );
          glow.addColorStop(0, `rgba(255, 244, 178, ${0.42 * pulse})`);
          glow.addColorStop(0.55, `rgba(255, 215, 90, ${0.24 * pulse})`);
          glow.addColorStop(1, "rgba(255, 180, 60, 0)");
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, outerRx, outerRy, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.45 * pulse;
          ctx.strokeStyle = "rgba(255, 214, 96, 0.95)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, outerRx * 0.92, outerRy * 0.92, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        const fr = getEnemySpriteFrame({
          type: w.eType[i] as any,
          time: w.time ?? 0,
          faceDx,
          faceDy,
          moving,
        });
        const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);

        if (fr) {
          const dw = fr.sw * fr.scale;
          const dh = fr.sh * fr.scale;
          const frAny = fr as any;
          const anchorX = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any).eAnchorX01?.[i], frAny.anchorX01 ?? fr.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
            : (fr.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
          const anchorY = RENDER_ENTITY_ANCHORS
            ? resolveAnchor01((w as any).eAnchorY01?.[i], frAny.anchorY01 ?? fr.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
            : (fr.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);

          const dx = feet.screenX - dw * anchorX;
          const dy = feet.screenY - dh * anchorY;

          ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, Math.round(dx), Math.round(dy), dw, dh);
          if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
            const litFrame = getEnemySpriteFrameForDarknessPercent({
              type: w.eType[i] as any,
              time: w.time ?? 0,
              faceDx,
              faceDy,
              moving,
              darknessPercent: dynamicSpriteRelightFrame.targetDarknessBucket,
            });
            if (litFrame) {
              ctx.save();
              ctx.globalAlpha = dynamicRelightAlpha;
              ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, Math.round(dx), Math.round(dy), dw, dh);
              ctx.restore();
            }
          }
          drawEntityAnchorDebug(feet.screenX, feet.screenY, dx, dy, dw, dh);
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = baseColor;
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, (w.eR[i] ?? 10) * ISO_X, (w.eR[i] ?? 10) * ISO_Y, 0, 0, Math.PI * 2);
          ctx.fill();
          drawEntityAnchorDebug(feet.screenX, feet.screenY, feet.screenX - 8, feet.screenY - 8, 16, 16);
        }

        if (isBoss) {
          const pulse = 0.5 + 0.5 * Math.sin((w.time ?? 0) * 2.5);

          ctx.globalAlpha = 0.18 + pulse * 0.12;
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(
              feet.screenX,
              feet.screenY,
              (w.eR[i] ?? 10) * (1.25 + pulse * 0.05) * ISO_X,
              (w.eR[i] ?? 10) * (1.25 + pulse * 0.05) * ISO_Y,
              0,
              0,
              Math.PI * 2
          );
          ctx.stroke();

          ctx.globalAlpha = 0.28;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(feet.screenX, feet.screenY, (w.eR[i] ?? 10) * 1.55 * ISO_X, (w.eR[i] ?? 10) * 1.55 * ISO_Y, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.globalAlpha = 1;
        }



      };

      addToSlice(feet.slice, renderKey, drawClosure);
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

      const drawClosure = () => {
        const fr = vendorNpcSpritesReady()
          ? getVendorNpcSpriteFrame({ dir: npc.dirCurrent, time: w.time ?? 0 })
          : null;
        if (!fr) return;
        const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);
        const dw = fr.sw * fr.scale;
        const dh = fr.sh * fr.scale;
        const frAny = fr as any;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((npc as any).anchorX01, frAny.anchorX01 ?? fr.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (fr.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((npc as any).anchorY01, frAny.anchorY01 ?? fr.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (fr.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
        const dx = feet.screenX - dw * anchorX;
        const dy = feet.screenY - dh * anchorY;
        ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, Math.round(dx), Math.round(dy), dw, dh);
        if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
          const litFrame = getVendorNpcSpriteFrameForDarknessPercent({
            dir: npc.dirCurrent,
            time: w.time ?? 0,
            darknessPercent: dynamicSpriteRelightFrame.targetDarknessBucket,
          });
          if (litFrame) {
            ctx.save();
            ctx.globalAlpha = dynamicRelightAlpha;
            ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, Math.round(dx), Math.round(dy), dw, dh);
            ctx.restore();
          }
        }
        drawEntityAnchorDebug(feet.screenX, feet.screenY, dx, dy, dw, dh);
      };

      addToSlice(feet.slice, renderKey, drawClosure);
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
      const drawClosure = () => {
        const frameCount = mob.spriteFrames.length;
        if (frameCount <= 0) return;
        const frame = mob.spriteFrames[mob.anim.frameIndex % frameCount];
        if (!frame || frame.width <= 0 || frame.height <= 0) return;
        const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);

        const dw = frame.width * mob.render.scale;
        const dh = frame.height * mob.render.scale;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((mob.render as any).anchorX01, mob.render.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (mob.render.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((mob.render as any).anchorY01, mob.render.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (mob.render.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);
        const dx = feet.screenX - dw * anchorX;
        const dy = feet.screenY - dh * anchorY;
        if (mob.render.flipX) {
          ctx.save();
          ctx.translate(snapPx(dx + dw), snapPx(dy));
          ctx.scale(-1, 1);
          ctx.drawImage(frame, 0, 0, dw, dh);
          ctx.restore();
        } else {
          ctx.drawImage(frame, snapPx(dx), snapPx(dy), dw, dh);
        }
        if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
          const litFrames = getPigeonFramesForClipAndScreenDirForDarknessPercent(
            mob.anim.clip,
            mob.render.screenDir,
            dynamicSpriteRelightFrame.targetDarknessBucket,
          );
          if (litFrames.length > 0) {
            const litFrame = litFrames[mob.anim.frameIndex % litFrames.length];
            if (litFrame) {
              ctx.save();
              ctx.globalAlpha = dynamicRelightAlpha;
              if (mob.render.flipX) {
                ctx.translate(snapPx(dx + dw), snapPx(dy));
                ctx.scale(-1, 1);
                ctx.drawImage(litFrame, 0, 0, dw, dh);
              } else {
                ctx.drawImage(litFrame, snapPx(dx), snapPx(dy), dw, dh);
              }
              ctx.restore();
            }
          }
        }

        drawEntityAnchorDebug(feet.screenX, feet.screenY, dx, dy, dw, dh);

        if (!mob.debug.renderLogged) {
          mob.debug.renderLogged = true;
        }

        if (debug.neutralBirdAI.drawDebug) {
          const targetWx = (mob.behavior.targetTileX + 0.5) * T;
          const targetWy = (mob.behavior.targetTileY + 0.5) * T;
          const targetZ = tileHAtWorld(targetWx, targetWy);
          const targetP = toScreenAtZ(targetWx, targetWy, targetZ);
          const dPlayerTiles = Math.sqrt(Math.max(0, mob.behavior.lastPlayerDist2));
          const dTargetTiles = Math.sqrt(Math.max(0, mob.behavior.lastTargetDist2));
          const lines = [
            "PIGEON",
            `STATE: ${mob.behavior.state}`,
            `dPlayer: ${dPlayerTiles.toFixed(1)}`,
            `target: (${mob.behavior.targetTileX},${mob.behavior.targetTileY})`,
            `dTarget: ${dTargetTiles.toFixed(1)}`,
          ];
          ctx.save();
          ctx.font = "10px monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          const tx = snapPx(dx);
          const ty = snapPx(dy - 4);
          const pad = 2;
          let tw = 0;
          for (let li = 0; li < lines.length; li++) {
            tw = Math.max(tw, ctx.measureText(lines[li]).width);
          }
          const lineH = 11;
          const th = lineH * lines.length;
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(tx - pad, ty - th - pad, tw + pad * 2, th + pad * 2);
          ctx.fillStyle = "#8fffb0";
          for (let li = 0; li < lines.length; li++) {
            const ly = ty - lineH * (lines.length - 1 - li);
            ctx.fillText(lines[li], tx, ly);
          }

          ctx.strokeStyle = "#8fffb0";
          ctx.lineWidth = 1;
          const r = 5;
          ctx.beginPath();
          ctx.moveTo(targetP.x - r, targetP.y);
          ctx.lineTo(targetP.x + r, targetP.y);
          ctx.moveTo(targetP.x, targetP.y - r);
          ctx.lineTo(targetP.x, targetP.y + r);
          ctx.stroke();
          ctx.restore();
        }
      };

      addToSlice(feet.slice, renderKey, drawClosure);
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

      // Spark projectile: dedicated VFX clip rendering, skip generic path entirely
      if (w.prjKind[i] === PRJ_KIND.SPARK) {
        const drawSpark = () => {
          const clip = VFX_CLIPS[VFX_CLIP_INDEX.LIGHTNING_PROJ];
          if (!clip) return;
          const elapsed = (3.0 - (w.prTtl[i] ?? 0));
          const rawFrame = Math.floor(elapsed * clip.fps);
          const frameIdx = rawFrame % clip.spriteIds.length;
          const sprite = getSpriteById(clip.spriteIds[frameIdx]);
          if (!sprite.ready) return;
          const wdx = w.prDirX[i] ?? 1;
          const wdy = w.prDirY[i] ?? 0;
          const sd = worldDeltaToScreen(wdx, wdy);
          const ang = Math.atan2(sd.dy, sd.dx);
          const size = 32;
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.imageSmoothingEnabled = false;
          ctx.translate(snapPx(p.x), snapPx(p.y - zLift));
          ctx.rotate(ang);
          ctx.drawImage(sprite.img, -size / 2, -size / 2, size, size);
          ctx.restore();
        };
        addToSlice(ptx + pty, renderKey, drawSpark);
        continue;
      }

      const spr = getProjectileSpriteByKind(w.prjKind[i]);

      const drawClosure = () => {
        const px = p.x;
        const py = p.y - zLift;

        // Shadow
        {
          const r = w.prR[i] ?? 4;

          const wx0 = pp.wx;
          const wy0 = pp.wy;
          const sn = snapToNearestWalkableGround(wx0, wy0);

          const sx = sn.x;
          const sy = sn.y;

          const sp = toScreen(sx, sy);
          const projectileShadowOffset = resolveProjectileShadowFootOffset(w.prjKind[i]);

          const lift = Math.max(0, zLift || 0);
          const t = Math.max(0, Math.min(1, 1 - lift / 70));

          const rx = r * ISO_X * (0.95 + 0.15 * t);
          const ry = r * ISO_Y * (0.85 + 0.1 * t);

          ctx.save();
          ctx.globalAlpha = 0.18 * t;
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.ellipse(
            sp.x + projectileShadowOffset.x,
            sp.y + projectileShadowOffset.y,
            rx,
            ry,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();
        }

        const wdx = w.prDirX[i] ?? 1;
        const wdy = w.prDirY[i] ?? 0;
        const d = worldDeltaToScreen(wdx, wdy);
        const ang = Math.atan2(d.dy, d.dx);

        if (spr?.ready && spr.img && spr.img.width > 0 && spr.img.height > 0) {
          const areaMult = Math.max(0.6, Math.min(2.5, (w.prR[i] ?? 4) / 4));
          const target = PROJECTILE_BASE_DRAW_PX * areaMult * getProjectileDrawScale(w.prjKind[i]);

          const iw = spr.img.width;
          const ih = spr.img.height;

          const scale = target / Math.max(iw, ih);
          const dw = iw * scale;
          const dh = ih * scale;

          // Draw bazooka exhaust follower(s) before projectile so flame stays behind.
          const followers = (w as any).exhaustFollower as Record<number, { kind: string; targetEntity: number }> | undefined;
          const followerFrames = (w as any).exhaustFollowerFrame as Record<number, HTMLImageElement | null> | undefined;
          if (followers && followerFrames) {
            for (const eidKey of Object.keys(followers)) {
              const eid = Number(eidKey);
              const follower = followers[eid];
              if (!follower || follower.kind !== "bazooka_exhaust" || follower.targetEntity !== i) continue;
              const frame = followerFrames[eid];
              if (!frame || !frame.complete || frame.naturalWidth <= 0 || frame.naturalHeight <= 0) continue;

              const [anchorX, anchorY] = bazookaExhaustAssets.spec.anchorExhaust;
              const ax = (anchorX + BAZOOKA_EXHAUST_OFFSET.x) * scale;
              const ay = (anchorY + BAZOOKA_EXHAUST_OFFSET.y) * scale;
              const exhaustScale = scale * 0.5;
              const fw = frame.naturalWidth * exhaustScale;
              const fh = frame.naturalHeight * exhaustScale;
              const exhaustAng = ang + Math.PI * 0.5; // 90deg clockwise alignment fix

              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.globalAlpha = 0.95;
              ctx.translate(snapPx(px), snapPx(py));
              ctx.rotate(exhaustAng);
              ctx.drawImage(frame, snapPx(ax - fw * 0.5), snapPx(ay - fh * 0.5), fw, fh);
              ctx.restore();
            }
          }

          ctx.save();
          ctx.translate(snapPx(px), snapPx(py));
          ctx.rotate(ang);
          ctx.drawImage(spr.img, snapPx(-dw * 0.5), snapPx(-dh * 0.5), dw, dh);
          ctx.restore();
        } else {
          const src = registry.projectileSourceFromKind(w.prjKind[i]);
          ctx.fillStyle =
              src === "KNIFE"
                  ? "#fff"
                  : src === "PISTOL"
                      ? "#9f9"
                      : src === "KNUCKLES"
                          ? "#fc6"
                          : src === "SYRINGE"
                              ? "#7df"
                              : src === "BOUNCER"
                                  ? "#fdc"
                                  : "#bbb";

          ctx.beginPath();
          ctx.ellipse(px, py, (w.prR[i] ?? 4) * ISO_X, (w.prR[i] ?? 4) * ISO_Y, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      addToSlice(ptx + pty, renderKey, drawClosure);
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

    const drawClosure = () => {
      const glow = Math.max(0, w.playerBeamGlowIntensity || 0);
      const beamWidth = Math.max(1, w.playerBeamWidthPx || 6);
      const ax = start.x;
      const ay = start.y;
      const bx = end.x;
      const by = end.y;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      ctx.strokeStyle = `rgba(255, 90, 90, ${0.20 + 0.25 * glow})`;
      ctx.lineWidth = beamWidth * 2.6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 120, 120, ${0.40 + 0.35 * glow})`;
      ctx.lineWidth = beamWidth * 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -(w.playerBeamUvOffset * 20);
      ctx.strokeStyle = "rgba(255, 220, 220, 0.95)";
      ctx.lineWidth = beamWidth * 0.7;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(255, 170, 170, ${0.40 + 0.30 * glow})`;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(2, beamWidth * 0.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    addToSlice(feet.slice, renderKey, drawClosure);
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

    const drawClosure = () => {
      ctx.globalAlpha = 1;

      const dir = ((w as any)._plDir ?? "N") as Dir8;
      const moving = (w as any)._plMoving ?? false;
      const dynamicRelightAlpha = resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);
      const fr = playerSpritesReady()
        ? getPlayerSpriteFrame({ dir, moving, time: w.time ?? 0 })
        : null;

      if (fr) {
        const dw = fr.sw * fr.scale;
        const dh = fr.sh * fr.scale;
        const frAny = fr as any;
        const anchorX = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((w as any)._plAnchorX01, frAny.anchorX01 ?? fr.anchorX, ENTITY_ANCHOR_X01_DEFAULT)
          : (fr.anchorX ?? ENTITY_ANCHOR_X01_DEFAULT);
        const anchorY = RENDER_ENTITY_ANCHORS
          ? resolveAnchor01((w as any)._plAnchorY01, frAny.anchorY01 ?? fr.anchorY, ENTITY_ANCHOR_Y01_DEFAULT)
          : (fr.anchorY ?? ENTITY_ANCHOR_Y01_DEFAULT);

        const dx = Math.round(feet.screenX - dw * anchorX);
        const dy = Math.round(feet.screenY - dh * anchorY);

        ctx.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, dx, dy, dw, dh);
        if (dynamicRelightAlpha > 0 && dynamicSpriteRelightFrame) {
          const litFrame = getPlayerSpriteFrameForDarknessPercent({
            dir,
            moving,
            time: w.time ?? 0,
            darknessPercent: dynamicSpriteRelightFrame.targetDarknessBucket,
          });
          if (litFrame) {
            ctx.save();
            ctx.globalAlpha = dynamicRelightAlpha;
            ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, dx, dy, dw, dh);
            ctx.restore();
          }
        }
        drawEntityAnchorDebug(feet.screenX, feet.screenY, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#eaeaf2";
        ctx.beginPath();
        ctx.ellipse(feet.screenX, feet.screenY, PLAYER_R * ISO_X, PLAYER_R * ISO_Y, 0, 0, Math.PI * 2);
        ctx.fill();
        drawEntityAnchorDebug(feet.screenX, feet.screenY, feet.screenX - 8, feet.screenY - 8, 16, 16);
      }
    };

    addToSlice(feet.slice, renderKey, drawClosure);
  }

  // ----------------------------
  // Collect LIGHT render pieces into slices
  // ----------------------------
  {
    const lightRenderPieces: any[] = worldLightRegistry.renderPieces;
    for (let li = 0; li < lightRenderPieces.length; li++) {
      const lightPiece = lightRenderPieces[li];
      const renderKey: RenderKey = {
        slice: lightPiece.slice,
        within: lightPiece.within,
        baseZ: lightPiece.baseZ,
        kindOrder: KindOrder.LIGHT,
        stableId: lightPiece.stableId,
      };
      addToSlice(lightPiece.slice, renderKey, drawPendingLightRenderPieceFn, lightPiece);
    }
  }

  // ----------------------------
  // Collect non-wall FACE pieces into slices
}
