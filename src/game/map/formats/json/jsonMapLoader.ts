// src/game/map/jsonMapLoader.ts
import type {
  ApronBaseMode,
  TableMapCell,
  TableMapDef,
  TableObjectiveDef,
  TableObjectiveRule,
  TableOutcomeDef,
  TableMapLight,
  SemanticStampType,
  SemanticStamp,
} from "../table/tableMapTypes";
import type { MapSkinBundle, MapSkinId } from "../../../content/mapSkins";
import type { BuildingPackId } from "../../../content/buildings";

const RAW_CHUNK_MAPS = import.meta.glob("../../authored/maps/jsonMaps/chunks/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

type ChunkSource = { json: Record<string, unknown>; path: string };

const CHUNK_REGISTRY: {
  byId: Map<string, ChunkSource>;
  pools: Map<string, ChunkSource[]>;
} = (() => {
  const byId = new Map<string, ChunkSource>();
  const pools = new Map<string, ChunkSource[]>();
  const addPool = (keyRaw: string, src: ChunkSource) => {
    const key = keyRaw.trim();
    if (!key) return;
    const list = pools.get(key);
    if (list) list.push(src);
    else pools.set(key, [src]);
  };

  for (const [path, value] of Object.entries(RAW_CHUNK_MAPS)) {
    if (!isRecord(value)) continue;
    const src: ChunkSource = { json: value, path };
    const id = value.id;
    if (typeof id === "string" && id.trim()) {
      byId.set(id.trim(), src);
      addPool(id.trim(), src);
      addPool(id.trim().toLowerCase(), src);
    }

    // Pool key by folder name: chunks/<folder>/*.json
    const normalized = path.replace(/\\/g, "/");
    const folderMatch = normalized.match(/\/chunks\/([^/]+)\/[^/]+\.json$/);
    if (folderMatch && folderMatch[1]) {
      addPool(folderMatch[1], src);
      addPool(folderMatch[1].toLowerCase(), src);
    }

    // Pool key by top-level file name: chunks/<name>.json
    const topLevelMatch = normalized.match(/\/chunks\/([^/]+)\.json$/);
    if (topLevelMatch && topLevelMatch[1]) {
      addPool(topLevelMatch[1], src);
      addPool(topLevelMatch[1].toLowerCase(), src);
    }
  }

  return { byId, pools };
})();
const CHUNK_SIZE = 24;

function pickChunkSource(chunkId: string): ChunkSource | null {
  const pool = CHUNK_REGISTRY.pools.get(chunkId) ?? CHUNK_REGISTRY.pools.get(chunkId.toLowerCase());
  if (pool && pool.length > 0) {
    // Keep random selection to avoid wiring each new chunk manually.
    const idx = Math.floor(Math.random() * pool.length);
    const candidate = pool[idx];
    // Avoid recursive chunk-grid chunk definitions as leaf chunks.
    if (!("chunkGrid" in candidate.json)) return candidate;
    const leafPool = pool.filter((p) => !("chunkGrid" in p.json));
    if (leafPool.length > 0) return leafPool[Math.floor(Math.random() * leafPool.length)];
  }

  const byId = CHUNK_REGISTRY.byId.get(chunkId) ?? CHUNK_REGISTRY.byId.get(chunkId.toLowerCase());
  if (byId && !("chunkGrid" in byId.json)) return byId;
  return byId ?? null;
}

type JsonMapCell = {
  x: number;
  y: number;
  z?: number;
  type?: string;
  sprite?: string;
  blocksMove?: boolean;
  blocksSight?: boolean;
  zone?: string;
  tags?: string[];
  triggerId?: string;
  triggerType?: string;
  radius?: number;
};

type JsonMapField = {
  x: number;
  y: number;
  w: number;
  h: number;

  z?: number;
  type?: string;
  sprite?: string;
  blocksMove?: boolean;
  blocksSight?: boolean;
  zone?: string;
  tags?: string[];
  triggerId?: string;
  triggerType?: string;
  radius?: number;
};

type JsonMapDef = {
  id: string;
  width?: number;
  height?: number;
  chunkGrid?: {
    id: string;
    cols: number;
    rows: number;
  };
  fields?: JsonMapField[];
  cells?: TableMapCell[];
  stamps?: {
    x: number;
    y: number;
    z?: number;
    zVisualOffsetUnits?: number;
    type: SemanticStampType;
    w?: number;
    h?: number;
    skinId?: string;
    pool?: string[];
    heightUnitsMin?: number;
    heightUnitsMax?: number;
    stackChance?: number;
    propId?: string;
    dir?: string;
    collision?: "BLOCK" | "PASS";
    blocksMovement?: boolean;
    flipped?: boolean;
    stackLevel?: number;
    zStackUnits?: number;
  }[];
  roadSemanticRects?: Array<{ x: number; y: number; w: number; h: number }>;
  lights?: TableMapLight[];
  mapSkinId?: MapSkinId;
  buildingPackId?: BuildingPackId;
  mapSkinDefaults?: MapSkinBundle;
  centerOnZero?: boolean;
  apronBaseMode?: ApronBaseMode;
  metadata?: unknown;
  objectiveDefs?: TableObjectiveDef[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatSource(source: string | undefined): string {
  return source ? ` (${source})` : "";
}

function requireStringField(
  obj: Record<string, unknown>,
  key: string,
  source?: string
): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(`JSON map loader${formatSource(source)}: missing string field "${key}".`);
  }
  return value;
}

function requireNumberField(
  obj: Record<string, unknown>,
  key: string,
  source?: string
): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`JSON map loader${formatSource(source)}: missing numeric field "${key}".`);
  }
  return value;
}

