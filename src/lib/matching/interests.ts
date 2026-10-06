/** Interests a member can pick for cosmic matching. Stable ids; labels may change. */
export const MATCH_INTERESTS = [
  { id: "kp-horary", label: "KP horary" },
  { id: "kp-timing", label: "Dashas & timing" },
  { id: "human-design", label: "Human Design" },
  { id: "astrocartography", label: "Astrocartography & travel" },
  { id: "starseed", label: "Starseed origins" },
  { id: "meditation", label: "Meditation & breath" },
  { id: "creative", label: "Creative work" },
  { id: "business", label: "Business & craft" },
  { id: "relationships", label: "Relationships" },
  { id: "healing", label: "Healing arts" },
  { id: "research", label: "Research & study" },
  { id: "teaching", label: "Teaching & mentoring" },
] as const;

export type MatchInterestId = (typeof MATCH_INTERESTS)[number]["id"];

export const MATCH_INTEREST_IDS: ReadonlySet<string> = new Set(MATCH_INTERESTS.map((i) => i.id));

export function interestLabel(id: string): string {
  return MATCH_INTERESTS.find((i) => i.id === id)?.label ?? id;
}
