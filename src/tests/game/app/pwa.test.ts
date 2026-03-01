import { afterEach, describe, expect, test } from "vitest";
import { isStandalonePwa } from "../../../game/app/pwa";

const previousWindow = (globalThis as any).window;

afterEach(() => {
  if (previousWindow === undefined) {
    delete (globalThis as any).window;
  } else {
    (globalThis as any).window = previousWindow;
  }
});

describe("isStandalonePwa", () => {
  test("returns true when iOS standalone flag is true", () => {
    (globalThis as any).window = {
      navigator: { standalone: true },
      matchMedia: () => ({ matches: false }),
    };

    expect(isStandalonePwa()).toBe(true);
  });

  test("returns true when display-mode standalone matches", () => {
    (globalThis as any).window = {
      navigator: { standalone: false },
      matchMedia: () => ({ matches: true }),
    };

    expect(isStandalonePwa()).toBe(true);
  });

  test("returns false when both checks are false", () => {
    (globalThis as any).window = {
      navigator: { standalone: false },
      matchMedia: () => ({ matches: false }),
    };

    expect(isStandalonePwa()).toBe(false);
  });
});