function optionalStringField(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`JSON map loader: optional field "${key}" must be a string.`);
  }
  return value;
}

function optionalBooleanField(obj: Record<string, unknown>, key: string): boolean | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`JSON map loader: optional field "${key}" must be a boolean.`);
  }
  return value;
}

function optionalDirField(obj: Record<string, unknown>, key: string): "N" | "E" | "S" | "W" | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`JSON map loader: optional field "${key}" must be a string.`);
  }
  const up = value.toUpperCase();
  if (up === "N" || up === "E" || up === "S" || up === "W") return up as "N" | "E" | "S" | "W";
  throw new Error(`JSON map loader: optional field "${key}" must be one of N/E/S/W.`);
}

function optionalNumberField(obj: Record<string, unknown>, key: string): number | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`JSON map loader: optional field "${key}" must be a number.`);
  }
  return value;
}

function optionalMapSkinDefaultsField(
  obj: Record<string, unknown>,
  key: string
): MapSkinBundle | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error(`JSON map loader: optional field "${key}" must be an object.`);
  }
  return {
    floor: optionalStringField(value, "floor"),
    apron: optionalStringField(value, "apron"),
    wall: optionalStringField(value, "wall"),
    stair: optionalStringField(value, "stair"),
    stairApron: optionalStringField(value, "stairApron"),
  };
}

function optionalApronBaseModeField(
  obj: Record<string, unknown>,
  key: string
): ApronBaseMode | undefined {
  const value = optionalStringField(obj, key);
  if (value === undefined) return undefined;
  if (value !== "PLATEAU" && value !== "ISLANDS") {
    throw new Error(`JSON map loader: optional field "${key}" must be "PLATEAU" or "ISLANDS".`);
  }
  return value;
}

function optionalChunkGridField(obj: Record<string, unknown>, source?: string): JsonMapDef["chunkGrid"] | undefined {
  const raw = obj.chunkGrid;
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    throw new Error(`JSON map loader${formatSource(source)}: "chunkGrid" must be an object.`);
  }
  const id = requireStringField(raw, "id", source);
  const cols = requireNumberField(raw, "cols", source);
  const rows = requireNumberField(raw, "rows", source);
  if (cols <= 0 || rows <= 0) {
    throw new Error(`JSON map loader${formatSource(source)}: "chunkGrid.cols/rows" must be > 0.`);
  }
  return { id, cols: cols | 0, rows: rows | 0 };
}

function requireArrayField(
  obj: Record<string, unknown>,
  key: string,
  source?: string
): unknown[] {
  const value = obj[key];
  if (!Array.isArray(value)) {
    throw new Error(`JSON map loader${formatSource(source)}: missing array field "${key}".`);
  }
  return value;
}

