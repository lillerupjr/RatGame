import type { CollectionContext } from "../contracts/collectionContext";
import { enqueueSliceCommand } from "../frame/renderFrameBuilder";
import {
  countRenderDynamicAtlasBypass,
  countRenderDynamicAtlasFallback,
  countRenderDynamicAtlasHit,
  countRenderDynamicAtlasMiss,
  countRenderDynamicAtlasRequest,
} from "../renderPerfCounters";

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
    getDynamicAtlasFrameForImage,
  } = input as any;

  const resolveDynamicAtlasImage = (
    image: CanvasImageSource,
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
      sw: atlasFrame?.sw ?? Number((image as { width?: number }).width ?? 0),
      sh: atlasFrame?.sh ?? Number((image as { height?: number }).height ?? 0),
    };
  };

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

      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: {
          zoneIndex: i,
          zoneKind: w.zKind[i],
          radius: w.zR[i],
          worldX: zx,
          worldY: zy,
          screenX: toScreen(zx, zy).x,
          screenY: toScreen(zx, zy).y,
          radiusScreenX: w.zR[i] * ISO_X,
          radiusScreenY: w.zR[i] * ISO_Y,
        },
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
      const explicitScale = Number.isFinite(w.vfxScale[i]) && w.vfxScale[i] > 0 ? w.vfxScale[i] : 0;
      if (sprite?.ready && sprite.img) {
        if (clip?.projection === "ground_decal") {
          const scale = explicitScale || (w.vfxRadius[i] > 0 ? w.vfxRadius[i] / 32 : 1);
          enqueueSliceCommand(frameBuilder, renderKey, {
            semanticFamily: "worldPrimitive",
            finalForm: "primitive",
            payload: {
              groundVfx: {
                image: sprite.img,
                tx: vtx,
                ty: vty,
                zBase: vZ,
                scale,
                vfxIndex: i,
              },
            },
          });
          continue;
        }
        const atlas = resolveDynamicAtlasImage(sprite.img);
        const scale = explicitScale || (w.vfxRadius[i] > 0 ? w.vfxRadius[i] / 32 : 1);
        const size = 64 * scale;
        const p = toScreen(vx, vy);
        enqueueSliceCommand(frameBuilder, renderKey, {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: {
            image: atlas.image,
            sx: atlas.sx,
            sy: atlas.sy,
            sw: atlas.sw,
            sh: atlas.sh,
            dx: p.x - size * 0.5,
            dy: p.y - size * 0.5 + w.vfxOffsetYPx[i],
            dw: size,
            dh: size,
            alpha: 1,
            vfxIndex: i,
          },
        });
        continue;
      }

      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          vfxIndex: i,
        },
      });
      countRenderDynamicAtlasBypass();
    }
  }

  // ----------------------------
  // Collect BOSS CAST WORLD EFFECTS into slices
  // ----------------------------
  {
    const encounters = Array.isArray(w.bossRuntime?.encounters) ? w.bossRuntime.encounters : [];
    for (let encounterIndex = 0; encounterIndex < encounters.length; encounterIndex++) {
      const cast = encounters[encounterIndex]?.activeCast;
      const effects = Array.isArray(cast?.worldEffects) ? cast.worldEffects : [];
      for (let effectIndex = 0; effectIndex < effects.length; effectIndex++) {
        const effect = effects[effectIndex];
        const projectionMode = effect.projectionMode ?? "flat_quad";
        const effectTx = Number.isFinite(Number(effect.tileTx)) ? Number(effect.tileTx) : Math.floor(effect.worldX / T);
        const effectTy = Number.isFinite(Number(effect.tileTy)) ? Number(effect.tileTy) : Math.floor(effect.worldY / T);
        const tx = effectTx;
        const ty = effectTy;
        if (!isTileInRenderRadius(tx, ty)) continue;
        const zBase = tileHAtWorld(effect.worldX, effect.worldY);
        const renderKey: RenderKey = {
          slice: tx + ty,
          within: tx,
          baseZ: zBase,
          kindOrder: KindOrder.VFX,
          stableId: 230000 + encounterIndex * 64 + effectIndex,
        };
        const sprite = getSpriteById(effect.spriteId);
        if (!sprite?.ready || !sprite.img) continue;
        if (projectionMode === "ground_iso") {
          enqueueSliceCommand(frameBuilder, renderKey, {
            semanticFamily: "worldPrimitive",
            finalForm: "primitive",
            payload: {
              groundVfx: {
                image: sprite.img,
                tx,
                ty,
                zBase,
                scale: Math.max(0.1, effect.baseScale),
                bossWorldEffectId: effect.id,
              },
            },
          });
          continue;
        }
        const atlas = resolveDynamicAtlasImage(sprite.img);
        const pulse = effect.pulse;
        const pulseRange = pulse ? Math.max(0, pulse.maxScale - pulse.minScale) : 0;
        const cycleSec = pulse ? Math.max(0.05, pulse.cycleSec) : 1;
        const pulsePhase = pulse ? ((w.timeSec ?? w.time ?? 0) % cycleSec) / cycleSec : 0;
        const pulseScale = pulse
          ? pulse.minScale + pulseRange * (0.5 + 0.5 * Math.sin(pulsePhase * Math.PI * 2))
          : 1;
        const scale = Math.max(0.1, effect.baseScale * pulseScale);
        const size = 64 * scale;
        const p = toScreen(effect.worldX, effect.worldY);
        enqueueSliceCommand(frameBuilder, renderKey, {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: {
            image: atlas.image,
            sx: atlas.sx,
            sy: atlas.sy,
            sw: atlas.sw,
            sh: atlas.sh,
            dx: p.x - size * 0.5,
            dy: p.y - size * 0.5 + Number(effect.zOffsetPx ?? 0),
            dw: size,
            dh: size,
            alpha: Number.isFinite(Number(effect.alpha)) ? Number(effect.alpha) : 1,
          },
        });
      }
    }
  }

  // ----------------------------
}
