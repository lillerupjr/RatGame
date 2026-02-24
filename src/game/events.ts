import type { VendorOffer } from "./events/vendor";

export type SfxId =
    | "FIRE_KNIFE"
    | "FIRE_PISTOL"
    | "FIRE_SYRINGE"
    | "FIRE_BOUNCER"
    | "FIRE_BAZOOKA"
    | "FIRE_OTHER"

    // NEW: movement + distinct explosions
    | "WALK_STEP"
    | "EXPLOSION_BAZOOKA"
    | "EXPLOSION_SYRINGE"

    | "ENEMY_HIT"
    | "ENEMY_KILL"
    | "PLAYER_HIT"
    | "CHEST_PICKUP"
    | "FLOOR_START"
    | "BOSS_START"
    | "RUN_WIN"
    | "RUN_LOSE"
    | "UI_CLICK";

export type GameEvent =
    | {
    type: "ENEMY_HIT";
    enemyIndex: number;
    damage: number;
    x: number;
    y: number;
    isCrit: boolean;
    source:
        | "KNIFE"
        | "PISTOL"
        | "SWORD"
        | "KNUCKLES"
        | "SYRINGE"
        | "BOUNCER"
        | "OTHER";
}
    | {
    type: "ENEMY_KILLED";
    enemyIndex: number;
    x: number;
    y: number;
    source:
        | "KNIFE"
        | "PISTOL"
        | "SWORD"
        | "KNUCKLES"
        | "SYRINGE"
        | "BOUNCER"
        | "OTHER";
}
    | {
    type: "PLAYER_HIT";
    damage: number;
    x: number;
    y: number;
}
    | {
    // Generic sound trigger (preferred)
    type: "SFX";
    id: SfxId;

    // Optional metadata for mixing/variety
    weaponId?: string;
    vol?: number; // 0..1
    rate?: number; // playback rate
}
    | {
    type: "VENDOR_PURCHASE";
    offer: VendorOffer;
};
