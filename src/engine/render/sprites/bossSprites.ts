import { bossRegistry } from "../../../game/bosses/bossRegistry";
import type { BossId } from "../../../game/bosses/bossTypes";
import {
  buildPaletteVariantKey,
  resolveActivePaletteId,
  resolveActivePaletteSwapWeightPercents,
  resolveActivePaletteVariantKey,
} from "../../../game/render/activePalette";
import { dir8FromVector } from "./dir8";
import {
  createPaletteSwapState,
  notePaletteReady,
  notePaletteRequested,
} from "./paletteSwapState";
import {
  getSpriteFrame,
  isSpritePreloadError,
  preloadSpritePack,
  type SpriteDarknessPercent,
  type SpriteLoaderSource,
  type SpritePack,
} from "./spriteLoader";

type BossSpriteDef = {
  skin: string;
  scale: number;
  anchorX: number;
  anchorY: number;
  frameW: number;
  frameH: number;
  runAnim?: string;
  castAnim?: string;
  source?: SpriteLoaderSource;
  frameCount?: number;
};

const DIR_KEYS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

type PreloadStatus = "READY" | "PENDING" | "UNSUPPORTED" | "FAILED_TRANSIENT" | "FAILED_PERMANENT";

const paletteState = createPaletteSwapState(resolveActivePaletteVariantKey());
const packsByPalette = new Map<string, Map<string, SpritePack>>();
const preloadByPaletteSkin = new Map<string, Promise<void>>();
const preloadStatusByPaletteSkin = new Map<string, PreloadStatus>();

function getBossSpriteDef(bossId: BossId): BossSpriteDef | null {
  const sprite = bossRegistry.boss(bossId).presentation?.sprite;
  if (!sprite) return null;
  return {
    skin: sprite.skin,
    scale: sprite.scale,
    anchorX: sprite.anchorX,
    anchorY: sprite.anchorY,
    frameW: sprite.frameW,
    frameH: sprite.frameH,
    runAnim: sprite.runAnim,
    castAnim: sprite.castAnim,
    frameCount: sprite.frameCount,
    source: sprite.packRoot ? { packRoot: sprite.packRoot } : undefined,
  };
}

function findBossSpriteDefBySkin(skin: string): BossSpriteDef | null {
  const bossIds = bossRegistry.bossIds();
  for (let i = 0; i < bossIds.length; i++) {
    const def = getBossSpriteDef(bossIds[i]);
    if (def?.skin === skin) return def;
  }
  return null;
}

function resolvePaletteVariantKeyForDarknessPercent(darknessPercent?: SpriteDarknessPercent): string {
  if (darknessPercent == null) return resolveActivePaletteVariantKey();
  const paletteId = resolveActivePaletteId();
  const active = resolveActivePaletteSwapWeightPercents();
  return buildPaletteVariantKey(paletteId, {
    sWeightPercent: active.sWeightPercent,
    darknessPercent,
  });
}

function getPaletteMap(paletteId: string): Map<string, SpritePack> {
  const existing = packsByPalette.get(paletteId);
  if (existing) return existing;
  const created = new Map<string, SpritePack>();
  packsByPalette.set(paletteId, created);
  return created;
}

function getRequiredSkins(): string[] {
  const skins = new Set<string>();
  const bossIds = bossRegistry.bossIds();
  for (let i = 0; i < bossIds.length; i++) {
    const def = getBossSpriteDef(bossIds[i]);
    if (def?.skin) skins.add(def.skin);
  }
  return Array.from(skins);
}

function resolveRequestedSkins(requiredSkins?: readonly string[]): string[] {
  if (requiredSkins === undefined) return getRequiredSkins();
  const known = new Set(getRequiredSkins());
  const out: string[] = [];
  for (let i = 0; i < requiredSkins.length; i++) {
    const skin = requiredSkins[i];
    if (!known.has(skin) || out.includes(skin)) continue;
    out.push(skin);
  }
  return out;
}

function markPaletteReadyIfComplete(paletteVariantKey: string, requiredSkins?: readonly string[]): void {
  const map = getPaletteMap(paletteVariantKey);
  const skins = resolveRequestedSkins(requiredSkins);
  const allLoaded = skins.every((skin) => map.has(skin));
  if (allLoaded) notePaletteReady(paletteState, paletteVariantKey);
}

export function listBossDynamicAtlasSpriteIds(): string[] {
  const ids = new Set<string>();
  const bossIds = bossRegistry.bossIds();
  for (let i = 0; i < bossIds.length; i++) {
    const def = getBossSpriteDef(bossIds[i]);
    if (!def?.skin) continue;
    const packRoot = def.source?.packRoot ?? "entities";
    for (let j = 0; j < DIR_KEYS.length; j++) {
      ids.add(`${packRoot}/${def.skin}/rotations/${DIR_KEYS[j]}`);
    }
    if (!def.runAnim) continue;
    const animKeys = [def.runAnim, def.castAnim].filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index);
    const frameCount = def.frameCount ?? 1;
    for (let animIndex = 0; animIndex < animKeys.length; animIndex++) {
      const animKey = animKeys[animIndex];
      for (let j = 0; j < DIR_KEYS.length; j++) {
        for (let frame = 0; frame < frameCount; frame++) {
          ids.add(`${packRoot}/${def.skin}/animations/${animKey}/${DIR_KEYS[j]}/frame_${String(frame).padStart(3, "0")}`);
        }
      }
    }
  }
  return Array.from(ids).sort();
}

