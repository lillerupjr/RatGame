export const SEM_FIELD_VOID = "VOID" as const;
export const SEM_FIELD_FLOOR = "FLOOR" as const;
export const SEM_FIELD_STAIRS = "STAIRS" as const;
export const SEM_FIELD_SPAWN = "SPAWN" as const;
export const SEM_FIELD_GOAL = "GOAL" as const;
export const SEM_FIELD_WATER = "WATER" as const;

export const TILE_ID_OCEAN = "OCEAN" as const;

export type SemanticFieldId =
  | typeof SEM_FIELD_VOID
  | typeof SEM_FIELD_FLOOR
  | typeof SEM_FIELD_STAIRS
  | typeof SEM_FIELD_SPAWN
  | typeof SEM_FIELD_GOAL
  | typeof SEM_FIELD_WATER;

export type SemanticFieldDef = {
  id: SemanticFieldId;
  isWalkable: boolean;
  isLiquid: boolean;
  blocksPlacement?: boolean;
  slowsMovement?: boolean;
  isWater?: boolean;
};

export const SEMANTIC_FIELD_DEFS: Record<SemanticFieldId, SemanticFieldDef> = {
  VOID: {
    id: SEM_FIELD_VOID,
    isWalkable: false,
    isLiquid: false,
    blocksPlacement: true,
  },
  FLOOR: {
    id: SEM_FIELD_FLOOR,
    isWalkable: true,
    isLiquid: false,
  },
  STAIRS: {
    id: SEM_FIELD_STAIRS,
    isWalkable: true,
    isLiquid: false,
  },
  SPAWN: {
    id: SEM_FIELD_SPAWN,
    isWalkable: true,
    isLiquid: false,
  },
  GOAL: {
    id: SEM_FIELD_GOAL,
    isWalkable: true,
    isLiquid: false,
  },
  WATER: {
    id: SEM_FIELD_WATER,
    isWalkable: false,
    isLiquid: true,
    isWater: true,
    blocksPlacement: true,
    slowsMovement: false,
  },
};

const TILE_TO_FIELD: Record<string, SemanticFieldId> = {
  VOID: SEM_FIELD_VOID,
  FLOOR: SEM_FIELD_FLOOR,
  STAIRS: SEM_FIELD_STAIRS,
  SPAWN: SEM_FIELD_SPAWN,
  GOAL: SEM_FIELD_GOAL,
  [TILE_ID_OCEAN]: SEM_FIELD_WATER,
  WATER: SEM_FIELD_WATER,
};

export function tileIdToSemanticFieldId(tileId: string): SemanticFieldId {
  return TILE_TO_FIELD[tileId] ?? SEM_FIELD_FLOOR;
}

export function getSemanticFieldDef(fieldId: SemanticFieldId): SemanticFieldDef {
  return SEMANTIC_FIELD_DEFS[fieldId];
}

export function getSemanticFieldDefForTileId(tileId: string): SemanticFieldDef {
  return getSemanticFieldDef(tileIdToSemanticFieldId(tileId));
}

export function isTileIdWalkable(tileId: string): boolean {
  return getSemanticFieldDefForTileId(tileId).isWalkable;
}

export function isTileIdLiquid(tileId: string): boolean {
  return getSemanticFieldDefForTileId(tileId).isLiquid;
}
