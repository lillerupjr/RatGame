import { ENEMY_TYPE, type EnemyType } from "../../../game/content/enemies";
import { dir8FromVector } from "./dir8";
import { getSpriteFrame, preloadSpritePack, type SpritePack } from "./spriteLoader";

type EnemySpriteDef = {
    skin: string;
    scale: number;
    anchorX: number;
    anchorY: number;
    runAnim?: string;
};

const ENEMY_SPRITES: Partial<Record<EnemyType, EnemySpriteDef>> = {
    [ENEMY_TYPE.CHASER]: {
        skin: "rat1",
        scale: 2,
        anchorX: 0.5,
        anchorY: 0.65,
        runAnim: "running-4-frames",
    },
    [ENEMY_TYPE.RUNNER]: {
        skin: "rat1",
        scale: 4,
        anchorX: 0.5,
        anchorY: 0.65,
        runAnim: "running-4-frames",
    },
    [ENEMY_TYPE.BRUISER]: {
        skin: "rat1",
        scale: 6,
        anchorX: 0.5,
        anchorY: 0.65,
        runAnim: "running-4-frames",
    },
    [ENEMY_TYPE.BOSS]: {
        skin: "rat1",
        scale: 10,
        anchorX: 0.5,
        anchorY: 0.65,
        runAnim: "running-4-frames",
    },
};

const loadedPacks = new Map<string, SpritePack>();

export function preloadEnemySprites() {
    const skins = new Set<string>();
    for (const def of Object.values(ENEMY_SPRITES)) {
        if (def?.skin) skins.add(def.skin);
    }

    for (const skin of skins) {
        if (loadedPacks.has(skin)) continue;
        preloadSpritePack(skin)
            .then((pack) => {
                loadedPacks.set(skin, pack);
            })
            .catch((err) => {
                console.warn(`[enemySprites] Failed to preload ${skin}`, err);
            });
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

    const pack = loadedPacks.get(def.skin);
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
