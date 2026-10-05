/**
 * The six lines — editorial content.
 *
 * The archetypal names (Investigator, Hermit, Martyr, Opportunist, Heretic,
 * Role Model) are structural and match `LINE_ROLES` in
 * `@/lib/human-design/constants`. Everything here is the reading: how a line
 * behaves when it is conscious (Personality) and when it is unconscious
 * (Design).
 */

export interface LineContent {
  line: number;
  name: string;
  /** A short phrase for the line's gift. */
  title: string;
  /** What the line is, at root. */
  essence: string;
  /** How the line registers in the body and in ordinary behaviour. */
  inTheBody: string;
  /** The line carried consciously, in the Personality. */
  whenConscious: string;
  /** The line carried unconsciously, in the Design. */
  whenUnconscious: string;
  /** The direction of maturation for this line. */
  growthEdge: string;
}

export const LINE_CONTENT: readonly LineContent[] = [
  {
    line: 1,
    name: "Investigator",
    title: "The need for solid ground",
    essence:
      "This line cannot build on anything it has not tested. It wants the foundation poured and set before the walls go up, which makes it slow at the start and unusually durable afterwards. Knowledge here is not decoration; it is load-bearing.",
    inTheBody:
      "You feel it as a reluctance to begin that is not laziness but reconnaissance. The body settles when the facts are in, and it stays unsettled until they are. Once the ground is solid, you can rest weight on it for years.",
    whenConscious:
      "You know that you research before you commit, and you can explain your reasoning to anyone who asks. Your authority comes from having done the reading. The risk is that you keep studying as a way of never having to start.",
    whenUnconscious:
      "You find the foundation already built beneath you and cannot say where it came from. People experience you as prepared, sometimes intimidatingly so, while you wonder what they are talking about. The research happened in the dark, and it still holds.",
    growthEdge:
      "Learn to tell the difference between needing one more fact and being afraid. At some point the ground is solid enough, and the only way to test it is to stand on it.",
  },
  {
    line: 2,
    name: "Hermit",
    title: "The gift you cannot see",
    essence:
      "This line carries a natural talent that does not announce itself. It emerges when you are left alone with it, and it becomes visible only when someone calls you out of your solitude to use it. The gift is real; your awareness of it is not required.",
    inTheBody:
      "There is a periodic need to withdraw that is not depression and not avoidance. In the quiet, something in you repairs itself and the talent sharpens. Forced company for too long produces a flatness that looks like sadness but is only depletion.",
    whenConscious:
      "You know you need time alone and you can usually name the thing you are good at, though you may be shy about it. When you are invited properly, you show up fully. When you are drafted, the same gift turns stubborn and flat.",
    whenUnconscious:
      "Others see your talent more clearly than you do, and their compliments can feel like a mistake. You may spend years discounting the very capacity that everyone else is waiting for. The call has to come from outside, because you will not issue it yourself.",
    growthEdge:
      "Let yourself be found. The hermit's gift is not completed in private; it is completed when the knock comes and you open the door.",
  },
  {
    line: 3,
    name: "Martyr",
    title: "Discovery by trial",
    essence:
      "This line learns by doing, and mostly by doing it wrong the first time. It discovers what works by exhausting what does not, which is expensive and also the only method that produces real material. Bonds form and break around it, and both are part of the research.",
    inTheBody:
      "Life arrives as a series of experiments, some of which hurt. You build resilience the way a bone builds density: through repeated load. The body is adaptable, but it pays for each lesson in advance.",
    whenConscious:
      "You are aware that you are in the middle of figuring something out, and you are willing to say so out loud. Your failures are legible to you and often useful to others. The risk is a taste for the drama of the break, which turns discovery into repetition.",
    whenUnconscious:
      "Things end around you and you are not sure why, which can leave a residue of blame pointed either inward or outward. In fact the endings are the mechanism, not the punishment. Each one clears a path you could not have planned.",
    growthEdge:
      "Stop treating every ending as a verdict on you. Keep the experiment, drop the verdict, and let the next attempt start from what you actually learned.",
  },
  {
    line: 4,
    name: "Opportunist",
    title: "Influence through the network",
    essence:
      "This line moves through people. Its influence travels along friendship, acquaintance, and the warm familiarity of a known face, which means its opportunities arrive through the door other people hold open. It is built to externalise: what is inside wants to be shared.",
    inTheBody:
      "You feel the state of your relationships as a physical condition. When the network is warm, the body is buoyant and things move; when a friendship has gone cold, the whole system feels blocked. You notice who is in the room before you notice what is being said.",
    whenConscious:
      "You know your life runs on the people you have kept in touch with, and you tend to be generous with them first. Your influence is real precisely because it is personal. The risk is becoming rigid about who counts as yours.",
    whenUnconscious:
      "Doors keep opening and you do not always see who opened them. You may take friendship for granted or, in the other direction, feel inexplicably carried by a group you did not consciously join. Your network is doing the work your planning thinks it is doing.",
    growthEdge:
      "Extend the circle past the people who already agree with you. The line's reach grows when the friendship is genuine rather than strategic.",
  },
  {
    line: 5,
    name: "Heretic",
    title: "The practical fix",
    essence:
      "This line is where the crowd puts its hope. People project a solution onto you and then expect you to deliver it, which gives you unusual practical power and an equally unusual exposure. You are the one who finds the fix that works for everyone, and you are blamed when it does not.",
    inTheBody:
      "You carry other people's expectations like weather in the joints. When the projection is warm, you can do almost anything; when it turns cold, the same body feels heavy and watched. Your energy responds to the room's belief in you.",
    whenConscious:
      "You know you are being looked to, and you have learned to deliver in the moment because the moment is when it counts. Your reputation is an asset you maintain deliberately. The risk is promising the universal fix before you have one.",
    whenUnconscious:
      "People arrive expecting something from you that you never offered, and you either rise to it or resent it. Neither reaction is wrong; the projection is simply part of your equipment. What you do with the expectation is the work.",
    growthEdge:
      "Say what you can actually deliver, plainly, before the room decides for you. A smaller true promise protects the reputation the projection depends on.",
  },
  {
    line: 6,
    name: "Role Model",
    title: "Wisdom lived as example",
    essence:
      "This line is built in three phases: an early life of experiment and error, a middle stretch spent at a useful distance, and a later life of returning as an example. It is not the line that knows best at the start. It is the line that has lived enough to be trusted at the end.",
    inTheBody:
      "The first phase is felt as turbulence, the second as a kind of remove, as though you are watching your own life from a balcony. In the third, the body settles into something people stand near without quite knowing why.",
    whenConscious:
      "You know you are learning in public and that the early chapters are not the summary. You can hold a long view without forcing it. The risk is using the balcony as a hiding place and calling it perspective.",
    whenUnconscious:
      "Others treat you as an example before you feel qualified to be one, and your early mistakes look to them like a story with a shape. You may resist the role for years. The distance is not coldness; it is what makes the example usable.",
    growthEdge:
      "Come down from the balcony on purpose. Wisdom that never re-enters the room stays theory, and the line is only finished when it is lived in front of someone.",
  },
] as const satisfies readonly LineContent[];

/** Lookup by line number, 1–6. */
export const LINE_CONTENT_BY_LINE: Readonly<Record<number, LineContent>> =
  Object.fromEntries(LINE_CONTENT.map((l) => [l.line, l])) as Record<
    number,
    LineContent
  >;
