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

function findUrl(filename: string): string | null {
    for (const [k, url] of Object.entries(modules)) {
        if (k.endsWith("/" + filename)) return url;
    }
    return null;
}

export function setMusicStage(stage: StageId) {
    if (curStage === stage) return;
    curStage = stage;

    const url = findUrl(FILES[stage]);
    if (!url) {
        console.warn("[music] Missing file:", FILES[stage]);
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
    a.volume = 0.35;
    a.preload = "auto";
    cur = a;

    // Try to play (may be blocked until first user gesture)
    void a.play().catch(() => {});
}

export function stopMusic() {
    curStage = null;
    if (cur) {
        cur.pause();
        cur.src = "";
        cur = null;
    }
}
