import test from "node:test";
import assert from "node:assert/strict";
import { recommend, type RecommendationContext } from "../recommend";

const now = new Date("2026-10-06T12:00:00Z");
const base: RecommendationContext = {
  now,
  tierRank: 1,
  hasBirthProfile: true,
  interests: ["kp-timing"],
  hdType: "Projector",
  timing: null,
  courses: [],
  events: [],
  channels: [],
  matchingOptIn: true,
  topMatch: null,
  savedPlaces: 1,
  dueFlashcards: 0,
};

test("no birth profile: verifying the birth moment comes first", () => {
  const recs = recommend({ ...base, hasBirthProfile: false });
  assert.equal(recs[0].id, "setup:birth");
});

test("a bhukti change within 30 days outranks everything but setup", () => {
  const recs = recommend({
    ...base,
    timing: {
      running: [
        { lord: "moon", start: new Date("2026-03-31"), end: new Date("2036-03-31") },
        { lord: "moon", start: new Date("2026-03-31"), end: new Date("2026-10-20") },
      ],
      nextBhukti: { lord: "mars", start: new Date("2026-10-20"), end: new Date("2027-05-20") },
    },
    events: [{ id: "e1", title: "Weekly call", startsAt: new Date("2026-10-30"), tierRank: 1 }],
  });
  assert.equal(recs[0].kind, "timing");
  assert.match(recs[0].title, /Mars/);
});

test("events and courses respect the member's tier; interests rank courses", () => {
  const recs = recommend({
    ...base,
    tierRank: 0,
    events: [{ id: "e1", title: "Weekly call", startsAt: new Date("2026-10-08"), tierRank: 1 }],
    courses: [
      { slug: "hd", title: "Reading Your Own Chart", tierRank: 0, percent: 0, interests: ["human-design"] },
      { slug: "kp", title: "KP Foundations", tierRank: 0, percent: 0, interests: ["kp-timing"] },
      { slug: "paid", title: "Paid", tierRank: 2, percent: 0, interests: ["kp-timing"] },
    ],
  });
  const course = recs.find((r) => r.kind === "course");
  assert.equal(course?.id, "course:kp");
  const event = recs.find((r) => r.kind === "event");
  assert.match(event?.title ?? "", /opens at Initiate/);
  assert.ok(recs.every((r) => r.reason.length > 0), "every recommendation states its reason");
});
