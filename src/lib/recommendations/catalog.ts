/** Which interests each course serves, for recommendations. Unlisted courses serve none. */
export const COURSE_INTERESTS: Readonly<Record<string, string[]>> = {
  "reading-your-own-chart": ["human-design"],
  "kp-foundations": ["kp-horary", "kp-timing", "research"],
  "the-experiment": ["human-design", "research"],
  "signal-and-transmission": ["creative", "business", "teaching"],
};
