import { configurePixelPerfect, snapPx } from "../../../../engine/render/pixelPerfect";
import { drawVoidBackgroundOnce } from "../frame/backgroundPass";
import { drawProjectedLightAdditive } from "../renderLighting";
import { drawTexturedTriangle } from "../renderPrimitives/drawTexturedTriangle";
import { renderEntityShadow } from "../renderShadow";
import type { RenderExecutionPlan } from "./renderExecutionPlan";
import type { RenderFrameContext } from "../contracts/renderFrameContext";
import type { RenderCommand } from "../contracts/renderCommands";
import { renderZoneObjectives } from "../../../render/renderZoneObjectives";

type Canvas2DRendererDeps = any;

export class Canvas2DRenderer {
  constructor(
    private readonly frameContext: RenderFrameContext,
    private readonly deps: Canvas2DRendererDeps,
  ) {}

  render(plan: RenderExecutionPlan): void {
    this.clearMainCanvas();
    this.clearOverlayCanvas();
    this.drawBackground();
    this.renderWorldCommands(plan.world);
    this.renderScreenCommands(plan.screen);
  }

  clearMainCanvas(): void {
    const { ctx, canvas } = this.frameContext;
    const devW = Math.max(1, canvas.width);
    const devH = Math.max(1, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, devW, devH);
    configurePixelPerfect(ctx);
  }

  clearOverlayCanvas(): void {
    const { overlayCtx, overlayCanvas } = this.frameContext;
    const overlayDevW = Math.max(1, overlayCanvas.width);
    const overlayDevH = Math.max(1, overlayCanvas.height);
    overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    overlayCtx.clearRect(0, 0, overlayDevW, overlayDevH);
  }

  drawBackground(): void {
    const { ctx, viewport, canvas } = this.frameContext;
    const devW = Math.max(1, canvas.width);
    const devH = Math.max(1, canvas.height);
    drawVoidBackgroundOnce(ctx, devW, devH, viewport);
  }

  renderWorldCommands(commands: readonly RenderCommand[]): void {
    const { ctx, viewport } = this.frameContext;
    ctx.save();
    viewport.applyWorld(ctx);
    for (let i = 0; i < commands.length; i++) {
      this.executeCommand(commands[i]);
    }
    ctx.restore();
  }

  renderScreenCommands(commands: readonly RenderCommand[]): void {
    for (let i = 0; i < commands.length; i++) {
      this.executeCommand(commands[i]);
    }
  }

  private getCommandCanvasTarget(command: RenderCommand): {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
  } {
    if (command.pass === "SCREEN") {
      return {
        ctx: this.frameContext.overlayCtx,
        width: this.frameContext.overlayDevW,
        height: this.frameContext.overlayDevH,
      };
    }
    return {
      ctx: this.frameContext.ctx,
      width: this.frameContext.devW,
      height: this.frameContext.devH,
    };
  }

  private executeCommand(command: RenderCommand): void {
    const payload = command.payload as any;
    if (command.semanticFamily === "groundSurface") {
      this.drawTriangleMesh(payload);
      return;
    }

    if (command.semanticFamily === "groundDecal") {
      this.drawTriangleMesh(payload);
      return;
    }

    if (command.semanticFamily === "worldPrimitive") {
      if (payload.shadowParams) {
        renderEntityShadow(
          this.frameContext.ctx,
          payload.shadowParams as any,
          this.deps.compiledMap,
          this.deps.shadowSunModel.projectionDirection,
        );
        return;
      }
      if (payload.zoneKind !== undefined) {
        this.drawZoneEffect(payload);
        return;
      }
      if (payload.start && payload.end) {
        this.drawPlayerBeam(payload);
        return;
      }
      if (payload.zone) {
        renderZoneObjectives(this.frameContext.ctx, this.deps.w, {
          zone: payload.zone as any,
          mapOriginTx: this.deps.compiledMap.originTx,
          mapOriginTy: this.deps.compiledMap.originTy,
          tileWorld: this.deps.T,
          toScreen: this.deps.toScreen,
          showZoneBounds: this.deps.SHOW_ZONE_OBJECTIVE_BOUNDS,
        });
        return;
      }
      if (payload.lightPiece) {
        const lightPiece = payload.lightPiece as any;
        const ctx = this.frameContext.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        configurePixelPerfect(ctx);
        drawProjectedLightAdditive(
          ctx,
          lightPiece.light.projected,
          this.deps.w.time ?? 0,
          this.deps.worldLightGroundYScale,
        );
        ctx.restore();
        return;
      }
    }

    if (command.semanticFamily === "screenOverlay") {
      const target = this.getCommandCanvasTarget(command);
      if (command.finalForm === "quad") {
        const ctx = target.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = Number(payload.alpha ?? 1);
        ctx.fillStyle = String(payload.color ?? "#000");
        ctx.fillRect(0, 0, Number(payload.width ?? 0), Number(payload.height ?? 0));
        ctx.restore();
        return;
      }
      if (
        payload.darknessAlpha !== undefined
        || payload.ambientTint !== undefined
        || payload.ambientTintStrength !== undefined
      ) {
        this.deps.setRenderPerfDrawTag?.("lighting");
        this.deps.renderAmbientDarknessOverlay(
          target.ctx,
          {
            darknessAlpha: Number(payload.darknessAlpha ?? 0),
            ambientTint: payload.ambientTint,
            ambientTintStrength: payload.ambientTintStrength,
          },
          target.width,
          target.height,
        );
        this.deps.setRenderPerfDrawTag?.(null);
        return;
      }
      this.drawFloatingText();
      return;
    }

    if (command.semanticFamily === "worldSprite") {
      if (payload.draw) {
        this.drawRenderPiece(payload.draw);
        return;
      }
      if (payload.image && Number.isFinite(Number(payload.dx)) && Number.isFinite(Number(payload.dy))) {
        this.drawImageSprite(payload);
        return;
      }
      if (payload.vfxIndex !== undefined) {
        this.drawVfxClip(payload);
        return;
      }
      if (payload.pickupIndex !== undefined) {
        this.drawPickup(payload);
        return;
      }
      if (payload.enemyIndex !== undefined) {
        this.drawEnemy(payload);
        return;
      }
      if (payload.npcIndex !== undefined) {
        this.drawNpc(payload);
        return;
      }
      if (payload.neutralMobIndex !== undefined) {
        this.drawNeutralMob(payload);
        return;
      }
      if (payload.projectileIndex !== undefined && payload.sparkStyle) {
        this.drawProjectileSpark(payload);
        return;
      }
      if (payload.projectileIndex !== undefined) {
        this.drawProjectile(payload);
        return;
      }
      if (payload.feet) {
        if (payload.enemyIndex !== undefined) this.drawEnemy(payload);
        else if (payload.npcIndex !== undefined) this.drawNpc(payload);
        else if (payload.neutralMobIndex !== undefined) this.drawNeutralMob(payload);
        else this.drawPlayer(payload);
        return;
      }
    }

    if (command.semanticFamily === "worldGeometry") {
      this.drawTriangleMesh(payload);
      return;
    }

    if (command.semanticFamily === "debug") {
      if (payload.triangleOverlay) {
        this.drawDebugTriangleOverlay(payload);
        return;
      }
      if (payload.sweepShadowMap) {
        this.drawSweepShadowMap(payload);
        return;
      }
      if (payload.cells) {
        this.drawPlayerWedge(payload);
        return;
      }
      if (payload.phase) {
        const input = { ...(payload.input as Record<string, unknown>), ctx: this.frameContext.ctx };
        this.deps.executeDebugPass({
          phase: payload.phase,
          input,
        });
      }
    }
  }

