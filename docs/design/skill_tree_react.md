# Cluster Jewel UI System Design Contract

## Purpose

Define the V1 UI architecture for the cluster jewel talent system.

This contract is for repository storage as a system design contract, not an agent prompt. It should describe the intended structure, responsibilities, boundaries, and implementation rules clearly enough that a separate implementation prompt can later direct an agent to build it.

This UI is a simple first version of the user's radial talent-wheel sketch. It should intentionally include a small but real use of:

- React for state-driven UI structure
- Motion for standard interaction and transition polish
- GSAP for the centerpiece wheel and jewel expansion animation

The goal is not final feature completeness. The goal is to establish a strong, attractive, evolvable foundation.

## 0. Design Intent

The cluster jewel UI must present two distinct surfaces:

### Talent Wheel

- The active talent allocation surface
- Where equipped jewels live
- Where nodes are inspected and allocated

### Jewel Inventory

- The obtained jewel list
- Where unequipped jewels are browsed and selected for equipping

These surfaces must remain visually and architecturally separate.

The UI should feel:

- Readable
- Premium
- Game-like
- Reactive
- Intentionally animated

It should not feel like a temporary debug menu.

## 1. V1 Scope

### Included

- Talent screen root layout
- Half-circle socket wheel
- Focused socket selection
- Focused jewel expansion
- 5-node jewel display
- Node hover and click interactions
- Jewel inventory panel
- Jewel inspection tooltip/details
- Skill point display
- Basic equip flow from inventory to selected socket
- Basic allocate flow for available nodes
- React + Motion + GSAP integration

### Explicitly Excluded from V1

- Drag-and-drop equipping
- Controller-first navigation polish
- Corruption UI
- Advanced socket unlock rules presentation
- Complex node graph layouts
- Particles / VFX systems beyond light polish
- Background-only decorative animation systems
- Full final art direction pass
- Final production inventory filtering/sorting
- Multi-step crafting/reroll UI

## 2. Core UI Surfaces

### 2.1 Talent Wheel

The Talent Wheel is the primary visual anchor of the screen.

Responsibilities:

- Display equipped sockets along a lower arc / half-circle
- Communicate which socket is currently selected
- Animate wheel snap when changing selected socket
- Unfold the currently selected jewel outward from its socket
- Display node states for that jewel
- Support node inspection and allocation

The Talent Wheel is an allocation surface, not an inventory surface.

### 2.2 Jewel Inventory

The Jewel Inventory is the owned jewel browser.

Responsibilities:

- Display obtained jewels in a right-side scrollable panel
- Allow jewel inspection
- Allow equipping a jewel into the currently selected socket

The Inventory is an ownership and selection surface, not an allocation surface.

Inventory jewels do not unfold.

### 2.3 Skill Point Display

A simple skill point counter must be visible while the talent UI is open.

Responsibilities:

- Display currently available skill points
- Update reactively when allocation occurs

This should remain visually present but not dominant.

## 3. Layout Contract

Use a two-region layout:

- Left / center: Talent Wheel
- Right: Jewel Inventory panel

A small top or top-left overlay may contain:

- Skill points
- Title / label if needed

The Talent Wheel should visually dominate the screen.

The Inventory should be clearly readable but secondary.

## 4. Talent Wheel Design

### 4.1 Wheel Shape

The wheel should be presented as a bottom-half / lower-arc socket wheel, inspired by the user sketch.

It should imply continuation beyond the visible socket range, but V1 does not need to render an actually infinite wheel.

The wheel is a snap-based selector, not a free-spin carousel.

### 4.2 Socket Model

Each socket has:

- A stable logical index
- Empty or occupied state
- Selected or unselected state

At all times:

- Exactly one socket is selected

Visual states must clearly distinguish:

- Empty socket
- Occupied socket
- Selected socket

Selected socket should be strongly highlighted.

### 4.3 Visible Socket Count

The wheel should render only a limited visible subset of sockets at once.

Recommended V1 range:

