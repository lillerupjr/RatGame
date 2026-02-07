// src/game/map/jsonMapLoader.ts
import type { TableMapCell, TableMapDef } from "../table/tableMapTypes";

type JsonMapCell = {
  x: number;
  y: number;
  t: string;
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

    return { x, y, t };
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

  const jsonDef: JsonMapDef = {
    id,
    width,
    height,
    cells,
    defaultFloorSkin,
    defaultSpawnSkin,
    centerOnZero,
    metadata: data.metadata,
  };

  return {
    id: jsonDef.id,
    w: jsonDef.width,
    h: jsonDef.height,
    defaultFloorSkin: jsonDef.defaultFloorSkin,
    defaultSpawnSkin: jsonDef.defaultSpawnSkin,
    centerOnZero: jsonDef.centerOnZero,
    cells: jsonDef.cells,
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
