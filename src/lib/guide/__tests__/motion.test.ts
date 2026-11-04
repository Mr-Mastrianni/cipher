import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  boxFor,
  clampBox,
  dock,
  earthWindow,
  facing,
  isVisible,
  placeBeside,
  scrollToShow,
  springStep,
  viewportFor,
} from "../motion";

const desktop = viewportFor(1280, 800);
const phone = viewportFor(390, 780);

describe("guide docking", () => {
  it("rests in the bottom-right corner, inside the margin", () => {
    const box = boxFor(1280);
    const spot = dock(box, desktop);
    assert.equal(spot.x + box.w, 1280 - desktop.margin);
    assert.equal(spot.y + box.h, 800 - desktop.margin);
  });

  it("is smaller on a phone", () => {
    assert.ok(boxFor(390).w < boxFor(1280).w);
  });

  it("never leaves the screen or hides under the header", () => {
    const box = boxFor(1280);
    const high = clampBox(-500, -500, box, desktop);
    assert.equal(high.x, desktop.margin);
    assert.equal(high.y, desktop.top);
    const far = clampBox(5000, 5000, box, desktop);
    assert.equal(far.x + box.w, 1280 - desktop.margin);
    assert.equal(far.y + box.h, 800 - desktop.margin);
  });
});

describe("standing beside a target", () => {
  const box = boxFor(1280);

  it("prefers the right of a target with room", () => {
    const target = { left: 48, top: 400, right: 264, bottom: 460 };
    const spot = placeBeside(target, box, desktop);
    assert.equal(spot.side, "right");
    assert.ok(spot.x >= target.right, "does not cover the target");
  });

  it("moves to the left of a target near the right edge", () => {
    const target = { left: 1100, top: 300, right: 1260, bottom: 340 };
    const spot = placeBeside(target, box, desktop);
    assert.equal(spot.side, "left");
    assert.ok(spot.x + box.w <= target.left, "does not cover the target");
  });

  it("goes under a target that spans the width", () => {
    const target = { left: 12, top: 100, right: 1268, bottom: 160 };
    const spot = placeBeside(target, box, desktop);
    assert.equal(spot.side, "below");
    assert.ok(spot.y >= target.bottom);
  });

  it("always lands on screen, even when nothing fits", () => {
    const filling = { left: 0, top: 0, right: 1280, bottom: 800 };
    const spot = placeBeside(filling, box, desktop);
    assert.equal(spot.side, "over");
    assert.ok(spot.x >= desktop.margin && spot.x + box.w <= desktop.w - desktop.margin);
    assert.ok(spot.y >= desktop.top && spot.y + box.h <= desktop.h - desktop.margin);
  });

  it("stays below the header for a target just under it", () => {
    const target = { left: 600, top: 70, right: 760, bottom: 100 };
    const spot = placeBeside(target, boxFor(1280), desktop);
    assert.ok(spot.y >= desktop.top);
  });

  it("faces what she stands beside", () => {
    assert.equal(facing("left"), 1);
    assert.equal(facing("right"), -1);
    assert.equal(facing("below"), 0);
  });
});

describe("the Earth's place in the page", () => {
  it("is high and central on a phone", () => {
    const rect = earthWindow(phone);
    assert.ok((rect.left + rect.right) / 2 === phone.w / 2);
    assert.ok(rect.bottom < phone.h * 0.5);
  });

  it("is on the right of a wide screen", () => {
    const rect = earthWindow(desktop);
    assert.ok((rect.left + rect.right) / 2 > desktop.w / 2);
  });
});

describe("the spring", () => {
  const run = (from: number, to: number, seconds: number, fps = 60) => {
    let position = from;
    let velocity = 0;
    let peak = from;
    for (let i = 0; i < seconds * fps; i++) {
      [position, velocity] = springStep(position, velocity, to, 1 / fps);
      peak = Math.max(peak, position);
    }
    return { position, peak };
  };

  it("arrives", () => {
    const { position } = run(0, 600, 3);
    assert.ok(Math.abs(position - 600) < 0.5);
  });

  it("does not overshoot", () => {
    const { peak } = run(0, 600, 3);
    assert.ok(peak <= 600 + 1e-6);
  });

  it("lands in the same place at any frame rate", () => {
    const slow = run(0, 400, 3, 20).position;
    const fast = run(0, 400, 3, 144).position;
    assert.ok(Math.abs(slow - fast) < 0.5);
  });

  it("stays put when already there", () => {
    assert.deepEqual(springStep(250, 0, 250, 1 / 60), [250, 0]);
  });
});

describe("showing a target", () => {
  it("is visible only with size and on screen", () => {
    assert.ok(isVisible({ left: 0, top: 200, right: 100, bottom: 240 }, desktop));
    assert.ok(!isVisible({ left: 0, top: 0, right: 0, bottom: 0 }, desktop));
    assert.ok(!isVisible({ left: 0, top: 900, right: 100, bottom: 940 }, desktop));
  });

  it("does not scroll for a target already in the upper screen", () => {
    assert.equal(scrollToShow({ left: 0, top: 200, right: 100, bottom: 240 }, phone), 0);
  });

  it("scrolls a low target up toward the top quarter", () => {
    const amount = scrollToShow({ left: 0, top: 650, right: 100, bottom: 700 }, phone);
    assert.ok(amount > 0);
    assert.ok(650 - amount < phone.h * 0.3);
  });
});
