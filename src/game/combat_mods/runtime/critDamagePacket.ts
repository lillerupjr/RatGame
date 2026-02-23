export interface ProjectileDamagePacket {
  physical: number;
  fire: number;
  chaos: number;
  critChance: number;
  critMulti: number;
}

export interface ResolvedProjectileDamage {
  isCrit: boolean;
  physical: number;
  fire: number;
  chaos: number;
  total: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Resolve crit and total damage for a typed projectile packet.
 */
export function resolveProjectileDamagePacket(
  packet: ProjectileDamagePacket,
  critRoll01: number
): ResolvedProjectileDamage {
  const critChance = clamp01(packet.critChance);
  const critMulti = Math.max(1, packet.critMulti);
  const isCrit = critRoll01 < critChance;
  const mult = isCrit ? critMulti : 1;

  const physical = Math.max(0, packet.physical) * mult;
  const fire = Math.max(0, packet.fire) * mult;
  const chaos = Math.max(0, packet.chaos) * mult;

  return {
    isCrit,
    physical,
    fire,
    chaos,
    total: physical + fire + chaos,
  };
}
