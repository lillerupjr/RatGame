import { getRuntimeDecalSprite, getTileSpriteById } from "../../../engine/render/sprites/renderSprites";
import type { RuntimeDecalSetId } from "../../content/runtimeDecalConfig";
import type { DecalPiece } from "../../map/compile/kenneyMap";
import { roadMarkingDecalScale } from "../../roads/roadMarkingRender";
import type { RawCacheMetricSample } from "./cacheMetricsRegistry";
import { buildAtlasPages } from "./atlasPageBuilder";
import { getDiamondFitCanvas, getRuntimeIsoDecalCanvas } from "./presentationImageTransforms";
import { buildUniqueStaticStructureSpriteIds } from "./staticStructureSpriteInventory";

type StaticAtlasRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export type StaticAtlasFrame = StaticAtlasRect & {
  image: HTMLCanvasElement;
};

export type StaticAtlasProjectedDecalLookup = {
  setId: RuntimeDecalSetId;
  variantIndex: number;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
  scale: number;
};

type StaticAtlasSyncInput = {
  compiledMap: {
    id: string;
    originTx: number;
    originTy: number;
    width: number;
    height: number;
    decals: readonly DecalPiece[];
  };
  paletteVariantKey: string;
  includeSpriteSources?: boolean;
  includeProjectedDecals?: boolean;
};

type ReadyStaticAtlasSource = {
  sourceKey: string;
  image: HTMLImageElement | HTMLCanvasElement;
};

function buildContextKey(input: StaticAtlasSyncInput): string {
  return `map:${input.compiledMap.id}||palv:${input.paletteVariantKey}||sprites:${input.includeSpriteSources !== false ? 1 : 0}||decals:${input.includeProjectedDecals !== false ? 1 : 0}`;
}

function spriteSourceKey(spriteId: string): string {
  return `sprite:${spriteId}`;
}

function normalizeScaleKey(scale: number): string {
  if (!Number.isFinite(scale)) return "1";
  return (Math.round(scale * 1000) / 1000).toFixed(3);
}

function projectedDecalSourceKey(input: StaticAtlasProjectedDecalLookup): string {
  return `decal:${input.setId}|${input.variantIndex}|${input.rotationQuarterTurns}|${normalizeScaleKey(input.scale)}`;
}

function buildUniqueProjectedDecalLookups(
  compiledMap: StaticAtlasSyncInput["compiledMap"],
): StaticAtlasProjectedDecalLookup[] {
  const byKey = new Map<string, StaticAtlasProjectedDecalLookup>();
  for (let i = 0; i < compiledMap.decals.length; i++) {
    const decal = compiledMap.decals[i];
    const lookup: StaticAtlasProjectedDecalLookup = {
      setId: decal.setId,
      variantIndex: decal.variantIndex,
      rotationQuarterTurns: decal.rotationQuarterTurns,
      scale: roadMarkingDecalScale(decal.setId, decal.variantIndex),
    };
    byKey.set(projectedDecalSourceKey(lookup), lookup);
  }
  return Array.from(byKey.values()).sort((a, b) => (
    projectedDecalSourceKey(a).localeCompare(projectedDecalSourceKey(b))
  ));
}

export class StaticAtlasStore {
  private contextKey = "";
  private pageCanvases: HTMLCanvasElement[] = [];
  private frameBySourceKey = new Map<string, StaticAtlasFrame>();
  private pendingSourceKeys = new Set<string>();
  private fallbackSourceKeys = new Set<string>();
  private allSpriteIds: string[] = [];
  private allDecalLookups: StaticAtlasProjectedDecalLookup[] = [];
  private hitCount = 0;
  private missCount = 0;
  private insertCount = 0;
  private clearCount = 0;
  private generationValue = 0;

  get generation(): number {
    return this.generationValue;
  }

  getPageCount(): number {
    return this.pageCanvases.length;
  }

  sync(input: StaticAtlasSyncInput): void {
    const nextContextKey = buildContextKey(input);
    if (nextContextKey !== this.contextKey) {
      if (this.contextKey || this.pageCanvases.length > 0 || this.frameBySourceKey.size > 0) {
        this.clearCount += 1;
      }
      this.contextKey = nextContextKey;
      this.allSpriteIds = input.includeSpriteSources === false
        ? []
        : buildUniqueStaticStructureSpriteIds(input.compiledMap);
      this.allDecalLookups = input.includeProjectedDecals === false
        ? []
        : buildUniqueProjectedDecalLookups(input.compiledMap);
      this.rebuildFromCurrentSources();
      return;
    }

    if (this.pendingSourceKeys.size <= 0) return;
    let needsRebuild = false;
    for (const sourceKey of this.pendingSourceKeys) {
      if (sourceKey.startsWith("sprite:")) {
        const spriteId = sourceKey.slice("sprite:".length);
        const rec = getTileSpriteById(spriteId);
        if (rec?.ready || rec?.failed || rec?.unsupported) {
          needsRebuild = true;
          break;
        }
        continue;
      }

      if (!sourceKey.startsWith("decal:")) continue;
      const lookup = this.allDecalLookups.find((item) => projectedDecalSourceKey(item) === sourceKey) ?? null;
      if (!lookup) continue;
      const rec = getRuntimeDecalSprite(lookup.setId, lookup.variantIndex);
      if (rec?.ready || rec?.failed || rec?.unsupported) {
        needsRebuild = true;
        break;
      }
    }
    if (needsRebuild) this.rebuildFromCurrentSources();
  }

