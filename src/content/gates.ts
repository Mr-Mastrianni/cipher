/**
 * The 64 gates — editorial content.
 *
 * `@/lib/human-design/constants` holds the structural facts: which centre each
 * gate belongs to, which channel it forms, where it sits on the wheel. This
 * file adds only the reading. Each entry gives a keynote, the three densities
 * of the gate (shadow, gift, siddhi), a short second-person description of how
 * the gate actually behaves in a life, and one question to work with.
 *
 * The gate number is the key. Centre assignments are mirrored from
 * `GATE_TO_CENTER` and must stay in step with it.
 */

import type { CenterKey } from "@/lib/human-design/constants";

export interface GateContent {
  gate: number;
  name: string;
  centre: CenterKey;
  keynote: string;
  shadow: string;
  gift: string;
  siddhi: string;
  description: string;
  question: string;
}

export const GATES: readonly GateContent[] = [
  {
    gate: 1,
    name: "Self-Expression",
    centre: "g",
    keynote: "Creative force without permission",
    shadow: "Vanity",
    gift: "Freshness",
    siddhi: "Beauty",
    description:
      "Something in you wants to make a thing that did not exist this morning, and it does not care whether anyone asked for it. You will feel the pressure as a kind of restlessness until the work is out of you. Made in that state, it carries a signature no one else can reproduce.",
    question: "What wants to be made through you that no one has requested?",
  },
  {
    gate: 2,
    name: "Direction",
    centre: "g",
    keynote: "Inner compass for a life",
    shadow: "Disorientation",
    gift: "Orientation",
    siddhi: "Unity",
    description:
      "There is a homing signal in you that will not explain itself in words. Driving a familiar road at night, you know the turn before the sign appears. Waiting for the map to make sense will keep you parked.",
    question: "Where does your life point when no one is advising you?",
  },
  {
    gate: 3,
    name: "Ordering",
    centre: "sacral",
    keynote: "New order born from difficulty",
    shadow: "Chaos",
    gift: "Innovation",
    siddhi: "Innocence",
    description:
      "Difficulty is where you begin, not where you stop. A jammed door, a broken routine, a system that no longer works — you push against it until a new arrangement appears. The mess is not proof that you are failing; it is the material.",
    question: "What is trying to be born out of the difficulty in front of you?",
  },
  {
    gate: 4,
    name: "The Answer",
    centre: "ajna",
    keynote: "Formulas that close the question",
    shadow: "Intolerance",
    gift: "Understanding",
    siddhi: "Forgiveness",
    description:
      "Answers come out of you whether or not anyone asked the question. When a friend circles the same problem for weeks, you hand them the formula that finally closes it. Certainty lands hard in you, and the temptation is to use it on people who never asked.",
    question: "Is this answer for someone else, or are you using it to feel safe?",
  },
  {
    gate: 5,
    name: "Rhythm",
    centre: "sacral",
    keynote: "Your own timing, kept steady",
    shadow: "Impatience",
    gift: "Patience",
    siddhi: "Timelessness",
    description:
      "Your own clock runs underneath everything you do, and it refuses to be hurried by the room. When you eat, sleep, work and love on your own pattern, everything holds. When you borrow someone else's pace, you pay for it in the afternoon.",
    question: "Whose pace are you living at right now?",
  },
  {
    gate: 6,
    name: "Friction",
    centre: "solar",
    keynote: "Boundary where intimacy begins",
    shadow: "Conflict",
    gift: "Diplomacy",
    siddhi: "Peace",
    description:
      "Closeness brings resistance, and resistance is how you find the edge of yourself. You feel the moment when a door in you closes and the mood turns. Handled slowly, that moment becomes the place where real intimacy starts.",
    question: "What is this resistance protecting, and is it still worth protecting?",
  },
  {
    gate: 7,
    name: "The Role",
    centre: "g",
    keynote: "Leading others toward what is next",
    shadow: "Division",
    gift: "Guidance",
    siddhi: "Virtue",
    description:
      "A group will hand you the front of the room, sometimes before you want it. You speak for what comes next rather than for what has been, which is why people follow you when the old way is finished. The trap is claiming the position instead of receiving it.",
    question: "Are you leading because you were asked, or because you could not wait?",
  },
  {
    gate: 8,
    name: "Contribution",
    centre: "throat",
    keynote: "Your mark on the work",
    shadow: "Mediocrity",
    gift: "Style",
    siddhi: "Exquisiteness",
    description:
      "The work you are built to put into the world carries your own mark. It may be small — a paragraph, a repair, a way of arranging a room — but it is unmistakably yours. Borrowed versions always feel worse than the thing you actually made.",
    question: "What would you make if you stopped comparing it to someone else's version?",
  },
  {
    gate: 9,
    name: "Focus",
    centre: "sacral",
    keynote: "Attention held on one thing",
    shadow: "Inertia",
    gift: "Determination",
    siddhi: "Invincibility",
    description:
      "Attention is a muscle for you, and it can hold one thing for a long time. Given a task with texture — numbers, code, a difficult text — you disappear into it and surface hours later. The only difficulty is choosing what deserves that, because once the choice is made you will not stop.",
    question: "What deserves this much of your attention, and what is only habit?",
  },
  {
    gate: 10,
    name: "Self-Love",
    centre: "g",
    keynote: "Behaving as your own beloved",
    shadow: "Self-obsession",
    gift: "Naturalness",
    siddhi: "Being",
    description:
      "Loving your own life first is not indulgence; it is the condition for being close to you without flinching. The day you stop auditioning to be someone else, your company becomes easy to keep. Nothing else in your behaviour has to change.",
    question: "What would change if you treated yourself as someone you are responsible for?",
  },
  {
    gate: 11,
    name: "Ideas",
    centre: "ajna",
    keynote: "Thoughts that want to be shared",
    shadow: "Obscurity",
    gift: "Idealism",
    siddhi: "Light",
    description:
      "Something arrives in you fully formed and mostly uninvited, usually while you are doing something else. It is not for keeping; it is for passing on in whatever form someone can use — a sentence, a sketch, a plan. Hoarding it turns it sour.",
    question: "Which of these ideas is meant to leave your head this week?",
  },
  {
    gate: 12,
    name: "Caution",
    centre: "throat",
    keynote: "Careful speech, timed to mood",
    shadow: "Posing",
    gift: "Discrimination",
    siddhi: "Purity",
    description:
      "Timing matters more than wording for you. In the right mood a single sentence changes the temperature of the table; in the wrong one the same sentence starts a fight. Waiting is not cowardice here — it is reading the room before you open your mouth.",
    question: "Is this a thing to say now, or a thing to say later?",
  },
  {
    gate: 13,
    name: "The Listener",
    centre: "g",
    keynote: "Keeper of the shared past",
    shadow: "Discord",
    gift: "Deep listening",
    siddhi: "Empathy",
    description:
      "People tell you things they have not told anyone, and they usually feel better afterwards. You collect the history of a family or a group without trying — who left, who was forgiven, what actually happened. That archive is only useful when it is offered at the right moment, never as a weapon.",
    question: "Whose story are you carrying, and what would it mean to give it back kindly?",
  },
  {
    gate: 14,
    name: "Power Skills",
    centre: "sacral",
    keynote: "Resources turned into real work",
    shadow: "Compromise",
    gift: "Competence",
    siddhi: "Bounteousness",
    description:
      "Resources move through your hands and get turned into work. Given energy, tools, or money, you find the combination that makes something run. The gift is not in having a great deal; it is knowing what the work actually needs and aiming your effort there.",
    question: "Where should your energy go so that it produces something real?",
  },
  {
    gate: 15,
    name: "Extremes",
    centre: "g",
    keynote: "Rhythm that includes every extreme",
    shadow: "Dullness",
    gift: "Magnanimity",
    siddhi: "Florescence",
    description:
      "Your life runs to the edges — feast then fallow, all-in then gone — and trying to flatten that into steady moderation makes you dull. When you honour both ends of the swing, people find you generous, with room for everyone. The task is the rhythm, not the middle.",
    question: "Which end of the swing are you in, and can you let it have its way?",
  },
  {
    gate: 16,
    name: "Skills",
    centre: "throat",
    keynote: "Talent made repeatable by practice",
    shadow: "Indifference",
    gift: "Versatility",
    siddhi: "Mastery",
    description:
      "Repetition is what turns your talent into something others can rely on. Ten thousand small corrections later, you can demonstrate a thing so cleanly that people copy it on sight. Without the practice it stays a party trick.",
    question: "What skill would repay daily practice for a year?",
  },
  {
    gate: 17,
    name: "Opinion",
    centre: "ajna",
    keynote: "Views that survive their evidence",
    shadow: "Opinionatedness",
    gift: "Foresight",
    siddhi: "Omniscience",
    description:
      "You form views the way other people form habits, and the good ones are built from evidence you have checked twice. Timelines, patterns, what a plan will do in five years — you see the shape of it and can defend the reasoning. The mistake is defending it after the evidence changes.",
    question: "Does this rest on evidence, or on the pleasure of having it?",
  },
  {
    gate: 18,
    name: "Correction",
    centre: "spleen",
    keynote: "Eye for what needs fixing",
    shadow: "Judgement",
    gift: "Course correction",
    siddhi: "Perfection",
    description:
      "A crooked picture, a leaking tap, the one clause in the contract that will cause trouble — you see the flaw nobody has agreed to mention. Aimed at things, that eye is useful; aimed at people, it only wounds. The fix matters more than the fault.",
    question: "Can you name the fix, or are you only naming the fault?",
  },
  {
    gate: 19,
    name: "Wanting",
    centre: "root",
    keynote: "Sensitivity to what is needed",
    shadow: "Co-dependence",
    gift: "Sensitivity",
    siddhi: "Sacrifice",
    description:
      "You can feel what a room needs before anyone says it aloud — food, quiet, a hand on the shoulder. That sensitivity is real and constant, and it does not mean the need belongs to you. Learning the difference between noticing and obliging is most of the work.",
    question: "Are you responding to a real need, or to the discomfort of being needed?",
  },
  {
    gate: 20,
    name: "The Now",
    centre: "throat",
    keynote: "Presence spoken in the moment",
    shadow: "Superficiality",
    gift: "Immediacy",
    siddhi: "Presence",
    description:
      "Truth arrives in you in the middle of the moment, without preparation. Standing in a crowd or holding someone's gaze, you hear the exact sentence that names what is happening, and it moves the room. Rehearsed, the same words land flat.",
    question: "What is true right now, before you have improved it?",
  },
  {
    gate: 21,
    name: "Control",
    centre: "heart",
    keynote: "Stewardship of people and resources",
    shadow: "Domination",
    gift: "Authority",
    siddhi: "Valour",
    description:
      "You are good with what belongs to other people — their money, their project, their team — and people sense that you will not waste it. Given authority, you use it to keep things running rather than to be admired. The shadow is the same appetite turned inward, bossing people because you can.",
    question: "What are you responsible for here, and where are you meddling?",
  },
  {
    gate: 22,
    name: "Grace",
    centre: "solar",
    keynote: "Openness timed to the mood",
    shadow: "Dishonour",
    gift: "Charm",
    siddhi: "Blessing",
    description:
      "Charm comes off you when the mood is open, and nothing you do will manufacture it when it is closed. In the right hour you can walk into a hostile room and leave it soft. In the wrong hour, pushing harder only proves the door is shut.",
    question: "Is the mood open, or are you performing into a closed room?",
  },
  {
    gate: 23,
    name: "Assimilation",
    centre: "throat",
    keynote: "Saying the new thing plainly",
    shadow: "Arrogance",
    gift: "Simplicity",
    siddhi: "Quintessence",
    description:
      "You say the new thing before it is fashionable, and say it plainly enough to be understood. It comes out blunt, which is why some rooms are not ready, and why the ones that are never forget it. Explanation is not your job; clarity is.",
    question: "Can you say this in one simple sentence, and let it land where it lands?",
  },
  {
    gate: 24,
    name: "Rationalizing",
    centre: "ajna",
    keynote: "Turning a question until it yields",
    shadow: "Forgetting",
    gift: "Invention",
    siddhi: "Silence",
    description:
      "The same question can occupy you for years, turning over and over until it finally gives way. What looks like circling is slow thinking, and it finds things a straight line will never reach. The trap is mistaking the loop for progress.",
    question: "Are you still thinking, or have you simply stopped deciding?",
  },
  {
    gate: 25,
    name: "Innocence",
    centre: "g",
    keynote: "Love that asks for nothing",
    shadow: "Constriction",
    gift: "Acceptance",
    siddhi: "Universal Love",
    description:
      "Affection arrives in you before the argument for it does. It shows up for the difficult neighbour and the stranger with the same steady warmth, and it cannot be earned or argued into place. Trying to look worthy of it is what makes it vanish.",
    question: "What would you do differently if you did not have to earn your place?",
  },
  {
    gate: 26,
    name: "The Trickster",
    centre: "heart",
    keynote: "Persuasion in service of others",
    shadow: "Pride",
    gift: "Craft",
    siddhi: "Invisibility",
    description:
      "You can put a case together so well that people buy things they did not know they wanted. Selling, teaching, persuading — the craft is real, and it works best when it serves a group rather than your own image. The moment you start believing your own pitch, it stops working.",
    question: "Are you translating something for people, or only selling?",
  },
  {
    gate: 27,
    name: "Nourishment",
    centre: "sacral",
    keynote: "Care given where it is needed",
    shadow: "Selfishness",
    gift: "Altruism",
    siddhi: "Magnanimity",
    description:
      "Care is instinctive for you: the extra portion, the phone call, the lift home. Given to the right people it comes back, and no one has to ask. Given indiscriminately it empties you and teaches the people around you to expect it.",
    question: "Who is actually nourished by what you are giving, including you?",
  },
  {
    gate: 28,
    name: "The Game Player",
    centre: "spleen",
    keynote: "Fighting for a life worth having",
    shadow: "Purposelessness",
    gift: "Totality",
    siddhi: "Immortality",
    description:
      "You want whatever you are doing to have a point, and you will fight for that when the odds are honest. Games you do not care about flatten you; a cause you believe in gives you stamina nobody can explain. The risk is mistaking struggle itself for meaning.",
    question: "Is this fight worth the life it costs?",
  },
  {
    gate: 29,
    name: "Commitment",
    centre: "sacral",
    keynote: "Saying yes and staying in",
    shadow: "Half-heartedness",
    gift: "Perseverance",
    siddhi: "Devotion",
    description:
      "A yes arrives in you before the reasons do, and it carries you into rooms you could never have reasoned your way into. The catch is promising when the body has already refused. Given from the gut, a yes is a force; given from guilt, it is a sentence.",
    question: "What have you already agreed to, and does your body still agree?",
  },
  {
    gate: 30,
    name: "Desire",
    centre: "solar",
    keynote: "Longing that points the way",
    shadow: "Grasping",
    gift: "Lightness",
    siddhi: "Rapture",
    description:
      "Longing runs under everything you do, and it is not a problem to solve. It shows up as appetite for a life that has not happened yet — a place, a person, a version of the work. When you let it be a fire rather than a hunger, it lights the road.",
    question: "What do you actually want, underneath what you want right now?",
  },
  {
    gate: 31,
    name: "Leading",
    centre: "throat",
    keynote: "Leadership others choose to follow",
    shadow: "Presumption",
    gift: "Influence",
    siddhi: "Humility",
    description:
      "People hand you the microphone because they recognise something in how you hold a group's attention. You speak for the many rather than the few, and what you say shapes what everyone does next. Taken as a right instead of a responsibility, it becomes noise.",
    question: "Are you speaking for the group, or for the part of you that wants the room?",
  },
  {
    gate: 32,
    name: "Endurance",
    centre: "spleen",
    keynote: "Instinct for what will last",
    shadow: "Failure",
    gift: "Conservation",
    siddhi: "Victory",
    description:
      "You have a nose for what will survive and what will quietly fail. When a venture, a relationship, or a habit is built on weak ground, you feel it early and can say so before the collapse. Fear of failure is the shadow; keeping what is real is the gift.",
    question: "What here is built to last, and what are you keeping alive out of fear?",
  },
  {
    gate: 33,
    name: "Retreat",
    centre: "throat",
    keynote: "Privacy that becomes wisdom",
    shadow: "Withdrawal",
    gift: "Reflection",
    siddhi: "Revelation",
    description:
      "Stepping away from the noise is how you turn what you have lived into something worth passing on. Solitude here is not sulking; it is where experience settles into shape. Stay away too long, though, and the wisdom never gets carried back to anyone.",
    question: "What have you lived through that someone else needs to hear?",
  },
  {
    gate: 34,
    name: "Power",
    centre: "sacral",
    keynote: "Raw life force in motion",
    shadow: "Force",
    gift: "Strength",
    siddhi: "Majesty",
    description:
      "Vital force moves through you without much ceremony. In a day of real work it feels like a channel opening — you do not tire the way other people tire, and begging the mind for permission only slows it down. Spent on the wrong task, the same energy burns you out fast.",
    question: "Is your body a yes on this, or are you forcing a door that is locked?",
  },
  {
    gate: 35,
    name: "Change",
    centre: "throat",
    keynote: "Hunger for the next experience",
    shadow: "Hunger",
    gift: "Adventure",
    siddhi: "Transformation",
    description:
      "You want to have been everywhere and tried everything, and each experience is a story you can actually tell. Restlessness is the cost of that appetite; the cure is not less life, but better timing. Every door you walk through becomes another story.",
    question: "What experience are you chasing, and what are you hoping it will finally fix?",
  },
  {
    gate: 36,
    name: "Crisis",
    centre: "solar",
    keynote: "Depth found in hard seasons",
    shadow: "Turmoil",
    gift: "Humanity",
    siddhi: "Compassion",
    description:
      "Depth reaches you through the difficult hours, and you can sit with other people in theirs without flinching. Collapse teaches you something about being human that easy days never do. The danger is learning to need the emergency.",
    question: "What did the last hard season teach you that you have not yet used?",
  },
  {
    gate: 37,
    name: "Friendship",
    centre: "solar",
    keynote: "Agreements warmed by real feeling",
    shadow: "Weakness",
    gift: "Equality",
    siddhi: "Tenderness",
    description:
      "Warmth and agreement are your currency. You seal bonds over food, favours kept, and promises small enough to actually be kept — and you remember who was there. Given without keeping score, this becomes the glue of a community.",
    question: "Which of your agreements is quietly out of balance?",
  },
  {
    gate: 38,
    name: "The Fighter",
    centre: "root",
    keynote: "Fighting for what has meaning",
    shadow: "Struggle",
    gift: "Tenacity",
    siddhi: "Honour",
    description:
      "You will fight for what has meaning, and meaning is not optional for you. The argument worth having, the job worth keeping, the hill worth standing on — you know the difference in your body. Fighting for its own sake is the trap; fighting for something is the point.",
    question: "Is this a fight for meaning, or a fight for the sake of fighting?",
  },
  {
    gate: 39,
    name: "Provocation",
    centre: "root",
    keynote: "Poking what has gone stale",
    shadow: "Contrariness",
    gift: "Dynamism",
    siddhi: "Superabundance",
    description:
      "Poking a flat situation until it reacts is a habit you did not choose. You are usually right that something is stuck, and the nudge is not cruelty — it is a way of finding what still has life. Aimed carelessly it insults; aimed well it wakes people up.",
    question: "What are you provoking, and what are you hoping will come alive?",
  },
  {
    gate: 40,
    name: "Aloneness",
    centre: "heart",
    keynote: "Rest that makes giving possible",
    shadow: "Exhaustion",
    gift: "Resolve",
    siddhi: "Divine Will",
    description:
      "You give a great deal and then need to be alone to recover, which can look like a wall to the people you love. Rest is not withdrawal; it is what makes your yes mean anything. Without it, generosity turns into resentment.",
    question: "What would it take to rest before you are emptied?",
  },
  {
    gate: 41,
    name: "Contraction",
    centre: "root",
    keynote: "Pressure that seeds new experience",
    shadow: "Fantasy",
    gift: "Anticipation",
    siddhi: "Emanation",
    description:
      "A pressure builds in you that has nothing to do with your schedule: an appetite for something that has not happened yet. Fantasy is the shadow — living in the wanting instead of the having. Honoured as a pressure, it seeds a whole new cycle of experience.",
    question: "Is this fantasy a plan, or a place you are hiding?",
  },
  {
    gate: 42,
    name: "Growth",
    centre: "sacral",
    keynote: "Letting a cycle finish properly",
    shadow: "Expectation",
    gift: "Detachment",
    siddhi: "Celebration",
    description:
      "Every project you touch has a natural length, and pushing it to finish early kills what it was becoming. You are the one who lets things mature — the ending, the season, the last ten percent. Detach from the deadline and the thing completes itself properly.",
    question: "What are you trying to finish, and is it actually finished growing?",
  },
  {
    gate: 43,
    name: "Insight",
    centre: "ajna",
    keynote: "Inner knowing that needs structure",
    shadow: "Deafness",
    gift: "Breakthrough",
    siddhi: "Epiphany",
    description:
      "A whole knowing hits you at once, with no working shown, and the world rarely accepts it in that form. Your job is not to argue it but to structure it so someone else can walk the path you skipped. Being right is useless if nobody can follow.",
    question: "How would you explain this so another person could use it?",
  },
  {
    gate: 44,
    name: "Instinct",
    centre: "spleen",
    keynote: "Memory for how things went",
    shadow: "Interference",
    gift: "Teamwork",
    siddhi: "Synarchy",
    description:
      "Memory is a survival sense in you, and it keeps a precise record of how people treated you. It alerts you to who is safe to work with, who has a hidden agenda, and who deserves another chance. Used as a warning it protects the group; held as a grudge it poisons it.",
    question: "Is this memory warning you, or is it holding a grudge?",
  },
  {
    gate: 45,
    name: "The Gatherer",
    centre: "throat",
    keynote: "Gathering for the whole table",
    shadow: "Possessiveness",
    gift: "Stewardship",
    siddhi: "Communion",
    description:
      "Collecting comes naturally — food, resources, people, stories — and it is all for the whole table rather than for yourself. In a good mood the group feels provided for because of you. When the collecting becomes hoarding, the same appetite closes the circle.",
    question: "What are you holding that the people around you need?",
  },
  {
    gate: 46,
    name: "The Body",
    centre: "g",
    keynote: "Presence in the flesh",
    shadow: "Seriousness",
    gift: "Delight",
    siddhi: "Ecstasy",
    description:
      "You are happiest when you are simply in your body and in this place — walking, lifting, dancing, being touched. That presence is not naivety; it is a form of luck that arrives when you stop hovering above your own life. Take yourself too seriously and the ease disappears.",
    question: "What does your body want to be doing right now, that your mind keeps postponing?",
  },
  {
    gate: 47,
    name: "Realization",
    centre: "ajna",
    keynote: "Making sense of what happened",
    shadow: "Oppression",
    gift: "Transmutation",
    siddhi: "Transfiguration",
    description:
      "Years can pass while you try to make sense of what already happened, and the pattern only appears at the end. Confusion in the middle is not failure; it is raw material. When the shape finally shows itself, the whole story reorganises into something useful.",
    question: "What pattern is your past trying to show you?",
  },
  {
    gate: 48,
    name: "Depth",
    centre: "spleen",
    keynote: "What years of practice build",
    shadow: "Inadequacy",
    gift: "Wisdom",
    siddhi: "Wonder",
    description:
      "What you have after years of doing one thing properly cannot be rushed or borrowed. Underneath the work sits a quiet fear of not being good enough — and kept small, that fear is exactly what keeps you digging. What you find down there is worth more than confidence.",
    question: "What would you study for a decade if nobody were watching?",
  },
  {
    gate: 49,
    name: "Principles",
    centre: "solar",
    keynote: "Beliefs about who belongs",
    shadow: "Reaction",
    gift: "Revolution",
    siddhi: "Renaissance",
    description:
      "You have firm beliefs about who gets taken in and who is turned away, and those beliefs are tribal, not theoretical. When one of them is broken, your reaction is immediate and the whole group feels it. Held as a living standard it renews the tribe; held rigidly it becomes a wall.",
    question: "Which of your principles is still alive, and which is only a habit of refusal?",
  },
  {
    gate: 50,
    name: "Values",
    centre: "spleen",
    keynote: "Guardian of the group's standards",
    shadow: "Responsibility",
    gift: "Equilibrium",
    siddhi: "Harmony",
    description:
      "Keeping the standards is your job whether or not anyone assigned it: what is fair, what the group owes its people, what it will not tolerate. People lean on you to hold that line. Carried as duty it exhausts; carried as care it holds everyone up.",
    question: "Which values are yours to hold, and which belong to the people you are protecting?",
  },
  {
    gate: 51,
    name: "Shock",
    centre: "heart",
    keynote: "The blow that wakes the will",
    shadow: "Agitation",
    gift: "Initiative",
    siddhi: "Awakening",
    description:
      "A blow arrives before you are ready — a diagnosis, a loss, a sudden opening — and it drops you into your own authority. It is not punishment; it is the test that reveals what you will actually stand on. Afterwards you know what you are made of.",
    question: "What has life already proven you can survive?",
  },
  {
    gate: 52,
    name: "Stillness",
    centre: "root",
    keynote: "Quiet that makes focus possible",
    shadow: "Stress",
    gift: "Restraint",
    siddhi: "Tranquillity",
    description:
      "Sitting still is a discipline for you, and it is what makes deep concentration possible. The pressure to move — to fix, to answer, to act — rises in your body and passes if you let it. From there, action comes out clean.",
    question: "What would happen if you did nothing for one hour?",
  },
  {
    gate: 53,
    name: "Beginnings",
    centre: "root",
    keynote: "Pressure to start something new",
    shadow: "Immaturity",
    gift: "Inception",
    siddhi: "Fruition",
    description:
      "A new cycle presses on you long before the ground is ready, because everything has to start somewhere. You feel the pull to begin and the pull to wait at the same time, and both are honest. Started at the right moment, small things turn into something that carries weight.",
    question: "What wants to begin, and what is genuinely not ready yet?",
  },
  {
    gate: 54,
    name: "Ambition",
    centre: "root",
    keynote: "Drive that lifts the tribe",
    shadow: "Greed",
    gift: "Aspiration",
    siddhi: "Ascension",
    description:
      "The drive in you is never only personal — it is tangled up with the people you came from and the ones you are responsible for. You will work long hours for a standard of living and a standing that lifts more than yourself. When the drive hardens into greed, the same energy starts eating the people it was meant to raise.",
    question: "Who is this ambition for, beyond you?",
  },
  {
    gate: 55,
    name: "Spirit",
    centre: "solar",
    keynote: "Creative force inside the mood",
    shadow: "Self-pity",
    gift: "Buoyancy",
    siddhi: "Freedom",
    description:
      "Moods move through you like weather, and each one carries its own creative energy. In the low you can touch something genuine; in the high you can make things that lift a room. Self-pity is what happens when you believe every mood is the whole truth.",
    question: "What is this mood here to make, rather than to say about you?",
  },
  {
    gate: 56,
    name: "The Storyteller",
    centre: "throat",
    keynote: "Story that carries the idea",
    shadow: "Distraction",
    gift: "Enchantment",
    siddhi: "Intoxication",
    description:
      "You turn experience into story, and a good story carries an idea further than any argument. Given a crowd and the right rhythm, you can hold attention for hours and leave people with something they remember. Used only to entertain, the gift stays pleasant and changes nothing.",
    question: "What is the story actually teaching, and do you know before you tell it?",
  },
  {
    gate: 57,
    name: "Intuition",
    centre: "spleen",
    keynote: "Clarity heard in the body",
    shadow: "Unease",
    gift: "Clarity",
    siddhi: "Prescience",
    description:
      "The body knows things before the mind is informed, and the knowing is quiet and once-only. Walking into a room, you feel the wrongness in your gut and it turns out to be right. Explaining it later never works; acting on it in the moment does.",
    question: "What did you notice in the first second, before you started reasoning?",
  },
  {
    gate: 58,
    name: "Vitality",
    centre: "root",
    keynote: "Joy as renewable fuel",
    shadow: "Dissatisfaction",
    gift: "Joyfulness",
    siddhi: "Bliss",
    description:
      "Joy is a fuel for you, not a reward, and it is what keeps you pushing at things that could be better. You are happiest improving something — a system, a body, a corner of the world — with your whole attention on it. Dissatisfaction is the shadow side of that same appetite.",
    question: "What would you improve today simply because it brings you joy to do it?",
  },
  {
    gate: 59,
    name: "Intimacy",
    centre: "sacral",
    keynote: "Barriers dissolved by closeness",
    shadow: "Dishonesty",
    gift: "Candour",
    siddhi: "Transparency",
    description:
      "Closeness dissolves the barrier between you and another person, and it happens through the body before it happens in words. You are built to create bonds — a child, a partnership, a collaboration — and it begins with honesty about what you actually want. Guarded, the same force turns into distance.",
    question: "Where are you being honest about what you want, and where are you managing?",
  },
  {
    gate: 60,
    name: "Acceptance",
    centre: "root",
    keynote: "Accepting the limit that mutates",
    shadow: "Limitation",
    gift: "Groundedness",
    siddhi: "Justice",
    description:
      "Limits press on you and there is no arguing them away, which is exactly what makes change possible. You feel the ceiling — in money, in time, in a body that will not do what it used to — and something in you adapts rather than breaks. Fighting the limit wastes the pressure; taking it as given puts the pressure to work.",
    question: "What limit are you fighting, and what could it be shaping instead?",
  },
  {
    gate: 61,
    name: "Inner Truth",
    centre: "head",
    keynote: "Pressure to know what is true",
    shadow: "Psychic noise",
    gift: "Inspiration",
    siddhi: "Sanctity",
    description:
      "Questions arrive in you that have no immediate answer, and the pressure to know the truth does not let up. Your mind reaches for the mystic, the secret, the reason underneath the reason. Inspected honestly, this is where real knowing begins; left unexamined, it becomes a private religion.",
    question: "Can you stay with not knowing without inventing an answer?",
  },
  {
    gate: 62,
    name: "Precision",
    centre: "throat",
    keynote: "Detail that makes an argument land",
    shadow: "Pedantry",
    gift: "Exactness",
    siddhi: "Impeccability",
    description:
      "You make an argument land by getting the details exactly right. Numbers, names, sequences — the small facts are not pedantry for you, they are what makes a case impossible to dismiss. Overdone, it becomes a lecture no one asked for.",
    question: "Which detail would make this clear, and which is only showing off?",
  },
  {
    gate: 63,
    name: "Doubt",
    centre: "head",
    keynote: "Testing what is claimed as known",
    shadow: "Suspicion",
    gift: "Inquiry",
    siddhi: "Truth",
    description:
      "Scepticism is a working tool for you: you test every claim, including your own, and refuse to paper over a gap. Asked sincerely, it protects a group from comfortable lies. Left to run, it corrodes everything you have not yet proven.",
    question: "Is this doubt asking for evidence, or only for certainty you cannot have?",
  },
  {
    gate: 64,
    name: "Confusion",
    centre: "head",
    keynote: "Noise resolving into pattern",
    shadow: "Bewilderment",
    gift: "Imagination",
    siddhi: "Illumination",
    description:
      "Your head fills with noise before understanding arrives, and the pressure of the middle can feel unbearable. You are built to make sense of the past — to take a mess of experience and let a pattern emerge. Given time, it resolves, and what you find is worth the wait.",
    question: "What would happen if you let the confusion stay until it organised itself?",
  },
] satisfies readonly GateContent[];

export const GATE_BY_NUMBER: ReadonlyMap<number, GateContent> = new Map(
  GATES.map((g) => [g.gate, g]),
);
