export type CacheMetricKind = "asset" | "derived" | "scene" | "debug" | "unknown";
export type CacheMetricStatus = "stable" | "growing" | "warning" | "unknown";

export type CacheMetricSample = {
  name: string;
  kind: CacheMetricKind;
  entryCount: number;
  approxBytes: number | null;
  hits: number;
  misses: number;
  inserts: number;
  evictions: number;
  clears: number;
  bounded: boolean;
  hasEviction: boolean;
  status: CacheMetricStatus;
  contextKey?: string;
  generation?: number;
  notes?: string;
  budgetBytes?: number;
};

export type CacheMetricsSnapshot = {
  caches: CacheMetricSample[];
  totalEntries: number;
  totalKnownBytes: number;
  totalHits: number;
  totalMisses: number;
  totalInserts: number;
  totalEvictions: number;
  totalClears: number;
  totalBudgetBytes: number;
};

export type RawCacheMetricSample = Omit<CacheMetricSample, "status">;

type RegisteredCacheMetricSource = {
  name: string;
  budgetBytes?: number;
  budgetEntries?: number;
  sample: () => RawCacheMetricSample;
};

type PreviousMetricState = {
  approxBytes: number | null;
  entryCount: number;
  growthStreak: number;
};

const DEFAULT_GROWTH_ABS_BYTES = 64 * 1024;

function isMaterialByteGrowth(prev: number, next: number): boolean {
  const delta = next - prev;
  return delta > Math.max(DEFAULT_GROWTH_ABS_BYTES, prev * 0.05);
}

function isMaterialEntryGrowth(prev: number, next: number): boolean {
  const delta = next - prev;
  return delta > Math.max(10, prev * 0.05);
}

export function estimateCanvasLikeBytes(value: unknown): number | null {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return null;
  const width = Number((value as { width?: number }).width);
  const height = Number((value as { height?: number }).height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return Math.ceil(width) * Math.ceil(height) * 4;
}

export class CacheMetricsRegistry {
  private readonly sources = new Map<string, RegisteredCacheMetricSource>();
  private readonly previousByName = new Map<string, PreviousMetricState>();

  register(source: RegisteredCacheMetricSource): void {
    this.sources.set(source.name, source);
  }

  clearForTests(): void {
    this.sources.clear();
    this.previousByName.clear();
  }

  sample(): CacheMetricsSnapshot {
    const caches: CacheMetricSample[] = [];
    let totalEntries = 0;
    let totalKnownBytes = 0;
    let totalHits = 0;
    let totalMisses = 0;
    let totalInserts = 0;
    let totalEvictions = 0;
    let totalClears = 0;
    let totalBudgetBytes = 0;

    for (const source of this.sources.values()) {
      const raw = source.sample();
      const previous = this.previousByName.get(source.name);
      let growthStreak = 0;
      let growing = false;

      if (previous) {
        if (raw.approxBytes != null && previous.approxBytes != null) {
          growing = isMaterialByteGrowth(previous.approxBytes, raw.approxBytes);
        } else {
          growing = isMaterialEntryGrowth(previous.entryCount, raw.entryCount);
        }
        growthStreak = growing ? previous.growthStreak + 1 : 0;
      }

      let status: CacheMetricStatus = "stable";
      if (source.budgetBytes != null && raw.approxBytes != null && raw.approxBytes > source.budgetBytes) {
        status = "warning";
      } else if (source.budgetEntries != null && raw.entryCount > source.budgetEntries) {
        status = "warning";
      } else if (!raw.bounded && growthStreak >= 2 && (raw.approxBytes != null || raw.entryCount > 0)) {
        status = "warning";
      } else if (growing) {
        status = "growing";
      } else if (raw.approxBytes == null && !raw.bounded && !raw.hasEviction && raw.entryCount > 0) {
        status = "unknown";
      }

      const sampled: CacheMetricSample = {
        ...raw,
        status,
        budgetBytes: source.budgetBytes,
      };
      caches.push(sampled);
      this.previousByName.set(source.name, {
        approxBytes: raw.approxBytes,
        entryCount: raw.entryCount,
        growthStreak,
      });
      totalEntries += raw.entryCount;
      totalKnownBytes += raw.approxBytes ?? 0;
      totalHits += raw.hits;
      totalMisses += raw.misses;
      totalInserts += raw.inserts;
      totalEvictions += raw.evictions;
      totalClears += raw.clears;
      totalBudgetBytes += source.budgetBytes ?? 0;
    }

    return {
      caches,
      totalEntries,
      totalKnownBytes,
      totalHits,
      totalMisses,
      totalInserts,
      totalEvictions,
      totalClears,
      totalBudgetBytes,
    };
  }
}

const globalRegistry = new CacheMetricsRegistry();

export function registerCacheMetricSource(input: RegisteredCacheMetricSource): void {
  globalRegistry.register(input);
}

export function sampleCacheMetricsRegistry(): CacheMetricsSnapshot {
  return globalRegistry.sample();
}

export function resetCacheMetricsRegistryForTests(): void {
  globalRegistry.clearForTests();
}
