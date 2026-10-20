/**
 * The first-run dashboard tour.
 *
 * A step is addressed by a `data-tour` attribute rather than a CSS selector or a
 * DOM id, so the tour never depends on styling hooks or on ids that other
 * components may also want. A step whose target is missing — or is laid out at
 * zero size, which is what `display: none` produces — is skipped, so the same
 * list works on desktop and on mobile without a second configuration.
 *
 * The order is the order a new member needs it: the map of the place, where to
 * start, why the page is showing what it is showing, then the chart everything
 * else is derived from.
 */

export interface TourStep {
  /** The `data-tour` attribute value of the element to spotlight. */
  target: string;
  /** The step heading; also the accessible name of the dialog. */
  title: string;
  /** One short paragraph. Plain text, not markup. */
  body: string;
}

export const DASHBOARD_TOUR: readonly TourStep[] = [
  {
    target: "nav",
    title: "Eleven rooms, one map",
    body: "The rail on the left is the whole platform: your chart, the cosmic map, KP horary, the Collective, matching, messages, calls, courses, flashcards and settings. On a phone this is the menu in the header.",
  },
  {
    target: "setup",
    title: "Start here",
    body: "Five things that make The Cipher work for you. The list ticks itself off as you go and disappears once it is done — you will not be nagged.",
  },
  {
    target: "for-you",
    title: "Why these, and not others",
    body: "Every card is ranked from your chart, your tier and the rooms you are in, and each one tells you why it surfaced. Nothing here is a generic recommendation.",
  },
  {
    target: "chart",
    title: "The chart is the spine",
    body: "Everything — placements, matching, timing, the map — is derived from one verified birth moment and the KP chart cast from it. Fix that moment and the rest sharpens.",
  },
];
