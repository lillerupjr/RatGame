import { createFloorRewardBudget, type ObjectiveMode } from "../../../game/rewards/floorRewardBudget";

export function createRewardPipelineWorld(seed = 1, mode: ObjectiveMode = "ZONE_TRIAL"): any {
  let s = seed >>> 0;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };

  const floorArchetype = mode === "ZONE_TRIAL" ? "TIME_TRIAL" : mode === "SURVIVE_TRIAL" ? "SURVIVE" : "SURVIVE";

  return {
    rng: { next },
    state: "RUN",
    runState: "FLOOR",
    floorArchetype,
    floorIndex: 0,
    delveDepth: 1,
    timeSec: 0,
    run: { runGold: 0 },
    events: [],
    triggerSignals: [],
    objectiveStates: [],
    chestOpenRequested: false,
    eType: [],
    eSpawnTriggerId: [],

    cards: [] as string[],
    relics: [] as string[],

    cardReward: {
      active: false,
      source: "ZONE_TRIAL",
      options: [] as string[],
    },
    relicReward: {
      active: false,
      source: "OBJECTIVE_COMPLETION",
      options: [] as string[],
    },

    floorRewardBudget: createFloorRewardBudget(mode),
    cardRewardClaimKeys: [] as string[],
    lastCardRewardClaimKey: null,
    objectiveRewardClaimedKey: null,
    zoneRewardClaimedKey: null,
    zoneRewardClaimedKeys: [] as string[],

    runEvents: [],
    rewardTickets: [],
    activeRewardTicketId: null,
    rewardTicketSeq: 0,
  };
}

export function getActiveTicket(world: any): any | null {
  if (!Array.isArray(world.rewardTickets)) return null;
  const id = world.activeRewardTicketId;
  if (!id) return null;
  return world.rewardTickets.find((ticket: any) => ticket?.id === id) ?? null;
}

export function dismissActiveRewardUi(world: any): void {
  world.cardReward.active = false;
  world.cardReward.options = [];
  world.relicReward.active = false;
  world.relicReward.options = [];
}
