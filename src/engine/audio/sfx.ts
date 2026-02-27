// src/game/audio/sfx.ts
// Minimal WebAudio SFX loader + player with global + per-SFX volume controls

import type { SfxId } from "../../game/events";
import { clamp01 } from "../util/clamp";

type BufferRec = { buf: AudioBuffer | null; ready: boolean; url?: string };

/* ============================================================
   🔊 VOLUME CONTROLS (EDIT THESE)
   ============================================================ */

// Master SFX volume (0..1)
export let SFX_MASTER_VOL = 1.0;

// Per-SFX volume multipliers (0..1)
export const SFX_VOL: Record<SfxId, number> = {
    FIRE_KNIFE: 1.0,
    FIRE_PISTOL: 1.0,
    FIRE_SYRINGE: 1.0,
    FIRE_BOUNCER: 1.0,
    FIRE_BAZOOKA: 1.0,
    FIRE_OTHER: 1.0,

    WALK_STEP: 0.5,

    EXPLOSION_BAZOOKA: 1.0,
    EXPLOSION_SYRINGE: 1.0,

    ENEMY_HIT: 1.0,
    ENEMY_KILL: 0.2,
    PLAYER_HIT: 1.0,

    CHEST_PICKUP: 1.0,

    FLOOR_START: 1.0,
    BOSS_START: 1.0,

    RUN_WIN: 1.0,
    RUN_LOSE: 1.0,

    UI_CLICK: 1.0,
};

/* ============================================================ */

// Map SfxId -> filename
const FILES: Record<SfxId, string> = {
    FIRE_KNIFE: "fire_knife.wav",
    FIRE_PISTOL: "fire_pistol.wav",
    FIRE_SYRINGE: "fire_syringe.wav",
    FIRE_BOUNCER: "fire_bouncer.wav",
    FIRE_BAZOOKA: "fire_bazooka.wav",
    FIRE_OTHER: "",

    WALK_STEP: "walk_step2.wav",

    EXPLOSION_BAZOOKA: "explosion_bazooka.wav",
    EXPLOSION_SYRINGE: "explosion_syringe.wav",

    ENEMY_HIT: "",
    ENEMY_KILL: "enemy_kill.wav",
    PLAYER_HIT: "player_hit.wav",

    CHEST_PICKUP: "",

    FLOOR_START: "",
    BOSS_START: "",

    RUN_WIN: "run_win.wav",
    RUN_LOSE: "",

    UI_CLICK: "ui_click.wav",
};

function resolveUrl(file: string): string | null {
    if (!file) return null;
    return `${import.meta.env.BASE_URL}assets-runtime/sfx/${file}`;
}

let _ctx: AudioContext | null = null;
const cache: Partial<Record<SfxId, BufferRec>> = {};

function ctx(): AudioContext | null {
    if (_ctx) return _ctx;

    const AC = (window.AudioContext || (window as any).webkitAudioContext) as
        | typeof AudioContext
        | undefined;
    if (!AC) return null;

    _ctx = new AC();
    return _ctx;
}

async function loadBuffer(id: SfxId): Promise<BufferRec> {
    if (cache[id]) return cache[id]!;

    const url = resolveUrl(FILES[id]);
    const rec: BufferRec = { buf: null, ready: false, url: url ?? undefined };
    cache[id] = rec;

    const c = ctx();
    if (!c || !url) return rec;

    try {
        const res = await fetch(url);
        rec.buf = await c.decodeAudioData(await res.arrayBuffer());
        rec.ready = true;
    } catch {
        rec.ready = false;
    }

    return rec;
}

// Unlock audio on first user gesture
let unlocked = false;
function wireUnlock() {
    if (unlocked) return;
    unlocked = true;

    const resume = async () => {
        const c = ctx();
        if (c && c.state === "suspended") await c.resume();
    };

    window.addEventListener("pointerdown", resume, { passive: true });
    window.addEventListener("keydown", resume);
}

export async function preloadSfx() {
    wireUnlock();
    for (const id of Object.keys(FILES) as SfxId[]) {
        void loadBuffer(id);
    }
}

export async function playSfx(id: SfxId, opts?: { vol?: number; rate?: number }) {
    wireUnlock();

    const c = ctx();
    if (!c || c.state !== "running") return;

    const base = clamp01(opts?.vol ?? 1);
    const master = clamp01(SFX_MASTER_VOL);
    const per = clamp01(SFX_VOL[id] ?? 1);

    const finalVol = base * master * per;
    if (finalVol <= 0) return;

    const rate = Math.max(0.25, Math.min(4, opts?.rate ?? 1));

    const rec = await loadBuffer(id);
    if (!rec.ready || !rec.buf) return;

    const src = c.createBufferSource();
    const gain = c.createGain();

    src.buffer = rec.buf;
    src.playbackRate.value = rate;
    gain.gain.value = finalVol;

    src.connect(gain);
    gain.connect(c.destination);
    src.start();
}
