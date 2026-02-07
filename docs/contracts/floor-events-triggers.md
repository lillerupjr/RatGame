# floor-events-triggers.md

Purpose
-------
Define a data-driven floor events system based on trigger instances that evaluate
conditions and emit game events which other systems handle (UI, spawns, rewards,
objectives). Triggers are authored in JSON maps and can also be injected by
overworld selection via a post-load mutation pass.

This document is compatible with both:
- Hand-authored JSON maps.
- Procedurally generated maps (without modifying the generator code).


Core Model
----------
Trigger instances are first-class map entities.

A trigger instance has:
- An anchor (where it lives in the map).
- A scope (tile, radius, or other shape around the anchor).
- One or more conditions (when it fires or progresses).
- One or more effects (what it requests).
- A state policy (once, repeatable, cooldown).

A trigger instance does not directly execute gameplay consequences.
It emits domain events into the world event queue.
Dedicated systems consume those events and apply outcomes.

This keeps content modular and keeps the trigger system small.


Terms
-----
Anchor
  A stable reference to a position in the map. Anchors are stored in tile grid
  coordinates and optionally a surface identifier.

Scope
  A geometric region tested by conditions (tile, radius, rect).

Condition
  A pure query over world state that returns one of:
  - boolean (fire/no fire)
  - progress (0..1)
  - count (kills, items, etc)

Effect
  A domain request emitted when a trigger fires (open shop, spawn boss, heal).

Domain Event
  A message placed into the world event queue that other systems handle.

Trigger State
  Minimal per-instance data:
  - status (armed, active, resolved)
  - timesFired
  - progress
  - cooldownUntil (optional)


Design Constraints
------------------
1) Triggers are entities, not special tiles.
2) Conditions are pure queries; effects only emit domain events.
3) Triggers are evaluated only when relevant (near player or active zones).
4) Trigger data must be compatible with both JSON maps and procgen maps.
5) No procedural map generator changes are required for integration.


JSON Authoring Shape
--------------------
The JSON map format supports an "entities" array.
A trigger is an entity with kind "trigger".

Recommended minimal shape:

{
  "entities": [
    {
      "kind": "trigger",
      "id": "shop_01",
      "anchor": { "x": 12, "y": 7, "z": 0 },
      "scope": { "shape": "tile" },
      "policy": { "mode": "oncePerRun" },
      "conditions": [
        { "type": "interact", "prompt": "Open shop" }
      ],
      "effects": [
        { "type": "openShop", "shopId": "sewer_vendor_t1" }
      ]
    }
  ]
}

Fields
------
kind
  Must be "trigger".

id
  Stable string id. Used for debugging and persistence keys.

anchor
  { x, y, z } in tile grid space.
  z is zLogical, not pixels.
  Optional: surfaceId for future multi-surface-per-(x,y) maps.

scope
  Defines where spatial conditions apply.
  shape is one of:
  - "tile"   (exact anchor tile)
  - "radius" (center at anchor, radius in tiles)
  - "rect"   (axis-aligned in tile space)
  Shape-specific fields:
  - radius: number
  - w, h: number
  - offsetX, offsetY: number (optional local offset in tiles)

policy
  mode is one of:
  - "oncePerRun"
  - "repeatable"
  Optional:
  - cooldownSec: number
  - maxFires: number

conditions
  Array of condition objects. All conditions must be satisfied for the trigger
  to fire unless "logic" is provided.
  Optional:
  - logic: "AND" | "OR"
  If omitted: AND.

effects
  Array of effect objects. All effects are emitted in order when the trigger
  fires. Effects do not directly manipulate UI/spawns. They emit domain events.


Condition Catalog
-----------------
This catalog defines stable condition names and payload shapes.
Conditions are evaluated by the trigger system using world state.

proximity
  Fires when the player is within scope.
  { "type": "proximity" }

interact
  Fires when the player presses interact while eligible.
  { "type": "interact", "prompt": "string" }

killCountInScope
  Fires when a kill counter reaches threshold.
  Kill attribution source is world events (enemy died).
  { "type": "killCountInScope", "count": 20, "enemyTag": "optional" }

timeInScope
  Progress condition; completes after player remains in scope for seconds.
  { "type": "timeInScope", "seconds": 30 }

enterScope
  Edge-triggered condition; true when player transitions from outside to inside.
  { "type": "enterScope" }

exitScope
  Edge-triggered condition; true when player transitions from inside to outside.
  { "type": "exitScope" }

always
  Always true; used for injected effects or chained objectives.
  { "type": "always" }


Effect Catalog
--------------
Effects define which domain event is emitted and its payload.

openShop
  Emits OpenShopRequested.
  { "type": "openShop", "shopId": "string" }

spawnBoss
  Emits SpawnBossRequested.
  { "type": "spawnBoss", "bossId": "string", "at": "anchor|randomInScope" }

heal
  Emits HealRequested.
  { "type": "heal", "amount": 25 }

grantReward
  Emits RewardRequested.
  { "type": "grantReward", "rewardTable": "string", "tier": 1 }

startObjective
  Emits ObjectiveStarted.
  { "type": "startObjective", "objectiveId": "string" }

completeObjective
  Emits ObjectiveCompleted.
  { "type": "completeObjective", "objectiveId": "string" }

setFlag
  Emits FlagSetRequested.
  { "type": "setFlag", "key": "string", "value": true }