function requireStringArrayField(
  obj: Record<string, unknown>,
  key: string,
  source?: string
): string[] {
  const value = requireArrayField(obj, key, source);
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string") {
      throw new Error(`JSON map loader${formatSource(source)}: "${key}" must be an array of strings.`);
    }
  }
  return value as string[];
}

function optionalStringArrayField(
  obj: Record<string, unknown>,
  key: string,
  source?: string
): string[] | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`JSON map loader${formatSource(source)}: optional field "${key}" must be an array of strings.`);
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string") {
      throw new Error(`JSON map loader${formatSource(source)}: "${key}" must be an array of strings.`);
    }
  }
  return value as string[];
}

function parseObjectiveRule(
  data: Record<string, unknown>,
  source?: string
): TableObjectiveRule {
  const type = requireStringField(data, "type", source);
  if (type !== "SIGNAL_COUNT") {
    throw new Error(`JSON map loader${formatSource(source)}: unsupported objective rule "${type}".`);
  }
  const count = requireNumberField(data, "count", source);
  const signalType = optionalStringField(data, "signalType");
  if (signalType && !["ENTER", "EXIT", "KILL", "TICK", "INTERACT"].includes(signalType)) {
    throw new Error(`JSON map loader${formatSource(source)}: invalid signalType "${signalType}".`);
  }
  return {
    type: "SIGNAL_COUNT",
    count,
    signalType: signalType as TableObjectiveRule["signalType"],
  };
}

function parseOutcomeDef(
  data: Record<string, unknown>,
  source?: string
): TableOutcomeDef {
  const id = requireStringField(data, "id", source);
  const payload = data.payload;
  if (payload !== undefined && !isRecord(payload)) {
    throw new Error(`JSON map loader${formatSource(source)}: outcome payload must be an object.`);
  }
  return {
    id,
    payload: payload as Record<string, unknown> | undefined,
  };
}

function parseObjectiveDefs(
  obj: Record<string, unknown>,
  source?: string
): TableObjectiveDef[] | undefined {
  if (obj.objectiveDefs === undefined) return undefined;
  const entries = requireArrayField(obj, "objectiveDefs", source);
  return entries.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(
        `JSON map loader${formatSource(source)}: objectiveDefs[${index}] must be an object.`
      );
    }
    const id = requireStringField(entry, "id", source);
    const listensTo = requireStringArrayField(entry, "listensTo", source);
    const completionRuleRaw = entry.completionRule;
    if (!isRecord(completionRuleRaw)) {
      throw new Error(
        `JSON map loader${formatSource(source)}: objectiveDefs[${index}].completionRule must be an object.`
      );
    }
    const completionRule = parseObjectiveRule(completionRuleRaw, source);
    const outcomesRaw = requireArrayField(entry, "outcomes", source);
    const outcomes = outcomesRaw.map((outcome, outcomeIndex) => {
      if (!isRecord(outcome)) {
        throw new Error(
          `JSON map loader${formatSource(source)}: objectiveDefs[${index}].outcomes[${outcomeIndex}] must be an object.`
        );
      }
      return parseOutcomeDef(outcome, source);
    });
    return {
      id,
      listensTo,
      completionRule,
      outcomes,
    };
  });
}

