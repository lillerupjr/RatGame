// src/game/visual/curtainSprites.ts
//
// Explicit TOP + APRON sprites for Phase 1.x render pipeline.
// Floors: one top + 2 aprons (S and E)
// Stairs: 2 tops (big = N/S, small = E/W) + 2 aprons (N and E), mirrored for S/W.

export type LoadedImg = {
    img: HTMLImageElement;
    ready: boolean;
};

export const FLOOR_TOP_DY_PX: Record<"N" | "E" | "S" | "W", number> = {
    N: 0,
    E: 0,
    S: 0,
    W: 0,
};
export const STAIR_TOP_DY_PX: Record<"N" | "E" | "S" | "W", number> = {
    N: -8,
    E: 8,
    S: 8,
    W: -8,
};
export const WALL_TOP_DY_PX: Record<"N" | "E" | "S" | "W", number> = {
    N: 0,
    E: 0,
    S: 0,
    W: 0,
};
export const FLOOR_APRON_DY_PX: Record<"S" | "E", number> = {
    S: 0,
    E: 0,
};
export const STAIR_APRON_DY_PX: Record<"N" | "E" | "S" | "W", number> = {
    N: -114,
    E: -100,
    S: -107,
    W: -116,
};
export const WALL_APRON_DY_PX: Record<"N" | "E" | "S" | "W", number> = {
    N: -100,
    E: -100,
    S: -100,
    W: -100,
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
const FLOOR_APRON_S = load(
    new URL("../../assets/tiles/floor/curtain/floor_apron_s.png", import.meta.url).href
);
const FLOOR_APRON_E = load(
    new URL("../../assets/tiles/floor/curtain/floor_apron_e.png", import.meta.url).href
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

const STAIR_APRON_N = load(
    new URL("../../assets/tiles/stairs/curtain/stair_apron_n.png", import.meta.url).href
);
const STAIR_APRON_E = load(
    new URL("../../assets/tiles/stairs/curtain/stair_apron_e.png", import.meta.url).href
);
const STAIR_APRON_S = load(
    new URL("../../assets/tiles/stairs/curtain/stair_apron_s.png", import.meta.url).href
);
const STAIR_APRON_W = load(
    new URL("../../assets/tiles/stairs/curtain/stair_apron_w.png", import.meta.url).href
);
const WALL_2_S = load(
    new URL("../../assets/tiles/walls/wall_2_s.png", import.meta.url).href
);
const WALL_2_E = load(
    new URL("../../assets/tiles/walls/wall_2_e.png", import.meta.url).href
);

export function preloadCurtainSprites() {
    // Images start loading on module import; this function exists for symmetry.
    // Keeping it allows render.ts to do one-time "preload" like other sprite packs.
    void FLOOR_TOP;
    void FLOOR_APRON_S;
    void FLOOR_APRON_E;
    void STAIR_TOP_N;
    void STAIR_TOP_S;
    void STAIR_TOP_E;
    void STAIR_TOP_W;
    void STAIR_APRON_N;
    void STAIR_APRON_E;
    void STAIR_APRON_W
    void STAIR_APRON_S
    void WALL_2_S;
    void WALL_2_E;
}
export function getFloorTop(): LoadedImg {
    return FLOOR_TOP;
}

export function getFloorApron(kind: "S" | "E"): LoadedImg {
    // File names:
    // - floor_apron_s.png
    // - floor_apron_e.png
    return kind === "S" ? FLOOR_APRON_S : FLOOR_APRON_E;
}

export function getStairTop(dir: "N" | "E" | "S" | "W"): LoadedImg {
    switch (dir) {
        case "N": return STAIR_TOP_N;
        case "E": return STAIR_TOP_E;
        case "S": return STAIR_TOP_S;
        case "W": return STAIR_TOP_W;
    }
}

export function getStairApron(dir: "N" | "E" | "S" | "W"): { rec: LoadedImg; flipX: boolean } {
    // Screen directions (your convention):
    // N = top-left of screen (↖)
    // E = top-right of screen (↗)
    // S = bottom-right of screen (↘)
    // W = bottom-left of screen (↙)
    //
    // We reuse each sprite for its opposite direction by flipping.
    if (dir === "N") return { rec: STAIR_APRON_N, flipX: false };
    if (dir === "S") return { rec: STAIR_APRON_S, flipX: false };

    if (dir === "E") return { rec: STAIR_APRON_E, flipX: false };
    if (dir === "W") return { rec: STAIR_APRON_W, flipX: false };
    return { rec: STAIR_APRON_E, flipX: true };
}

export function getWallSegment(kind: "S" | "E"): LoadedImg {
    return kind === "S" ? WALL_2_S : WALL_2_E;
}
