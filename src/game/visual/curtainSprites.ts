// src/game/visual/curtainSprites.ts
//
// Explicit TOP + APRON sprites for Phase 1.x render pipeline.
// Floors: one top + 2 aprons (S and DIAG)
// Stairs: 2 tops (big = N/S, small = E/W) + 2 aprons (N and E), mirrored for S/W.

export type LoadedImg = {
    img: HTMLImageElement;
    ready: boolean;
};

function load(url: string): LoadedImg {
    const img = new Image();
    const rec: LoadedImg = { img, ready: false };
    img.onload = () => (rec.ready = true);
    img.onerror = () => (rec.ready = false);
    img.src = url;
    return rec;
}

// ------------------------------------------------------------------
// Paths (Vite-friendly): new URL(..., import.meta.url).href
// ------------------------------------------------------------------

const FLOOR_TOP = load(new URL("../../assets/tiles/floor/top/floor_top.png", import.meta.url).href);
const FLOOR_APRON_S = load(new URL("../../assets/tiles/floor/curtain/floor_apron_diag.png", import.meta.url).href);
const FLOOR_APRON_DIAG = load(
    new URL("./../assets/tiles/floor/curtain/floor_apron_s.png", import.meta.url).href
);

const STAIR_TOP_N = load(
    new URL("../../assets/tiles/stairs/top/stair_top_n.png", import.meta.url).href
);
const STAIR_TOP_S = load(
    new URL("../../assets/tiles/stairs/top/stair_top_s.png", import.meta.url).href
);
const STAIR_TOP_E = load(
    new URL("../../assets/tiles/stairs/top/stair_top_e.png", import.meta.url).href
);
const STAIR_TOP_W = load(
    new URL("../../assets/tiles/stairs/top/stair_top_w.png", import.meta.url).href
);

const STAIR_APRON_W = load(
    new URL("./../assets/tiles/stairs/curtain/stair_apron_w.png", import.meta.url).href
);
const STAIR_APRON_S = load(
    new URL("./../assets/tiles/stairs/curtain/stair_apron_s.png", import.meta.url).href
);

export function preloadCurtainSprites() {
    // Images start loading on module import; this function exists for symmetry.
    // Keeping it allows render.ts to do one-time "preload" like other sprite packs.
    void FLOOR_TOP;
    void FLOOR_APRON_S;
    void FLOOR_APRON_DIAG;
    void STAIR_TOP_N;
    void STAIR_TOP_S;
    void STAIR_TOP_E;
    void STAIR_TOP_W;
    void STAIR_APRON_W;
    void STAIR_APRON_S;
}
export function getFloorTop(): LoadedImg {
    return FLOOR_TOP;
}

export function getFloorApron(kind: "S" | "DIAG"): LoadedImg {
    // File names:
    // - floor_apron_s.png
    // - floor_apron_diag.png
    return kind === "S" ? FLOOR_APRON_S : FLOOR_APRON_DIAG;
}

export function getStairTop(dir: "N" | "E" | "S" | "W"): LoadedImg {
    if (dir === "E") return STAIR_TOP_N;
    if (dir === "W") return STAIR_TOP_S;
    if (dir === "S") return STAIR_TOP_E;
    return STAIR_TOP_W;
}

export function getStairApron(dir: "N" | "E" | "S" | "W"): { rec: LoadedImg; flipX: boolean } {
    // "Your/my" screen directions:
    // N = ~10:30 (back)
    // E = ~4:30  (front-right)
    // S = ~6:00  (front)
    // W = ~9:30  (front-left)
    //
    // Available sprites:
    // - STAIR_APRON_S (stair_apron_s.png)
    // - STAIR_APRON_W (stair_apron_w.png)
    //
    // We reuse each sprite for its opposite direction by flipping.
    if (dir === "S") return { rec: STAIR_APRON_S, flipX: false };
    if (dir === "N") return { rec: STAIR_APRON_S, flipX: true };

    if (dir === "W") return { rec: STAIR_APRON_W, flipX: false };
    // E
    return { rec: STAIR_APRON_W, flipX: true };
}
