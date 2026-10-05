/**
 * The seven authorities — editorial content.
 *
 * Authority resolves in a fixed order: Emotional, Sacral, Splenic, Ego,
 * Self-Projected, Mental, Lunar. That order and the `Authority` union are
 * imported from `@/lib/human-design/constants`; this file adds the practice.
 */

import type { Authority } from "@/lib/human-design/constants";

export interface AuthorityContent {
  authority: Authority;
  /** The mechanism: where the decision is actually made. */
  how: string;
  /** A concrete protocol to run in the moment of deciding. */
  inPractice: string;
  /** One sentence on the physical signature. */
  feelsLike: string;
  /** What this authority is most often confused with. */
  mistakenFor: string;
}

export const AUTHORITY_CONTENT: readonly AuthorityContent[] = [
  {
    authority: "Emotional",
    how: "A defined Solar Plexus, which means you live on an emotional wave and nothing is true in a single moment. The wave rises, peaks, falls, and returns to level over hours or days, and only at the level does the whole picture appear. There is no instant clarity available to you, and there never will be. Waiting is not indecision; it is the only method you have.",
    inPractice:
      "When a decision arrives, write it down with the date and do not answer it. Tell anyone waiting that you will come back to them on a specific day rather than leaving it open. Check in with the question twice a day, and notice whether the feeling has changed shape rather than simply intensified. Decide on the level ground, and only then speak.",
    feelsLike:
      "Truth arriving as a settled weight after the weather has passed, not as a spike in the moment.",
    mistakenFor:
      "Intuition, when it is really just the top of the wave wearing the costume of certainty.",
  },
  {
    authority: "Sacral",
    how: "A defined Sacral with no defined Solar Plexus, which gives you an in-the-moment yes or no that is available immediately. The answer is physical and pre-verbal: a lift, a lean forward, an opening sound, or a contraction and a flat no. Your mind has no vote here, and asking it to referee will bury the response under reasons.",
    inPractice:
      "Ask someone to put the question to you as a yes-or-no, then listen for the sound your body makes before you have formed a sentence. If there is no response at all, treat that as a no for now rather than as a problem to solve. Test it by asking the opposite question and seeing which one the body leans toward.",
    feelsLike:
      "An unmistakable upward yes or a closed, dropping no that arrives before thought.",
    mistakenFor:
      "Enthusiasm, which is a mental mood and can produce a loud yes with no energy behind it.",
  },
  {
    authority: "Splenic",
    how: "A defined Spleen, with neither the Solar Plexus nor the Sacral defined. You receive a quiet, instantaneous knowing about what is safe, healthy, or correct, and it speaks exactly once. It does not repeat, it does not argue, and if you miss it, it is gone. This is the oldest form of awareness you have.",
    inPractice:
      "Notice the first flicker in the body when a person, place, or offer appears, and act on it while it is still fresh. Do not go looking for a second opinion from the same source, because there will not be one. Write down what the flicker said and check it later against what happened, which is how you learn to trust it.",
    feelsLike:
      "A brief, cool, wordless certainty that passes through and leaves no argument behind.",
    mistakenFor:
      "Fear, which is loud, repetitive, and insists on being heard again and again.",
  },
  {
    authority: "Ego",
    how: "A defined Heart with no Solar Plexus, Sacral, or Spleen defined. Truth for you arrives through want and will: what you actually desire, and whether you have the energy to back it. Your word is a material object, and it is worth more than your enthusiasm. The question is never whether a thing is good, but whether it is yours and whether you can carry it.",
    inPractice:
      "Write the commitment down and put a cost next to it in time, money, or effort. Ask yourself plainly whether you want it for its own sake, and whether the will is present right now to honour it. If either answer is no, decline or renegotiate before you speak. Then keep the word you gave, because your authority runs on promises being real.",
    feelsLike:
      "A grounded, slightly stubborn yes that knows it can carry the weight it is taking on.",
    mistakenFor:
      "Ego in the ordinary sense of pride or stubbornness, when it is a genuine instrument for measuring worth.",
  },
  {
    authority: "Self-Projected",
    how: "A defined G Centre connected to the Throat, with the Heart undefined and no Solar Plexus, Sacral, or Spleen definition. You do not hear your own truth until it is spoken aloud, and you do not need anyone's answer. The voice carries the authority; the listener is only there so the sentence can leave your mouth.",
    inPractice:
      "Find someone who will stay quiet and let you talk without offering solutions or opinions. Say the whole thing out loud, including the parts that sound unreasonable, and listen to your own voice rather than to their face. When a sentence lands with a click, that is the answer. Then thank them for listening rather than for advising.",
    feelsLike:
      "A sentence that comes out of your mouth and rings true in your own ears as it lands.",
    mistakenFor:
      "Talking it through to get advice, which is Mental authority and a different mechanism entirely.",
  },
  {
    authority: "Mental",
    how: "A Projector whose definition sits only at or above the Throat, in the Head, Ajna, or Throat, with everything below undefined. You have no inner authority in the body at all, and this is not a deficiency; it is a different design. Clarity comes from the outside in: the right environment, the right sounding boards, and enough time for the conversation to settle.",
    inPractice:
      "Build a small panel of people you trust to think with, ideally not the people most invested in the outcome. Talk the decision through with them in an environment where you can actually think, and take notes on what you said rather than on what they said. Sleep on it and return to the notes for several days. The answer is what stays coherent after the talking stops.",
    feelsLike:
      "Clarity assembling slowly across several conversations until the shape becomes obvious.",
    mistakenFor:
      "Indecision or weakness, when it is simply the correct route for a mental design.",
  },
  {
    authority: "Lunar",
    how: "A Reflector has no defined centres and therefore no inner authority whatsoever. There is nothing inside to consult, which means you sample the decision across a full lunar cycle of about twenty-eight days and let it show you every side. What survives the whole month is your answer. Speed is not available to you and should not be imitated.",
    inPractice:
      "Name the question on the day it arrives and mark the calendar for twenty-eight days later. Sample it in different places and with different people, noticing how your sense of it changes with the room. Do not commit to anything in the first week, no matter how clear it feels. On the final day, decide from what has remained stable across the entire cycle.",
    feelsLike:
      "A slow, many-sided clarity that only appears once the whole month has been lived through.",
    mistakenFor:
      "Having no opinion, when in fact you have every opinion and need the full cycle to find the one that holds.",
  },
] as const satisfies readonly AuthorityContent[];

/** Lookup by authority name. */
export const AUTHORITY_CONTENT_BY_AUTHORITY: Readonly<
  Record<Authority, AuthorityContent>
> = Object.fromEntries(
  AUTHORITY_CONTENT.map((a) => [a.authority, a]),
) as Record<Authority, AuthorityContent>;