  private drawRuntimeSidewalkTop(data: any): void {
    const src = this.deps.getTileSpriteById(`tiles/floor/${data.family}/${data.variantIndex}`);
    if (!src.ready || !src.img || src.img.width <= 0 || src.img.height <= 0) return;
    const baseBaked = this.deps.getRuntimeIsoTopCanvas(src.img, data.rotationQuarterTurns);
    if (!baseBaked) return;
    const isRampRoadTile = data.family === "asphalt" && this.deps.rampRoadTiles.has(`${data.tx},${data.ty}`);
    if (isRampRoadTile) {
      const diamond = baseBaked;
      this.drawRampDiamond(diamond, data.tx, data.ty, data.anchorY);
      return;
    }
    const wx = (data.tx + 0.5) * this.deps.T;
    const wy = (data.ty + 0.5) * this.deps.T;
    const p = this.deps.worldToScreen(wx, wy);
    const centerX = snapPx(p.x + this.deps.camX);
    const centerY = snapPx(
      p.y + this.deps.camY - data.zBase * this.deps.ELEV_PX - this.deps.SIDEWALK_ISO_HEIGHT * (data.anchorY - 0.5),
    );
    const dx = centerX - this.deps.SIDEWALK_SRC_SIZE * 0.5;
    const dy = centerY - this.deps.SIDEWALK_ISO_HEIGHT * 0.5;
    const pieceKey = this.deps.staticRelightFrame
      ? this.deps.floorRelightPieceKey(
        data.tx,
        data.ty,
        data.zBase,
        data.anchorY,
        data.family,
        data.variantIndex,
        data.rotationQuarterTurns,
      )
      : null;
    const bakedEntry = pieceKey ? this.deps.staticRelightBakeStore.get(pieceKey) : null;
    const relitCanvas = bakedEntry?.kind === "RELIT" ? bakedEntry.baked : null;
    const ctx = this.frameContext.ctx;
    if (relitCanvas) ctx.drawImage(relitCanvas, snapPx(dx), snapPx(dy), baseBaked.width, baseBaked.height);
    else ctx.drawImage(baseBaked, snapPx(dx), snapPx(dy));
  }

  private drawImageTop(data: any): void {
    const ctx = this.frameContext.ctx;
    if (data.mode === "oceanProjected") {
      const baked = this.deps.getRuntimeIsoDecalCanvas(data.image, 0, data.oceanProjectionScale);
      if (!baked) return;
      const wx = (data.tx + 0.5) * this.deps.T;
      const wy = (data.ty + 0.5) * this.deps.T;
      const p = this.deps.worldToScreen(wx, wy);
      const centerX = snapPx(p.x + this.deps.camX);
      const centerY = snapPx(
        p.y + this.deps.camY - data.zBase * this.deps.ELEV_PX - this.deps.SIDEWALK_ISO_HEIGHT * (data.renderAnchorY - 0.5),
      );
      ctx.drawImage(baked, centerX - baked.width * 0.5, centerY - baked.height * 0.5);
      return;
    }

    ctx.drawImage(
      data.image,
      snapPx(Number(data.dx)),
      snapPx(Number(data.dy)),
      Number(data.dw),
      Number(data.dh),
    );
  }

