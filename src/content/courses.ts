/**
 * The courses — editorial content.
 *
 * Structural facts (the nine centres, the gate membership, the 36 channels,
 * type mechanics, and authority precedence) follow the canonical reference
 * data in `@/lib/human-design/constants`. This file adds only the teaching:
 * how to read a bodygraph, how to run the experiment, and how to turn a chart
 * into work that reaches people.
 *
 * The register is observational. Human Design is treated as a map of
 * experience, not a forecast, and not a substitute for medical or
 * psychological care.
 */

import { KP_FOUNDATIONS } from "./kp-course";

export type ContentBlock =
  | { type: "prose"; heading?: string; body: string }
  | { type: "callout"; tone: "note" | "warning" | "key"; body: string }
  | { type: "list"; heading?: string; items: string[] }
  | { type: "practice"; title: string; steps: string[]; minutes: number }
  | { type: "check"; question: string; options: string[]; answerIndex: number; explanation: string };

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: ContentBlock[];
}

export interface Module {
  slug: string;
  title: string;
  summary: string;
  lessons: Lesson[];
}

export interface Course {
  slug: string;
  title: string;
  subtitle: string;
  level: "foundation" | "intermediate" | "advanced";
  tier: "free" | "initiate" | "adept" | "oracle";
  minutes: number;
  description: string;
  outcomes: string[];
  modules: Module[];
}

