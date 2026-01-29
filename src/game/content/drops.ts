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
        desc: "Grants a random upgrade to an owned weapon/item, or triggers an evolution if available.",
    },
} as const;