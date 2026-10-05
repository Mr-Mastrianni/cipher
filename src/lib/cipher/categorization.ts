import {
  CENTER_MAP,
  MOTOR_CENTERS,
  type CenterKey,
} from "@/lib/human-design/constants";
import type { AuraAvatar } from "./aura-avatar";

/**
 * Onboarding categorisation.
 *
 * Once the chart is computed the member is placed: into a type cohort for the
 * community, into a circuit archetype for how they work, and into a lane taken
 * from their Aura Avatar format. Alongside that we derive an honest strengths
 * list from the defined centres and a growth-edge list from the open ones.
 *
 * The framing matters and is deliberate: **an open centre is not a weakness.**
 * It is an area of life where the person takes in and amplifies what is around
 * them, and where wisdom is available if they stop letting the mind run it.
 * The copy below is written to be useful rather than flattering or damning.
 */

/* ---------------------------------------------------------------------------
   Structural input types
   Kept structural so this module does not couple to the bodygraph engine's
   exact exported type names.
   ------------------------------------------------------------------------- */

export interface CategorizationInput {
  type: string;
  authority: string;
  profile: string;
  definition: string;
  centers: Record<CenterKey, { defined: boolean }>;
  channels: Array<{
    gates: readonly [number, number];
    circuit: "individual" | "tribal" | "collective";
  }>;
  gates?: number[];
}

export interface CenterRead {
  key: CenterKey;
  name: string;
  defined: boolean;
  /** What it gives you when defined, or what it teaches when open. */
  strength?: string;
  growthEdge?: string;
  /** The question that turns an open centre into wisdom. */
  question?: string;
}

export interface Cohort {
  id: string;
  name: string;
  /** Community channel slug this cohort is placed in. */
  channel: string;
  description: string;
}

export interface MemberCategory {
  /** Primary placement — the type cohort. */
  cohort: Cohort;
  /** How this person works, from the dominant circuitry of their definition. */
  archetype: Cohort;
  /** What they make, from the Aura Avatar format. */
  lane: Cohort;
  /** Defined centres, phrased as capacities. */
  strengths: string[];
  /** Open centres, phrased as edges rather than deficits. */
  growthEdges: string[];
  /** Compact tags used for matching and channel suggestions. */
  tags: string[];
  /** Every centre with its individual read. */
  centerReads: CenterRead[];
}

/* ---------------------------------------------------------------------------
   Vocabulary
   ------------------------------------------------------------------------- */

const STRENGTH_BY_DEFINED_CENTRE: Record<CenterKey, string> = {
  head: "Steady mental pressure — you produce questions worth chasing, on demand.",
  ajna: "A fixed conceptual frame — you can hold a position while it is being tested.",
  throat: "Reliable expression. Your voice is an organ, not a mood.",
  g: "Stable identity and direction. You know which way is yours without arguing for it.",
  heart: "Accessible willpower — you can make promises about material things and keep them.",
  spleen: "Instant, immune-level knowing. Your first read is usually the accurate one.",
  solar: "A deep emotional wave you can trust over time, not in the moment.",
  sacral: "Sustainable life force. You can work, and then keep working.",
  root: "Pressure you can convert. Adrenal load becomes output instead of anxiety.",
};

const EDGE_BY_OPEN_CENTRE: Record<CenterKey, string> = {
  head: "Other people's questions arrive feeling like your own. You do not have to answer them.",
  ajna: "Spend enough time around an idea and you will become certain of it. Certainty is not evidence.",
  throat: "You talk to fill silence, and then believe what you said. The pause is the practice.",
  g: "You take on the identity of whatever room you are standing in. Choose the room deliberately.",
  heart: "You promise more than your will can actually pay for, and then resent the debt.",
  spleen: "You hold on to what is already gone, because the body never got the signal to let go.",
  solar: "You amplify other people's weather and then call it your own. Wait for the wave to pass.",
  sacral: "You do not know when to stop. The stopping has to be decided before you start.",
  root: "You rush to escape pressure that was never yours to carry. Slow is available.",
};

