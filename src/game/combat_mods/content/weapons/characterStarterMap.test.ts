import { describe, expect, test } from "vitest";
import { resolveCombatStarterWeaponId } from "./characterStarterMap";

describe("resolveCombatStarterWeaponId", () => {
  test("maps JACK to pistol", () => {
    expect(resolveCombatStarterWeaponId("JACK")).toBe("JACK_PISTOL_V1");
  });

  test("maps JOEY to rifle", () => {
    expect(resolveCombatStarterWeaponId("JOEY")).toBe("JOEY_RIFLE_V1");
  });

  test("falls back to pistol for non-pilot characters", () => {
    expect(resolveCombatStarterWeaponId("HOBO")).toBe("JACK_PISTOL_V1");
    expect(resolveCombatStarterWeaponId("JAMAL")).toBe("JACK_PISTOL_V1");
    expect(resolveCombatStarterWeaponId("TOMMY")).toBe("TOMMY_SHOTGUN_V1");
  });

  test("falls back to pistol for unknown or missing ids", () => {
    expect(resolveCombatStarterWeaponId()).toBe("JACK_PISTOL_V1");
    expect(resolveCombatStarterWeaponId("UNKNOWN")).toBe("JACK_PISTOL_V1");
  });
});