- 5 to 7 visible sockets

The system may support more logical sockets than are visible.

### 4.4 Selection Behavior

Changing the selected socket:

- Updates the selected socket index in React state
- Triggers wheel snap animation
- Collapses the previously focused jewel
- Expands the newly focused jewel if occupied

This transition should feel smooth and deliberate.

No inertial or analog spinning is required in V1.

## 5. Focused Jewel Presentation

### 5.1 Expansion Rule

Only the jewel in the currently selected socket may unfold.

All other equipped jewels remain collapsed and represented only by their socket occupancy.

### 5.2 Jewel Layout

Each jewel contains:

- 4 small nodes
- 1 notable node

V1 presentation should use a simple structured layout, not a complex talent graph.

Recommended layout qualities:

- Clean
- Directional
- Readable
- Easy to animate

The notable must be visually treated as the final outer node.

### 5.3 Node Progression

Node progression must visually communicate order.

Recommended V1 assumption:

- Entry-side node nearest socket
- Then progressive outward advancement
- Notable at the final outer position

The UI does not need to imply multiple possible routes. V1 should present jewels as a simple progression path.

### 5.4 Node States

Each node must support these visual states:

- **Locked**: not currently allocatable
- **Available**: can be allocated with current path and skill points
- **Allocated**: already active

These states must be readable without opening tooltips.

### 5.5 Node Interaction

#### Hover

Hovering a node should:

- Visually highlight the node
- Show tooltip / details
- Indicate whether it is locked, available, or allocated

#### Click

Clicking a node should:

- Allocate the node if valid
- Do nothing if invalid, optionally with light feedback

The UI must not allow allocation through visual state only; the actual allocation validity must come from gameplay state.

## 6. Inventory Panel Design

### 6.1 Layout

The Jewel Inventory should be a right-side vertical scroll panel.

Recommended V1 layout:

- One-column list for clarity
- Two-column only if visual density remains clean

Prefer readability over compactness.

### 6.2 Jewel Card Presentation

Each jewel card should show:

- Category identity
- Jewel summary
- Compact modifier preview, preferably notable-first
- Occupied/selected/equipped context if relevant

Cards should feel like inspectable game items, not plain list rows.

### 6.3 Inventory Interaction

#### Hover

Hovering a jewel card should:

- Visually highlight the card
- Show fuller jewel details or modifier list

#### Click

Clicking a jewel card should:

- Equip the jewel into the currently selected socket, subject to gameplay rules

V1 should prefer simple explicit click behavior over drag-and-drop.

## 7. Animation Contract

### 7.1 React Responsibilities

React is the source of truth for:

- Whether the talent UI is open
- Selected socket index
- Equipped jewels
- Inventory jewels
- Hovered jewel / hovered node
- Allocated node state
- Available skill points
- Tooltip content state

React must own UI truth. Animation libraries must not own persistent gameplay state.

### 7.2 Motion Responsibilities

Motion is used for standard UI interaction polish.

Use Motion for:

- Hover scale on nodes
- Hover scale on jewel cards
- Fade/slide for tooltips
- Small activation pop when allocating a node
- Panel reveal/hide transitions if needed
- Soft focus emphasis on selected UI pieces

Motion should handle local interaction animation.

### 7.3 GSAP Responsibilities

GSAP is used for the showpiece movement layer.

Use GSAP for:

- Snapping the wheel to a newly selected socket
- Collapsing the previously focused jewel
- Unfolding the newly focused jewel
- Sequencing node reveal during jewel expansion if desired

GSAP should not be used for ordinary hover/fade work.

### 7.4 Animation Rule

React owns state. GSAP and Motion animate to match that state.

Do not let GSAP become an alternate state machine.

This is a hard design rule.

## 8. State and Data Boundaries

The UI must consume cluster jewel gameplay state through a clean data interface.

The UI should not invent or duplicate gameplay rules.

Recommended conceptual data sources:

- Equipped jewel list by socket
- Selected socket index
- Node allocation state
- Node metadata
- Skill point count
- Inventory jewel list

