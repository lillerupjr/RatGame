// src/game/systems/playerSprites.ts
export type Dir8 = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type Frame3 = 1 | 2 | 3;



export const PLAYER_SPRITE_SCALE = 3;



type SpriteKey = `${Dir8}${Frame3}`;

const _imgs = new Map<SpriteKey, HTMLImageElement>();
let _ready = false;

function key(dir: Dir8, frame: Frame3): SpriteKey {
    return `${dir}${frame}` as SpriteKey;
}

/**
 * Loads PNGs from: src/assets/player/
 * Expected names: N1.png, N2.png, N3.png ... NW3.png
 */
export async function preloadPlayerSprites() {
    if (_ready) return;

    // We are inside src/engine/render/sprites, so assets are ../../../assets
    const modules = import.meta.glob("../../../assets/player/*.png", {
        eager: true,
        import: "default",
    }) as Record<string, string>;

    // Map filename stem -> url
    const byStem = new Map<string, string>();
    for (const path in modules) {
        const url = modules[path];
        const base = path.split("/").pop() || "";
        const stem = base.replace(/\.png$/i, "");
        byStem.set(stem, url);
    }

    const dirs: Dir8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const frames: Frame3[] = [1, 2, 3];

    const jobs: Promise<void>[] = [];

    for (const d of dirs) {
        for (const f of frames) {
            const stem = `${d}${f}`;
            const url = byStem.get(stem);
            if (!url) {
                console.warn(`[playerSprites] Missing: ${stem}.png`);
                continue;
            }

            jobs.push(
                new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                    img.src = url;
                    _imgs.set(key(d, f), img);
                })
            );
        }
    }

    await Promise.all(jobs);
    _ready = true;
}

export function playerSpritesReady() {
    return _ready;
}

export function getPlayerSprite(dir: Dir8, frame: Frame3): HTMLImageElement | null {
    return _imgs.get(key(dir, frame)) ?? null;
}
