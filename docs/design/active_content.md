# Active Content

What a player can actually reach in a normal (user-mode) run today. Anything not listed as active is either dev-only or switched off in code.

Last reviewed: 2026-10-27.

## Game mode

There is one player-facing mode: the **Delve run**.

1. Pick one of five rats.
2. Climb an 8-row act map, choosing one reachable node per row.
3. Combat floors are **Survive**: stay alive for 120 seconds.
4. Clearing a floor offers a choice of rings.
5. The last row is the act boss. Beating it wins the run.

| Start mode | Status | How to reach it |
|---|---|---|
| `DELVE` (act map run) | **Active** | Main menu → Initiate Run |
| `DETERMINISTIC` (Path Select) | Dev only | Hidden in user mode |
| `SANDBOX` (Map Selector) | Dev only | Hidden in user mode |

## Act map node types

Gated by `NODE_TYPE_RUNTIME_ENABLED` in `src/game/map/delveMap.ts`.

| Node | Status | Floor | Objective |
|---|---|---|---|
| Combat | **Active** | Random map from the combat pool | `SURVIVE_TIMER` |
| Rest | **Active** | `REST` | `HEAL_VISIT` |
| Shop | **Active** | `SHOP` | `VENDOR_VISIT` (vendor sells rings) |
| Boss | **Active** | `BOSS1` | `ACT_BOSS` |
| Elite | Disabled | — | — |
| Unknown (`?`) | Disabled | — | — |

## Objectives

Combat objectives are gated by `COMBAT_SUBTYPE_RUNTIME_ENABLED` in `src/game/map/delveMap.ts`.

| Objective | Status | Notes |
|---|---|---|
| `SURVIVE_TIMER` | **Active** | 120 s survive timer; the only combat objective |
| `HEAL_VISIT` | **Active** | Rest node |
| `VENDOR_VISIT` | **Active** | Shop node |
| `ACT_BOSS` | **Active** | Final row |
| `POE_MAP_CLEAR` | Disabled | Code kept; reachable from Path Select only |
| `ZONE_TRIAL` | Disabled | Code kept; reachable from Path Select only |
| `KILL_RARES_IN_ZONES` | Not in rotation | Path Select only ("3 Rares") |
| `TIME_TRIAL_ZONES` | Unused | Not reachable from any menu |

## Maps

Authored JSON maps live in `src/game/map/authored/maps/jsonMaps/`.

| Map file | Map id | Used for |
|---|---|---|
| `docks.json` | `DOCKS` | **Combat pool** |
| `avenue.json` | `avenue` | **Combat pool** |
| `china_town.json` | `CHINATOWN` | **Combat pool** |
| `downtown.json` | `downtown` | **Combat pool** |
| `industrial.json` | `industrial` | **Combat pool** |
| `boss1.json` | `BOSS1` | **Act boss arena** |
| `shop.json` | `SHOP` | **Shop node** |
| `rest.json` | `REST` | **Rest node** |
| `highway.json` | `highway` | Not in rotation (Map Selector only) |
| `avenue2.json` | `avenue2` | Not in rotation (Map Selector only) |
| `vendor_01.json` | `VENDOR_01` | Not in rotation (Map Selector only) |
| `building.json`, `test_buildings.json`, `batch1_shadow_test.json`, `decals_test.json`, `minimal.json` | — | Test maps (Map Selector only) |

The combat pool is `DEFAULT_MAP_POOL` in `src/game/map/mapIds.ts`; the boss arena is `ACT_BOSS_MAP_POOL` in `src/game/bosses/actBossPlan.ts`.

## Bosses

| Boss | Status |
|---|---|
| Chem Guy (`chem_guy`) | **Active**, the only entry in `ACT_BOSS_POOL` |

## Zones

Each node rolls a zone (Docks, Sewers, Chinatown). The zone only selects the music track; it does not change the map, enemies or the timer. It is no longer shown in the UI.

## Playable characters

| Rat | Starting weapon |
|---|---|
| Scratchy | Syringe |
| Jack | Pistol |
| Jamal | Throwing Knife |
| Joey | Laser |
| Tommy | Shotgun |

## Progression

Rings are the only progression reward. See `docs/canonical/ring_progression_system.md`.
