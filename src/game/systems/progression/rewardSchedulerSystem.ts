import type { World } from "../../../engine/world/world";
import { addGold } from "../../economy/gold";
import { OBJECTIVE_COMPLETION_GOLD, type RewardOutcome, handleRewardEvent } from "../../rewards/rewardDirector";
import { defaultRewardFamilyForDepth, type ProgressionRewardFamily } from "../../progression/rewards/rewardFamilies";
import { grantModifierToken } from "../../progression/rings/ringState";
import { type RunEvent, shiftRunEvent } from "../../rewards/runEvents";
import {
  addRewardClaimKey,
  enqueueRewardTicket,
  hasRewardClaimKey,
  type RewardTicketSource,
} from "../../rewards/rewardTickets";

const DEFAULT_OPTION_COUNT = 3;

function floorMapDepthForRewards(world: World): number {
  if (Number.isFinite(world.mapDepth) && world.mapDepth > 0) return world.mapDepth;
  if (Number.isFinite(world.delveDepth) && world.delveDepth > 0) return world.delveDepth;
  return (world.floorIndex ?? 0) + 1;
}

function claimKeyForRunEvent(world: World, ev: RunEvent): string {
  const floorIndex = Number.isFinite(ev.floorIndex) ? ev.floorIndex : (world.floorIndex ?? 0);
  switch (ev.type) {
    case "ZONE_CLEARED":
      return `${floorIndex}:ZONE_CLEAR:${ev.zoneIndex}`;
    case "RARE_MILESTONE_CLEARED":
      return `${floorIndex}:RARE_CLEAR:${ev.rareIndex}`;
    case "OBJECTIVE_COMPLETED":
      if (world.floorRewardBudget.mode === "ZONE_TRIAL") return `${floorIndex}:TRIAL_COMPLETE`;
      return `${floorIndex}:OBJ_COMPLETE:${ev.objectiveId}`;
    case "LEVEL_UP":
      return `${floorIndex}:LEVEL_UP:${ev.level}`;
    case "CHEST_OPEN_REQUESTED":
      return ev.chestKind === "BOSS"
        ? `${floorIndex}:BOSS_CHEST`
        : `${floorIndex}:CHEST_OTHER`;
    case "SURVIVE_MILESTONE":
      return `${floorIndex}:SURVIVE_T:${ev.seconds}`;
    default:
      return `${floorIndex}:UNKNOWN_EVENT`;
  }
}

function applyRareMilestoneReward(world: World, rareIndex: 1 | 2): RewardOutcome {
  return {
    type: "NO_REWARD",
    reason: `Rare milestone ${rareIndex} reward disabled`,
  };
}

function rewardPlanForRunEvent(
  world: World,
  ev: RunEvent,
): {
  outcome: RewardOutcome;
  ticketSource: RewardTicketSource;
  progressionFamily?: ProgressionRewardFamily;
  grantLevelUpToken?: boolean;
  bonusGoldAmount: number;
} {
  const depth = floorMapDepthForRewards(world);

  switch (ev.type) {
    case "ZONE_CLEARED":
      return {
        outcome: handleRewardEvent(
          world.floorRewardBudget,
          { type: "ZONE_COMPLETED", zoneIndex: ev.zoneIndex },
          { depth },
        ),
        ticketSource: "FLOOR_COMPLETION",
        bonusGoldAmount: 0,
      };

    case "RARE_MILESTONE_CLEARED":
      return {
        outcome: applyRareMilestoneReward(world, ev.rareIndex),
        ticketSource: "FLOOR_COMPLETION",
        bonusGoldAmount: 0,
      };

    case "SURVIVE_MILESTONE":
      return {
        outcome: handleRewardEvent(
          world.floorRewardBudget,
          { type: "SURVIVE_1MIN_REWARD" },
          { depth },
        ),
        ticketSource: "FLOOR_COMPLETION",
        bonusGoldAmount: 0,
      };

    case "OBJECTIVE_COMPLETED":
      return {
        outcome: handleRewardEvent(world.floorRewardBudget, { type: "OBJECTIVE_COMPLETED" }, { depth }),
        ticketSource: "FLOOR_COMPLETION",
        progressionFamily: world.currentFloorIntent?.rewardFamily ?? defaultRewardFamilyForDepth(depth),
        bonusGoldAmount: OBJECTIVE_COMPLETION_GOLD,
      };

    case "LEVEL_UP":
      return {
        outcome: { type: "NO_REWARD", reason: `Level ${ev.level} grants ring level-up token` },
        ticketSource: "LEVEL_UP",
        progressionFamily: "RING_MODIFIER_TOKEN",
        grantLevelUpToken: true,
        bonusGoldAmount: 0,
      };

    case "CHEST_OPEN_REQUESTED":
      return {
        outcome: handleRewardEvent(
          world.floorRewardBudget,
          { type: "CHEST_OPENED", chestKind: ev.chestKind },
          { depth },
        ),
        ticketSource: ev.chestKind === "BOSS" ? "BOSS_CHEST" : "SIDE_OBJECTIVE",
        bonusGoldAmount: 0,
      };

    default:
      return {
        outcome: { type: "NO_REWARD", reason: "Unhandled run event" },
        ticketSource: "FLOOR_COMPLETION",
        bonusGoldAmount: 0,
      };
  }
}

function appendZoneRewardClaim(world: World, claimKey: string): void {
  world.zoneRewardClaimedKey = claimKey;
  if (!Array.isArray(world.zoneRewardClaimedKeys)) world.zoneRewardClaimedKeys = [];
  if (!world.zoneRewardClaimedKeys.includes(claimKey)) world.zoneRewardClaimedKeys.push(claimKey);
}

export function rewardSchedulerSystem(world: World): void {
  for (;;) {
    const ev = shiftRunEvent(world);
    if (!ev) return;

    const claimKey = claimKeyForRunEvent(world, ev);
    if (hasRewardClaimKey(world, claimKey)) continue;

    const plan = rewardPlanForRunEvent(world, ev);

    if (import.meta.env.DEV && !!(world as any)?.debug?.rewardPipelineLogs) {
      console.debug("[rewardScheduler]", {
        event: ev.type,
        claimKey,
        outcome: plan.outcome.type,
        family: plan.outcome.type === "GRANT_PROGRESSION_REWARD" ? plan.progressionFamily : null,
      });
    }

    // Claim once scheduler has decided the outcome. This prevents event replay loss.
    addRewardClaimKey(world, claimKey);
    world.lastRewardClaimKey = claimKey;

    if (ev.type === "OBJECTIVE_COMPLETED") {
      world.objectiveRewardClaimedKey = claimKey;
    }
    if (ev.type === "ZONE_CLEARED" || ev.type === "RARE_MILESTONE_CLEARED") {
      appendZoneRewardClaim(world, claimKey);
    }

    if (plan.bonusGoldAmount > 0) {
      addGold(world, plan.bonusGoldAmount);
    }

    if (plan.grantLevelUpToken) {
      grantModifierToken(world, "LEVEL_UP");
      continue;
    }

    if (plan.outcome.type === "GRANT_GOLD") {
      addGold(world, plan.outcome.amount);
      continue;
    }

    if (plan.outcome.type !== "GRANT_PROGRESSION_REWARD") {
      continue;
    }

    enqueueRewardTicket(world, {
      claimKey,
      family: plan.progressionFamily ?? defaultRewardFamilyForDepth(floorMapDepthForRewards(world)),
      source: plan.ticketSource,
      optionCount: DEFAULT_OPTION_COUNT,
    });
  }
}
