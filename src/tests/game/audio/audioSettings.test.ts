import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../engine/audio/music", () => ({
  setMusicVolume: vi.fn(),
  setMusicMuted: vi.fn(),
}));

import {
  getAudioSettings,
  resetAudioSettingsForTests,
  setMusicMuted,
  setMusicVolume,
  setSfxMuted,
  setSfxVolume,
} from "../../../game/audio/audioSettings";
import * as musicModule from "../../../engine/audio/music";

describe("audioSettings", () => {
  beforeEach(() => {
    vi.mocked(musicModule.setMusicVolume).mockClear();
    vi.mocked(musicModule.setMusicMuted).mockClear();
    resetAudioSettingsForTests();
  });

  test("clamps music volume to [0,1]", () => {
    setMusicVolume(-1);
    expect(getAudioSettings().musicVolume).toBe(0);

    setMusicVolume(2);
    expect(getAudioSettings().musicVolume).toBe(1);
  });

  test("clamps sfx volume to [0,1]", () => {
    setSfxVolume(-1);
    expect(getAudioSettings().sfxVolume).toBe(0);

    setSfxVolume(2);
    expect(getAudioSettings().sfxVolume).toBe(1);
  });

  test("calls music module when music settings change", () => {
    setMusicVolume(0.33);
    setMusicMuted(true);

    expect(musicModule.setMusicVolume).toHaveBeenCalled();
    expect(musicModule.setMusicMuted).toHaveBeenCalledWith(true);
  });

  test("stores mute flags", () => {
    setMusicMuted(true);
    setSfxMuted(true);

    const settings = getAudioSettings();
    expect(settings.musicMuted).toBe(true);
    expect(settings.sfxMuted).toBe(true);
  });
});
