"use strict";

/**
 * Progression, scoring and gating regression tests.
 *
 * Two kinds of test live here:
 *
 *  1. PINNED — behaviour that is correct today. These guard against accidental
 *     regressions while the assessment (Phase A) is built.
 *
 *  2. DEFECT LEDGER — tests marked `{ todo: ... }` that assert the CORRECT
 *     post-fix behaviour for a confirmed defect. They run on every `npm test`
 *     and are expected to fail until Phase B repairs them; a todo failure does
 *     not fail the suite, and Node reports it loudly when one starts passing.
 *     Each carries the requirement ID from the implementation plan.
 *
 * All state is synthetic. `firebase` is undefined inside the loader, so no test
 * can reach the live `chinese-adventure` collection.
 */

const test = require("node:test");
const assert = require("node:assert");
const { loadApp } = require("./helpers/app-loader.js");
const F = require("./fixtures/players.js");

function app() {
  const a = loadApp();
  a.curP = "jenn";
  return a;
}

// ── PINNED: star thresholds (B01) ─────────────────────────────────────────
// The helper rounds accuracy to an integer, then compares >85 / >70 / >55.
// These boundaries are deliberate; do not "fix" them without an approved
// scoring change.

test("starsFromAccuracy holds its documented boundaries", () => {
  const a = app();
  assert.equal(a.starsFromAccuracy(86, 100), 3, "86% is 3 stars");
  assert.equal(a.starsFromAccuracy(85, 100), 2, "85% is NOT 3 stars (strict >)");
  assert.equal(a.starsFromAccuracy(71, 100), 2);
  assert.equal(a.starsFromAccuracy(70, 100), 1, "70% is NOT 2 stars (strict >)");
  assert.equal(a.starsFromAccuracy(56, 100), 1);
  assert.equal(a.starsFromAccuracy(55, 100), 0, "55% is NOT 1 star (strict >)");
});

test("starsFromAccuracy does not impose a minimum sample size", () => {
  const a = app();
  // A legitimately small pool that completes naturally must still be scorable.
  // The full-round rule is enforced at the call site, not in this helper.
  assert.equal(a.starsFromAccuracy(1, 1), 3);
  assert.equal(a.starsFromAccuracy(2, 3), 1);
});

// ── PINNED: gate deadline formula (G02) ───────────────────────────────────

test("gateTimerDays follows 5 + 2*floor((n-1)/5) per level", () => {
  const a = app();
  const expected = { 1: 5, 5: 5, 6: 7, 10: 7, 11: 9, 15: 9, 16: 11, 20: 11, 21: 13, 22: 13 };
  for (const [gate, days] of Object.entries(expected)) {
    assert.equal(a.gateTimerDays(Number(gate)), days, `gate ${gate} => +${days} days`);
  }
});

// ── PINNED: the legitimate unlock chain (T03) ─────────────────────────────

test("one qualifying read unlocks Listen only", () => {
  const a = app();
  F.installState(a, { jenn: F.oneQualifyingRead(a) });
  assert.deepEqual(a.gameUnlockForDid(1), {
    listen: true, trace: false, match: false, rain: false,
  });
});

test("two reads plus a cleared Listen round unlocks all four games", () => {
  const a = app();
  F.installState(a, { jenn: F.twoReadsPlusListen(a) });
  assert.deepEqual(a.gameUnlockForDid(1), {
    listen: true, trace: true, match: true, rain: true,
  });
});

// ── DEFECT LEDGER ─────────────────────────────────────────────────────────

test(
  "M-T03 / T03: a new user's mini-quiz must not bypass the read chain",
  { todo: "Phase B — gameUnlockForDid:3686 treats new storiesCompleted entries as legacy credit" },
  () => {
    const a = app();
    // Finishing one story mini-quiz writes storiesCompleted (index.html:5323)
    // with no dwell check, which short-circuits the whole chain.
    F.installState(a, { jenn: F.newUserAfterMiniQuiz(a) });
    const u = a.gameUnlockForDid(1);
    assert.equal(u.trace, false, "Trace needs a read plus a flashcard pass");
    assert.equal(u.match, false, "Match needs a second qualifying read");
    assert.equal(u.rain, false, "Rain needs a second read plus a Listen round");
  }
);

test(
  "T04: uniqueChars must not give every character its whole word's reading",
  { todo: "Phase B — uniqueChars:4084 copies w.py/w.en onto each character" },
  () => {
    const a = app();
    const chars = a.uniqueChars([{ zh: "学习", py: "xué xí", en: "to study; to learn" }]);
    const xi = chars.find((c) => c.zh === "习");
    assert.notEqual(xi.py, "xué xí", "习 does not read 'xué xí'");
    assert.notEqual(xi.en, "to study; to learn", "习 alone does not mean 'to study'");
  }
);

test(
  "M-T11 / B02d: champion quizzes must generate their requested item counts",
  { todo: "Phase B — buildMCQ:5775 and buildPYQ:5803 both cap at Math.min(n,20,...)" },
  () => {
    const a = app();
    const vocab = Array.from({ length: 150 }, (_, i) => ({
      zh: `字${i}`, py: `zi${i}`, en: `word${i}`,
    }));
    assert.equal(a.buildMCQ(vocab, 32).length, 32, "champion asks for 32 MCQ");
    assert.equal(a.buildPYQ(vocab, 40).length, 40, "champion asks for 40 pinyin");
  }
);

/** Record every Firestore document write the app performs. */
function captureWrites(a) {
  const writes = [];
  a.db = {
    collection: () => ({
      doc: (pid) => ({
        set: (payload) => { writes.push({ pid, payload }); return Promise.resolve(); },
      }),
    }),
  };
  return writes;
}

test("M-T16 / S01: saving one child must not write or re-stamp the other", () => {
    const a = app();
    const jess = a.defPlayer();
    jess.lastSaved = 1000;
    jess.totalStars = 42;
    F.installState(a, { jenn: a.defPlayer(), jess });
    a.curP = "jenn";

    const writes = captureWrites(a);

    a.saveState();

    assert.deepEqual(writes.map((w) => w.pid), ["jenn"], "only the active player is written");
    assert.equal(a.state.jess.lastSaved, 1000, "the inactive player's timestamp is untouched");
});

test("S01: parent star edits persist for a child who is not the active player", () => {
  // The parent panel is normally opened from the select screen, where curP is
  // null. A naive curP-scoped save would drop these writes entirely and the
  // stars would vanish on reload — a worse bug than the one S01 fixes.
  const a = app();
  F.installState(a);
  a.curP = null;
  const writes = captureWrites(a);
  a.document.getElementById("parent-jess-star-amt").value = "7";

  a.parentAdjustStars("jess", 1);

  assert.deepEqual(writes.map((w) => w.pid), ["jess"], "Jess is written, Jenn is not");
  assert.equal(a.state.jess.totalStars, 7, "the stars actually landed");
  assert.ok(a.state.jess.lastSaved > 0, "Jess is stamped");
  assert.equal(a.state.jenn.lastSaved, 0, "Jenn is left alone");
});

test("S01: clearing all progress writes both players", () => {
  const a = app();
  F.installState(a);
  const writes = captureWrites(a);
  a.savePlayer("jenn");
  a.savePlayer("jess");
  assert.deepEqual(writes.map((w) => w.pid).sort(), ["jenn", "jess"]);
});

test("S01: saving with no active player is a no-op, not a crash", () => {
  const a = app();
  F.installState(a);
  a.curP = null;
  const writes = captureWrites(a);
  a.saveState();
  assert.deepEqual(writes, [], "nothing is written when no player is selected");
});
