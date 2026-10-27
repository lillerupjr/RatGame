// Auto-generated registry of authored JSON maps (semantic + legacy).
// @system   map-compilation/activation/floor-topology
// @owns     build eager authored JSON map registry, id lookup helpers, and the structure-stripped def view
// @doc      docs/canonical/map_compilation_activation_floor_topology.md
// @agents   no JSON schema parsing or map activation; see jsonMapLoader.ts and authoredMapActivation.ts

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

const DEFS_WITHOUT_STRUCTURES = new WeakMap<TableMapDef, TableMapDef>();

/** Returns the map def with every `building` stamp removed; the underlying fields stay. */
export function withoutStructureStamps(def: TableMapDef): TableMapDef {
  if (!def.stamps || !def.stamps.some((stamp) => stamp.type === "building")) return def;
  let stripped = DEFS_WITHOUT_STRUCTURES.get(def);
  if (!stripped) {
    stripped = { ...def, stamps: def.stamps.filter((stamp) => stamp.type !== "building") };
    DEFS_WITHOUT_STRUCTURES.set(def, stripped);
  }
  return stripped;
}

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