export function bossSpritesReady(
  requiredSkins?: readonly string[],
  paletteVariantKey: string = resolveActivePaletteVariantKey(),
): boolean {
  const map = getPaletteMap(paletteVariantKey);
  const skins = resolveRequestedSkins(requiredSkins);
  if (skins.length <= 0) return true;
  return skins.every((skin) => map.has(skin));
}

export function preloadBossSprites(
  requiredSkins?: readonly string[],
  paletteVariantKey: string = resolvePaletteVariantKeyForDarknessPercent(),
): void {
  notePaletteRequested(paletteState, paletteVariantKey);
  const map = getPaletteMap(paletteVariantKey);
  const skins = resolveRequestedSkins(requiredSkins);
  if (skins.length <= 0) {
    notePaletteReady(paletteState, paletteVariantKey);
    return;
  }
  for (let i = 0; i < skins.length; i++) {
    const skin = skins[i];
    if (map.has(skin)) continue;
    const key = `${paletteVariantKey}:${skin}`;
    const existingStatus = preloadStatusByPaletteSkin.get(key);
    if (
      existingStatus === "PENDING"
      || existingStatus === "READY"
      || existingStatus === "UNSUPPORTED"
      || existingStatus === "FAILED_PERMANENT"
    ) {
      continue;
    }
    if (preloadByPaletteSkin.has(key)) continue;
    preloadStatusByPaletteSkin.set(key, "PENDING");
    const def = findBossSpriteDefBySkin(skin);
    const job = preloadSpritePack(skin, {
      source: def?.source,
      animKeys: [def?.runAnim, def?.castAnim].filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index),
      frameCount: def?.frameCount,
      paletteVariantKey,
    })
      .then((pack) => {
        map.set(skin, pack);
        preloadStatusByPaletteSkin.set(key, "READY");
        markPaletteReadyIfComplete(paletteVariantKey, skins);
      })
      .catch((err) => {
        const status: PreloadStatus =
          isSpritePreloadError(err) && err.kind === "TIMED_OUT"
            ? "FAILED_TRANSIENT"
            : isSpritePreloadError(err) && err.kind === "UNSUPPORTED"
              ? "UNSUPPORTED"
              : "FAILED_PERMANENT";
        preloadStatusByPaletteSkin.set(key, status);
      })
      .finally(() => {
        preloadByPaletteSkin.delete(key);
      });
    preloadByPaletteSkin.set(key, job);
  }
}

export function getBossSpriteFrame(args: {
  bossId: BossId;
  time: number;
  faceDx: number;
  faceDy: number;
  moving: boolean;
  requestedAnimation?: {
    clip: string;
    loop: boolean;
    startedAtSec: number;
    durationSec?: number;
  } | null;
}):
  | {
      img: HTMLImageElement;
      sx: number;
      sy: number;
      sw: number;
      sh: number;
      path: string;
      w: number;
      h: number;
      scale: number;
      anchorX: number;
      anchorY: number;
    }
  | null {
  const def = getBossSpriteDef(args.bossId);
  if (!def) return null;
  const paletteVariantKey = resolveActivePaletteVariantKey();
  notePaletteRequested(paletteState, paletteVariantKey);
  preloadBossSprites([def.skin], paletteVariantKey);
  const pack = getPaletteMap(paletteVariantKey).get(def.skin)
    ?? getPaletteMap(paletteState.lastReadyPaletteId).get(def.skin);
  if (!pack) return null;
  const dir = dir8FromVector(args.faceDx, args.faceDy);
  const requestedAnimation = args.requestedAnimation;
  const anim = requestedAnimation?.clip ?? (args.moving ? def.runAnim : undefined);
  const animDurationSec = Math.max(0.0001, requestedAnimation?.durationSec ?? 0);
  const animTimeSec = requestedAnimation
    ? Math.max(0, args.time - requestedAnimation.startedAtSec)
    : args.time;
  const animFps = requestedAnimation && animDurationSec > 0
    ? Math.max(0.001, (def.frameCount ?? pack.frameCount ?? 1) / animDurationSec)
    : undefined;
  const img = getSpriteFrame(pack, {
    dir,
    anim,
    t: animTimeSec,
    fps: animFps,
    loop: requestedAnimation?.loop,
    useRotationIfNoAnim: true,
  });
  return {
    img,
    sx: 0,
    sy: 0,
    sw: pack.size.w,
    sh: pack.size.h,
    path: def.skin,
    w: pack.size.w,
    h: pack.size.h,
    scale: def.scale,
    anchorX: def.anchorX,
    anchorY: def.anchorY,
  };
}
