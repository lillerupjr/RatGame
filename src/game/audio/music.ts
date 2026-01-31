// src/game/audio/music.ts

type StageId = "DOCKS" | "SEWERS" | "CHINATOWN";

const modules = import.meta.glob("../../assets/music/*.{mp3,ogg,wav}", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const FILES: Record<StageId, string> = {
    DOCKS: "test2.ogg",
    SEWERS: "test1.ogg",
    CHINATOWN: "test3.ogg",
};

let cur: HTMLAudioElement | null = null;
let curStage: StageId | null = null;

// -----------------------------
// Volume control
// -----------------------------

/**
 * Global master volume for music [0..1]
 * This should usually be driven by settings / UI.
 */
let musicMasterVolume = 0;

/**
 * Per-track base mix volume (before master volume).
 * Useful if some tracks are louder than others.
 */
const BASE_TRACK_VOLUME = 0.75;

function applyVolume() {
    if (!cur) return;
    cur.volume = BASE_TRACK_VOLUME * musicMasterVolume;
}

/**
 * Set global music volume (0..1)
 */
export function setMusicMasterVolume(v: number) {
    musicMasterVolume = Math.max(0, Math.min(1, v));
    applyVolume();
}

/**
 * Optional getter (useful for UI sliders)
 */
export function getMusicMasterVolume() {
    return musicMasterVolume;
}

// -----------------------------
// Autoplay unlock handling
// -----------------------------

let _unlocked = false;
let _wired = false;

function wireUnlock() {
    if (_wired) return;
    _wired = true;

    const unlock = async () => {
        _unlocked = true;

        if (cur) {
            try {
                await cur.play();
            } catch {
                // still blocked — ignore
            }
        }
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
}

// -----------------------------
// Helpers
// -----------------------------

function findUrl(filename: string): string | null {
    for (const [k, url] of Object.entries(modules)) {
        if (k.endsWith("/" + filename)) return url;
    }
    return null;
}

// -----------------------------
// Public API
// -----------------------------

export function setMusicStage(stage: StageId) {
    wireUnlock();

    if (curStage === stage) return;
    curStage = stage;

    const file = FILES[stage];
    const url = findUrl(file);
    if (!url) {
        console.warn("[music] Missing file:", file, "Known keys:", Object.keys(modules));
        return;
    }

    // Stop old
    if (cur) {
        cur.pause();
        cur.src = "";
        cur = null;
    }

    const a = new Audio(url);
    a.loop = true;
    a.preload = "auto";
    cur = a;

    applyVolume();

    // Try to play now; if blocked, unlock handler will retry
    void a.play().catch((e) => {
        console.warn("[music] play blocked (expected until click/keypress):", e);
    });

    if (_unlocked) {
        void a.play().catch(() => {});
    }
}

export function stopMusic() {
    curStage = null;
    if (cur) {
        cur.pause();
        cur.src = "";
        cur = null;
    }
}
