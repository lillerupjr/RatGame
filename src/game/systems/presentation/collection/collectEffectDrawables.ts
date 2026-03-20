import type { CollectionContext } from "../contracts/collectionContext";

type RenderKey = any;

export function collectEffectDrawables(input: CollectionContext): void {
  const {
    w,
    T,
    ZONE_KIND,
    getZoneWorld,
    KENNEY_TILE_WORLD,
    snapToNearestWalkableGround,
    isTileInRenderRadius,
    KindOrder,
    toScreen,
    ISO_X,
    ISO_Y,
    renderFireZoneVfx,
    getSpriteById,
    addToSlice,
    VFX_CLIPS,
    tileHAtWorld,
    ctx,
  } = input as any;

  // Collect ZONES into slices
  // ----------------------------
  {
    for (let i = 0; i < w.zAlive.length; i++) {
      if (!w.zAlive[i]) continue;

      const zp0 = getZoneWorld(w, i, KENNEY_TILE_WORLD);
      const zx0 = zp0.wx;
      const zy0 = zp0.wy;

      const sn = snapToNearestWalkableGround(zx0, zy0);
      const zx = sn.x;
      const zy = sn.y;
      const groundZ = sn.z;

      // Determine zone's anchor tile
      const ztx = Math.floor(zx / T);
      const zty = Math.floor(zy / T);
      if (!isTileInRenderRadius(ztx, zty)) continue;
      const zSlice = ztx + zty;

      const renderKey: RenderKey = {
        slice: zSlice,
        within: ztx,
        baseZ: groundZ,
        kindOrder: KindOrder.ENTITY,
        stableId: 100000 + i,
      };

      const kind = w.zKind[i];
      const r = w.zR[i];

      const drawClosure = () => {
        const p = toScreen(zx, zy);
        const rx = r * ISO_X;
        const ry = r * ISO_Y;

        if (kind === ZONE_KIND.AURA) {
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
        } else if (kind === ZONE_KIND.FIRE) {
          const fvfxArr = ((w as any)._fireZoneVfx ?? []) as (any | null)[];
          const fvfx = fvfxArr[i];
          if (fvfx) {
            renderFireZoneVfx(ctx, fvfx, toScreen, getSpriteById, ISO_X, ISO_Y);
          } else {
            // Fallback: flat rendering if VFX data missing
            const pulse = 0.85 + 0.15 * Math.sin((w.time ?? 0) * 7 + i * 0.37);
            ctx.globalAlpha = 0.26 * pulse;
            ctx.fillStyle = "#ff3a2e";
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      };

      addToSlice(zSlice, renderKey, drawClosure);
    }
  }

  // ----------------------------
  // Collect VFX into slices
  // ----------------------------
  {
    for (let i = 0; i < w.vfxAlive.length; i++) {
      if (!w.vfxAlive[i]) continue;
      const vx = w.vfxX[i];
      const vy = w.vfxY[i];

      const vtx = Math.floor(vx / T);
      const vty = Math.floor(vy / T);
      if (!isTileInRenderRadius(vtx, vty)) continue;
      const vZ = tileHAtWorld(vx, vy);

      const renderKey: RenderKey = {
        slice: vtx + vty,
        within: vtx,
        baseZ: vZ,
        kindOrder: KindOrder.VFX,
        stableId: 200000 + i,
      };

      const drawClosure = () => {
        const clip = VFX_CLIPS[w.vfxClipId[i]];
        const rawFrame = Math.floor(w.vfxElapsed[i] * clip.fps);
        const frameIndex = clip.loop
          ? rawFrame % clip.spriteIds.length
          : Math.min(clip.spriteIds.length - 1, rawFrame);
        const sprite = getSpriteById(clip.spriteIds[frameIndex]);
        if (!sprite.ready) return;
        const scale = w.vfxRadius[i] > 0 ? w.vfxRadius[i] / 32 : w.vfxScale[i];
        const size = 64 * scale;
        const p = toScreen(w.vfxX[i], w.vfxY[i]);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite.img, p.x - size / 2, p.y - size / 2 + w.vfxOffsetYPx[i], size, size);
      };

      addToSlice(vtx + vty, renderKey, drawClosure);
    }
  }

  // ----------------------------
}
