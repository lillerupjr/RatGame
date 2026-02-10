export const HEIGHT_UNIT_PX = 16;

export type BuildingSkinId = string;
export type BuildingPackId = string;

export type BuildingSkin = {
    id: BuildingSkinId;
    w: number;
    h: number;
    heightUnits: number;
    anchorLiftUnits: number;
    wallLiftUnits?: number;
    roofLiftUnits?: number;
    roof: string;
    wallSouth: string[];
    wallEast: string[];
};

export const DEFAULT_BUILDING_PACK_ID: BuildingPackId = "default_buildings";

export const BUILDING_SKINS: Record<BuildingSkinId, BuildingSkin> = {
    building1: {
        id: "building1",
        w: 3,
        h: 2,
        heightUnits: 32,
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftUnits: -4,
        roof: "buildings/building1/top",
        wallSouth: [
            "buildings/building1/s_1",
            "buildings/building1/s_2",
            "buildings/building1/s_3",
        ],
        wallEast: [
            "buildings/building1/e_1",
            "buildings/building1/e_2",
        ],
    },
    building2: {
        id: "building2",
        w: 3,
        h: 2,
        heightUnits: 16,
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftUnits: -4,
        roof: "buildings/building2/top",
        wallSouth: [
            "buildings/building2/s_1",
            "buildings/building2/s_2",
            "buildings/building2/s_3",
        ],
        wallEast: [
            "buildings/building2/e_1",
            "buildings/building2/e_2",
        ],
    },
    building3: {
        id: "building3",
        w: 3,
        h: 2,
        heightUnits: 16,
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftUnits: -4,
        roof: "buildings/building3/top",
        wallSouth: [
            "buildings/building3/s_1",
            "buildings/building3/s_2",
            "buildings/building3/s_3",
        ],
        wallEast: [
            "buildings/building3/e_1",
            "buildings/building3/e_2",
        ],
    },
    building4: {
        id: "building4",
        w: 3,
        h: 2,
        heightUnits: 32,
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftUnits: -4,
        roof: "buildings/building4/top",
        wallSouth: [
            "buildings/building4/s_1",
            "buildings/building4/s_2",
            "buildings/building4/s_3",
        ],
        wallEast: [
            "buildings/building4/e_1",
            "buildings/building4/e_2",
        ],
    },
    building5: {
        id: "building5",
        w: 2,
        h: 3,
        heightUnits: 32,
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftUnits: -4,
        roof: "buildings/building5/top",
        wallSouth: [
            "buildings/building5/s_1",
            "buildings/building5/s_2",
            "buildings/building5/s_3",
        ],
        wallEast: [
            "buildings/building5/e_1",
            "buildings/building5/e_2",
        ],
    },

    building6: {
        id: "building6",
        w: 2,
        h: 3,
        heightUnits: 16,
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftUnits: -4,
        roof: "buildings/building6/top",
        wallSouth: [
            "buildings/building6/s_1",
            "buildings/building6/s_2",
            "buildings/building6/s_3",
        ],
        wallEast: [
            "buildings/building6/e_1",
            "buildings/building6/e_2",
        ],
    },

    building7: {
        id: "building7",
        w: 2,
        h: 3,
        heightUnits: 16,
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftUnits: -4,
        roof: "buildings/building7/top",
        wallSouth: [
            "buildings/building7/s_1",
            "buildings/building7/s_2",
            "buildings/building7/s_3",
        ],
        wallEast: [
            "buildings/building7/e_1",
            "buildings/building7/e_2",
        ],
    },

    building8: {
        id: "building8",
        w: 2,
        h: 3,
        heightUnits: 32,
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftUnits: -4,
        roof: "buildings/building8/top",
        wallSouth: [
            "buildings/building8/s_1",
            "buildings/building8/s_2",
            "buildings/building8/s_3",
        ],
        wallEast: [
            "buildings/building8/e_1",
            "buildings/building8/e_2",
        ],
    },


};

export const BUILDING_PACKS: Record<BuildingPackId, BuildingSkinId[]> = {
    [DEFAULT_BUILDING_PACK_ID]: ["building1", "building2", "building3", "building4", "building5", "building6", "building7", "building8"],
};

function hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
}

function requireBuildingSkin(id: BuildingSkinId, context: string): BuildingSkin {
    const skin = BUILDING_SKINS[id];
    if (!skin) {
        throw new Error(`Building selection: unknown BuildingSkin id "${id}" (${context}).`);
    }
    return skin;
}

function requireBuildingPack(id: BuildingPackId, context: string): BuildingSkinId[] {
    const pack = BUILDING_PACKS[id];
    if (!pack) {
        throw new Error(`Building selection: unknown BuildingPack id "${id}" (${context}).`);
    }
    return pack;
}

export type BuildingSelectionContext = {
    runSeed: number;
    mapId: string;
    stampIndex: number;
    stampX: number;
    stampY: number;
    stampW: number;
    stampH: number;
};

export type BuildingSelectionRequest = {
    skinId?: string;
    pool?: string[];
    heightUnitsMin?: number;
    heightUnitsMax?: number;
    mapSkinPool?: string[];
    context: BuildingSelectionContext;
};

export function pickBuildingSkin(request: BuildingSelectionRequest): BuildingSkin {
    const { skinId, pool, heightUnitsMin, heightUnitsMax, mapSkinPool, context } = request;

    if (skinId) {
        const forced = requireBuildingSkin(skinId, "forced skinId");
        if (forced.w !== context.stampW || forced.h !== context.stampH) {
            throw new Error(
                `Building selection: skin "${forced.id}" footprint ${forced.w}x${forced.h} does not match stamp ${context.stampW}x${context.stampH}.`
            );
        }
        return forced;
    }

    const poolIds = (() => {
        const cleaned = (pool ?? []).map((id) => id.trim()).filter(Boolean);
        if (cleaned.length > 0) return cleaned;
        const mapPool = (mapSkinPool ?? []).map((id) => id.trim()).filter(Boolean);
        if (mapPool.length > 0) return mapPool;
        return [DEFAULT_BUILDING_PACK_ID];
    })();

    const candidates = new Map<BuildingSkinId, BuildingSkin>();
    for (let i = 0; i < poolIds.length; i++) {
        const packId = poolIds[i];
        const pack = requireBuildingPack(packId, "pool resolution");
        for (let j = 0; j < pack.length; j++) {
            const skinIdFromPack = pack[j];
            const skin = requireBuildingSkin(skinIdFromPack, `pack "${packId}"`);
            candidates.set(skin.id, skin);
        }
    }

    const filtered = Array.from(candidates.values())
        .filter((skin) => skin.w === context.stampW && skin.h === context.stampH)
        .filter((skin) => heightUnitsMin === undefined || skin.heightUnits >= heightUnitsMin)
        .filter((skin) => heightUnitsMax === undefined || skin.heightUnits <= heightUnitsMax)
        .sort((a, b) => a.id.localeCompare(b.id));

    if (filtered.length === 0) {
        throw new Error(
            `Building selection: no candidates for stamp ${context.stampW}x${context.stampH} with pool [${poolIds.join(", ")}].`
        );
    }

    const key = `${context.runSeed}:${context.mapId}:${context.stampIndex}:${context.stampX},${context.stampY}:${context.stampW}x${context.stampH}`;
    let h = hashString(key);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    const idx = h % filtered.length;
    return filtered[idx] ?? filtered[0];
}
