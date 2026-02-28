import { describe, expect, test } from "vitest";
import { generateVendorCards } from "../../../game/vendor/generateVendorCards";

describe("generateVendorCards character visibility", () => {
  test("HOBO vendor cards exclude ignite cards", () => {
    for (let i = 0; i < 40; i++) {
      const out = generateVendorCards(8, "HOBO");
      expect(out.some((id) => id.includes("IGNITE"))).toBe(false);
    }
  });

  test("JOEY vendor cards exclude poison cards", () => {
    for (let i = 0; i < 40; i++) {
      const out = generateVendorCards(8, "JOEY");
      expect(out.some((id) => id.includes("POISON"))).toBe(false);
    }
  });
});
