// src/game/visual/background.ts

type BgAsset = {
    img: HTMLImageElement | null;
    ready: boolean;
    src?: string;
};

let _bg: BgAsset | null = null;

// We are inside src/game/visual, so assets are ../../assets
const modules = import.meta.glob("../../assets/background/test.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

// Pick your desired background
const BG_FILE = "test.png";

function resolveBgUrl(): string {
    // Find by filename suffix to avoid OS path differences
    const hit = Object.entries(modules).find(([path]) => path.endsWith(`/background/${BG_FILE}`));
    if (!hit) {
        // Fallback: first background we can find (useful if filename changes)
        const first = Object.values(modules)[0];
        if (!first) {
            console.warn(`[background] No background images found in ../../assets/background/*.png`);
            return "";
        }
        console.warn(`[background] ${BG_FILE} not found, falling back to first background.`);
        return first;
    }
    return hit[1];
}

export function preloadBackground() {
    if (_bg) return;

    const url = resolveBgUrl();
    if (!url) {
        _bg = { img: null, ready: false };
        return;
    }

    const img = new Image();
    _bg = { img, ready: false, src: url };

    img.onload = () => {
        if (_bg) _bg.ready = true;
    };
    img.onerror = () => {
        console.warn(`[background] Failed to load background: ${url}`);
        if (_bg) _bg.ready = false;
    };

    img.src = url;
}

export function getBackground(): BgAsset {
    if (!_bg) preloadBackground();
    return _bg!;
}
