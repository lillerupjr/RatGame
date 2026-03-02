// src/game/visual/projectileSprites.ts
// Loads projectile sprites from: /assets-runtime/projectiles/
// Notes:
// - Explicit static URLs served from public/
// - Centralized per-weapon scaling via PROJECTILE_SCALE_BY_KIND
// - Exposes getProjectileDrawScale(kind) so render.ts stays simple

export type Loaded = { img: HTMLImageElement; ready: boolean; src?: string };

export const PROJECTILE_BASE_DRAW_PX = 36;

// ---- Configure expected filenames here ----
const FILES = {
    KNIFE: "knife.png",
    PISTOL: "pistol.png",
    SYRINGE: "syringe.png",
    BAZOOKA: "bazooka.png",
} as const;

const cache: Record<string, Loaded> = Object.create(null);

const PROJECTILE_URLS = {
    KNIFE: `${import.meta.env.BASE_URL}assets-runtime/projectiles/knife.png`,
    PISTOL: `${import.meta.env.BASE_URL}assets-runtime/projectiles/pistol.png`,
    SYRINGE: `${import.meta.env.BASE_URL}assets-runtime/projectiles/syringe.png`,
    BAZOOKA: `${import.meta.env.BASE_URL}assets-runtime/projectiles/bazooka.png`,
} as const;

function resolveUrl(file: string): string | null {
    for (const [kind, filename] of Object.entries(FILES)) {
        if (filename === file) return PROJECTILE_URLS[kind as keyof typeof PROJECTILE_URLS];
    }
    return null;
}

function loadByFile(file: string): Loaded {
    if (!file) return { img: new Image(), ready: false };
    const key = file;
    if (cache[key]) return cache[key];

    const url = resolveUrl(file);
    if (!url) {
        console.warn(`[projectileSprites] Missing ${file} in /assets-runtime/projectiles/`);
        cache[key] = { img: new Image(), ready: false };
        return cache[key];
    }

    const img = new Image();
    const entry: Loaded = { img, ready: false, src: url };
    cache[key] = entry;

    img.onload = () => (entry.ready = true);
    img.onerror = () => {
        console.warn(`[projectileSprites] Failed to load: ${url}`);
        entry.ready = false;
    };
    img.src = url;

    return entry;
}

export function preloadProjectileSprites() {
    for (const f of Object.values(FILES)) loadByFile(f);
}

// ---- Projectile Kind -> sprite ----
// Kind numbers come from projectileFactory.ts
export function getProjectileSpriteByKind(kind: number): Loaded | null {
    switch (kind) {
        case 1: // KNIFE
            return loadByFile(FILES.KNIFE);
        case 2: // PISTOL
            return loadByFile(FILES.PISTOL);
        case 3: // SWORD
            return null;
        case 4: // KNUCKLES
            return null;
        case 5: // SYRINGE
            return loadByFile(FILES.SYRINGE);
        case 6: // BOUNCER
            return null;
        case 8: // DAGGER
            return loadByFile(FILES.KNIFE);
        case 7: // MISSILE
            return loadByFile(FILES.BAZOOKA);
        default:
            return null;
    }
}

// ---- Centralized scaling ----
// Multiplier applied on top of your radius-based target size in render.ts.
// Example: knife at 1.0, sword at 1.4, syringe at 0.9, bouncer at 1.2, etc.
const PROJECTILE_SCALE_BY_KIND: Record<number, number> = {
    1: 1, // KNIFE
    2: 0.2, // PISTOL
    3: 1.0, // SWORD
    4: 1.0, // KNUCKLES
    5: 1, // SYRINGE
    6: 1.0, // BOUNCER
    7: 1.0, // MISSILE
    8: 0.9, // DAGGER
};

export function getProjectileDrawScale(kind: number): number {
    return PROJECTILE_SCALE_BY_KIND[kind] ?? 1.0;
}

// Optional: quick runtime tweaking from console/dev tools if you want
export function setProjectileDrawScale(kind: number, mult: number) {
    PROJECTILE_SCALE_BY_KIND[kind] = Math.max(0.1, Math.min(10, mult));
}
