import type { FloorIntent } from "./floorIntent";

export type MapSource =
  | { type: "PROCEDURAL_ROOMS" }
  | { type: "PROCEDURAL_MAZE" }
  | { type: "AUTHORED_JSON"; mapId: string };

export function mapSourceFromFloorIntent(intent: FloorIntent): MapSource {
  if (intent.mapId) {
    return { type: "AUTHORED_JSON", mapId: intent.mapId };
  }
  switch (intent.archetype) {
    case "VENDOR":
      return { type: "AUTHORED_JSON", mapId: "SHOP" };
    case "HEAL":
      return { type: "AUTHORED_JSON", mapId: "REST" };
    case "SURVIVE":
      return { type: "PROCEDURAL_ROOMS" };
    case "TIME_TRIAL":
      return { type: "PROCEDURAL_ROOMS" };
    case "BOSS_TRIPLE":
      return { type: "PROCEDURAL_ROOMS" };
  }
}
