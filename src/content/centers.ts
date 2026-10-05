/**
 * The nine centres — editorial content.
 *
 * Structural facts (name, kind, biology, gate membership) come from
 * `@/lib/human-design/constants`. This file adds only the reading: what a
 * centre does when it is consistently defined, what an open centre takes in,
 * and the question that turns that openness into wisdom.
 */

import type { CenterKey, CenterMeta } from "@/lib/human-design/constants";

export interface CenterContent {
  key: CenterKey;
  /** Display name, matching `CENTER_MAP`. */
  name: string;
  /** Centre class, matching `CENTER_MAP`. */
  kind: CenterMeta["kind"];
  /** Biological correlation as taught in the system. */
  biology: string;
  /** Short title for the defined state. */
  definedTitle: string;
  /** Short title for the open state. */
  openTitle: string;
  /** What it is to have this centre consistently defined. */
  defined: string;
  /** What it is to have this centre open: amplification, wisdom, and the trap. */
  open: string;
  /** The flavour of suffering when an open centre is run by the mind. */
  notSelf: string;
  /** The question that turns this open centre into wisdom. */
  question: string;
}

export const CENTER_CONTENT: readonly CenterContent[] = [
  {
    key: "head",
    name: "Head",
    kind: "pressure",
    biology: "Pineal gland",
    definedTitle: "Steady pressure to think",
    openTitle: "Amplified inspiration",
    defined:
      "You live under a steady, low-grade pressure to make meaning, and inspiration arrives on its own schedule. Questions form in you whether or not anyone asked them, and you can hold the discomfort of not knowing for a long time. This is not a mood. It is a consistent mental pressure that will spend itself if you let it.",
    open:
      "You take in the mental pressure around you and turn the volume up. In a room of anxious thinkers you become the most anxious thinker there. The wisdom on offer is discrimination: you can feel which questions are worth answering and which are only noise. The trap is believing every question that arrives is yours to resolve, so you spend a life answering other people's wondering.",
    notSelf:
      "A buzzing, borrowed urgency to know — as though the answer is late and you are to blame.",
    question: "Which of these questions is actually mine to think about?",
  },
  {
    key: "ajna",
    name: "Ajna",
    kind: "awareness",
    biology: "Pituitary gland",
    definedTitle: "A fixed way of thinking",
    openTitle: "Many minds at once",
    defined:
      "Your mind has a shape. Concepts settle into a consistent architecture, and you can return to the same opinion years later and find it standing. People come to you for a verdict because yours does not wobble. The cost is that you can mistake your architecture for the truth.",
    open:
      "You can hold several contradictory views at once without distress, which makes you unusually good at understanding people you disagree with. The wisdom is flexibility: nothing you think has to harden into who you are. The trap is performing certainty, because an open mind under pressure will grip a conclusion just to feel safe.",
    notSelf:
      "Quiet panic about being thought stupid, followed by a rigid opinion defended past the point of honesty.",
    question: "Can I stay curious here, or am I only trying to look certain?",
  },
  {
    key: "throat",
    name: "Throat",
    kind: "expression",
    biology: "Thyroid and parathyroid",
    definedTitle: "A consistent voice",
    openTitle: "Amplified speech",
    defined:
      "Expression moves through you reliably. You have a way of saying things that stays recognisably yours across contexts, and you rarely lose the thread. What you say tends to be met, which is precisely why it matters what you choose to put into the world.",
    open:
      "You are a loudspeaker for the room. Whatever is in the air comes out of your mouth with more force than it had inside you. The wisdom is knowing the difference between speech that is being pulled out of you and speech that is being asked for. The trap is talking in order to be seen, then feeling unseen anyway.",
    notSelf:
      "The ache of speaking and not being heard, followed by speaking louder.",
    question: "If no one were going to react, what would still be worth saying?",
  },
  {
    key: "g",
    name: "G Center",
    kind: "identity",
    biology: "Liver and blood",
    definedTitle: "A fixed self and direction",
    openTitle: "Identity shaped by place",
    defined:
      "You carry a centre of gravity. Your sense of who you are does not depend on the room, and your direction tends to reveal itself as a line rather than a decision. Love, for you, is specific: it knows whom and what it is for.",
    open:
      "Who you are shifts with where you stand and who stands near you, which is not a flaw but a wide range. You can become legible in many worlds. The wisdom is that identity is a question of place and company, not a fact to be found. The trap is a lifelong search for a self that was never supposed to be fixed.",
    notSelf:
      "A drifting sense of having no direction, and the habit of asking other people to tell you who you are.",
    question: "Where am I, and who am I with — and how does that feel in my body?",
  },
  {
    key: "heart",
    name: "Heart",
    kind: "motor",
    biology: "Heart, stomach, and gall bladder",
    definedTitle: "Will that holds",
    openTitle: "Amplified promise",
    defined:
      "Your will is real and it can be spent. When you give your word from this centre, you have the force to keep it, and the material world tends to answer you. The work is proportion: will is a finite resource, and it is only worth spending on what you actually value.",
    open:
      "You can read worth in others with startling accuracy, and you can borrow their will for a while without noticing that it is borrowed. The wisdom is knowing what a thing is worth before promising yourself to it. The trap is proving value by effort, which turns every commitment into a test you must pass.",
    notSelf:
      "The need to prove you are enough, and the exhaustion of promises made to win that proof.",
    question: "Do I actually want this, and do I have the energy to keep my word?",
  },
  {
    key: "spleen",
    name: "Spleen",
    kind: "awareness",
    biology: "Spleen and lymphatic system",
    definedTitle: "A steady inner knowing",
    openTitle: "Amplified instinct",
    defined:
      "You receive quiet, immediate information about what is safe and what is not. It does not argue and it does not repeat, but it is consistent, so your first read of a person or a room is usually worth trusting. You are built to survive by noticing early.",
    open:
      "You feel the health and unhealth of a situation sooner than anyone says it aloud, and you can hold a great deal of it. The wisdom is in letting go: you learn, in your body, what is finished. The trap is that an open spleen keeps what has already died, because holding on feels safer than the gap that follows release.",
    notSelf:
      "A background fear of not having enough, and the stubborn grip on what is already gone.",
    question: "What am I still holding that stopped being alive some time ago?",
  },
  {
    key: "solar",
    name: "Solar Plexus",
    kind: "motor",
    biology: "Kidneys, prostate, and pancreas",
    definedTitle: "The emotional wave",
    openTitle: "Amplified feeling",
    defined:
      "You ride a wave: up, down, and back to level, on a rhythm you do not control. Nothing you feel in a single moment is the whole truth, but the whole truth does arrive if you wait for the water to settle. Your depth is real. It is also slow.",
    open:
      "You amplify the emotional weather of everyone near you, and you can tell what someone is feeling before they know it themselves. The wisdom is emotional literacy: you learn to name what is passing through without becoming it. The trap is keeping the peace by staying quiet, so the truth never gets said and the body keeps the tab.",
    notSelf:
      "Fear of confrontation, and the small betrayals of self that keep a room comfortable.",
    question: "Is this feeling mine, and do I need to wait before I speak from it?",
  },
  {
    key: "sacral",
    name: "Sacral",
    kind: "motor",
    biology: "Ovaries and testes",
    definedTitle: "A renewable life force",
    openTitle: "Amplified capacity",
    defined:
      "You have a generator under the floor. Energy for work arrives as a response — a yes in the gut, a lift in the body — and when it is genuinely yours, it renews. When you are doing the wrong thing the same engine runs hot and grinds. Availability to respond is your natural state.",
    open:
      "You feel other people's capacity as if it were your own, which is why you can keep going long after you are finished. The wisdom is a fine instrument for knowing when enough is enough, for yourself and for the room. The trap is saying yes from someone else's sacral and paying for it with your body's reserves.",
    notSelf:
      "A grind that never quite ends, and the habit of doing more to close a gap that more cannot close.",
    question: "Is this mine to respond to, or am I answering with someone else's energy?",
  },
  {
    key: "root",
    name: "Root",
    kind: "pressure",
    biology: "Adrenal glands",
    definedTitle: "Steady pressure to move",
    openTitle: "Amplified urgency",
    defined:
      "Pressure moves through you at a dependable rate. Deadlines and demands do not scatter your nervous system; they gather it, and you tend to finish what you start because the pressure has somewhere to go. You are built to work under weight without being crushed by it.",
    open:
      "You absorb the hurry of the room and double it. When everyone around you is rushing, you become the most rushed person present, and when the room is calm you wonder why you were ever frantic. The wisdom is timing: you can feel when a thing is not yet due. The trap is acting only to be rid of the pressure, which produces motion without meaning.",
    notSelf:
      "Chronic hurry — doing the wrong things quickly so the feeling of pressure will stop.",
    question: "What is this hurry for, and what happens if I simply wait?",
  },
] as const satisfies readonly CenterContent[];

/** Lookup by `CenterKey`. Built once, so it can never drift from the list. */
export const CENTER_CONTENT_BY_KEY: Readonly<Record<CenterKey, CenterContent>> =
  Object.fromEntries(
    CENTER_CONTENT.map((c) => [c.key, c]),
  ) as Record<CenterKey, CenterContent>;
