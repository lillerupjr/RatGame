import type { VendorOffer } from "./events/vendor";

export type DamageCategory = "HIT" | "DOT";

export type EffectMode = "INTRINSIC" | "TRIGGERED";

export type AilmentKind = "IGNITE" | "POISON" | "BLEED";

export type TriggerKey =
  | "ON_HIT"
  | "ON_KILL"
  | "ON_CRIT"
  | "ON_TICK"
  | "ON_DODGE"
  | "ON_MOVE"
  | "OTHER";

export type DamageCause =
  | { kind: "WEAPON"; weaponId: string }
  | { kind: "RELIC"; relicId: string; mode: EffectMode; triggerKey?: TriggerKey }
  | { kind: "TRIGGER"; mode: EffectMode; triggerId?: string; objectiveId?: string }
  | { kind: "ENVIRONMENT"; mode: EffectMode; hazardId: string }
  | { kind: "AILMENT"; ailment: AilmentKind }
  | { kind: "ENEMY"; enemyTypeId: string; attackId: string; mode: EffectMode }
  | { kind: "UNKNOWN"; reason?: string };

export type Instigator =
  | { actor: "PLAYER"; id?: string }
  | { actor: "ENEMY"; id?: string }
  | { actor: "SYSTEM"; id?: string };

export type DamageMeta = {
  category: DamageCategory;
  cause: DamageCause;
  instigator: Instigator;
  isProcDamage?: boolean;
};

export type LegacyDamageSource =
  | "KNIFE"
  | "PISTOL"
  | "SWORD"
  | "KNUCKLES"
  | "SYRINGE"
  | "BOUNCER"
  | "OTHER";

export type VfxId =
  | "EXPLOSION"
  | "LIGHTNING_HIT"
  | "STATUS_BLEED_LOOP"
  | "STATUS_POISON_LOOP"
  | "STATUS_BURNING_LOOP";

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
    dmgPhys?: number;
    dmgFire?: number;
    dmgChaos?: number;
    critMult?: number;
    x: number;
    y: number;
    isCrit: boolean;
    damageMeta: DamageMeta;
    /** @deprecated Compatibility-only; gameplay logic must use damageMeta. */
    source?: LegacyDamageSource;
}
    | {
    type: "ENEMY_KILLED";
    enemyIndex: number;
    x: number;
    y: number;
    spawnTriggerId?: string;
    damageMeta: DamageMeta;
    /** @deprecated Compatibility-only; gameplay logic must use damageMeta. */
    source?: LegacyDamageSource;
}
    | {
    type: "PLAYER_HIT";
    damage: number;
    x: number;
    y: number;
    damageMeta: DamageMeta;
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
}
    | { type: "MOMENTUM_BREAK"; wasFull: boolean }
    | { type: "MOMENTUM_DECAYED" }
    | { type: "FULL_MOMENTUM_REACHED" }
    | { type: "FULL_MOMENTUM_LOST" }
    | {
    type: "VFX"; id: VfxId; x: number; y: number;
    radius?: number; z?: number;
    scale?: number; loop?: boolean;
    followEnemyIndex?: number; offsetYPx?: number;
  }
    | { type: "VFX_STOP_FOLLOW"; id: VfxId; enemyIndex: number };

export type RelicTriggerEvent = Extract<GameEvent, { type: "ENEMY_HIT" | "ENEMY_KILLED" }> & {
  isRetrigger?: boolean;
  killDamage?: number;
};

export type PendingRelicRetrigger = {
  fireAt: number;
  event: RelicTriggerEvent;
};

export type PendingRelicDaggerShot = {
  fireAt: number;
  projectileIndex: number;
  excludeEnemyIndex: number;
  range: number;
};
