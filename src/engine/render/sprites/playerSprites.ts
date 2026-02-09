import { type Dir8 } from "./dir8";
import {
    getSpriteFrame,
    preloadSpritePack,
    type SpriteLoaderSource,
    type SpritePack,
} from "./spriteLoader";

export const PLAYER_SPRITE_SCALE = 1;

type SpriteFrame = {
    img: HTMLImageElement;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    scale: number;
    anchorX: number;
    anchorY: number;
};

const PLAYER_ASSET_MODULES = import.meta.glob("../../../assets/player/**/*", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const PLAYER_SOURCE: SpriteLoaderSource = { packRoot: "/player", modules: PLAYER_ASSET_MODULES };
const PLAYER_SKIN = "jack"; // TODO: make this dynamic
const PLAYER_WALK_ANIM = "walk";
const PLAYER_ANCHOR_X = 0.5;
const PLAYER_ANCHOR_Y = 0.65;
const PLAYER_SKIN_SCALE: Record<string, number> = {
    jack: 1,
    hobo: 1,

};

let playerPack: SpritePack | null = null;
let _ready = false;

export async function preloadPlayerSprites() {
    if (_ready) return;

    try {
        playerPack = await preloadSpritePack(PLAYER_SKIN, {
            source: PLAYER_SOURCE,
            animKeys: [PLAYER_WALK_ANIM],
            frameCount: 6,
        });
        _ready = true;
    } catch (err) {
        console.warn("[playerSprites] Failed to preload player pack", err);
        _ready = false;
    }
}

export function playerSpritesReady() {
    return _ready;
}

export function getPlayerSpriteFrame(args: {
    dir: Dir8;
    moving: boolean;
    time: number;
}): SpriteFrame | null {
    if (!_ready || !playerPack) return null;

    try {
        const img = getSpriteFrame(playerPack, {
            dir: args.dir,
            anim: args.moving ? PLAYER_WALK_ANIM : undefined,
            t: args.time,
            useRotationIfNoAnim: true,
        });

        return {
            img,
            sx: 0,
            sy: 0,
            sw: playerPack.size.w,
            sh: playerPack.size.h,
            scale: PLAYER_SKIN_SCALE[PLAYER_SKIN] ?? PLAYER_SPRITE_SCALE,
            anchorX: PLAYER_ANCHOR_X,
            anchorY: PLAYER_ANCHOR_Y,
        };
    } catch (err) {
        console.warn("[playerSprites] Failed to read player frame", err);
        return null;
    }
}