function requireCellsField(
  obj: Record<string, unknown>,
  source?: string
): TableMapCell[] {
  const value = obj.cells;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`JSON map loader${formatSource(source)}: optional field "cells" must be an array if present.`);
  }

  return value.map((cell, index) => {
    if (!isRecord(cell)) {
      throw new Error(
        `JSON map loader${formatSource(source)}: cell ${index} must be an object.`
      );
    }

    if ("t" in cell) {
      throw new Error(`JSON map loader${formatSource(source)}: legacy token field "t" is forbidden. Use structured fields.`);
    }
    if ("meta" in cell) {
      throw new Error(`JSON map loader${formatSource(source)}: authored maps must not use "meta".`);
    }

    const x = requireNumberField(cell, "x", source);
    const y = requireNumberField(cell, "y", source);
    const type = optionalStringField(cell, "type");
    const sprite = optionalStringField(cell, "sprite");
    const z = optionalNumberField(cell, "z") ?? 0;
    const blocksMove = optionalBooleanField(cell, "blocksMove");
    const blocksSight = optionalBooleanField(cell, "blocksSight");
    const zone = optionalStringField(cell, "zone");
    const tags = (() => {
      const arr = cell.tags;
      if (arr === undefined) return undefined;
      if (!Array.isArray(arr)) {
        throw new Error(`JSON map loader${formatSource(source)}: optional field "tags" must be an array.`);
      }
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] !== "string") {
          throw new Error(`JSON map loader${formatSource(source)}: "tags" must be an array of strings.`);
        }
      }
      return arr as string[];
    })();

    const triggerId = optionalStringField(cell, "triggerId");
    const triggerType = optionalStringField(cell, "triggerType");
    const radius = optionalNumberField(cell, "radius");
    const dir = optionalDirField(cell, "dir");
    const height = optionalNumberField(cell, "height");

    const resolvedType = ((type ?? "floor").toLowerCase()) as TableMapCell["type"];
    const resolvedZ = z ?? 0;

    const parsed: TableMapCell = {
      x,
      y,
      z: resolvedZ,
      type: resolvedType,
      sprite: sprite ?? undefined,
      blocksMove,
      blocksSight,
      dir,
      height,
      zone: zone ?? undefined,
      tags,
      triggerId,
      triggerType,
      radius,
    };
    return parsed;
  });
}

function optionalFieldsField(
  obj: Record<string, unknown>,
  source?: string
): { cells: TableMapCell[]; stamps: SemanticStamp[]; roadRects: Array<{ x: number; y: number; w: number; h: number }> } {
  const value = obj.fields;
  if (value === undefined) return { cells: [], stamps: [], roadRects: [] };
  if (!Array.isArray(value)) {
    throw new Error(`JSON map loader${formatSource(source)}: optional field "fields" must be an array if present.`);
  }

  const out: TableMapCell[] = [];
  const stamps: SemanticStamp[] = [];
  const roadRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (let index = 0; index < value.length; index++) {
    const field = value[index];
    if (!isRecord(field)) {
      throw new Error(`JSON map loader${formatSource(source)}: fields[${index}] must be an object.`);
    }

    if ("t" in field) {
      throw new Error(`JSON map loader${formatSource(source)}: legacy token field "t" is forbidden. Use structured fields.`);
    }
    if ("meta" in field) {
      throw new Error(`JSON map loader${formatSource(source)}: authored maps must not use "meta".`);
    }

    const x0 = requireNumberField(field, "x", source);
    const y0 = requireNumberField(field, "y", source);
    const w = requireNumberField(field, "w", source);
    const h = requireNumberField(field, "h", source);

    const iw = Math.max(1, w | 0);
    const ih = Math.max(1, h | 0);

    const z = optionalNumberField(field, "z") ?? undefined;
    const type = optionalStringField(field, "type") ?? undefined;
    const sprite = optionalStringField(field, "sprite") ?? undefined;
    const blocksMove = optionalBooleanField(field, "blocksMove");
    const blocksSight = optionalBooleanField(field, "blocksSight");
    const zone = optionalStringField(field, "zone");

    const tags = (() => {
      const arr = field.tags;
      if (arr === undefined) return undefined;
      if (!Array.isArray(arr)) {
        throw new Error(`JSON map loader${formatSource(source)}: "tags" must be an array.`);
      }
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] !== "string") {
          throw new Error(`JSON map loader${formatSource(source)}: "tags" must be an array of strings.`);
        }
      }
      return arr as string[];
    })();

    const triggerId = optionalStringField(field, "triggerId") ?? undefined;
    const triggerType = optionalStringField(field, "triggerType") ?? undefined;
    const radius = optionalNumberField(field, "radius") ?? undefined;
    const dir = optionalDirField(field, "dir");
    const height = optionalNumberField(field, "height");
    const collisionRaw = optionalStringField(field, "collision");
    const collision = collisionRaw === undefined
      ? undefined
      : (() => {
          const up = collisionRaw.toUpperCase();
          if (up === "BLOCK" || up === "PASS") return up as "BLOCK" | "PASS";
          throw new Error(`JSON map loader${formatSource(source)}: fields[${index}].collision must be "BLOCK" or "PASS".`);
        })();
    const blocksMovement = optionalBooleanField(field, "blocksMovement");
    const flipped = optionalBooleanField(field, "flipped");
    const stackLevel = optionalNumberField(field, "stackLevel");
    const zStackUnits = optionalNumberField(field, "zStackUnits");
    const resolvedTypeRaw = (type ?? "floor").toLowerCase();
    const resolvedZ = z ?? 0;

    if (resolvedTypeRaw === "road") {
      roadRects.push({ x: x0, y: y0, w: iw, h: ih });
    }

    if (resolvedTypeRaw === "building") {
      stamps.push({
        x: x0,
        y: y0,
        z: resolvedZ,
        type: "building",
        w: iw,
        h: ih,
        collision,
        blocksMovement,
        flipped,
        stackLevel,
        zStackUnits,
      });
      continue;
    }
    const resolvedType = resolvedTypeRaw as TableMapCell["type"];

    for (let dy = 0; dy < ih; dy++) {
      for (let dx = 0; dx < iw; dx++) {
        const parsed: TableMapCell = {
          x: x0 + dx,
          y: y0 + dy,
          z: resolvedZ,
          type: resolvedType,
          sprite,
          blocksMove,
          blocksSight,
          dir,
          height,
          zone: zone ?? undefined,
          tags,
          triggerId,
          triggerType,
          radius,
        };
        out.push(parsed);
      }
    }
  }

  return { cells: out, stamps, roadRects };
}

