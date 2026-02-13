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
        spriteScale: 1.02,
        roof: spriteId,
        wallSouth: [spriteId],
        wallEast: [spriteId],
    };
}

export const CONTAINER_SKINS: Record<BuildingSkinId, BuildingSkin> = {
    container1: monolithicContainerSkin("container1", "structures/containers/container_base", 3, 2),
    container_dark_blue: monolithicContainerSkin("container_dark_blue", "structures/containers/container_dark_blue", 2, 3),
    container_dark_blue_flipped: monolithicContainerSkin("container_dark_blue_flipped", "structures/containers/container_dark_blue_flipped", 3, 2),
    container_green: monolithicContainerSkin("container_green", "structures/containers/container_green", 2, 3),
    container_green_flipped: monolithicContainerSkin("container_green_flipped", "structures/containers/container_green_flipped", 3, 2),
    // Keep legacy skin IDs available but route to existing assets.
    container_light_blue: monolithicContainerSkin("container_light_blue", "structures/containers/container_base", 2, 3),
    container_light_blue_flipped: monolithicContainerSkin("container_light_blue_flipped", "structures/containers/container_base_flipped", 3, 2),
    container_red: monolithicContainerSkin("container_red", "structures/containers/container_red", 2, 3),
    container_red_flipped: monolithicContainerSkin("container_red_flipped", "structures/containers/container_red_flipped", 3, 2),
};

export const CONTAINER_PACKS: Record<BuildingPackId, BuildingSkinId[]> = {
    [CONTAINER_PACK_ID]: [
        "container1",
    ],
};