The UI should call explicit actions for:

- Selecting a socket
- Equipping a jewel
- Allocating a node

The UI should not mutate gameplay state directly.

## 9. V1 Interaction Flow

### 9.1 Open Talent Screen

When the player opens the talent screen:

- The wheel is shown
- A socket is selected
- Skill points are shown
- The inventory panel is visible

### 9.2 Select Socket

When the player changes selected socket:

- React updates selected socket index
- GSAP rotates/snaps the wheel
- Previous jewel folds away
- New jewel unfolds if present

### 9.3 Inspect Jewel in Inventory

When the player hovers a jewel in the inventory:

- Details appear
- Card is highlighted

### 9.4 Equip Jewel

When the player clicks an inventory jewel:

- That jewel is equipped into the selected socket according to gameplay rules
- The selected socket now shows the equipped jewel
- If the selected socket remains selected, that jewel unfolds

### 9.5 Inspect Node

When the player hovers a node:

- Tooltip/details appear
- Node highlights

### 9.6 Allocate Node

When the player clicks an available node:

- Allocation request is sent
- If successful, skill points update
- Node transitions visually into allocated state

## 10. Visual Identity Rules

### Category Accent Colors

Each jewel category should have a distinct accent color or visual identity treatment.

This should appear in:

- Jewel cards
- Node glow / border
- Selected jewel visuals
- Tooltip accents if appropriate

### Readability First

The UI must prioritize:

- State readability
- Node readability
- Socket readability

Do not sacrifice clarity for spectacle in V1.

### Premium Feel

The UI should feel intentional through:

- Soft depth
- Glow accents
- Clean transitions
- Controlled motion
- Restrained visual language

## 11. Technical Strategy

This UI may be built as an isolated React surface or panel system, but it must remain compatible with the game's actual progression state.

Recommended strategy:

- Keep UI components modular
- Keep gameplay logic outside UI components
- Use typed UI-facing view models where useful
- Keep wheel layout rules deterministic
- Avoid bespoke per-node rendering logic in V1

## 12. V1 Simplification Rules

To keep implementation safe, V1 should deliberately simplify:

- Jewel node layout should be fixed-pattern
- Sockets should snap, not free-spin
- Inventory should be click-to-equip
- One focused jewel only
- No branching node graph
- No deep nested menu flow
- No visual crafting/reroll layers
- No drag-and-drop
- No corruption support

These are not rejections of future features. They are explicit V1 scope protection.

## 13. Acceptance Criteria

This UI contract is satisfied when:

- The talent screen renders a lower-arc socket wheel.
- One socket is always selected.
- Selecting a different socket snaps the wheel using GSAP.
- Only the focused socket's jewel unfolds.
- The focused jewel clearly displays 4 small nodes and 1 notable.
- Nodes visibly distinguish locked, available, and allocated.
- Hovering nodes shows useful details.
- Clicking a valid node allocates it.
- A right-side inventory panel shows obtained jewels.
- Hovering inventory jewels shows details.
- Clicking an inventory jewel equips it into the selected socket.
- Skill points are visibly displayed and update correctly.
- React, Motion, and GSAP each have a real but scoped role.
- The UI feels clean and polished, not debug-only.

## 14. Future Extensions (Not V1)

These are allowed future directions but explicitly out of current scope:

- Drag-and-drop equipping
- Controller navigation polish
- Advanced inventory filtering/sorting
- Socket unlock presentation
- Corruption UI
- Reroll/crafting UI
- More complex jewel graph shapes
- Background cinematic effects
- Particle/VFX support
- Relic integration overlays

## Final Contract Statement

V1 cluster jewel UI should be implemented as a state-driven React interface with a premium but contained animation layer, where Motion handles local interaction polish and GSAP handles the central wheel and jewel transformation motion. The UI should faithfully represent the cluster jewel system without overcomplicating the first version, and should establish a strong, extensible foundation for future polish and system growth.