function optionalSemanticStamp(obj: Record<string, unknown>, source?: string): SemanticStamp[] | undefined {
  const arr = obj.stamps;
  if (arr === undefined) return undefined;
  if (!Array.isArray(arr)) {
    throw new Error(`JSON map loader${formatSource(source)}: optional field "stamps" must be an array.`);
  }
  return arr.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`JSON map loader${formatSource(source)}: stamps[${index}] must be an object.`);
    }
    const x = requireNumberField(entry, "x", source);
    const y = requireNumberField(entry, "y", source);
    const typeRaw = requireStringField(entry, "type", source);
    const type: SemanticStampType = (() => {
      const lowered = typeRaw.toLowerCase();
      if (
        lowered === "building" ||
        lowered === "container" ||
        lowered === "prop" ||
        lowered === "road" ||
        lowered === "asphalt" ||
        lowered === "sidewalk" ||
        lowered === "park" ||
        lowered === "sea" ||
        lowered === "boss_room" ||
        lowered === "fence" ||
        lowered === "lamp_post"
      ) {
        return lowered as SemanticStampType;
      }
      throw new Error(
        `JSON map loader${formatSource(source)}: stamps[${index}].type must be one of building|container|prop|road|sidewalk|park|sea|boss_room|fence|lamp_post.`
      );
    })();
    const z = optionalNumberField(entry, "z") ?? 0;
    const zVisualOffsetUnits = optionalNumberField(entry, "zVisualOffsetUnits");
    const w = optionalNumberField(entry, "w");
    const h = optionalNumberField(entry, "h");
    const skinId = optionalStringField(entry, "skinId");
    const pool = optionalStringArrayField(entry, "pool", source);
    const heightUnitsMin = optionalNumberField(entry, "heightUnitsMin");
    const heightUnitsMax = optionalNumberField(entry, "heightUnitsMax");
    const stackChance = optionalNumberField(entry, "stackChance");
    const propId = optionalStringField(entry, "propId");
    const dir = optionalStringField(entry, "dir");
    const collisionRaw = optionalStringField(entry, "collision");
    const collision = collisionRaw === undefined
      ? undefined
      : (() => {
          const up = collisionRaw.toUpperCase();
          if (up === "BLOCK" || up === "PASS") return up as "BLOCK" | "PASS";
          throw new Error(
            `JSON map loader${formatSource(source)}: stamps[${index}].collision must be "BLOCK" or "PASS".`
          );
        })();
    const blocksMovement = optionalBooleanField(entry, "blocksMovement");
    const flipped = optionalBooleanField(entry, "flipped");
    const stackLevel = optionalNumberField(entry, "stackLevel");
    const zStackUnits = optionalNumberField(entry, "zStackUnits");
    return {
      x,
      y,
      z,
      zVisualOffsetUnits,
      type,
      w,
      h,
      skinId,
      pool,
      heightUnitsMin,
      heightUnitsMax,
      stackChance,
      propId,
      dir,
      collision,
      blocksMovement,
      flipped,
      stackLevel,
      zStackUnits,
    };
  });
}

