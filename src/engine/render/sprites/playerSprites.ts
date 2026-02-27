import { type Dir8 } from "./dir8";
import { resolveActivePaletteId } from "../../../game/render/activePalette";
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
const paletteState = createPaletteSwapState(resolveActivePaletteId());
const packsByPalette = new Map<string, Map<string, SpritePack>>();
const preloadByPaletteSkin = new Map<string, Promise<void>>();

export function getPlayerSkin(): string {
    return playerSkin;
}

function getPaletteMap(paletteId: string): Map<string, SpritePack> {
    const existing = packsByPalette.get(paletteId);
    if (existing) return existing;
    const created = new Map<string, SpritePack>();
    packsByPalette.set(paletteId, created);
    return created;
}

export function setPlayerSkin(skin: string) {
    if (skin === playerSkin) return;
    playerSkin = skin;
    void preloadPlayerSprites();
}

export function getPlayerIdleSpriteUrl(skin: string): string {
    return `${import.meta.env.BASE_URL}assets-runtime/base_db32/entities/player/${skin}/rotations/south.png`;
}

export async function preloadPlayerSprites() {
    const paletteId = resolveActivePaletteId();
    notePaletteRequested(paletteState, paletteId);
    const map = getPaletteMap(paletteId);
    if (map.has(playerSkin)) {
        notePaletteReady(paletteState, paletteId);
        return;
    }

    const key = `${paletteId}:${playerSkin}`;
    const inFlight = preloadByPaletteSkin.get(key);
    if (inFlight) {
        await inFlight;
        return;
    }

    const job = preloadSpritePack(playerSkin, {
            source: PLAYER_SOURCE,
            animKeys: [PLAYER_WALK_ANIM],
            frameCount: 6,
        })
        .then((pack) => {
            map.set(playerSkin, pack);
            notePaletteReady(paletteState, paletteId);
        })
        .catch((err) => {
            console.warn("[playerSprites] Failed to preload player pack", err);
        })
        .finally(() => {
            preloadByPaletteSkin.delete(key);
        });
    preloadByPaletteSkin.set(key, job);
    await job;
}

export function playerSpritesReady() {
    const paletteId = resolveActivePaletteId();
    notePaletteRequested(paletteState, paletteId);
    const current = getPaletteMap(paletteId).get(playerSkin);
    if (!current) {
        void preloadPlayerSprites();
    }
    if (current) return true;
    const fallback = getPaletteMap(paletteState.lastReadyPaletteId).get(playerSkin);
    return !!fallback;
}

export function getPlayerSpriteFrame(args: {
    dir: Dir8;
    moving: boolean;
    time: number;
}): SpriteFrame | null {
    const paletteId = resolveActivePaletteId();
    notePaletteRequested(paletteState, paletteId);
    const currentPack = getPaletteMap(paletteId).get(playerSkin);
    if (!currentPack) {
        void preloadPlayerSprites();
    }
    const playerPack = currentPack ?? getPaletteMap(paletteState.lastReadyPaletteId).get(playerSkin);
    if (!playerPack) {
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
