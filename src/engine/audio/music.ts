// src/game/audio/music.ts

type StageId = "DOCKS" | "SEWERS" | "CHINATOWN";

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
let musicMasterVolume = 0.6;
let musicMuted = false;

/**
 * Per-track base mix volume (before master volume).
 * Useful if some tracks are louder than others.
 */
const BASE_TRACK_VOLUME = 1;

function applyVolume() {
    if (!cur) return;
    cur.volume = (musicMuted ? 0 : BASE_TRACK_VOLUME) * musicMasterVolume;
}

/**
 * Set global music volume (0..1)
 */
export function setMusicMasterVolume(v: number) {
    musicMasterVolume = Math.max(0, Math.min(1, v));
    applyVolume();
}

export function setMusicVolume(v: number) {
    setMusicMasterVolume(v);
}

/**
 * Optional getter (useful for UI sliders)
 */
export function getMusicMasterVolume() {
    return musicMasterVolume;
}

export function getMusicVolume() {
    return musicMasterVolume;
}

export function setMusicMuted(muted: boolean) {
    musicMuted = !!muted;
    applyVolume();
}

export function getMusicMuted() {
    return musicMuted;
}

// -----------------------------
// Autoplay unlock handling
// iOS Safari + iOS standalone/PWA still require an initial user gesture.
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
                // still blocked - ignore
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
    if (!filename) return null;
    return `${import.meta.env.BASE_URL}assets-runtime/music/${filename}`;
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
        console.warn("[music] Missing file:", file);
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
