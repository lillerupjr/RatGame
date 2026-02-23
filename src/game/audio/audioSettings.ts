import {
  setMusicVolume as setMusicEngineVolume,
  setMusicMuted as setMusicEngineMuted,
} from "../../engine/audio/music";

export interface AudioSettings {
  musicVolume: number;
  musicMuted: boolean;
  sfxVolume: number;
  sfxMuted: boolean;
}

const settings: AudioSettings = {
  musicVolume: 0.6,
  musicMuted: false,
  sfxVolume: 1,
  sfxMuted: true,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function applyMusic(): void {
  setMusicEngineVolume(settings.musicVolume);
  setMusicEngineMuted(settings.musicMuted);
}

export function getAudioSettings(): AudioSettings {
  return { ...settings };
}

export function setMusicVolumeLevel(v: number): void {
  settings.musicVolume = clamp01(v);
  applyMusic();
}

export function setMusicVolume(v: number): void {
  setMusicVolumeLevel(v);
}

export function setMusicMutedState(m: boolean): void {
  settings.musicMuted = !!m;
  applyMusic();
}

export function setMusicMuted(m: boolean): void {
  setMusicMutedState(m);
}

export function setSfxVolumeLevel(v: number): void {
  settings.sfxVolume = clamp01(v);
}

export function setSfxVolume(v: number): void {
  setSfxVolumeLevel(v);
}

export function setSfxMutedState(m: boolean): void {
  settings.sfxMuted = !!m;
}

export function setSfxMuted(m: boolean): void {
  setSfxMutedState(m);
}

export function applySfxSettingsToWorld(world: unknown): void {
  if (!world || typeof world !== "object") return;
  const anyWorld = world as any;
  anyWorld.sfxMaster = settings.sfxMuted ? 0 : settings.sfxVolume;
}

export function resetAudioSettingsForTests(): void {
  settings.musicVolume = 0.6;
  settings.musicMuted = false;
  settings.sfxVolume = 1;
  settings.sfxMuted = true;
  applyMusic();
}
