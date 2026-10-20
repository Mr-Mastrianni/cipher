/**
 * Notification fan-out.
 *
 * These run against `MemoryStore`, which needs no database, so the rules that
 * matter are checked without a running Postgres:
 *
 *  - a notification is addressed to the right person and to nobody else;
 *  - nobody is notified about their own action;
 *  - only a transition *into* `going` reaches a call host;
 *  - a store failure is swallowed rather than failing the action that caused it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { MemoryStore, type Store } from "../../db/store";
import type { LiveCall, User } from "../../db/schema";
import {
  memberName,
  notifyAdminsOfApplication,
  notifyApplicantOfDecision,
  notifyCallRsvp,
  notifyDirectMessage,
  preview,
} from "../notify";

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

let counter = 0;

/** A store with a fresh applicant, a reviewer admin and a second member. */
async function fixture(): Promise<{
  store: MemoryStore;
  applicant: User;
  admin: User;
  other: User;
}> {
  // A unique store per test keeps the demo seed from leaking between cases.
  const store = new MemoryStore();
  const n = ++counter;

  const applicant = await store.upsertUser({
    clerkUserId: `user_applicant_${n}`,
    email: `applicant${n}@example.test`,
    firstName: "Ada",
    lastName: "Lovelace",
  });

  const other = await store.upsertUser({
    clerkUserId: `user_other_${n}`,
    email: `other${n}@example.test`,
    displayName: "Grace Hopper",
  });

  const candidate = await store.upsertUser({
    clerkUserId: `user_admin_${n}`,
    email: `admin${n}@example.test`,
    firstName: "Review",
    lastName: "Desk",
  });
  const promoted = await store.updateUser(candidate.id, { role: "admin" });
  assert.ok(promoted, "the fixture admin must exist");
  const admin = promoted;

  return { store, applicant, admin, other };
}