Runtime Ownership
-----------------
TriggerSystem
  - Loads trigger entities from the compiled map.
  - Maintains per-trigger state (armed/active/resolved, counters, cooldown).
  - Subscribes to relevant world events (interact, enemy died, player moved).
  - Evaluates triggers when they are relevant.
  - Emits domain events for effects.

UISystem
  - Consumes OpenShopRequested.
  - Owns shop presentation and input capture.

SpawnSystem
  - Consumes SpawnBossRequested and other spawn requests.
  - Owns spawn placement rules and collision-safe spawn resolution.

ObjectiveSystem
  - Consumes ObjectiveStarted/Completed and flag events.
  - Owns objective UI and progression storage.

HealthSystem
  - Consumes HealRequested.
  - Owns health mutation rules.

The trigger system does not import UI or spawn implementations.


Evaluation Strategy
-------------------
The trigger system must not scan all triggers every frame.

Recommended gating:
- Spatial index triggers by anchor/scope bounds in tile space.
- When player moves between tiles, query triggers near the player.
- Maintain an "active" set for any trigger currently progressing (timeInScope).
- Update only active triggers each frame (or each tick).

Kill counters:
- Enemy deaths emit EnemyDied with tile position.
- killCountInScope increments if death position is within the trigger scope.

Interact:
- Player input emits InteractPressed with tile position.
- TriggerSystem checks eligible triggers in range and fires matching ones.


Integration With JSON Map Loader
--------------------------------
The JSON loader compiles:
- tiles (surfaces, occluders, aprons)
- entities (player spawn, enemies, triggers, props)

Triggers compile into a runtime TriggerDef list with:
- id
- anchor (tile coords + zLogical + optional surfaceId)
- scope descriptor
- policy
- conditions
- effects

The compiler does not evaluate triggers.
It only normalizes and validates shape fields and produces runtime-friendly data.


Integration With Procedural Maps
--------------------------------
No procedural generator code changes are required.

The integration relies on a post-load augmentation layer that can:
- Add triggers to a compiled procedural map.
- Place triggers using existing map data as candidate anchors.

Inputs available from existing compiled maps:
- Map bounds (w,h)
- Known floor tiles / surface tiles (zLogical and tile coords)
- Spawn tile position (player start)
- Optional metadata already produced by the generator

Placement adapter strategy:
1) Derive candidate anchors:
   - Any floor surface tile at zLogical within a target band.
   - Prefer tiles within a ring around spawn for early events.
   - Prefer tiles at the end of a corridor for boss events if detectable.
2) Choose an anchor deterministically:
   - Seeded RNG from run seed + floor id.
3) Validate anchor minimal constraints:
   - Anchor is a floor surface tile.
   - Scope bounds stay within map bounds.
4) Inject trigger entities into the compiled map entities list.

This adapter is owned by overworld floor selection or run setup code, not by the
procedural generator module.


Overworld Floor Mutation Pass
-----------------------------
When a floor node is selected on the overworld map, a mutation pass can apply:
- difficulty scaling (increase killCount thresholds, reward tiers)
- content themes (swap shopId, bossId, reward tables by biome)
- injected events (boss floor, treasure floor, challenge floor)

Mutation ordering:
1) Load/compile map (json or procgen).
2) Apply overworld mutation pass (inject triggers or tweak parameters).
3) Start run with final compiled map.

Mutation must be deterministic from:
- run seed
- overworld node id
- floor id


Examples
--------
Proximity heal fountain (repeatable with cooldown):

{
  "kind": "trigger",
  "id": "fountain_heal_a",
  "anchor": { "x": 8, "y": 14, "z": 0 },
  "scope": { "shape": "radius", "radius": 2 },
  "policy": { "mode": "repeatable", "cooldownSec": 20 },
  "conditions": [ { "type": "proximity" } ],
  "effects": [ { "type": "heal", "amount": 10 } ]
}

Boss teleporter style objective (interact -> spawn boss -> kill count complete):

{
  "kind": "trigger",
  "id": "boss_gate_a",
  "anchor": { "x": 20, "y": 6, "z": 2 },
  "scope": { "shape": "radius", "radius": 5 },
  "policy": { "mode": "oncePerRun" },
  "conditions": [ { "type": "interact", "prompt": "Start fight" } ],
  "effects": [
    { "type": "startObjective", "objectiveId": "boss_gate_a" },
    { "type": "spawnBoss", "bossId": "rat_warden", "at": "anchor" }
  ]
}

Kill objective completion (separate trigger watching kills in scope):

{
  "kind": "trigger",
  "id": "boss_gate_a_complete",
  "anchor": { "x": 20, "y": 6, "z": 2 },
  "scope": { "shape": "radius", "radius": 6 },
  "policy": { "mode": "oncePerRun" },
  "conditions": [ { "type": "killCountInScope", "count": 1, "enemyTag": "boss" } ],
  "effects": [
    { "type": "completeObjective", "objectiveId": "boss_gate_a" },
    { "type": "grantReward", "rewardTable": "boss_rewards", "tier": 2 }
  ]
}


Validation Notes
----------------
The loader/compiler validates only structural correctness:
- required fields exist
- numeric ranges are sane
- unknown condition/effect types are rejected

Gameplay validation (reachability, spawn safety) is owned by the runtime systems:
- SpawnSystem resolves safe spawn points.
- ObjectiveSystem handles missing optional UI data gracefully.


Achievements
------------
- Triggers are authored as entities in JSON and compiled into runtime data.
- TriggerSystem only emits domain events; other systems own consequences.
- Procedural maps remain unchanged; triggers can be injected by a mutation pass.
- Overworld floor selection can deterministically inject or scale triggers.