function optionalMapLightsField(obj: Record<string, unknown>, source?: string): TableMapLight[] | undefined {
  const arr = obj.lights;
  if (arr === undefined) return undefined;
  if (!Array.isArray(arr)) {
    throw new Error(`JSON map loader${formatSource(source)}: optional field "lights" must be an array.`);
  }
  return arr.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`JSON map loader${formatSource(source)}: lights[${index}] must be an object.`);
    }
    const x = requireNumberField(entry, "x", source);
    const y = requireNumberField(entry, "y", source);
    const heightUnits = optionalNumberField(entry, "heightUnits");
    const poolHeightOffsetUnits = optionalNumberField(entry, "poolHeightOffsetUnits");
    const radiusPx = requireNumberField(entry, "radiusPx", source);
    const intensity = requireNumberField(entry, "intensity", source);
    const color = optionalStringField(entry, "color");
    const tintStrength = optionalNumberField(entry, "tintStrength");
    const shapeRaw = optionalStringField(entry, "shape");
    const shape = shapeRaw
      ? (() => {
          const up = shapeRaw.toUpperCase();
          if (up === "RADIAL" || up === "STREET_LAMP") return up as "RADIAL" | "STREET_LAMP";
          throw new Error(`JSON map loader${formatSource(source)}: lights[${index}].shape must be RADIAL or STREET_LAMP.`);
        })()
      : undefined;
    const semanticTypeRaw = optionalStringField(entry, "semanticType");
    const semanticType = semanticTypeRaw
      ? (() => {
          const low = semanticTypeRaw.toLowerCase();
          if (low === "street_lamp_n" || low === "street_lamp_e" || low === "street_lamp_s" || low === "street_lamp_w") {
            return low as "street_lamp_n" | "street_lamp_e" | "street_lamp_s" | "street_lamp_w";
          }
          if (low === "neon_sign_pink" || low === "neon_sign_blue" || low === "neon_sign_green") {
            return low as "neon_sign_pink" | "neon_sign_blue" | "neon_sign_green";
          }
          throw new Error(`JSON map loader${formatSource(source)}: lights[${index}].semanticType is invalid.`);
        })()
      : undefined;
    const pool = (() => {
      const raw = entry.pool;
      if (raw === undefined) return undefined;
      if (!isRecord(raw)) throw new Error(`JSON map loader${formatSource(source)}: lights[${index}].pool must be an object.`);
      return {
        radiusPx: requireNumberField(raw, "radiusPx", source),
        yScale: optionalNumberField(raw, "yScale"),
      };
    })();
    const cone = (() => {
      const raw = entry.cone;
      if (raw === undefined) return undefined;
      if (!isRecord(raw)) throw new Error(`JSON map loader${formatSource(source)}: lights[${index}].cone must be an object.`);
      return {
        dirRad: requireNumberField(raw, "dirRad", source),
        angleRad: requireNumberField(raw, "angleRad", source),
        lengthPx: requireNumberField(raw, "lengthPx", source),
      };
    })();
    const flicker = (() => {
      const raw = entry.flicker;
      if (raw === undefined) return undefined;
      if (!isRecord(raw)) throw new Error(`JSON map loader${formatSource(source)}: lights[${index}].flicker must be an object.`);
      const kindRaw = requireStringField(raw, "kind", source).toUpperCase();
      if (kindRaw === "NONE") return { kind: "NONE" as const };
      if (kindRaw === "NOISE") {
        return {
          kind: "NOISE" as const,
          speed: optionalNumberField(raw, "speed"),
          amount: optionalNumberField(raw, "amount"),
        };
      }
      if (kindRaw === "PULSE") {
        return {
          kind: "PULSE" as const,
          speed: optionalNumberField(raw, "speed"),
          amount: optionalNumberField(raw, "amount"),
        };
      }
      throw new Error(`JSON map loader${formatSource(source)}: lights[${index}].flicker.kind must be NONE|NOISE|PULSE.`);
    })();
    return {
      x,
      y,
      heightUnits,
      poolHeightOffsetUnits,
      radiusPx,
      intensity,
      color,
      tintStrength,
      shape,
      semanticType,
      flicker,
      pool,
      cone,
    };
  });
}

