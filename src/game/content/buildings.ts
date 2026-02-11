import { CONTAINER_PACKS, CONTAINER_SKINS } from "./containers";
import type { BuildingPackId, BuildingSkin, BuildingSkinId } from "./structureSkins";
import { HEIGHT_UNIT_PX } from "./structureSkins";

export { HEIGHT_UNIT_PX };

export type { BuildingPackId, BuildingSkin, BuildingSkinId } from "./structureSkins";

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
        roof: "structures/buildings/1/top",
        wallSouth: [
            "structures/buildings/1/s_1",
            "structures/buildings/1/s_2",
            "structures/buildings/1/s_3",
        ],
        wallEast: [
            "structures/buildings/1/e_1",
            "structures/buildings/1/e_2",
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
        roof: "structures/buildings/2/top",
        wallSouth: [
            "structures/buildings/2/s_1",
            "structures/buildings/2/s_2",
            "structures/buildings/2/s_3",
        ],
        wallEast: [
            "structures/buildings/2/e_1",
            "structures/buildings/2/e_2",
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
        roof: "structures/buildings/3/top",
        wallSouth: [
            "structures/buildings/3/s_1",
            "structures/buildings/3/s_2",
            "structures/buildings/3/s_3",
        ],
        wallEast: [
            "structures/buildings/3/e_1",
            "structures/buildings/3/e_2",
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
        roof: "structures/buildings/4/top",
        wallSouth: [
            "structures/buildings/4/s_1",
            "structures/buildings/4/s_2",
            "structures/buildings/4/s_3",
        ],
        wallEast: [
            "structures/buildings/4/e_1",
            "structures/buildings/4/e_2",
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
        roof: "structures/buildings/5/top",
        wallSouth: [
            "structures/buildings/5/s_1",
            "structures/buildings/5/s_2",
            "structures/buildings/5/s_3",
        ],
        wallEast: [
            "structures/buildings/5/e_1",
            "structures/buildings/5/e_2",
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
        roof: "structures/buildings/6/top",
        wallSouth: [
            "structures/buildings/6/s_1",
            "structures/buildings/6/s_2",
            "structures/buildings/6/s_3",
        ],
        wallEast: [
            "structures/buildings/6/e_1",
            "structures/buildings/6/e_2",
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
        roof: "structures/buildings/7/top",
        wallSouth: [
            "structures/buildings/7/s_1",
            "structures/buildings/7/s_2",
            "structures/buildings/7/s_3",
        ],
        wallEast: [
            "structures/buildings/7/e_1",
            "structures/buildings/7/e_2",
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
        roof: "structures/buildings/8/top",
        wallSouth: [
            "structures/buildings/8/s_1",
            "structures/buildings/8/s_2",
            "structures/buildings/8/s_3",
        ],
        wallEast: [
            "structures/buildings/8/e_1",
            "structures/buildings/8/e_2",
        ],
    },
};

export const BUILDING_PACKS: Record<BuildingPackId, BuildingSkinId[]> = {
    [DEFAULT_BUILDING_PACK_ID]: ["building1", "building2", "building3", "building4", "building5", "building6", "building7", "building8"],
};

const ALL_PACKS: Record<BuildingPackId, BuildingSkinId[]> = {
    ...BUILDING_PACKS,
    ...CONTAINER_PACKS,
};

const ALL_SKINS: Record<BuildingSkinId, BuildingSkin> = {
    ...BUILDING_SKINS,
    ...CONTAINER_SKINS,
};

function hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
}

function requireBuildingSkin(id: BuildingSkinId, context: string): BuildingSkin {
    const skin = ALL_SKINS[id];
    if (!skin) {
        throw new Error(`Building selection: unknown BuildingSkin id "${id}" (${context}).`);
    }
    return skin;
}

function requireBuildingPack(id: BuildingPackId, context: string): BuildingSkinId[] {
    const pack = ALL_PACKS[id];
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

export type BuildingCandidateRequest = {
    pool?: string[];
    heightUnitsMin?: number;
    heightUnitsMax?: number;
    mapSkinPool?: string[];
};

export function resolveBuildingCandidates(request: BuildingCandidateRequest): BuildingSkin[] {
    const { pool, heightUnitsMin, heightUnitsMax, mapSkinPool } = request;
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

    return Array.from(candidates.values())
        .filter((skin) => heightUnitsMin === undefined || skin.heightUnits >= heightUnitsMin)
        .filter((skin) => heightUnitsMax === undefined || skin.heightUnits <= heightUnitsMax)
        .sort((a, b) => a.id.localeCompare(b.id));
}

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
