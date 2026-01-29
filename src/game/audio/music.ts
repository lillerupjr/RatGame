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

// autoplay may be blocked until user gesture
let _unlocked = false;
let _wired = false;

function wireUnlock() {
    if (_wired) return;
    _wired = true;

    const unlock = async () => {
        _unlocked = true;

        // If we already have a track selected, try again now
        if (cur) {
            try {
                await cur.play();
            } catch {
                // still blocked or no device — ignore
            }
        }
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
}

function findUrl(filename: string): string | null {
    for (const [k, url] of Object.entries(modules)) {
        if (k.endsWith("/" + filename)) return url;
    }
    return null;
}

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
    a.volume = 0.75; // bump while testing
    a.preload = "auto";
    cur = a;

    // Try to play now; if blocked, it will start on first gesture via unlock handler
    void a.play().catch((e) => {
        // Don’t hide this during dev—this tells you it’s autoplay-blocked.
        console.warn("[music] play blocked (expected until click/keypress):", e);
    });

    // If already unlocked, force a play attempt again (some browsers need it)
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
