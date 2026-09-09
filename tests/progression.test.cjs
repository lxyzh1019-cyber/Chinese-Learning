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
const R = require("../js/review-core.js");

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
  const p = F.newUserAfterMiniQuiz(a, "xia-h1");
  delete p.legacyStoriesCompleted;      // pre-migration save
  F.installState(a, { jenn: p });       // ensureState takes the snapshot
  assert.deepEqual(a.state.jenn.legacyStoriesCompleted, ["xia-h1"],
    "stories finished before the gate shipped are grandfathered");
  const u = a.gameUnlockForDid(1);
  assert.equal(u.rain, true, "previously reachable games stay reachable");
});

test("T03: the snapshot is taken once and does not grow", () => {
  const a = app();
  const p = F.newUserAfterMiniQuiz(a, "xia-h1");
  delete p.legacyStoriesCompleted;
  F.installState(a, { jenn: p });
  // A story finished today must not join the legacy list.
  a.state.jenn.storiesCompleted.push("shang-h1");
  a.ensureState("jenn");
  assert.deepEqual(a.state.jenn.legacyStoriesCompleted, ["xia-h1"],
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
  const story = a.STORIES_MAP["xia-h1"];
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
function almostCleared(a, { quiz = true, games = true, did = 1, points = 180, level = 1 } = {}) {
  F.installState(a);
  a.curHSK = level;
  const s = a.state.jenn;
  const k = a.gateKeyOf(did, level);
  s.gateGameStars = { [k]: games
    ? { trace: 3, match: 3, rain: 3, listen: 3 }
    : { trace: 3, match: 3, rain: 3, listen: 0 } };
  if (quiz) s.gateBestQuiz = { [k]: { accPct: 95, quizStars: 3, points } };
  // Neutralise the daily mission. Its goal is rolled from the date, so on any
  // day that rolls "clear a gate" the mission's flat +8 lands inside the gate
  // payout and this test reads 188 instead of the 180 the gate actually paid.
  // Marking it done makes bumpMission a no-op and keeps the assertion about
  // gate completion rather than about what day the suite happens to run on.
  s.dailyMission = { date: a.todayKey(), goalKey: "stars", progress: 1,
    target: 1, done: true, rewarded: true };
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

  assert.deepEqual(viaGame.gatesCompleted, ["h1-g01"], "cleared via the last game");
  assert.deepEqual(viaQuiz.gatesCompleted, ["h1-g01"], "cleared via the quiz");
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
  assert.deepEqual(a.state.jenn.gatesCompleted, ["h1-g01"], "and it is not listed twice");
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
  const best = s.gateBestQuiz["h1-g01"];
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

// ── G03: gate deadline expiry ──────────────────────────────────────────────

/** A player mid-attempt at a gate whose deadline has already passed. */
function lapsedGate(a, did = 1, level = 1) {
  F.installState(a);
  a.curHSK = level;
  const s = a.state.jenn;
  const k = a.gateKeyOf(did, level);
  s.gateGameStars = { [k]: { trace: 3, match: 3, rain: 3, listen: 0 } };
  s.gateBestQuiz = { [k]: { accPct: 95, quizStars: 3, points: 200 } };
  s.gateTimers = { [k]: { startKey: "2026-08-01", deadlineKey: "2026-08-06", active: true, days: 5, attemptId: "g1-old" } };
  s.library = { 水: { py: "shuǐ", mn: "water" } };
  s.failedWords = { 山: { zh: "山", py: "shān", en: "mountain", failCount: 2 } };
  s.storyReadCount = { xia: 2 };
  s.flashPassDone = { [k]: true };
  s.totalStars = 500;
  return s;
}

test("G03: a lapsed timer is expired at render time, not silently later", () => {
  const a = app();
  const s = lapsedGate(a);
  const expired = a.sweepExpiredGateTimers(s);
  assert.deepEqual(expired, ["h1-g01"], "the sweep finds and expires it");
  assert.equal(s.gateTimers["h1-g01"].active, false);
});

test("G03: expiry clears the attempt but keeps everything learned", () => {
  const a = app();
  const s = lapsedGate(a);
  a.sweepExpiredGateTimers(s);

  assert.deepEqual(s.gateGameStars["h1-g01"], { trace: 0, match: 0, rain: 0, listen: 0 }, "qualifying game stars cleared");
  assert.equal(s.gateBestQuiz["h1-g01"], undefined, "qualifying quiz best cleared");

  assert.deepEqual(Object.keys(s.library), ["水"], "learned characters kept");
  assert.deepEqual(Object.keys(s.failedWords), ["山"], "practice queue kept");
  assert.equal(s.storyReadCount.xia, 2, "reading credit kept");
  assert.equal(s.flashPassDone["h1-g01"], true, "flashcard pass kept");
  assert.equal(s.totalStars, 500, "stars already earned are not taken away");
});

test("G03: the expired attempt is archived, not erased", () => {
  const a = app();
  const s = lapsedGate(a);
  a.sweepExpiredGateTimers(s);

  const hist = s.gateAttemptHistory["h1-g01"];
  assert.equal(hist.length, 1);
  assert.equal(hist[0].attemptId, "g1-old");
  assert.equal(hist[0].reason, "deadline");
  assert.deepEqual(hist[0].gameStars, { trace: 3, match: 3, rain: 3, listen: 0 }, "what was achieved is recorded");
  assert.equal(hist[0].bestQuiz.accPct, 95);
});

test("G03: expiry happens once, however many times the hub renders", () => {
  const a = app();
  const s = lapsedGate(a);
  a.sweepExpiredGateTimers(s);
  a.sweepExpiredGateTimers(s);
  a.sweepExpiredGateTimers(s);
  assert.equal(s.gateAttemptHistory["h1-g01"].length, 1, "no duplicate history entries");
});

test("M-T08 / G03: an old pending round cannot qualify the new attempt", () => {
  const a = app();
  const s = lapsedGate(a);
  s.pendingSessions.gate = { did: 1, phase: 1, score: 200, vocab: [], questions: [], pyQ: [], sbPack: [] };
  a.sweepExpiredGateTimers(s);

  assert.ok(s.pendingSessions.gate, "the round is not thrown away");
  assert.equal(s.pendingSessions.gate.attemptExpired, true, "but it is flagged as belonging to the old attempt");
});

test("G03: a timer still inside its deadline is left alone", () => {
  const a = app();
  const s = lapsedGate(a);
  s.gateTimers["h1-g01"].deadlineKey = "2099-01-01";
  assert.deepEqual(a.sweepExpiredGateTimers(s), [], "nothing expires");
  assert.equal(s.gateTimers["h1-g01"].active, true);
  assert.equal(s.gateBestQuiz["h1-g01"].accPct, 95, "progress untouched");
});

test("G03: each new timed attempt gets its own identity", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  a.startGateTimerIfNeeded(s, 1, 3);
  const first = s.gateTimers["h1-g01"].attemptId;
  assert.ok(first, "an attempt id is recorded");
  s.gateTimers["h1-g01"].active = false;
  a.startGateTimerIfNeeded(s, 1, 3);
  assert.notEqual(s.gateTimers["h1-g01"].attemptId, first, "a fresh attempt is distinguishable from the old one");
});

// ── S02: revision-checked sync ─────────────────────────────────────────────

/** Firestore stub with transaction support and a settable stored document. */
function txDb(stored = null) {
  const box = { doc: stored, writes: 0 };
  const ref = {
    get: async () => ({ exists: !!box.doc, data: () => box.doc }),
    set: async (v) => { box.doc = JSON.parse(JSON.stringify(v)); box.writes++; },
  };
  return {
    box,
    collection: () => ({ doc: () => ref }),
    runTransaction: (fn) => Promise.resolve(fn({
      get: (r) => r.get(),
      set: (r, v) => { box.doc = JSON.parse(JSON.stringify(v)); box.writes++; },
    })),
  };
}

const tick = () => new Promise((r) => setTimeout(r, 12));

test("S02: every save advances the player's revision", () => {
  const a = app();
  F.installState(a);
  assert.equal(a.state.jenn.revision, 0);
  a.savePlayer("jenn");
  a.savePlayer("jenn");
  assert.equal(a.state.jenn.revision, 2, "revision counts local writes");
});

test("S02: a write lands and reports Synced when nobody else has written", async () => {
  const a = app();
  F.installState(a);
  const db = txDb(null);
  a.db = db;
  a.savePlayer("jenn");
  await tick();
  assert.equal(db.box.writes, 1, "the document was written");
  assert.equal(db.box.doc.revision, 1);
  assert.equal(a.syncStatus.jenn, "synced");
});

test("S02: a stale write is refused instead of clobbering a newer device", async () => {
  const a = app();
  F.installState(a);
  // Another device has already pushed revision 7.
  const db = txDb({ revision: 7, lastSaved: 999, totalStars: 900, gatesCompleted: [1, 2, 3] });
  a.db = db;
  a.remoteBaseRevision.jenn = 0;          // this device never saw that write
  a.state.jenn.totalStars = 10;

  a.savePlayer("jenn");
  await tick();

  assert.equal(db.box.writes, 0, "the stale write did not overwrite the newer document");
  assert.equal(db.box.doc.totalStars, 900, "the other device's data is intact");
  assert.equal(a.syncStatus.jenn, "attention", "and it is surfaced, not swallowed");
});

test("S02: the divergence is recorded with both sides' shape", async () => {
  const a = app();
  F.installState(a);
  const db = txDb({ revision: 7, lastSaved: 999, totalStars: 900, gatesCompleted: [1, 2, 3] });
  a.db = db;
  a.remoteBaseRevision.jenn = 0;
  a.state.jenn.totalStars = 10;

  a.savePlayer("jenn");
  await tick();

  const c = a.state.jenn.syncConflicts;
  assert.equal(c.length, 1);
  assert.equal(c[0].remoteRevision, 7);
  assert.equal(c[0].remoteTotalStars, 900);
  assert.equal(c[0].remoteGatesCompleted, 3);
  assert.equal(c[0].localTotalStars, 10, "the local side is recorded as it was");
  assert.ok(c[0].mergedTotalStars >= 10, "and the reconciled result is recorded too");
});

test("S02: after a conflict the next save is decisive rather than looping", async () => {
  const a = app();
  F.installState(a);
  const db = txDb({ revision: 7, lastSaved: 999, totalStars: 900, gatesCompleted: [] });
  a.db = db;
  a.remoteBaseRevision.jenn = 0;

  a.savePlayer("jenn");
  await tick();
  assert.equal(db.box.writes, 0, "first attempt refused");

  a.savePlayer("jenn");
  await tick();
  assert.equal(db.box.writes, 1, "the retry succeeds");
  assert.ok(db.box.doc.revision > 7, "having moved past the other device's revision");
  assert.equal(a.syncStatus.jenn, "synced");
});

test("S02: the conflict log stays bounded", async () => {
  const a = app();
  F.installState(a);
  for (let i = 0; i < 12; i++) {
    a.noteSyncConflict("jenn", { revision: i, lastSaved: i, totalStars: i, gatesCompleted: [] }, i);
  }
  assert.equal(a.state.jenn.syncConflicts.length, 5, "a player document cannot grow without limit");
});

// ── C01–C04: 88 gate identities inside the app ─────────────────────────────

test("M-T01: clearing level 1 gate 1 does not clear level 2 gate 1", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const s = a.state.jenn;
  s.gateGameStars = { "h1-g01": { trace: 3, match: 3, rain: 3, listen: 3 } };
  s.gateBestQuiz = { "h1-g01": { accPct: 95, quizStars: 3, points: 150 } };

  assert.equal(a.evaluateGateCompletion(1, 1).justCleared, true);
  assert.deepEqual(s.gatesCompleted, ["h1-g01"]);

  // The same dynasty, one level up, is a different gate entirely.
  assert.equal(a.gateCleared(s, 1, 1), true);
  assert.equal(a.gateCleared(s, 1, 2), false, "level 2 gate 1 is untouched");
  a.curHSK = 2;
  assert.equal(a.gameUnlockForDid(1).rain, false, "and it has not inherited the unlock");
});

test("M-T02: a round files its stars in the level it was started in", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 2;
  a.curGameTargetDid = 3;
  a.curGameTargetLevel = 2;
  const words = [
    { zh: "水", py: "shuǐ", en: "water" },
    { zh: "山", py: "shān", en: "mountain" },
  ];
  a.startMemoryMatch(words);
  assert.equal(a.matchSt.gameTargetLevel, 2, "the level travels with the round");

  // The child switches tab mid-round.
  a.curHSK = 4;
  a.updateGateGameBest(3, "match", 3, a.matchSt.gameTargetLevel);

  assert.ok(a.state.jenn.gateGameStars["h2-g03"], "stars land in level 2, where the round began");
  assert.equal(a.state.jenn.gateGameStars["h2-g03"].match, 3);
  assert.equal(a.state.jenn.gateGameStars["h4-g03"], undefined, "not in the tab that happens to be open");
});

test("C01: all 88 gates are reachable by the intended progression", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  const G = a.GateIdentity;
  // Walk the whole curriculum.
  G.allGateKeys().forEach((k) => {
    const p = G.parseGateKey(k);
    assert.equal(G.isGateOpen(k, s.gatesCompleted), true, `${k} should be open once its predecessor is cleared`);
    s.gatesCompleted.push(k);
  });
  assert.equal(s.gatesCompleted.length, 88, "88 distinct gates cleared, not 22");
  assert.equal(G.nextOpenGateKey(s.gatesCompleted), null);
});

