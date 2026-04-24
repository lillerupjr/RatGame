# RatGame TimeScale Contract v1.0
## Part 1 — Global Simulation Speed (dtReal vs dtSim)
## Part 2 — Death Slowmo + “WASTED” Screen Effect

This contract defines a **single authoritative time scaling system** used by RatGame.
All simulation systems MUST follow this contract to ensure consistent tuning, replayability, and cinematic effects.

This document is **agent-friendly**:
- explicit formulas
- required fields
- forbidden patterns
- deterministic behavior
- minimal ambiguity


------------------------------------------------------------
# PART 1 — GLOBAL TIMESCALE CONTRACT
------------------------------------------------------------

## Goal

Guarantee that:

1. The game has a single global scalar: `timeScale`
2. Simulation time is computed as: `dtSim = dtReal * timeScale`
3. Most gameplay systems use `dtSim`
4. UI/menus use `dtReal`
5. TimeScale can be adjusted from a slider for “feel tuning”
6. No system implements its own time scaling


------------------------------------------------------------
## Definitions

dtReal (seconds)
- Real elapsed time between frames (unscaled)
- Used for: UI animations, input smoothing, debug overlays, camera smoothing (optional), and timeScale interpolation

dtSim (seconds)
- Scaled simulation delta time
- Computed as: `dtSim = dtReal * timeScale`
- Used for: gameplay simulation

timeScale
- Global multiplier controlling simulation speed
- Examples:
  - 1.0 = normal
  - 0.5 = half speed (slow motion)
  - 1.25 = slightly faster
  - 2.0 = “chaos mode”


------------------------------------------------------------
## Required State

A single canonical time state MUST exist.

Suggested structure:

```
state.time = {
  dtReal: number,          // seconds
  dtSim: number,           // seconds
  timeScale: number,       // current applied scale
  timeScaleTarget: number, // desired target (slider / effects)
  timeScaleSlew: number,   // smoothing speed (per second), e.g. 12
}
```

Notes:
- `timeScaleTarget` enables smooth transitions (menu slider, death slowmo).
- `timeScaleSlew` prevents abrupt jumps and reduces “feel jitter”.


------------------------------------------------------------
## Canonical Frame Update (MANDATORY)

Each frame MUST compute time like this:

1) Compute `dtReal`:
- seconds between frame timestamps
- must be clamped

2) Update `timeScale` toward `timeScaleTarget` using dtReal

3) Compute `dtSim = dtReal * timeScale`

Canonical pseudocode:

```
dtReal = clamp((now - lastNow) / 1000, 0, 0.05) // 50ms max step

timeScale = approachExp(timeScale, timeScaleTarget, timeScaleSlew, dtReal)

dtSim = dtReal * timeScale

state.time.dtReal = dtReal
state.time.dtSim = dtSim
state.time.timeScale = timeScale
```

`approachExp` requirement:
- monotonic toward target
- frame-rate independent
- no overshoot


------------------------------------------------------------
## System Consumption Rules

### Systems that MUST use dtSim (Simulation)

- movement integration (player/enemies)
- acceleration / friction / drag
- projectile motion
- cooldown timers
- DOT tick timers and durations
- AI timers (think intervals, turn rates)
- spawn director timers
- hitstun / knockback decay
- world time-based triggers
- sprite/VFX animation time (unless explicitly UI)

### Systems that MUST use dtReal (Real Time / UI)

- menus + transitions
- HUD animations
- input sampling / deadzone smoothing (recommended dtReal)
- screen-space post FX timing (recommended dtReal)
- timeScale smoothing itself (MUST use dtReal)

### Systems that MAY choose (must be explicit)

- camera smoothing (usually dtReal to remain readable during slowmo)
- screen shake (usually dtReal)
- audio pitch/FX (if implemented)


------------------------------------------------------------
## Forbidden Patterns

❌ Per-frame “magic decrements” not using dt

Bad:
```
cooldown -= 1
pos.x += speed
```

Good:
```
cooldown -= dtSim
pos.x += speedPerSec * dtSim
```

❌ Systems multiplying by timeScale internally
- Only the central time system computes dtSim
- Systems accept dtSim directly

❌ Mixing dtReal and dtSim in the same timer without a reason


------------------------------------------------------------
## Slider Specification (Feel Tuning)

Add a user setting:

```
settings.gameSpeed
```

Meaning:
- This sets `timeScaleTarget` in normal gameplay (when no special effects override it).

Suggested range:
- 0.50 → 1.50

Suggested step:
- 0.05 (or 0.10 for coarse)

Default:
- 1.00

UI label recommendation:
- “Game Speed” with value display “1.15x”


------------------------------------------------------------
## Priority / Override Rules

Multiple features may want to influence timeScaleTarget (slider, slowmo, debug).

Contract requires a single resolution order, for example:

