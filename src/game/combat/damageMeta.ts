import type {
  AilmentKind,
  DamageCategory,
  DamageMeta,
  EffectMode,
  Instigator,
  LegacyDamageSource,
  TriggerKey,
} from "../events";

function playerInstigator(id?: string): Instigator {
  return { actor: "PLAYER", id };
}

function enemyInstigator(id?: string): Instigator {
  return { actor: "ENEMY", id };
}

function systemInstigator(id?: string): Instigator {
  return { actor: "SYSTEM", id };
}

export function makeWeaponHitMeta(
  weaponId: string,
  options?: {
    category?: DamageCategory;
    instigatorId?: string;
    isProcDamage?: boolean;
  },
): DamageMeta {
  return {
    category: options?.category ?? "HIT",
    cause: { kind: "WEAPON", weaponId },
    instigator: playerInstigator(options?.instigatorId),
    isProcDamage: options?.isProcDamage,
  };
}

export function makeRelicTriggeredMeta(
  relicId: string,
  triggerKey: TriggerKey,
  options?: {
    category?: DamageCategory;
    mode?: EffectMode;
    instigator?: Instigator;
    isProcDamage?: boolean;
  },
): DamageMeta {
  return {
    category: options?.category ?? "HIT",
    cause: {
      kind: "RELIC",
      relicId,
      mode: options?.mode ?? "TRIGGERED",
      triggerKey,
    },
    instigator: options?.instigator ?? playerInstigator(),
    isProcDamage: options?.isProcDamage ?? true,
  };
}

export function makeEnemyHitMeta(
  enemyTypeId: string,
  attackId: string,
  options?: {
    category?: DamageCategory;
    mode?: EffectMode;
    instigatorId?: string;
    isProcDamage?: boolean;
  },
): DamageMeta {
  return {
    category: options?.category ?? "HIT",
    cause: {
      kind: "ENEMY",
      enemyTypeId,
      attackId,
      mode: options?.mode ?? "INTRINSIC",
    },
    instigator: enemyInstigator(options?.instigatorId),
    isProcDamage: options?.isProcDamage,
  };
}

export function makeAilmentDotMeta(
  ailment: AilmentKind,
  options?: {
    category?: DamageCategory;
    instigator?: Instigator;
    isProcDamage?: boolean;
  },
): DamageMeta {
  return {
    category: options?.category ?? "DOT",
    cause: { kind: "AILMENT", ailment },
    instigator: options?.instigator ?? playerInstigator(),
    isProcDamage: options?.isProcDamage,
  };
}

export function makeEnvironmentDamageMeta(
  hazardId: string,
  options?: {
    category?: DamageCategory;
    mode?: EffectMode;
    instigatorId?: string;
    isProcDamage?: boolean;
  },
): DamageMeta {
  return {
    category: options?.category ?? "DOT",
    cause: {
      kind: "ENVIRONMENT",
      hazardId,
      mode: options?.mode ?? "INTRINSIC",
    },
    instigator: systemInstigator(options?.instigatorId ?? "map"),
    isProcDamage: options?.isProcDamage,
  };
}

export function makeUnknownDamageMeta(reason: string, options?: { category?: DamageCategory }): DamageMeta {
  return {
    category: options?.category ?? "HIT",
    cause: { kind: "UNKNOWN", reason },
    instigator: systemInstigator("unknown"),
  };
}

export function isProcDamage(meta: DamageMeta | null | undefined): boolean {
  return !!meta?.isProcDamage;
}

export function legacySourceToWeaponId(source: LegacyDamageSource | undefined): string {
  switch (source) {
    case "KNIFE":
      return "KNIFE";
    case "PISTOL":
      return "PISTOL";
    case "SWORD":
      return "SWORD";
    case "KNUCKLES":
      return "KNUCKLES";
    case "SYRINGE":
      return "SYRINGE";
    case "BOUNCER":
      return "BOUNCER";
    default:
      return "OTHER";
  }
}

export function inferLegacySourceFromMeta(meta: DamageMeta | null | undefined): LegacyDamageSource {
  if (!meta) return "OTHER";
  if (meta.cause.kind === "WEAPON") {
    const wid = String(meta.cause.weaponId).toUpperCase();
    if (
      wid === "KNIFE"
      || wid === "PISTOL"
      || wid === "SWORD"
      || wid === "KNUCKLES"
      || wid === "SYRINGE"
      || wid === "BOUNCER"
    ) {
      return wid as LegacyDamageSource;
    }
  }
  return "OTHER";
}

export function withProcFlag(meta: DamageMeta, isProc: boolean): DamageMeta {
  return {
    ...meta,
    isProcDamage: isProc,
  };
}
