# Hands Ring UI V1 — Pixi UI Pilot Contract

## Status

Draft for implementation

## Purpose

Implement the Hands Ring UI as a real PixiJS-native in-game screen.

This work is not only a feature implementation. It is also an early pilot for a broader UI migration toward PixiJS. The screen should therefore preserve the intended user experience from the provided HTML reference while establishing a clean Pixi-oriented direction that future UI screens can follow.

## Reference Artifact

Reference artifact:

## Reference Artifact Rule

The uploaded HTML file is a visual and interaction reference only.

It is:

- a standalone browser prototype
- built with React/ReactDOM/Babel
- rendered with normal DOM elements, CSS layout, and CSS animation
- not a PixiJS implementation

### Required interpretation

Preserve:

- the composition
- the hierarchy
- the interaction flow
- the motion intent

Do not port literally:

- the DOM structure
- the React/Babel runtime approach
- the CSS layout model
- the CSS animation implementation
- prototype-only controls or Claude-specific edit hooks

The HTML should be treated as a UX and visual target, not as production code.

## Product Intent

The hands are the core interface.

This is not an inventory screen, stash, bag, or storage browser. It is a direct equipment surface where the player sees rings on visible fingers and makes direct equip/replace decisions.

The desired player experience is:

- open the hands screen
- immediately understand which fingers have rings
- immediately understand which slots are empty
- click a ring to inspect it
- when a new ring is acquired, use the same screen to choose an empty slot or replace an equipped ring

## Architectural Intent

This implementation should act as a Pixi UI pilot.

That means:

- the screen should be implemented in a proper PixiJS-native UI stack
- the solution should avoid being a throwaway one-off
- reusable Pixi UI patterns/primitives should be introduced where practical
- the agent should not overbuild a huge speculative framework if the repo does not warrant it

The target balance is:

- not a one-off hack
- not an oversized premature UI framework
- a clean, reusable Pixi direction that can support future migration of more UI into Pixi

## Design Truths to Preserve from the Reference

The following are intentional and should survive into the real implementation:

- the hands are the dominant central visual
- there are 8 total ring slots, 4 per hand
- ring slots are overlaid relative to the hands image/container
- a right-side character stats rail is present
- a bottom ring detail panel opens when a ring is selected
- the hands shift upward when a ring is selected
- the same screen is reused for browse mode and new-ring choose-slot mode
- empty vs occupied slots are visually distinguishable
- the flow is direct equip/replace with no inventory/stash/bag framing

These are the strongest truths from the prototype and should anchor the implementation.

## Prototype Limitations That Must Be Corrected

The prototype is useful, but it has several intentional mockup limitations that must be corrected in production.

### 1. Replace all hardcoded demo data

The prototype uses fake ring definitions, fake equipped state, fake "new ring" content, fake character presentation, and UI-local derived values.

Production must use:

- real equipped rings
- real incoming ring data for acquisition mode
- real ring names, stats, rarity, descriptions, and icons
- real player/character stats from game state

### 2. Remove preview/demo controls

The prototype includes player-visible preview state switching and prototype top-bar controls.

These must not remain in the real player-facing UI.

### 3. Remove Claude/edit-mode scaffolding

The prototype contains design-tool edit hooks and tweak scaffolding.

These must not survive in production. A proper in-repo developer/debug tuning mode is wanted instead.

### 4. Replace placeholder ring rendering

The prototype uses a shared placeholder ring image path for rendered rings and the detail panel.

Production must use real ring art/icons from actual game content.

### 5. Replace UI-side stat parsing

The prototype parses stats from mock strings inside the UI layer.

Production must display real game-derived stats from actual simulation/state. UI formatting should remain presentation only.

### 6. Replace approximate-only slot logic with tunable slot transforms

The prototype stores approximate relative slot positions but does not provide the full per-slot transform tuning you actually want.

Production must support per-slot data-driven placement and tuning.

## Scope

### In scope

- Hands Ring UI browse mode
- Hands Ring UI choose-slot mode for newly acquired rings
- 8 total ring slots, 4 per hand
- real ring content and real stats
- PixiJS-native implementation
- relative, data-driven ring slot placement
- per-slot transform tuning
- right-side stats panel
- bottom detail panel
- open/close interaction
- selected-ring interaction
- developer/debug slot tuning workflow
- establishing reusable Pixi UI direction where practical

### Out of scope for this v1

- extra fingers
- finger mutations
- locked/non-removable rings
- drag-and-drop
- modular hand parts
- stash/inventory/bag UI
- speculative full UI rewrite beyond what this screen naturally requires

## Screen Behavior Requirements

### Open / close

- Press `H` to open the hands screen in normal browse mode.
- Press `H` again to close.
- Additional close behavior such as `ESC` may be supported if it matches repo conventions.

### Browse mode

When opened normally:

- the hands dominate the center of the screen
- equipped rings are visible in their slots
- empty slots are visible in a subtle/readable way
- clicking an equipped ring selects it
- selecting a ring opens the bottom detail panel
- selecting another equipped ring retargets selection immediately

### Selected-ring behavior

On ring selection:

