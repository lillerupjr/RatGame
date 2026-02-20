import { ENEMY_TYPE, type EnemyType } from "../../../game/content/enemies";
import { resolveActivePaletteId } from "../../../game/render/activePalette";
import { dir8FromVector } from "./dir8";
import {
    createPaletteSwapState,
    notePaletteReady,
    notePaletteRequested,
} from "./paletteSwapState";
import {
    getSpriteFrame,
    preloadSpritePack,
    type SpriteLoaderSource,
    type SpritePack,
} from "./spriteLoader";

type EnemySpriteDef = {
    skin: string;
    scale: number;
    anchorX: number;
    anchorY: number;
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
        runAnim: "running-4-frames",
    },
    [ENEMY_TYPE.RUNNER]: {
        skin: "rat2",
        scale: 1.5,
        anchorX: 0.5,
        anchorY: 0.65,
        runAnim: "walk-4-frames",
    },
    [ENEMY_TYPE.BRUISER]: {
        skin: "rat4",
        scale: 2,
        anchorX: 0.5,
        anchorY: 0.65,
        runAnim: "walk-4-frames",

    },
    [ENEMY_TYPE.BOSS]: {
        skin: "infested",
        scale: 2,
        anchorX: 0.5,
        anchorY: 0.65,
        runAnim: "walk",
    },
};

const paletteState = createPaletteSwapState(resolveActivePaletteId());
const packsByPalette = new Map<string, Map<string, SpritePack>>();
const preloadByPaletteSkin = new Map<string, Promise<void>>();

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

export function preloadEnemySprites() {
    const paletteId = resolveActivePaletteId();
    notePaletteRequested(paletteState, paletteId);
    const map = getPaletteMap(paletteId);
    const skins = getRequiredSkins();

    for (const skin of skins) {
        if (map.has(skin)) continue;
        const key = `${paletteId}:${skin}`;
        if (preloadByPaletteSkin.has(key)) continue;
        const def = Object.values(ENEMY_SPRITES).find((entry) => entry?.skin === skin);
        const job = preloadSpritePack(skin, {
            source: def?.source,
            animKeys: def?.runAnim ? [def.runAnim] : undefined,
            frameCount: def?.frameCount,
        })
            .then((pack) => {
                map.set(skin, pack);
                markPaletteReadyIfComplete(paletteId);
            })
            .catch((err) => {
                console.warn(`[enemySprites] Failed to preload ${skin}`, err);
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
    scale: number;
    anchorX: number;
    anchorY: number;
}
    | null {
    const def = ENEMY_SPRITES[args.type];
    if (!def) return null;
    const paletteId = resolveActivePaletteId();
    notePaletteRequested(paletteState, paletteId);
    preloadEnemySprites();

    const pack = getPaletteMap(paletteId).get(def.skin)
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
        scale: def.scale,
        anchorX: def.anchorX,
        anchorY: def.anchorY,
    };
}
