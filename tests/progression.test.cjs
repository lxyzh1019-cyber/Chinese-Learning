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

test("M-T03 / T03: a new user's mini-quiz does not bypass the read chain", () => {
  const a = app();
  // Finishing one story mini-quiz writes storiesCompleted with no dwell check.
  const p = F.newUserAfterMiniQuiz(a);
  p.legacyStoriesCompleted = [];        // a new player has no pre-feature credit
  F.installState(a, { jenn: p });
  const u = a.gameUnlockForDid(1);
  assert.equal(u.trace, false, "Trace needs a read plus a flashcard pass");
  assert.equal(u.match, false, "Match needs a second qualifying read");
  assert.equal(u.rain, false, "Rain needs a second read plus a Listen round");
});

test("T03: an existing child keeps the access they already had", () => {
  const a = app();
  const p = F.newUserAfterMiniQuiz(a, "xia");
  delete p.legacyStoriesCompleted;      // pre-migration save
  F.installState(a, { jenn: p });       // ensureState takes the snapshot
  assert.deepEqual(a.state.jenn.legacyStoriesCompleted, ["xia"],
    "stories finished before the gate shipped are grandfathered");
  const u = a.gameUnlockForDid(1);
  assert.equal(u.rain, true, "previously reachable games stay reachable");
});

test("T03: the snapshot is taken once and does not grow", () => {
  const a = app();
  const p = F.newUserAfterMiniQuiz(a, "xia");
  delete p.legacyStoriesCompleted;
  F.installState(a, { jenn: p });
  // A story finished today must not join the legacy list.
  a.state.jenn.storiesCompleted.push("shang");
  a.ensureState("jenn");
  assert.deepEqual(a.state.jenn.legacyStoriesCompleted, ["xia"],
    "re-running ensureState does not re-snapshot");
  assert.equal(a.gameUnlockForDid(2).rain, false, "the new story earns no bypass");
});

test("T04: uniqueChars does not give every character its whole word's reading", () => {
  const a = app();
  const chars = a.uniqueChars([{ zh: "学习", py: "xué xí", en: "to study; to learn" }]);
  const xi = chars.find((c) => c.zh === "习");
  assert.notEqual(xi.py, "xué xí", "习 does not read 'xué xí'");
  assert.notEqual(xi.en, "to study; to learn", "习 alone does not mean 'to study'");
  const xue = chars.find((c) => c.zh === "学");
  assert.notEqual(xue.py, "xué xí", "学 does not read 'xué xí' either");
});

test("T04: a single-character word keeps its own reading", () => {
  const a = app();
  const [c] = a.uniqueChars([{ zh: "水", py: "shuǐ", en: "water" }]);
  assert.equal(c.py, "shuǐ");
  assert.equal(c.en, "water");
});

test("T04: an unknown character shows its source word, not an invented gloss", () => {
  const a = app();
  const chars = a.uniqueChars([{ zh: "鎏金", py: "liú jīn", en: "gilded" }]);
  const rare = chars.find((c) => c.zh === "鎏");
  assert.ok(rare, "the character is still offered for tracing");
  assert.notEqual(rare.en, "gilded", "the word's meaning is not pinned on one character");
  assert.match(rare.en, /in 鎏金/, "it names the word the character came from");
});

test("M-T11 / B02d: champion quizzes generate their requested item counts", () => {
  const a = app();
  const vocab = Array.from({ length: 150 }, (_, i) => ({
    zh: `字${i}`, py: `zi${i}`, en: `word${i}`,
  }));
  assert.equal(a.buildMCQ(vocab, 32).length, 32, "champion asks for 32 MCQ");
  assert.equal(a.buildPYQ(vocab, 40).length, 40, "champion asks for 40 pinyin");
});

test("B02d: the pool is still a real limit when it is smaller than the request", () => {
  const a = app();
  const vocab = Array.from({ length: 9 }, (_, i) => ({ zh: `字${i}`, py: `zi${i}`, en: `w${i}` }));
  assert.equal(a.buildMCQ(vocab, 32).length, 9, "cannot invent items that do not exist");
  assert.equal(a.buildPYQ(vocab, 40).length, 9);
});

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

// ── B02a / B02b: Memory Match ──────────────────────────────────────────────