  private drawSweepShadowMap(data: any): void {
    const sweepShadowMap = data.sweepShadowMap as {
      originTx: number;
      originTy: number;
      width: number;
      height: number;
      data: Float32Array;
    } | null;
    if (!sweepShadowMap) return;

    const ctx = this.frameContext.ctx;
    const SWEEP_MAX_DARKNESS = 0.38;
    const { originTx, originTy, width, height, data: intensityData } = sweepShadowMap;

    this.deps.setRenderPerfDrawTag?.("floors");
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const intensity = intensityData[ty * width + tx] ?? 0;
        const alpha = intensity * SWEEP_MAX_DARKNESS;
        if (alpha <= 0) continue;
        const mapTx = tx + originTx;
        const mapTy = ty + originTy;
        const tileH = this.deps.tileHAtWorld((mapTx + 0.5) * this.deps.T, (mapTy + 0.5) * this.deps.T);
        const nw = this.deps.toScreenAtZ(mapTx * this.deps.T, mapTy * this.deps.T, tileH);
        const ne = this.deps.toScreenAtZ((mapTx + 1) * this.deps.T, mapTy * this.deps.T, tileH);
        const se = this.deps.toScreenAtZ((mapTx + 1) * this.deps.T, (mapTy + 1) * this.deps.T, tileH);
        const sw = this.deps.toScreenAtZ(mapTx * this.deps.T, (mapTy + 1) * this.deps.T, tileH);
        ctx.beginPath();
        ctx.moveTo(nw.x, nw.y);
        ctx.lineTo(ne.x, ne.y);
        ctx.lineTo(se.x, se.y);
        ctx.lineTo(sw.x, sw.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
        ctx.fill("nonzero");
      }
    }
    ctx.restore();
    this.deps.setRenderPerfDrawTag?.(null);
  }

  private drawRuntimeDecalTop(data: any): void {
    const src = this.deps.getRuntimeDecalSprite(data.setId, data.variantIndex);
    if (!src.ready || !src.img || src.img.width <= 0 || src.img.height <= 0) return;
    const decalScale = this.deps.roadMarkingDecalScale(data.setId, data.variantIndex);
    const baked = this.deps.getRuntimeIsoDecalCanvas(src.img, data.rotationQuarterTurns, decalScale);
    if (!baked) return;
    const wx = data.tx * this.deps.T;
    const wy = data.ty * this.deps.T;
    const p = this.deps.worldToScreen(wx, wy);
    const rawCenterX = p.x + this.deps.camX;
    const rawCenterY = p.y + this.deps.camY - data.zBase * this.deps.ELEV_PX - this.deps.SIDEWALK_ISO_HEIGHT * (data.renderAnchorY - 0.5);
    const shouldSnapRoadMarking = this.deps.shouldPixelSnapRoadMarking(data.setId, data.variantIndex);
    const centerX = shouldSnapRoadMarking ? Math.round(rawCenterX) : snapPx(rawCenterX);
    const centerY = shouldSnapRoadMarking ? Math.round(rawCenterY) : snapPx(rawCenterY);
    if (this.deps.rampRoadTiles.has(`${data.tx},${data.ty}`)) {
      const diamond = this.deps.getDiamondFitCanvas(baked);
      this.drawRampDiamond(diamond, data.tx, data.ty, data.renderAnchorY);
      return;
    }
    const dx = centerX - baked.width * 0.5;
    const dy = centerY - baked.height * 0.5;
    const drawX = shouldSnapRoadMarking ? Math.round(dx) : snapPx(dx);
    const drawY = shouldSnapRoadMarking ? Math.round(dy) : snapPx(dy);
    const pieceKey = this.deps.staticRelightFrame
      ? this.deps.decalRelightPieceKey(
        Math.floor(data.tx),
        Math.floor(data.ty),
        data.zBase,
        data.renderAnchorY,
        data.setId,
        data.variantIndex,
        data.rotationQuarterTurns,
        decalScale,
      )
      : null;
    const bakedEntry = pieceKey ? this.deps.staticRelightBakeStore.get(pieceKey) : null;
    const relitCanvas = bakedEntry?.kind === "RELIT" ? bakedEntry.baked : null;
    const ctx = this.frameContext.ctx;
    if (relitCanvas) ctx.drawImage(relitCanvas, drawX, drawY, baked.width, baked.height);
    else ctx.drawImage(baked, drawX, drawY);
  }

  private drawRampDiamond(srcDiamond: HTMLCanvasElement, tx: number, ty: number, renderAnchorY: number): void {
    const q = this.deps.getRampQuadPoints(tx, ty, renderAnchorY);
    drawTexturedTriangle(this.frameContext.ctx, srcDiamond, 128, 64, this.deps.srcUvNW, this.deps.srcUvNE, this.deps.srcUvSE, q.nw, q.ne, q.se);
    drawTexturedTriangle(this.frameContext.ctx, srcDiamond, 128, 64, this.deps.srcUvNW, this.deps.srcUvSE, this.deps.srcUvSW, q.nw, q.se, q.sw);
  }

  private drawZoneEffect(data: any): void {
    const ctx = this.frameContext.ctx;
    const p = {
      x: Number.isFinite(Number(data.screenX)) ? Number(data.screenX) : this.deps.toScreen(data.worldX, data.worldY).x,
      y: Number.isFinite(Number(data.screenY)) ? Number(data.screenY) : this.deps.toScreen(data.worldX, data.worldY).y,
    };
    const rx = Number.isFinite(Number(data.radiusScreenX)) ? Number(data.radiusScreenX) : Number(data.radius) * this.deps.ISO_X;
    const ry = Number.isFinite(Number(data.radiusScreenY)) ? Number(data.radiusScreenY) : Number(data.radius) * this.deps.ISO_Y;
    if (data.zoneKind === this.deps.ZONE_KIND.AURA) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#7bdcff";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 0.98, ry * 0.98, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    const fvfxArr = ((this.deps.w as any)._fireZoneVfx ?? []) as (any | null)[];
    const fvfx = fvfxArr[data.zoneIndex];
    if (fvfx) {
      this.deps.renderFireZoneVfx(ctx, fvfx, this.deps.toScreen, this.deps.getSpriteById, this.deps.ISO_X, this.deps.ISO_Y);
      return;
    }

    const pulse = 0.85 + 0.15 * Math.sin((this.deps.w.time ?? 0) * 7 + Number(data.zoneIndex) * 0.37);
    ctx.globalAlpha = 0.26 * pulse;
    ctx.fillStyle = "#ff3a2e";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawVfxClip(data: any): void {
    const i = Number(data.vfxIndex);
    const clip = this.deps.VFX_CLIPS[this.deps.w.vfxClipId[i]];
    const rawFrame = Math.floor(this.deps.w.vfxElapsed[i] * clip.fps);
    const frameIndex = clip.loop ? rawFrame % clip.spriteIds.length : Math.min(clip.spriteIds.length - 1, rawFrame);
    const sprite = this.deps.getSpriteById(clip.spriteIds[frameIndex]);
    if (!sprite.ready) return;
    const scale = this.deps.w.vfxRadius[i] > 0 ? this.deps.w.vfxRadius[i] / 32 : this.deps.w.vfxScale[i];
    const size = 64 * scale;
    const p = this.deps.toScreen(this.deps.w.vfxX[i], this.deps.w.vfxY[i]);
    const ctx = this.frameContext.ctx;
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite.img, p.x - size / 2, p.y - size / 2 + this.deps.w.vfxOffsetYPx[i], size, size);
  }

  private drawImageSprite(data: any): void {
    const image = data.image as CanvasImageSource | null;
    if (!image) return;
    const sx = Number.isFinite(Number(data.sx)) ? Number(data.sx) : 0;
    const sy = Number.isFinite(Number(data.sy)) ? Number(data.sy) : 0;
    const sw = Number.isFinite(Number(data.sw)) ? Number(data.sw) : (image as any).width ?? 0;
    const sh = Number.isFinite(Number(data.sh)) ? Number(data.sh) : (image as any).height ?? 0;
    const dx = Number(data.dx ?? 0);
    const dy = Number(data.dy ?? 0);
    const dw = Number(data.dw ?? 0);
    const dh = Number(data.dh ?? 0);
    if (!(sw > 0 && sh > 0 && dw > 0 && dh > 0)) return;
    const alpha = Number.isFinite(Number(data.alpha)) ? Number(data.alpha) : 1;
    const rotationRad = Number.isFinite(Number(data.rotationRad)) ? Number(data.rotationRad) : 0;
    const flipX = !!data.flipX;
    const ctx = this.frameContext.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    if (rotationRad || flipX) {
      ctx.translate(snapPx(dx + dw * 0.5), snapPx(dy + dh * 0.5));
      if (rotationRad) ctx.rotate(rotationRad);
      ctx.scale(flipX ? -1 : 1, 1);
      ctx.drawImage(image, sx, sy, sw, sh, snapPx(-dw * 0.5), snapPx(-dh * 0.5), dw, dh);
    } else {
      ctx.drawImage(image, sx, sy, sw, sh, snapPx(dx), snapPx(dy), dw, dh);
    }
    ctx.restore();
  }

  private drawPickup(data: any): void {
    const i = Number(data.pickupIndex);
    const kind = Number(data.pickupKind);
    const p = { x: Number(data.screenX), y: Number(data.screenY) };
    const ctx = this.frameContext.ctx;
    if (kind === 1) {
      const value = Math.max(1, Math.floor(this.deps.w.xValue?.[i] ?? 1));
      const dynamicRelightAlpha = this.deps.resolveDynamicSpriteRelightAlpha(p.x, p.y);
      const sprite = this.deps.getCurrencyFrame(value, this.deps.w.time ?? 0);
      if (sprite.ready) {
        const size = 16;
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite.img, p.x - size / 2, p.y - size / 2, size, size);
        if (dynamicRelightAlpha > 0 && this.deps.dynamicSpriteRelightFrame) {
          const litSprite = this.deps.getCurrencyFrameForDarknessPercent(
            value,
            this.deps.w.time ?? 0,
            this.deps.dynamicSpriteRelightFrame.targetDarknessBucket,
          );
          if (litSprite.ready) {
            ctx.save();
            ctx.globalAlpha = dynamicRelightAlpha;
            ctx.drawImage(litSprite.img, p.x - size / 2, p.y - size / 2, size, size);
            ctx.restore();
          }
        }
        return;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.deps.coinColorFromValue(value);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

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

  private drawEnemy(data: any): void {
    const i = Number(data.enemyIndex);
    const feet = data.feet as any;
    const baseColor = String(data.baseColor);
    const isBoss = !!data.isBoss;
    const ctx = this.frameContext.ctx;
    const faceDx = this.deps.w.eFaceX?.[i] ?? 0;
    const faceDy = this.deps.w.eFaceY?.[i] ?? -1;
    const moving = Math.hypot(this.deps.w.evx?.[i] ?? 0, this.deps.w.evy?.[i] ?? 0) > 1e-4;
    const isLootGoblin = this.deps.w.eType[i] === this.deps.ENEMY_TYPE.LOOT_GOBLIN;

    if (isLootGoblin) {
      const pulse =
        this.deps.LOOT_GOBLIN_GLOW_PULSE_MIN
        + this.deps.LOOT_GOBLIN_GLOW_PULSE_RANGE * (0.5 + 0.5 * Math.sin((this.deps.w.time ?? 0) * this.deps.LOOT_GOBLIN_GLOW_PULSE_SPEED + i * 0.37));
      const enemyR = Math.max(8, this.deps.w.eR[i] ?? 10);
      const outerRx = enemyR * this.deps.ISO_X * this.deps.LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT;
      const outerRy = enemyR * this.deps.ISO_Y * this.deps.LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT;
      const innerR = Math.max(1, enemyR * this.deps.LOOT_GOBLIN_GLOW_INNER_RADIUS_MULT);
      const glow = ctx.createRadialGradient(feet.screenX, feet.screenY - enemyR * 0.25, innerR, feet.screenX, feet.screenY, Math.max(outerRx, outerRy));
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

    const frame = this.deps.getEnemySpriteFrame({
      type: this.deps.w.eType[i],
      time: this.deps.w.time ?? 0,
      faceDx,
      faceDy,
      moving,
    });
    const dynamicRelightAlpha = this.deps.resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);
    if (frame) {
      const draw = this.resolveSpriteDraw(frame, (this.deps.w as any).eAnchorX01?.[i], (this.deps.w as any).eAnchorY01?.[i], feet.screenX, feet.screenY);
      ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, Math.round(draw.dx), Math.round(draw.dy), draw.dw, draw.dh);
      if (dynamicRelightAlpha > 0 && this.deps.dynamicSpriteRelightFrame) {
        const litFrame = this.deps.getEnemySpriteFrameForDarknessPercent({
          type: this.deps.w.eType[i],
          time: this.deps.w.time ?? 0,
          faceDx,
          faceDy,
          moving,
          darknessPercent: this.deps.dynamicSpriteRelightFrame.targetDarknessBucket,
        });
        if (litFrame) {
          ctx.save();
          ctx.globalAlpha = dynamicRelightAlpha;
          ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, Math.round(draw.dx), Math.round(draw.dy), draw.dw, draw.dh);
          ctx.restore();
        }
      }
      this.drawEntityAnchorDebug(feet.screenX, feet.screenY, draw.dx, draw.dy, draw.dw, draw.dh);
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.ellipse(feet.screenX, feet.screenY, (this.deps.w.eR[i] ?? 10) * this.deps.ISO_X, (this.deps.w.eR[i] ?? 10) * this.deps.ISO_Y, 0, 0, Math.PI * 2);
      ctx.fill();
      this.drawEntityAnchorDebug(feet.screenX, feet.screenY, feet.screenX - 8, feet.screenY - 8, 16, 16);
    }

    if (isBoss) {
      const pulse = 0.5 + 0.5 * Math.sin((this.deps.w.time ?? 0) * 2.5);
      ctx.globalAlpha = 0.18 + pulse * 0.12;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(feet.screenX, feet.screenY, (this.deps.w.eR[i] ?? 10) * (1.25 + pulse * 0.05) * this.deps.ISO_X, (this.deps.w.eR[i] ?? 10) * (1.25 + pulse * 0.05) * this.deps.ISO_Y, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(feet.screenX, feet.screenY, (this.deps.w.eR[i] ?? 10) * 1.55 * this.deps.ISO_X, (this.deps.w.eR[i] ?? 10) * 1.55 * this.deps.ISO_Y, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawNpc(data: any): void {
    const i = Number(data.npcIndex);
    const npc = this.deps.w.npcs[i];
    const feet = data.feet as any;
    const frame = this.deps.vendorNpcSpritesReady() ? this.deps.getVendorNpcSpriteFrame({ dir: npc.dirCurrent, time: this.deps.w.time ?? 0 }) : null;
    if (!frame) return;
    const dynamicRelightAlpha = this.deps.resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);
    const draw = this.resolveSpriteDraw(frame, (npc as any).anchorX01, (npc as any).anchorY01, feet.screenX, feet.screenY);
    const ctx = this.frameContext.ctx;
    ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, Math.round(draw.dx), Math.round(draw.dy), draw.dw, draw.dh);
    if (dynamicRelightAlpha > 0 && this.deps.dynamicSpriteRelightFrame) {
      const litFrame = this.deps.getVendorNpcSpriteFrameForDarknessPercent({
        dir: npc.dirCurrent,
        time: this.deps.w.time ?? 0,
        darknessPercent: this.deps.dynamicSpriteRelightFrame.targetDarknessBucket,
      });
      if (litFrame) {
        ctx.save();
        ctx.globalAlpha = dynamicRelightAlpha;
        ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, Math.round(draw.dx), Math.round(draw.dy), draw.dw, draw.dh);
        ctx.restore();
      }
    }
    this.drawEntityAnchorDebug(feet.screenX, feet.screenY, draw.dx, draw.dy, draw.dw, draw.dh);
  }

  private drawNeutralMob(data: any): void {
    const i = Number(data.neutralMobIndex);
    const mob = this.deps.w.neutralMobs[i];
    const feet = data.feet as any;
    const frameCount = mob.spriteFrames.length;
    if (frameCount <= 0) return;
    const frame = mob.spriteFrames[mob.anim.frameIndex % frameCount];
    if (!frame || frame.width <= 0 || frame.height <= 0) return;
    const dynamicRelightAlpha = this.deps.resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);
    const draw = this.resolveImageDraw(frame.width, frame.height, mob.render.scale, (mob.render as any).anchorX01, (mob.render as any).anchorY01, mob.render.anchorX, mob.render.anchorY, feet.screenX, feet.screenY);
    const ctx = this.frameContext.ctx;
    if (mob.render.flipX) {
      ctx.save();
      ctx.translate(snapPx(draw.dx + draw.dw), snapPx(draw.dy));
      ctx.scale(-1, 1);
      ctx.drawImage(frame, 0, 0, draw.dw, draw.dh);
      ctx.restore();
    } else {
      ctx.drawImage(frame, snapPx(draw.dx), snapPx(draw.dy), draw.dw, draw.dh);
    }
    if (dynamicRelightAlpha > 0 && this.deps.dynamicSpriteRelightFrame) {
      const litFrames = this.deps.getPigeonFramesForClipAndScreenDirForDarknessPercent(
        mob.anim.clip,
        mob.render.screenDir,
        this.deps.dynamicSpriteRelightFrame.targetDarknessBucket,
      );
      if (litFrames.length > 0) {
        const litFrame = litFrames[mob.anim.frameIndex % litFrames.length];
        if (litFrame) {
          ctx.save();
          ctx.globalAlpha = dynamicRelightAlpha;
          if (mob.render.flipX) {
            ctx.translate(snapPx(draw.dx + draw.dw), snapPx(draw.dy));
            ctx.scale(-1, 1);
            ctx.drawImage(litFrame, 0, 0, draw.dw, draw.dh);
          } else {
            ctx.drawImage(litFrame, snapPx(draw.dx), snapPx(draw.dy), draw.dw, draw.dh);
          }
          ctx.restore();
        }
      }
    }
    this.drawEntityAnchorDebug(feet.screenX, feet.screenY, draw.dx, draw.dy, draw.dw, draw.dh);

    if (this.deps.debug.neutralBirdAI.drawDebug) {
      const targetWx = (mob.behavior.targetTileX + 0.5) * this.deps.T;
      const targetWy = (mob.behavior.targetTileY + 0.5) * this.deps.T;
      const targetZ = this.deps.tileHAtWorld(targetWx, targetWy);
      const targetP = this.deps.toScreenAtZ(targetWx, targetWy, targetZ);
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
      const tx = snapPx(draw.dx);
      const ty = snapPx(draw.dy - 4);
      const pad = 2;
      let textWidth = 0;
      for (let li = 0; li < lines.length; li++) textWidth = Math.max(textWidth, ctx.measureText(lines[li]).width);
      const lineHeight = 11;
      const textHeight = lineHeight * lines.length;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(tx - pad, ty - textHeight - pad, textWidth + pad * 2, textHeight + pad * 2);
      ctx.fillStyle = "#8fffb0";
      for (let li = 0; li < lines.length; li++) {
        const y = ty - lineHeight * (lines.length - 1 - li);
        ctx.fillText(lines[li], tx, y);
      }
      ctx.strokeStyle = "#8fffb0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(targetP.x - 5, targetP.y);
      ctx.lineTo(targetP.x + 5, targetP.y);
      ctx.moveTo(targetP.x, targetP.y - 5);
      ctx.lineTo(targetP.x, targetP.y + 5);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawProjectileSpark(data: any): void {
    const i = Number(data.projectileIndex);
    const clip = this.deps.VFX_CLIPS[this.deps.VFX_CLIP_INDEX.LIGHTNING_PROJ];
    if (!clip) return;
    const elapsed = 3.0 - (this.deps.w.prTtl[i] ?? 0);
    const rawFrame = Math.floor(elapsed * clip.fps);
    const frameIdx = rawFrame % clip.spriteIds.length;
    const sprite = this.deps.getSpriteById(clip.spriteIds[frameIdx]);
    if (!sprite.ready) return;
    const delta = this.deps.worldDeltaToScreen(this.deps.w.prDirX[i] ?? 1, this.deps.w.prDirY[i] ?? 0);
    const angle = Math.atan2(delta.dy, delta.dx);
    const ctx = this.frameContext.ctx;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(snapPx(Number(data.screenX)), snapPx(Number(data.screenY) - Number(data.zLift)));
    ctx.rotate(angle);
    ctx.drawImage(sprite.img, -16, -16, 32, 32);
    ctx.restore();
  }

  private drawProjectile(data: any): void {
    const i = Number(data.projectileIndex);
    const screenX = Number(data.screenX);
    const screenY = Number(data.screenY) - Number(data.zLift);
    const ctx = this.frameContext.ctx;
    const projectileWorld = this.deps.getProjectileWorld(this.deps.w, i, this.deps.KENNEY_TILE_WORLD);
    const snap = this.deps.snapToNearestWalkableGround(projectileWorld.wx, projectileWorld.wy);
    const shadowScreen = this.deps.toScreen(snap.x, snap.y);
    const projectileShadowOffset = this.deps.resolveProjectileShadowFootOffset(this.deps.w.prjKind[i]);
    const lift = Math.max(0, Number(data.zLift) || 0);
    const t = Math.max(0, Math.min(1, 1 - lift / 70));
    const radius = this.deps.w.prR[i] ?? 4;
    ctx.save();
    ctx.globalAlpha = 0.18 * t;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(
      shadowScreen.x + projectileShadowOffset.x,
      shadowScreen.y + projectileShadowOffset.y,
      radius * this.deps.ISO_X * (0.95 + 0.15 * t),
      radius * this.deps.ISO_Y * (0.85 + 0.1 * t),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    const delta = this.deps.worldDeltaToScreen(this.deps.w.prDirX[i] ?? 1, this.deps.w.prDirY[i] ?? 0);
    const angle = Math.atan2(delta.dy, delta.dx);
    const sprite = this.deps.getProjectileSpriteByKind(this.deps.w.prjKind[i]);
    if (sprite?.ready && sprite.img && sprite.img.width > 0 && sprite.img.height > 0) {
      const areaMult = Math.max(0.6, Math.min(2.5, (this.deps.w.prR[i] ?? 4) / 4));
      const target = this.deps.PROJECTILE_BASE_DRAW_PX * areaMult * this.deps.getProjectileDrawScale(this.deps.w.prjKind[i]);
      const scale = target / Math.max(sprite.img.width, sprite.img.height);
      const drawWidth = sprite.img.width * scale;
      const drawHeight = sprite.img.height * scale;
      const followers = (this.deps.w as any).exhaustFollower as Record<number, { kind: string; targetEntity: number }> | undefined;
      const followerFrames = (this.deps.w as any).exhaustFollowerFrame as Record<number, HTMLImageElement | null> | undefined;
      if (followers && followerFrames) {
        for (const key of Object.keys(followers)) {
          const follower = followers[Number(key)];
          if (!follower || follower.kind !== "bazooka_exhaust" || follower.targetEntity !== i) continue;
          const frame = followerFrames[Number(key)];
          if (!frame || !frame.complete || frame.naturalWidth <= 0 || frame.naturalHeight <= 0) continue;
          const [anchorX, anchorY] = this.deps.bazookaExhaustAssets.spec.anchorExhaust;
          const ax = (anchorX + this.deps.BAZOOKA_EXHAUST_OFFSET.x) * scale;
          const ay = (anchorY + this.deps.BAZOOKA_EXHAUST_OFFSET.y) * scale;
          const exhaustScale = scale * 0.5;
          const frameWidth = frame.naturalWidth * exhaustScale;
          const frameHeight = frame.naturalHeight * exhaustScale;
          const exhaustAngle = angle + Math.PI * 0.5;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.95;
          ctx.translate(snapPx(screenX), snapPx(screenY));
          ctx.rotate(exhaustAngle);
          ctx.drawImage(frame, snapPx(ax - frameWidth * 0.5), snapPx(ay - frameHeight * 0.5), frameWidth, frameHeight);
          ctx.restore();
        }
      }
      ctx.save();
      ctx.translate(snapPx(screenX), snapPx(screenY));
      ctx.rotate(angle);
      ctx.drawImage(sprite.img, snapPx(-drawWidth * 0.5), snapPx(-drawHeight * 0.5), drawWidth, drawHeight);
      ctx.restore();
      return;
    }

    const src = this.deps.registry.projectileSourceFromKind(this.deps.w.prjKind[i]);
    ctx.fillStyle = src === "KNIFE"
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
    ctx.ellipse(screenX, screenY, (this.deps.w.prR[i] ?? 4) * this.deps.ISO_X, (this.deps.w.prR[i] ?? 4) * this.deps.ISO_Y, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayerBeam(data: any): void {
    const ctx = this.frameContext.ctx;
    const glow = Math.max(0, this.deps.w.playerBeamGlowIntensity || 0);
    const beamWidth = Math.max(1, this.deps.w.playerBeamWidthPx || 6);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(255, 90, 90, ${0.20 + 0.25 * glow})`;
    ctx.lineWidth = beamWidth * 2.6;
    ctx.beginPath();
    ctx.moveTo(data.start.x, data.start.y);
    ctx.lineTo(data.end.x, data.end.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 120, 120, ${0.40 + 0.35 * glow})`;
    ctx.lineWidth = beamWidth * 1.5;
    ctx.beginPath();
    ctx.moveTo(data.start.x, data.start.y);
    ctx.lineTo(data.end.x, data.end.y);
    ctx.stroke();
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -(this.deps.w.playerBeamUvOffset * 20);
    ctx.strokeStyle = "rgba(255, 220, 220, 0.95)";
    ctx.lineWidth = beamWidth * 0.7;
    ctx.beginPath();
    ctx.moveTo(data.start.x, data.start.y);
    ctx.lineTo(data.end.x, data.end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 170, 170, ${0.40 + 0.30 * glow})`;
    ctx.beginPath();
    ctx.arc(data.end.x, data.end.y, Math.max(2, beamWidth * 0.9), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(data: any): void {
    const feet = data.feet as any;
    const dir = ((this.deps.w as any)._plDir ?? "N") as string;
    const moving = !!((this.deps.w as any)._plMoving ?? false);
    const dynamicRelightAlpha = this.deps.resolveDynamicSpriteRelightAlpha(feet.screenX, feet.screenY);
    const frame = this.deps.playerSpritesReady() ? this.deps.getPlayerSpriteFrame({ dir, moving, time: this.deps.w.time ?? 0 }) : null;
    const ctx = this.frameContext.ctx;
    if (frame) {
      const draw = this.resolveSpriteDraw(frame, (this.deps.w as any)._plAnchorX01, (this.deps.w as any)._plAnchorY01, feet.screenX, feet.screenY);
      ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, Math.round(draw.dx), Math.round(draw.dy), draw.dw, draw.dh);
      if (dynamicRelightAlpha > 0 && this.deps.dynamicSpriteRelightFrame) {
        const litFrame = this.deps.getPlayerSpriteFrameForDarknessPercent({
          dir,
          moving,
          time: this.deps.w.time ?? 0,
          darknessPercent: this.deps.dynamicSpriteRelightFrame.targetDarknessBucket,
        });
        if (litFrame) {
          ctx.save();
          ctx.globalAlpha = dynamicRelightAlpha;
          ctx.drawImage(litFrame.img, litFrame.sx, litFrame.sy, litFrame.sw, litFrame.sh, Math.round(draw.dx), Math.round(draw.dy), draw.dw, draw.dh);
          ctx.restore();
        }
      }
      this.drawEntityAnchorDebug(feet.screenX, feet.screenY, draw.dx, draw.dy, draw.dw, draw.dh);
      return;
    }
    ctx.fillStyle = "#eaeaf2";
    ctx.beginPath();
    ctx.ellipse(feet.screenX, feet.screenY, this.deps.PLAYER_R * this.deps.ISO_X, this.deps.PLAYER_R * this.deps.ISO_Y, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawEntityAnchorDebug(feet.screenX, feet.screenY, feet.screenX - 8, feet.screenY - 8, 16, 16);
  }

  private drawRenderPiece(draw: any): void {
    const ctx = this.frameContext.ctx;
    const image = draw.img;
    if (!image || image.width <= 0 || image.height <= 0) return;
    const scale = draw.scale ?? 1;
    ctx.save();
    ctx.translate(snapPx(draw.dx), snapPx(draw.dy));
    ctx.scale(scale, scale);
    if (draw.flipX) {
      ctx.translate(draw.dw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(image, 0, 0, draw.dw, draw.dh);
    ctx.restore();
  }

  private drawTriangleMesh(data: any): void {
    const image = data.image;
    if (!image) return;
    const ctx = this.frameContext.ctx;
    for (let i = 0; i < data.triangles.length; i++) {
      const triangle = data.triangles[i];
      const [s0, s1, s2] = triangle.srcPoints;
      const [d0, d1, d2] = triangle.dstPoints;
      const alpha = Number.isFinite(Number(triangle.alpha)) ? Number(triangle.alpha) : 1;
      if (alpha < 1) {
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * alpha;
        drawTexturedTriangle(ctx, image, Number(data.sourceWidth), Number(data.sourceHeight), s0, s1, s2, d0, d1, d2);
        ctx.restore();
      } else {
        drawTexturedTriangle(ctx, image, Number(data.sourceWidth), Number(data.sourceHeight), s0, s1, s2, d0, d1, d2);
      }
    }
  }

  private drawDebugTriangleOverlay(data: any): void {
    const ctx = this.frameContext.ctx;
    for (let i = 0; i < data.triangleOverlay.length; i++) {
      const triangle = data.triangleOverlay[i];
      const [a, b, c] = triangle.points;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fillStyle = String(triangle.fillStyle ?? "rgba(255,120,40,0.28)");
      ctx.fill();
      ctx.strokeStyle = String(triangle.strokeStyle ?? "rgba(255,120,40,0.9)");
      ctx.lineWidth = Number(triangle.lineWidth ?? 1);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawFloatingText(): void {
    const ctx = this.frameContext.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = this.deps.w.floatTextX.length - 1; i >= 0; i--) {
      const ttl = this.deps.w.floatTextTtl[i];
      if (ttl <= 0) continue;
      const p = this.deps.toScreen(this.deps.w.floatTextX[i], this.deps.w.floatTextY[i]);
      const value = this.deps.w.floatTextValue[i];
      const color = this.deps.w.floatTextColor[i];
      const size = this.deps.w.floatTextSize[i] ?? (this.deps.w.floatTextIsCrit[i] ? 16 : 12);
      const isPlayer = this.deps.w.floatTextIsPlayer[i] ?? false;
      const progress = 1 - ttl / 0.8;
      const rise = progress * 0.35;
      const alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.font = `${size}px monospace`;
      ctx.fillText(isPlayer ? `-${value}` : `${value}`, p.x, p.y - rise);
    }
    ctx.restore();
  }

  private drawPlayerWedge(data: any): void {
    const cells = (data.cells ?? []) as Array<{ x: number; y: number; w: number; h: number }>;
    const ctx = this.frameContext.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 0, 0, 0.18)";
    for (let i = 0; i < cells.length; i++) {
      ctx.fillRect(cells[i].x, cells[i].y, cells[i].w, cells[i].h);
    }
    ctx.restore();
  }

  private drawEntityAnchorDebug(feetX: number, feetY: number, drawX: number, drawY: number, drawW: number, drawH: number): void {
    this.deps.executeDebugPass({
      phase: "entityAnchor",
      input: {
        ctx: this.frameContext.ctx,
        show: this.deps.SHOW_ENTITY_ANCHOR_OVERLAY,
        feetX,
        feetY,
        drawX,
        drawY,
        drawW,
        drawH,
      },
    });
  }

  private resolveSpriteDraw(frame: any, anchorXOverride: number | undefined, anchorYOverride: number | undefined, feetX: number, feetY: number): { dx: number; dy: number; dw: number; dh: number } {
    const drawWidth = frame.sw * frame.scale;
    const drawHeight = frame.sh * frame.scale;
    const frameAny = frame as any;
    const anchorX = this.deps.RENDER_ENTITY_ANCHORS
      ? this.deps.resolveAnchor01(anchorXOverride, frameAny.anchorX01 ?? frame.anchorX, this.deps.ENTITY_ANCHOR_X01_DEFAULT)
      : (frame.anchorX ?? this.deps.ENTITY_ANCHOR_X01_DEFAULT);
    const anchorY = this.deps.RENDER_ENTITY_ANCHORS
      ? this.deps.resolveAnchor01(anchorYOverride, frameAny.anchorY01 ?? frame.anchorY, this.deps.ENTITY_ANCHOR_Y01_DEFAULT)
      : (frame.anchorY ?? this.deps.ENTITY_ANCHOR_Y01_DEFAULT);
    return {
      dx: feetX - drawWidth * anchorX,
      dy: feetY - drawHeight * anchorY,
      dw: drawWidth,
      dh: drawHeight,
    };
  }

  private resolveImageDraw(
    imageWidth: number,
    imageHeight: number,
    scale: number,
    anchorXOverride: number | undefined,
    anchorYOverride: number | undefined,
    anchorXBase: number | undefined,
    anchorYBase: number | undefined,
    feetX: number,
    feetY: number,
  ): { dx: number; dy: number; dw: number; dh: number } {
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const anchorX = this.deps.RENDER_ENTITY_ANCHORS
      ? this.deps.resolveAnchor01(anchorXOverride, anchorXBase, this.deps.ENTITY_ANCHOR_X01_DEFAULT)
      : (anchorXBase ?? this.deps.ENTITY_ANCHOR_X01_DEFAULT);
    const anchorY = this.deps.RENDER_ENTITY_ANCHORS
      ? this.deps.resolveAnchor01(anchorYOverride, anchorYBase, this.deps.ENTITY_ANCHOR_Y01_DEFAULT)
      : (anchorYBase ?? this.deps.ENTITY_ANCHOR_Y01_DEFAULT);
    return {
      dx: feetX - drawWidth * anchorX,
      dy: feetY - drawHeight * anchorY,
      dw: drawWidth,
      dh: drawHeight,
    };
  }
}