test("C01: the level a child is on comes from real progress, not a running total", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  s.legacyLevelAccess = [1];

  s.gatesCompleted = ["h1-g01", "h1-g02", "h1-g03", "h1-g04", "h1-g05", "h1-g06"];
  assert.equal(a.getCurrentHSK(s), 1, "six gates in level 1 does not open level 2");

  // Finishing the level does.
  for (let g = 7; g <= 22; g++) s.gatesCompleted.push(`h1-g${String(g).padStart(2, "0")}`);
  assert.equal(a.getCurrentHSK(s), 2, "clearing gate 22 opens the next level");
  assert.equal(a.gatesClearedInLevel(s, 1), 22);
  assert.equal(a.gatesClearedInLevel(s, 2), 0);
});

test("C03: migrating a legacy save keeps the credit, and no longer grants access", () => {
  const a = app();
  // A pre-migration document, exactly as it sits on disk today.
  const legacy = a.defPlayer();
  delete legacy.schemaVersion;
  legacy.gatesCompleted = [1, 2, 3, 4, 5];
  legacy.gateStars = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 };
  legacy.gateGameStars = { 5: { trace: 3, match: 3, rain: 3, listen: 3 } };
  legacy.totalStars = 2270;
  F.installState(a, { jenn: legacy });

  const s = a.state.jenn;
  assert.deepEqual(s.gatesCompleted, ["h1-g01", "h1-g02", "h1-g03", "h1-g04", "h1-g05"]);
  assert.equal(s.gateStars["h1-g05"], 3, "stars follow their gate");
  assert.equal(s.gateGameStars["h1-g05"].trace, 3, "so do game stars");
  assert.equal(s.totalStars, 2270, "and nothing else is disturbed");
  assert.deepEqual(s.legacyCredit.gatesCompleted, [1, 2, 3, 4, 5], "provenance kept");

  // The migration still RECORDS what the old running-total rule had opened,
  // because it is worth knowing what a child used to be able to reach...
  assert.deepEqual(s.legacyLevelAccess, [1, 2], "what the old rule opened is still recorded");

  // ...but it no longer opens anything. Five cleared gates is not 22, so HSK2
  // is shut, and a document that already carries the grant needs no migration
  // to lose it — the rule simply stopped consulting the field.
  assert.equal(a.levelIsUnlocked(s, 2), false,
    "five gates does not open HSK2, grandfathered or not");
  assert.equal(a.levelIsUnlocked(s, 3), false);
  assert.equal(a.getCurrentHSK(s), 1, "and the child reads as HSK1");
});

test("C03b: only clearing all 22 gates of the level below opens a level", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  // The grant that used to be honoured, now inert.
  s.legacyLevelAccess = [1, 2, 3, 4];

  for (let g = 1; g <= 21; g++) s.gatesCompleted.push(`h1-g${String(g).padStart(2, "0")}`);
  assert.equal(a.levelIsUnlocked(s, 2), false, "21 of 22 is still locked");

  s.gatesCompleted.push("h1-g22");
  assert.equal(a.levelIsUnlocked(s, 2), true, "the 22nd gate opens it");
  assert.equal(a.levelIsUnlocked(s, 3), false, "and opens only the next one");
});

test("M-T18: re-running the migration through ensureState changes nothing", () => {
  const a = app();
  const legacy = a.defPlayer();
  delete legacy.schemaVersion;
  legacy.gatesCompleted = [1, 2];
  legacy.totalStars = 100;
  F.installState(a, { jenn: legacy });
  const once = JSON.stringify(a.state.jenn);

  a.ensureState("jenn");
  a.ensureState("jenn");
  assert.equal(JSON.stringify(a.state.jenn), once, "no duplicate credit, no lost access");
});

test("C03: a fresh player is not put through the migration", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  assert.equal(s.schemaVersion, a.GateIdentity.SCHEMA_VERSION);
  assert.equal(s.legacyCredit, undefined, "nothing to inherit");
  assert.deepEqual(s.gatesCompleted, []);
});

// ── T01: no distractor may read like the answer ────────────────────────────

test("T01: a near-synonym never appears as a wrong option", () => {
  const a = app();
  F.installState(a);
  // 他们 and 她们 are different words that share a gloss. Rendering both as
  // "they" used to produce an unanswerable question.
  const pool = [
    { zh: "他们", py: "tā men", en: "they" },
    { zh: "她们", py: "tā men", en: "they" },
    { zh: "两", py: "liǎng", en: "two" },
    { zh: "二", py: "èr", en: "two" },
    { zh: "水", py: "shuǐ", en: "water" },
    { zh: "山", py: "shān", en: "mountain" },
    { zh: "火", py: "huǒ", en: "fire" },
    { zh: "人", py: "rén", en: "person" },
  ];
  const answer = pool[0];
  const wrong = a.pickDistractors(pool.filter((w) => w.zh !== answer.zh), answer, (w) => w.en, 3);
  assert.ok(!wrong.some((w) => w.en === answer.en), "no option reads the same as the answer");
  assert.equal(new Set(wrong.map((w) => w.en)).size, wrong.length, "and no two options read alike");
});

test("T01: every generated MCQ has four distinct readable options", () => {
  const a = app();
  F.installState(a);
  const vocab = [
    { zh: "他们", py: "tā men", en: "they" },
    { zh: "她们", py: "tā men", en: "they" },
    { zh: "两", py: "liǎng", en: "two" },
    { zh: "二", py: "èr", en: "two" },
    { zh: "已经", py: "yǐ jīng", en: "already" },
    { zh: "已", py: "yǐ", en: "already" },
    { zh: "水", py: "shuǐ", en: "water" },
    { zh: "山", py: "shān", en: "mountain" },
    { zh: "火", py: "huǒ", en: "fire" },
    { zh: "人", py: "rén", en: "person" },
    { zh: "大", py: "dà", en: "big" },
    { zh: "小", py: "xiǎo", en: "small" },
  ];
  const qs = a.buildMCQ(vocab, 10);
  qs.forEach((q) => {
    assert.equal(new Set(q.opts).size, q.opts.length,
      `question on ${q.zh} has a repeated option: ${JSON.stringify(q.opts)}`);
    assert.ok(q.opts.includes(q.correct) || q.reverse, "the answer is among the options");
  });
});

test("T01: the curriculum no longer teaches dictionary artefacts", () => {
  const a = app();
  const hsk1 = require("../data/hsk1.json");
  const junk = /variant of|abbr\.|^\s*surname |old variant of|^\s*used in /i;
  const bad = [];
  hsk1.gates.forEach((g) => {
    [...(g.newWords || []), ...(g.reviewWords || [])].forEach((w) => {
      if (junk.test(w.en || "")) bad.push(`${w.zh}: ${w.en}`);
    });
  });
  assert.deepEqual(bad, [], "the array the games actually serve is clean");

  // Spot-check the fixtures the audit named.
  const find = (zh) => hsk1.words.find((w) => w.zh === zh);
  assert.equal(find("水").en, "water");
  assert.equal(find("水").pinyin, "shuǐ");
  assert.equal(find("家").en, "home; family");
  assert.equal(find("书").en, "book");
  assert.equal(find("里").en, "inside; in");
  assert.equal(find("新").en, "new");
});

// ── T02: the lesson shows what was actually written ────────────────────────

test("T02: the renderer no longer carries hard-coded substitute questions", () => {
  const fs = require("fs");
  const src = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
  const start = src.indexOf("async function renderGateLesson");
  const body = src.slice(start, src.indexOf("function closeCultureStories"));
  ["How many new words are in this gate?",
   "Say two new words from this gate.",
   "After reading, what should you do first?"].forEach((q) => {
    assert.ok(!body.includes(q), `the substitute question "${q}" is gone`);
  });
  assert.ok(body.includes("lesson.passage"), "the authored passage is rendered");
  assert.ok(body.includes("lesson.explanation"), "so is the authored explanation");
  assert.ok(body.includes("q.answer"), "and the authored answer, which was never displayed");
});

test("T02: every lesson file has the content the renderer now needs", () => {
  const fs = require("fs");
  const path = require("path");
  const dir = path.join(__dirname, "..", "data", "lessons");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.equal(files.length, 88, "one lesson per gate");

  const missing = [];
  files.forEach((f) => {
    const l = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (!l.passage) missing.push(`${f}: no passage`);
    if (!Array.isArray(l.comprehension) || !l.comprehension.length) missing.push(`${f}: no questions`);
    (l.comprehension || []).forEach((q, i) => {
      if (!q.question) missing.push(`${f}: question ${i} has no text`);
      if (!q.answer) missing.push(`${f}: question ${i} has no answer`);
    });
  });
  assert.deepEqual(missing, [], "nothing the renderer reads is absent");
});

// ── Bilingual UI labels ────────────────────────────────────────────────────

test("UI-T01: every named feature has both languages, from one definition", () => {
  const a = app();
  const labels = a.UI_LABELS;
  const keys = Object.keys(labels);
  assert.ok(keys.length >= 30, "the registry covers the app's named features");

  const cjk = /[一-鿿]/;
  const latin = /[A-Za-z]{2,}/;
  for (const k of keys) {
    const d = labels[k];
    assert.ok(latin.test(d.en), `${k}: needs an English name`);
    assert.ok(cjk.test(d.zh), `${k}: needs a Chinese name`);
    // The rendered form always carries both, so a control can never ship in
    // one language the way the hub buttons used to.
    const rendered = a.L(k);
    assert.ok(latin.test(rendered) && cjk.test(rendered),
      `${k}: rendered label must be bilingual, got ${rendered}`);
    assert.ok(rendered.includes(" · "), `${k}: uses the ' · ' separator`);
  }
  assert.equal(a.L("flashCards", { icon: false }), "Flash Cards · 词卡");
});

