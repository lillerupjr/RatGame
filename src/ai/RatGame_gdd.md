# RatGame — GDD v0.2

## Core Fantasy
A Vampire Survivors–style roguelike set in a **sleazy, neon-soaked 1980s New York–inspired underworld**, where anthropomorphic rats battle endless rival gangs using guns, blades, chemicals, and deeply questionable life choices.

The city is loud, filthy, and alive. Everyone’s yelling. Everyone wants a cut. You’re just trying to survive long enough to become a legend.

---

## Pillars
- Faction-driven combat fantasy
- Fast, readable VS-style gameplay
- Excessive weapon escalation
- Sopranos-tier humor in small, sharp doses
- Player agency through weapon synergies

---

## Tone & Humor
- **Light seasoning**, not constant noise
- Humor lands at:
  - Run start
  - Weapon evolutions
  - Boss introductions
  - Item descriptions
- NY slang, mob bravado, sleazy one-liners
- Suggestive jokes only, no explicit content

Example lines:
- “Ey—this thing’s still warm.”
- “I coulda used that gas mask last night…”
- “You call that suppression fire? My grandma shoots straighter.”

---

## Factions (Player-Facing Fantasy)

Factions define **weapon themes, upgrade tendencies, and build identity**. They are **soft rules**, not hard restrictions.

### Thieves
**Fantasy:** Slick, fast, opportunistic  
**Weapons:** Knives, throwing blades, machetes  
**Damage Style:** Martial, bleed, precision  
**Mechanics:** Mobility, crits, positioning  
**Joke Theme:** Petty theft, hustler logic  
> “I could get a good penny for this.”

---

### Mobsters
**Fantasy:** Loud, brutal, dominant  
**Weapons:** Pistols, revolvers, automatic guns, explosives  
**Damage Style:** Guns, projectiles  
**Mechanics:** Suppression, raw DPS, intimidation  
**Joke Theme:** NY slang, Sopranos energy  
> “Ey—fuhgeddaboudit.”

---

### Chemists
**Fantasy:** Mad scientists, drug cooks, chaos engineers  
**Weapons:** Molotovs, syringes, gas devices  
**Damage Style:** Chemical, DOT  
**Mechanics:** Area denial, stacking effects  
**Joke Theme:** Science gone wrong, sketchy chemistry  
> “The numbers say this shouldn’t work.”

---

### Hookers
**Fantasy:** Control, manipulation, distraction  
**Weapons:** Whips, perfume bottles, lipstick blades  
**Damage Style:** Debuffs, crowd control  
**Mechanics:** Charm, weaken, reposition  
**Joke Theme:** Sleazy, suggestive dry humor  
> *Loots gas mask* — “Yeah… that tracks.”

---

## Enemies

### Early Game
- Rival rats only
- Same species, different gangs
- High readability, strong thematic focus

### Personality
- Fodder enemies: silent
- Elite enemies and bosses: bark-heavy, NY insults
- Faction-reflective behavior comes later

---

## Weapons Philosophy

Weapons are:
- Faction-themed
- Easy to read
- Built for escalation

### Weapon Examples (WIP)
- **Throwing Knife (Thieves)**  
  Fan spread, projectile count scaling  
  *Tags:* projectile, martial, precision

- **Dual Machete (Thieves)**  
  Spinning close-range area  
  *Tags:* martial, melee, area

- **Pistol / Revolver (Mobsters)**  
  Straight shots, fire rate scaling  
  *Tags:* projectile, guns, precision

- **Molotov (Chemists)**  
  Ground DOT, fire damage  
  *Tags:* chemical, DOT, area, fire

- **Syringes (Chemists)**  
  Fan spread, chemical DOT  
  *Tags:* projectile, chemical, DOT

---

## Tags & Synergies

Tags such as:
- projectile
- DOT
- area
- martial
- chemical

Are **important for player agency**, not just internal logic. Players should be able to intentionally stack similar damage vectors to shape runs.

---

## Evolutions (v1)

### Evolution Style
- Vampire Survivors–style (weapon + passive)

