import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import type { RingDef, RingFamilyTalentTreeDef } from "./ringTypes";

export const RING_DEFS_V1: RingDef[] = [
  {
    id: "RING_IRON_SIGNET",
    name: "Iron Signet",
    familyId: "physical",
    tags: ["physical", "hit"],
    effectType: "STAT_MODIFIERS",
    effectParams: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 4 }],
    },
  },
  {
    id: "RING_CINDER_LOOP",
    name: "Cinder Loop",
    familyId: "fire",
    tags: ["fire", "ignite"],
    effectType: "STAT_MODIFIERS",
    effectParams: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.DAMAGE_ADD_FIRE, op: "add", value: 4 },
        { key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 0.08 },
      ],
    },
  },
  {
    id: "RING_VENOM_BAND",
    name: "Venom Band",
    familyId: "poison",
    tags: ["chaos", "poison", "dot"],
    effectType: "STAT_MODIFIERS",
    effectParams: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.12 },
        { key: STAT_KEYS.DOT_POISON_DAMAGE_INCREASED, op: "increased", value: 0.2 },
      ],
    },
  },
  {
    id: "RING_SPLINTER_COIL",
    name: "Splinter Coil",
    familyId: "projectile",
    tags: ["projectile"],
    effectType: "STAT_MODIFIERS",
    effectParams: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 }],
    },
  },
  {
    id: "RING_KEEN_CIRCLE",
    name: "Keen Circle",
    familyId: "crit",
    tags: ["crit", "hit"],
    effectType: "STAT_MODIFIERS",
    effectParams: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.05 },
        { key: STAT_KEYS.CRIT_MULTI_ADD, op: "add", value: 0.15 },
      ],
    },
  },
  {
    id: "RING_OAKEN_BAND",
    name: "Oaken Band",
    familyId: "defense",
    tags: ["life", "defense"],
    effectType: "STAT_MODIFIERS",
    effectParams: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 25 }],
    },
  },
];

export const RING_FAMILY_TALENT_TREES_V1: RingFamilyTalentTreeDef[] = [
  {
    familyId: "physical",
    nodes: [
      {
        id: "physical-force-1",
        name: "Force",
        description: "+15% increased damage",
        requiresNodeIds: [],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.DAMAGE_INCREASED, op: "increased", value: 0.15 }] },
      },
      {
        id: "physical-force-2",
        name: "Weight",
        description: "+4 physical damage",
        requiresNodeIds: ["physical-force-1"],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 4 }] },
      },
    ],
  },
  {
    familyId: "fire",
    nodes: [
      {
        id: "fire-spark-1",
        name: "Spark",
        description: "+10% ignite chance",
        requiresNodeIds: [],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 0.1 }] },
      },
      {
        id: "fire-cinder-1",
        name: "Cinder",
        description: "+30% increased ignite damage",
        requiresNodeIds: ["fire-spark-1"],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.DOT_IGNITE_DAMAGE_INCREASED, op: "increased", value: 0.3 }] },
      },
    ],
  },
  {
    familyId: "poison",
    nodes: [
      {
        id: "poison-venom-1",
        name: "Venom",
        description: "+10% poison chance",
        requiresNodeIds: [],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.1 }] },
      },
      {
        id: "poison-depth-1",
        name: "Depth",
        description: "+30% increased poison damage",
        requiresNodeIds: ["poison-venom-1"],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.DOT_POISON_DAMAGE_INCREASED, op: "increased", value: 0.3 }] },
      },
    ],
  },
  {
    familyId: "projectile",
    nodes: [
      {
        id: "projectile-speed-1",
        name: "Flight",
        description: "+20% projectile speed",
        requiresNodeIds: [],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.PROJECTILE_SPEED_INCREASED, op: "increased", value: 0.2 }] },
      },
      {
        id: "projectile-pierce-1",
        name: "Pierce",
        description: "+1 pierce",
        requiresNodeIds: ["projectile-speed-1"],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.PIERCE_ADD, op: "add", value: 1 }] },
      },
    ],
  },
  {
    familyId: "crit",
    nodes: [
      {
        id: "crit-edge-1",
        name: "Edge",
        description: "+5% crit chance",
        requiresNodeIds: [],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.05 }] },
      },
      {
        id: "crit-edge-2",
        name: "Cut",
        description: "+25% crit multiplier",
        requiresNodeIds: ["crit-edge-1"],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.CRIT_MULTI_ADD, op: "add", value: 0.25 }] },
      },
    ],
  },
  {
    familyId: "defense",
    nodes: [
      {
        id: "defense-vigor-1",
        name: "Vigor",
        description: "+25 life",
        requiresNodeIds: [],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 25 }] },
      },
      {
        id: "defense-guard-1",
        name: "Guard",
        description: "+5% damage reduction",
        requiresNodeIds: ["defense-vigor-1"],
        cost: 1,
        effect: { kind: "STAT_MODIFIERS", mods: [{ key: STAT_KEYS.DAMAGE_REDUCTION_ADD, op: "add", value: 0.05 }] },
      },
    ],
  },
];

export function getRingDefById(id: string): RingDef | undefined {
  return RING_DEFS_V1.find((def) => def.id === id);
}

export function getRingFamilyTalentTreeById(familyId: string): RingFamilyTalentTreeDef | undefined {
  return RING_FAMILY_TALENT_TREES_V1.find((tree) => tree.familyId === familyId);
}
