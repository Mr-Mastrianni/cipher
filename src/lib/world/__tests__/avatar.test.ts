/** The avatar contract shared by the world and the 2D profile. */

import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_AVATAR, sanitizeAvatar } from "../avatar-shared";

test("a valid avatar survives sanitising", () => {
  assert.deepEqual(
    sanitizeAvatar({ name: "Aster", color: "#5CE1E6", form: "orb", crest: "\u263d" }),
    { name: "Aster", color: "#5ce1e6", form: "orb", crest: "\u263d" },
  );
});

test("an unknown silhouette and colour fall back instead of being trusted", () => {
  const clean = sanitizeAvatar({
    name: "  Aster  ",
    color: "red",
    form: "dragon",
    crest: "",
  });
  assert.equal(clean.name, "Aster");
  assert.equal(clean.color, DEFAULT_AVATAR.color);
  assert.equal(clean.form, DEFAULT_AVATAR.form);
  assert.equal(clean.crest, DEFAULT_AVATAR.crest);
});

test("names and crests are bounded", () => {
  const clean = sanitizeAvatar({ name: "x".repeat(80), crest: "y".repeat(20) });
  assert.equal(clean.name.length, 32);
  assert.equal(clean.crest.length, 4);
});