  getSpriteFrame(spriteId: string): StaticAtlasFrame | null {
    return this.getFrame(spriteSourceKey(spriteId));
  }

  getProjectedDecalFrame(input: StaticAtlasProjectedDecalLookup): StaticAtlasFrame | null {
    return this.getFrame(projectedDecalSourceKey(input));
  }

  clear(): void {
    this.pageCanvases = [];
    this.frameBySourceKey.clear();
    this.pendingSourceKeys.clear();
    this.fallbackSourceKeys.clear();
    this.allSpriteIds = [];
    this.allDecalLookups = [];
    this.clearCount += 1;
    this.generationValue += 1;
  }

  getDebugCacheMetrics(): RawCacheMetricSample {
    const approxBytes = this.pageCanvases.reduce((total, canvas) => (
      total + canvas.width * canvas.height * 4
    ), 0);
    return {
      name: "staticAtlas",
      kind: "derived",
      entryCount: this.frameBySourceKey.size,
      approxBytes,
      hits: this.hitCount,
      misses: this.missCount,
      inserts: this.insertCount,
      evictions: 0,
      clears: this.clearCount,
      bounded: true,
      hasEviction: false,
      contextKey: this.contextKey,
      generation: this.generationValue,
      notes: `pages:${this.pageCanvases.length} pending:${this.pendingSourceKeys.size} fallback:${this.fallbackSourceKeys.size} sprites:${this.allSpriteIds.length} decals:${this.allDecalLookups.length}`,
    };
  }

  private getFrame(sourceKey: string): StaticAtlasFrame | null {
    const frame = this.frameBySourceKey.get(sourceKey) ?? null;
    if (!frame) {
      this.missCount += 1;
      return null;
    }
    this.hitCount += 1;
    return frame;
  }

  private rebuildFromCurrentSources(): void {
    const readySources: ReadyStaticAtlasSource[] = [];
    const nextPending = new Set<string>();
    const nextFallback = new Set<string>();

    for (let i = 0; i < this.allSpriteIds.length; i++) {
      const spriteId = this.allSpriteIds[i];
      const sourceKey = spriteSourceKey(spriteId);
      const rec = getTileSpriteById(spriteId);
      if (rec?.ready && rec.img && rec.img.width > 0 && rec.img.height > 0) {
        readySources.push({
          sourceKey,
          image: rec.img,
        });
        continue;
      }
      if (rec && !rec.ready && !rec.failed && !rec.unsupported) nextPending.add(sourceKey);
      else nextFallback.add(sourceKey);
    }

    for (let i = 0; i < this.allDecalLookups.length; i++) {
      const lookup = this.allDecalLookups[i];
      const sourceKey = projectedDecalSourceKey(lookup);
      const rec = getRuntimeDecalSprite(lookup.setId, lookup.variantIndex);
      if (!rec?.ready || !rec.img || rec.img.width <= 0 || rec.img.height <= 0) {
        if (rec && !rec.ready && !rec.failed && !rec.unsupported) nextPending.add(sourceKey);
        else nextFallback.add(sourceKey);
        continue;
      }
      const baked = getRuntimeIsoDecalCanvas(rec.img, lookup.rotationQuarterTurns, lookup.scale);
      if (!baked || baked.width <= 0 || baked.height <= 0) {
        nextFallback.add(sourceKey);
        continue;
      }
      const diamond = getDiamondFitCanvas(baked);
      if (!diamond || diamond.width <= 0 || diamond.height <= 0) {
        nextFallback.add(sourceKey);
        continue;
      }
      readySources.push({
        sourceKey,
        image: diamond,
      });
    }

    const nextPages = this.buildPageCanvases(readySources);
    const previousHadAtlas = this.pageCanvases.length > 0;
    this.pageCanvases = nextPages.pageCanvases;
    this.frameBySourceKey = nextPages.frameBySourceKey;
    this.pendingSourceKeys = nextPending;
    this.fallbackSourceKeys = nextFallback;
    if (previousHadAtlas || this.pageCanvases.length > 0 || this.clearCount === 0) {
      this.insertCount += this.frameBySourceKey.size;
      this.generationValue += 1;
    }
  }

  private buildPageCanvases(sources: readonly ReadyStaticAtlasSource[]): {
    pageCanvases: HTMLCanvasElement[];
    frameBySourceKey: Map<string, StaticAtlasFrame>;
  } {
    const { pageCanvases, frameBySourceKey } = buildAtlasPages(sources, "staticAtlas");
    return {
      pageCanvases,
      frameBySourceKey: frameBySourceKey as Map<string, StaticAtlasFrame>,
    };
  }
}
