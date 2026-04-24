# RatGame Cluster Jewel System

## V1 Contract

## 0. Design Intent (Locked)

This system replaces the card reward system with a modular, run-randomized talent system built around cluster jewels.

### Goals

- Provide scalable, stable power progression.
- Maintain clear build identity through categories.
- Keep mechanical complexity low, with no relic overlap.
- Ensure high replayability via RNG jewel rolls.

## 1. Core System Overview (Locked)

### Player Structure

Each character has:

- Infinite jewel sockets.
- A starter jewel equipped at run start.

During a run, the player:

- Acquires additional cluster jewels.
- Spends skill points to allocate nodes inside equipped jewels.

### Jewel Structure

Each cluster jewel:

- Has exactly 5 nodes total:
  - 4 small nodes.
  - 1 notable node.
- Has exactly 1 category.
- Is randomly generated per run.
- Is drawn from a category-specific mod pool.

### Skill Points

Skill points are:

- Earned via leveling up from XP gained from enemies.
- Used to allocate nodes inside jewels.

### Power Targets (Critical)

- Small node: about 5% power.
- Notable node: about 15% to 20% power.

These are guidelines rather than exact math, but they must be respected for balance.

## 2. Category System (Locked)

### Active V1 Categories

- Projectile
- Poison
- Physical
- Critical Hits
- Damage over Time
- Ignite

### Category Rules

- Each jewel belongs to exactly one category.
- Nodes in a jewel are only drawn from that category.
- Categories define identity through stat shaping, not mechanics.

### Explicitly Excluded (V1)

No system-breaking mechanics:

- No explosions.
- No projectile return.
- No spawning.
- No orbiting.
- No chain or fork. These move to relic space.

## 3. Node Types (Locked)

### Small Nodes

- Pure stat modifiers.
- Low complexity.
- Stackable.

### Notable Nodes

- Stronger stat modifiers.
- May include light conditions.

Must not:

- Introduce new systems.
- Drastically alter gameplay rules.

## 4. Mod Pools (Locked)

### Projectile

#### Small Pool

- `+10% projectile damage`
- `+10% projectile speed`
- `+10% projectile range`
- `+10% fire rate` if allowed here; otherwise move to a fire-rate category.
- `+10% chance to pierce`

#### Notables (Locked)

- `+1 projectile`
- `Projectiles deal 25% increased damage`
- `Projectiles have +20% speed and +20% range`
- `Projectiles have +1 pierce`

### Poison

#### Small Pool

- `+10% poison damage`
- `+15% poison duration`
- `+10% chance to poison on hit`
- `+5% poison tick rate`

#### Notables (Locked)

- `30% increased poison damage`
- `25% increased poison duration`
- `Poison has +15% chance to apply an additional stack`
- `Poisoned enemies take 15% increased damage`

### Physical

#### Small Pool

- `+10% physical damage`
- `+5% chance to stun on hit`
- `+5% less physical damage taken`

Remove crit chance from this pool.

#### Notables (Locked)

- `Execution: Physical hits deal 30% increased damage to enemies below 30% life`
- `Relentless Force: Consecutive hits grant 5% increased physical damage (max 25%)`
- `30% increased physical damage`
- `Physical hits apply 10% increased physical damage taken for 3 seconds`

### Critical Hits

#### Small Pool

- `+10% critical strike multiplier`
- `+5% critical strike chance`
- `+5% movement speed after crit (3s)`

Remove defensive anti-crit from this pool.

#### Notables (Locked)

- `+40% critical strike multiplier`
- `+10% critical strike chance`
- `Critical strikes grant +10% increased damage for 3 seconds`
- `Critical strikes have 20% chance to deal double damage`

### Damage Over Time

#### Small Pool

- `+10% damage over time`
- `+15% duration`
- `+5% tick rate`
- `10% reduced damage over time taken`

#### Notables (Locked)

- `30% increased damage over time`
- `25% increased duration`
- `20% increased tick rate`
- `Enemies affected by your DoTs take 10% increased damage`

### Ignite

#### Small Pool

- `+10% ignite damage`
- `+15% ignite duration`
- `+10% chance to ignite on hit`
- `+5% ignite tick rate`

#### Notables (Locked)

- `30% increased ignite damage`
- `25% increased ignite duration`
- `20% increased ignite tick rate`
- `Ignited enemies take 15% increased damage`

## 5. Jewel Generation (Locked)

Each jewel is generated as:

```ts
type Jewel = {
  category: Category
  smallNodes: SmallNode[4]
  notable: NotableNode
}
```

### Generation Rules

1. Select category based on drop source, RNG, or constraints.
2. Roll 4 small nodes from the category pool.
3. Roll 1 notable from the category pool.

### Constraints

- No duplicate notable in the same jewel.
- Small nodes may duplicate. This remains an optional design decision.
- A weighting system is allowed, but not required in V1.

## 6. Reward System (Locked)

Cluster jewels are obtained via:

- Enemy drops.
- Chests.
- Vendors.

### Replacement

This system fully replaces:

- The card reward system.

## 7. Implementation Guidelines (Critical)

### Do

- Keep all modifiers numeric, composable, and predictable.
- Ensure all builds can benefit from at least one category.
- Ensure no category becomes mandatory.

### Do Not

Do not introduce:

- Behavior-changing mechanics.
- Event-based triggers such as on-death explosions.
- Entity spawning.
- Complex conditional chains.

Those belong to relics.

## 8. Design Guardrails (Locked)

### Rule 1

Notables must amplify, not transform.

### Rule 2

Each category defines identity via stat emphasis, not mechanics.

### Rule 3

If a node changes:

- Projectile pathing.
- Enemy behavior.
- Entity count.

It is not a jewel node. It is a relic.

## 9. Final Design State

### Locked

- Jewel structure: 5 nodes.
- Category system: 6 types.
- Small and notable power targets.
- Full notable pools per category.
- Generation model.
- Reward integration.

### Open (Future)

- Weighting and rarity tiers.
- Corruption and upgrade systems.
- Socket UI and layout.
- Category expansion, such as AoE or Fire Rate.

## Contract Complete

This is:

- Implementable.
- Balanced for V1.
- Cleanly extensible.