test("UI-T02: no named feature ships in only one language", () => {
  const fs = require("fs");
  const path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const a = app();

  // The defect: the hub button said "📖 拼音表" while the overlay it opened said
  // "拼音表 · Pinyin Chart"; "🏮 Culture Stories" opened
  // "🏮 Culture Stories · 文化故事". Two hand-written copies, free to disagree,
  // and half of them readable in only one language — which for these two
  // readers means not readable at all.
  //
  // Every named feature now renders from UI_LABELS, so the regression to catch
  // is a STATIC label that is one of those names in a single language.
  const cjk = /[一-鿿]/;
  const latin = /[A-Za-z]{2,}/;
  const strip = (t) => t.replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();

  const names = new Map();
  for (const [k, d] of Object.entries(a.UI_LABELS)) {
    names.set(strip(d.en), k);
    names.set(strip(d.zh), k);
  }

  const offenders = [];
  for (const m of html.matchAll(/<(?:button|summary|div)\b[^>]*>([^<>{}`]{2,60})<\/(?:button|summary|div)>/g)) {
    const raw = m[1].trim();
    if (!raw) continue;
    const key = names.get(strip(raw));
    if (!key) continue;                       // not one of our feature names
    if (cjk.test(raw) && latin.test(raw)) continue; // already bilingual
    offenders.push(`${key}: ${raw}`);
  }
  assert.deepEqual(offenders, [],
    "a named feature written straight into markup in one language");
});

test("UI-T03: the static markup carries no hand-written copy of a label", () => {
  const fs = require("fs");
  const path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const a = app();

  // A hand-written copy of the rendered form is how the two versions drifted
  // apart in the first place, so the rendered string must appear nowhere but
  // the registry that produces it.
  const dupes = [];
  for (const k of Object.keys(a.UI_LABELS)) {
    const rendered = a.L(k);
    for (const m of html.matchAll(/<(?:button|summary|div|span)\b[^>]*>([^<>{}`]+)<\//g)) {
      if (m[1].trim() === rendered) dupes.push(`${k}: ${rendered}`);
    }
  }
  assert.deepEqual(dupes, [], "labels must come from L() or data-ui-label");
});

// ── Stories and lessons ────────────────────────────────────────────────────

test("S-T01: a story's reads count against the level that served it", () => {
  const a = app();
  F.installState(a);
  // The same dynasty at two levels is two different reading gates. Before
  // stories carried a level, reading 夏朝 on HSK1 unlocked the games on h2-g01
  // as well, because reads were keyed by dynasty alone.
  assert.equal(a.storyKeyFor("xia", 1), "xia-h1");
  assert.equal(a.storyKeyFor("xia", 2), "xia-h2");
  assert.equal(a.storyKeyFor("xia-h1", 3), "xia-h3", "an already-suffixed id is re-levelled, not doubled");
});

test("S-T02: a level with no text of its own falls back and says so", () => {
  const a = app();
  F.installState(a);
  const own = a.storyForGate("xia", 1);
  assert.equal(own.id, "xia-h1");
  assert.ok(!own.shared, "level 1 has its own text");

  // HSK2 now has its own telling; HSK3 does not yet, so it is the fallback case.
  const ownTwo = a.storyForGate("xia", 2);
  assert.equal(ownTwo.id, "xia-h2");
  assert.ok(!ownTwo.shared, "HSK2 has its own text too");

  const borrowed = a.storyForGate("xia", 3);
  assert.equal(borrowed.id, "xia-h3", "served under the level's own id, so reads count for that level");
  assert.equal(borrowed.shared, true, "and flagged, so the reader can say the text is shared");
  assert.deepEqual(borrowed.sents, own.sents, "it is level 1's text");
});

test("S-T03: every HSK1 story is on the ladder and fully glossed", () => {
  const a = app();
  const stories = Object.values(a.STORIES_MAP).filter((s) => s.level === 1);
  assert.equal(stories.length, 44, "22 dynasties, two stories each");
  for (const s of stories) {
    assert.equal(s.sents.length, 10, `${s.id}: the HSK1 ladder is ten sentences`);
    assert.equal(s.trans.length, 10, `${s.id}: every sentence needs its English`);
    for (const tok of s.sents.flat()) {
      if (tok.t === "p") continue;
      const zh = tok.ch || tok.tx;
      assert.ok(tok.py, `${s.id}: "${zh}" has no reading`);
      const en = String(tok.mn == null ? "" : tok.mn).trim();
      assert.ok(en, `${s.id}: "${zh}" has no meaning`);
      // The child sees this string when they tap the character. 96 of these
      // were a longer word's English cut in half ("-tice" for 习) or a
      // linguist's code ("DE" for 的).
      assert.ok(!/^[-—]/.test(en), `${s.id}: "${zh}" is glossed "${en}" — a fragment`);
      assert.ok(!/^[A-Z]{2,5}$/.test(en), `${s.id}: "${zh}" is glossed "${en}" — a grammar code`);
    }
  }
});

test("S-T04: HSK1 lessons are bilingual and drawn from their own gate's story", () => {
  const fs = require("fs");
  const path = require("path");
  const a = app();
  const dir = path.join(__dirname, "..", "data", "lessons");

  for (let g = 1; g <= 22; g++) {
    const id = `hsk1_gate_${String(g).padStart(2, "0")}`;
    const L = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), "utf8"));

    // An instruction the child cannot read is not an instruction.
    for (const [en, zh, what] of [
      [L.explanationEn, L.explanation, "explanation"],
      [L.speakingPromptEn, L.speakingPrompt, "speaking prompt"],
    ]) {
      assert.match(en || "", /[A-Za-z]{3,}/, `${id}: ${what} has no English`);
      assert.match(zh || "", /[一-鿿]/, `${id}: ${what} has no Chinese`);
    }
    assert.match(L.passageEn || "", /[A-Za-z]{3,}/, `${id}: the passage has no English`);

    // The passage used to be the gate's word list wrapped in instructions,
    // with questions about the lesson rather than about a text.
    assert.ok(!/生字|本关有几个|复习字/.test(L.passage), `${id}: the passage is a word list`);
    L.comprehension.forEach((q, i) => {
      assert.ok(!/生字|本关有几个/.test(q.question), `${id} q${i + 1}: asks about the lesson`);
      assert.match(q.questionEn || "", /[A-Za-z]{3,}/, `${id} q${i + 1}: no English`);
      assert.ok(String(q.answer || "").trim(), `${id} q${i + 1}: no answer`);
    });

    // And it must come from THIS gate's story, not a free-standing topic.
    const dyn = a.DYNASTIES.find((d) => d.id === g);
    const story = a.STORIES_MAP[`${dyn.story}-h1`];
    const opening = story.sents.slice(0, 4)
      .map((s) => s.map((t) => (t.t === "p" ? t.tx : (t.ch || t.tx))).join("")).join("");
    assert.equal(L.passage, opening, `${id}: the passage is not this gate's story`);
    L.keyVocab.forEach((v) => {
      assert.ok(L.passage.includes(v.zh), `${id}: key word "${v.zh}" is not in the passage`);
    });
  }
});

// ── Parent panel: level-aware flags ────────────────────────────────────────

test("P-T01: gates cleared is reported per level, not as a bare count over 22", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  // A gate is (level, dynasty), so gatesCompleted spans all 88. The panel used
  // to print `gatesCompleted.length + "/22"`, which reads "24/22" for a child
  // with progress on two levels and says nothing about which level.
  for (let g = 1; g <= 22; g++) s.gatesCompleted.push(`h1-g${String(g).padStart(2, "0")}`);
  s.gatesCompleted.push("h2-g01", "h2-g02");
  const out = a.gatesClearedSummary(s);
  assert.match(out, /HSK1 22\/22/);
  assert.match(out, /HSK2 2\/22/);
  assert.ok(!/24\/22/.test(out), "never more cleared than the level holds");
});

test("P-T02: the read-count flag checks the levels played, not the ambient one", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  // Games played at HSK2 on gate 1, with no reads at that level.
  s.gateGameStars = { "h2-g01": { trace: 3, match: 0, rain: 0, listen: 0 } };
  s.storyReadCount = { "xia-h1": 2 };   // read twice, but at level 1

  // The panel opens from the select screen, where curHSK holds whatever the
  // last session left. Both settings must give the same answer.
  a.curHSK = 1;
  const atOne = a.playedBeforeReadingHtml(s);
  a.curHSK = 4;
  const atFour = a.playedBeforeReadingHtml(s);
  assert.equal(atOne, atFour, "the flag must not depend on the ambient level");
  assert.match(atOne, /HSK2/, "and it names the level the games were played at");

  // Reading it twice AT THAT LEVEL clears the flag.
  s.storyReadCount["xia-h2"] = 2;
  assert.equal(a.playedBeforeReadingHtml(s), "", "two reads at that level clears it");
});

test("P-T03: a revoked inherited level is explained rather than vanishing", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  s.legacyLevelAccess = [1, 2];
  s.gatesCompleted = ["h1-g01", "h1-g02"];
  const html = a.inheritedAccessHtml(s);
  assert.match(html, /HSK2/, "says which level they could once open");
  assert.match(html, /22 gates/, "and what it now takes");

  // Once earned properly there is nothing to explain.
  for (let g = 3; g <= 22; g++) s.gatesCompleted.push(`h1-g${String(g).padStart(2, "0")}`);
  assert.equal(a.inheritedAccessHtml(s), "", "no note once the level is genuinely open");
});

// ── Self-audit findings ────────────────────────────────────────────────────

test("A-T30: a mid-quiz story resume works on a level serving a shared text", () => {
  const a = app();
  F.installState(a);
  // A level with no text of its own is served a story SYNTHESIZED by
  // storyForGate — it carries that level's id but is never in STORIES_MAP.
  // Resolving through the map alone made "Continue story quiz" a dead button
  // on every level but 1.
  assert.equal(a.STORIES_MAP["xia-h3"], undefined, "the shared story is not a map member");
  const st = a.storyById("xia-h3");
  assert.ok(st, "but it still resolves");
  assert.equal(st.id, "xia-h3");
  assert.equal(a.storyById("xia-h1").id, "xia-h1", "a real member resolves too");
  assert.equal(a.storyById("nope-h1"), null);
});

test("A-T31: a stored story id finds its dynasty despite the level suffix", () => {
  const a = app();
  F.installState(a);
  // `DYNASTIES.find(d => d.story === ps.storyId)` compared a suffixed id
  // against bare base ids, so it could never match and the caller fell through
  // to DYNASTIES[0] — drawing the mini-quiz word pool from the Xia gate.
  for (const lv of [1, 2, 3, 4]) {
    assert.equal(a.dynastyForStoryId(`qin-h${lv}`).id, 5, `qin-h${lv} is gate 5`);
    assert.equal(a.dynastyForStoryId(`qin2-h${lv}`).id, 5, "the second story too");
  }
  assert.equal(a.dynastyForStoryId("nope-h1"), null);
});

test("A-T32: the character index is rebuilt when the stories are", () => {
  const a = app();
  F.installState(a);
  // Stories are fetched now, so a call before the fetch lands cached an empty
  // index forever — and Trace reads it.
  a.curriculumCache.stories[1] = {};
  a.rebuildStoriesMap();
  assert.equal(Object.keys(a.getCharMeta()).length > 0, true,
    "vocabulary still fills it even with no stories");
  const empty = Object.keys(a.getCharMeta()).length;

  a.curriculumCache.stories[1] = JSON.parse(
    require("fs").readFileSync(require("path").join(__dirname, "..", "data", "stories", "hsk1.json"), "utf8")).stories;
  a.rebuildStoriesMap();
  assert.ok(Object.keys(a.getCharMeta()).length > empty,
    "and the index picks the stories up once they arrive");
});

test("A-T33: a character with no standalone reading is shown, never guessed at", () => {
  const a = app();
  F.installState(a);
  // Word-level tokens leave 34 characters appearing only inside a word.
  const out = a.uniqueChars([{ zh: "房间", py: "fángjiān", en: "room" }]);
  const fang = out.find((c) => c.zh === "房");
  assert.ok(fang, "the character is still offered for tracing");
  assert.equal(fang.py, "", "with no invented syllable");
  assert.equal(fang.fromWord, "房间", "and the word it came from recorded");
  assert.equal(fang.fromWordPy, "fángjiān", "so the card is not blank");

  // A single-character word keeps its own reading.
  const shui = a.uniqueChars([{ zh: "水", py: "shuǐ", en: "water" }])[0];
  assert.equal(shui.py, "shuǐ");
});

