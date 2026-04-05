import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectDynamicAtlasSources } from "../../../../game/systems/presentation/dynamicAtlasSources";
import * as renderSprites from "../../../../engine/render/sprites/renderSprites";
import * as currencyVisual from "../../../../game/content/loot/currencyVisual";
import * as playerSprites from "../../../../engine/render/sprites/playerSprites";
import * as enemySprites from "../../../../engine/render/sprites/enemySprites";
import * as bossSprites from "../../../../engine/render/sprites/bossSprites";
import * as vendorSprites from "../../../../engine/render/sprites/vendorSprites";
import * as neutralSprites from "../../../../engine/render/sprites/neutralSprites";
import * as vfxRegistry from "../../../../game/content/vfxRegistry";
import * as projectilePresentationRegistry from "../../../../game/content/projectilePresentationRegistry";

describe("collectDynamicAtlasSources", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("collects direct-frame and sprite-pack-frame inventories with pending and fallback classification", () => {
    const directImage = { width: 16, height: 16, id: "coin" } as any;
    const vfxImage = { width: 32, height: 32, id: "vfx" } as any;
    const playerImage = { width: 32, height: 48, id: "player" } as any;
    const enemyImage = { width: 48, height: 48, id: "enemy" } as any;

    vi.spyOn(currencyVisual, "listCurrencyDynamicAtlasSpriteIds").mockReturnValue(["loot/currency/coins/1/1_frame_01"]);
    vi.spyOn(projectilePresentationRegistry, "listProjectileTravelSpriteIds").mockReturnValue(["projectiles/knife"]);
    vi.spyOn(playerSprites, "listPlayerDynamicAtlasSpriteIds").mockReturnValue(["entities/player/jamal/rotations/south"]);
    vi.spyOn(enemySprites, "listEnemyDynamicAtlasSpriteIds").mockReturnValue(["entities/enemies/small_rat/rotations/south"]);
    vi.spyOn(bossSprites, "listBossDynamicAtlasSpriteIds").mockReturnValue(["entities/bosses/chem_guy/rotations/south"]);
    vi.spyOn(vendorSprites, "listVendorNpcDynamicAtlasSpriteIds").mockReturnValue(["entities/npc/vendor/breathing-idle/south/frame_000"]);
    vi.spyOn(neutralSprites, "listNeutralMobDynamicAtlasSpriteIds").mockReturnValue(["entities/animals/pigeon/rotations/east/frame_000"]);
    vi.spyOn(vfxRegistry, "listVfxSpriteIds").mockReturnValue(["vfx/explosion_1/1_frame_01"]);

    vi.spyOn(renderSprites, "getSpriteByIdForVariantKey").mockImplementation((spriteId: string) => {
      if (spriteId.startsWith("loot/")) return { ready: true, img: directImage } as any;
      if (spriteId.startsWith("projectiles/")) return { ready: true, img: { width: 12, height: 12, id: "knife" } as any } as any;
      if (spriteId.startsWith("vfx/")) return { ready: true, img: vfxImage } as any;
      if (spriteId.startsWith("entities/player/")) return { ready: true, img: playerImage } as any;
      if (spriteId.startsWith("entities/enemies/")) return { ready: true, img: enemyImage } as any;
      if (spriteId.startsWith("entities/bosses/")) return { ready: true, img: enemyImage } as any;
      if (spriteId.startsWith("entities/npc/vendor/")) return { ready: false, failed: false, unsupported: false } as any;
      if (spriteId.startsWith("entities/animals/pigeon/")) return { ready: false, failed: true, unsupported: false } as any;
      return null as any;
    });

    const snapshot = collectDynamicAtlasSources("db32@@sw:0@@dk:0");
    const readyKeys = snapshot.readySources.map((source) => source.sourceKey);

    expect(readyKeys).toContain("directFrame:loot/currency/coins/1/1_frame_01");
    expect(readyKeys).toContain("directFrame:projectiles/knife");
    expect(readyKeys).toContain("directFrame:vfx/explosion_1/1_frame_01");
    expect(readyKeys).toContain("spritePackFrame:entities/player/jamal/rotations/south");
    expect(readyKeys).toContain("spritePackFrame:entities/enemies/small_rat/rotations/south");
    expect(readyKeys).toContain("spritePackFrame:entities/bosses/chem_guy/rotations/south");
    expect(snapshot.pendingSourceKeys.has("directFrame:entities/npc/vendor/breathing-idle/south/frame_000")).toBe(true);
    expect(snapshot.fallbackSourceKeys.has("directFrame:entities/animals/pigeon/rotations/east/frame_000")).toBe(true);
  });
});