export function loadTableMapDefFromJson(data: unknown, source?: string): TableMapDef {
  if (!isRecord(data)) {
    throw new Error(`JSON map loader${formatSource(source)}: root must be an object.`);
  }

  const id = requireStringField(data, "id", source);
  const chunkGrid = optionalChunkGridField(data, source);
  const fieldParsed = optionalFieldsField(data, source);
  const fieldCells = fieldParsed.cells;
  const pointCells = requireCellsField(data, source);

  const merged: TableMapCell[] = [];
  const indexByKey = new Map<string, number>();

  const add = (c: TableMapCell) => {
    const key = `${c.x},${c.y}`;
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, merged.length);
      merged.push(c);
    } else {
      merged[existing] = c;
    }
  };

  const mapSkinId = optionalStringField(data, "mapSkinId") as MapSkinId | undefined;
  const buildingPackId = optionalStringField(data, "buildingPackId");
  const mapSkinDefaults = optionalMapSkinDefaultsField(data, "mapSkinDefaults");
  const centerOnZero = optionalBooleanField(data, "centerOnZero");
  const apronBaseMode = optionalApronBaseModeField(data, "apronBaseMode");
  const objectiveDefs = parseObjectiveDefs(data, source);
  const mapLights = optionalMapLightsField(data, source);

  if (chunkGrid) {
    const sampleChunkSource = pickChunkSource(chunkGrid.id);
    if (!sampleChunkSource) {
      throw new Error(
        `JSON map loader${formatSource(source)}: unknown chunk id "${chunkGrid.id}".`
      );
    }
    const expandedCells: TableMapCell[] = [];
    const expandedStamps: SemanticStamp[] = [];
    const expandedLights: TableMapLight[] = [];
    const expandedRoadRects: Array<{ x: number; y: number; w: number; h: number }> = [];

    for (let cy = 0; cy < chunkGrid.rows; cy++) {
      for (let cx = 0; cx < chunkGrid.cols; cx++) {
        const chunkSource = pickChunkSource(chunkGrid.id);
        if (!chunkSource) {
          throw new Error(
            `JSON map loader${formatSource(source)}: unknown chunk id "${chunkGrid.id}".`
          );
        }
        const chunkDef = loadTableMapDefFromJson(chunkSource.json, `chunk ${chunkGrid.id}`);
        if (chunkDef.w !== CHUNK_SIZE || chunkDef.h !== CHUNK_SIZE) {
          throw new Error(
            `JSON map loader${formatSource(source)}: chunk "${chunkGrid.id}" candidate "${chunkDef.id}" must be ${CHUNK_SIZE}x${CHUNK_SIZE}.`
          );
        }
        const ox = cx * chunkDef.w;
        const oy = cy * chunkDef.h;
        for (let i = 0; i < chunkDef.cells.length; i++) {
          const c = chunkDef.cells[i];
          expandedCells.push({ ...c, x: c.x + ox, y: c.y + oy });
        }
        if (chunkDef.stamps) {
          for (let i = 0; i < chunkDef.stamps.length; i++) {
            const s = chunkDef.stamps[i];
            expandedStamps.push({ ...s, x: s.x + ox, y: s.y + oy });
          }
        }
        if (chunkDef.lights) {
          for (let i = 0; i < chunkDef.lights.length; i++) {
            const l = chunkDef.lights[i];
            expandedLights.push({ ...l, x: l.x + ox, y: l.y + oy });
          }
        }
        if (chunkDef.roadSemanticRects) {
          for (let i = 0; i < chunkDef.roadSemanticRects.length; i++) {
            const r = chunkDef.roadSemanticRects[i];
            expandedRoadRects.push({ x: r.x + ox, y: r.y + oy, w: r.w, h: r.h });
          }
        }
      }
    }

    for (let i = 0; i < expandedCells.length; i++) add(expandedCells[i]);
    for (let i = 0; i < fieldCells.length; i++) add(fieldCells[i]);
    for (let i = 0; i < pointCells.length; i++) add(pointCells[i]);

    const stampsRaw = optionalSemanticStamp(data, source);
    const stamps = (() => {
      const merged = [...expandedStamps, ...fieldParsed.stamps, ...(stampsRaw ?? [])];
      return merged.length > 0 ? merged : undefined;
    })();
    const lights = (() => {
      const merged = [...expandedLights, ...(mapLights ?? [])];
      return merged.length > 0 ? merged : undefined;
    })();
    const roadRects = (() => {
      const stampRoadRects = (stamps ?? [])
        .filter((s) => s.type === "road")
        .map((s) => ({ x: s.x, y: s.y, w: Math.max(1, (s.w ?? 1) | 0), h: Math.max(1, (s.h ?? 1) | 0) }));
      const merged = [...expandedRoadRects, ...fieldParsed.roadRects, ...stampRoadRects];
      return merged.length > 0 ? merged : undefined;
    })();

    return {
      id,
      w: CHUNK_SIZE * chunkGrid.cols,
      h: CHUNK_SIZE * chunkGrid.rows,
      mapSkinId,
      buildingPackId,
      mapSkinDefaults,
      centerOnZero,
      apronBaseMode,
      cells: merged,
      stamps,
      roadSemanticRects: roadRects,
      lights,
      objectiveDefs,
    };
  }

  const width = optionalNumberField(data, "width");
  const height = optionalNumberField(data, "height");

  for (let i = 0; i < fieldCells.length; i++) add(fieldCells[i]);
  for (let i = 0; i < pointCells.length; i++) add(pointCells[i]);

  const cells = merged;
  const stampsRaw = optionalSemanticStamp(data, source);
  const stamps = (() => {
    const merged = [...fieldParsed.stamps, ...(stampsRaw ?? [])];
    return merged.length > 0 ? merged : undefined;
  })();
  const roadRects = (() => {
    const stampRoadRects = (stamps ?? [])
      .filter((s) => s.type === "road")
      .map((s) => ({ x: s.x, y: s.y, w: Math.max(1, (s.w ?? 1) | 0), h: Math.max(1, (s.h ?? 1) | 0) }));
    const merged = [...fieldParsed.roadRects, ...stampRoadRects];
    return merged.length > 0 ? merged : undefined;
  })();
  const lights = mapLights;

  const jsonDef: JsonMapDef = {
    id,
    width,
    height,
    cells,
    stamps,
    roadSemanticRects: roadRects,
    lights,
    mapSkinId,
    buildingPackId,
    mapSkinDefaults,
    centerOnZero,
    apronBaseMode,
    metadata: data.metadata,
    objectiveDefs,
  };

  // Derive bounds if width/height omitted using cells + stamps.
  const bounds = (() => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const consider = (x: number, y: number) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    for (let i = 0; i < cells.length; i++) {
      consider(cells[i].x, cells[i].y);
    }
    if (stamps) {
      for (let i = 0; i < stamps.length; i++) {
        const s = stamps[i];
        const w = Math.max(1, (s.w ?? 1) | 0);
        const h = Math.max(1, (s.h ?? 1) | 0);
        consider(s.x, s.y);
        consider(s.x + w - 1, s.y + h - 1);
      }
    }

    if (!Number.isFinite(minX)) return { w: 0, h: 0 };
    return { w: (maxX - minX + 1) | 0, h: (maxY - minY + 1) | 0 };
  })();

  return {
    id: jsonDef.id,
    w: (jsonDef.width ?? bounds.w) | 0,
    h: (jsonDef.height ?? bounds.h) | 0,
    mapSkinId: jsonDef.mapSkinId,
    buildingPackId: jsonDef.buildingPackId,
    mapSkinDefaults: jsonDef.mapSkinDefaults,
    centerOnZero: jsonDef.centerOnZero,
    apronBaseMode: jsonDef.apronBaseMode,
    cells: jsonDef.cells ?? [],
    stamps,
    roadSemanticRects: jsonDef.roadSemanticRects,
    lights: jsonDef.lights,
    objectiveDefs: jsonDef.objectiveDefs,
  };
}

export async function loadTableMapDefFromJsonUrl(url: string): Promise<TableMapDef> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`JSON map loader (URL ${url}): network error.`);
  }

  if (!response.ok) {
    throw new Error(`JSON map loader (URL ${url}): HTTP ${response.status}.`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`JSON map loader (URL ${url}): invalid JSON.`);
  }

  return loadTableMapDefFromJson(data, `URL ${url}`);
}