export const COURSES: readonly Course[] = [
  {
    slug: "reading-your-own-chart",
    title: "Reading Your Own Chart",
    subtitle: "Nine centres, thirty-six channels, and the grammar of definition",
    level: "foundation",
    tier: "free",
    minutes: 136,
    description:
      "A bodygraph is a small diagram with a large amount of information in it. This course teaches the shape of the thing before it teaches the meaning: what the centres are, where the twenty-six activations come from, what a complete channel does, and how to read definition without flattering yourself. By the end you can open your own chart and describe it accurately in plain language.",
    outcomes: [
      "Describe what a bodygraph is and what it is not, without mystical shorthand.",
      "Explain the difference between the Personality and Design columns, including the 88-degree solar arc.",
      "Name all nine centres, sort them into pressure, awareness, expression, identity, and motor, and give the defining gates of each.",
      "Read a centre as defined or open, and describe the not-self signal of an open centre.",
      "Tell a complete channel from a hanging gate, and explain why only complete channels define.",
      "Identify your own definition type and follow a fixed reading order from type to incarnation cross.",
    ],
    modules: [
      {
        slug: "the-shape-of-a-chart",
        title: "The Shape of a Chart",
        summary:
          "What the diagram is made of before any of it means anything: nine centres, thirty-six channels, twenty-six activations, and two clocks.",
        lessons: [
          {
            slug: "what-a-bodygraph-is",
            title: "What a Bodygraph Actually Is",
            summary:
              "A bodygraph is a wiring diagram of nine centres and thirty-six possible channels, and colour means only one thing: this part has a reliable way of operating.",
            minutes: 12,
            blocks: [
              {
                type: "prose",
                heading: "A map, not a portrait",
                body:
                  "A bodygraph is a diagram of how energy moves through you. It is not a description of your personality, and it is not a picture of your soul. It is closer to a wiring diagram: nine centres, thirty-six possible channels between them, and a record of which of those connections are live in your case.\n\nYou will see coloured shapes and white shapes. Colour means the centre is defined, which means it has a consistent way of operating that does not depend on the room you are standing in. White means the centre is open, which means it takes in and amplifies what is around it. That is the whole visual grammar. Everything else is detail laid on top of those two facts.\n\nMost people arrive expecting the coloured parts to be the good news and the white parts to be the damage. It is the other way around as often as not. The open centres are where you are most sensitive, most able to perceive other people, and most easily confused about what belongs to you.",
              },
              {
                type: "prose",
                heading: "Where the numbers come from",
                body:
                  "The raw material is twenty-six numbers. Thirteen are calculated from the moment of your birth: the positions of the Sun, the Earth, the Moon, the lunar nodes, and the planets, each reduced to a gate and a line. Thirteen more are calculated from a second moment, the Design date. Each of those twenty-six activations falls in one of the sixty-four gates, and each gate belongs to exactly one centre.\n\nWhen two gates that form a channel are both activated, that channel is defined and both centres at its ends are coloured. When a gate is activated and its partner is not, the gate hangs and defines nothing. That single rule explains almost every bodygraph you will ever look at.\n\nMost people have between one and six defined channels. Almost everyone has more open centres than they expect, including people whose charts look busy at first glance.",
              },
              {
                type: "list",
                heading: "What the diagram actually contains",
                items: [
                  "Nine centres: Head, Ajna, Throat, G, Heart, Spleen, Solar Plexus, Sacral, Root.",
                  "Sixty-four gates, each divided into six lines, each line into six colours, tones, and bases.",
                  "Thirty-six possible channels. Only a complete channel defines the centres at its ends.",
                  "Twenty-six activations: thirteen conscious from the birth moment, thirteen unconscious from the Design moment.",
                  "Four gates belong to three channels each: 10, 20, 34, and 57. They are the Integration cluster and they sit close together on the diagram.",
                  "The wheel begins at Gate 41, at 2 degrees Aquarius, in the tropical zodiac, around 22 January.",
                ],
              },
              {
                type: "check",
                question: "What has to be true for a centre to be coloured on a bodygraph?",
                options: [
                  "A channel touching it is complete, which means both of the channel's gates are activated.",
                  "One of the centre's gates is activated, which colours the centre halfway.",
                  "Every gate that belongs to the centre is activated, which closes the centre.",
                  "The centre sits at one end of a channel that has one activated gate and one quiet gate.",
                ],
                answerIndex: 0,
                explanation:
                  "Definition travels through complete channels only. A single activated gate, however many channels it belongs to, cannot colour a centre by itself. The tempting second option is the common misreading: people see one lit gate on a centre and assume the centre is half on, but there is no half state. The fourth option describes a hanging gate, which is the opposite of definition.",
              },
              {
                type: "check",
                question: "Where does the gate wheel begin, and in which zodiac?",
                options: [
                  "Gate 41, at 2 degrees Aquarius, in the tropical zodiac, around 22 January.",
                  "Gate 1, at 0 degrees Aries, in the tropical zodiac, at the spring equinox.",
                  "Gate 41, at 2 degrees Aquarius, in the sidereal zodiac, in early February.",
                  "Gate 64, at 0 degrees Cancer, at the summer solstice.",
                ],
                answerIndex: 0,
                explanation:
                  "The wheel starts at Gate 41 Line 1, which is 2 degrees of Aquarius measured against the tropical zodiac of the seasons, and that falls around 22 January. The sidereal option is the one that catches people, because sidereal calculations are standard in some other systems and shift the wheel by roughly two dozen degrees, which produces a different chart entirely. Gate 1 at 0 degrees Aries is the astrological new year, not the Rave New Year.",
              },
            ],
          },
          {
            slug: "personality-and-design",
            title: "Two Columns, Two Clocks",
            summary:
              "The black column is what you can see about yourself, the red column is what everyone else can see, and the second one is cast from the moment the Sun stood 88 degrees of solar arc earlier.",
            minutes: 14,
            blocks: [
              {
                type: "prose",
                heading: "The black column",
                body:
                  "The black numbers running down the left of the chart are the Personality. They come from the exact moment of your birth, the first breath, calculated in the zodiac of the seasons. These are the parts of yourself you can narrate. You know about them because you have been living in them consciously your whole life.\n\nWhen someone reads your Personality Sun and Earth, or your Personality Moon, and you nod because it sounds familiar, that is the point. The black column is the self you have been describing at dinner for years. It is not more true than the red column. It is simply more audible to you.",
              },
              {
                type: "prose",
                heading: "The red column",
                body:
                  "The red numbers are the Design. They are cast from a second moment: the moment when the Sun stood exactly 88 degrees of solar arc before the position it held at your birth. Because the Sun moves roughly one degree per day, that lands around 88 days earlier, but the calculation is not a day count. It is the precise instant when the arc measures 88 degrees, which is why a naive subtraction of 88 days can land several days away and put the Design Sun in the wrong gate.\n\nThis column carries what you do not consciously see: the body's inherited patterns, the parts of you that other people meet before you have introduced yourself. It is the reason two people can describe the same person so differently and both be accurate.",
              },
              {
                type: "prose",
                heading: "Reading the two together",
                body:
                  "The two columns are read as one chart. A gate that appears in both is doubly weighted. The profile comes from the two Sun lines: the Personality Sun line first, then the Design Sun line, in that order. The incarnation cross uses the Sun and Earth of both columns plus the nodes, but that is a later study.\n\nStart with repetition. Note which gates appear in black and in red, then note which channels come complete from one column alone and which need a gate from each. A channel completed across the two columns tends to feel like something you do without noticing you are doing it.",
              },
              {
                type: "callout",
                tone: "note",
                body:
                  "88 degrees of solar arc, not 88 days. The Design moment is defined by the Sun's position, so a day count will drift. This is one of the few places where a small calculation error changes the whole chart.",
              },
              {
                type: "practice",
                title: "Find your two clocks",
                minutes: 12,
                steps: [
                  "Write down your birth date, exact time, and birth place. If the time is uncertain, note the uncertainty rather than guessing silently.",
                  "Find the Design date your charting tool reports and write it beside your birth date. Say the gap out loud in days.",
                  "Compare the two columns gate by gate. Circle every gate that appears in both.",
                  "For each circled gate, ask whether you experience it as something you narrate or something others report about you.",
                  "Keep the page. You will return to it in the lesson on definition.",
                ],
              },
              {
                type: "check",
                question: "How is the Design moment calculated?",
                options: [
                  "The moment when the Sun stood exactly 88 degrees of solar arc before its position at birth.",
                  "Exactly 88 days before birth, at the same clock time in the same timezone.",
                  "The moment of the first breath, expressed a second time in a sidereal zodiac.",
                  "Nine months before birth, near the moment of conception.",
                ],
                answerIndex: 0,
                explanation:
                  "Design is a solar arc measurement, so it tracks the Sun rather than the calendar, and 88 degrees happens to land near 88 days but not exactly. The second option is the trap because it is close enough to seem right and is how the shortcut is usually taught; used literally, it can put the Design Sun in the wrong gate near a boundary. The fourth option is a different system's idea of a prenatal chart and has nothing to do with the red column.",
              },
            ],
          },
          {
            slug: "centres-and-motors",
            title: "Centres and Motors",
            summary:
              "The nine centres sort into pressure, awareness, expression, identity, and motor, and four of them can drive a channel all the way to the Throat.",
            minutes: 15,
            blocks: [
              {
                type: "prose",
                heading: "Nine centres, five jobs",
                body:
                  "The Head and the Root are pressure centres. They press: one on the mind, one on the body. The Ajna, the Spleen, and the Solar Plexus are awareness centres, each with a different relationship to time. The Throat is expression, the only centre that speaks or acts. The G is identity and direction, the place where love and orientation live.\n\nThe Sacral, the Heart, the Solar Plexus, and the Root are motors. Notice that two centres do two jobs, which is why the diagram cannot be sorted into a tidy list. The Solar Plexus is both an awareness centre and a motor. The Root is both pressure and motor. This is not sloppiness in the system; it is the reason emotion moves you and pressure drives you.",
              },
              {
                type: "prose",
                heading: "The four motors",
                body:
                  "A motor generates energy that can travel. The Sacral is the great life-force engine, the centre of work, response, and fertility. The Heart, also called the Ego or Will, is the small fierce engine of promise, value, and material will. The Solar Plexus is the emotional motor, a wave that rises and falls and colours everything it touches. The Root is the engine of pressure, the adrenaline that starts things and the stress that finishes them.\n\nWhen a motor connects to the Throat through complete channels, energy reaches expression directly. That single structural fact sorts the types. A motor-to-Throat connection with no Sacral gives a Manifestor. A defined Sacral with a motor-to-Throat connection gives a Manifesting Generator. A defined Sacral with no such connection gives a Generator. No Sacral and no motor to the Throat gives a Projector. Nothing defined at all gives a Reflector.",
              },
              {
                type: "list",
                heading: "The nine centres and their gates",
                items: [
                  "Head, pressure: 61, 63, 64.",
                  "Ajna, awareness: 4, 11, 17, 24, 43, 47.",
                  "Throat, expression: 8, 12, 16, 20, 23, 31, 33, 35, 45, 56, 62.",
                  "G, identity and direction: 1, 2, 7, 10, 13, 15, 25, 46.",
                  "Heart, motor: 21, 26, 40, 51.",
                  "Spleen, awareness: 18, 28, 32, 44, 48, 50, 57.",
                  "Solar Plexus, awareness and motor: 6, 22, 30, 36, 37, 49, 55.",
                  "Sacral, motor: 3, 5, 9, 14, 27, 29, 34, 42, 59.",
                  "Root, pressure and motor: 19, 38, 39, 41, 52, 53, 54, 58, 60.",
                ],
              },
              {
                type: "callout",
                tone: "key",
                body:
                  "A motor is not a mood. It is a structural source of energy that can reach the Throat or the Sacral and therefore reach action. Knowing which motors are defined tells you what kind of engine you are working with before you know anything about what you want.",
              },
              {
                type: "practice",
                title: "Locate your motors",
                minutes: 12,
                steps: [
                  "Open your chart and find the Sacral, the Heart, the Solar Plexus, and the Root.",
                  "Mark each one as defined or open. Write the word, not just the colour.",
                  "For each defined motor, trace every complete channel that leaves it and note where the channel lands.",
                  "If a motor reaches the Throat through complete channels, draw an arrow and write the word direct.",
                  "If no motor reaches the Throat, write the word indirect and leave it there for now.",
                ],
              },
              {
                type: "check",
                question: "Which of these is not one of the four motors?",
                options: ["The Spleen", "The Heart", "The Solar Plexus", "The Root"],
                answerIndex: 0,
                explanation:
                  "The Spleen is an awareness centre, and its knowing is quiet, instantaneous, and survival-oriented rather than generative. The Heart is the tempting wrong answer because it feels emotional and because people associate the word heart with feeling, but in this system the Heart is the motor of will and promise, and the Solar Plexus carries emotion.",
              },
            ],
          },
        ],
      },
      {
        slug: "the-nine-centres",
        title: "The Nine Centres",
        summary:
          "Every centre, defined and open, with the not-self signal that tells you when the open version is running the show.",
        lessons: [
          {
            slug: "the-mental-centres",
            title: "The Mental Centres: Head and Ajna",
            summary:
              "The Head presses you to make meaning and the Ajna works to conclude, and both are far more borrowed than they feel.",
            minutes: 13,
            blocks: [
              {
                type: "prose",
                heading: "The Head",
                body:
                  "The Head is the pressure of inspiration. Its three gates, 61, 63, and 64, sit at the top of the chart and generate questions, doubts, and the itch to know. A defined Head has a steady, low-grade pressure to think, and it can hold not knowing for a long time without panic. Inspiration arrives on its own schedule and spends itself if you let it.\n\nAn open Head takes in the mental pressure of the room and turns the volume up. In a room of anxious thinkers you become the most anxious thinker there. The wisdom on offer is discrimination: you can feel which questions are worth answering and which are only noise. The trap is believing that every question arriving in your head is yours to resolve, so you spend a life answering other people's wondering.\n\nThe not-self signal is a buzzing, borrowed urgency, as though the answer is late and you are to blame.",
              },
              {
                type: "prose",
                heading: "The Ajna",
                body:
                  "The Ajna is the awareness centre of the mind, with six gates: 4, 11, 17, 24, 43, and 47. A defined Ajna has a shape. Concepts settle into a consistent architecture, and you can return to the same opinion years later and find it standing. People come to you for a verdict because yours does not wobble. The cost is that you can mistake your architecture for the truth.\n\nAn open Ajna can hold several contradictory views at once without distress, which makes it unusually good at understanding people it disagrees with. The wisdom is flexibility: nothing you think has to harden into who you are. The trap is performing certainty, because an open mind under pressure will grip a conclusion just to feel safe.\n\nThe not-self signal is a quiet panic about being thought stupid, followed by a rigid opinion defended past the point of honesty.",
              },
              {
                type: "callout",
                tone: "warning",
                body:
                  "The Head and the Ajna are awareness and pressure, not authority. A defined Ajna can produce beautiful, coherent reasoning for a decision the body has already refused. That is not a malfunction. It is the mind doing the only job it has, which is to describe.",
              },
              {
                type: "practice",
                title: "Catch a borrowed question",
                minutes: 10,
                steps: [
                  "Set a timer for ten minutes and sit with a question that has been nagging you all day.",
                  "Ask, out loud, whose question this is. Not whose fault, whose question.",
                  "Notice whether the pressure to answer rises or falls when you imagine nobody is waiting for your answer.",
                  "Write the question on paper. If it loses its charge once it is written, it was borrowed energy.",
                  "Repeat once tomorrow with a different question.",
                ],
              },
              {
                type: "check",
                question: "Which two centres are the pressure centres?",
                options: [
                  "The Head and the Root",
                  "The Head and the Ajna",
                  "The Spleen and the Solar Plexus",
                  "The Throat and the G",
                ],
                answerIndex: 0,
                explanation:
                  "Pressure enters the system at the Head, which presses on the mind, and at the Root, which presses on the body and drives it toward action. The second option is the natural mistake because the Head and Ajna sit together and feel like one mental engine, but the Ajna is an awareness centre that processes what the Head delivers. The Spleen and Solar Plexus are awareness centres, and the Throat and G are expression and identity.",
              },
            ],
          },
          {
            slug: "voice-and-direction",
            title: "Voice and Direction: Throat and G",
            summary:
              "The Throat is the only centre that speaks or acts, and the G holds identity, direction, and love, which is why an open G can feel like having no fixed self.",
            minutes: 14,
            blocks: [
              {
                type: "prose",
                heading: "The Throat",
                body:
                  "The Throat is expression. It has eleven gates, more than any other centre, and it is the only place where energy becomes a word, a gesture, or an act. A defined Throat has a consistent way of putting things out: a tone, a tempo, a reliable mode of speech or action. You can count on it to deliver, although reliability is not the same as saying the right thing at the right moment.\n\nAn open Throat is under pressure to talk and can be brilliant at it precisely because it is reading the room. The wisdom is timing: you can feel when speech will land and when it will only fill silence. The trap is talking to release pressure rather than to communicate, which produces a great deal of noise and very little contact.",
              },
              {
                type: "prose",
                heading: "The G",
                body:
                  "The G centre, sometimes called the Identity centre, holds eight gates: 1, 2, 7, 10, 13, 15, 25, and 46. It carries the sense of who you are, the direction you are moving, and the particular flavour of love you have to offer. A defined G has a stable centre of gravity. You know roughly where you are going and who is going with you.\n\nAn open G takes in the identity and direction of the people around it. You can become the shape of whatever room you are in, love what is loved near you, and find your way by following a pull you did not generate. The wisdom is recognition: you can see direction in others, and you can tell real belonging from conformity. The trap is waiting to be given a self, and treating the absence of a fixed identity as a defect.\n\nA useful distinction: the open G is not an empty G. It is a sensitive one. It reads the field, and in the right environment it feels unmistakably at home.",
              },
              {
                type: "list",
                heading: "Gates at a glance",
                items: [
                  "Throat: 8, 12, 16, 20, 23, 31, 33, 35, 45, 56, 62.",
                  "G: 1, 2, 7, 10, 13, 15, 25, 46.",
                  "The Throat is the only centre that expresses. Every other centre reaches the world through it.",
                  "The G is an identity centre, not a motor. It does not generate energy, it orients it.",
                ],
              },
              {
                type: "callout",
                tone: "note",
                body:
                  "An open G is not the same as being lost, and a defined G is not the same as being wise. The defined version gives consistency. The open version gives perception. Neither is a verdict on your character.",
              },
              {
                type: "check",
                question: "Your G centre is open. Which reading is most accurate?",
                options: [
                  "You take in the sense of direction around you and can often recognise it in others more easily than in yourself.",
                  "You have no stable identity, so you should avoid commitments until one arrives.",
                  "You are a Projector, because only Projectors can have an open G.",
                  "You will feel lost until you deliberately define the centre through practice.",
                ],
                answerIndex: 0,
                explanation:
                  "An open centre amplifies and samples its surroundings, and an open G samples identity and direction, which is why recognition in others can run ahead of self-recognition. The second option turns an open centre into a deficiency, which is the central misconception this course is built to remove. Any type can have an open G, and no practice colours a centre; only a complete channel does.",
              },
            ],
          },
          {
            slug: "the-motors-and-the-spleen",
            title: "The Motors and the Spleen",
            summary:
              "Sacral, Heart, Solar Plexus, and Root generate and drive, while the Spleen is the quiet awareness centre that knows once and never repeats itself.",
            minutes: 16,
            blocks: [
              {
                type: "prose",
                heading: "The four motors",
                body:
                  "The Sacral sits at the base of the chart with nine gates: 3, 5, 9, 14, 27, 29, 34, 42, 59. It is the engine of work, response, and life force. Defined, it gives steady generative energy that can be spent and replenished. Open, it takes in and multiplies the work ethic around it, so you can push far past your own limit without noticing until later.\n\nThe Heart, or Ego, holds four gates: 21, 26, 40, 51. It is the motor of will, promise, and material value. Defined, it gives real short-burst willpower that has to be recharged, and a natural relationship to what things are worth. Open, it tends to promise more than it can deliver and then resent the debt, or to undervalue its own work to prove it does not need anything.\n\nThe Solar Plexus holds seven gates: 6, 22, 30, 36, 37, 49, 55. It is the emotional motor and an awareness centre at once, and its energy moves in a wave. Defined, it gives a consistent emotional weather system that colours every decision and pushes clarity into the future. Open, it amplifies the emotional weather of the room and can avoid confrontation so thoroughly that it loses track of what it actually feels.\n\nThe Root holds nine gates: 19, 38, 39, 41, 52, 53, 54, 58, 60. It is pressure and motor, the adrenaline of deadlines and the drive to complete. Defined, it gives a dependable relationship to pressure and a need to finish. Open, it takes in the pressure around it and hurries when nobody is asking it to.",
              },
              {
                type: "prose",
                heading: "The Spleen",
                body:
                  "The Spleen holds seven gates: 18, 28, 32, 44, 48, 50, 57. It is the oldest awareness in the system, tuned to the body, to survival, and to the present moment. A defined Spleen gives a quiet, instantaneous knowing that arrives before thought and then leaves. It is the voice that says not this person, not tonight, not this way, and it says it once.\n\nAn open Spleen takes in the immune and instinctual life of those around it. You can feel what is healthy in a room and what is not, sometimes before anyone has said a word. The wisdom is discrimination about what is good for the body. The trap is holding on to a splenic hit and demanding that it repeat itself, which it will not do, and then concluding that intuition cannot be trusted.\n\nThe not-self signal of an open Spleen is a low, constant vigilance, as though something is about to go wrong and you must keep watching for it.",
              },
              {
                type: "list",
                heading: "Motors and their gates",
                items: [
                  "Sacral, motor: 3, 5, 9, 14, 27, 29, 34, 42, 59.",
                  "Heart or Ego, motor: 21, 26, 40, 51.",
                  "Solar Plexus, motor and awareness: 6, 22, 30, 36, 37, 49, 55.",
                  "Root, motor and pressure: 19, 38, 39, 41, 52, 53, 54, 58, 60.",
                  "Spleen, awareness: 18, 28, 32, 44, 48, 50, 57. Not a motor, despite how physical it feels.",
                ],
              },
              {
                type: "callout",
                tone: "warning",
                body:
                  "An open Sacral is not laziness, and a defined Sacral is not a guarantee of stamina. The open version runs on borrowed fuel and pays for it later. The defined version runs out, and needs rest and response to refill.",
              },
              {
                type: "practice",
                title: "Name the motor you overuse",
                minutes: 15,
                steps: [
                  "List the four motors and mark each defined or open on your chart.",
                  "For each definition, write one sentence about the last time you spent it well.",
                  "For each openness, write one sentence about the last time you spent energy that was not yours.",
                  "Set a fifteen minute timer and do nothing productive. Notice which motor complains first.",
                  "Write down the complaint in one line and keep it as your signal for the week.",
                ],
              },
              {
                type: "check",
                question: "What does an open Heart centre typically do under pressure?",
                options: [
                  "It promises more than it has the will to deliver, then resents the debt.",
                  "It stops wanting material things and becomes indifferent to money.",
                  "It collapses into laziness and refuses all commitments.",
                  "It shuts down emotion, which then resurfaces as sudden anger.",
                ],
                answerIndex: 0,
                explanation:
                  "The Heart is the motor of will and promise, so an open Heart amplifies the will of others and overcommits before it has checked whether the energy is there. The second option inverts the signal: an open Heart usually cares about proof and worth more, not less. Laziness belongs to no centre, and the emotional material in the fourth option belongs to the Solar Plexus, not the Heart.",
              },
            ],
          },
        ],
      },
      {
        slug: "reading-definition",
        title: "Reading Definition",
        summary:
          "Channels, hanging gates, the five shapes of definition, and an order for reading your own chart without skipping to the flattering parts.",
        lessons: [
          {
            slug: "channels-and-hanging-gates",
            title: "Channels and Hanging Gates",
            summary:
              "A channel is a pair of gates that must both be activated, and a lone gate is a hook that pulls other people and environments toward you.",
            minutes: 15,
            blocks: [
              {
                type: "prose",
                heading: "The channel is the unit",
                body:
                  "A channel is a pair of gates, one at each end, joining two centres. There are thirty-six of them, and each has a name and a theme built from the two gates it joins. When both gates are activated, the channel is complete and both centres are defined. The energy then has a route, and the two centres operate as one circuit.\n\nThis is the whole mechanism of definition. It is also why the chart cannot be read by listing activated gates. A gate on its own is a capacity, a flavour, a question. It becomes a function only when its partner is present. Two people can share a gate and have completely different charts because of what else is activated around it.",
              },
              {
                type: "prose",
                heading: "The hanging gate",
                body:
                  "A hanging gate is an activated gate whose partner is not activated. It defines nothing. What it does instead is pull. A hanging gate behaves like a hook: it notices the missing half everywhere it goes, and it is often drawn to people and environments that carry it. This is not a flaw to be fixed. It is the mechanism behind a great deal of attraction, collaboration, and learning.\n\nThe integration cluster complicates the picture in an interesting way. Four gates, 10, 20, 34, and 57, each belong to three channels rather than the usual one. Gate 10 sits in the G and pairs with 20, 34, or 57. Gate 20 sits in the Throat and pairs with 10, 34, or 57. Gate 34 sits in the Sacral, and Gate 57 in the Spleen, with the same three partners. These four gates are the exceptions that make the chart worth reading closely.\n\nWhen you look at your own chart, count the complete channels before you interpret anything. The number is usually smaller than the amount of colour suggests.",
              },
              {
                type: "list",
                heading: "Complete channel, or hanging gate",
                items: [
                  "Both gates activated: the channel is complete, both centres are defined, the theme is available as a function.",
                  "One gate activated: the gate hangs, nothing is defined, and the missing half tends to arrive through other people.",
                  "Gate 10 with 20, 34, or 57: whichever partner is present completes a different channel with a different theme.",
                  "A centre can be defined by one channel and still sit beside open centres that colour nothing at all.",
                ],
              },
              {
                type: "callout",
                tone: "key",
                body:
                  "Definition is binary. A channel is on or it is off. There is no partial definition, no half-coloured centre, and no way for a single gate to define anything on its own.",
              },
              {
                type: "practice",
                title: "Find your hanging gates",
                minutes: 15,
                steps: [
                  "List every activated gate in your chart, black and red together, without duplicates.",
                  "For each gate, write down the channels it belongs to.",
                  "Mark a channel complete only when both of its gates appear on your list.",
                  "Circle every gate left over. These are your hanging gates.",
                  "Notice which of them you keep meeting in other people, and write one example for the two loudest.",
                ],
              },
              {
                type: "check",
                question: "Gate 20 in the Throat is activated. Gates 10, 34, and 57 are not activated. What is defined?",
                options: [
                  "Nothing. Gate 20 hangs, even though it belongs to three channels.",
                  "The Throat, because Gate 20 belongs to three channels and one of them must count.",
                  "The Throat and the G, because Gate 20 sits in a channel between them.",
                  "The Throat half defines, which behaves like a weaker definition.",
                ],
                answerIndex: 0,
                explanation:
                  "Belonging to three channels does not define anything by itself, because every channel still needs its partner gate. Gate 20 is one of the four integration gates, and its three partners are 10, 34, and 57, none of which is present here. The second option is the misconception the integration cluster creates: people see three lines and assume one must complete. There is no half-defined state, which rules out the fourth.",
              },
              {
                type: "check",
                question: "Which four gates each belong to three channels?",
                options: [
                  "10, 20, 34, and 57",
                  "41, 19, 13, and 49",
                  "1, 2, 3, and 4",
                  "5, 14, 29, and 59",
                ],
                answerIndex: 0,
                explanation:
                  "Gates 10, 20, 34, and 57 form the Integration cluster, a tight group in the middle of the chart, and each one pairs with the other three. The second option is the beginning of the wheel in zodiacal order, which is a different kind of list. The final option is the set of gates belonging to the Sacral's tribal circuitry, all of which are ordinary single-channel gates.",
              },
            ],
          },
          {
            slug: "definition-types",
            title: "The Five Shapes of Definition",
            summary:
              "Count the connected areas of your chart and you get None, Single, Split, Triple Split, or Quadruple Split, each with its own way of seeking wholeness.",
            minutes: 17,
            blocks: [
              {
                type: "prose",
                heading: "Counting the areas",
                body:
                  "Definition type comes from geometry, not from psychology. Take every complete channel in the chart. Where two channels share a centre or touch through a defined centre, they belong to the same area. Count the areas. One area is Single Definition. Two is Split. Three is Triple Split. Four is Quadruple Split. No complete channel at all is No Definition, which belongs to the Reflector.\n\nThe count tells you how self-contained you are. A Single Definition operates as one circuit and can process most things alone. A Split Definition has two circuits with a gap between them, and the gap is where other people come in. This is why a Split can feel suddenly whole in the company of a particular person and inexplicably scattered without them.\n\nNone of these is a rank. A Triple Split is not more advanced than a Single. It is simply a different geometry, with different advantages in reading people and different costs in consistency.",
              },
              {
                type: "prose",
                heading: "The flavour of each shape",
                body:
                  "Single Definition moves with one voice and can struggle to understand why anyone would need another person to feel complete. Split Definition lives with the bridge as a fact of life, and its not-self move is to contort itself to hold the connection, becoming whatever keeps the other person close. Triple Split is rarer, with three separate areas, and often feels like three conversations happening at once, each with its own timing.\n\nQuadruple Split is rarer still. Four areas mean four internal voices, and the person may be unusually good at holding many perspectives while finding it hard to commit to one. No Definition is the Reflector: no centre is consistently defined, no internal circuit holds a fixed position, and the chart takes its shape from the lunar cycle and the environment.\n\nDefinition type does not decide authority. Authority follows the precedence ladder, and the two are read separately.",
              },
              {
                type: "callout",
                tone: "note",
                body:
                  "A Split Definition is not broken, and a Single Definition is not superior. The split is a place where you are built to meet other people. The single is a place where you are built to move alone. Both come with blind spots.",
              },
              {
                type: "practice",
                title: "Count your areas",
                minutes: 20,
                steps: [
                  "Write out every complete channel in your chart as a pair, such as 34-10.",
                  "Group the channels that share a centre. Put a box around each group.",
                  "Count the boxes. That number is your definition type.",
                  "For a split chart, name the centre or centres that would bridge your areas if they were defined.",
                  "Notice which people in your life carry those bridging gates, and write down how you feel in their company.",
                ],
              },
              {
                type: "check",
                question:
                  "A chart has a connected group running through the Sacral, the Root, and the Spleen, plus a separate connected group in the Head and Ajna. What is the definition type?",
                options: ["Split Definition", "Single Definition", "Triple Split Definition", "No Definition"],
                answerIndex: 0,
                explanation:
                  "Two separate connected groups mean two areas of definition, which is Split Definition. Single Definition would require the two groups to be joined by at least one complete channel, and here nothing joins them. Triple Split needs three groups, and No Definition would require no complete channel at all. The bridging gates between the two areas are usually the ones people feel most strongly when they meet them in someone else.",
              },
            ],
          },
          {
            slug: "a-first-pass-reading-order",
            title: "A First-Pass Reading Order",
            summary:
              "Type, then authority, then the shape of your definition, then the defined centres, then the open ones, and only then the profile and cross.",
            minutes: 20,
            blocks: [
              {
                type: "prose",
                heading: "Why order matters",
                body:
                  "Most bad chart readings are not wrong about the details. They are wrong about the order. If you begin with the open centres, everything you read afterwards is filtered through a story about deficiency. If you begin with the profile, you build an identity before you know what the body actually does. Type is the frame, and it comes first because strategy depends on it.\n\nRead type by asking two mechanical questions. Is the Sacral defined? Is a motor connected to the Throat by complete channels? The four possible answers, plus the no-definition case, give you Generator, Manifesting Generator, Manifestor, Projector, or Reflector. From there, authority follows the precedence ladder, not preference.\n\nOnly after the mechanics are settled do the defined centres make sense, because at that point you know what the definition is for. The open centres come next, read as perception rather than absence. The profile, the lines, and the incarnation cross are refinements. They sharpen a reading that already stands; they cannot rescue one that does not.",
              },
              {
                type: "prose",
                heading: "Holding the reading loosely",
                body:
                  "A bodygraph is a description of a mechanism, not a diagnosis of a person. Two people with identical charts live differently, because the chart describes how energy moves, not what the person will do with it. When a reading does not match your experience, note the gap instead of forcing the match. The gap is often where the interesting material is.\n\nWrite your reading in plain sentences a friend could follow. If a sentence needs a diagram to make sense, it is not finished. Human Design language can become a private dialect that feels profound and communicates nothing. Plain language is a discipline, and it keeps you honest.\n\nOne more thing worth saying plainly: this is not a predictive system, and it is not a replacement for medical or psychological care. It is a map of how you are built to make decisions. What you do with the map is yours.",
              },
              {
                type: "list",
                heading: "The first-pass order",
                items: [
                  "Type: defined Sacral, and motor-to-Throat connection.",
                  "Authority: walk the precedence ladder from the top and stop at the first condition that is true.",
                  "Definition type: count the connected areas and look for the bridge in a split.",
                  "Defined centres and complete channels: what is reliably available.",
                  "Open centres: what you amplify, and the not-self signal of each.",
                  "Profile: Personality Sun line first, then Design Sun line.",
                  "Incarnation cross: the broad life theme, read last and held lightly.",
                ],
              },
              {
                type: "practice",
                title: "Read your chart in seven steps",
                minutes: 25,
                steps: [
                  "Set a timer for twenty-five minutes and work through the seven items in the list above in order.",
                  "For each item, write one sentence only. No sentence may exceed twenty words.",
                  "When you reach an item you cannot answer, write the word unknown rather than guessing.",
                  "Read the seven sentences aloud and cut any that are vague or borrowed from a description you read online.",
                  "End by writing one sentence that begins: mechanically, this chart is built to.",
                ],
              },
              {
                type: "check",
                question: "Which question comes first in a first-pass reading?",
                options: [
                  "Is the Sacral defined, and is a motor connected to the Throat through complete channels?",
                  "What is the profile?",
                  "Which centres are open?",
                  "What is the incarnation cross?",
                ],
                answerIndex: 0,
                explanation:
                  "The two mechanical questions about the Sacral and the motor-to-Throat connection determine type, and type determines strategy and constrains authority, so everything else is read against it. Profile and cross are refinements that make most sense once the frame is settled. The open centres are the most tempting place to start because they feel personal, but reading them first turns perception into a story about what is missing.",
              },
            ],
          },
        ],
      },
    ],
  },
  // The KP course sits second: the first course's lesson ids are mapped to
  // seeded store rows by position (see dashboard/courses).
  KP_FOUNDATIONS,
  {
    slug: "the-experiment",
    title: "The Experiment",
    subtitle: "Strategy, the seven authorities, and thirty days of evidence",
    level: "intermediate",
    tier: "initiate",
    minutes: 149,
    description:
      "Reading a chart is not the same as living from it. This course turns mechanics into a daily practice: how each type is built to engage, how the seven authorities resolve a decision in the body rather than the mind, and how to run a thirty-day experiment that produces evidence you can actually read. The register stays observational. You are not asked to believe anything, only to test it and write down what happens.",
    outcomes: [
      "Derive your type from the mechanics and name your strategy without consulting a description.",
      "Explain why strategy is a way of engaging with the world, not a rule about being passive.",
      "Use signature and not-self as instrumentation rather than as a mood report.",
      "Walk the authority precedence ladder and stop at the first condition that applies to you.",
      "Distinguish an emotional wave from a splenic hit, and treat each according to its timing.",
      "Design, run, and review a thirty-day experiment with a baseline, one variable, and a written log.",
    ],
    modules: [
      {
        slug: "strategy-and-type",
        title: "Strategy and Type",
        summary:
          "Type is a mechanical consequence of two facts about the Sacral and the Throat, and each type has one honest way of meeting the world.",
        lessons: [
          {
            slug: "type-is-mechanics",
            title: "Type Is Mechanics, Not Character",
            summary:
              "The five types fall out of two structural questions, and none of them is a personality category or a compliment.",
            minutes: 15,
            blocks: [
              {
                type: "prose",
                heading: "Two questions, five answers",
                body:
                  "Type is not something you feel. It is something you derive. Ask whether the Sacral is defined. Then ask whether a motor reaches the Throat through complete channels. Those two answers sort every chart into one of five mechanical arrangements, and the arrangement does not change with your mood or your upbringing.\n\nA defined Sacral with no motor-to-Throat connection is a Generator. A defined Sacral with a motor-to-Throat connection is a Manifesting Generator. No Sacral definition with a motor-to-Throat connection is a Manifestor. No Sacral definition, no motor to the Throat, and at least one defined centre is a Projector. No defined centre at all is a Reflector.\n\nNotice that the definitions never mention character. A shy Manifestor is still a Manifestor. A gentle Generator is still a Generator. The type describes how energy enters action, not what kind of person you are.",
              },
              {
                type: "prose",
                heading: "Why the mechanics matter more than the label",
                body:
                  "The label is a shorthand for the mechanics, and the mechanics are what you work with. A Generator has a Sacral that responds in the moment, and that response is the most reliable decision signal available. Take away the Sacral and the same person would have an entirely different decision process. A Manifestor has a motor that reaches the Throat directly, which means energy can begin an action without waiting for anything, and which is also why the Manifestor's arrival can feel abrupt to everyone nearby.\n\nBecause type is derived, you can check any chart yourself and get a definite answer. If a tool tells you that you are a Projector but your Sacral is defined and a motor reaches your Throat, the tool is wrong. The mechanics are prior to the label, and the arithmetic is public.\n\nThe aura description belongs to the type. A Generator's aura is open and enveloping. A Manifesting Generator's is open, enveloping, and impactive. A Manifestor's is closed and repelling. A Projector's is focused and absorbing. A Reflector's is resistant and sampling. These are qualities of presence, not claims about likeability.",
              },
              {
                type: "list",
                heading: "The five types, mechanically",
                items: [
                  "Generator: Sacral defined, no motor connected to the Throat by complete channels.",
                  "Manifesting Generator: Sacral defined, and a motor connected to the Throat by complete channels.",
                  "Manifestor: Sacral not defined, and a motor connected to the Throat by complete channels.",
                  "Projector: not a Reflector, no Sacral definition, and no motor connected to the Throat.",
                  "Reflector: no centre defined, which means no complete channel anywhere in the chart.",
                ],
              },
              {
                type: "callout",
                tone: "note",
                body:
                  "The aura is not a claim about how you come across to everyone. It is a description of what the field around the body does when it meets another field. Some people find a closed aura calming. Some find a focused aura exhausting. Use it as information about contact, not as a rating.",
              },
              {
                type: "practice",
                title: "Derive your type from scratch",
                minutes: 12,
                steps: [
                  "Look only at the Sacral. Write defined or not defined.",
                  "Trace every complete channel from each defined motor and note whether any lands on the Throat.",
                  "Write the two answers as a pair, such as Sacral defined, motor to Throat absent.",
                  "Match the pair to the list above and write the type in your own handwriting.",
                  "Check your answer against a charting tool only after you have written it yourself.",
                ],
              },
              {
                type: "check",
                question:
                  "A chart shows the Sacral defined. No motor connects to the Throat through complete channels. Which type is this?",
                options: ["Generator", "Manifesting Generator", "Manifestor", "Projector"],
                answerIndex: 0,
                explanation:
                  "A defined Sacral with no motor-to-Throat connection is a Generator. The Manifesting Generator is the tempting answer because it also has a defined Sacral, and the difference is exactly the motor-to-Throat connection, so a single hanging gate on the way to the Throat can mislead you. A Manifestor requires the Throat connection without a defined Sacral, and a Projector has neither.",
              },
            ],
          },
          {
            slug: "the-five-strategies",
            title: "The Five Strategies",
            summary:
              "Waiting to respond, responding then informing, informing before acting, waiting for an invitation, and waiting a lunar cycle are five different ways of engaging the world.",
            minutes: 16,
            blocks: [
              {
                type: "prose",
                heading: "Strategy is how you meet the world",
                body:
                  "The Generator's strategy is to wait to respond. The word that matters is respond. The Generator is not waiting to be told what to do, and is not forbidden from wanting things. The Sacral answers what life puts in front of it, and the answer arrives as a body event: a lift, a drop, a sound that comes before the sentence.\n\nThe Manifesting Generator's strategy is to respond, then inform. The response comes first, exactly as it does for a Generator. Then, because the motor reaches the Throat directly and the action moves fast, informing becomes the thing that keeps other people from being knocked over. Informing is not asking permission. It is a courtesy that protects the speed.\n\nThe Manifestor's strategy is to inform before acting. A Manifestor does not need a response and will not get one by waiting. Energy is already moving toward the Throat. Telling people what is about to happen does not slow the action down; it removes the resistance that surprise creates.",
              },
              {
                type: "prose",
                heading: "The Projector and the Reflector",
                body:
                  "The Projector's strategy is to wait for the invitation. This is the most resented strategy in the system, and the most misunderstood. It does not mean sitting silently in a corner until someone notices you. It means becoming genuinely excellent at something, letting the work be visible, and recognising the difference between an invitation that arrives with recognition in it and a demand dressed up as an opportunity.\n\nThe Reflector's strategy is to wait a lunar cycle. With no centre consistently defined, there is no fixed internal position to consult. The Reflector samples the environment over roughly twenty-eight days, and a decision becomes legible as the cycle turns. This is slow by design, and it is honest about how the Reflector is built.\n\nEvery strategy is a way of not forcing. None of them is a way of not living.",
              },
              {
                type: "list",
                heading: "Strategy, signature, and not-self",
                items: [
                  "Generator: wait to respond. Signature, satisfaction. Not-self, frustration.",
                  "Manifesting Generator: respond, then inform. Signature, satisfaction and peace. Not-self, frustration and anger.",
                  "Manifestor: inform before acting. Signature, peace. Not-self, anger.",
                  "Projector: wait for the invitation. Signature, success. Not-self, bitterness.",
                  "Reflector: wait a lunar cycle. Signature, surprise. Not-self, disappointment.",
                ],
              },
              {
                type: "callout",
                tone: "warning",
                body:
                  "Respond is not obey. Wait is not passive. Inform is not ask permission. Every strategy in this system has been flattened into a rule about being good, and every one of those flattenings is wrong.",
              },
              {
                type: "practice",
                title: "One response, one inform",
                minutes: 15,
                steps: [
                  "Choose three ordinary decisions today: what to eat, whether to answer a message, whether to accept a small request.",
                  "For each one, pause and notice the first body movement before you form a sentence about it.",
                  "If you are a Generator or Manifesting Generator, act only on the ones with a clear yes, and inform after the yes.",
                  "If you are a Manifestor, pick one small action and tell the affected person before you begin, in one sentence.",
                  "If you are a Projector or Reflector, notice where you were about to push, and instead write down what you offered and whether it was recognised.",
                ],
              },
              {
                type: "check",
                question: "What is the strategy of a Manifesting Generator?",
                options: [
                  "Respond, then inform.",
                  "Inform before acting.",
                  "Wait to respond.",
                  "Wait for the invitation.",
                ],
                answerIndex: 0,
                explanation:
                  "A Manifesting Generator has the Sacral response of a Generator and the direct motor-to-Throat speed of a Manifestor, so the strategy combines both: the response comes first, then the informing. The second option belongs to the Manifestor, who has no Sacral response to wait for and whose only protection is telling people in advance. Waiting passively, the third option, is the common distortion of the Generator strategy and would waste the speed.",
              },
            ],
          },
          {
            slug: "signature-and-not-self",
            title: "Signature and Not-Self",
            summary:
              "Satisfaction, peace, success, surprise, and their opposite themes are instruments for reading whether you are living your own mechanics.",
            minutes: 14,
            blocks: [
              {
                type: "prose",
                heading: "A signal, not a reward",
                body:
                  "Each type carries a signature theme and a not-self theme. The signature is what shows up when the mechanics are being used well. The not-self is what shows up when the mind has taken the wheel and is forcing a decision the body never agreed to.\n\nThese themes are useful precisely because they are emotional rather than moral. Frustration is not a sin and satisfaction is not a virtue. They are readings from the instrument panel. If you are a Generator and you spend a month frustrated, that frustration is not a character flaw. It is data about how many yeses you manufactured.\n\nRead them over weeks, not minutes. A single irritated afternoon says nothing. A pattern of frustration across a season says something about the decisions you have been making.",
              },
              {
                type: "prose",
                heading: "What the not-self is telling you",
                body:
                  "Bitterness in a Projector is the taste of offering something good and never being asked for it. Anger in a Manifestor is the pressure of having moved without telling anyone and meeting resistance that feels personal but is actually surprise. Frustration in a Generator is the friction of pushing against an answer the Sacral never gave. Disappointment in a Reflector is what arrives when a decision was rushed against a cycle that was still turning.\n\nNotice the direction of each. The not-self is never a verdict on your worth. It is a report about contact between your mechanics and the world. Change the contact and the theme changes.\n\nThe register here is experiential. Nobody can measure your satisfaction for you, and no chart predicts what will happen if you follow it. The experiment is the evidence.",
              },
              {
                type: "list",
                heading: "The pairs",
                items: [
                  "Generator: satisfaction against frustration.",
                  "Manifesting Generator: satisfaction and peace against frustration and anger.",
                  "Manifestor: peace against anger.",
                  "Projector: success against bitterness.",
                  "Reflector: surprise against disappointment.",
                ],
              },
              {
                type: "practice",
                title: "Track the signal for a day",
                minutes: 15,
                steps: [
                  "Write your signature theme and your not-self theme at the top of a page.",
                  "Set three checkpoints: late morning, mid afternoon, and before bed.",
                  "At each checkpoint, mark which theme is louder right now and write one event that preceded it.",
                  "Do not try to change anything today. Observe only.",
                  "At the end of the day, circle the checkpoint where the not-self was loudest and ask what decision came before it.",
                ],
              },
              {
                type: "check",
                question: "What is the not-self theme of a Projector?",
                options: ["Bitterness", "Frustration", "Anger", "Disappointment"],
                answerIndex: 0,
                explanation:
                  "Bitterness is the Projector's signal, and it tends to appear when good work goes unseen or when the Projector offers guidance that was never invited. Frustration belongs to the Generator and is the trap answer for anyone who has heard the word used as a general complaint. Anger is the Manifestor's theme, and disappointment is the Reflector's.",
              },
            ],
          },
        ],
      },
      {
        slug: "the-seven-authorities",
        title: "The Seven Authorities",
        summary:
          "Authority is the order in which a decision becomes true in the body, and it is read by walking the precedence ladder from the top.",
        lessons: [
          {
            slug: "why-the-mind-does-not-decide",
            title: "Why the Mind Does Not Decide",
            summary:
              "The mind is a superb describer and a poor decider, and the precedence ladder tells you which centre has the final word in your chart.",
            minutes: 18,
            blocks: [
              {
                type: "prose",
                heading: "The mind's actual job",
                body:
                  "The mind is very good at two things: describing what is happening and constructing reasons for a decision that has already been made. It is not built to decide. This is not an insult. A decision in this system is a resolution in the body, and the mind's role is to notice the resolution and put it into language so you can act on it.\n\nWhen the mind decides, it decides from what it can measure: other people's approval, past outcomes, worst cases, and the story of who you are supposed to be. None of those are present-tense facts about whether this action is correct for you now. The result is a decision that looks defensible and feels wrong in a way you cannot argue with.\n\nAuthority is the name for the reliable place in your particular design where a decision actually resolves. It is not a feeling you choose. It is a mechanism you learn to stop interrupting.",
              },
              {
                type: "prose",
                heading: "The precedence ladder",
                body:
                  "Authority is read in a fixed order, highest first. If the Solar Plexus is defined, the authority is Emotional, and nothing below it matters for decisions, even if the Sacral is also defined. If the Solar Plexus is not defined but the Sacral is, authority is Sacral. If neither, and the Spleen is defined, authority is Splenic. Then Ego or Heart authority if the Heart is defined, then Self-Projected if the G is defined and connected to the Throat while the Heart is not, then Mental if the definition sits only at or above the Throat, and finally Lunar for the Reflector.\n\nThe ladder is a precedence rule, not a menu. You do not get to choose the one that suits the situation. Emotional authority always wins when the Solar Plexus is defined, because the emotional wave colours every other signal in the chart.\n\nThe two exceptions deserve care. Self-Projected authority requires the G to be connected to the Throat through complete channels and the Heart to be undefined. Mental or Environmental authority belongs to a Projector whose definition sits only at or above the Throat, and clarity arrives by talking it through in the right environment over time. Lunar authority belongs to the Reflector alone, and it takes a full cycle of roughly twenty-eight days.",
              },
              {
                type: "list",
                heading: "Authority in order of precedence",
                items: [
                  "Emotional: Solar Plexus defined. Always wins. Clarity only after the high and the low have both passed.",
                  "Sacral: Sacral defined and the Solar Plexus is not. An in-the-moment gut yes or no, often a sound before a sentence.",
                  "Splenic: Spleen defined, no Solar Plexus or Sacral authority. Quiet, instantaneous, once only, never argues.",
                  "Ego or Heart: Heart defined, no higher authority. What you want and have the will to back.",
                  "Self-Projected: G defined and connected to the Throat, Heart undefined. Truth heard by saying it aloud.",
                  "Mental or Environmental: a Projector whose definition sits only at or above the Throat. Clarity through talking in the right place over time.",
                  "Lunar: Reflector only. A full lunar cycle, roughly twenty-eight days.",
                ],
              },
              {
                type: "callout",
                tone: "key",
                body:
                  "Walk the ladder from the top and stop at the first true condition. Mixing authorities is the most common way a decision becomes mush. One chart, one authority, one timing.",
              },
              {
                type: "practice",
                title: "Find your rung",
                minutes: 15,
                steps: [
                  "Write the seven authorities in order on a piece of paper, highest at the top.",
                  "Check the Solar Plexus. If it is defined, circle Emotional and stop.",
                  "If it is not, check the Sacral, then the Spleen, then the Heart, then the G-to-Throat connection.",
                  "Stop at the first condition that is true and write your authority beside it.",
                  "Write down the timing that authority requires: now, once, over days, aloud, or over a cycle.",
                ],
              },
              {
                type: "check",
                question:
                  "A chart has the Solar Plexus defined and the Sacral defined. What is the authority?",
                options: [
                  "Emotional, because a defined Solar Plexus always takes precedence.",
                  "Sacral, because the Sacral gives an immediate gut answer.",
                  "Either one, depending on how important the decision is.",
                  "Splenic, because the Spleen will clarify the emotion.",
                ],
                answerIndex: 0,
                explanation:
                  "Emotional authority sits at the top of the ladder and wins whenever the Solar Plexus is defined, even alongside a defined Sacral. The Sacral answer is the tempting one because it feels faster and more decisive, but a sacral yes inside an emotional wave is only the wave talking at that moment. The third option describes the menu error: authority is a precedence rule, not a choice.",
              },
            ],
          },
          {
            slug: "emotional-and-sacral",
            title: "Emotional and Sacral",
            summary:
              "The emotional wave has no truth in the now, while the Sacral speaks in the body at the moment the question arrives.",
            minutes: 16,
            blocks: [
              {
                type: "prose",
                heading: "The wave",
                body:
                  "If your Solar Plexus is defined, you do not have access to the truth of a decision in the moment you are asked. This is a structural fact, not a failure of self-knowledge. Emotion moves in a wave that rises to a high and falls to a low, and both ends distort. At the top, everything looks possible. At the bottom, nothing looks worth doing. Neither is a verdict.\n\nClarity arrives after the wave has passed through both, which usually takes days rather than minutes. The practical protocol is simple and unglamorous: when a decision arrives, say you will answer later. Then sleep on it more than once. Notice whether the answer is the same on the third day as it was on the first, and whether it survives being spoken to someone who has no stake in it.\n\nEmotional authority is slow on purpose. It is the most common authority in the population, and most of the suffering around it comes from being pushed to decide at the pitch of the wave.",
              },
              {
                type: "prose",
                heading: "The Sacral yes and no",
                body:
                  "If the Solar Plexus is open and the Sacral is defined, the decision is immediate. The Sacral answers what is in front of it with a yes or a no, expressed in the body before language catches up. It is often a sound: an uh-huh that lifts, an uh-uh that drops. It has no interest in reasons and cannot be argued into a different answer.\n\nThe Sacral does not answer everything. It has no opinion about questions it has no stake in, and a lack of response is not a no. It answers yes-or-no questions about action and energy: do this, take this, go there, work with this person. Open-ended questions about the future produce nothing, which is why the same person can seem decisive about lunch and paralysed about a career.\n\nAsk the question, then stop talking. The answer arrives in the gap.",
              },
              {
                type: "callout",
                tone: "warning",
                body:
                  "A loud emotional reaction is not a sacral yes. A sacral no can be quiet and pleasant. If the answer changes when the mood changes, you were listening to the wave, not the gut.",
              },
              {
                type: "practice",
                title: "Ride one wave",
                minutes: 20,
                steps: [
                  "Choose a real decision you have been circling for at least a week.",
                  "Write the decision at the top of a page and the date beneath it.",
                  "Each day for three days, rate your feeling about it from one to ten and write a single sentence of why.",
                  "On the third day, read the three ratings without judging them and look for the direction of travel.",
                  "Write the decision you would make if the mood were irrelevant, then wait one more day before acting.",
                ],
              },
              {
                type: "check",
                question: "When is clarity available under emotional authority?",
                options: [
                  "After the wave has passed through both its high and its low, usually over several days.",
                  "At the first strong feeling, because that is the honest reaction.",
                  "At the peak of excitement, when energy is highest.",
                  "As soon as the mind has finished analysing the pros and cons.",
                ],
                answerIndex: 0,
                explanation:
                  "An emotional wave distorts at both ends, so the high and the low are both unreliable and clarity only appears once the decision looks the same from several points on the wave. The second option is the common mistake of treating intensity as truth; intensity is exactly what the wave supplies most of. The fourth option hands the decision back to the mind, which cannot resolve an emotional wave by reasoning about it.",
              },
            ],
          },
          {
            slug: "splenic-ego-self-projected-mental-lunar",
            title: "Splenic, Ego, Self-Projected, Mental, and Lunar",
            summary:
              "The five remaining authorities each have a distinct texture and timing, from the one-time whisper of the Spleen to the full lunar cycle of the Reflector.",
            minutes: 20,
            blocks: [
              {
                type: "prose",
                heading: "The Spleen, the Heart, and the G",
                body:
                  "Splenic authority is the quietest signal in the system. It arrives instantaneously, in the body, and then it is gone. It does not repeat, it does not raise its voice, and it will not argue with your reasoning. If you have ever known in a single beat that a person or a road was wrong and then talked yourself out of it, you have met splenic knowing from the wrong side. The practice is to act on the first hit and to stop demanding a second one.\n\nEgo or Heart authority sounds like desire with the means to back it. The question is not whether something is nice but whether you actually want it and have the will to carry it. An open Heart can want on behalf of the room; a defined Heart knows the difference between wanting and being willing to pay. Under this authority, ask what you want, then ask what you will genuinely commit to.\n\nSelf-Projected authority is heard, not felt. It requires the G connected to the Throat and an undefined Heart, which means identity can reach speech but will cannot be relied on. The method is literal: say the decision aloud to someone who does not need to reply. You will hear which version is true while you are saying it. The listener is furniture, not a counsel.",
              },
              {
                type: "prose",
                heading: "Mental and Lunar",
                body:
                  "Mental or Environmental authority belongs to a Projector whose definition sits only at or above the Throat. There is no body signal below the neck to consult, so clarity comes from talking it through, in the right environment, over time. The environment matters as much as the conversation. A decision discussed in a noisy, borrowed space will take the shape of that space. The same decision discussed over several days in a calm one will settle.\n\nLunar authority belongs to the Reflector alone. With no defined centre, there is no fixed position to check, and the truth of a decision shows up as the lunar cycle turns. Roughly twenty-eight days, and the answer is read in the pattern rather than at any single moment. This is not indecision. It is a different instrument with a longer needle.\n\nAcross all five, the principle is the same: find the timing your design requires and stop apologising for it.",
              },
              {
                type: "list",
                heading: "Texture and timing",
                items: [
                  "Splenic: instantaneous, quiet, once only, never repeats and never argues. Act on the first hit.",
                  "Ego or Heart: what you want and have the will to back. Short bursts of real will, then rest.",
                  "Self-Projected: hear your truth by saying it aloud to someone who does not need to reply.",
                  "Mental or Environmental: clarity through talking it through, in the right environment, over time.",
                  "Lunar: a full cycle of roughly twenty-eight days, for Reflectors only.",
                ],
              },
              {
                type: "practice",
                title: "Say it aloud",
                minutes: 10,
                steps: [
                  "Take one decision that has been stuck for more than a week.",
                  "Find a person who will not advise you, and tell them you only need them to listen.",
                  "Say the decision in two forms: I am going to do this, and I am not going to do this.",
                  "Notice which sentence changes your breathing, your pace, or your certainty while it is leaving your mouth.",
                  "Do not ask for an opinion. Thank them and write down what you heard yourself say.",
                ],
              },
              {
                type: "check",
                question: "Which description fits splenic knowing?",
                options: [
                  "Quiet, instantaneous, offered once, and it never repeats or argues.",
                  "A strong sensation that builds until you finally pay attention to it.",
                  "An emotional certainty that arrives after the wave has settled.",
                  "A clear answer that appears only after you have explained the situation to someone else.",
                ],
                answerIndex: 0,
                explanation:
                  "The Spleen is an ancient awareness tuned to the present, and it delivers a single quiet hit rather than a campaign. The second option inverts the mechanism: the Spleen does not escalate, and waiting for it to get louder is how people lose it. The fourth option describes self-projected or mental authority, where the answer is heard in speech rather than in the body.",
              },
            ],
          },
        ],
      },
      {
        slug: "the-thirty-day-experiment",
        title: "The Thirty-Day Experiment",
        summary:
          "One variable, a written baseline, a log you can stand to reread, and a review that decides what happens in the next thirty days.",
        lessons: [
          {
            slug: "designing-the-experiment",
            title: "Designing the Experiment",
            summary:
              "A useful experiment changes one thing, records a baseline first, and runs for a fixed period whether or not it feels good.",
            minutes: 17,
            blocks: [
              {
                type: "prose",
                heading: "One variable at a time",
                body:
                  "The temptation is to change everything at once: sleep, work, honesty, dating, money, and how you speak to your family. When everything changes, nothing can be attributed. A thirty-day experiment should change one behaviour in one context, with a baseline recorded before you begin.\n\nChoose something small enough to do daily and specific enough to count. Not be more authentic, but answer every request with a delay of one hour and record what the Sacral said before the delay. Not follow my authority, but write the decision and the body signal before acting, for thirty days, in this notebook.\n\nThe baseline is what makes the results readable. Spend three days before the experiment recording the behaviour as it currently is. If you skip the baseline, the only comparison available at the end is your memory, and memory is generous.",
              },
              {
                type: "prose",
                heading: "Set the terms in advance",
                body:
                  "Decide the duration, the measure, and the stopping condition before day one. Thirty days is the usual length because it is long enough to contain a full emotional wave or a lunar cycle and short enough to survive. If you are a Reflector, thirty days is a useful approximation of one cycle but not the same thing; a true lunar cycle runs about twenty-eight days, and the experiment can be shaped around one.\n\nWrite the terms where you will see them: the behaviour, the measure, the duration, and the one sentence describing what would count as evidence against your hypothesis. An experiment that cannot fail is not an experiment. It is a costume.\n\nKeep the terms boring. Ambition is what breaks experiments in week two.",
              },
              {
                type: "list",
                heading: "The terms to fix on day zero",
                items: [
                  "One behaviour, in one context, stated as an action you can count.",
                  "One measure, written as a number or a yes or no.",
                  "A baseline of at least three days recorded before the change begins.",
                  "A fixed duration, thirty days or one lunar cycle for a Reflector.",
                  "One sentence describing what result would count against the hypothesis.",
                ],
              },
              {
                type: "callout",
                tone: "note",
                body:
                  "Record the baseline before you start. Three days of honest notes first will save you thirty days of guessing about whether anything changed.",
              },
              {
                type: "practice",
                title: "Write the terms",
                minutes: 15,
                steps: [
                  "Pick one behaviour you can perform or refuse once a day.",
                  "Write the measure in a form a stranger could count, such as number of times I said yes after a pause.",
                  "Record the baseline for the next three days without changing anything.",
                  "Write the duration and the day it ends, and put the end date in your calendar.",
                  "Write one sentence beginning: this experiment would be wrong if.",
                ],
              },
              {
                type: "check",
                question: "What makes a thirty-day experiment readable at the end?",
                options: [
                  "One changed behaviour, a measure, and a baseline recorded before the change.",
                  "Changing several behaviours at once so the effect is large enough to feel.",
                  "Relying on memory to compare how things were before.",
                  "Ending the experiment early if it stops feeling good.",
                ],
                answerIndex: 0,
                explanation:
                  "A single variable with a pre-recorded baseline and a countable measure is what allows the end of the experiment to mean anything. Changing several things at once is the tempting move because it feels more ambitious, but it makes attribution impossible and usually collapses by the second week. Memory and early exits both remove the comparison the experiment exists to produce.",
              },
            ],
          },
          {
            slug: "tracking-without-flinching",
            title: "Tracking Without Flinching",
            summary:
              "The log works only if it is written the same day, in the same format, including the days you would rather not record.",
            minutes: 15,
            blocks: [
              {
                type: "prose",
                heading: "The shape of a log entry",
                body:
                  "A log entry does not need to be literature. Three lines are enough: what happened, what the body did before you decided, and which theme was present afterwards. The third line is where the signature and not-self themes earn their place. Satisfaction, frustration, peace, anger, success, bitterness, surprise, and disappointment are easy to mark once a day and hard to argue with later.\n\nWrite the entry the same day. A log reconstructed at the weekend is a summary, and summaries slide toward the story you prefer. The value of the experiment is in the unedited days, particularly the ones that went badly.\n\nThe format should not change mid-experiment. If you add a column on day twelve, the first eleven days become incomparable.",
              },
              {
                type: "prose",
                heading: "Recording without correcting",
                body:
                  "There will be days when you did not follow your strategy. Record them. The point of the experiment is not to accumulate a perfect record but to find out what happens when the mechanics are used and when they are not. A log of thirty clean days tells you almost nothing, because it has no contrast in it.\n\nExpect the not-self themes to show up more visibly once you start tracking, because you are finally looking at them. This is not a sign the experiment is going badly. It is the instrument beginning to register.\n\nIf a day is too messy to summarise in three lines, write messy and one sentence about what happened. Consistency of format matters more than depth of reflection.",
              },
              {
                type: "callout",
                tone: "warning",
                body:
                  "A log kept only on good days is a highlight reel, not evidence. The difficult entries are the ones that carry the information.",
              },
              {
                type: "practice",
                title: "Three lines a night",
                minutes: 10,
                steps: [
                  "Keep the log somewhere you will see before bed, on paper or in a note you open daily.",
                  "Line one: the decision or event of the day that mattered most.",
                  "Line two: what the body did before you decided, in physical words.",
                  "Line three: which theme was present afterwards, signature or not-self.",
                  "Do not reread the log until the review. Reading it early invites you to manage the result.",
                ],
              },
              {
                type: "check",
                question: "Why does the log need entries from the days the experiment went badly?",
                options: [
                  "Because the contrast between followed and not followed is what makes the pattern visible.",
                  "Because bad days are more honest than good days.",
                  "Because the not-self themes only appear on bad days.",
                  "Because a complete record proves you took the experiment seriously.",
                ],
                answerIndex: 0,
                explanation:
                  "The experiment is comparing two conditions, so removing one of them removes the comparison and leaves a highlight reel. The second option sounds humble but is inaccurate: good days are not dishonest, they are simply only half the data. The third option is also wrong, since not-self themes can appear on days that felt fine and are often loudest just after a decision that looked successful.",
              },
            ],
          },
          {
            slug: "the-review",
            title: "The Review",
            summary:
              "Read the log once, coldly, and let it set the terms of the next thirty days rather than becoming a verdict on your character.",
            minutes: 18,
            blocks: [
              {
                type: "prose",
                heading: "Read once, then count",
                body:
                  "On the last day, read the whole log in one sitting. Do not read it in pieces over a week, and do not edit it while you read. Then count: how many days the strategy was used, how many days the signature theme was present, and how many the not-self theme was present. Three numbers is enough.\n\nLook for the relationship between the first and the others. If the days you paused produced satisfaction and the days you pushed produced frustration, you have a pattern, not a proof. One thirty-day run is a single observation. It is still worth more than the general impression you started with.\n\nNotice also what the log does not show. It cannot tell you whether an outcome was caused by your strategy or by the weather, the market, or another person's mood. Human Design does not predict outcomes. It describes the mechanics you were using.",
              },
              {
                type: "prose",
                heading: "Deciding the next thirty days",
                body:
                  "End the review by choosing one of three moves. Repeat the same experiment to see whether the pattern holds. Keep the behaviour and add a second variable in a different context. Or drop the experiment because the evidence did not support it, which is a legitimate result and should be written down as one.\n\nWrite a short paragraph in plain language: what you changed, what you observed, what you now believe, and how confident you are. Keep it under two hundred words and date it. If you run several of these across a year, the paragraphs become a record of your own mechanics in action, in your own words, which no chart can give you.\n\nThen set the next experiment. The practice is the point, not the conclusion.",
              },
              {
                type: "list",
                heading: "The review in five steps",
                items: [
                  "Read the full log once without editing it.",
                  "Count the days the strategy was used and the days each theme appeared.",
                  "Compare the strategy days against the not-self days and write the relationship in one sentence.",
                  "Name what the log cannot show, so you do not overclaim.",
                  "Choose one of three moves: repeat, extend, or stop, and date the decision.",
                ],
              },
              {
                type: "practice",
                title: "Run the review",
                minutes: 20,
                steps: [
                  "Set a timer for twenty minutes and read the entire log without stopping to analyse.",
                  "Write the three counts on a separate page.",
                  "Write one sentence relating the strategy days to the not-self days.",
                  "Write one sentence about what the experiment could not measure.",
                  "Write the next experiment in a single line, or write stop and the reason.",
                ],
              },
              {
                type: "check",
                question: "A Reflector wants the experiment to match a true lunar cycle. Roughly how long is that?",
                options: [
                  "About twenty-eight days",
                  "About thirty days exactly",
                  "About fourteen days",
                  "About ninety days",
                ],
                answerIndex: 0,
                explanation:
                  "A lunar cycle is roughly twenty-eight days, which is why thirty days is a convenient approximation but not the same interval. The second option is the common slip because thirty days is the standard experiment length quoted everywhere. Fourteen days is half a cycle and not long enough for a Reflector to sample a decision across the full turn, and ninety days is a different practice entirely.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "signal-and-transmission",
    title: "Signal and Transmission",
    subtitle: "Turning a chart into a practice, a body of work, and an audience",
    level: "advanced",
    tier: "adept",
    minutes: 154,
    description:
      "A chart is not a subject and it is not a brand. It is a description of how energy moves through one person, and that movement is raw material. This course is about the long work: finding the signal that repeats in your own design, giving it a form your authority can sustain, and building an audience without selling the mechanics short. The register stays observational. Nobody here can promise you reach, income, or outcomes.",
    outcomes: [
      "Distinguish a signal from a topic and locate your own signals in your defined channels and repeated themes.",
      "Read your open centres as perceptual instruments rather than as gaps in your competence.",
      "Name your signal in one plain sentence and test it against your own body of work.",
      "Choose a production rhythm and a form that match your authority instead of fighting it.",
      "Build a volume practice with an editing method that does not depend on the mood of the day.",
      "Read audience response as data, set terms, and handle money without running your not-self.",
    ],
    modules: [
      {
        slug: "finding-the-signal",
        title: "Finding the Signal",
        summary:
          "Your defined channels are the engine, your open centres are the lens, and the signal is the sentence that survives both.",
        lessons: [
          {
            slug: "the-chart-as-material",
            title: "The Chart as Material",
            summary:
              "Defined channels are the themes that keep returning in your work, whether or not you planned them.",
            minutes: 18,
            blocks: [
              {
                type: "prose",
                heading: "What keeps coming back",
                body:
                  "Look at the last five years of your work, whatever form it took: projects, essays, playlists, arguments, the things you kept explaining to friends. Now look at your defined channels. There is usually a correspondence that is obvious in hindsight and invisible while you were making it.\n\nA defined channel is not a talent and it is not a subject. It is a consistent route along which energy travels in you. Because it is consistent, it produces the same themes over and over, often in different clothing. A person with 34-10 might keep making work about self-directed action and integrity, and might never once have used those words. A person with 13-33 might keep collecting other people's stories and returning them as something the group can use.\n\nThe signal is not the channel name. The signal is what you keep noticing, filtered through the themes of your definition, and it usually shows up first as an irritation: the thing you cannot stop pointing out.",
              },
              {
                type: "prose",
                heading: "Signal against topic",
                body:
                  "A topic is something you can choose. A signal is something that keeps choosing you. Topics can be adopted, scheduled, and abandoned. Signals recur across unrelated projects and often embarrass you with their persistence. If you have ever sworn you were finished with a subject and then found it in the next piece anyway, that is the difference.\n\nThe mistake in creative work is to reverse the two: choose a topic that looks marketable, then try to power it with a signal that does not belong to it. The work becomes competent and inert. The other mistake is to treat the signal as a brand and repeat it until it dies. The signal recurs; the form around it should keep changing.\n\nGo into the inventory with the mechanics in hand, because the mechanics tell you where to look. Your defined channels are the engine. Your open centres are the lens. The signal lives where the two meet.",
              },
              {
                type: "list",
                heading: "Inventory before you name anything",
                items: [
                  "List every complete channel in your chart, with the two gates and the two centres it joins.",
                  "List the projects from the last three years that you would still defend.",
                  "For each project, write the one sentence it argues, regardless of its form.",
                  "Mark which sentences repeat across projects. Those are candidate signals.",
                  "Mark which complete channels might generate those sentences. Keep the page.",
                ],
              },
              {
                type: "practice",
                title: "Inventory the engine",
                minutes: 20,
                steps: [
                  "Set a timer for twenty minutes and list your complete channels on the left of a page.",
                  "On the right, list the three projects you would still defend.",
                  "Draw a line between each channel and any project it might explain.",
                  "Write the repeated sentence underneath, even if it sounds obvious or unmarketable.",
                  "Circle the channel with the most lines touching it. That is your likely engine.",
                ],
              },
              {
                type: "check",
                question: "What makes a defined channel a reliable source of material?",
                options: [
                  "It operates consistently, so the same themes recur regardless of the environment you are in.",
                  "It contains the gate of your Sun, which makes it the strongest part of the chart.",
                  "It is defined, which means it is rarer and therefore more valuable.",
                  "It has the most activated gates of any centre in the chart.",
                ],
                answerIndex: 0,
                explanation:
                  "Definition means an energy route operates consistently, and consistency is what produces a recurring signal across unrelated projects. The second option confuses emphasis with consistency: the Sun's gate matters for the profile and the cross, but a channel does not need it to be defined and productive. Rarity is not value, and a channel is defined by exactly two gates, so the fourth option misreads the mechanics.",
              },
            ],
          },
          {
            slug: "the-lens-of-the-open-centres",
            title: "The Lens of the Open Centres",
            summary:
              "Your open centres take in what others broadcast, which makes them the place you can see what the people inside a situation cannot.",
            minutes: 20,
            blocks: [
              {
                type: "prose",
                heading: "Perception, not deficit",
                body:
                  "An open centre amplifies what it receives and gives back a reading. That is a perceptual instrument, and it is often the sharpest thing a person has. The open Head feels which questions in the room are urgent and which are empty. The open Ajna renders other people's thinking faithfully and can hold several incompatible frames at once. The open Throat reads the timing of a conversation before anyone speaks.\n\nMove down the chart and the instruments keep changing. An open G sees the direction of a group more clearly than the group does. An open Heart sees what things are actually worth, because it is not defending a will of its own. An open Spleen reads the health of a room, a body, a relationship. An open Solar Plexus reads emotional weather with a sensitivity that people with a defined wave often lack. An open Sacral reads capacity, in a room or a team, with unnerving accuracy. An open Root reads pressure and knows when the urgency is manufactured.\n\nThe materials you make from these readings will feel obvious to you and revelatory to other people. That is how lenses work.",
              },
              {
                type: "prose",
                heading: "The cost of the lens",
                body:
                  "The same openness that perceives will also absorb. An open Throat under pressure talks. An open Solar Plexus becomes the loudest feeling in the room. An open Root hurries for no reason. The lens and the trap are the same mechanism, which is why the work is to use the reading without becoming the reading.\n\nThe discipline is timing. Notice the reading, write it down, and wait before you build anything on it. A perception taken at the pitch of absorption will be distorted. A perception recorded and revisited tomorrow will hold.\n\nAsk other people to check the reading against their own experience. You will often find that what you saw is accurate and that the other person could not see it from inside the situation. That gap is where a practice can live without needing permission from anyone.",
              },
              {
                type: "callout",
                tone: "note",
                body:
                  "Open centres are not damaged centres. They are the reason you can see what the defined cannot. Use the amplification as an instrument and give it time to settle before you act on what it shows you.",
              },
              {
                type: "practice",
                title: "Test one lens",
                minutes: 20,
                steps: [
                  "Choose the open centre you notice most often in other people.",
                  "Write one sentence describing what that centre lets you perceive.",
                  "Pick three people who know you well and ask each whether that sentence fits what they have seen you notice.",
                  "Record their answers verbatim, including disagreement.",
                  "Revise the sentence once, then keep both versions and compare them in a month.",
                ],
              },
              {
                type: "check",
                question: "A writer has an open Ajna. Which ability is most consistent with that?",
                options: [
                  "Holding several incompatible frames at once and rendering other people's thinking faithfully.",
                  "Forming one fixed opinion and defending it consistently for years.",
                  "Avoiding all abstract thought in favour of direct sensory detail.",
                  "Being unable to understand any viewpoint they do not already hold.",
                ],
                answerIndex: 0,
                explanation:
                  "An open Ajna samples and reflects the mental frameworks around it, which makes it flexible and unusually good at representing positions the person does not hold. The second option describes a defined Ajna, which has a consistent architecture and can return to the same opinion years later. Confusion and rigidity are not the open state; under pressure it may perform certainty, but its native mode is multiplicity.",
              },
            ],
          },
          {
            slug: "naming-the-signal",
            title: "Naming the Signal",
            summary:
              "Write the signal as one plain sentence, test it against your own work, and keep it away from slogans.",
            minutes: 16,
            blocks: [
              {
                type: "prose",
                heading: "One sentence, in plain words",
                body:
                  "A signal that cannot be stated in one sentence cannot be built on. The sentence does not need to be beautiful. It needs to be specific enough to be wrong. Not people are disconnected from their bodies, but the people who build the most useful things are the ones who can tolerate not deciding yet.\n\nWrite ten candidate sentences and read them against your body of work. Most will be topics wearing a signal's clothes. One or two will make you slightly uncomfortable, because they are more direct than the way you usually phrase things. Keep those.\n\nDo not use the vocabulary of the system in the sentence unless your audience already speaks it. Channel names, centre names, and type names are precise tools, but they make poor public language. The signal travels further in ordinary words.",
              },
              {
                type: "prose",
                heading: "Testing it honestly",
                body:
                  "A signal passes three tests. It recurs across your old work without being forced. It irritates you a little, because it names something you have been circling. And it is specific enough that a reader could disagree with it. If nobody could disagree, you have written a slogan.\n\nRun the sentence past two or three people whose judgement you trust. Ask whether it sounds like you, not whether they like it. Liking is cheap. Recognition is the test.\n\nKeep a running file of sentences. A signal often becomes visible only as a shape across several attempts, the way a coastline becomes visible only from a distance. Add to the file every time you catch yourself explaining the same thing again.",
              },
              {
                type: "list",
                heading: "Tests for a signal sentence",
                items: [
                  "It recurs across unrelated projects without being forced.",
                  "It names something you keep noticing rather than something you wish were true.",
                  "It is specific enough that a reasonable person could disagree with it.",
                  "It uses ordinary language rather than system vocabulary.",
                  "It sounds like you when read aloud, not like a description of you.",
                ],
              },
              {
                type: "practice",
                title: "Write ten, keep one",
                minutes: 15,
                steps: [
                  "Set a timer for ten minutes and write ten candidate sentences without editing.",
                  "Read all ten aloud and cut any that use jargon or could not be disagreed with.",
                  "Choose the one that makes you slightly uncomfortable and read it to someone who knows your work.",
                  "Ask only whether it sounds like you, and record the answer without defending the sentence.",
                  "Store the file and add a new sentence whenever you catch yourself explaining the same thing again.",
                ],
              },
              {
                type: "check",
                question: "Which of these is the strongest evidence that you have found a signal rather than a topic?",
                options: [
                  "The theme recurs across unrelated projects without you deliberately repeating it.",
                  "The theme is currently popular and has a large existing audience.",
                  "The theme is broad enough to apply to almost anyone.",
                  "The theme is one you chose after researching what sells.",
                ],
                answerIndex: 0,
                explanation:
                  "A signal recurs on its own, across projects and forms, often without the maker noticing until the pattern is pointed out. Popularity describes a market and says nothing about your mechanics, which is why the second option is the tempting professional answer but the wrong signal test. Breadth is the opposite of specificity, and a researched topic is a choice rather than a recurrence.",
              },
            ],
          },
        ],
      },
      {
        slug: "craft-and-form",
        title: "Craft and Form",
        summary:
          "Authority decides the working rhythm, volume produces the raw material, and repetition is how a signal becomes a body of work.",
        lessons: [
          {
            slug: "form-follows-authority",
            title: "Form Follows Authority",
            summary:
              "Emotional, sacral, splenic, ego, self-projected, mental, and lunar authorities each sustain a different working rhythm.",
            minutes: 20,
            blocks: [
              {
                type: "prose",
                heading: "The rhythm your design can hold",
                body:
                  "Most creative advice describes one working style and prescribes it to everyone. The mechanics suggest something more specific. The form that survives is the form that matches how a decision actually resolves in you, because a practice is a long sequence of small decisions.\n\nUnder emotional authority, nothing is judged clearly at the peak. A piece finished in a high will look wrong in a low, and a piece finished in a low will never be published. The sustainable form is the collection: work accumulated, left to settle, and released when the reading is stable across several days. Campaigns, albums, seasons, and portfolios suit this design. Daily posting does not, unless the emotional charge is genuinely low.\n\nUnder sacral authority, the rhythm is short and responsive. Make a thing, show it, watch the gut. The sacral answers what is in front of it, so a practice built from responses to real prompts will run longer than one built from a plan. Under splenic authority, the hit is instantaneous and once only, which favours fast forms: one-take recordings, live work, rapid drafts, decisions made on the first clear signal and not revisited.\n\nUnder ego or heart authority, the form should be built around promises you can keep. Short bursts of will, a clear deliverable, a defined end. Under self-projected authority, the work often arrives through speech: talks, teaching, conversation, voice notes. Under mental or environmental authority, clarity comes from talking in the right room over time, so the practice needs collaborators, a place, and patience. Under lunar authority, the cycle sets the tempo, and a decision made inside it can be revisited as the month turns.",
              },
              {
                type: "prose",
                heading: "Designing the container",
                body:
                  "A container is a fixed set of conditions you do not renegotiate every day: when you work, how long, what counts as finished, and what happens to the work when it is done. The container should be shaped around your authority and sized to survive your worst week, not your best one.\n\nIf you build a container that requires daily euphoria, you have built something that will fail in a fortnight and teach you nothing. If you build one that requires only that you appear and respond for a fixed length of time, it will hold for years.\n\nWrite the container down and treat it as an experiment rather than a vow. You are allowed to change it after thirty days and see whether the work gets easier. That is the same protocol as the experiment course, applied to making.",
              },
              {
                type: "list",
                heading: "Rhythms by authority",
                items: [
                  "Emotional: accumulate, settle, release as a body of work. Never judge at the peak or the trough.",
                  "Sacral: short loops. Make, show, watch the response, repeat.",
                  "Splenic: fast and first-take. Act on the single hit and do not demand a second.",
                  "Ego or Heart: promise-shaped bursts with a clear deliverable and a real end.",
                  "Self-Projected: talk it, record it, teach it, then write it down.",
                  "Mental or Environmental: conversation in the right room over time.",
                  "Lunar: a full cycle per decision, revisited as the month turns.",
                ],
              },
              {
                type: "practice",
                title: "Build a container",
                minutes: 20,
                steps: [
                  "Write your authority at the top of the page and the rhythm it requires underneath.",
                  "Choose three fixed conditions: a time, a session length, and a definition of finished.",
                  "Cut the session length until it is something you could do on your worst week.",
                  "Decide what happens to finished work, whether it is shown, stored, or released in batches.",
                  "Run the container for seven days, then write one line about whether the work resisted it.",
                ],
              },
              {
                type: "check",
                question: "Under emotional authority, when is the most reliable moment to judge a finished piece?",
                options: [
                  "On a later day, when the reaction has settled and reads the same from more than one point on the wave.",
                  "Immediately after finishing, while the details are still vivid.",
                  "At the peak of excitement, when confidence is highest.",
                  "As soon as someone else whose taste you trust praises it.",
                ],
                answerIndex: 0,
                explanation:
                  "Emotional clarity comes only after the wave has passed through both high and low, so a judgement made on a different day is the first one that can be trusted. Finishing energy is the tempting moment because the piece feels alive, but the wave is usually high then and the verdict will not hold. Praise does not resolve a wave either; it adds an outside signal to an instrument that is still moving.",
              },
            ],
          },
          {
            slug: "editing-and-volume",
            title: "Editing and Volume",
            summary:
              "Separate the making from the selecting, produce more than you need, and edit by reading rather than by mood.",
            minutes: 18,
            blocks: [
              {
                type: "prose",
                heading: "Two modes, two sessions",
                body:
                  "Making and selecting use different muscles and different timing. In the making session, the job is volume: more sentences, more takes, more variations, more bad ideas, no verdicts. In the selecting session, the job is judgement, and it is faster, colder, and usually shorter.\n\nCombining the two produces the familiar stall: a draft is written and immediately audited, and nothing survives. Keep them apart in time. Make in one session, select in another, and never in the same hour if you can help it.\n\nThe ratio matters more than the quality of any single piece. Twenty rough pieces contain more usable material than one piece polished for a month, because the twentieth attempt teaches you what the first could not.",
              },
              {
                type: "prose",
                heading: "Editing by signal",
                body:
                  "When you select, use a rule instead of a feeling. Read the material and mark only the places where your attention lifts, without editing them. Do that pass quickly and do not stop to fix anything. Then work only on what you marked.\n\nIf you have emotional authority, do the selecting pass on a different day from the making, and read the marked material twice, at least a day apart, before committing. If you have splenic authority, trust the first pass and stop second-guessing it. If you have sacral authority, read the material aloud and notice where the body responds. If you have mental authority, read it to someone and listen to what you say while explaining it.\n\nThe not-self move in editing is to rewrite for an imagined critic. That critic is usually a composite of everyone who has ever been unimpressed, and it has no useful taste.",
              },
              {
                type: "callout",
                tone: "key",
                body:
                  "Volume is not a virtue and selection is not vanity. Make more than you need so that you can choose with evidence instead of hope.",
              },
              {
                type: "practice",
                title: "Twenty and three",
                minutes: 20,
                steps: [
                  "Choose one small form you can complete in a few minutes, such as a paragraph, a sketch, or a voice note.",
                  "Set a timer for twelve minutes and produce as many as you can without judging any of them.",
                  "Stop at the timer and walk away for at least ten minutes.",
                  "Return and mark the three that hold your attention, without editing them.",
                  "Save the rest in a folder named with the date. Do not delete anything this week.",
                ],
              },
              {
                type: "check",
                question: "Why should making and selecting be kept in separate sessions?",
                options: [
                  "Because judging while generating shuts down the volume the work needs to draw from.",
                  "Because selecting requires better equipment than making.",
                  "Because generating is emotional and selecting is logical, and the two cannot mix.",
                  "Because the body cannot produce more than one idea at a time.",
                ],
                answerIndex: 0,
                explanation:
                  "The generating mode depends on producing freely, and an internal verdict running alongside it narrows the output before there is enough material to choose from. The third option sounds plausible but misplaces the distinction: both modes involve feeling and judgement, and the useful separation is in time, not in kind. Nothing in the mechanics limits a person to one idea at a time.",
              },
            ],
          },
          {
            slug: "making-the-thing-again",
            title: "Making the Thing Again",
            summary:
              "Repetition is how a signal becomes a body of work, and the sacral and splenic signals tell you when a series is finished.",
            minutes: 22,
            blocks: [
              {
                type: "prose",
                heading: "The series is the form",
                body:
                  "A single piece is an event. A series is a body of work. If your signal recurs, the natural form for it is repetition with variation: the same question asked twenty times in different materials until the answer stops moving. Most people abandon the series too early because the second attempt feels less exciting than the first. Excitement is not the signal.\n\nRepetition is not the same as sameness. Repeating the signal means returning to the question. Repeating the form means producing the same object again, which is how a signature style is built and also how it calcifies. The first is generative for years. The second has a natural lifespan, and it is usually shorter than the maker expects.\n\nDecide the number in advance. Ten pieces, or twenty, or one hundred. A count makes the series a practice rather than a mood, and it gives you a finish line that does not depend on how you feel that week.",
              },
              {
                type: "prose",
                heading: "Knowing when it is done",
                body:
                  "The body usually knows before the mind does. Under sacral authority, the response to the next iteration flattens: the gut stops lifting and the work becomes an obligation. Under splenic authority, the knowing is a single quiet beat that says enough, and it will not repeat. Under emotional authority, the wave eventually produces the same verdict several days in a row, which is the closest thing to certainty available. Under lunar authority, the cycle turns and the question no longer holds the same charge.\n\nThe mind will argue for continuing: the audience is growing, the series is finally working, quitting now would waste the investment. This is the sunk-cost argument and it is very good at sounding like discipline.\n\nWrite down the stopping condition before you begin the series. Then honour it. A finished series you can walk away from is worth more than an exhausted one you keep milking.",
              },
              {
                type: "list",
                heading: "Working a series",
                items: [
                  "State the question once. Let each piece be an attempt at an answer.",
                  "Fix a count, ten or twenty or a hundred, before the first piece is made.",
                  "Vary the material, not the question. The question is the constant.",
                  "Mark the iteration where the body stops responding, and record the date.",
                  "Write the stopping condition in advance and let it end the series, not the mood of the week.",
                ],
              },
              {
                type: "practice",
                title: "Open a series",
                minutes: 25,
                steps: [
                  "Write the question your signal keeps asking in one sentence.",
                  "Choose a count that you could finish in three months at your honest pace.",
                  "Make the first piece now, badly, in under fifteen minutes.",
                  "Write the date and the stopping condition on the same page as the question.",
                  "Put the page where you work and add the second piece within forty-eight hours.",
                ],
              },
              {
                type: "check",
                question: "Which signal most reliably tells you a series has run its course?",
                options: [
                  "The response to the next iteration flattens, and the work starts to feel like an obligation.",
                  "The audience for the series begins to grow faster than before.",
                  "You have an idea for a completely different project.",
                  "You have reached the count you originally set, regardless of anything else.",
                ],
                answerIndex: 0,
                explanation:
                  "A flattened response is the body reporting that the question no longer has energy in it, and it is the most reliable internal signal that the series is finished. Growth in the audience is the tempting reason to continue, but popularity is not stamina and it often peaks exactly when the maker is done. Having a new idea is normal throughout, and a count is a container that can be revised when the body speaks clearly.",
              },
            ],
          },
        ],
      },
      {
        slug: "audience-and-transmission",
        title: "Audience and Transmission",
        summary:
          "An audience is the set of people who respond, and money is part of the terms on which the work travels.",
        lessons: [
          {
            slug: "the-audience-as-return-signal",
            title: "The Audience as Return Signal",
            summary:
              "Response is the data, reach is only volume, and each type receives and uses response differently.",
            minutes: 19,
            blocks: [
              {
                type: "prose",
                heading: "Response is narrower and more useful than reach",
                body:
                  "Reach is how many people saw the work. Response is how many did something that cost them attention: wrote back, asked a question, made a version of their own, showed up in person, paid for the next thing. Reach can be bought and usually is. Response cannot be bought without eventually being detected as noise.\n\nThe mechanical reading is that an audience is a return signal, and what it returns depends on your type. A Generator makes something and watches the gut response to the response: which piece produced the strongest reaction in the room, and which produced an answering lift in the body. That lift is the next brief. A Manifesting Generator gets the same signal and then has to inform the audience what is coming, because the speed of the work will outrun their expectations.\n\nA Manifestor is read by the audience through surprise. Informing before acting does not reduce the work; it reduces the resistance the work meets. A Reflector samples an audience across the cycle and can tell, better than almost anyone, whether a room is healthy, and whether the work belongs there. A Projector's transmission is narrower: the work has to be visible enough to be recognised and specific enough to be invited.",
              },
              {
                type: "prose",
                heading: "Reading without pandering",
                body:
                  "The trap for every type is the same: convert response into a metric, then optimise the metric, then make work for the metric. This produces a slow drift toward the average of what already exists, and it is hard to notice from inside because every individual decision is defensible.\n\nThe corrective is to keep two ledgers. In the first, record what you made and what your own response was to making it. In the second, record the specific requests, questions, invitations, and payments that came back. Read both together. When the first ledger is full of work you would not defend and the second is full of engagement, you are being paid in attention for something you do not believe, which is a losing trade.\n\nLet the requests shape the next piece, not the next identity. The signal is yours. The delivery can be theirs.",
              },
              {
                type: "callout",
                tone: "note",
                body:
                  "Count requests, not impressions. A request is a person spending attention on you. Impressions are a number that can rise while nothing at all is happening.",
              },
              {
                type: "practice",
                title: "Two ledgers",
                minutes: 20,
                steps: [
                  "Start a page with two columns: what I made, and what came back.",
                  "For the last month, list every piece you published or showed in the first column.",
                  "In the second column, list only specific returns: requests, questions, invitations, payments, introductions.",
                  "Mark the three pieces that produced the most specific returns.",
                  "Write one sentence about what those three share, and use it as the next brief.",
                ],
              },
              {
                type: "check",
                question:
                  "A Projector publishes work consistently. Which signal most reliably shows that the work is landing?",
                options: [
                  "Recognition that arrives as a specific request or invitation.",
                  "A rapidly rising follower count.",
                  "Praise from other makers in the same field.",
                  "A single post that reaches an unusually large audience.",
                ],
                answerIndex: 0,
                explanation:
                  "The Projector's success theme arrives as recognition, and the practical form of recognition is a specific request or invitation from someone who has seen the work and wants the real thing. Follower counts and reach are volume measurements that can rise without any real recognition, which is why they are the tempting professional answer and the wrong one. Peer praise is pleasant but is not the same as being invited to do the work.",
              },
            ],
          },
          {
            slug: "money-terms-and-staying-clean",
            title: "Money, Terms, and Staying Clean",
            summary:
              "Pricing, scope, and payment terms are part of the mechanics, and the not-self shows up fastest in the invoices.",
            minutes: 21,
            blocks: [
              {
                type: "prose",
                heading: "The not-self shows up in money first",
                body:
                  "Money is where each type's not-self theme becomes legible, because money involves a decision with a number attached and no way to pretend afterwards. A Generator who says yes to underpaid work because the Sacral never answered the question will feel frustration, and it will look like resentment toward the client. A Projector who gives away the work before an invitation has been extended will feel bitterness, and it will look like being undervalued by an ungrateful world.\n\nA Manifestor who is managed into a process without being informed will feel anger, and it will look like a temper. A Manifesting Generator who moves fast without informing will meet resistance and read it as obstruction. A Reflector who is pushed to commit before the cycle has turned will feel disappointment, which is the quietest of the five signals and the easiest to explain away.\n\nNone of this is a reason to be difficult about money. It is a reason to set terms in advance, while the head is clear, so that the decision is not made at the moment of pressure.",
              },
              {
                type: "prose",
                heading: "Terms as a container",
                body:
                  "Terms are the container for a working relationship. At minimum: what is being made, what is not, the fee, the payment schedule, the number of revisions, who owns the result, and what happens if the work is cancelled. Every one of those clauses exists to protect the work rather than to protect your ego.\n\nAn open Heart centre is the most common place for pricing to go wrong. The temptation is to undercharge in order to prove that the work is not about money, and then to resent the client for accepting the price. A defined Heart has its own version: promising more than the will can sustain, then needing to renegotiate halfway, which damages trust more than a higher initial number would.\n\nSet the number before the conversation, write it in a sentence, and say the sentence without adding a discount. If your authority needs time, take the time and give a clear date by which you will answer.",
              },
              {
                type: "prose",
                heading: "What this cannot do",
                body:
                  "None of this predicts what your work will earn. A chart describes mechanics, not markets, and no amount of correct strategy guarantees an income. What the mechanics can do is tell you when you are deciding from your not-self, which is useful precisely because those decisions are the ones that quietly accumulate into a career you did not want.\n\nKeep the practice honest and small. Make the work, show it, set terms, record what comes back, and let the pattern build over a year rather than a week. The signal will survive the market. That is the only claim worth making.",
              },
              {
                type: "list",
                heading: "Terms worth writing down",
                items: [
                  "Scope: what is included, in plain language, and what is explicitly not.",
                  "Fee and schedule: the number, the deposit, and the date the balance is due.",
                  "Revisions: how many are included and what an additional round costs.",
                  "Ownership: who holds the work after delivery and what the maker retains.",
                  "Exit: what happens if either side cancels, including work already completed.",
                ],
              },
              {
                type: "practice",
                title: "Write the sentence",
                minutes: 20,
                steps: [
                  "Choose one thing you sell or want to sell, and write its scope in three lines.",
                  "Decide the fee by asking what the work is worth to the person receiving it, not what feels safe to ask.",
                  "Write one sentence beginning: the fee is, and the terms are.",
                  "Say the sentence aloud to someone who will not argue with you, and notice whether your voice holds.",
                  "Send it to one real person this week, with a clear date for their answer.",
                ],
              },
              {
                type: "check",
                question: "What is the characteristic money mistake of an open Heart centre?",
                options: [
                  "Undercharging to prove the work is not about money, then resenting the client for accepting.",
                  "Refusing all paid work in order to keep the practice pure.",
                  "Charging far above the market and losing every client.",
                  "Being indifferent to money and forgetting to invoice at all.",
                ],
                answerIndex: 0,
                explanation:
                  "The open Heart amplifies questions of worth and will, and the common compensation is to prove that you do not need the money by pricing below what the work is worth, which produces resentment when the client agrees. The third option describes an overcorrection rather than the characteristic pattern, and indifference, the fourth, belongs to no centre: an open Heart usually cares about proof of value more than a defined one does.",
              },
            ],
          },
        ],
      },
    ],
  },
] satisfies readonly Course[];
