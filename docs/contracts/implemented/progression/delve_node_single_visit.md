# DELVE Node Single-Visit Contract

Status: Active  
Owner: RatGame  
Scope: Delve Map traversal rules

## 1) Summary

Each node on the Delve map may be visited exactly once per run.

Once a node is cleared:

- it becomes locked
- the player cannot enter it again
- heat progression cannot be exploited by revisiting nodes

This guarantees:

`nodesCleared == runHeat`

and ensures Heat progression remains correct.

## 2) Node State Model

Each node must track its state.

Required state enum:

- `UNVISITED`
- `ACTIVE`
- `CLEARED`

Optional future state:

- `LOCKED`

But `CLEARED` can also act as locked.

## 3) Node Entry Rules

A node may be entered only if:

`node.state == UNVISITED`

Attempting to enter any other state must fail.

Example guard:

```txt
if node.state != UNVISITED:
    return
```

## 4) Node Clear Flow

When a node is completed:

- Node objective completes
- Rewards granted
- Node state set to `CLEARED`
- Heat increments: `runHeat += 1`
- Delve map becomes active again

## 5) Map Rendering Rules

Nodes must visually communicate state.

Recommended visuals:

| State | Visual |
| --- | --- |
| `UNVISITED` | normal |
| `ACTIVE` | highlighted |
| `CLEARED` | dimmed / crossed / faded |

`CLEARED` nodes must not look selectable.

## 6) Pathing Rules

Player may move only to nodes that are:

- connected AND `state == UNVISITED`

Connections remain visible, but cleared nodes cannot be used as destinations.

## 7) Input Handling

When clicking/tapping a node:

`if node.state != UNVISITED: ignore input`

No transition should occur.

## 8) Safety Guards

Even if UI fails, gameplay must enforce this rule.

Node start logic must also verify:

`assert node.state == UNVISITED`

before allowing floor generation.

## 9) Save State

Node states must be serialized in run save state.

Required fields per node:

- `nodeId`
- `state`

## 10) Heat Integrity Rule

Heat must increase exactly once per node clear.

Because nodes are single visit:

`runHeat == numberOfNodesCleared`

This is a critical invariant.

## 11) Done Definition

This contract is done when:

1. nodes cannot be entered twice
2. node state persists across run state
3. heat increments exactly once per node clear
4. UI clearly shows cleared nodes as unavailable
5. input ignores cleared nodes

## Optional (Recommended Improvement)

Instead of only dimming cleared nodes, add path progression visualization:

- ● cleared
- ○ available
- × locked

This makes the map feel strategic and readable.

## One more thing you should probably do (very important)

Your Heat system + single visit rule now allows a clean invariant:

`runHeat = nodesCleared`

You can use this everywhere instead of tracking two things.

Which simplifies debugging massively.
