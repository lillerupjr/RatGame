import { ENEMIES, type EnemyId } from "../../../game/content/enemies";
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

type EnemySpriteDef = {
    skin: string;
    scale: number;
    anchorX: number;
    anchorY: number;
    frameW: number;
    frameH: number;
    runAnim?: string;
    source?: SpriteLoaderSource;
    frameCount?: number;
};

function getEnemySpriteDef(type: EnemyId): EnemySpriteDef | null {
    const sprite = ENEMIES[type]?.presentation?.sprite;
    if (!sprite) return null;
    return {
        skin: sprite.skin,
        scale: sprite.scale,
        anchorX: sprite.anchorX,
        anchorY: sprite.anchorY,
        frameW: sprite.frameW,
        frameH: sprite.frameH,
        runAnim: sprite.runAnim,
        frameCount: sprite.frameCount,
        source: sprite.packRoot ? { packRoot: sprite.packRoot } : undefined,
    };
}

function findEnemySpriteDefBySkin(skin: string): EnemySpriteDef | null {
    for (const key of Object.keys(ENEMIES)) {
        const def = getEnemySpriteDef(Number(key) as EnemyId);
        if (def?.skin === skin) return def;
    }
    return null;
}

export type EnemySpriteFrameMeta = {
    skin: string;
    w: number;
    h: number;
    scale: number;
    anchorX: number;
    anchorY: number;
};

export function getEnemySpriteFrameMeta(type: EnemyId): EnemySpriteFrameMeta | null {
    const def = getEnemySpriteDef(type);
    if (!def) return null;
    return {
        skin: def.skin,
        w: def.frameW,
        h: def.frameH,
        scale: def.scale,
        anchorX: def.anchorX,
        anchorY: def.anchorY,
    };
}

