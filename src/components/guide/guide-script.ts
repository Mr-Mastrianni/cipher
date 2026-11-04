import type { SkyView } from "@/components/cipher/sky/layout";

/**
 * What the guide says. Scripted on purpose: every line here is a fact about
 * the site, checked against the site, and nothing is generated at runtime.
 */

export const GUIDE_NAME = "Your guide";

export const GREETING =
  "Welcome. I can show you around the Cipher: what is here, how to read it, and where to begin. What would you like to know?";

export interface GuideAction {
  label: string;
  /** A place in the sky, reached the way the site's own links reach it. */
  to?: SkyView | null;
  /** Or a page of its own. */
  href?: string;
}

export interface GuideTopic {
  id: string;
  /** The chip the visitor taps. */
  label: string;
  lines: readonly string[];
  actions: readonly GuideAction[];
  /**
   * What she flies to while she explains, in order of preference: the ids of
   * page elements tagged `data-guide`, or `earth-view` for the planet drawn in
   * the scene. The first one on screen wins; none means she stays where she is.
   */
  targets?: readonly string[];
}

export const TOPICS: readonly GuideTopic[] = [
  {
    id: "start",
    label: "Where do I start?",
    lines: [
      "Begin with your chart. Give the date, the time and the place you were born, and the Cipher casts a KP chart and a Human Design bodygraph from that one instant.",
      "It is free to cast, and you do not need an account to see your reading.",
    ],
    actions: [{ label: "Cast my chart", to: "sun" }],
    targets: ["cast", "place-sun"],
  },
  {
    id: "this-page",
    label: "What am I looking at?",
    lines: [
      "The Earth is the centre of the sky, as it is in a chart, and the nearest bodies circle it. Drag to look around.",
      "Each planet keeps part of the site: the Sun holds your chart, Jupiter the Method, Venus Membership, Mars the World, and the Earth the Collective.",
    ],
    actions: [{ label: "See the whole sky", to: "sky" }],
    targets: ["earth-view"],
  },
  {
    id: "kp",
    label: "What is KP astrology?",
    lines: [
      "Krishnamurti Paddhati is a sidereal system. The Cipher uses only KP: the sidereal zodiac, Placidus houses, and sub lords that refine what each planet promises.",
      "Every chart is cast from a birth time given to the second, after you confirm the time zone and daylight saving.",
    ],
    actions: [{ label: "Read the Method", to: "jupiter" }],
    targets: ["place-jupiter", "nav-method"],
  },
  {
    id: "hd",
    label: "What is Human Design?",
    lines: [
      "Human Design turns the moment of birth into a bodygraph: nine centres, thirty-six channels, and a type, authority and profile.",
      "Here the Design side is found by the Sun's true arc, 88 degrees before birth, not simply 88 days.",
    ],
    actions: [{ label: "Read the Method", to: "jupiter" }],
    targets: ["place-jupiter", "nav-method"],
  },
  {
    id: "collective",
    label: "What is the Collective?",
    lines: [
      "The Starseed Collective is the community: themed rooms, live calls and events, courses and flashcards, and cosmic matching if you choose to opt in.",
    ],
    actions: [{ label: "Visit the Collective", to: "earth" }],
    targets: ["place-earth", "nav-collective"],
  },
  {
    id: "world",
    label: "What is the World?",
    lines: [
      "A valley you can walk, run and fly through together. Your chart hangs in the Observatory, and your people gather in the Commons.",
    ],
    actions: [{ label: "Enter the world", href: "/world" }],
    targets: ["place-mars", "nav-world"],
  },
  {
    id: "membership",
    label: "How does membership work?",
    lines: [
      "There is a free way in, and tiered membership beyond it. The Membership page shows each tier and what it holds.",
    ],
    actions: [
      { label: "See membership", to: "venus" },
      { label: "Join", href: "/sign-up" },
    ],
    targets: ["place-venus", "nav-membership"],
  },
  {
    id: "privacy",
    label: "Is my birth data private?",
    lines: [
      "A shared reading is computed from its own link, so the Cipher does not need to store it.",
      "While you fill in the onboarding, your draft stays in your own browser until you submit it.",
    ],
    actions: [],
  },
];
