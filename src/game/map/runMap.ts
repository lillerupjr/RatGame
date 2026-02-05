// src/game/map/runMap.ts
import type { StageId } from "../content/stages";

export type MapNodeType = "ZONE";

export type MapNode = {
    id: string;

    // Slay-the-Spire-like layout fields (not fully used yet, but future-proof)
    col: number; // 0..(cols-1)
    row: number; // 0..(rows-1)

    type: MapNodeType;

    // First-class zone node (faction/biome later)
    zoneId: StageId;
    title: string;
};

export type MapEdge = { from: string; to: string };

export type RunMap = {
    cols: number;
    rows: number;
    nodes: MapNode[];
    edges: MapEdge[];
};

/** Build the static run map graph used for legacy routing. */
export function buildStaticRunMap(): RunMap {
    // v0: single mandatory route
    const nodes: MapNode[] = [
        // 5 cols (0..4), 4 rows (0..3): spread diagonally, centered lanes
        { id: "N_DOCKS",     col: 2, row: 2, type: "ZONE", zoneId: "DOCKS",     title: "Docks" },
        { id: "N_SEWERS",    col: 2, row: 1, type: "ZONE", zoneId: "SEWERS",    title: "Sewers" },
        { id: "N_CHINATOWN", col: 2, row: 0, type: "ZONE", zoneId: "CHINATOWN", title: "Chinatown" },
    ];

    const edges: MapEdge[] = [
        { from: "N_DOCKS", to: "N_SEWERS" },
        { from: "N_SEWERS", to: "N_CHINATOWN" },
    ];

    return {
        cols: 5,
        rows: 4,
        nodes,
        edges,
    };
}

/** Find a node by id within a run map. */
export function getNode(g: RunMap, id: string): MapNode | undefined {
    return g.nodes.find((n) => n.id === id);
}

/** Return nodes reachable from the given node id. */
export function getReachable(g: RunMap, fromId: string | null): MapNode[] {
    // Start-of-run: reachable nodes are those with no incoming edges
    if (!fromId) {
        const hasIncoming = new Set<string>();
        for (const e of g.edges) hasIncoming.add(e.to);
        return g.nodes.filter((n) => !hasIncoming.has(n.id));
    }

    const tos: string[] = [];
    for (const e of g.edges) if (e.from === fromId) tos.push(e.to);
    return tos.map((id) => getNode(g, id)).filter(Boolean) as MapNode[];
}
