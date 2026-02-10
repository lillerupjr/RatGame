// src/game/map/jsonMapLoader.ts
import type {
  ApronBaseMode,
  TableMapCell,
  TableMapDef,
  TableObjectiveDef,
  TableObjectiveRule,
  TableOutcomeDef,
} from "../table/tableMapTypes";
import type { MapSkinBundle, MapSkinId } from "../../../content/mapSkins";

type JsonMapCell = {
  x: number;
  y: number;
  t?: string;
  z?: number;
  type?: string;
  sprite?: string;
  blocksMove?: boolean;
  blocksSight?: boolean;
  meta?: Record<string, unknown>;
  tags?: string[];
  triggerId?: string;
  triggerType?: string;
  radius?: number;
};

type JsonMapDef = {
  id: string;
  width?: number;
  height?: number;
  cells?: JsonMapCell[];
  stamps?: {
    x: number;
    y: number;
    z?: number;
    type: string;
    w?: number;
    h?: number;
  }[];
  mapSkinId?: MapSkinId;
  defaultFloorSkin?: string;
  defaultSpawnSkin?: string;
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

    const x = requireNumberField(cell, "x", source);
    const y = requireNumberField(cell, "y", source);
    const t = optionalStringField(cell, "t");
    const type = optionalStringField(cell, "type");
    const sprite = optionalStringField(cell, "sprite");
    const z = optionalNumberField(cell, "z") ?? 0;
    const blocksMove = optionalBooleanField(cell, "blocksMove");
    const blocksSight = optionalBooleanField(cell, "blocksSight");
    const meta = (() => {
      const m = cell.meta;
      if (m === undefined) return undefined;
      if (!isRecord(m)) {
        throw new Error(`JSON map loader${formatSource(source)}: optional field "meta" must be an object.`);
      }
      return m;
    })();
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

    if (!t && (!type || !sprite)) {
      throw new Error(
        `JSON map loader${formatSource(source)}: cell ${index} must include legacy "t" or new "type" + "sprite".`
      );
    }
    const triggerId = optionalStringField(cell, "triggerId");
    const triggerType = optionalStringField(cell, "triggerType");
    const radius = optionalNumberField(cell, "radius");

    return {
      x,
      y,
      t: t ?? undefined,
      z,
      type: type ?? undefined,
      sprite: sprite ?? undefined,
      blocksMove,
      blocksSight,
      meta,
      tags,
      triggerId,
      triggerType,
      radius,
    };
  });
}

function optionalSemanticStamp(obj: Record<string, unknown>, source?: string) {
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
    const type = requireStringField(entry, "type", source);
    const z = optionalNumberField(entry, "z") ?? 0;
    const w = optionalNumberField(entry, "w");
    const h = optionalNumberField(entry, "h");
    return { x, y, z, type, w, h };
  });
}

export function loadTableMapDefFromJson(data: unknown, source?: string): TableMapDef {
  if (!isRecord(data)) {
    throw new Error(`JSON map loader${formatSource(source)}: root must be an object.`);
  }

  const id = requireStringField(data, "id", source);
  const width = optionalNumberField(data, "width");
  const height = optionalNumberField(data, "height");
  const cells = requireCellsField(data, source);
  const stamps = optionalSemanticStamp(data, source);

  const mapSkinId = optionalStringField(data, "mapSkinId");
  const defaultFloorSkin = optionalStringField(data, "defaultFloorSkin");
  const defaultSpawnSkin = optionalStringField(data, "defaultSpawnSkin");
  const mapSkinDefaults = optionalMapSkinDefaultsField(data, "mapSkinDefaults");
  const centerOnZero = optionalBooleanField(data, "centerOnZero");
  const apronBaseMode = optionalApronBaseModeField(data, "apronBaseMode");
  const objectiveDefs = parseObjectiveDefs(data, source);

  const jsonDef: JsonMapDef = {
    id,
    width,
    height,
    cells,
    stamps,
    mapSkinId,
    defaultFloorSkin,
    defaultSpawnSkin,
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
    defaultFloorSkin: jsonDef.defaultFloorSkin,
    defaultSpawnSkin: jsonDef.defaultSpawnSkin,
    mapSkinDefaults: jsonDef.mapSkinDefaults,
    centerOnZero: jsonDef.centerOnZero,
    apronBaseMode: jsonDef.apronBaseMode,
    cells: jsonDef.cells ?? [],
    stamps: jsonDef.stamps,
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
