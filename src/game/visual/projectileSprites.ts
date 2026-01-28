// src/game/visual/projectileSprites.ts
// Loads projectile sprites from: src/assets/projectiles/
// Expected filenames (you can change these constants to match your actual png names):
//   knife.png, pistol.png, syringe.png, bouncer.png, sword.png, knuckles.png
//
// Notes:
// - Uses Vite import.meta.glob with eager URLs (same pattern as background/playerSprites).
// - Returns { img, ready } and never throws at runtime.

type Loaded = { img: HTMLImageElement; ready: boolean; src?: string };

const modules = import.meta.glob("././assets/projectiles/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

// ---- Configure expected filenames here ----
const FILES = {
    KNIFE: "knife.png",
    PISTOL: "pistol.png",
    SYRINGE: "syringe.png",
    BOUNCER: "bouncer.png",
    SWORD: "sword.png",
    KNUCKLES: "knuckles.png",
} as const;

const cache: Record<string, Loaded> = Object.create(null);

function resolveUrl(file: string): string | null {
    for (const [path, url] of Object.entries(modules)) {
        if (path.endsWith(`/projectiles/${file}`)) return url;
    }
    return null;
}

function loadByFile(file: string): Loaded {
    const key = file;
    if (cache[key]) return cache[key];

    const url = resolveUrl(file);
    if (!url) {
        // Keep it non-fatal: render.ts will fall back to circles
        console.warn(`[projectileSprites] Missing ${file} in src/assets/projectiles/`);
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

export function getProjectileSpriteByKind(kind: number): Loaded | null {
    // Local mapping to avoid importing PRJ_KIND here (keeps this module “visual-only”)
    // Kind numbers come from projectileFactory.ts
    switch (kind) {
        case 1: // KNIFE
            return loadByFile(FILES.KNIFE);
        case 2: // PISTOL
            return loadByFile(FILES.PISTOL);
        case 3: // SWORD
            return loadByFile(FILES.SWORD);
        case 4: // KNUCKLES
            return loadByFile(FILES.KNUCKLES);
        case 5: // SYRINGE
            return loadByFile(FILES.SYRINGE);
        case 6: // BOUNCER
            return loadByFile(FILES.BOUNCER);
        default:
            return null;
    }
}