- the hands shift upward
- the bottom detail panel opens
- the selected ring receives stronger emphasis/highlight

This motion/interaction direction from the prototype should be preserved.

### Choose-slot mode

When a new ring is acquired:

- the same hands screen opens in choose-slot mode
- the incoming ring is the pending item
- empty slots read as equip targets
- occupied slots read as replace targets
- there is no stash or intermediate storage UI

### Choose-slot click behavior

Lock v1 behavior as:

- clicking an empty slot equips immediately
- clicking an occupied slot replaces immediately

No additional confirm step is required unless implementation reality strongly suggests one is needed.

## Layout Requirements

### Core composition

Preserve the screen composition from the reference:

- central large hands presentation
- far-right vertical stats panel
- bottom detail drawer/panel

### Hands presentation

- use the provided hands sprite as the central asset
- hands should fill most of the screen
- rings should sit directly on top of the hands as overlay elements in Pixi terms

### Right-side stats rail

- show real player stats
- support quick readability
- visually support the hands rather than overpower them
- it is acceptable to reduce the weight/density versus the prototype if needed, as long as the right-rail concept remains

### Bottom detail panel

- collapsed by default
- opens on selected equipped ring
- in choose-slot mode, shows the incoming ring
- must display real ring content

## Ring Slot Model

### Slot count and identity

Exactly 8 slots in v1:

- 4 on the left hand
- 4 on the right hand

Use stable slot ids, for example:

```text
left_0
left_1
left_2
left_3
right_0
right_1
right_2
right_3
```

### Required slot config

Each slot must be data-driven with at least:

- `id`
- `hand`
- `index`
- `x`
- `y`
- `rotationDeg`

Strongly recommended:

- `scale`
- `hitRadius`
- `zIndex`

### Coordinate rule

Slot coordinates must be relative to the hands sprite/container, not hardcoded screen pixels.

The prototype's use of image-relative positioning is the correct direction and should be preserved conceptually.

### Initial placement rule

Approximate initial slot positions from the reference, but treat them as temporary defaults expected to be tuned after implementation.

Do not treat prototype slot placements as final truth.

## Debug / Tuning Requirements

A real developer-facing slot tuning workflow is required.

### Minimum required capabilities

- show all 8 slot anchors
- show slot ids
- inspect slot transform values
- tune per-slot `x`, `y`, and `rotationDeg`

### Strongly recommended capabilities

- tune per-slot `scale`
- tune per-slot `hitRadius`
- show hit regions if practical
- support fast inspect/copy/export of current values

### Constraint

This tuning mode is for development/debug use and must not pollute the default player-facing presentation.

The current prototype tweak panel is not sufficient because it mainly exposes global presentation toggles rather than real slot placement tuning.

## Real Data Integration Requirements

### Ring content

The screen must use real ring data:

- real ring definitions
- real equipped state
- real rarity
- real ring icon/sprite
- real ring stats/modifiers
- real incoming ring payload in choose-slot mode

### Character stats

The right panel must display real derived stats from actual player/build/game state.

It must not recreate gameplay logic in the UI layer through local parsing or mock aggregation.

### State integration

The screen's state must be driven by real game flow:

- opened by input
- populated from equipped state
- acquisition mode opened from real reward/loot/event flow
- equip/replace writes back into actual equipment state

## Pixi Migration Direction

This screen should be used to establish the right level of reusable Pixi-native UI direction.

The implementation should, where natural, leave behind patterns that future UI screens can build on, such as:

- Pixi-native screen/menu composition patterns
- reusable panel or framed-surface treatment
- reusable input/hover/select interaction patterns
- reusable transition/tween direction
- reusable debug overlay conventions
- reusable relative-anchor overlay patterns for elements positioned over a parent sprite

This is guidance, not a demand for a full framework rewrite.

The goal is to create the correct first step toward a Pixi-native UI stack.

## Flexibility for the Agent

The agent should determine:

- the Pixi scene/container structure
- the integration boundary with the rest of the repo
- which reusable primitives are worth introducing now
- how best to map this screen into current RatGame architecture

The contract intentionally does not hardcode:

- exact class trees
- exact helper names
- exact scene graph shape
- exact tween implementation
- exact file layout

That discovery should be repo-aware.

## Acceptance Criteria

Implementation is complete when:

- The uploaded HTML has been used as a visual/interaction reference only, not ported literally.
- The screen is implemented in a real PixiJS-native UI path.
- Pressing `H` opens/closes the hands screen in-game.
- The provided hands sprite is the dominant central visual.
- 8 ring slots are rendered as relative, data-driven overlays over the hands.
- Equipped rings use real ring content and real ring art.
- Empty slots are visible and readable.
- Clicking an equipped ring opens the bottom detail panel and shifts the hands upward.
- The right-side panel displays real character stats from actual game state.
- New ring acquisition opens the same screen in choose-slot mode.
- In choose-slot mode, empty-slot click equips and occupied-slot click replaces.
- A real developer/debug slot tuning workflow exists.
- Prototype-only preview controls, placeholder content, Claude hooks, and UI-side stat parsing are removed.
- The implementation leaves behind sensible Pixi-native UI direction for future migration without becoming an oversized speculative framework.
