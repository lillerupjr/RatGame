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
