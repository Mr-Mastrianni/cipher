/**
 * Role resolution.
 *
 * These rules decide who can open the admin console, so they are pinned
 * rather than left to the integration tests: an allowlisted address must
 * promote an account that already exists, and an unverified address must
 * never claim one.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  roleForNewUser,
  roleFromClerkMetadata,
  shouldPromoteToAdmin,
  verifiedEmailFromUser,
  verifiedEmailFromWebhook,
} from "../roles";

const allowlist = new Set(["Owner@Example.com".toLowerCase()]);

test("metadata wins over everything, including the allowlist", () => {
  assert.equal(
    roleForNewUser({
      metadataRole: "member",
      verifiedEmail: "owner@example.com",
      allowlist,
    }),
    "member",
  );
  assert.equal(
    roleForNewUser({
      metadataRole: "admin",
      verifiedEmail: null,
      allowlist,
    }),
    "admin",
  );
});

test("only admin and member are accepted from metadata", () => {
  assert.equal(roleFromClerkMetadata({ role: "admin" }), "admin");
  assert.equal(roleFromClerkMetadata({ role: "member" }), "member");
  assert.equal(roleFromClerkMetadata({ role: "owner" }), null);
  assert.equal(roleFromClerkMetadata({ role: 1 }), null);
  assert.equal(roleFromClerkMetadata(null), null);
  assert.equal(roleFromClerkMetadata("admin"), null);
});

test("a verified allowlisted address creates an admin", () => {
  assert.equal(
    roleForNewUser({
      metadataRole: null,
      verifiedEmail: "owner@example.com",
      allowlist,
    }),
    "admin",
  );
});

test("an unlisted or unverified address creates a member", () => {
  assert.equal(
    roleForNewUser({
      metadataRole: null,
      verifiedEmail: "stranger@example.com",
      allowlist,
    }),
    "member",
  );
  assert.equal(
    roleForNewUser({ metadataRole: null, verifiedEmail: null, allowlist }),
    "member",
  );
});

test("an existing allowlisted account is promoted, not just a new one", () => {
  // The bug this pins: the allowlist used to apply only at first sight, so an
  // account created before the variable was set could never become admin.
  assert.equal(
    shouldPromoteToAdmin({
      metadataRole: null,
      verifiedEmail: "owner@example.com",
      allowlist,
      currentRole: "member",
    }),
    true,
  );
});

test("promotion leaves admins alone and never demotes", () => {
  assert.equal(
    shouldPromoteToAdmin({
      metadataRole: null,
      verifiedEmail: "owner@example.com",
      allowlist,
      currentRole: "admin",
    }),
    false,
  );
  assert.equal(
    shouldPromoteToAdmin({
      metadataRole: null,
      verifiedEmail: "someone@example.com",
      allowlist,
      currentRole: "admin",
    }),
    false,
  );
});

test("metadata blocks allowlist promotion", () => {
  // An explicit `member` in Clerk is a decision, not a default.
  assert.equal(
    shouldPromoteToAdmin({
      metadataRole: "member",
      verifiedEmail: "owner@example.com",
      allowlist,
      currentRole: "member",
    }),
    false,
  );
});

test("an unverified address cannot claim the allowlist", () => {
  assert.equal(
    verifiedEmailFromUser({
      primaryEmailAddress: {
        emailAddress: "owner@example.com",
        verification: { status: "unverified" },
      },
    }),
    null,
  );
  assert.equal(
    verifiedEmailFromUser({
      primaryEmailAddress: {
        emailAddress: "owner@example.com",
        verification: { status: "verified" },
      },
    }),
    "owner@example.com",
  );
});

test("the webhook payload normalises to the same lowercase address", () => {
  const payload = {
    primary_email_address_id: "idn_1",
    email_addresses: [
      { id: "idn_1", email_address: "Owner@Example.COM", verification: { status: "verified" } },
      { id: "idn_2", email_address: "other@example.com", verification: { status: "verified" } },
    ],
  };

  assert.equal(verifiedEmailFromWebhook(payload), "owner@example.com");

  assert.equal(
    verifiedEmailFromWebhook({
      ...payload,
      email_addresses: [
        { id: "idn_1", email_address: "owner@example.com", verification: { status: "unverified" } },
      ],
    }),
    null,
  );
});

test("a missing primary address is not a verified address", () => {
  assert.equal(verifiedEmailFromUser(null), null);
  assert.equal(verifiedEmailFromUser({}), null);
  assert.equal(verifiedEmailFromWebhook({ email_addresses: [] }), null);
});