test("B02a: Match deals only as many pairs as the pool can supply", () => {
  const a = app();
  F.installState(a, { jenn: F.tinyWipPool(a, 3) });
  a.curGameTargetDid = 20;          // a late gate, which used to force 8 pairs
  const words = Object.values(a.state.jenn.failedWords);

  a.startMemoryMatch(words);

  assert.equal(a.matchSt.pairCount, 3, "the target matches the 3 words available");
  assert.equal(a.matchSt.cards.length, 6, "3 pairs dealt");
  // The round must be winnable: matching every dealt pair reaches the target.
  const dealtPairs = new Set(a.matchSt.cards.map((c) => c.pair)).size;
  assert.ok(dealtPairs >= a.matchSt.pairCount, "every pair needed is on the board");
});

test("B02a: a large pool still uses the gate's cap", () => {
  const a = app();
  F.installState(a);
  a.curGameTargetDid = 20;
  const words = Array.from({ length: 30 }, (_, i) => ({ zh: `字${i}`, py: `zi${i}`, en: `w${i}` }));
  a.startMemoryMatch(words);
  assert.equal(a.matchSt.pairCount, 8, "capped at 8 for gates 15+");

  a.curGameTargetDid = 3;
  a.startMemoryMatch(words);
  assert.equal(a.matchSt.pairCount, 6, "capped at 6 for early gates");
});

test("B02a: an old save with an impossible pair target resumes finishable", () => {
  const a = app();
  F.installState(a);
  a.curP = "jenn";
  // A session persisted before the fix: 3 pairs dealt, target of 6.
  a.state.jenn.pendingSessions.match = {
    cards: [0, 1, 2].flatMap((i) => [
      { id: `a${i}`, pair: i, side: "zh", text: `字${i}`, w: {}, matched: false },
      { id: `b${i}`, pair: i, side: "en", text: `w${i}`, w: {}, matched: false },
    ]),
    openIdxs: [], matched: 0, moves: 4, start: Date.now(), pairCount: 6, gameTargetDid: 1,
  };
  assert.equal(a.restoreMatch(), true);
  assert.equal(a.matchSt.pairCount, 3, "target clamped to the board actually dealt");
});

test("B02b: a mismatched flip does not create a vocabulary failure", () => {
  const a = app();
  F.installState(a);
  const words = [
    { zh: "水", py: "shuǐ", en: "water" },
    { zh: "山", py: "shān", en: "mountain" },
  ];
  a.startMemoryMatch(words);
  // Flip two cards belonging to different pairs.
  const i1 = a.matchSt.cards.findIndex((c) => c.pair === 0);
  const i2 = a.matchSt.cards.findIndex((c) => c.pair === 1);
  a.tapMatch(i1);
  a.tapMatch(i2);

  assert.equal(a.matchSt.moves, 1, "the move still counts");
  assert.deepEqual(Object.keys(a.state.jenn.failedWords), [],
    "a memory slip is not logged as a word the child does not know");
});

// ── B02e: story reading progress ───────────────────────────────────────────

/** Count unique non-bonus study characters in a story, the way the reader does. */
function studyChars(app, story, known = {}) {
  const set = new Set();
  story.sents.forEach((sent) => sent.forEach((t) => {
    if (t.t === "c" && !t.bonus && !known[t.ch]) set.add(t.ch);
  }));
  return set;
}

test("M-T04 / B02e: exploring every study character reaches 100%, not 79%", () => {
  const a = app();
  F.installState(a);
  const story = a.STORIES_MAP.xia;
  const uniq = studyChars(a, story);

  // Reproduce the reader's counters: the denominator must be the unique set.
  a.newChars = new Set(uniq);
  a.tapped = new Set(uniq);
  a.updateProg();

  const label = a.document.getElementById("prog-lbl").textContent;
  assert.equal(label, "100%", `first story should finish at 100%, got ${label}`);
});

test("B02e: a story with a repeated character does not inflate the denominator", () => {
  const a = app();
  F.installState(a);
  // 三 appears twice in the first story; unique count is what matters.
  a.newChars = new Set(["水", "山", "人"]);
  a.tapped = new Set(["水", "山"]);
  a.updateProg();
  assert.equal(a.document.getElementById("prog-lbl").textContent, "67%",
    "2 of 3 unique characters");
});

test("B02e: an already-known story can still be finished on a re-read", () => {
  const a = app();
  F.installState(a);
  // Every character known => no study characters remain to tap.
  a.newChars = new Set();
  a.tapped = new Set();
  a.updateProg();
  a.checkUnlock();

  assert.equal(a.document.getElementById("prog-lbl").textContent, "100%");
  assert.equal(a.document.getElementById("unlock-btn").disabled, false,
    "the finish button must be reachable on a re-read");
});

// ── G04: gate completion and reward ────────────────────────────────────────