const QUESTION_BY_OPEN_CENTRE: Record<CenterKey, string> = {
  head: "Is this question mine?",
  ajna: "Do I actually know this, or have I just been near it?",
  throat: "Am I speaking because it is true, or because it is quiet?",
  g: "Is this direction mine, or the room's?",
  heart: "Do I have the will for this, not just the want?",
  spleen: "What am I still holding that has already ended?",
  solar: "Whose feeling is this, and does it survive the night?",
  sacral: "Do I have the energy for this, right now, in my body?",
  root: "What am I rushing to get away from?",
};

const TYPE_COHORTS: Record<string, Cohort> = {
  Generator: {
    id: "cohort-engine",
    name: "The Engines",
    channel: "the-engines",
    description:
      "Generators in one room. The work gets done here, and the only real question in the room is whether you said yes to it.",
  },
  "Manifesting Generator": {
    id: "cohort-current",
    name: "The Current",
    channel: "the-current",
    description:
      "Multi-passionate, fast, and allergic to being slowed down. Skip the steps. Come back and tell us what happened.",
  },
  Manifestor: {
    id: "cohort-ignition",
    name: "The Ignition",
    channel: "the-ignition",
    description:
      "The initiators. Nobody here needs permission, and everybody here has learned the cost of not informing first.",
  },
  Projector: {
    id: "cohort-lens",
    name: "The Lens",
    channel: "the-lens",
    description:
      "The ones who see the other clearly. This room is where that sight is invited, used, and paid for.",
  },
  Reflector: {
    id: "cohort-mirror",
    name: "The Mirror",
    channel: "the-mirror",
    description:
      "Rare, lunar, and never in a hurry. This room runs on a twenty-eight day clock and means it.",
  },
};

const ARCHETYPES: Record<string, Cohort> = {
  individual: {
    id: "arch-mutant",
    name: "The Mutant",
    channel: "archetype-mutant",
    description:
      "Individual circuitry. You are built to be unlike the people around you, and to be unsettling until you are indispensable.",
  },
  tribal: {
    id: "arch-builder",
    name: "The Builder",
    channel: "archetype-builder",
    description:
      "Tribal circuitry. Your work only works inside a group that keeps its agreements — and you are the one who enforces them.",
  },
  collective: {
    id: "arch-archivist",
    name: "The Archivist",
    channel: "archetype-archivist",
    description:
      "Collective circuitry. You process what has already happened and hand it back as something the group can use.",
  },
  bridge: {
    id: "arch-bridge",
    name: "The Bridge",
    channel: "archetype-bridge",
    description:
      "Mixed circuitry. You carry more than one stream, which makes you the translator between rooms that do not speak.",
  },
};

const LANES: Record<string, Cohort> = {
  Investigator: {
    id: "lane-depth",
    name: "Depth",
    channel: "lane-depth",
    description:
      "You go all the way down before you say anything. The work is the descent, not the summary.",
  },
  Influencer: {
    id: "lane-presence",
    name: "Presence",
    channel: "lane-presence",
    description:
      "Your gift does not survive explanation. Show it, and let the room name it.",
  },
  Tester: {
    id: "lane-experiment",
    name: "Experiment",
    channel: "lane-experiment",
    description:
      "You learn out loud and in public, wrong turns included. The failures are the curriculum.",
  },
  Connector: {
    id: "lane-network",
    name: "Network",
    channel: "lane-network",
    description:
      "Nothing reaches you except through people. Your leverage is the relationships you keep honestly.",
  },
  Fixer: {
    id: "lane-solution",
    name: "Solution",
    channel: "lane-solution",
    description:
      "You get handed the impossible one and solve it practically. Expect to be projected on.",
  },
  Exemplar: {
    id: "lane-example",
    name: "Example",
    channel: "lane-example",
    description:
      "You are not here to do it first. You are here to be the version other people can copy.",
  },
};