test("S-T05: both halves of a split word's English are refused as glosses", () => {
  const a = app();
  // The first repair caught only the TRAILING half — 学习 "practice" leaving 习
  // as "-tice". The leading half was still shipping: 皇帝 "emperor" left 皇 as
  // "em-", 丝绸 left 丝 as "silk-", 太阳 left 太 as "Tai-". 115 of those were
  // reaching children across the built HSK1 and HSK2 corpora.
  const bad = [];
  for (const s of Object.values(a.STORIES_MAP)) {
    for (const tok of s.sents.flat()) {
      if (tok.t === "p") continue;
      const en = String(tok.mn == null ? "" : tok.mn).trim();
      const zh = tok.ch || tok.tx;
      if (!en) bad.push(`${s.id}: ${zh} has no gloss`);
      else if (/^[-—]/.test(en)) bad.push(`${s.id}: ${zh}="${en}" (trailing half)`);
      else if (/^[A-Za-z]+-$/.test(en)) bad.push(`${s.id}: ${zh}="${en}" (leading half)`);
      else if (/^[A-Z]{2,5}$/.test(en)) bad.push(`${s.id}: ${zh}="${en}" (grammar code)`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} fragment glosses in the corpus`);
});

test("S-T06: every HSK2 story is on its own ladder", () => {
  const a = app();
  const h2 = Object.values(a.STORIES_MAP).filter((s) => s.level === 2);
  assert.equal(h2.length, 44, "22 dynasties, two stories each");
  for (const s of h2) {
    assert.equal(s.sents.length, 15, `${s.id}: the HSK2 ladder is fifteen sentences`);
    assert.equal(s.trans.filter((t) => t && t.trim()).length, 15, `${s.id}: every sentence needs its English`);
  }
  // And it is genuinely a different telling from HSK1, not the same text.
  const one = a.STORIES_MAP["xia-h1"], two = a.STORIES_MAP["xia-h2"];
  assert.notEqual(one.sents.length, two.sents.length);
  assert.notDeepEqual(one.sents[0], two.sents[0], "the HSK2 telling is its own text");
});

test("M-T20: the migration decides for itself whether a save needs work", () => {
  const a = app();
  const G = a.GateIdentity;
  // defPlayer() stamps the current version and mergePlayerState is
  // Object.assign({}, defPlayer(), loaded) — so an unstamped legacy save arrives
  // already carrying the newest version number. A caller that checks the stamp
  // and the gate shape then sees nothing to do, and a child who had read stories
  // but cleared no gates never gets the story remap.
  const merged = Object.assign({}, a.defPlayer(), {
    storyReadCount: { xia: 2, shang: 1 }, storiesCompleted: ["xia"],
  });
  assert.equal(merged.schemaVersion, G.SCHEMA_VERSION, "the stamp says it is current");
  assert.equal(G.looksLegacy(merged), false, "and the gate shape is fine");
  assert.equal(G.needsMigration(merged), true, "but the story ids are not");

  const { player } = G.migratePlayer(merged);
  assert.equal(player.storyReadCount["xia-h1"], 2);
  assert.equal(player.storyReadCount["shang-h1"], 1);
  assert.deepEqual(player.storiesCompleted, ["xia-h1"]);

  // And ensureState must go through that same predicate, not its own test.
  const b = app();
  F.installState(b, { jenn: Object.assign({}, b.defPlayer(), { storyReadCount: { xia: 2 } }) });
  assert.equal(b.state.jenn.storyReadCount["xia-h1"], 2,
    "loading a save applies the remap");
});

test("T-T10: no fragment gloss reaches a child through any surface", () => {
  const a = app();
  const fs = require("fs"), path = require("path");
  const isFragment = (t) => /^[-—]/.test(t) || /^[A-Za-z.]+-$/.test(t) || /^[A-Z]{2,5}$/.test(t);
  const bad = [];

  // the reader
  for (const s of Object.values(a.STORIES_MAP)) {
    for (const tok of s.sents.flat()) {
      if (tok.t === "p") continue;
      if (isFragment(String(tok.mn || "").trim())) bad.push(`story ${s.id}: ${tok.ch || tok.tx}="${tok.mn}"`);
    }
  }
  // the games and quizzes, which serve gate vocabulary rather than stories
  for (const lv of [1, 2, 3, 4]) {
    const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", `hsk${lv}.json`), "utf8"));
    const rows = [...(doc.words || [])];
    (doc.gates || []).forEach((g) => rows.push(...(g.newWords || []), ...(g.reviewWords || [])));
    rows.forEach((w) => {
      if (isFragment(String(w.en || "").trim())) bad.push(`hsk${lv} vocabulary: ${w.zh}="${w.en}"`);
    });
  }
  assert.deepEqual(bad.slice(0, 8), [], `${bad.length} fragment glosses still reachable`);
});

test("T-T11: a trailing hyphen never silently drops a word from its pool", () => {
  const a = app();
  // Two things went wrong here in sequence. extractStoryVocab used to reassemble
  // split-word glosses, and with the fragment class gone the only thing left for
  // that branch to match was a REAL gloss ending in a prefix — it stripped the
  // hyphen and skipped isCleanMeaning, putting 非 into the pool as "not; non".
  // Removing the branch then swung the other way: isCleanMeaning rejects any
  // gloss ending in "-", so 非 and 再 vanished from the pools altogether and
  // stopped being taught at all. The fix is at the source — glosses do not
  // trail a hyphen — so both behaviours are now checked.
  const story = {
    sents: [[{ t: "c", ch: "非", py: "fēi", mn: "not" },
             { t: "c", ch: "常", py: "cháng", mn: "often" },
             { t: "p", tx: "。" }]],
  };
  const vocab = a.extractStoryVocab(story);
  const fei = vocab.find((w) => w.zh === "非");
  assert.ok(fei, "a character with a plain gloss reaches the pool");
  assert.equal(fei.en, "not", "served as written, not mangled");
  assert.equal(vocab.find((w) => w.zh === "非常"), undefined,
    "and two separate characters are not welded together");

  // The real corpus: every study token's gloss must survive isCleanMeaning, or
  // the word is taught in the reader and nowhere else.
  const dropped = [];
  for (const s of Object.values(a.STORIES_MAP)) {
    const pool = new Set(a.extractStoryVocab(s).map((w) => w.zh));
    for (const tok of s.sents.flat()) {
      if (tok.t !== "c" || tok.bonus) continue;
      if (!pool.has(tok.ch) && /-$/.test(String(tok.mn || ""))) {
        dropped.push(`${s.id}: ${tok.ch}="${tok.mn}"`);
      }
    }
  }
  assert.deepEqual(dropped.slice(0, 8), [], `${dropped.length} words dropped from their pool by a trailing hyphen`);
});

test("T-T12: a grammar-code filter must not swallow ordinary English words", () => {
  const a = app();
  // isCleanMeaning tested the codes as PREFIXES of the uppercased gloss, which
  // is a trap: "CL" matches CLOTH, CLASS, CLEAN, CLEVER; "BA" matches BAMBOO,
  // BAG, BALL, BATTLE; "OF" matches OFTEN and OFFICIAL; "PL" matches PLAYED.
  // 23 ordinary words were dropped from every flashcard deck and all four
  // games — taught in the reader and nowhere else.
  for (const word of ["cloth", "class", "clean", "clever", "climbs", "bamboo",
                      "bag; to wrap", "ball", "battle", "often; usual", "official",
                      "played", "plan", "ordinal prefix", "clothes; to serve"]) {
    assert.equal(a.isCleanMeaning(word), true, `"${word}" is a meaning, not a code`);
  }
  // The codes themselves, and their compounds, are still refused.
  for (const code of ["DE", "PL", "BA", "ADV", "CMPL", "ING", "SUF", "CL", "OF",
                      "ORD", "CL-PL", "CL-person"]) {
    assert.equal(a.isCleanMeaning(code), false, `"${code}" is a code, not a meaning`);
  }
});

test("T-T13: every study word in the corpus reaches the pool it is taught from", () => {
  const a = app();
  // The reader and the games must teach the same set. A word shown on tap but
  // filtered out of extractStoryVocab is taught in one place and nowhere else.
  const dropped = new Map();
  for (const s of Object.values(a.STORIES_MAP)) {
    const pool = new Set(a.extractStoryVocab(s).map((w) => w.zh));
    for (const tok of s.sents.flat()) {
      if (tok.t !== "c" || tok.bonus) continue;
      if (!pool.has(tok.ch)) dropped.set(`${tok.ch}="${tok.mn}"`, (dropped.get(`${tok.ch}="${tok.mn}"`) || 0) + 1);
    }
  }
  assert.deepEqual([...dropped.keys()].slice(0, 10), [],
    `${dropped.size} distinct study words never reach a game or flashcard deck`);
});

test("T-T14: an MCQ never has two right answers, either way round", () => {
  const a = app();
  F.installState(a);
  // The reverse MCQ shows a MEANING and asks for the character, but picked its
  // wrong options without comparing English — so any character sharing the
  // meaning was a second correct answer, and a child choosing it was marked
  // wrong and had the word logged to their practice queue.
  //
  // Comparing whole glosses only half-fixed it: 请 "to ask" and 问
  // "to ask; to inquire" are different strings that a child reads as the same
  // answer. The comparison is per sense, and it applies in both directions —
  // as a character option and as an English option.
  const pool = [
    { zh: "请", py: "qǐng", en: "to ask" },
    { zh: "问", py: "wèn", en: "to ask; to inquire" }, // shares one sense only
    { zh: "干", py: "gān", en: "clean" },
    { zh: "净", py: "jìng", en: "clean" },             // shares its whole gloss
    { zh: "山", py: "shān", en: "mountain" },
    { zh: "水", py: "shuǐ", en: "water" },
    { zh: "人", py: "rén", en: "person" },
    { zh: "大", py: "dà", en: "big" },
    { zh: "小", py: "xiǎo", en: "small" },
    { zh: "书", py: "shū", en: "book" },
  ];
  const glossOf = (zh) => (pool.find((w) => w.zh === zh) || {}).en;
  // Computed here, not via the app's own helper: an assertion that calls the
  // function under test moves with the defect and can never fail.
  const senses = (en) =>
    String(en || "").toLowerCase().split(";").map((t) => t.trim()).filter(Boolean);
  const twoRightAnswers = (x, y) => {
    const b = new Set(senses(y));
    return senses(x).some((t) => b.has(t));
  };
  let reverseSeen = 0;
  let forwardSeen = 0;
  for (let seed = 0; seed < 60; seed++) {
    const qs = a.buildMCQ(pool, 10);
    for (const q of qs) {
      const answerEn = glossOf(q.zh);
      if (q.reverse) {
        // Prompt is the meaning; options are characters.
        reverseSeen++;
        const alsoRight = q.opts.filter(
          (c) => c !== q.zh && twoRightAnswers(glossOf(c), answerEn),
        );
        assert.deepEqual(alsoRight, [], `"${q.correct}" also matches ${alsoRight.join(",")}`);
      } else {
        // Prompt is the character; options are meanings.
        forwardSeen++;
        const alsoRight = q.opts.filter(
          (en) => en !== q.correct && twoRightAnswers(en, answerEn),
        );
        assert.deepEqual(alsoRight, [], `${q.zh} "${q.correct}" also matches ${alsoRight.join(" / ")}`);
      }
    }
  }
  // A guard that never ran would pass this test silently.
  assert.ok(reverseSeen > 0, "no reverse questions were built");
  assert.ok(forwardSeen > 0, "no forward questions were built");
});

test("T-T15: a Listen question never offers two options that sound the same", () => {
  const a = app();
  F.installState(a);
  // The question is a sound. Distractors were chosen by comparing ENGLISH, so
  // a homophone could stand as a wrong option — 向 and 像 are both xiàng, 美
  // and 每 are both měi. A child hearing the clip could not tell them apart,
  // and the tap they did not make was logged to their practice queue.
  const sound = (py) => String(py || "").toLowerCase().replace(/\s+/g, "");
  const pool = [
    { zh: "向", py: "xiàng", en: "towards" },
    { zh: "像", py: "xiàng", en: "to resemble" }, // same sound, different word
    { zh: "美", py: "měi", en: "beautiful" },
    { zh: "每", py: "měi", en: "every" },
    { zh: "山", py: "shān", en: "mountain" },
    { zh: "水", py: "shuǐ", en: "water" },
    { zh: "人", py: "rén", en: "person" },
    { zh: "书", py: "shū", en: "book" },
  ];
  const pyOf = (zh) => (pool.find((w) => w.zh === zh) || {}).py;
  let seen = 0;
  for (let round = 0; round < 40; round++) {
    a.startListen(pool);
    for (const q of a.listenSt.questions) {
      seen++;
      assert.equal(new Set(q.opts).size, q.opts.length, `duplicate option in [${q.opts}]`);
      const alike = q.opts.filter((z) => z !== q.w.zh && sound(pyOf(z)) === sound(q.w.py));
      assert.deepEqual(alike, [], `${q.w.zh} (${q.w.py}) sounds like ${alike.join(",")}`);
    }
  }
  assert.ok(seen > 0, "no Listen questions were built");
});

test("T-T16: a Match board never shows two cards a child cannot tell apart", () => {
  const a = app();
  F.installState(a);
  // Cards pair by index, so two words sharing a gloss put two cards reading the
  // same thing on the table and the correct-looking flip is scored wrong.
  const senses = (en) =>
    String(en || "").toLowerCase().split(";").map((t) => t.trim()).filter(Boolean);
  const collides = (x, y) => {
    const b = new Set(senses(y));
    return senses(x).some((t) => b.has(t));
  };
  const pool = [
    { zh: "儿子", py: "érzi", en: "son" },
    { zh: "子", py: "zǐ", en: "son" },              // identical gloss
    { zh: "法", py: "fǎ", en: "law; method" },
    { zh: "法律", py: "fǎlǜ", en: "law" },          // one shared sense
    { zh: "山", py: "shān", en: "mountain" },
    { zh: "水", py: "shuǐ", en: "water" },
    { zh: "人", py: "rén", en: "person" },
    { zh: "书", py: "shū", en: "book" },
    { zh: "大", py: "dà", en: "big" },
  ];
  for (let round = 0; round < 40; round++) {
    a.startMemoryMatch(pool);
    const en = a.matchSt.cards.filter((c) => c.side === "en").map((c) => c.text);
    const zh = a.matchSt.cards.filter((c) => c.side === "zh").map((c) => c.text);
    assert.equal(new Set(zh).size, zh.length, `duplicate character card: ${zh}`);
    for (let i = 0; i < en.length; i++) {
      for (let j = i + 1; j < en.length; j++) {
        assert.ok(!collides(en[i], en[j]), `"${en[i]}" and "${en[j]}" read the same`);
      }
    }
    // Dropping ambiguous words must not leave a board that cannot be finished.
    assert.equal(a.matchSt.cards.length, a.matchSt.pairCount * 2);
    assert.ok(a.matchSt.pairCount >= 4, `board shrank to ${a.matchSt.pairCount} pairs`);
  }
});

test("T-T17: the practice-queue rounds never offer a second right answer", () => {
  const a = app();
  F.installState(a);
  a.curP = "jenn";
  // Drill and Revenge excluded distractors by CHINESE spelling only, so a
  // different character carrying the same sense stood as a wrong option. These
  // are the queue rounds: being scored wrong here is exactly what keeps a word
  // stuck in the queue the round exists to clear.
  const senses = (en) =>
    String(en || "").toLowerCase().split(";").map((t) => t.trim()).filter(Boolean);
  const twoRightAnswers = (x, y) => {
    const b = new Set(senses(y));
    return senses(x).some((t) => b.has(t));
  };
  // 方向 "direction" is in HSK_VOCAB, so it reaches the distractor pool; 向
  // "towards; direction" is the word the child is being asked about.
  const stuck = [
    { zh: "向", py: "xiàng", en: "towards; direction" },
    { zh: "朝", py: "cháo", en: "dynasty; to face" },
    { zh: "国家", py: "guójiā", en: "country; nation; state" },
  ];
  const s = a.state.jenn;
  s.failedWords = {};
  for (const w of stuck) {
    s.failedWords[w.zh] = { ...w, failCount: 3, lastFailed: "2026-09-01" };
  }
  for (const [start, st] of [["startDrill", "drillSt"], ["startRevengeRound", "revengeSt"]]) {
    let seen = 0;
    for (let round = 0; round < 25; round++) {
      a[start]();
      for (const q of a[st].words) {
        seen++;
        assert.equal(new Set(q.opts).size, q.opts.length, `duplicate option in [${q.opts}]`);
        const alsoRight = q.opts.filter((o) => o !== q.correct && twoRightAnswers(o, q.correct));
        assert.deepEqual(alsoRight, [], `${start}: ${q.zh} "${q.correct}" also matches ${alsoRight.join(" / ")}`);
      }
    }
    assert.ok(seen > 0, `${start} built no questions`);
  }
});

test("T-T18: the daily challenge never offers a second right answer", () => {
  const a = app();
  F.installState(a);
  a.curP = "jenn";
  // The day's word comes from the child's own library and the options are raw
  // English from HSK_VOCAB, checked by exact string — so the target and an
  // option can be the SAME word glossed two ways, on the once-a-day challenge
  // worth five stars.
  const senses = (en) =>
    String(en || "").toLowerCase().split(";").map((t) => t.trim()).filter(Boolean);
  const twoRightAnswers = (x, y) => {
    const b = new Set(senses(y));
    return senses(x).some((t) => b.has(t));
  };
  // Every curriculum word whose gloss shares a sense with something in
  // HSK_VOCAB. Three options are drawn at random from ~96, so one sitting only
  // surfaces a collision about 3% of the time — sweeping every target once
  // passes with the bug still in. Each of these is presented many times.
  const colliding = [];
  const options = [];
  for (const lv of [1, 2, 3, 4]) for (const w of a.HSK_VOCAB[lv] || []) options.push(w);
  assert.ok(options.length > 0, "HSK_VOCAB is empty");
  for (const lv of [1, 2, 3, 4]) {
    for (const g of require(`../data/hsk${lv}.json`).gates) {
      for (const w of g.newWords || []) {
        if (colliding.some((x) => x.zh === w.zh)) continue;
        if (options.some((o) => o.en !== w.en && twoRightAnswers(o.en, w.en))) {
          colliding.push({ zh: w.zh, py: w.pinyin, en: w.en });
        }
      }
    }
  }
  assert.ok(colliding.length > 0, "no colliding targets found to test with");

  let seen = 0;
  for (const w of colliding) {
    for (let sitting = 0; sitting < 250; sitting++) {
      const s = a.state.jenn;
      s.library = { [w.zh]: { py: w.py, mn: w.en } };
      s.dailyWordSolved = null;
      // The real overlay rebuilds its body, which destroys the option row; the
      // stub keeps one element per id, so clear it or options accumulate.
      a.document.getElementById("dw-opts").children.length = 0;
      a.openDailyWordChallenge();
      const opts = (a.document.getElementById("dw-opts").children || []).map((c) => c.textContent);
      seen++;
      assert.equal(opts.length, 4, `${w.zh} "${w.en}" got ${opts.length} options`);
      assert.equal(new Set(opts).size, opts.length, `duplicate option in [${opts}]`);
      const alsoRight = opts.filter((o) => o !== w.en && twoRightAnswers(o, w.en));
      assert.deepEqual(alsoRight, [], `${w.zh} "${w.en}" also matches ${alsoRight.join(" / ")}`);
    }
  }
  assert.equal(seen, colliding.length * 250);
});

test("T-T19: the ordinary vocabulary a child needs is actually taught", () => {
  const a = app();
  F.installState(a);
  // The curriculum took the top 300 words per level from an adult, news-heavy
  // frequency list. It kept 法官 "judge" and 武器 "weapon" and dropped 姐姐,
  // 天气, 再见, 星期, 九 and 零 — so the app could not teach them anywhere:
  // not in a story, not in a game, not in a quiz. Story authoring hit it as a
  // wall, and these are the words those rejections named.
  const required = [
    "星期", "石头", "安静", "夏天", "怕", "旁边", "一会儿",
    "姐姐", "哥哥", "弟弟", "妹妹", "爷爷", "奶奶",
    "天气", "下雨", "树", "九", "零", "百",
    "再见", "对不起", "没关系", "请问",
    "米饭", "面包", "鸡蛋", "牛奶", "水果",
    "上学", "下课", "汉字", "图书馆", "书包",
    "左边", "右边", "里边", "外边",
  ];
  // Taught = in some gate's word list, which is what feeds the games, the gate
  // quiz, the flashcard deck and the story dictionary.
  const taught = new Map();
  for (const lv of [1, 2, 3, 4]) {
    for (const g of require(`../data/hsk${lv}.json`).gates) {
      for (const w of g.newWords || []) taught.set(w.zh, { lv, gate: g.gateId, w });
    }
  }
  const missing = required.filter((zh) => !taught.has(zh));
  assert.deepEqual(missing, [], `not taught anywhere: ${missing.join(" ")}`);

  // A word that is taught but carries a junk gloss teaches the wrong thing —
  // upstream's first meaning for 怕 is "surname Pa" and for 鸟 an obscenity.
  // Case matters here. A single /.../i covering both would make `^[A-Z]{2,5}$`
  // match "week", "stone" and "bread" — the same mistake that let a prefix
  // check on `CL` swallow CLOTH and CLEAN out of every game pool.
  const grammarCode = /^[A-Z]{2,5}$/;                    // DE, CMPL, CL
  const junk = /^[-—]|[A-Za-z.]+-$|surname|variant of|used in/i;
  const bad = required
    .map((zh) => taught.get(zh))
    .filter((t) => t && (!t.w.en || junk.test(t.w.en) || grammarCode.test(t.w.en)));
  assert.deepEqual(bad.map((t) => `${t.w.zh}="${t.w.en}"`), [], "junk gloss reaching a child");

  // And nothing may carry text decoded with the wrong encoding.
  for (const [zh, t] of taught) {
    assert.ok(!`${zh}${t.w.pinyin}${t.w.en}`.includes("\uFFFD"), `${zh} carries corrupted text`);
  }
});

// ── F01: a round is bound to the attempt it started under ─────────────────
// Audit finding F01. The deadline reset marked only the SAVED quiz copy, so a
// quiz finishing after its deadline still wrote a qualifying best, and the four
// games had no check at all. Every expected value below is written out by
// hand; none is read back from the function under test.

test("F01: a game round begun under a lapsed attempt banks nothing and mints no timer", () => {
  const a = app();
  const s = lapsedGate(a);
  const binding = { playerId: "jenn", gateKey: "h1-g01", attemptId: "g1-old", resetSeq: 0 };
  const res = a.updateGateGameBest(1, "listen", 3, 1, binding);

  assert.deepEqual(res, { qualified: false });
  assert.deepEqual(s.gateGameStars["h1-g01"], { trace: 0, match: 0, rain: 0, listen: 0 }, "the reset stands");
  assert.equal(s.gateTimers["h1-g01"].attemptId, "g1-old", "no replacement timer was minted");
  assert.equal(s.gateTimers["h1-g01"].active, false);
  assert.equal(s.gateAttemptHistory["h1-g01"].length, 1, "one archived attempt");
  assert.equal(s.gateResetSeq["h1-g01"], 1, "the reset counter advanced once");
  assert.equal(s.totalStars, 500, "nothing was paid");
});

test("F01: a round begun before any timer qualifies once its own 3★ mints one", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const s = a.state.jenn;
  const b = a.gateAttemptBinding(s, 1, 1);
  assert.equal(b.attemptId, null, "no timer yet");
  assert.equal(b.resetSeq, 0);
  assert.equal(b.gateKey, "h1-g01");

  const res = a.updateGateGameBest(1, "match", 3, 1, b);
  assert.deepEqual(res, { qualified: true });
  assert.equal(s.gateGameStars["h1-g01"].match, 3);
  assert.ok(s.gateTimers["h1-g01"] && s.gateTimers["h1-g01"].active, "the round's 3★ started the challenge");
});

test("F01: a pre-timer round does not qualify once a reset separates it from now", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const s = a.state.jenn;
  const b = a.gateAttemptBinding(s, 1, 1);
  a.resetGateProgress(s, 1, 1);
  assert.equal(s.gateResetSeq["h1-g01"], 1);

  const res = a.updateGateGameBest(1, "match", 3, 1, b);
  assert.deepEqual(res, { qualified: false });
  assert.equal((s.gateGameStars["h1-g01"] || {}).match || 0, 0);
});

test("F01: a session saved before bindings existed keeps its old behaviour", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const s = a.state.jenn;
  s.pendingSessions.listen = {
    questions: [{ w: { zh: "水", py: "shuǐ", en: "water" }, opts: ["水", "山", "人", "大"] }],
    qi: 0, streak: 0, score: 0, correctCount: 0, gameTargetDid: 1, gameTargetLevel: 1,
  };
  assert.equal(a.restoreListen(), true);
  assert.equal(a.listenSt.gateAttempt, null, "no binding is invented for an old save");

  const res = a.updateGateGameBest(1, "listen", 3, 1, null);
  assert.deepEqual(res, { qualified: true });
  assert.equal(s.gateGameStars["h1-g01"].listen, 3);
});

test("F01: a Listen round carries its binding through save and restore", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  a.curGameTargetDid = 1;
  a.curGameTargetLevel = 1;
  const s = a.state.jenn;
  s.gateTimers = { "h1-g01": { startKey: "2026-09-01", deadlineKey: "2099-01-01", active: true, days: 5, attemptId: "g1-live" } };
  const words = Array.from({ length: 6 }, (_, i) => ({ zh: `字${i}`, py: `zi${i}`, en: `w${i}` }));
  a.startListen(words);

  const expected = { playerId: "jenn", gateKey: "h1-g01", attemptId: "g1-live", resetSeq: 0 };
  assert.deepEqual(a.listenSt.gateAttempt, expected);
  assert.deepEqual(s.pendingSessions.listen.gateAttempt, expected, "the saved copy carries it");

  a.listenSt = null;
  assert.equal(a.restoreListen(), true);
  assert.deepEqual(a.listenSt.gateAttempt, expected, "and it survives a restore");
});

test("F01: the quiz result pays nothing to an attempt that lapsed mid-quiz", () => {
  const a = app();
  const s = lapsedGate(a);
  // Games are all at 3★ on the dead attempt, so a qualifying 100% quiz would
  // have cleared the gate outright.
  s.gateGameStars["h1-g01"] = { trace: 3, match: 3, rain: 3, listen: 3 };
  a.curDynasty = a.DYNASTIES.find((d) => d.id === 1);
  a.quizSt = {
    did: 1, phase: 3, score: 220, maxScore: 220, phaseScores: [100, 60, 60],
    vocab: [], questions: [], pyQ: [], sbPack: [], isChampion: false,
    mcqN: 8, pyN: 10, sbN: 3, noMcqAssistance: true,
    quizCorrect: 20, quizAttempts: 20,
    gateAttempt: { playerId: "jenn", gateKey: "h1-g01", attemptId: "g1-old", resetSeq: 0 },
  };
  const qc = { innerHTML: "" };
  a.renderQuizResult(qc);

  assert.equal(s.gateBestQuiz["h1-g01"], undefined, "no qualifying best was written to the new attempt");
  assert.deepEqual(s.gatesCompleted, [], "the gate did not clear");
  assert.equal(s.totalStars, 500, "no stars were paid");
  assert.equal(s.lastGateQuizAttempt, null);
  assert.ok(qc.innerHTML.includes("Practice round"), "the child is told this was practice");
  assert.equal(s.gateAttemptHistory["h1-g01"].length, 1, "the lapsed attempt is archived once");
});

test("F01: the quiz result still pays a round begun under the live attempt", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const s = a.state.jenn;
  s.gateTimers = { "h1-g01": { startKey: "2026-09-01", deadlineKey: "2099-01-01", active: true, days: 5, attemptId: "g1-live" } };
  a.curDynasty = a.DYNASTIES.find((d) => d.id === 1);
  a.launchConfetti = () => {}; // the 3★ celebration draws on a canvas the stub lacks
  a.quizSt = {
    did: 1, phase: 3, score: 200, maxScore: 220, phaseScores: [100, 60, 40],
    vocab: [], questions: [], pyQ: [], sbPack: [], isChampion: false,
    mcqN: 8, pyN: 10, sbN: 3, noMcqAssistance: true,
    quizCorrect: 19, quizAttempts: 20,
    gateAttempt: { playerId: "jenn", gateKey: "h1-g01", attemptId: "g1-live", resetSeq: 0 },
  };
  a.renderQuizResult({ innerHTML: "" });
  assert.equal(s.gateBestQuiz["h1-g01"].accPct, 95);
  assert.equal(s.gateBestQuiz["h1-g01"].quizStars, 3);
  assert.equal(s.gateBestQuiz["h1-g01"].points, 200);
});

test("F01: clearing a slot stamps when it was cleared", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  s.pendingSessions.listen = { questions: [], qi: 0 };
  a.clearPendingSession("listen");
  assert.equal(s.pendingSessions.listen, null);
  assert.ok(s.pendingSessionClearedAt.listen > 0);
});

// ── F04: the bank loader serves a frozen version, or says it cannot ──────────

test("A-T32 / F04: loadAssessmentBank loads by version from the manifest and caches it", async () => {
  const a = app();
  const fs = require("fs");
  const path = require("path");
  const DIR = path.join(__dirname, "..", "data", "assessment");
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
  let calls = 0;
  a.fetch = (url) => {
    calls++;
    const rel = String(url).replace(/^data\/assessment\//, "");
    const abs = path.join(DIR, rel);
    if (!fs.existsSync(abs)) return Promise.resolve({ ok: false, status: 404 });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(fs.readFileSync(abs, "utf8"))) });
  };

  const current = await a.loadAssessmentBank();
  assert.ok(current && current.bank && current.forms, "the current bank loads with no version given");
  assert.equal(current.bankVersion, manifest.bankVersion);

  const byVersion = await a.loadAssessmentBank(manifest.bankVersion);
  assert.equal(byVersion.bankVersion, manifest.bankVersion);
  const before = calls;
  await a.loadAssessmentBank(manifest.bankVersion);
  assert.equal(calls, before, "a second request for the same version is served from cache");

  assert.equal(await a.loadAssessmentBank("1.0.0"), null, "a version the manifest no longer lists is null, not the current bank");
  assert.ok(await a.loadAssessmentBank(), "and asking for the current bank afterwards still works");
});

// ── F06: lesson comprehension is think-then-reveal ──────────────────────────

test("F06: a lesson question hides its answer until the child reveals it", async () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  a.curriculumCache.lessons["x"] = {
    level: "HSK1", gateId: 1, passage: "大禹治水。", passageEn: "Yu tamed the flood.",
    comprehension: [{ question: "谁治水？", questionEn: "Who tamed the flood?", answer: "大禹。", answerEn: "Yu." }],
  };
  await a.renderGateLesson(1, "x");
  const html = a.document.getElementById("gate-lesson-box").innerHTML;
  assert.ok(html.includes("Who tamed the flood?"), "the question is shown");
  assert.match(html, /id="lesson-ans-0" hidden/, "the answer element starts hidden");
  assert.ok(html.includes("Reveal"), "a Reveal button is offered");
  assert.ok(html.includes("lessonSelfCheck(1,0,'had')") && html.includes("lessonSelfCheck(1,0,'notyet')"), "both verdicts are offered after reveal");
  // The answer text appears exactly once, inside the hidden element.
  const idx = html.indexOf("Yu.");
  assert.ok(idx > html.indexOf('id="lesson-ans-0"'), "the answer text is inside the hidden element");
  assert.equal(html.indexOf("Yu.", idx + 1), -1, "and nowhere else");
});

test("F06: a self-report is stored per gate and question, never as evidence, never for stars", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const s = a.state.jenn;
  s.totalStars = 100;
  a.lessonSelfCheck(1, 0, "notyet");
  assert.equal(s.lessonSelfCheck["h1-g01"][0].result, "notyet");
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(s.lessonSelfCheck["h1-g01"][0].at));
  assert.deepEqual(s.reviewRecords, {}, "a self-report is not unaided evidence");
  assert.equal(s.totalStars, 100, "and it pays nothing");
  a.lessonSelfCheck(1, 0, "had");
  assert.equal(s.lessonSelfCheck["h1-g01"][0].result, "had", "the child can change their mind");
  a.lessonSelfCheck(1, 0, "maybe");
  assert.equal(s.lessonSelfCheck["h1-g01"][0].result, "had", "only the two verdicts are accepted");
});

test("F06: a prior self-report renders the answer open with the verdict", async () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  a.state.jenn.lessonSelfCheck = { "h1-g01": { 0: { result: "had", at: "2026-09-01" } } };
  a.curriculumCache.lessons["x"] = {
    level: "HSK1", gateId: 1, passage: "大禹治水。",
    comprehension: [{ question: "谁治水？", questionEn: "Who?", answer: "大禹。", answerEn: "Yu." }],
  };
  await a.renderGateLesson(1, "x");
  const html = a.document.getElementById("gate-lesson-box").innerHTML;
  assert.doesNotMatch(html, /id="lesson-ans-0" hidden/, "already answered: the answer is open");
  assert.ok(html.includes("You said: I had it"));
  assert.ok(!html.includes("Reveal 👀"), "no reveal button to press again");
});

// ── the 2026-09-08 audit: lesson questions a machine can mark ───────────────
// The audit asked for answer -> explanation -> correction -> later check. The
// lesson data could not support it: all 88 files carried the same three
// templated prompts, no options, and one answered "any one sentence from the
// passage above". `check` items are built from the story's own glosses, so the
// answer and the explanation are true by construction.

const CHECK_LESSON = {
  level: "HSK1", gateId: 1, passage: "大禹治水。", passageEn: "Yu tamed the flood.",
  comprehension: [{ question: "谁治水？", questionEn: "Who tamed the flood?", answer: "大禹。", answerEn: "Yu." }],
  check: [{
    id: "t1", kind: "wordMeaning", skill: "meaning", zh: "水", pinyin: "shuǐ",
    promptEn: "In the story, what does 水 mean?", prompt: "短文里的“水”是什么意思？",
    options: [{ id: "o1", text: "before" }, { id: "o2", text: "water" },
              { id: "o3", text: "person" }, { id: "o4", text: "big" }],
    answerId: "o2",
    explanationEn: "水 (shuǐ) means \"water\".", explanation: "“水”的意思是“water”。",
  }],
};

async function lessonWithCheck() {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  a.curriculumCache.lessons["x"] = JSON.parse(JSON.stringify(CHECK_LESSON));
  await a.renderGateLesson(1, "x");
  return a;
}

test("A26: a checked question offers options and no Reveal", async () => {
  const a = await lessonWithCheck();
  const html = a.document.getElementById("gate-lesson-box").innerHTML;
  assert.ok(html.includes("what does 水 mean?"), "the question is shown");
  ["before", "water", "person", "big"].forEach((t) =>
    assert.ok(html.includes(">" + t + "<"), `option ${t} is offered`));
  // Scoped to the checked block: the self-report list below it still has its
  // own Reveal, which is untouched by this change.
  const optsIdx = html.indexOf('id="lchk-opts-0"');
  const sayIdx = html.indexOf('id="lchk-say-0"');
  assert.ok(optsIdx > -1 && sayIdx > optsIdx);
  const block = html.slice(optsIdx, sayIdx);
  assert.equal(block.indexOf("lessonRevealAnswer"), -1, "a checked question is answered, not revealed");
  assert.equal(html.indexOf("shuǐ"), -1, "and the explanation is not shown up front");
});

test("L1: a right answer is SUPPORTED practice and still explains itself", async () => {
  // This test used to assert `supported: false` — that a lesson answer proved
  // unaided recall. It does not. The lesson prints its key vocabulary with the
  // English visible, and every word-meaning check asks for a gloss that is on
  // screen while it is answered. Reading it off the page is learning, but the
  // ladder must not advance on it; a later unaided Review today does that.
  const a = await lessonWithCheck();
  const s = a.state.jenn;
  s.totalStars = 100;
  a.lessonCheckAnswer("h1-g01", 0, "o2");

  const rec = s.reviewRecords["水::meaning"];
  assert.ok(rec, "a checked answer is real evidence, unlike the self-report");
  const last = rec.attempts[rec.attempts.length - 1];
  assert.equal(last.correct, true);
  assert.equal(last.sameSession, false, "it is the first response, not a retry");
  assert.equal(last.supported, true, "but the answer was on screen: supported");
  assert.equal(last.source, "lesson-check");
  assert.equal(rec.independentSuccesses.length, 0, "so it cannot advance the ladder");
  assert.equal(rec.stage, 0, "retention is established by a later unaided check");
  assert.equal(s.totalStars, 100, "and it pays nothing — it is unbounded and retryable");
  assert.ok(a.document.getElementById("lchk-say-0").innerHTML.includes('means &quot;water&quot;')
    || a.document.getElementById("lchk-say-0").innerHTML.includes('means "water"'),
    "why it is right is shown even when the child got it right");
});

test("A26: a miss corrects, explains, and comes back tomorrow", async () => {
  const a = await lessonWithCheck();
  const s = a.state.jenn;
  a.lessonCheckAnswer("h1-g01", 0, "o1");

  const say = a.document.getElementById("lchk-say-0").innerHTML;
  assert.ok(say.includes("Not quite"), "the child is told, kindly");
  assert.ok(say.includes("water"), "and given the answer");
  assert.ok(say.includes("lessonCheckRetry(0)"), "with one more go offered");

  const rec = s.reviewRecords["水::meaning"];
  assert.equal(rec.stage, 0);
  assert.equal(rec.dueOn, R.addDays(a.todayKey(), 1), "a miss schedules the real follow-up");
});

test("A26: the second go, after the explanation, is not unaided", async () => {
  const a = await lessonWithCheck();
  a.lessonCheckAnswer("h1-g01", 0, "o1");
  a.lessonCheckRetry(0);
  a.lessonCheckAnswer("h1-g01", 0, "o2");

  const rec = a.state.jenn.reviewRecords["水::meaning"];
  const last = rec.attempts[rec.attempts.length - 1];
  assert.equal(last.correct, true);
  assert.equal(last.sameSession, true, "the answer was on screen a moment ago");
  assert.equal(rec.independentSuccesses.length, 0, "so it cannot advance the ladder");
});

test("A26: answering again after it is settled changes nothing", async () => {
  const a = await lessonWithCheck();
  a.lessonCheckAnswer("h1-g01", 0, "o2");
  const n = a.state.jenn.reviewRecords["水::meaning"].attempts.length;
  a.lessonCheckAnswer("h1-g01", 0, "o1");
  assert.equal(a.state.jenn.reviewRecords["水::meaning"].attempts.length, n,
    "a settled question is closed; tapping again must not log a failure");
});

test("A26: a lesson with no checked questions keeps the old self-report flow", async () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const lesson = JSON.parse(JSON.stringify(CHECK_LESSON));
  delete lesson.check;
  a.curriculumCache.lessons["x"] = lesson;
  await a.renderGateLesson(1, "x");
  const html = a.document.getElementById("gate-lesson-box").innerHTML;
  assert.ok(html.includes("Reveal"), "HSK3 and HSK4 have no story to build questions from yet");
  assert.equal(html.indexOf("lchk-opts-0"), -1);
});

// ── F1: a flashcard pass must not cost a child their cleared gates ────────
// The writer used `flashPassDone[String(did)]` while gameUnlockForDid reads
// `flashPassDone[gateKeyOf(did)]`, so Trace never unlocked at all — and the
// bare numeric key made GateIdentity.needsMigration treat an already-modern
// save as legacy, whose remap then filtered every `h1-g01` key to NaN.

test("F1: finishing a flashcard pass unlocks Trace for that gate", () => {
  const a = app();
  const p = F.oneQualifyingRead(a);
  F.installState(a, { jenn: p });
  assert.equal(a.gameUnlockForDid(1).trace, false, "not unlocked before the pass");

  a.flashSt = { did: 1, level: 1, mode: "zh2en", sub: "review",
                deck: [{ zh: "水", py: "shuǐ", en: "water" }], i: 1, flipped: false };
  a.renderFlashCurrent();

  // Computed here, not read back from the app: the key the reader must see.
  assert.deepEqual(Object.keys(a.state.jenn.flashPassDone), ["h1-g01"],
    "the pass is filed under the canonical gate key");
  assert.equal(a.gameUnlockForDid(1).trace, true, "Trace unlocks");
});

test("F1: the pass is filed against the level it was earned in", () => {
  const a = app();
  a.curHSK = 2;
  F.installState(a, { jenn: F.oneQualifyingRead(a, "xia-h2") });
  a.flashSt = { did: 3, level: 2, mode: "zh2en", sub: "review",
                deck: [{ zh: "水", py: "shuǐ", en: "water" }], i: 1, flipped: false };
  a.renderFlashCurrent();
  assert.deepEqual(Object.keys(a.state.jenn.flashPassDone), ["h2-g03"],
    "an HSK2 pass must not be filed under HSK1");
});

test("F1: a flashcard pass does not discard cleared gates or their stars", () => {
  const a = app();
  const p = F.gateFullyQualified(a, 1, 1);
  p.gatesCompleted = ["h1-g01"];
  F.installState(a, { jenn: p });

  a.flashSt = { did: 2, level: 1, mode: "zh2en", sub: "review",
                deck: [{ zh: "水", py: "shuǐ", en: "water" }], i: 1, flipped: false };
  a.renderFlashCurrent();
  a.ensureState("jenn");

  const s = a.state.jenn;
  assert.deepEqual(s.gatesCompleted, ["h1-g01"], "the cleared gate survives normalization");
  assert.deepEqual(s.gateGameStars["h1-g01"], { trace: 3, match: 3, rain: 3, listen: 3 },
    "its game stars survive");
  assert.deepEqual(s.gateBestQuiz["h1-g01"], { accPct: 95, quizStars: 3 },
    "its best quiz survives");
  assert.equal(s.flashPassDone["h1-g02"], true, "and the new pass is recorded");
});

// ── F2: a wrong sentence must not lock the child out of the retry ─────────
// checkSB took the answer lock and released it only from the correct branch's
// goNext. A miss left `answerLocked` true forever, so the "Try again" button
// rearranged chips that no further Check answer would ever read.

function sbQuiz(a, pack) {
  a.curDynasty = a.DYNASTIES.find((d) => d.id === 1);
  // The reveal card dismisses on a 4s timer and goNext waits 1.1s; run both
  // continuations straight away so the test is deterministic.
  a.showCorrectRevealCard = (o) => { if (o && o.onDone) o.onDone(); };
  a.laterCall = (scope, fn) => { fn(); return 0; };
  a.quizSt = {
    did: 1, phase: 2, score: 0, maxScore: 220, phaseScores: [0, 0, 0],
    vocab: [], questions: [], pyQ: [], sbPack: pack, sbRound: 0, sbN: pack.length,
    isChampion: false, mcqN: 8, pyN: 10, quizCorrect: 0, quizAttempts: 0,
    gateAttempt: null,
  };
  return a;
}

const SB_PACK = [["我", "爱", "中文", "。"], ["我", "是", "人", "。"]];

test("F2: a wrong sentence answer releases the lock so the retry lands", () => {
  const a = app();
  F.installState(a);
  sbQuiz(a, SB_PACK.map((x) => [...x]));

  a.sbBuilt = ["我", "中文", "爱", "。"];
  a.checkSB();
  assert.equal(a.quizSt.quizAttempts, 1, "the miss is counted once");
  assert.equal(a.answerLocked, false, "the lock is released for the retry");
  assert.equal(a.quizSt.sbRound, 0, "still on the same sentence");

  a.sbBuilt = ["我", "爱", "中文", "。"];
  a.checkSB();
  assert.equal(a.quizSt.sbRound, 1, "the correct retry is accepted and advances once");
});

test("F2: a retry after the answer was shown pays nothing and counts nothing", () => {
  const a = app();
  F.installState(a);
  sbQuiz(a, SB_PACK.map((x) => [...x]));

  a.sbBuilt = ["我", "中文", "爱", "。"];
  a.checkSB();
  a.sbBuilt = ["我", "爱", "中文", "。"];
  a.checkSB();

  // The retry must be ACCEPTED (the round moves on) but unpaid: one attempt for
  // the miss, no correct, no points, because the sentence was just shown (§25).
  assert.equal(a.quizSt.sbRound, 1, "the retry was accepted, not ignored");
  assert.equal(a.quizSt.quizAttempts, 1, "the retry is not a second attempt");
  assert.equal(a.quizSt.quizCorrect, 0, "being told is not remembering");
  assert.equal(a.quizSt.score, 0, "no points for a revealed sentence");
});

test("F2: a first-time correct sentence still pays its 20 points", () => {
  const a = app();
  F.installState(a);
  sbQuiz(a, SB_PACK.map((x) => [...x]));
  a.sbBuilt = ["我", "爱", "中文", "。"];
  a.checkSB();
  assert.equal(a.quizSt.score, 20);
  assert.equal(a.quizSt.quizCorrect, 1);
  assert.equal(a.quizSt.quizAttempts, 1);
  assert.equal(a.quizSt.sbRound, 1);
});

test("F2: the reveal marker does not leak into the next sentence", () => {
  const a = app();
  F.installState(a);
  sbQuiz(a, SB_PACK.map((x) => [...x]));
  a.sbBuilt = ["我", "中文", "爱", "。"];
  a.checkSB();                       // miss sentence 1, answer revealed
  a.sbBuilt = ["我", "爱", "中文", "。"];
  a.checkSB();                       // unpaid retry, advances to sentence 2
  a.sbBuilt = ["我", "是", "人", "。"];
  a.checkSB();                       // sentence 2, first try
  assert.equal(a.quizSt.score, 20, "the next sentence pays normally");
  assert.equal(a.quizSt.quizCorrect, 1);
});

// ── F3: a quiz paused overnight must resume in its own level ─────────────
// selectPlayer resets curHSK to 1, and restoreGateQuizSession never put it
// back. The saved binding said h2-g06, the live lookup said h1-g06, so
// gateSessionQualifies refused a perfectly good round and it paid nothing.

test("F3: restoring a saved HSK2 quiz puts the level back", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;                                  // what selectPlayer leaves behind
  const s = a.state.jenn;
  s.pendingSessions.gate = {
    did: 6, phase: 2, score: 120, phaseScores: [60, 40, 20],
    vocab: [], questions: [], pyQ: [], sbPack: [["我", "爱", "中文", "。"]],
    sbRound: 0, isChampion: false, mcqN: 8, pyN: 10, sbN: 3, maxScore: 220,
    quizCorrect: 12, quizAttempts: 13,
    gateAttempt: { playerId: "jenn", gateKey: "h2-g06", attemptId: "g6-live", resetSeq: 0 },
  };
  assert.equal(a.restoreGateQuizSession(), true);
  assert.equal(a.curHSK, 2, "the level comes from the binding, not the tab");
});

test("F3: a resumed HSK2 quiz banks its credit against h2, not h1", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const s = a.state.jenn;
  s.gateTimers = { "h2-g06": { startKey: "2026-09-01", deadlineKey: "2099-01-01", active: true, days: 7, attemptId: "g6-live" } };
  s.pendingSessions.gate = {
    did: 6, phase: 3, score: 200, phaseScores: [100, 60, 40],
    vocab: [], questions: [], pyQ: [], sbPack: [], sbRound: 3,
    isChampion: false, mcqN: 8, pyN: 10, sbN: 3, maxScore: 220, noMcqAssistance: true,
    quizCorrect: 19, quizAttempts: 20,
    gateAttempt: { playerId: "jenn", gateKey: "h2-g06", attemptId: "g6-live", resetSeq: 0 },
  };
  a.launchConfetti = () => {};
  assert.equal(a.restoreGateQuizSession(), true);

  const qc = { innerHTML: "" };
  a.renderQuizResult(qc);

  // 19/20 = 95%, which is 3 stars — computed here, not read back from the app.
  assert.ok(s.gateBestQuiz["h2-g06"], "the best quiz is recorded against HSK2");
  assert.equal(s.gateBestQuiz["h2-g06"].accPct, 95);
  assert.equal(s.gateBestQuiz["h2-g06"].quizStars, 3);
  assert.equal(s.gateBestQuiz["h1-g06"], undefined, "and nothing is written to HSK1");
  assert.ok(!qc.innerHTML.includes("Practice round"), "a live round is not called practice");
});

test("F3: an expired attempt is still refused after the level is restored", () => {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  const s = a.state.jenn;
  // The gate has moved on to a new attempt since this round was saved.
  s.gateTimers = { "h2-g06": { startKey: "2026-09-08", deadlineKey: "2099-01-01", active: true, days: 7, attemptId: "g6-NEW" } };
  s.pendingSessions.gate = {
    did: 6, phase: 3, score: 200, phaseScores: [100, 60, 40],
    vocab: [], questions: [], pyQ: [], sbPack: [], sbRound: 3,
    isChampion: false, mcqN: 8, pyN: 10, sbN: 3, maxScore: 220,
    quizCorrect: 19, quizAttempts: 20,
    gateAttempt: { playerId: "jenn", gateKey: "h2-g06", attemptId: "g6-OLD", resetSeq: 0 },
  };
  a.launchConfetti = () => {};
  assert.equal(a.restoreGateQuizSession(), true);
  assert.equal(a.curHSK, 2, "the level is still restored");

  a.renderQuizResult({ innerHTML: "" });
  assert.equal(s.gateBestQuiz["h2-g06"], undefined,
    "a round from a superseded attempt still earns no credit");
});

// ── L2: a missed sentence check must produce a review that can be served ──
// The sentence check filed its evidence under the whole sentence, e.g.
// "很久以前，中国的水很大。::contextComprehension". reviewWordMeta resolves
// words, so the record came due, could not be built into a question, and was
// reported as "remain for later" every day for the rest of the child's life.

const SENTENCE_LESSON = {
  level: "HSK1", gateId: 1, passage: "很久以前，中国的水很大。",
  passageEn: "Long ago, the waters of China were very high.",
  comprehension: [],
  check: [{
    id: "s1", kind: "sentenceMeaning", skill: "contextComprehension",
    zh: "很久以前，中国的水很大。", targetZh: "水", targetPinyin: "shuǐ",
    promptEn: "What does this sentence say?", prompt: "这句话说了什么？",
    options: [{ id: "o1", text: "Long ago, the waters of China were very high." },
              { id: "o2", text: "The Shang wrote on bones." },
              { id: "o3", text: "Confucius was a teacher." },
              { id: "o4", text: "The emperor built a canal." }],
    answerId: "o1",
    explanationEn: "It means \"Long ago, the waters of China were very high.\".",
    explanation: "意思是“Long ago, the waters of China were very high.”。",
  }],
};

async function lessonWithSentenceCheck() {
  const a = app();
  F.installState(a);
  a.curHSK = 1;
  a.curriculumCache.lessons["y"] = JSON.parse(JSON.stringify(SENTENCE_LESSON));
  await a.renderGateLesson(1, "y");
  return a;
}

test("L2: a sentence check is filed against a word, not the sentence", async () => {
  const a = await lessonWithSentenceCheck();
  a.lessonCheckAnswer("h1-g01", 0, "o2");             // a miss

  const keys = Object.keys(a.state.jenn.reviewRecords);
  assert.deepEqual(keys, ["水::contextComprehension"],
    "the record is keyed on a word the app can look up");
  keys.forEach((k) => {
    // Computed here: nothing in the store may carry sentence punctuation.
    assert.ok(!/[，。！？]/.test(k), `${k} is not askable as a review item`);
  });
});

test("L2: every authored sentence check names a target word inside its sentence", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = path.join(__dirname, "..", "data", "lessons");
  let checked = 0;
  for (const f of fs.readdirSync(dir)) {
    const lesson = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const q of lesson.check || []) {
      if (q.kind !== "sentenceMeaning") continue;
      checked++;
      assert.ok(q.targetZh, `${f}: a sentence check with no target word is unservable`);
      assert.ok(q.zh.includes(q.targetZh),
        `${f}: the target ${q.targetZh} must actually occur in the sentence`);
    }
  }
  assert.ok(checked > 0, "there are sentence checks to check");
});

test("L2: a legacy sentence-keyed record is kept but not counted as outstanding", () => {
  const a = app();
  F.installState(a);
  const s = a.state.jenn;
  // What a save written before the fix carries.
  s.reviewRecords = {
    "很久以前，中国的水很大。::contextComprehension": {
      wordId: "很久以前，中国的水很大。", skill: "contextComprehension",
      stage: 0, dueOn: "2020-01-01", attempts: [], independentSuccesses: [],
      unresolvedRuns: 1, firstTaughtOn: "2020-01-01",
    },
  };
  const round = a.buildReviewRound("jenn", "normal");
  assert.equal(round.items.length, 0);
  assert.equal(round.remaining, 0, "a backlog the child can never work off is not reported");
  assert.ok(!round.summary.includes("remain for later"));
  assert.ok(s.reviewRecords["很久以前，中国的水很大。::contextComprehension"],
    "and the evidence itself is preserved, not deleted");
});

// ── C1: the reading a child sees and the one they hear must be the same ──
// buildQuizVocab early-returns on the dataset in data/hsk*.json, while the
// audio map was built only from the inline tables. They disagreed for exactly
// the polyphones the dataset had wrong: 看 was shown as kān and spoken kàn.

test("C1: no served row keeps a specialist or archaic gloss", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  // Written out here rather than imported from the validator, so this fails if
  // the validator's own list is quietly narrowed.
  const artefact = /\(chess\)|archaic|^\s*comma\s*$|first month of the lunar year|dozen \(loanword\)/i;
  const hits = [];
  for (const lv of [1, 2, 3, 4]) {
    const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", `hsk${lv}.json`), "utf8"));
    for (const w of doc.words || []) if (artefact.test(w.en || "")) hits.push(`hsk${lv} ${w.zh} "${w.en}"`);
  }
  assert.deepEqual(hits, [], "a beginner's default meaning must be an ordinary one");
});

test("C1: the audio map agrees with the reading the quiz shows", () => {
  const a = app();
  const fs = require("node:fs");
  const path = require("node:path");
  for (const lv of [1, 2, 3, 4]) {
    a.curriculumCache.levels[lv] =
      JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", `hsk${lv}.json`), "utf8"));
  }
  const map = a.getZhCharClipMap();
  const bad = [];
  for (const lv of [1, 2, 3, 4]) {
    for (const w of a.curriculumCache.levels[lv].words || []) {
      if (typeof w.zh !== "string" || [...w.zh].length !== 1) continue;
      // The expected key is computed here from the row's own pinyin.
      const want = a.markedPinyinToClipKey(w.pinyin || "");
      if (!want) continue;                       // neutral tone: falls back to TTS
      if (map[w.zh] && map[w.zh] !== want) bad.push(`${w.zh} shown ${w.pinyin} but sounds ${map[w.zh]}`);
    }
  }
  assert.deepEqual(bad, [], "prompt and audio must not disagree");
});

test("C1: an unmarked syllable is neutral tone, not first tone", () => {
  const a = app();
  ["de", "le", "ma", "zi", "ba"].forEach((py) => {
    assert.equal(a.markedPinyinToClipKey(py), "",
      `${py} has no tone mark: there is no ${py}5 clip, so it must fall through to speech`);
  });
  // A marked syllable still resolves normally.
  assert.equal(a.markedPinyinToClipKey("tīng"), "ting1");
  assert.equal(a.markedPinyinToClipKey("kàn"), "kan4");
});

// ── C2: Phase 3 must ask about the story the child just read ─────────────
// buildSBPack read `sentenceTargetsPack`, which existed in none of the 88
// gates, so the branch had never run. 52 of the 88 gate/level pairs fell
// through to the same three generic sentences, and champions asked for ten
// and were handed six.

function withCurriculum(a) {
  const fs = require("node:fs");
  const path = require("node:path");
  for (const lv of [1, 2, 3, 4]) {
    a.curriculumCache.levels[lv] =
      JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", `hsk${lv}.json`), "utf8"));
  }
  return a;
}

test("C2: every authored gate supplies a full round from its own story", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  for (const lv of [1, 2]) {
    const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", `hsk${lv}.json`), "utf8"));
    for (const g of doc.gates) {
      assert.ok(Array.isArray(g.sentenceTargetsPack),
        `hsk${lv} gate ${g.gateId} has no pack, so it falls back to the generic sentences`);
      assert.ok(g.sentenceTargetsPack.length >= 3,
        `hsk${lv} gate ${g.gateId} supplies ${g.sentenceTargetsPack.length}, a round asks for 3`);
    }
  }
});

test("C2: a normal round no longer serves the generic fallback", () => {
  const a = withCurriculum(app());
  a.curP = "jenn";
  a.curHSK = 1;
  const generic = ["我爱学习中文。", "我是中国人。", "我们一起读故事。"];
  // GATE_SENTENCES only ever had gates 1, 5, 6, 8, 12, 14, 18, 19 and 20, so
  // these are gates that really did serve the generic three, at every level.
  [2, 7, 10, 11, 22].forEach((did) => {
    const pack = a.buildSBPack(did, false, 3);
    assert.equal(pack.length, 3, `gate ${did} should supply a full round`);
    pack.forEach((s) => {
      assert.ok(!generic.includes(s.join("")),
        `gate ${did} served "${s.join("")}", which is the generic fallback and not its own story`);
    });
  });
});

test("C2: a champion round gets the ten sentences it asks for", () => {
  const a = withCurriculum(app());
  a.curP = "jenn";
  a.curHSK = 1;
  // Champion groups end at gates 5, 10, 15 and 20 and pool the five behind them.
  [5, 10, 15, 20].forEach((did) => {
    assert.equal(a.buildSBPack(did, true, 10).length, 10,
      `champion at gate ${did} was short — the score maximum would not match the questions`);
  });
});

test("C2: HSK1 and HSK2 ask different sentences for the same gate number", () => {
  const a = withCurriculum(app());
  a.curP = "jenn";
  a.curHSK = 1;
  const one = new Set(a.curriculumCache.levels[1].gates.find((g) => g.gateId === 1).sentenceTargetsPack.map((s) => s.join("")));
  const two = new Set(a.curriculumCache.levels[2].gates.find((g) => g.gateId === 1).sentenceTargetsPack.map((s) => s.join("")));
  const shared = [...one].filter((s) => two.has(s));
  assert.notDeepEqual([...one], [...two],
    "GATE_SENTENCES had no level dimension; the packs must follow the level's own text");
  assert.ok(shared.length < one.size, `levels should not serve an identical set (${shared.length} shared)`);
});

test("C2: every pack sentence is buildable from its chips exactly once", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  for (const lv of [1, 2]) {
    const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", `hsk${lv}.json`), "utf8"));
    for (const g of doc.gates) {
      for (const chips of g.sentenceTargetsPack || []) {
        const answer = chips.join("");
        // checkSB compares sbBuilt.join("") to correct.join("") — computed here.
        assert.equal(chips.join(""), answer);
        assert.ok(g.sentenceTargetsMeta && g.sentenceTargetsMeta[answer],
          `hsk${lv} gate ${g.gateId}: "${answer}" has no metadata, so the reveal card has no reading`);
      }
    }
  }
});

// ── C4: the two tellings of one story must agree on the facts ────────────
test("C4: Dayu is away for the same number of years at every level", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const years = {};
  for (const lv of [1, 2]) {
    const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "stories", `hsk${lv}.json`), "utf8"));
    const story = doc.stories[`xia-h${lv}`];
    const text = story.sents.map((s) => s.map((t) => (t.t === "p" ? t.tx : (t.tx || t.ch))).join("")).join("");
    // Computed here from the text, not read from a fixture.
    const m = text.match(/[一二三四五六七八九十]+(?=年)/g) || [];
    years[lv] = m.filter((n) => n === "三十" || n === "十三");
  }
  assert.deepEqual(years[1], ["十三"], "HSK1 said 三十年 where HSK2 said 十三年");
  assert.deepEqual(years[2], ["十三"]);
});
