export type DropId = "BOSS_CHEST";

export type DropDef = {
    id: DropId;
    title: string;
    desc: string;
};

export const DROPS: Record<DropId, DropDef> = {
    BOSS_CHEST: {
        id: "BOSS_CHEST",
        title: "Boss Chest",
        desc: "No interim reward.",
    },
} as const;
