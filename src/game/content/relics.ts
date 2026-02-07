export type RelicDef = {
  id: string;
  title: string;
  desc: string;
};

export const RELICS: RelicDef[] = [
  {
    id: "RELIC_TRAINING",
    title: "Training Emblem",
    desc: "Gain 5% more experience.",
  },
  {
    id: "RELIC_STURDY",
    title: "Sturdy Charm",
    desc: "Gain 5% max HP.",
  },
];

export function getRelicDef(id: string): RelicDef | undefined {
  return RELICS.find((relic) => relic.id === id);
}
