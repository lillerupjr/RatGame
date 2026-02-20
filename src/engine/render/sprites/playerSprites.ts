import { type Dir8 } from "./dir8";
import { resolveActivePaletteId } from "../../../game/render/activePalette";
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

const PLAYER_SOURCE: SpriteLoaderSource = { packRoot: "entities/player" };
const PLAYER_WALK_ANIM = "walk";
const PLAYER_ANCHOR_X = 0.5;
const PLAYER_ANCHOR_Y = 0.75;
const PLAYER_SKIN_SCALE: Record<string, number> = {
    jack: 1,
    hobo: 1,
    jamal: 1,
    joey: 1,
    tommy: 1,
};

let playerSkin = "jamal";

export function getPlayerSkin(): string {
    return playerSkin;
}
let playerPack: SpritePack | null = null;
let _ready = false;
let loadedPaletteId = "";

function refreshPaletteState(): string {
    const paletteId = resolveActivePaletteId();
    if (paletteId !== loadedPaletteId) {
        loadedPaletteId = paletteId;
        playerPack = null;
        _ready = false;
    }
    return paletteId;
}

export function setPlayerSkin(skin: string) {
    if (skin === playerSkin) return;
    playerSkin = skin;
    playerPack = null;
    _ready = false;
}

export function getPlayerIdleSpriteUrl(skin: string): string {
    return `/assets-runtime/base_db32/entities/player/${skin}/rotations/south.png`;
}

export async function preloadPlayerSprites() {
    refreshPaletteState();
    if (_ready) return;

    try {
        playerPack = await preloadSpritePack(playerSkin, {
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
    refreshPaletteState();
    return _ready;
}

export function getPlayerSpriteFrame(args: {
    dir: Dir8;
    moving: boolean;
    time: number;
}): SpriteFrame | null {
    refreshPaletteState();
    if (!_ready || !playerPack) {
        void preloadPlayerSprites();
        return null;
    }

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
            scale: PLAYER_SKIN_SCALE[playerSkin] ?? PLAYER_SPRITE_SCALE,
            anchorX: PLAYER_ANCHOR_X,
            anchorY: PLAYER_ANCHOR_Y,
        };
    } catch (err) {
        console.warn("[playerSprites] Failed to read player frame", err);
        return null;
    }
}
