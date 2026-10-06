/**
 * KP Foundations — the Krishnamurti Paddhati course.
 *
 * Every structural fact here matches the KP engine in `@/lib/kp` and is
 * checked by its tests: the KP ayanamsa (Swiss Ephemeris definition), the 27
 * nakshatras and their Vimshottari lords, the 249-row sub table, Placidus
 * cusps, the four significator levels, ruling planets and the Vimshottari
 * dasha. Numbers quoted for the ayanamsa were read from the Swiss Ephemeris.
 *
 * The register is technical and plain. KP is taught as a method of reading,
 * with its own conventions stated, not as a forecast of anyone's life.
 */

import type { Course } from "./courses";

export const KP_FOUNDATIONS: Course = {
  slug: "kp-foundations",
  title: "KP Foundations",
  subtitle: "Reading a chart by its sub lords",
  level: "foundation",
  tier: "free",
  minutes: 96,
  description:
    "Krishnamurti Paddhati from the ground up: the sidereal frame and the KP ayanamsa, nakshatras and star lords, the 249 subs, Placidus cusps and the cuspal sub lord, the four levels of significators, ruling planets and the Vimshottari dasha — each one tied to what you see in your own chart.",
  outcomes: [
    "Explain why KP is sidereal and what the KP ayanamsa does to every position.",
    "Read any graha or cusp as a chain: sign lord, star lord, sub lord, sub-sub lord.",
    "Say why the birth time must be exact to the second, using your own cusps.",
    "Build the four levels of significators for a house and read them in order.",
    "Find your running mahadasha and bhukti and say how KP reads them.",
  ],
  modules: [
    {
      slug: "the-kp-frame",
      title: "The KP Frame",
      summary: "The zodiac KP measures in, the 27 stars that divide it, and the subs that divide the stars.",
      lessons: [
        {
          slug: "sidereal-and-the-ayanamsa",
          title: "Sidereal, and Why the Ayanamsa Matters",
          summary:
            "KP measures positions against the stars, not the seasons. The ayanamsa is the single number that converts one into the other, and KP uses its own.",
          minutes: 12,
          blocks: [
            {
              type: "prose",
              heading: "Two zero points",
              body:
                "Every longitude needs a starting point. The seasonal (tropical) frame starts where the Sun crosses the equator in March. The sidereal frame starts at a fixed point among the stars. Because the Earth's axis slowly precesses, the seasonal starting point drifts backwards against the stars by about fifty arcseconds a year, so the two frames separate a little more every year.\n\nThe ayanamsa is the size of that separation on a given date. A sidereal longitude is simply the true position of a graha minus the ayanamsa for that moment. Nothing else about the planet's position changes: it is the same point in the sky, labelled from a different zero.\n\nKP is sidereal. Every graha, every cusp and every sub lord on this platform is computed in that frame, and there is no seasonal chart anywhere to fall back on.",
            },
            {
              type: "prose",
              heading: "The KP ayanamsa",
              body:
                "Different traditions place the sidereal zero point slightly differently. KP uses the Krishnamurti ayanamsa: 22°21′50″ at the start of 1900, carried forward by precession. On 1 January 2000 it was about 23°45′23″, and on 1 January 2025 about 24°06′35″ (values including nutation, as the Swiss Ephemeris prints them).\n\nThe widely used Lahiri ayanamsa runs about 5′49″ larger. That sounds negligible until you remember that the smallest KP sub is only 40′ wide: a planet near a sub boundary can change its sub lord depending on which ayanamsa is used. This is why a KP chart must say which ayanamsa it uses, and why mixing a KP reading with a Lahiri ephemeris quietly produces a different chart.",
            },
            {
              type: "callout",
              tone: "key",
              body:
                "Your chart prints its ayanamsa at the centre of the wheel and in the method badges. If you compare against another KP program, check that number first.",
            },
            {
              type: "check",
              question: "Why can two 'sidereal' charts for the same birth show different sub lords?",
              options: [
                "They may use different ayanamsas, which shift every position by a few arcminutes.",
                "Sidereal charts change depending on the season the person was born in.",
                "The sub lords depend on the house system but not on the zodiac.",
                "Sidereal and tropical positions are the same, so any difference is a typo.",
              ],
              answerIndex: 0,
              explanation:
                "Every sidereal position is the true position minus an ayanamsa, and the traditions disagree on that number by arcminutes. KP's subs are narrow enough — as little as 40′ — for that difference to move a planet into the next sub. Sub lords depend on the zodiac as much as on the cusps.",
            },
          ],
        },
        {
          slug: "nakshatras-and-star-lords",
          title: "Nakshatras and Star Lords",
          summary:
            "The 27 nakshatras divide the sidereal zodiac into equal stars of 13°20′, each ruled by one of the nine grahas in Vimshottari order.",
          minutes: 13,
          blocks: [
            {
              type: "prose",
              heading: "Twenty-seven equal stars",
              body:
                "Divide 360° by 27 and each nakshatra spans 13°20′. Ashwini begins at 0° of sidereal Mesha (Aries); Revati ends at 30° of Meena (Pisces). Each nakshatra is further split into four padas of 3°20′.\n\nThe nine grahas rule the nakshatras in a fixed cycle that starts with Ashwini: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury — then the same nine again from Magha, and again from Mula. This is the Vimshottari order, and you will meet it three more times: in the subs, the sub-subs and the dashas.",
            },
            {
              type: "prose",
              heading: "Why the star lord matters most",
              body:
                "KP's central idea is that a graha delivers the results of the star it occupies. The star lord shows which matters the graha is working for — the houses that the star lord occupies and owns. The graha itself is the agent; its star lord is the source.\n\nSo when you read a planet in KP, you do not stop at its sign. You ask: whose star is it in, and what does that star lord signify in this chart? The sub lord, the next lesson's subject, then decides whether those matters turn out favourably.",
            },
            {
              type: "list",
              heading: "Find it in your chart",
              items: [
                "The Nakshatra column of the Grahas table names each graha's star and pada.",
                "The Star lord column is the graha that rules it, from the cycle above.",
                "The outer ring of the wheel marks all 27 nakshatras by their lords.",
              ],
            },
            {
              type: "check",
              question: "A graha sits at 20° of sidereal Mesha. What is its star lord?",
              options: [
                "Venus, because 20° falls in Bharani (13°20′–26°40′), which Venus rules.",
                "Mars, because Mars rules Mesha.",
                "Ketu, because Ashwini is the first nakshatra of Mesha.",
                "The Sun, because Krittika begins in Mesha.",
              ],
              answerIndex: 0,
              explanation:
                "Ashwini covers 0°–13°20′ and Bharani 13°20′–26°40′, so 20° is in Bharani, the second nakshatra, ruled by Venus. Mars is the sign lord, a different link in the chain. Krittika only begins at 26°40′.",
            },
          ],
        },
        {
          slug: "the-249-subs",
          title: "Sub Lords and the 249 Divisions",
          summary:
            "Each nakshatra is divided into nine unequal subs in proportion to the Vimshottari years. The sub lord is the deciding voice in KP.",
          minutes: 14,
          blocks: [
            {
              type: "prose",
              heading: "Unequal by design",
              body:
                "The nine Vimshottari periods add up to 120 years: Ketu 7, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17. KP divides each nakshatra's 13°20′ in exactly those proportions. A sub of a graha with a Y-year period is 13°20′ × Y ÷ 120 wide — so a Venus sub is 2°13′20″ and a Sun sub only 40′.\n\nThe subs inside a nakshatra start with the nakshatra's own lord and continue in Vimshottari order. Ashwini's subs therefore run Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury; Bharani's start with Venus and wrap round to Ketu at the end.",
            },
            {
              type: "prose",
              heading: "Why 249 and not 243",
              body:
                "Twenty-seven nakshatras times nine subs is 243. But sign boundaries fall every 30°, and nakshatra boundaries every 13°20′; the two only coincide every 120°. Where a sign boundary cuts through the middle of a sub, the two halves have different sign lords, so the classical KP table lists them as separate rows. That happens six times, giving 249.\n\nThe platform generates this table from first principles rather than copying a printed one, so a typo in a book cannot reach your chart. Each sub is divided again the same way for the sub-sub lord.",
            },
            {
              type: "callout",
              tone: "note",
              body:
                "Read every position as a chain: sign lord → star lord → sub lord → sub-sub lord. Select any graha or cusp on your wheel to see its chain in that order.",
            },
            {
              type: "check",
              question: "Why is a Sun sub narrower than a Venus sub?",
              options: [
                "Sub widths follow the Vimshottari years, and the Sun's 6 years are fewer than Venus' 20.",
                "The Sun moves faster than Venus, so its subs are compressed.",
                "Sun subs only occur in fire signs, which are shorter.",
                "All subs are equal; the difference is a display rounding.",
              ],
              answerIndex: 0,
              explanation:
                "Each sub is 13°20′ × years ÷ 120. Six years gives 40′; twenty gives 2°13′20″. Planetary speed plays no part in the width of a sub.",
            },
          ],
        },
      ],
    },
    {
      slug: "houses-and-significators",
      title: "Houses and Significators",
      summary: "Placidus cusps, the cuspal sub lord, and the four levels by which grahas signify houses.",
      lessons: [
        {
          slug: "placidus-and-the-cuspal-sub-lord",
          title: "Placidus Cusps and the Cuspal Sub Lord",
          summary:
            "KP uses unequal Placidus houses. The sub lord of each cusp decides whether that house's matters fructify — which is why the birth second matters.",
          minutes: 15,
          blocks: [
            {
              type: "prose",
              heading: "Unequal houses",
              body:
                "KP houses are Placidus houses: each cusp is found by trisecting the time a degree of the zodiac takes to cross from the horizon to the meridian. The result is twelve houses of unequal size, and a sign can begin inside a house rather than at its cusp. A graha belongs to the house that runs from one cusp up to the next.\n\nPlacidus has a real limit: inside the polar circles part of the zodiac never rises or sets, and the cusps cannot be constructed. KP has no substitute system, so a chart for such a place is refused rather than quietly drawn with different houses.",
            },
            {
              type: "prose",
              heading: "The deciding voice",
              body:
                "In KP the sub lord of a cusp decides whether the matters of that house will be fulfilled for the native. The cuspal sub lord is judged by the houses it signifies: if it signifies the houses that support the matter, the matter is promised; if it signifies the houses that deny it, it is not.\n\nThat puts enormous weight on twelve small arcs. The Ascendant turns through the whole zodiac in a day — on average about a degree every four minutes, faster or slower by sign and latitude — so a cusp crosses a 40′ Sun sub in under three minutes of clock time. A birth time rounded to the nearest five minutes can hand a different sub lord to every cusp.",
            },
            {
              type: "callout",
              tone: "warning",
              body:
                "The Cusps table shows, for each cusp, how many seconds of birth-time error it can absorb before its sub lord changes. Anything shown in red changes within ten seconds: read it as uncertain unless your birth record is exact.",
            },
            {
              type: "practice",
              title: "Read your own cusps",
              minutes: 10,
              steps: [
                "Open My Chart and find the Cusps table.",
                "Write down the sub lord of cusps 1, 7 and 10.",
                "For each, note the 'Sub holds' value. Which cusp is most sensitive to your birth time?",
                "Select that cusp on the wheel and read its full lordship chain in the detail panel.",
              ],
            },
            {
              type: "check",
              question: "Why does KP ask for the birth time to the second?",
              options: [
                "Because cuspal sub lords can change within seconds to a few minutes of clock time, and they decide each house.",
                "Because the Sun changes nakshatra every few seconds.",
                "Because the ayanamsa changes every second.",
                "Because Placidus houses only exist at exact seconds.",
              ],
              answerIndex: 0,
              explanation:
                "The cusps move fastest: roughly 15″ of arc per second of clock time. The narrowest subs are 40′ wide, so a cusp near a sub edge can change sub lord with a few seconds of error. The Sun takes about a day to move one degree, and the ayanamsa changes by about 50″ a year.",
            },
          ],
        },
        {
          slug: "four-levels-of-significators",
          title: "The Four Levels of Significators",
          summary:
            "A graha signifies a house in four ways, from strongest to weakest. Reading them in order is how KP connects grahas to life areas.",
          minutes: 15,
          blocks: [
            {
              type: "list",
              heading: "For any house, strongest first",
              items: [
                "A — grahas in the star of an occupant of the house.",
                "B — the occupants of the house.",
                "C — grahas in the star of the house's lord (the sign lord of its cusp).",
                "D — the house's lord itself.",
              ],
            },
            {
              type: "prose",
              heading: "Why the star comes first",
              body:
                "Level A ranks above the occupants themselves because of KP's first principle: a graha gives the results of its star lord. If Saturn occupies the 10th and the Moon sits in Saturn's star, the Moon carries the 10th house's matters more strongly than Saturn does. The same logic puts C above D.\n\nAn empty house is not a dead house. With no occupants, levels A and B are empty and the house is signified through its lord (D) and the grahas in its lord's star (C).",
            },
            {
              type: "prose",
              heading: "Rahu and Ketu as agents",
              body:
                "The nodes have no signs of their own. In KP they act as agents: besides their own occupation and star relationships, a node signifies what its sign lord signifies. The significator table on your chart includes the nodes this way, and the detail panel says so when you select one.",
            },
            {
              type: "check",
              question: "House 7 is occupied by Mars, and Venus is in Mars' star. Which is the stronger significator of the 7th?",
              options: [
                "Venus — level A, a graha in the star of an occupant, outranks the occupant itself.",
                "Mars — occupants are always the strongest significators.",
                "Neither, unless one of them owns the 7th cusp.",
                "They are equal, because both are connected to the 7th.",
              ],
              answerIndex: 0,
              explanation:
                "Level A (in the star of an occupant) comes before level B (the occupant). This ordering is the practical consequence of reading a graha by its star lord.",
            },
          ],
        },
      ],
    },
    {
      slug: "time",
      title: "Time: Ruling Planets and Dashas",
      summary: "How KP reads the moment of judgement, and the 120-year cycle that times a life.",
      lessons: [
        {
          slug: "ruling-planets",
          title: "Ruling Planets",
          summary:
            "The ruling planets of any moment — day lord, Lagna and Moon lords — are KP's tool for judging a question and confirming a time.",
          minutes: 12,
          blocks: [
            {
              type: "prose",
              heading: "Seven lords of a moment",
              body:
                "At any moment and place, KP takes seven lords: the day lord; the sign, star and sub lords of the Lagna (Ascendant); and the sign, star and sub lords of the Moon. The distinct grahas among them are the ruling planets.\n\nThe day lord follows the weekday — Sunday the Sun, Monday the Moon, Tuesday Mars, Wednesday Mercury, Thursday Jupiter, Friday Venus, Saturday Saturn — but the Vedic day begins at local sunrise, not midnight. A question asked at 4 a.m. on a Monday, before sunrise, still has Sunday's lord.",
            },
            {
              type: "prose",
              heading: "How they are used",
              body:
                "In KP horary, the ruling planets at the time of judgement are expected to agree with the significators of the matter. Krishnamurti also used them to test a recorded birth time: the ruling planets at birth should be well represented among the significators of the chart.\n\nThis platform shows the ruling planets at birth on every chart. It does not move your birth time to make them agree — rectification is a judgement for a practitioner, made openly, not something an engine should do silently.",
            },
            {
              type: "check",
              question: "Someone asks a question at 05:10 on a Thursday in Delhi, where sunrise is at 05:40. What is the day lord?",
              options: [
                "Mercury — before sunrise it is still Wednesday's Vedic day.",
                "Jupiter — it is Thursday on the calendar.",
                "The Sun — sunrise has not happened, so the Sun rules.",
                "The Moon — night hours belong to the Moon.",
              ],
              answerIndex: 0,
              explanation:
                "The Vedic day runs from sunrise to sunrise. At 05:10, sunrise has not yet ended Wednesday, so its lord, Mercury, is the day lord.",
            },
          ],
        },
        {
          slug: "vimshottari-dasha",
          title: "The Vimshottari Dasha",
          summary:
            "A 120-year cycle of planetary periods, started from the Moon's nakshatra at birth, and read in KP through each period lord's significations.",
          minutes: 15,
          blocks: [
            {
              type: "prose",
              heading: "Where the cycle starts",
              body:
                "The first mahadasha of a life belongs to the lord of the Moon's nakshatra at birth. How much of it remains depends on how far the Moon had travelled through that nakshatra: a Moon halfway through Bharani leaves half of Venus' twenty years still to run. After that the periods follow in Vimshottari order, each for its full length.\n\nEach mahadasha is divided into nine bhuktis in the same proportions, starting with the mahadasha lord's own bhukti; each bhukti is divided again into antaras. The platform uses a year of 365.25 days, the usual KP convention, and prints it under the dasha list.",
            },
            {
              type: "prose",
              heading: "How KP reads a period",
              body:
                "A period lord gives the results of the houses it signifies — through its star lord first, as always — and the sub lord of the period lord judges whether those results are favourable. A matter promised by the cuspal sub lords is expected to happen in the joint periods of grahas that signify the relevant houses.\n\nBecause the starting point is the Moon's exact longitude, dasha dates are birth-time sensitive too: the Moon moves about half an arcsecond per second of clock time, which shifts dasha boundaries by hours to days, not years.",
            },
            {
              type: "practice",
              title: "Find your running periods",
              minutes: 8,
              steps: [
                "Open My Chart and scroll to the Vimshottari dasha.",
                "Note the mahadasha you were born in and the balance remaining at birth.",
                "Find the period marked running, and open it to see its bhuktis.",
                "Look up the running mahadasha lord in the Grahas table: whose star is it in, and which houses does that star lord signify?",
              ],
            },
            {
              type: "check",
              question: "The Moon at birth is 3/4 of the way through Rohini (ruled by the Moon). What is the first mahadasha and its balance?",
              options: [
                "Moon, with 2.5 of its 10 years remaining.",
                "Moon, with 7.5 of its 10 years remaining.",
                "Mars, the next lord after the Moon, in full.",
                "Venus, because Rohini is in Vrishabha, ruled by Venus.",
              ],
              answerIndex: 0,
              explanation:
                "The first period belongs to the nakshatra lord (the Moon). Three-quarters of the nakshatra has been travelled, so one quarter of the Moon's 10 years — 2.5 years — remains. The sign lord plays no part in the dasha.",
            },
          ],
        },
      ],
    },
  ],
};