/** Put a player one requirement away from clearing a gate. */
function almostCleared(a, { quiz = true, games = true, did = 1, points = 180 } = {}) {
  F.installState(a);
  const s = a.state.jenn;
  const k = String(did);
  s.gateGameStars = { [k]: games
    ? { trace: 3, match: 3, rain: 3, listen: 3 }
    : { trace: 3, match: 3, rain: 3, listen: 0 } };
  if (quiz) s.gateBestQuiz = { [k]: { accPct: 95, quizStars: 3, points } };
  return s;
}

test("M-T06 / G04: the gate pays the same whichever requirement lands last", () => {
  // Quiz already passed; the last GAME completes the gate.
  const a1 = app();
  almostCleared(a1, { quiz: true, games: false, points: 180 });
  a1.curGameTargetDid = 1;
  a1.updateGateGameBest(1, "listen", 3);
  const viaGame = a1.state.jenn;

  // Games already done; the QUIZ completes the gate.
  const a2 = app();
  const s2 = almostCleared(a2, { quiz: false, games: true });
  s2.gateBestQuiz = {};
  a2.updateBestQuizRecord(s2, false, 1, null, 95, 3, 180);
  a2.evaluateGateCompletion(1);
  const viaQuiz = a2.state.jenn;

  assert.deepEqual(viaGame.gatesCompleted, [1], "cleared via the last game");
  assert.deepEqual(viaQuiz.gatesCompleted, [1], "cleared via the quiz");
  assert.equal(viaGame.totalStars, viaQuiz.totalStars,
    "the same achievement pays the same amount either way");
  assert.equal(viaGame.totalStars, 180, "and it pays the qualifying quiz's points");
  assert.equal(a1.getTS("jenn").gates, a2.getTS("jenn").gates, "unique gate count matches");
});

test("G04: replaying the boss on a cleared gate pays nothing", () => {
  const a = app();
  almostCleared(a, { quiz: true, games: true, points: 180 });
  const first = a.evaluateGateCompletion(1);
  assert.equal(first.justCleared, true);
  const afterFirst = a.state.jenn.totalStars;
  const gatesAfterFirst = a.getTS("jenn").gates;

  // Three more passing replays.
  for (let i = 0; i < 3; i++) {
    const again = a.evaluateGateCompletion(1);
    assert.equal(again.justCleared, false, "already cleared");
  }

  assert.equal(a.state.jenn.totalStars, afterFirst, "no further payout");
  assert.equal(a.getTS("jenn").gates, gatesAfterFirst, "unique gate count does not inflate");
  assert.deepEqual(a.state.jenn.gatesCompleted, [1], "and it is not listed twice");
});

test("G04: a gate with an unfinished requirement does not clear or pay", () => {
  const a = app();
  almostCleared(a, { quiz: true, games: false, points: 180 });
  const r = a.evaluateGateCompletion(1);
  assert.equal(r.cleared, false);
  assert.equal(r.justCleared, false);
  assert.deepEqual(a.state.jenn.gatesCompleted, []);
  assert.equal(a.state.jenn.totalStars, 0, "nothing paid");
});

test("G04: the best quiz record comes from one attempt, not merged fields", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  // A high-accuracy, low-scoring run, then a low-accuracy, high-scoring one.
  a.updateBestQuizRecord(s, false, 1, null, 95, 3, 120);
  a.updateBestQuizRecord(s, false, 1, null, 60, 1, 400);
  const best = s.gateBestQuiz["1"];
  assert.equal(best.accPct, 95, "accuracy decides");
  assert.equal(best.points, 120, "and the points belong to that same attempt");
  assert.equal(best.quizStars, 3, "as do its stars — no field-by-field maximum");
});

// ── B02c: one answer, one score ────────────────────────────────────────────

test("M-T10 / B02c: a rapid double submit scores once and advances once", () => {
  const a = app();
  F.installState(a);
  const vocab = Array.from({ length: 12 }, (_, i) => ({ zh: `字${i}`, py: `zi${i}`, en: `w${i}` }));
  a.quizSt = {
    did: 1, phase: 1, score: 0, phaseScores: [0, 0, 0], vocab,
    questions: [], pyQ: a.buildPYQ(vocab, 5), sbPack: [], sbRound: 0,
    isChampion: false, mcqN: 0, pyN: 5, sbN: 0, maxScore: 100,
    quizCorrect: 0, quizAttempts: 0,
  };
  a.releaseAnswerLock();
  const q = a.quizSt.pyQ[0];
  a.document.getElementById("py-in").value = q.correct;

  a.checkPY();
  const afterFirst = { score: a.quizSt.score, attempts: a.quizSt.quizAttempts };
  a.checkPY();   // the second tap, before the advance timer fires
  a.checkPY();

  assert.equal(a.quizSt.score, afterFirst.score, "the score moved exactly once");
  assert.equal(a.quizSt.quizAttempts, afterFirst.attempts, "one attempt recorded");
  assert.equal(a.quizSt.quizAttempts, 1);
});

