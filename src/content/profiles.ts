/**
 * The twelve profiles — editorial content.
 *
 * Keys, line pairings, and angles match `PROFILES` in
 * `@/lib/human-design/constants`. A profile is written Personality line first,
 * Design line second, and the angle type is imported from that table rather
 * than restated here.
 */

import type { PROFILES } from "@/lib/human-design/constants";

/** The angle of a cross, derived from the canonical `PROFILES` table. */
export type ProfileAngle = (typeof PROFILES)[number]["angle"];

export interface ProfileContent {
  /** `"personalityLine/designLine"`, e.g. `"2/4"`. */
  key: string;
  name: string;
  angle: ProfileAngle;
  theme: string;
  /** The shape of the life this pairing tends to produce. */
  body: string;
  /** How this profile meets other people. */
  relating: string;
  /** The conditions under which this profile does its best work. */
  work: string;
}

export const PROFILE_CONTENT: readonly ProfileContent[] = [
  {
    key: "1/3",
    name: "Investigator / Martyr",
    angle: "right",
    theme: "Research and discovery by doing it wrong first. A life of experimentation.",
    body: "You research the ground thoroughly, then walk onto it and find out what the research missed. The first attempt is rarely the one that holds, and you learn more from the wreckage than from the plan. Over years this produces a person with unusually deep knowledge and an equally deep respect for what can go wrong. You are not unlucky. You are a laboratory.",
    relating:
      "You need a few people who will stay through the failed attempts, which means the bonds that survive are the ones that were tested. You can be blunt about what did not work, including your own part in it, and this honesty is what keeps the right people close. Casual company tires you faster than solitude does.",
    work:
      "Give yourself the research phase, then give yourself permission to run the experiment badly. You do your best work when failure is cheap and the findings are kept. Roles that demand a flawless first performance will make you miserable and will not get your best thinking.",
  },
  {
    key: "1/4",
    name: "Investigator / Opportunist",
    angle: "right",
    theme: "Foundations built in order to be shared through friendship and network.",
    body: "You build something solid, and then you hand it to the people you know. The foundation is private work; the influence is public and personal at once. Your opinions tend to set early and stay set, which makes you dependable and occasionally hard to move. What you know travels best through a warm introduction.",
    relating:
      "Friendship is not a soft extra in your life; it is the road your work takes. You are loyal, familiar, and inclined to keep the circle you already have rather than widen it. When a friendship breaks, it registers as a structural problem, not a mood.",
    work:
      "You work best when you can build quietly and then share with a trusted circle who will pass it on. You need a network you actually like, not a market. Changing your position to suit a new audience will cost you the foundation that made the position worth having.",
  },
  {
    key: "2/4",
    name: "Hermit / Opportunist",
    angle: "right",
    theme: "Natural gift, called out by the people who already trust you.",
    body: "There is something you can do that you did not consciously learn and do not entirely see. It needs long stretches alone to stay sharp, and it needs a friend to say your name out loud for it to reach anyone. Your life alternates between withdrawal and warm, familiar company. You are not hiding; you are replenishing.",
    relating:
      "You are known by a circle rather than a crowd, and you are at ease inside it. New people usually arrive through someone who already trusts you. Being pulled from solitude before you are ready makes you flat and evasive, not rude.",
    work:
      "Protect the privacy that keeps the gift alive, and let other people do the calling out. Your best opportunities will come through existing relationships rather than applications. If you are the one promoting yourself all day, the talent has nowhere to rest.",
  },
  {
    key: "2/5",
    name: "Hermit / Heretic",
    angle: "right",
    theme: "A private talent that gets projected onto and called to save the day.",
    body: "You have a natural gift and a habit of being needed. People arrive with their problem already shaped like you, expecting a practical fix, and often you can give one. Between those calls you need to disappear, because the projection is expensive to carry. The same gift that makes you a saviour makes you a convenient place to put blame.",
    relating:
      "Others see your capacity before you do, and they are not shy about needing it. You attract people mid-crisis and can be generous with them, sometimes past your own limits. The relationships that last are the ones that let you close the door afterwards.",
    work:
      "Work in private and deliver in public, and keep the two separated by a real boundary. You are at your most useful when the ask is specific and the time frame is short. Vague, open-ended need will drain the gift and leave you resentful.",
  },
  {
    key: "3/5",
    name: "Martyr / Heretic",
    angle: "right",
    theme: "Trial and error turned into practical, universal solutions.",
    body: "You find out how things work by getting them wrong, and people keep expecting you to already know. Out of the failed attempts you produce something genuinely useful to others, because you have tested it against reality rather than theory. Your life has a lot of endings in it, and each one leaves a working method behind. Resilient is the plain word for it.",
    relating:
      "People project solutions onto you, and it is often the people who arrived during a difficult chapter. You are honest about what has not worked, which either deepens a relationship or ends it. You do not need many relationships, but you do need the ones you keep to be truthful.",
    work:
      "You do best where iteration is allowed and the result is meant to be used by someone. The practical fix is your natural product. Environments that punish a visible mistake will waste the very mechanism that makes you valuable.",
  },
  {
    key: "3/6",
    name: "Martyr / Role Model",
    angle: "right",
    theme: "A first life of hard-won experience that becomes wisdom for others.",
    body: "The early years are eventful in a way that looks, from outside, like a story with a shape. Mistakes are made at speed and relationships form and dissolve, and you accumulate a body of lived evidence. Somewhere in the middle you step back and watch, and from that distance the pattern becomes visible. The last chapter is spent as an example rather than an experimenter.",
    relating:
      "Your first decades teach you about people through direct contact, including the endings. You then need a period of distance, which others may read as withdrawal. When you return, you are trusted precisely because you are not trying to be one of the crowd.",
    work:
      "Give the early experiments room to be messy and keep notes. Your later authority comes from having actually done the thing, so anything that insulates you from experience will hollow out the work. Build in a period of observation before you start teaching what you learned.",
  },
  {
    key: "4/1",
    name: "Opportunist / Investigator",
    angle: "juxtaposition",
    theme: "Fixed fate — influence that must rest on its own solid foundation.",
    body: "This is the still point of the wheel. You are meant to go deep into one thing and let that depth travel through the people who already know you. Your direction does not change course easily, and it is not supposed to. The life feels less like a series of choices and more like a task you were handed, and your job is to do it well rather than replace it.",
    relating:
      "Your influence moves friend to friend, at close range, over a long time. You are not built for mass audiences so much as for the people inside your circle. Because your foundation is firm, others may lean on you more than you notice.",
    work:
      "Choose the ground carefully, then stay on it long enough to become the person who knows. Your work spreads through personal recommendation, not promotion. If you keep changing disciplines, you lose the one asset the profile is built to accumulate.",
  },
  {
    key: "4/6",
    name: "Opportunist / Role Model",
    angle: "right",
    theme: "Personal destiny — the network that carries a message outward.",
    body: "Your life is carried by other people, and it takes time to become clear what it is carrying. Early on there is the turbulence of the third line, then a long stretch of watching from a little distance. What emerges is a message that travels through friendship, generation to generation, rather than through position or platform. You are a relay, and a durable one.",
    relating:
      "You tend to be the connective tissue in a group, the person who knows someone who knows someone. Intimacy and distance alternate, and both are necessary. People you met decades ago may still be part of how your life moves.",
    work:
      "Work with people you would keep in your life anyway, because the relationship is the distribution channel. Your influence compounds slowly and then all at once. Chasing a fast, impersonal audience will leave the real network unwatered.",
  },
  {
    key: "5/1",
    name: "Heretic / Investigator",
    angle: "left",
    theme: "Transpersonal leadership grounded in a foundation that can be trusted.",
    body: "People bring you their problems because you have done the work behind your answer. The projection is real, and so is the depth it lands on, which is a rare combination and the reason your solutions tend to hold. There is a practical, unglamorous authority in the way you lead. Your reputation is built on research you did long before anyone was watching.",
    relating:
      "Others expect you to have the fix, and you often do. This makes you a natural leader and a convenient target when the fix fails. You need relationships where you are allowed to not know yet, because the foundation is always still being poured.",
    work:
      "Lead from what you have actually studied, and say plainly when the answer is not ready. Your best work is a practical solution that survives scrutiny. If you spend your authority on promises you have not researched, both the reputation and the research suffer.",
  },
  {
    key: "5/2",
    name: "Heretic / Hermit",
    angle: "left",
    theme: "A called-out natural gift carrying the weight of others' projections.",
    body: "There is a gift in you that you did not build deliberately, and other people can see it from the street. They call you out of your privacy to use it, and the expectations placed on you arrive faster than your own confidence does. Solitude is not optional for this profile; it is where the gift is maintained. The work is learning to answer the call without believing the projection.",
    relating:
      "You attract need, and you attract it in people who arrive with a strong picture of who you are. Being seen that clearly can be flattering and exhausting in the same week. You do best with people who will let you close the door and then knock properly.",
    work:
      "Keep a private practice that no one is allowed to schedule over. Deliver in bursts, when the call is genuine and specific. The reputation will take care of the demand if the retreat is protected; without it, the gift thins out.",
  },
  {
    key: "6/2",
    name: "Role Model / Hermit",
    angle: "left",
    theme: "Natural talent observed from a distance, then lived as an example.",
    body: "Your talent is native and mostly hidden, and your life is arranged in three movements: a turbulent beginning, a long period of watching from the roof, and a return as someone others learn from. The distance is not arrogance; it is how you see the whole board. People trust you with their long questions because you have lived long enough to answer them slowly.",
    relating:
      "You are warm at a slight remove, and people often describe you as someone they look up to without quite knowing when that started. Intimacy happens on your terms and in your own time. Being pulled down into other people's urgency too early undoes the perspective you are here to hold.",
    work:
      "Choose work that lets you observe before you participate and then speak with authority. Your talent needs privacy and your wisdom needs the long view. Teaching, advising, and modelling all suit the profile, provided you keep a roof of your own to stand on.",
  },
  {
    key: "6/3",
    name: "Role Model / Martyr",
    angle: "left",
    theme: "Wisdom built through experiment, and held at a useful distance.",
    body: "You learn by trying things, and you keep trying them well past the point where most people would stop. The experiments are not undignified; they are the source of the perspective you eventually offer. Somewhere in the middle of life you gain a balcony view of your own history and can finally see its shape. The role model in you is built out of the martyr in you, not instead of it.",
    relating:
      "You are honest about what you have broken and what broke you, which gives other people permission to be honest too. You need distance to see clearly, but you also need contact to keep learning. The balance shifts as you get older and the observing takes over from the experimenting.",
    work:
      "Work where the trial and error is visible and the teaching comes afterwards. You are unusually good at turning a messy process into something someone else can follow. Anything that requires you to appear finished before you are will cost you the material.",
  },
] as const satisfies readonly ProfileContent[];

/** Lookup by profile key, e.g. `"5/1"`. */
export const PROFILE_CONTENT_BY_KEY: Readonly<Record<string, ProfileContent>> =
  Object.fromEntries(PROFILE_CONTENT.map((p) => [p.key, p])) as Record<
    string,
    ProfileContent
  >;