### Rules
- Evolutions **enhance**, not replace
- Clear power fantasy escalation

Examples:
- Throwing knives evolve into full 360° rings
- Pistols gain piercing and chaining
- Perfume clouds charm enemies, then explode on death

### Cross-Faction Evolutions
- Mostly faction-pure
- Rare cross-faction easter eggs allowed

---

## Playable Characters

- Individuals with personality
- Belong to factions for identity clarity
- Humor is secondary to combat identity

Dialogue:
- Occasional
- Mostly at key moments
- Written late in development

---

## Rating & Boundaries
- No explicit sexual content
- Suggestive humor only
- Sopranos-tier profanity allowed
- Violence may escalate later if tone demands it

---

## Run Structure, Floors & Zones

### Run Overview
- A single run consists of **3 floors**
- Completing all 3 floors results in a **win**
- Each floor lasts approximately **5–15 minutes** depending on build strength and player performance

This structure provides strong pacing, replayability, and clear progression without endless-run fatigue.

---

### Floors
A **floor** is a self-contained act with escalating pressure.

Each floor contains:
- Semi-randomized enemy waves
- Elite encounters
- Ambient modifiers or hazards (zone-flavored)
- Gradually increasing difficulty
- **One guaranteed boss fight** at the end

The goal of a floor is to survive long enough to reach the boss while assembling a viable build.

---

### Zones (Faction-Controlled Districts)

Zones represent **districts of the city**, each controlled by a specific faction. They define:
- Visual identity
- Enemy composition bias
- Weapon and upgrade bias
- Boss personality and mechanics

After defeating a floor boss, the player **chooses the next zone**, gaining agency over build direction.

Zone choice influences **loot weighting**, not hard guarantees, preserving roguelike uncertainty while rewarding intent.

---

### Baseline Zones (One per Faction)

#### Strip Club — Hookers
- Visuals: neon lights, velvet interiors, stages, spotlights
- Enemy bias: charm, distraction, glass-cannon elites
- Weapon bias: debuff and control-oriented weapons
- Boss: Madame / Club Owner / Star Performer
- Guaranteed boss drop bias:
  - Hooker-aligned weapon, passive, or evolution component

---

#### The Docks — Mobsters
- Visuals: shipping containers, fog, floodlights
- Enemy bias: suppressive fire, tanky enemies
- Weapon bias: guns, raw projectile DPS
- Boss: Dock Capo / Enforcer
- Guaranteed boss drop bias:
  - Gun weapon, projectile passive, or gun-related evolution component

---

#### Chinatown / Back Alleys — Thieves
- Visuals: tight streets, signage, cluttered alleys
- Enemy bias: fast enemies, ambushes, flanking behavior
- Weapon bias: knives, martial and precision weapons
- Boss: Assassin / Syndicate Leader
- Guaranteed boss drop bias:
  - Martial weapon, crit/bleed passive, or precision evolution component

---

#### Sewers — Chemists
- Visuals: pipes, sludge, steam, toxic clouds
- Enemy bias: DOT, area denial, environmental hazards
- Weapon bias: chemical and mutation-based weapons
- Boss: Mutant Rat / Chem Overlord
- Guaranteed boss drop bias:
  - Chemical weapon, DOT passive, or mutation-style evolution component

---

### Boss Rewards & Player Agency

After defeating a floor boss:
- The player is presented with **2–3 reward choices**
- At least **one option is guaranteed** to align with the current zone’s faction

This ensures that:
- Zone choice always matters
- Floors never feel wasted
- Players can intentionally steer builds without full determinism

---

### Win Condition
- Defeat the boss of Floor 3
- Display a run summary including:
  - Final build
  - Faction alignment
  - Key stats and synergies
  - Meta unlocks (if applicable)

---

## First Playable Build Priorities
1. Weapons feel
2. Faction identity through combat
3. Clear escalation
4. Humor as garnish, not noise

---

## Notes
This structure reinforces faction fantasy, supports targeted build paths, and provides strong pacing while preserving the Vampire Survivors power curve.