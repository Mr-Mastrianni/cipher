/**
 * The five types — editorial content.
 *
 * Strategy, signature, not-self theme, and aura match `TYPE_META` in
 * `@/lib/human-design/constants`. `HumanDesignType` is imported from that
 * file rather than restated.
 */

import type { HumanDesignType } from "@/lib/human-design/constants";

export interface TypeContent {
  type: HumanDesignType;
  strategy: string;
  signature: string;
  notSelf: string;
  aura: string;
  theme: string;
  /** What this type is made of, and what it feels like from inside. */
  body: string;
  /** How to move in the world, as three concrete instructions. */
  howToMove: string;
  /** How this type tends to meet other people. */
  relationships: string;
  /** The failure modes to watch, specific to this type. */
  watchFor: string;
}

export const TYPE_CONTENT: readonly TypeContent[] = [
  {
    type: "Generator",
    strategy: "Wait to respond",
    signature: "Satisfaction",
    notSelf: "Frustration",
    aura: "Open and enveloping",
    theme:
      "The life force of the planet. Your power is in the response, never the initiation.",
    body: "You are the engine of the species. A defined Sacral gives you a renewable source of energy, but the fuel only arrives when something outside you asks for it. Then the work itself is the reward: the Sacral does not tire of a true yes, it is replenished by it. Frustration is your instrument panel, and it goes off when you said yes to something that was never yours. You are not slow. You are responding, and the response comes first.",
    howToMove:
      "Before you agree to anything, wait for the sound or the physical lift that arrives before language does. Say yes only when the body has already answered, and let a clear no be said without apology. Then stay with what you responded to until the satisfaction runs out, rather than adding more to escape the flatness.",
    relationships:
      "You are generous with your energy and can be drawn into other people's plans too easily. The relationship tends to improve the moment you stop saying yes out of politeness. Being wanted is not the same as being correctly asked.",
    watchFor:
      "The classic trap is the mental yes: agreeing because the idea makes sense, then grinding on it for months. Watch also for the habit of filling every silence with activity. Frustration and exhaustion are not a personality; they are feedback.",
  },
  {
    type: "Manifesting Generator",
    strategy: "Respond, then inform",
    signature: "Satisfaction and peace",
    notSelf: "Frustration and anger",
    aura: "Open, enveloping, and impactive",
    theme:
      "Fast, multi-passionate, and built to skip steps. Respond first, then move — and tell people on the way out.",
    body: "You have the Generator's engine and a motor wired all the way to the Throat, which makes you faster and more direct than anyone expects. You do not move through steps in order; you find the shortcut and take it, and often it works. The speed is not impatience, it is architecture. When you are moving on a true yes, the satisfaction is immediate and the peace arrives once the thing is done. When you are moving on a borrowed yes, you get frustration and anger at once.",
    howToMove:
      "Respond first, then tell the people your action will affect before you take it, because your speed will otherwise look like a decision made behind their backs. Take the shortcut that opens in front of you instead of the sequence you were handed. Keep more than one live thread if that is what the energy actually supports, and let the redundant ones drop without ceremony.",
    relationships:
      "You move quickly and others can feel left behind, so informing is a kindness as well as a strategy. Say what you are about to do in plain words and then go. The right people will not need to be convinced, only told.",
    watchFor:
      "Watch the leap taken on someone else's enthusiasm, and the mess of four half-finished things that you never actually responded to. Anger usually means you moved without informing. Boredom usually means you are on the wrong track, not that you need a new one.",
  },
  {
    type: "Manifestor",
    strategy: "Inform before acting",
    signature: "Peace",
    notSelf: "Anger",
    aura: "Closed and repelling",
    theme:
      "You initiate. The resistance you meet is not rejection — it is the price of not informing.",
    body: "You are here to start things, and you do not need anyone's permission or response to do it. Your aura is closed, which means people sense your impact before they sense you, and they brace. That bracing is the whole story of your life: you move, they resist, and the resistance is almost always about the surprise rather than the act. When you inform before you move, the same people relax and the door opens. Peace, for you, is the feeling of having acted without leaving a wake of startled people behind.",
    howToMove:
      "Decide in your own authority, then say out loud what you are going to do to everyone it touches, before you do it. Inform once, plainly, and do not ask for agreement you do not need. Then act, and accept that the initiating impulse is yours alone to carry.",
    relationships:
      "People experience you as powerful, which is a compliment and a barrier at the same time. Inform early and often, not to seek approval but to keep the people near you from being ambushed. Anger in you is usually the residue of being managed, so keep the space around your decisions clear.",
    watchFor:
      "The anger that arrives after months of being told what to do, and the opposite error of mistaking a passing impulse for a real initiation. Inform, then move. Do not inform in order to be talked out of it, and do not go silent to protect your independence.",
  },
  {
    type: "Projector",
    strategy: "Wait for the invitation",
    signature: "Success",
    notSelf: "Bitterness",
    aura: "Focused and absorbing",
    theme:
      "You see the other. Your gift lands when it is recognised and invited, and evaporates when it is pushed.",
    body: "You are built to see how a person or a system actually works, and you are usually right. The gift is not the seeing; it is the recognition that lets the seeing be received. Without an invitation, the same accurate insight lands as criticism, and you are left standing in the doorway holding something no one asked for. Your aura is focused and absorbing, which means people feel you paying attention, and the attention is worth more than your energy. Success is what arrives when you have been invited in. Bitterness is what accumulates when you were not.",
    howToMove:
      "Wait until someone recognises your capacity out loud and asks for it, and treat that ask as the real starting signal. When the invitation comes, give the specific guidance you actually see rather than a general opinion. Then step back and let them carry it, because your guidance works when it is theirs to use.",
    relationships:
      "You read people quickly and accurately, and this can make closeness feel unequal until trust is established. Ask before you advise, even when the answer is obvious to you. Being received is a skill you can practise, and the invitations multiply when you stop offering unasked.",
    watchFor:
      "Bitterness is the signal that you gave uninvited, again. Watch for the related trap of waiting so carefully that you never say what you know. And do not confuse an invitation with flattery: the real one is specific and comes with access.",
  },
  {
    type: "Reflector",
    strategy: "Wait a lunar cycle",
    signature: "Surprise",
    notSelf: "Disappointment",
    aura: "Resistant and sampling",
    theme:
      "A mirror for the community. You are here to sample the world, not to be defined by it.",
    body: "You have no defined centres, which means you have no consistent inner authority and no fixed way of being. What you have instead is a rare openness that takes the temperature of whatever room you are in and shows it back with unusual clarity. Because there is nothing fixed to override, you cannot decide quickly and you should not try. A full lunar cycle gives you every colour of the question, and what remains after the month is your answer. The world will keep trying to define you, and your work is to stay undefined without becoming lost.",
    howToMove:
      "For any significant decision, start the clock and do not decide on day one. Sample the question in different environments and with different people, and notice how it changes shape. Around day twenty-eight, say what has survived the whole cycle, and trust that rather than the strongest feeling of the week.",
    relationships:
      "You absorb the people around you and reflect them, which makes you a natural mirror and an easy place for others to project. Choose your company with more care than other types need to. You are not inconsistent; you are accurate about a moving field.",
    watchFor:
      "Disappointment arrives when you were pushed into a fast decision, or when you let someone else's certainty become your own. Watch for environments that leave you feeling grey and tired after every visit. That is data about the environment, not about you.",
  },
] as const satisfies readonly TypeContent[];

/** Lookup by type name. */
export const TYPE_CONTENT_BY_TYPE: Readonly<
  Record<HumanDesignType, TypeContent>
> = Object.fromEntries(TYPE_CONTENT.map((t) => [t.type, t])) as Record<
  HumanDesignType,
  TypeContent
>;
