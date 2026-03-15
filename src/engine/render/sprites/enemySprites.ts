import { ENEMY_TYPE, type EnemyType } from "../../../game/content/enemies";
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

const ENEMY_SPRITES: Partial<Record<EnemyType, EnemySpriteDef>> = {
    [ENEMY_TYPE.CHASER]: {
        skin: "rat1",
        scale: 1.5,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 32,
        frameH: 32,
        runAnim: "running-4-frames",
    },
    [ENEMY_TYPE.RUNNER]: {
        skin: "rat2",
        scale: 1.5,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 92,
        frameH: 92,
        runAnim: "walk-4-frames",
    },
    [ENEMY_TYPE.BRUISER]: {
        skin: "rat4",
        scale: 2,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 92,
        frameH: 92,
        runAnim: "walk-4-frames",

    },
    [ENEMY_TYPE.MINOTAUR]: {
        skin: "minotaur",
        scale: 2,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 128,
        frameH: 128,
        runAnim: "walk-8-frames",
        frameCount: 8,
    },
    [ENEMY_TYPE.ABOMINATION]: {
        skin: "abomination",
        scale: 2,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 96,
        frameH: 96,
        runAnim: "walk-6-frames",
        frameCount: 6,
    },
    [ENEMY_TYPE.RATCHEMIST]: {
        skin: "ratchemist",
        scale: 1.5,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 92,
        frameH: 92,
        runAnim: "walk",
        frameCount: 6,
    },
    [ENEMY_TYPE.LOOT_GOBLIN]: {
        skin: "lootGoblin",
        scale: 1.5,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 92,
        frameH: 92,
        runAnim: "walk",
        frameCount: 6,
    },
    [ENEMY_TYPE.BOSS]: {
        skin: "infested",
        scale: 2,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 92,
        frameH: 92,
        runAnim: "walk",
    },
};

export type EnemySpriteFrameMeta = {
    skin: string;
    w: number;
    h: number;
    scale: number;
    anchorX: number;
    anchorY: number;
};

export function getEnemySpriteFrameMeta(type: EnemyType): EnemySpriteFrameMeta | null {
    const def = ENEMY_SPRITES[type];
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
type PreloadStatus = "READY" | "PENDING" | "UNSUPPORTED" | "FAILED";
const preloadStatusByPaletteSkin = new Map<string, PreloadStatus>();
const preloadWarnedByPaletteSkin = new Set<string>();

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
    for (const def of Object.values(ENEMY_SPRITES)) {
        if (def?.skin) skins.add(def.skin);
    }
    return Array.from(skins);
}

function markPaletteReadyIfComplete(paletteId: string): void {
  const map = getPaletteMap(paletteId);
  const allLoaded = getRequiredSkins().every((skin) => map.has(skin));
  if (allLoaded) notePaletteReady(paletteState, paletteId);
}

export function enemySpritesReady(): boolean {
    const paletteVariantKey = resolveActivePaletteVariantKey();
    const map = getPaletteMap(paletteVariantKey);
    return getRequiredSkins().every((skin) => map.has(skin));
}

export function preloadEnemySprites() {
    const paletteVariantKey = resolvePaletteVariantKeyForDarknessPercent();
    notePaletteRequested(paletteState, paletteVariantKey);
    const map = getPaletteMap(paletteVariantKey);
    const skins = getRequiredSkins();

    for (const skin of skins) {
        if (map.has(skin)) continue;
        const key = `${paletteVariantKey}:${skin}`;
        const existingStatus = preloadStatusByPaletteSkin.get(key);
        if (existingStatus === "PENDING" || existingStatus === "READY" || existingStatus === "FAILED") continue;
        if (preloadByPaletteSkin.has(key)) continue;
        preloadStatusByPaletteSkin.set(key, "PENDING");
        const def = Object.values(ENEMY_SPRITES).find((entry) => entry?.skin === skin);
        const job = preloadSpritePack(skin, {
            source: def?.source,
            animKeys: def?.runAnim ? [def.runAnim] : undefined,
            frameCount: def?.frameCount,
        })
            .then((pack) => {
                map.set(skin, pack);
                preloadStatusByPaletteSkin.set(key, "READY");
                markPaletteReadyIfComplete(paletteVariantKey);
            })
            .catch((err) => {
                preloadStatusByPaletteSkin.set(key, "FAILED");
                if (!preloadWarnedByPaletteSkin.has(key)) {
                    preloadWarnedByPaletteSkin.add(key);
                    console.warn(`[enemySprites] Failed to preload ${skin}`, err);
                }
            })
            .finally(() => {
                preloadByPaletteSkin.delete(key);
            });
        preloadByPaletteSkin.set(key, job);
    }
}

function preloadEnemySpritesForDarknessPercent(darknessPercent: SpriteDarknessPercent) {
    const paletteVariantKey = resolvePaletteVariantKeyForDarknessPercent(darknessPercent);
    notePaletteRequested(paletteState, paletteVariantKey);
    const map = getPaletteMap(paletteVariantKey);
    const skins = getRequiredSkins();

    for (const skin of skins) {
        if (map.has(skin)) continue;
        const key = `${paletteVariantKey}:${skin}`;
        const existingStatus = preloadStatusByPaletteSkin.get(key);
        if (existingStatus === "PENDING" || existingStatus === "READY" || existingStatus === "UNSUPPORTED" || existingStatus === "FAILED") continue;
        if (preloadByPaletteSkin.has(key)) continue;
        preloadStatusByPaletteSkin.set(key, "PENDING");
        const def = Object.values(ENEMY_SPRITES).find((entry) => entry?.skin === skin);
        const job = preloadSpritePack(skin, {
            source: def?.source,
            animKeys: def?.runAnim ? [def.runAnim] : undefined,
            frameCount: def?.frameCount,
            darknessPercent,
        })
            .then((pack) => {
                map.set(skin, pack);
                preloadStatusByPaletteSkin.set(key, "READY");
                markPaletteReadyIfComplete(paletteVariantKey);
            })
            .catch((err) => {
                const status: PreloadStatus = isSpritePreloadError(err) && err.kind === "UNSUPPORTED"
                    ? "UNSUPPORTED"
                    : "FAILED";
                preloadStatusByPaletteSkin.set(key, status);
                if (!preloadWarnedByPaletteSkin.has(key)) {
                    preloadWarnedByPaletteSkin.add(key);
                    if (status === "FAILED") {
                        console.warn(`[enemySprites] Failed to preload ${skin}`, err);
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
    type: EnemyType;
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
    const def = ENEMY_SPRITES[args.type];
    if (!def) return null;
    const paletteVariantKey = resolveActivePaletteVariantKey();
    notePaletteRequested(paletteState, paletteVariantKey);
    preloadEnemySprites();

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
    type: EnemyType;
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
    const def = ENEMY_SPRITES[args.type];
    if (!def) return null;
    const paletteVariantKey = resolvePaletteVariantKeyForDarknessPercent(args.darknessPercent);
    notePaletteRequested(paletteState, paletteVariantKey);
    const statusKey = `${paletteVariantKey}:${def.skin}`;
    const currentStatus = preloadStatusByPaletteSkin.get(statusKey);
    if (currentStatus !== "UNSUPPORTED" && currentStatus !== "FAILED") {
        preloadEnemySpritesForDarknessPercent(args.darknessPercent);
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
