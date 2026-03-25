import type { CollectionContext } from "../contracts/collectionContext";
import { enqueueSliceCommand } from "../frame/renderFrameBuilder";

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
    frameBuilder,
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

      enqueueSliceCommand(frameBuilder, renderKey, "primitive", {
        variant: "zoneEffect",
        zoneIndex: i,
        zoneKind: w.zKind[i],
        radius: w.zR[i],
        worldX: zx,
        worldY: zy,
        screenX: toScreen(zx, zy).x,
        screenY: toScreen(zx, zy).y,
        radiusScreenX: w.zR[i] * ISO_X,
        radiusScreenY: w.zR[i] * ISO_Y,
      });
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

      const clip = VFX_CLIPS[w.vfxClipId[i]];
      const rawFrame = clip ? Math.floor(w.vfxElapsed[i] * clip.fps) : 0;
      const frameIndex = clip
        ? (clip.loop ? rawFrame % clip.spriteIds.length : Math.min(clip.spriteIds.length - 1, rawFrame))
        : -1;
      const spriteId = clip && frameIndex >= 0 ? clip.spriteIds[frameIndex] : null;
      const sprite = spriteId ? getSpriteById(spriteId) : null;
      if (sprite?.ready && sprite.img) {
        const scale = w.vfxRadius[i] > 0 ? w.vfxRadius[i] / 32 : w.vfxScale[i];
        const size = 64 * scale;
        const p = toScreen(vx, vy);
        enqueueSliceCommand(frameBuilder, renderKey, "sprite", {
          variant: "imageSprite",
          image: sprite.img,
          dx: p.x - size * 0.5,
          dy: p.y - size * 0.5 + w.vfxOffsetYPx[i],
          dw: size,
          dh: size,
          alpha: 1,
        });
        continue;
      }

      enqueueSliceCommand(frameBuilder, renderKey, "sprite", {
        variant: "vfxClip",
        vfxIndex: i,
      });
    }
  }

  // ----------------------------
}