1) Hard overrides (death slowmo / cutscenes)
2) Debug overrides (dev hotkeys)
3) User slider baseline

This MUST be implemented centrally (not in systems).


------------------------------------------------------------
# PART 2 — DEATH SLOWMO + “WASTED” SCREEN EFFECT
------------------------------------------------------------

## Goal

On player death:

1. Slow the simulation for a short duration using the same global timeScale system
2. Render a classic GTA-style “WASTED” overlay effect in screen space
3. Ensure overlay timing is driven by dtReal (not slowed)
4. Transition cleanly to end-run screen/state


------------------------------------------------------------
## Required State

Add death effect state:

```
state.deathFx = {
  active: boolean,
  tReal: number,          // seconds since start (dtReal-driven)
  durationReal: number,   // e.g. 2.0
}
```

Recommended constants:

```
DEATH_SLOWMO_TARGET = 0.12
DEATH_SLOWMO_SLEW   = 16
DEATH_FX_DURATION   = 2.0
```


------------------------------------------------------------
## Trigger Condition (MANDATORY)

When the player transitions into “dead” state (single event):

- Set `deathFx.active = true`
- Set `deathFx.tReal = 0`
- Set `deathFx.durationReal = DEATH_FX_DURATION`

Pseudocode:

```
onPlayerDeath():
  deathFx.active = true
  deathFx.tReal = 0
  deathFx.durationReal = DEATH_FX_DURATION
```

Important:
- This MUST trigger once per death, not every frame while dead.


------------------------------------------------------------
## TimeScale Override (MANDATORY)

While `deathFx.active`:

- Override `timeScaleTarget = DEATH_SLOWMO_TARGET`
- Optionally override `timeScaleSlew = DEATH_SLOWMO_SLEW`

When `deathFx` ends:

- Release override (restore baseline slider-driven timeScaleTarget)
- Transition to end-run state OR resume timeScale toward baseline, depending on design

Pseudocode:

```
if (deathFx.active) {
  timeScaleTarget = DEATH_SLOWMO_TARGET
  timeScaleSlew = DEATH_SLOWMO_SLEW
} else {
  timeScaleTarget = settings.gameSpeed
  timeScaleSlew = DEFAULT_SLEW
}
```


------------------------------------------------------------
## Overlay Timing Rule (CRITICAL)

Death overlay animation MUST use dtReal.

Never dtSim.

Reason:
- overlay should animate smoothly even during slowmo


------------------------------------------------------------
## Overlay Rendering Rules

Overlay MUST be drawn in screen space.

Choose ONE approach and keep it consistent:

A) Device-pixel overlays:
```
ctx.setTransform(1,0,0,1,0,0)
```

B) CSS-pixel overlays (if your renderer normalizes with DPR):
```
ctx.setTransform(dpr,0,0,dpr,0,0)
```

Overlay recommended elements (cheap + effective):

- dark vignette (radial gradient)
- desaturation approximation (semi-transparent gray overlay)
- red tint pulse (optional)
- centered “WASTED” text:
  - fade-in + slight scale-in
  - optional shadow/outline
- optional subtle screen shake (dtReal-driven)


------------------------------------------------------------
## Alpha Curve (Recommended)

Let `t = deathFx.tReal`.

Fade-in (0.05 → 0.25s):
```
aIn = smoothstep(0.05, 0.25, t)
```

Fade-out (1.40 → duration):
```
aOut = 1 - smoothstep(1.40, durationReal, t)
```

Final alpha:
```
alpha = clamp01(aIn * aOut)
```


------------------------------------------------------------
## End Condition (MANDATORY)

Each frame while active:

```
deathFx.tReal += dtReal
if (deathFx.tReal >= deathFx.durationReal) {
  deathFx.active = false
  // transition to end-run screen/state
}
```

Contract requires the transition to be deterministic and state-driven.


------------------------------------------------------------
## Forbidden Patterns (Death FX)

❌ Driving overlay timing via dtSim

❌ Applying slowmo by multiplying velocity directly in each system
- Must use the global dtSim mechanism

❌ Re-triggering deathFx every frame while player is dead


------------------------------------------------------------
# ACHIEVEMENT CHECKLIST

Part 1:
[x] Single global `timeScale` exists
[x] `dtReal` and `dtSim` are stored in state
[x] `dtSim = dtReal * timeScale` is the only scaling rule
[x] Simulation uses dtSim; UI uses dtReal
[x] Menu slider controls baseline timeScaleTarget
[x] No system scales itself independently

Part 2:
[x] Death triggers a single deathFx event
[x] Death slowmo uses timeScale override (not per-system hacks)
[x] “WASTED” overlay is screen-space
[x] Overlay animation uses dtReal
[x] End-run transition is deterministic


------------------------------------------------------------
END OF CONTRACT
