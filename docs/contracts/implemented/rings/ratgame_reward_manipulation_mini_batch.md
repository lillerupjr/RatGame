# RatGame Reward Manipulation Mini-Batch Contract

Status: Complete / verified

## Goal

Implement Phase 1 of the non-block ring completion plan by adding reward-manipulation support for ring reward option count, equipped-family reward bias, and one floor-completion ring reward reroll.

This contract uses one large implementation section to avoid micro-stopping while preserving the ring-first progression architecture.

## Source Inputs

- Architecture rules: `docs/AGENTS.md`
- Phased completion plan: `docs/design/ratgame_full_ring_pool_audit.md`
- Tiering sheet: `docs/design/ratgame_ring_tiering_sheet.md`
- Current reward roadmap: `docs/design/ratgame_ring_reward_roadmap.md`
- Current content catalog: `docs/contracts/implemented/ring_v1_content_catalog.md`
- Current backend contract: `docs/contracts/implemented/ring_v1_backend_contract.md`

## Locked Scope

Implement exactly:

| Ring | Ring ID | Tier | Family | Exact Effect |
|---|---|---|---|---|
| Wider Selection | `RING_UTILITY_WIDER_SELECTION` | `t1` | utility | Ring rewards offer +1 additional option. |
| Curated Rewards | `RING_UTILITY_CURATED_REWARDS` | `t1` | utility | Ring rewards are slightly more likely to contain a family you already have equipped. |
| Selective Hand | `RING_UTILITY_SELECTIVE_HAND` | `t1` | utility | After each floor, you may reroll ring rewards once. |

Required system support:

- Add a `REWARD_RULES` ring effect kind with:
  - `RING_REWARD_OPTION_COUNT_ADD` using `add: 1`.
  - `RING_REWARD_EQUIPPED_FAMILY_WEIGHT_MULTIPLIER` using `multiplier: 2`.
  - `RING_REWARD_REROLL_ADD` using `count: 1`.
- Apply reward rules only to active progression reward UI generation.
- Keep vendor ring inventory unchanged.
- Add a single reward overlay reroll button when Selective Hand grants a reroll.

Out of scope:

- More utility rings beyond the three locked rings.
- Vendor offer manipulation.
- Reward token expansion.
- Ring-family-curated map nodes.
- Global tier-weight tuning.
- Block, timed buffs, projectile/trigger mechanics, status/hazard systems, and slot-position effect graphs.

## Section Progress

| Section | Status | Achievement |
|---|---|---|
| 1. Reward manipulation implementation | Done | Added reward rules, authored the three utility rings, wired active reward rerolls, updated docs/tests, and ran verification. |

## Implementation Requirements

- Extend effect type vocabulary and ring content validation with `REWARD_RULES`.
- Add a reward-rule collector/snapshot that reads equipped ring runtime effects.
- Keep `generateProgressionOffers(...)` as the base vendor-safe generator.
- Add reward-flow generation for active progression rewards that:
  - increases ring reward option count by `+1` for Wider Selection,
  - leaves tier roll odds unchanged,
  - applies `2x` selection weight to candidates whose family is currently equipped for Curated Rewards,
  - clamps option count to remaining eligible ring pool.
- Extend `ProgressionRewardState` with base option count, rerolls remaining, and a render sequence.
- Add `rerollProgressionReward(world): boolean`.
- Selective Hand grants one reroll only for active `RING` rewards from `FLOOR_COMPLETION`.
- Reroll consumes the charge, regenerates the full option set using the same base option count and current reward rules, and does not guarantee exclusion of previous options.
- Add all three ring definitions to `RING_DEFS_V1` with exact ids, tiers, family, descriptions, tags, and effects.
- Update current-truth docs and the non-block completion tracker after implementation.

## Verification

Run:

```sh
npm run typecheck
npm run test -- src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts
git diff --check
```

Verification completed:

- `npm run typecheck`
- `npm run test -- src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts`
- `git diff --check`
