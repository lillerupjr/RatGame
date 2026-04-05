import { describe, expect, it } from "vitest";
import {
  PROJECTILE_PRESENTATION_BY_KIND,
  getProjectilePresentation,
  listProjectileTravelSpriteIds,
} from "../../../game/content/projectilePresentationRegistry";
import { PRJ_KIND } from "../../../game/factories/projectileFactory";

describe("projectilePresentationRegistry", () => {
  it("defines a presentation entry for every projectile kind", () => {
    const kinds = Object.values(PRJ_KIND);

    expect(Object.keys(PROJECTILE_PRESENTATION_BY_KIND)).toHaveLength(kinds.length);
    for (const kind of kinds) {
      expect(() => getProjectilePresentation(kind)).not.toThrow();
    }
  });

  it("maps spark and acid to animated projectile families", () => {
    expect(getProjectilePresentation(PRJ_KIND.SPARK)).toMatchObject({
      body: {
        mode: "animated",
        family: "lightning",
      },
    });
    expect(getProjectilePresentation(PRJ_KIND.ACID)).toMatchObject({
      body: {
        mode: "animated",
        family: "acid",
      },
    });
  });

  it("maps bazooka to a composite body plus animated exhaust attachment", () => {
    expect(getProjectilePresentation(PRJ_KIND.MISSILE)).toMatchObject({
      body: {
        mode: "static",
        spriteId: "projectiles/bazooka",
      },
      attachments: [
        {
          visual: {
            mode: "animated",
            family: "bazooka/exhaust_1",
          },
          offsetPx: { x: 0, y: 35 },
          scaleMult: 0.5,
          rotationOffsetRad: Math.PI * 0.5,
          alpha: 0.95,
          blendMode: "additive",
          renderLayer: "behindBody",
        },
      ],
    });
    expect(listProjectileTravelSpriteIds()).toContain("vfx/bazooka/exhaust_1/loop/loop_00");
  });
});
