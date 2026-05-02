# RatGame Full Ring Pool Audit + Expansion Plan Contract

Status: Complete / verified; ready to move to implemented

## Goal

Lock the next full-ring-pool planning layer before adding more ring content.

This contract audits the currently shipped ring pool, decides the target V1/V2-scale pool list, classifies each candidate by implementation readiness, and recommends the next exact implementation batch. It is intentionally planning/documentation work first: no new ring content, no new combat mechanics, and no reward-system changes are implemented in this contract.

## Source Inputs

- Architecture rules: `docs/AGENTS.md`
- Roadmap: `docs/design/ratgame_ring_reward_roadmap.md`
- Tier/readiness source: `docs/design/ratgame_ring_tiering_sheet.md`
- Current content catalog: `docs/contracts/implemented/ring_v1_content_catalog.md`
- Current backend contract: `docs/contracts/implemented/ring_v1_backend_contract.md`
- Completed tiering contract: `docs/contracts/implemented/rings/ratgame_ring_data_tiering_weighted_rewards.md`
- Content-only batch record: `docs/contracts/implemented/rings/ratgame_ring_content_only_implementation.md`

## Locked Scope

- Audit the current shipped ring pool from `RING_DEFS_V1`, including count, families, tiers, and normal reward eligibility.
- Treat the current pool as 37 rings unless the source audit proves otherwise.
- Decide the final target pool list for the next V1/V2-scale expansion pass, aiming at roughly 70 total authored rings.
- Preserve starter rings as starter-loadout content, not normal generated reward drops.
- Preserve the current `t0`/`t1`/`t2`/`t3` tier model and weighted reward path.
- Classify candidates into:
  - already shipped,
  - ready with current systems,
  - ready after small system upgrade,
  - needs larger new system,
  - intentionally deferred.
- Recommend one exact next implementation batch and the follow-up implementation contract to create.

Out of scope:

- Adding new ring definitions.
- Adding new effect primitives.
- Adding new family ids.
- Changing reward weights.
- Tuning T0 frequency.
- Implementing map reward nodes, token nodes, events, hand/finger tokens, or ring assets.

## Expected Outputs

- A new or updated design document that records:
  - current shipped pool audit,
  - target full-pool list,
  - readiness classification,
  - recommended next implementation batch.
- Roadmap status updates only where this audit actually completes roadmap planning items.
- A clear follow-up contract name and scope for the next code-bearing implementation pass.

## Section Progress

| Section | Status | Achievement |
|---|---|---|
| 1. Contract setup | Done | Created this contract, read it end-to-end, and confirmed the locked scope. |
| 2. Current pool audit | Done | Verified the then-current 37 shipped rings, 32 reward-eligible rings, family/tier distribution, starter separation, and reward eligibility from source files. |
| 3. Target list lock-in | Done | Decided a 66-ring target pool from shipped rings plus 29 unshipped non-block candidates and reconciled it against the tiering sheet and roadmap. |
| 4. Readiness classification | Done | Classified all target candidates at audit time: 37 shipped, 0 remaining exact content-only, 17 small-upgrade rings, 12 larger-system rings, and 8 deferred block-reserve rings. |
| 5. Next batch recommendation | Done | Selected the Projectile Stat Expansion batch, now completed at `docs/contracts/implemented/rings/ratgame_projectile_ring_stat_expansion.md`. |

Post-implementation note: the projectile expansion moved Sharpened Tip, Ricochet Rounds, and Scatter Shot into `RING_DEFS_V1`, so the current pool is now 40 shipped rings and 35 normal reward-eligible rings. The current audit state lives in `docs/design/ratgame_full_ring_pool_audit.md`.
| 6. Documentation verification | Done | Reviewed docs for consistency and ran lightweight verification appropriate for a docs-only contract. |

## Audit Rules

- Source truth for shipped rings is `src/game/progression/rings/ringContent.ts`.
- Source truth for reward eligibility is `src/game/progression/rewards/progressionOffers.ts`.
- Source truth for design candidates and preliminary readiness is `docs/design/ratgame_ring_tiering_sheet.md`.
- If docs disagree with source, record the disagreement and update docs instead of changing code in this contract.
- Do not mark a candidate "ready with current systems" unless its exact effect can be authored without approximation.
- Do not include starter upgrades as normal ring-pool candidates; keep them for event/starter-upgrade roadmap work.

## Verification

This contract is docs/planning only. Verification should include:

```sh
rg -n "RING_" src/game/progression/rings/ringContent.ts docs/design/ratgame_ring_tiering_sheet.md docs/contracts/implemented/ring_v1_content_catalog.md
git diff --check
```

No TypeScript or game tests are required unless a later section unexpectedly changes source code.
