export type MonolithicBuildingSemanticPlacementFallback = {
  canonicalSpriteId: string;
  bySpriteId: Record<string, {
    n: number;
    m: number;
    heightUnits: number;
    tileHeightUnits?: number;
  }>;
};

const HEIGHT_UNITS = 32;

export const MONOLITHIC_BUILDING_SEMANTIC_PLACEMENT_FALLBACK:
Record<string, MonolithicBuildingSemanticPlacementFallback> = {
  avenue_1: {
    canonicalSpriteId: "structures/buildings/avenue/1",
    bySpriteId: {
      "structures/buildings/avenue/1": { n: 3, m: 2, heightUnits: HEIGHT_UNITS },
    },
  },
  avenue_2: {
    canonicalSpriteId: "structures/buildings/avenue/2",
    bySpriteId: {
      "structures/buildings/avenue/2": { n: 3, m: 2, heightUnits: HEIGHT_UNITS },
    },
  },
  avenue_3: {
    canonicalSpriteId: "structures/buildings/avenue/3",
    bySpriteId: {
      "structures/buildings/avenue/3": { n: 3, m: 3, heightUnits: HEIGHT_UNITS },
    },
  },
  avenue_4: {
    canonicalSpriteId: "structures/buildings/avenue/4",
    bySpriteId: {
      "structures/buildings/avenue/4": { n: 3, m: 3, heightUnits: HEIGHT_UNITS },
    },
  },
  avenue_5: {
    canonicalSpriteId: "structures/buildings/avenue/5",
    bySpriteId: {
      "structures/buildings/avenue/5": { n: 2, m: 2, heightUnits: HEIGHT_UNITS },
    },
  },
  avenue_6: {
    canonicalSpriteId: "structures/buildings/avenue/6",
    bySpriteId: {
      "structures/buildings/avenue/6": { n: 3, m: 2, heightUnits: HEIGHT_UNITS },
    },
  },
  avenue_7: {
    canonicalSpriteId: "structures/buildings/avenue/7",
    bySpriteId: {
      "structures/buildings/avenue/7": { n: 3, m: 3, heightUnits: HEIGHT_UNITS },
    },
  },
  downtown_1: {
    canonicalSpriteId: "structures/buildings/downtown/1",
    bySpriteId: {
      "structures/buildings/downtown/1": { n: 5, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/1/e": { n: 7, m: 5, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/1/n": { n: 5, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/1/s": { n: 5, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/1/w": { n: 7, m: 5, heightUnits: HEIGHT_UNITS },
    },
  },
  downtown_2: {
    canonicalSpriteId: "structures/buildings/downtown/2",
    bySpriteId: {
      "structures/buildings/downtown/2": { n: 4, m: 4, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/2/e": { n: 4, m: 4, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/2/n": { n: 4, m: 4, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/2/s": { n: 4, m: 4, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/2/w": { n: 4, m: 4, heightUnits: HEIGHT_UNITS },
    },
  },
  downtown_3: {
    canonicalSpriteId: "structures/buildings/downtown/3",
    bySpriteId: {
      "structures/buildings/downtown/3": { n: 7, m: 6, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/3/e": { n: 6, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/3/n": { n: 7, m: 6, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/3/s": { n: 7, m: 6, heightUnits: HEIGHT_UNITS },
      "structures/buildings/downtown/3/w": { n: 6, m: 7, heightUnits: HEIGHT_UNITS },
    },
  },
  downtown_4: {
    canonicalSpriteId: "structures/buildings/downtown/4",
    bySpriteId: {
      "structures/buildings/downtown/4": { n: 5, m: 5, heightUnits: HEIGHT_UNITS },
    },
  },
  china_town_1: {
    canonicalSpriteId: "structures/buildings/china_town/1",
    bySpriteId: {
      "structures/buildings/china_town/1": { n: 3, m: 2, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/1/e": { n: 2, m: 3, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/1/n": { n: 3, m: 2, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/1/s": { n: 3, m: 2, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/1/w": { n: 2, m: 3, heightUnits: HEIGHT_UNITS },
    },
  },
  china_town_2: {
    canonicalSpriteId: "structures/buildings/china_town/2",
    bySpriteId: {
      "structures/buildings/china_town/2": { n: 3, m: 2, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/2/e": { n: 3, m: 4, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/2/n": { n: 3, m: 5, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/2/s": { n: 4, m: 3, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/2/w": { n: 4, m: 4, heightUnits: HEIGHT_UNITS },
    },
  },
  china_town_3: {
    canonicalSpriteId: "structures/buildings/china_town/3",
    bySpriteId: {
      "structures/buildings/china_town/3": { n: 3, m: 2, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/3/e": { n: 6, m: 6, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/3/n": { n: 6, m: 6, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/3/s": { n: 6, m: 6, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/3/w": { n: 6, m: 6, heightUnits: HEIGHT_UNITS },
    },
  },
  china_town_4: {
    canonicalSpriteId: "structures/buildings/china_town/4/n",
    bySpriteId: {
      "structures/buildings/china_town/4/e": { n: 6, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/4/n": { n: 6, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/4/s": { n: 6, m: 6, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/4/w": { n: 7, m: 7, heightUnits: HEIGHT_UNITS },
    },
  },
  china_town_5: {
    canonicalSpriteId: "structures/buildings/china_town/5",
    bySpriteId: {
      "structures/buildings/china_town/5": { n: 3, m: 3, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/5/e": { n: 7, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/5/n": { n: 7, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/5/s": { n: 6, m: 7, heightUnits: HEIGHT_UNITS },
      "structures/buildings/china_town/5/w": { n: 7, m: 7, heightUnits: HEIGHT_UNITS },
    },
  },
};
