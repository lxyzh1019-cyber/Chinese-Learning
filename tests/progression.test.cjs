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

test("C03: migrating a legacy save keeps both the credit and the access", () => {
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
  assert.deepEqual(s.legacyLevelAccess, [1, 2], "the HSK2 tab they already had stays open");
  assert.equal(a.levelIsUnlocked(s, 2), true);
  assert.equal(a.levelIsUnlocked(s, 3), false, "but no tab they had not earned");
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
