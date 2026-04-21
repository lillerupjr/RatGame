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

export type VfxClipKey = string;

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
    damage?: number;
    dmgPhys?: number;
    dmgFire?: number;
    dmgChaos?: number;
    isCrit?: boolean;
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
    | { type: "MOMENTUM_BREAK"; wasFull: boolean }
    | { type: "MOMENTUM_DECAYED" }
    | { type: "FULL_MOMENTUM_REACHED" }
    | { type: "FULL_MOMENTUM_LOST" }
    | {
    type: "VFX"; id: VfxClipKey; x: number; y: number;
    radius?: number; z?: number;
    scale?: number; loop?: boolean;
    followEnemyIndex?: number; offsetYPx?: number;
  }
    | { type: "VFX_STOP_FOLLOW"; id: VfxClipKey; enemyIndex: number };
