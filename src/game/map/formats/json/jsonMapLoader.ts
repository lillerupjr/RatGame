// src/game/map/jsonMapLoader.ts
import type {
  TableMapCell,
  TableMapDef,
  TableObjectiveDef,
  TableObjectiveRule,
  TableOutcomeDef,
} from "../table/tableMapTypes";

type JsonMapCell = {
  x: number;
  y: number;
  t: string;
  triggerId?: string;
  triggerType?: string;
  radius?: number;
};

type JsonMapDef = {
  id: string;
  width: number;
  height: number;
  cells: JsonMapCell[];
  defaultFloorSkin?: string;
  defaultSpawnSkin?: string;
  centerOnZero?: boolean;
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
  if (!Array.isArray(value)) {
    throw new Error(`JSON map loader${formatSource(source)}: missing array field "cells".`);
  }

  return value.map((cell, index) => {
    if (!isRecord(cell)) {
      throw new Error(
        `JSON map loader${formatSource(source)}: cell ${index} must be an object.`
      );
    }

    const x = requireNumberField(cell, "x", source);
    const y = requireNumberField(cell, "y", source);
    const t = requireStringField(cell, "t", source);
    const triggerId = optionalStringField(cell, "triggerId");
    const triggerType = optionalStringField(cell, "triggerType");
    const radius = optionalNumberField(cell, "radius");

    return { x, y, t, triggerId, triggerType, radius };
  });
}

export function loadTableMapDefFromJson(data: unknown, source?: string): TableMapDef {
  if (!isRecord(data)) {
    throw new Error(`JSON map loader${formatSource(source)}: root must be an object.`);
  }

  const id = requireStringField(data, "id", source);
  const width = requireNumberField(data, "width", source);
  const height = requireNumberField(data, "height", source);
  const cells = requireCellsField(data, source);

  const defaultFloorSkin = optionalStringField(data, "defaultFloorSkin");
  const defaultSpawnSkin = optionalStringField(data, "defaultSpawnSkin");
  const centerOnZero = optionalBooleanField(data, "centerOnZero");
  const objectiveDefs = parseObjectiveDefs(data, source);

  const jsonDef: JsonMapDef = {
    id,
    width,
    height,
    cells,
    defaultFloorSkin,
    defaultSpawnSkin,
    centerOnZero,
    metadata: data.metadata,
    objectiveDefs,
  };

  return {
    id: jsonDef.id,
    w: jsonDef.width,
    h: jsonDef.height,
    defaultFloorSkin: jsonDef.defaultFloorSkin,
    defaultSpawnSkin: jsonDef.defaultSpawnSkin,
    centerOnZero: jsonDef.centerOnZero,
    cells: jsonDef.cells,
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