/* ---------------------------------------------------------------------------
   The categoriser
   ------------------------------------------------------------------------- */

export function categorizeMember(
  input: CategorizationInput,
  avatar: AuraAvatar | null,
): MemberCategory {
  const definedKeys = (Object.keys(input.centers) as CenterKey[]).filter(
    (key) => input.centers[key]?.defined,
  );
  const openKeys = (Object.keys(input.centers) as CenterKey[]).filter(
    (key) => !input.centers[key]?.defined,
  );

  const strengths = definedKeys.map((key) => STRENGTH_BY_DEFINED_CENTRE[key]);
  const growthEdges = openKeys.map((key) => EDGE_BY_OPEN_CENTRE[key]);

  const centerReads: CenterRead[] = (Object.keys(CENTER_MAP) as CenterKey[]).map(
    (key) => {
      const defined = Boolean(input.centers[key]?.defined);
      return {
        key,
        name: CENTER_MAP[key].name,
        defined,
        strength: defined ? STRENGTH_BY_DEFINED_CENTRE[key] : undefined,
        growthEdge: defined ? undefined : EDGE_BY_OPEN_CENTRE[key],
        question: defined ? undefined : QUESTION_BY_OPEN_CENTRE[key],
      };
    },
  );

  // Cohort by type. Unknown types fall back to the Lens rather than throwing.
  const cohort = TYPE_COHORTS[input.type] ?? TYPE_COHORTS.Projector;

  // Archetype from the dominant circuitry among defined channels.
  const circuitCounts: Record<string, number> = {
    individual: 0,
    tribal: 0,
    collective: 0,
  };
  for (const channel of input.channels) {
    circuitCounts[channel.circuit] = (circuitCounts[channel.circuit] ?? 0) + 1;
  }
  const ranked = Object.entries(circuitCounts).sort((a, b) => b[1] - a[1]);
  const dominant = ranked[0];
  const tied = ranked.length > 1 && ranked[1][1] === dominant[1] && dominant[1] > 0;
  const archetype = tied
    ? ARCHETYPES.bridge
    : (ARCHETYPES[dominant?.[0]] ?? ARCHETYPES.bridge);

  const lane = avatar ? (LANES[avatar.format] ?? LANES.Investigator) : LANES.Investigator;

  const tags = [
    input.type.toLowerCase().replace(/\s+/g, "-"),
    input.authority.toLowerCase().replace(/\s+/g, "-"),
    input.definition.toLowerCase().replace(/\s+/g, "-"),
    dominant?.[0] ?? "mixed",
    avatar?.format.toLowerCase() ?? "investigator",
  ];

  return { cohort, archetype, lane, strengths, growthEdges, tags, centerReads };
}

/**
 * A short, human sentence summarising the placement, used on the reveal screen.
 */
export function summariseCategory(
  category: MemberCategory,
  input: Pick<CategorizationInput, "type" | "authority" | "profile">,
): string {
  const motorNote = input.type.startsWith("Manifest")
    ? "Your motor is wired to your voice, so the world feels your movement before it understands it."
    : input.authority === "Emotional"
      ? "Nothing is true for you in the moment. You get there by riding the wave all the way down."
      : "Your clarity is fast and quiet, which is exactly why it is easy to talk yourself out of.";
  return `${input.type}, ${input.profile}, ${input.authority} authority. ${motorNote}`;
}

/** Convenience for the onboarding summary chips. */
export function categoryChips(input: CategorizationInput): string[] {
  const definedCount = (Object.keys(input.centers) as CenterKey[]).filter(
    (key) => input.centers[key]?.defined,
  ).length;
  const motors = (Object.keys(input.centers) as CenterKey[]).filter(
    (key) => MOTOR_CENTERS.includes(key) && input.centers[key]?.defined,
  ).length;
  return [
    input.type,
    input.profile,
    `${input.authority} authority`,
    input.definition,
    `${definedCount}/9 centres defined`,
    `${motors}/4 motors`,
  ];
}