const paletteState = createPaletteSwapState(resolveActivePaletteVariantKey());
const packsByPalette = new Map<string, Map<string, SpritePack>>();
const preloadByPaletteSkin = new Map<string, Promise<void>>();
const ENEMY_DIR_KEYS = [
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
const preloadStatusByPaletteSkin = new Map<string, PreloadStatus>();
const preloadWarnedByPaletteSkinStatus = new Set<string>();
const preloadSkippedByPaletteSkinStatus = new Set<string>();

function resolvePaletteVariantKeyForDarknessPercent(
    darknessPercent?: SpriteDarknessPercent,
): string {
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
    for (const key of Object.keys(ENEMIES)) {
        const def = getEnemySpriteDef(Number(key) as EnemyId);
        if (def?.skin) skins.add(def.skin);
    }
    return Array.from(skins);
}

export function listEnemyDynamicAtlasSpriteIds(): string[] {
    const ids = new Set<string>();
    for (const key of Object.keys(ENEMIES)) {
        const def = getEnemySpriteDef(Number(key) as EnemyId);
        if (!def?.skin) continue;
        const packRoot = def.source?.packRoot ?? "entities/enemies";
        for (const dirKey of ENEMY_DIR_KEYS) {
            ids.add(`${packRoot}/${def.skin}/rotations/${dirKey}`);
        }
        if (!def.runAnim) continue;
        const frameCount = def.frameCount ?? 4;
        for (const dirKey of ENEMY_DIR_KEYS) {
            for (let i = 0; i < frameCount; i++) {
                ids.add(
                    `${packRoot}/${def.skin}/animations/${def.runAnim}/${dirKey}/frame_${String(i).padStart(3, "0")}`,
                );
            }
        }
    }
    return Array.from(ids).sort();
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

function markPaletteReadyIfComplete(paletteId: string, requiredSkins?: readonly string[]): void {
  const map = getPaletteMap(paletteId);
  const skins = resolveRequestedSkins(requiredSkins);
  const allLoaded = skins.every((skin) => map.has(skin));
  if (allLoaded) notePaletteReady(paletteState, paletteId);
}

export function enemySpritesReady(
    requiredSkins?: readonly string[],
    paletteVariantKey: string = resolveActivePaletteVariantKey(),
): boolean {
    const map = getPaletteMap(paletteVariantKey);
    const skins = resolveRequestedSkins(requiredSkins);
    if (skins.length === 0) return true;
    return skins.every((skin) => map.has(skin));
}

export function preloadEnemySprites(
    requiredSkins?: readonly string[],
    paletteVariantKey: string = resolvePaletteVariantKeyForDarknessPercent(),
) {
    notePaletteRequested(paletteState, paletteVariantKey);
    const map = getPaletteMap(paletteVariantKey);
    const skins = resolveRequestedSkins(requiredSkins);
    if (skins.length === 0) {
        notePaletteReady(paletteState, paletteVariantKey);
        return;
    }

    for (const skin of skins) {
        if (map.has(skin)) continue;
        const key = `${paletteVariantKey}:${skin}`;
        const existingStatus = preloadStatusByPaletteSkin.get(key);
        if (
            existingStatus === "PENDING"
            || existingStatus === "READY"
            || existingStatus === "UNSUPPORTED"
            || existingStatus === "FAILED_PERMANENT"
        ) {
            if (existingStatus === "UNSUPPORTED" || existingStatus === "FAILED_PERMANENT") {
                const skipKey = `${key}:${existingStatus}`;
                if (!preloadSkippedByPaletteSkinStatus.has(skipKey)) {
                    preloadSkippedByPaletteSkinStatus.add(skipKey);
                    console.debug("[enemySprites] Skipping non-retryable preload status", {
                        skin,
                        paletteVariantKey,
                        status: existingStatus,
                    });
                }
            }
            continue;
        }
        if (preloadByPaletteSkin.has(key)) continue;
        if (existingStatus === "FAILED_TRANSIENT") {
            console.debug("[enemySprites] Retrying transient preload failure", {
                skin,
                paletteVariantKey,
            });
        }
        preloadStatusByPaletteSkin.set(key, "PENDING");
        const def = findEnemySpriteDefBySkin(skin);
        const job = preloadSpritePack(skin, {
            source: def?.source,
            animKeys: def?.runAnim ? [def.runAnim] : undefined,
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
                const warnKey = `${key}:${status}`;
                if (!preloadWarnedByPaletteSkinStatus.has(warnKey)) {
                    preloadWarnedByPaletteSkinStatus.add(warnKey);
                    if (status === "FAILED_TRANSIENT") {
                        console.warn(`[enemySprites] Timed out preloading ${skin}; will retry`, err);
                    } else if (status === "FAILED_PERMANENT") {
                        console.warn(`[enemySprites] Failed to preload ${skin}; marked permanent`, err);
                    }
                }
            })
            .finally(() => {
                preloadByPaletteSkin.delete(key);
            });
        preloadByPaletteSkin.set(key, job);
    }
}

function preloadEnemySpritesForDarknessPercent(
    darknessPercent: SpriteDarknessPercent,
    requiredSkins?: readonly string[],
    requestedPaletteVariantKey: string = resolvePaletteVariantKeyForDarknessPercent(darknessPercent),
) {
    const paletteVariantKey = requestedPaletteVariantKey;
    notePaletteRequested(paletteState, paletteVariantKey);
    const map = getPaletteMap(paletteVariantKey);
    const skins = resolveRequestedSkins(requiredSkins);
    if (skins.length === 0) {
        notePaletteReady(paletteState, paletteVariantKey);
        return;
    }

    for (const skin of skins) {
        if (map.has(skin)) continue;
        const key = `${paletteVariantKey}:${skin}`;
        const existingStatus = preloadStatusByPaletteSkin.get(key);
        if (
            existingStatus === "PENDING"
            || existingStatus === "READY"
            || existingStatus === "UNSUPPORTED"
            || existingStatus === "FAILED_PERMANENT"
        ) continue;
        if (preloadByPaletteSkin.has(key)) continue;
        preloadStatusByPaletteSkin.set(key, "PENDING");
        const def = findEnemySpriteDefBySkin(skin);
        const job = preloadSpritePack(skin, {
            source: def?.source,
            animKeys: def?.runAnim ? [def.runAnim] : undefined,
            frameCount: def?.frameCount,
            darknessPercent,
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
                const warnKey = `${key}:${status}`;
                if (!preloadWarnedByPaletteSkinStatus.has(warnKey)) {
                    preloadWarnedByPaletteSkinStatus.add(warnKey);
                    if (status === "FAILED_TRANSIENT") {
                        console.warn(`[enemySprites] Timed out preloading ${skin}; will retry`, err);
                    } else if (status === "FAILED_PERMANENT") {
                        console.warn(`[enemySprites] Failed to preload ${skin}; marked permanent`, err);
                    }
                }
            })
            .finally(() => {
                preloadByPaletteSkin.delete(key);
            });
        preloadByPaletteSkin.set(key, job);
    }
}

export function getEnemySpriteFrame(args: {
    type: EnemyId;
    time: number;
    faceDx: number;
    faceDy: number;
    moving: boolean;
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
    const def = getEnemySpriteDef(args.type);
    if (!def) return null;
    const paletteVariantKey = resolveActivePaletteVariantKey();
    notePaletteRequested(paletteState, paletteVariantKey);
    preloadEnemySprites([def.skin], paletteVariantKey);

    const pack = getPaletteMap(paletteVariantKey).get(def.skin)
        ?? getPaletteMap(paletteState.lastReadyPaletteId).get(def.skin);
    if (!pack) return null;

    const dir = dir8FromVector(args.faceDx, args.faceDy);
    const anim = args.moving ? def.runAnim : undefined;
    const img = getSpriteFrame(pack, {
        dir,
        anim,
        t: args.time,
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

export function getEnemySpriteFrameForDarknessPercent(args: {
    type: EnemyId;
    time: number;
    faceDx: number;
    faceDy: number;
    moving: boolean;
    darknessPercent: SpriteDarknessPercent;
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
    const def = getEnemySpriteDef(args.type);
    if (!def) return null;
    const paletteVariantKey = resolvePaletteVariantKeyForDarknessPercent(args.darknessPercent);
    notePaletteRequested(paletteState, paletteVariantKey);
    const statusKey = `${paletteVariantKey}:${def.skin}`;
    const currentStatus = preloadStatusByPaletteSkin.get(statusKey);
    if (currentStatus !== "UNSUPPORTED" && currentStatus !== "FAILED_PERMANENT") {
        preloadEnemySpritesForDarknessPercent(args.darknessPercent, [def.skin], paletteVariantKey);
    }

    const pack = getPaletteMap(paletteVariantKey).get(def.skin);
    if (!pack) return null;

    const dir = dir8FromVector(args.faceDx, args.faceDy);
    const anim = args.moving ? def.runAnim : undefined;
    const img = getSpriteFrame(pack, {
        dir,
        anim,
        t: args.time,
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
