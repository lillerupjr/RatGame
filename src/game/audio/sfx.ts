// src/game/audio/sfx.ts
// Minimal WebAudio SFX loader + player (safe no-op until audio is "unlocked" by a user gesture)

import type { SfxId } from "../events";

type BufferRec = { buf: AudioBuffer | null; ready: boolean; url?: string };

const modules = import.meta.glob("../../assets/sfx/*.{wav,mp3,ogg}", {
    eager: true,
    import: "default",
}) as Record<string, string>;

// Map SfxId -> filename in src/assets/sfx/
const FILES: Record<SfxId, string> = {
    FIRE_KNIFE: "fire_knife.wav",
    FIRE_PISTOL: "fire_pistol.wav",
    FIRE_SYRINGE: "fire_syringe.wav",
    FIRE_BOUNCER: "fire_bouncer.wav",
    FIRE_BAZOOKA: "fire_bazooka.wav",
    FIRE_OTHER: "fire_other.wav",

    WALK_STEP: "walk_step.wav",

    EXPLOSION_BAZOOKA: "explosion_bazooka.wav",
    EXPLOSION_SYRINGE: "explosion_syringe.wav",

    ENEMY_HIT: "enemy_hit.wav",
    ENEMY_KILL: "enemy_kill.wav",
    PLAYER_HIT: "player_hit.wav",
    XP_PICKUP: "xp_pickup.wav",
    LEVEL_UP: "level_up.wav",
    CHEST_PICKUP: "chest_pickup.wav",
    FLOOR_START: "floor_start.wav",
    BOSS_START: "boss_start.wav",
    RUN_WIN: "run_win.wav",
    RUN_LOSE: "run_lose.wav",
    UI_CLICK: "ui_click.wav",
};


function resolveUrl(file: string): string | null {
    for (const [path, url] of Object.entries(modules)) {
        if (path.endsWith(`/sfx/${file}`)) return url;
    }
    return null;
}

let _ctx: AudioContext | null = null;
const cache: Partial<Record<SfxId, BufferRec>> = {};

function ctx(): AudioContext | null {
    if (_ctx) return _ctx;

    // WebAudio exists?
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as
        | typeof AudioContext
        | undefined;
    if (!AC) return null;

    _ctx = new AC();
    return _ctx;
}

async function loadBuffer(id: SfxId): Promise<BufferRec> {
    const existing = cache[id];
    if (existing) return existing;

    const file = FILES[id];
    const url = resolveUrl(file);

    const rec: BufferRec = { buf: null, ready: false, url: url ?? undefined };
    cache[id] = rec;

    const c = ctx();
    if (!c) return rec;

    if (!url) {
        console.warn(`[sfx] Missing file for ${id}: src/assets/sfx/${file}`);
        return rec;
    }

    try {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        rec.buf = await c.decodeAudioData(arr);
        rec.ready = true;
    } catch (e) {
        console.warn(`[sfx] Failed to load ${id} (${url})`, e);
        rec.ready = false;
    }

    return rec;
}

// Unlock on first gesture (best-effort)
let _unlockWired = false;
function wireUnlock() {
    if (_unlockWired) return;
    _unlockWired = true;

    const tryResume = async () => {
        const c = ctx();
        if (!c) return;
        if (c.state === "suspended") {
            try {
                await c.resume();
            } catch {
                // ignore
            }
        }
    };

    window.addEventListener("pointerdown", tryResume, { passive: true });
    window.addEventListener("keydown", tryResume);
}

export async function preloadSfx() {
    wireUnlock();
    // Kick off loads (don’t await all; just warm caches)
    for (const id of Object.keys(FILES) as SfxId[]) {
        void loadBuffer(id);
    }
}

function playFallbackBeep(volume: number, rate: number) {

    const c = ctx();
    if (!c) return;
    if (c.state !== "running") return;

    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.value = 220 * Math.max(0.25, Math.min(4, rate));
    g.gain.value = Math.max(0, Math.min(1, volume)) * 0;

    o.connect(g);
    g.connect(c.destination);

    const t0 = c.currentTime;
    o.start(t0);
    o.stop(t0 + 0.06);
}

export async function playSfx(id: SfxId, opts?: { vol?: number; rate?: number }) {
    wireUnlock();

    const c = ctx();
    if (!c) return;
    if (c.state !== "running") return;

    const vol = Math.max(0, Math.min(1, opts?.vol ?? 1));
    const rate = Math.max(0.25, Math.min(4, opts?.rate ?? 1));

    const rec = await loadBuffer(id);
    if (!rec.ready || !rec.buf) {
        // Dev-friendly: still give audible feedback even before files exist.
        playFallbackBeep(vol, rate);
        return;
    }

    const src = c.createBufferSource();
    src.buffer = rec.buf;
    src.playbackRate.value = rate;

    const gain = c.createGain();
    gain.gain.value = vol;

    src.connect(gain);
    gain.connect(c.destination);

    src.start();
}
