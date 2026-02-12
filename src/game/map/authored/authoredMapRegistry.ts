// Auto-generated registry of authored JSON maps (semantic + legacy).
import type { TableMapDef } from "../formats/table/tableMapTypes";
import { loadTableMapDefFromJson } from "../formats/json/jsonMapLoader";

const RAW_JSON_MAPS = import.meta.glob("./maps/jsonMaps/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

function buildAuthoredMaps(): TableMapDef[] {
  const defs: TableMapDef[] = [];
  for (const [path, json] of Object.entries(RAW_JSON_MAPS)) {
    const normalized = path.replace(/\\/g, "/");
    const name = normalized.split("/").pop() ?? "map.json";
    const source = `authored/maps/jsonMaps/${name}`;
    defs.push(loadTableMapDefFromJson(json, source));
  }
  defs.sort((a, b) => a.id.localeCompare(b.id));
  return defs;
}

export const AUTHORED_MAP_DEFS: TableMapDef[] = buildAuthoredMaps();

export function getAuthoredMapDefById(id: string): TableMapDef | undefined {
  return AUTHORED_MAP_DEFS.find((m) => m.id === id);
}

function normalizeMapId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const AUTHORED_MAP_DEF_BY_NORMALIZED = (() => {
  const map = new Map<string, TableMapDef>();
  for (const def of AUTHORED_MAP_DEFS) {
    map.set(normalizeMapId(def.id), def);
  }
  return map;
})();

export function getAuthoredMapDefByMapId(mapId: string): TableMapDef | undefined {
  if (!mapId) return undefined;
  return getAuthoredMapDefById(mapId) ?? AUTHORED_MAP_DEF_BY_NORMALIZED.get(normalizeMapId(mapId));
}
