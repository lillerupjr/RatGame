export const HEIGHT_UNIT_PX = 16;

export type BuildingSkinId = string;
export type BuildingPackId = string;

export type BuildingSkin = {
    id: BuildingSkinId;
    w: number;
    h: number;
    heightUnits: number;
    isFlippable: boolean;
    defaultFacing?: "E" | "S";
    flipMode?: "H";
    anchorLiftUnits: number;
    wallLiftUnits?: number;
    roofLiftUnits?: number;
    roofLiftPx?: number;
    spriteScale?: number;
    roof: string;
    wallSouth: string[];
    wallEast: string[];
};
