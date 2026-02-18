import type { BuildingPackId, BuildingSkin, BuildingSkinId } from "./structureSkins";

export const CONTAINER_PACK_ID: BuildingPackId = "containers";

function monolithicContainerSkin(
    id: BuildingSkinId,
    spriteId: string,
    w: number,
    h: number
): BuildingSkin {
    return {
        id,
        w,
        h,
        heightUnits: 8,
        isFlippable: true,
        defaultFacing: "E",
        flipMode: "H",
        anchorLiftUnits: -2,
        wallLiftUnits: 0,
        roofLiftPx: 0,
        spriteScale: 1.0,
        roof: spriteId,
        wallSouth: [spriteId],
        wallEast: [spriteId],
    };
}

export const CONTAINER_SKINS: Record<BuildingSkinId, BuildingSkin> = {
    container1: monolithicContainerSkin("container1", "structures/containers/container_base", 3, 2),
    container_babyblue: monolithicContainerSkin("container_babyblue", "structures/containers/container_babyblue", 3, 2),
    container_black: monolithicContainerSkin("container_black", "structures/containers/container_black", 3, 2),
    container_blue: monolithicContainerSkin("container_blue", "structures/containers/container_blue", 3, 2),
    container_green: monolithicContainerSkin("container_green", "structures/containers/container_green", 3, 2),
    container_red: monolithicContainerSkin("container_red", "structures/containers/container_red", 3, 2),
};

export const CONTAINER_PACKS: Record<BuildingPackId, BuildingSkinId[]> = {
    [CONTAINER_PACK_ID]: [
        "container1",
        "container_babyblue",
        "container_black",
        "container_blue",
        "container_green",
        "container_red",
    ],
};