test("B02c: the lock clears so the next question can be answered", () => {
  const a = app();
  F.installState(a);
  const vocab = Array.from({ length: 12 }, (_, i) => ({ zh: `字${i}`, py: `zi${i}`, en: `w${i}` }));
  a.quizSt = {
    did: 1, phase: 1, score: 0, phaseScores: [0, 0, 0], vocab,
    questions: [], pyQ: a.buildPYQ(vocab, 5), sbPack: [], sbRound: 0,
    isChampion: false, mcqN: 0, pyN: 5, sbN: 0, maxScore: 100,
    quizCorrect: 0, quizAttempts: 0,
  };
  a.releaseAnswerLock();
  a.document.getElementById("py-in").value = a.quizSt.pyQ[0].correct;
  a.checkPY();
  assert.equal(a.quizSt.quizAttempts, 1);

  a.releaseAnswerLock();          // what goNext does when the next item renders
  a.checkPY();
  assert.equal(a.quizSt.quizAttempts, 2, "the following answer is accepted");
});

test("B02c: leaving a quiz releases the lock", () => {
  const a = app();
  F.installState(a);
  a.quizSt = { did: 1, phase: 0, score: 0, phaseScores: [0, 0, 0], vocab: [],
    questions: [], pyQ: [], sbPack: [], sbRound: 0, quizCorrect: 0, quizAttempts: 0 };
  assert.equal(a.lockAnswer(), true, "lock taken");
  assert.equal(a.lockAnswer(), false, "and held");
  a.exitQuiz();
  assert.equal(a.lockAnswer(), true, "exiting a quiz did not strand the lock");
});

// ── B02f: resume the most recent activity, and never discard a round ───────

test("M-T? / B02f: resume returns the most recently touched activity", () => {
  const a = app();
  F.installState(a);
  const ps = a.state.jenn.pendingSessions;
  // Match sits highest in the old fixed priority chain; the child was last in
  // a Listen round.
  ps.match = { cards: [], openIdxs: [], matched: 0, moves: 2, start: 1, pairCount: 3, updatedAt: 1000 };
  ps.listen = { questions: [], qi: 3, streak: 0, score: 0, updatedAt: 9000 };
  ps.trace = { chars: [], i: 1, traceGood: 0, updatedAt: 5000 };

  const recent = a.mostRecentSession();
  assert.equal(recent.kind, "listen", "the newest session wins, not the highest-priority one");
  assert.equal(recent.at, 9000);
});

test("B02f: sessions without timestamps fall back to the old order", () => {
  const a = app();
  F.installState(a);
  const ps = a.state.jenn.pendingSessions;
  ps.match = { cards: [], matched: 0, moves: 1, pairCount: 3 };   // pre-timestamp save
  const recent = a.mostRecentSession();
  assert.equal(recent.at, 0, "no timestamp recorded");
  // resumeLastSession only trusts mostRecentSession when at > 0.
});

test("B02f: closing a part-finished Revenge round saves it instead of deleting it", () => {
  const a = app();
  F.installState(a);
  a.revengeSt = {
    words: Array.from({ length: 6 }, (_, i) => ({ zh: `字${i}`, py: `p${i}`, correct: `w${i}`, opts: ["a", "b"] })),
    qi: 3, correct: 2,
  };
  a.closeRevengeRound();

  const saved = a.state.jenn.pendingSessions.revenge;
  assert.ok(saved, "the round survives being closed");
  assert.equal(saved.qi, 3, "at the question the child had reached");
  assert.equal(saved.correct, 2);
  assert.equal(saved.words.length, 6);
  assert.ok(saved.updatedAt > 0, "and it is timestamped for resume");
});

test("B02f: closing a finished Revenge round clears it", () => {
  const a = app();
  F.installState(a);
  a.revengeSt = { words: [{ zh: "字", py: "p", correct: "w", opts: [] }], qi: 1, correct: 1 };
  a.closeRevengeRound();
  assert.equal(a.state.jenn.pendingSessions.revenge, null, "nothing left to resume");
});