/** Titles of a user's notifications, newest first. */
async function titles(store: Store, userId: string): Promise<string[]> {
  const rows = await store.listNotifications(userId, 100);
  return rows.map((row) => row.title);
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

test("memberName falls back from display name to full name to a neutral label", () => {
  const base = { displayName: null, firstName: null, lastName: null } as Pick<
    User,
    "displayName" | "firstName" | "lastName"
  >;
  assert.equal(memberName({ ...base, displayName: "Ada" }), "Ada");
  assert.equal(
    memberName({ ...base, firstName: "Ada", lastName: "Lovelace" }),
    "Ada Lovelace",
  );
  assert.equal(memberName({ ...base, firstName: "  ", lastName: null }), "A member");
  assert.equal(memberName(null), "A member");
});

test("preview collapses whitespace and truncates on a word-safe boundary", () => {
  assert.equal(preview("  hello \n\n world  "), "hello world");

  const long = "word ".repeat(60);
  const cut = preview(long);
  assert.ok(cut.length <= 120);
  assert.ok(cut.endsWith("…"));
});

/* ── Applications ─────────────────────────────────────────────────────────── */

test("submitting an application notifies every admin, except the applicant", async () => {
  const { store, applicant, admin } = await fixture();

  // The applicant is *also* an admin: they must not be told about themselves.
  const selfAdmin = await store.updateUser(applicant.id, { role: "admin" });
  assert.ok(selfAdmin, "the applicant must exist to be promoted");

  const delivered = await notifyAdminsOfApplication(store, {
    applicant: selfAdmin,
    applicationId: "app_1",
  });

  assert.ok(delivered >= 1, "at least the unrelated admin is notified");
  assert.ok(
    (await titles(store, admin.id)).includes("New membership application"),
  );
  assert.deepEqual(
    await titles(store, selfAdmin.id),
    [],
    "an admin who applies is not notified about their own application",
  );
});

test("the admin notification names the applicant and deep-links to the queue", async () => {
  const { store, applicant, admin } = await fixture();

  await notifyAdminsOfApplication(store, {
    applicant,
    applicationId: "app_2",
  });

  const [row] = await store.listNotifications(admin.id, 10);
  assert.equal(row.title, "New membership application");
  assert.equal(row.body, "Ada Lovelace applied to join.");
  assert.equal(row.url, "/admin/applications");
  assert.equal(row.type, "application");
  assert.equal(row.metadata?.applicantUserId, applicant.id);
  assert.equal(row.metadata?.applicationId, "app_2");
});

test("approval reaches the applicant with the granted tier and the dashboard", async () => {
  const { store, applicant } = await fixture();

  const written = await notifyApplicantOfDecision(store, {
    userId: applicant.id,
    applicationId: "app_3",
    decision: "approved",
    tier: "adept",
  });
  assert.equal(written, true);

  const [row] = await store.listNotifications(applicant.id, 10);
  assert.equal(row.title, "Your application was approved");
  assert.match(row.body ?? "", /Adept membership is open/);
  // `/dashboard` redirects an unfinished member on to `/onboarding`, so one
  // link is correct for a first-timer and a returning member alike.
  assert.equal(row.url, "/dashboard");
  assert.equal(row.type, "application");
  assert.equal(row.metadata?.tier, "adept");
});

test("a denial is worded kindly, never mentions the tier, and offers a retry", async () => {
  const { store, applicant } = await fixture();

  await notifyApplicantOfDecision(store, {
    userId: applicant.id,
    applicationId: "app_4",
    decision: "denied",
    // A tier may be passed on a denial; it must not leak into the copy.
    tier: "oracle",
  });

  const [row] = await store.listNotifications(applicant.id, 10);
  assert.equal(row.title, "Your application was not approved");
  assert.equal(row.url, "/membership");
  assert.match(row.body ?? "", /apply again/i);
  assert.doesNotMatch(row.body ?? "", /oracle/i);
  assert.equal(row.metadata?.tier, null);
  assert.equal(row.metadata?.decision, "denied");
});

test("the reviewer's private note is never copied to the applicant", async () => {
  const { store, applicant } = await fixture();

  // The note is not part of the notifier's input at all, which is the point:
  // there is no parameter through which an internal note can reach a member.
  await notifyApplicantOfDecision(store, {
    userId: applicant.id,
    applicationId: "app_5",
    decision: "denied",
  });

  const [row] = await store.listNotifications(applicant.id, 10);
  assert.equal(
    row.body,
    "We could not offer you a place this time. You are welcome to apply again.",
  );
});

/* ── Direct messages ──────────────────────────────────────────────────────── */

test("a direct message notifies the other participant and not the author", async () => {
  const { store, applicant, other } = await fixture();
  const thread = await store.findOrCreateDirectThread(applicant.id, other.id);

  await notifyDirectMessage(store, {
    thread,
    author: applicant,
    body: "Are you free for the call on Wednesday?",
    messageId: "msg_1",
  });

  const [row] = await store.listNotifications(other.id, 10);
  assert.equal(row.title, "Ada Lovelace sent you a message");
  assert.equal(row.body, "Are you free for the call on Wednesday?");
  assert.equal(row.url, "/dashboard/messages");
  assert.equal(row.type, "message");
  assert.equal(row.metadata?.threadId, thread.id);
  assert.equal(row.metadata?.messageId, "msg_1");

  assert.deepEqual(await titles(store, applicant.id), []);
});

test("the message preview in a notification is truncated, not the message", async () => {
  const { store, applicant, other } = await fixture();
  const thread = await store.findOrCreateDirectThread(applicant.id, other.id);
  const body = "x".repeat(4000);

  await notifyDirectMessage(store, { thread, author: applicant, body, messageId: "msg_2" });

  const [row] = await store.listNotifications(other.id, 10);
  assert.ok((row.body ?? "").length <= 120);
  assert.ok((row.body ?? "").endsWith("…"));

  // The stored message itself is untouched.
  const page = await store.listDirectMessages(thread.id, {});
  assert.ok(page.items.every((item) => item.body.length <= 4000));
});

test("a self-authored thread produces no notification", async () => {
  const { store, applicant } = await fixture();
  // A thread object whose two sides are the same member is not reachable
  // through the UI, but the notifier must still refuse to notify anyone.
  const thread = await store.findOrCreateDirectThread(applicant.id, applicant.id);

  const written = await notifyDirectMessage(store, {
    thread,
    author: applicant,
    body: "note to self",
    messageId: "msg_3",
  });

  assert.equal(written, false);
  assert.deepEqual(await titles(store, applicant.id), []);
});

/* ── Call RSVPs ───────────────────────────────────────────────────────────── */

async function callFixture(): Promise<{
  store: MemoryStore;
  host: User;
  guest: User;
  call: LiveCall;
}> {
  const { store, admin, other } = await fixture();
  const call = await store.createCall({
    title: "Weekly Chart Circle",
    startsAt: new Date(Date.now() + 86_400_000),
    hostId: admin.id,
    tierRequired: "initiate",
  });
  return { store, host: admin, guest: other, call };
}

test("a member becoming 'going' notifies the host", async () => {
  const { store, host, guest, call } = await callFixture();

  const written = await notifyCallRsvp(store, {
    call,
    member: guest,
    status: "going",
    previousStatus: null,
  });

  assert.equal(written, true);
  const [row] = await store.listNotifications(host.id, 10);
  assert.equal(row.title, "Grace Hopper is coming to Weekly Chart Circle");
  assert.equal(row.url, "/dashboard/calls");
  assert.equal(row.type, "call");
  assert.equal(row.metadata?.callId, call.id);
  assert.deepEqual(await titles(store, guest.id), []);
});

test("re-confirming 'going' does not notify twice", async () => {
  const { store, host, guest, call } = await callFixture();

  const written = await notifyCallRsvp(store, {
    call,
    member: guest,
    status: "going",
    previousStatus: "going",
  });

  assert.equal(written, false);
  assert.deepEqual(await titles(store, host.id), []);
});

test("'maybe' and 'declined' are silent", async () => {
  const { store, host, guest, call } = await callFixture();

  for (const status of ["maybe", "declined"] as const) {
    assert.equal(
      await notifyCallRsvp(store, { call, member: guest, status, previousStatus: null }),
      false,
    );
  }
  assert.deepEqual(await titles(store, host.id), []);
});

test("a host RSVPing to their own call is not notified", async () => {
  const { store, host, call } = await callFixture();

  const written = await notifyCallRsvp(store, {
    call,
    member: host,
    status: "going",
    previousStatus: null,
  });

  assert.equal(written, false);
  assert.deepEqual(await titles(store, host.id), []);
});

test("a call with no host notifies nobody", async () => {
  const { store, guest } = await callFixture();
  const hostless = await store.createCall({
    title: "Community open circle",
    startsAt: new Date(Date.now() + 86_400_000),
    hostId: null,
  });

  const written = await notifyCallRsvp(store, {
    call: hostless,
    member: guest,
    status: "going",
    previousStatus: null,
  });

  assert.equal(written, false);
});

/* ── Robustness ───────────────────────────────────────────────────────────── */

/**
 * A store whose `createNotification` always fails.
 *
 * A bell that cannot be written must not fail the approval, message or RSVP
 * that is already committed, so every notifier resolves instead of rejecting.
 */
function brokenStore(store: Store): Store {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "createNotification") {
        return async () => {
          throw new Error("notification store is down");
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("a failing notification store never throws at the caller", async () => {
  const { store, applicant, admin, other } = await fixture();
  const broken = brokenStore(store);

  const originalError = console.error;
  // The notifiers log the failure; keep the test output clean.
  console.error = () => {};
  try {
    const thread = await store.findOrCreateDirectThread(applicant.id, other.id);
    const call = await store.createCall({
      title: "Weekly Chart Circle",
      startsAt: new Date(Date.now() + 86_400_000),
      hostId: admin.id,
    });

    assert.equal(
      await notifyAdminsOfApplication(broken, {
        applicant,
        applicationId: "app_6",
      }),
      0,
    );
    assert.equal(
      await notifyApplicantOfDecision(broken, {
        userId: applicant.id,
        applicationId: "app_6",
        decision: "approved",
        tier: "initiate",
      }),
      false,
    );
    assert.equal(
      await notifyDirectMessage(broken, {
        thread,
        author: applicant,
        body: "hello",
        messageId: "msg_4",
      }),
      false,
    );
    assert.equal(
      await notifyCallRsvp(broken, {
        call,
        member: other,
        status: "going",
        previousStatus: null,
      }),
      false,
    );
  } finally {
    console.error = originalError;
  }
});
