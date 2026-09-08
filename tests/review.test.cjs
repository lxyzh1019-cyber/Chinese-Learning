"use strict";
/**
 * Retention engine (R01-R03).
 *
 * The behaviour under test is deliberately conservative: the schedule only
 * advances on evidence of unaided recall, a session's budget is a stopping
 * point rather than a quota, and nothing the child has not answered is thrown
 * away.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const R = require("../js/review-core.js");

const DAY = "2026-09-06";

/** Apply a list of attempts to a fresh store, oldest first. */
function play(attempts) {
  return attempts.reduce((store, a) => R.recordAttempt(store, a), {});
}

// ── R01: evidence is per skill, and only interpretable attempts count ───────

test("R01: knowing a word's meaning says nothing about being able to write it", () => {
  const store = play([
    { wordId: "水", skill: "meaning", correct: true, todayKey: DAY },
  ]);
  const meaning = R.getRecord(store, "水", "meaning");
  const writing = R.getRecord(store, "水", "writingRecall");

  assert.equal(R.statusOf(meaning), R.LABELS.RECALLED);
  assert.equal(R.statusOf(writing), R.LABELS.ENCOUNTERED,
    "an untested skill is unknown, not passed");
  assert.equal(writing.dueOn, null, "and it is not scheduled off the back of another skill");
});

test("R01: a skill the engine does not track is refused rather than silently recorded", () => {
  const before = {};
  const after = R.recordAttempt(before, {
    wordId: "水", skill: "tracePractice", correct: false, todayKey: DAY,
  });
  assert.deepEqual(after, before, "tracing is practice, not independent recall");
  assert.equal(Object.keys(after).length, 0);
});

test("R01: an answer reached with pinyin showing is not evidence of recall", () => {
  const store = play([
    { wordId: "山", skill: "recognition", correct: true, supported: true, todayKey: DAY },
  ]);
  const rec = R.getRecord(store, "山", "recognition");
  assert.equal(rec.independentSuccesses.length, 0);
  assert.equal(rec.stage, 0, "supported success does not climb the ladder");
  assert.equal(R.statusOf(rec), R.LABELS.PRACTISING);
  assert.equal(rec.dueOn, "2026-09-07", "it comes back tomorrow instead");
});

test("R01: a retry straight after being shown the answer is teaching, not retrieval", () => {
  const store = play([
    { wordId: "人", skill: "meaning", correct: false, todayKey: DAY },
    { wordId: "人", skill: "meaning", correct: true, sameSession: true, todayKey: DAY },
  ]);
  const rec = R.getRecord(store, "人", "meaning");
  assert.equal(rec.stage, 0);
  assert.equal(rec.independentSuccesses.length, 0);
  assert.equal(rec.dueOn, "2026-09-07");
});

// ── R02: the schedule ───────────────────────────────────────────────────────

test("R02: successive independent recalls follow next-day, +3, +7, +14, +30", () => {
  const steps = [
    ["2026-09-05", "2026-09-06"],  // 1st unaided success -> check tomorrow
    ["2026-09-06", "2026-09-09"],  // 2nd -> +3
    ["2026-09-09", "2026-09-16"],  // 3rd -> +7
    ["2026-09-16", "2026-09-30"],  // 4th -> +14
    ["2026-09-30", "2026-10-30"],  // 5th -> +30
    ["2026-10-30", "2026-11-29"],  // the ladder tops out rather than growing
  ];
  let store = {};
  for (const [on, due] of steps) {
    store = R.recordAttempt(store, { wordId: "\u5927", skill: "recognition", correct: true, todayKey: on });
    assert.equal(R.getRecord(store, "\u5927", "recognition").dueOn, due, `${on} -> ${due}`);
  }
  assert.equal(R.getRecord(store, "\u5927", "recognition").stage, R.LADDER.length);
});

test("R02: answering the same item repeatedly in one sitting advances it once", () => {
  const store = play([
    { wordId: "小", skill: "meaning", correct: true, todayKey: DAY },
    { wordId: "小", skill: "meaning", correct: true, todayKey: DAY },
    { wordId: "小", skill: "meaning", correct: true, todayKey: DAY },
    { wordId: "小", skill: "meaning", correct: true, todayKey: DAY },
  ]);
  const rec = R.getRecord(store, "小", "meaning");
  assert.equal(rec.stage, 1, "four taps in one sitting are not four days of retention");
  assert.equal(rec.attempts.length, 4, "though every attempt is still on record");
});

test("R02: a miss returns the item to tomorrow without erasing its history", () => {
  let store = play([
    { wordId: "火", skill: "recognition", correct: true, todayKey: "2026-09-01" },
    { wordId: "火", skill: "recognition", correct: true, todayKey: "2026-09-04" },
  ]);
  assert.equal(R.getRecord(store, "火", "recognition").stage, 2);

  store = R.recordAttempt(store, { wordId: "火", skill: "recognition", correct: false, todayKey: DAY });
  const rec = R.getRecord(store, "火", "recognition");
  assert.equal(rec.stage, 0);
  assert.equal(rec.dueOn, "2026-09-07");
  assert.equal(rec.independentSuccesses.length, 2, "past successes are kept, not forfeited");
  assert.equal(rec.unresolvedRuns, 1);
});

test("R02: calendar days, so a month boundary and a leap day both land correctly", () => {
  assert.equal(R.addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(R.addDays("2026-12-31", 30), "2027-01-30");
  assert.equal(R.addDays("2028-02-28", 1), "2028-02-29", "2028 is a leap year");
  assert.equal(R.addDays("2026-02-28", 1), "2026-03-01");
});

test("R02: an item is due on its date and stays due after it, never before", () => {
  const rec = { dueOn: "2026-09-06" };
  assert.equal(R.isDue(rec, "2026-09-05"), false);
  assert.equal(R.isDue(rec, "2026-09-06"), true, "due today counts as due");
  assert.equal(R.isDue(rec, "2026-09-20"), true, "an overdue item does not expire");
  assert.equal(R.isDue({ dueOn: null }, "2026-09-06"), false);
});

// ── Honest labels ───────────────────────────────────────────────────────────

test("labels: the strongest one needs two separate dates and a check a week later", () => {
  // Two independent successes, but both within the first week of teaching.
  const early = play([
    { wordId: "月", skill: "meaning", correct: true, todayKey: "2026-09-01" },
    { wordId: "月", skill: "meaning", correct: true, todayKey: "2026-09-03" },
  ]);
  assert.equal(R.statusOf(R.getRecord(early, "月", "meaning")), R.LABELS.RECALLED,
    "recalled twice quickly is not yet retention");

  const later = R.recordAttempt(early, { wordId: "月", skill: "meaning", correct: true, todayKey: "2026-09-24" });
  assert.equal(R.statusOf(R.getRecord(later, "月", "meaning")), R.LABELS.RETAINED,
    "a success three weeks after teaching is");
});

test("labels: no label ever reads as mastery or failure", () => {
  const all = Object.values(R.LABELS).join(" ").toLowerCase();
  for (const word of ["master", "fail", "wrong", "bad", "weak", "poor"]) {
    assert.ok(!all.includes(word), `label vocabulary must not contain "${word}"`);
  }
});

// ── R03: bounded review ─────────────────────────────────────────────────────

test("R03: a large backlog is served in one bounded batch and the rest is retained", () => {
  let store = {};
  for (let i = 0; i < 30; i++) {
    store = R.recordAttempt(store, { wordId: `w${i}`, skill: "meaning", correct: false, todayKey: "2026-09-01" });
  }
  const sel = R.selectDue(store, DAY, {});
  assert.equal(sel.items.length, R.BUDGET.normalItems, "eight in a normal session");
  assert.equal(sel.dueTotal, 30);
  assert.equal(sel.remaining, 22, "the other 22 stay due; nothing is dropped");
  assert.ok(/remain for later/.test(sel.summary), "and the child is told plainly, not scolded");
});

test("R03: a struggling child still meets something they have already recalled", () => {
  let store = {};
  for (let i = 0; i < 12; i++) {
    store = R.recordAttempt(store, { wordId: `hard${i}`, skill: "meaning", correct: false, todayKey: "2026-09-01" });
  }
  store = R.recordAttempt(store, { wordId: "easy", skill: "meaning", correct: true, todayKey: "2026-08-20" });

  const sel = R.selectDue(store, DAY, {});
  assert.ok(sel.items.some((r) => r.wordId === "easy"),
    "one slot is reserved so review is not an unbroken run of failures");
  assert.equal(sel.items.length, 8);
});

test("R03: nothing due means nothing to review — the queue is never padded", () => {
  const store = play([{ wordId: "天", skill: "meaning", correct: true, todayKey: DAY }]);
  const sel = R.selectDue(store, DAY, {});
  assert.equal(sel.items.length, 0, "an item recalled today is not re-served today");
  assert.equal(sel.dueTotal, 0);
});

test("R03: the budget stops on time or on answers, whichever comes first", () => {
  assert.equal(R.budgetSpent({ activeMs: 3 * 60 * 1000, answered: 5 }, "normal"), false);
  assert.equal(R.budgetSpent({ activeMs: 4 * 60 * 1000, answered: 0 }, "normal"), true);
  assert.equal(R.budgetSpent({ activeMs: 0, answered: 8 }, "normal"), true);
  assert.equal(R.budgetSpent({ activeMs: 5 * 60 * 1000, answered: 9 }, "focus"), false,
    "a focus session is longer, and asked for");
  assert.equal(R.budgetSpent({ activeMs: 0, answered: 16 }, "focus"), true);
});

// ── Assessment linkage ──────────────────────────────────────────────────────

test("assessment: weak domains become suggestions, and only when asked for", () => {
  const score = {
    byBand: {
      C1: { band: "C1", domains: {
        recognition: { domain: "recognition", correct: 8, expected: 8 },
        meaning: { domain: "meaning", correct: 4, expected: 8 },
      } },
    },
  };
  const targets = R.targetsFromAssessment(score, { attemptId: "a1" });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].domain, "meaning");
  assert.equal(targets[0].provenance, "assessment", "practice can be traced to its source");
  assert.equal(targets[0].attemptId, "a1");
});

test("assessment: writing awaiting review is never counted as a weakness", () => {
  const score = {
    byBand: {
      C1: { band: "C1", domains: {
        writing_recall: { domain: "writing_recall", correct: 0, expected: 4, awaitingReview: true },
      } },
    },
  };
  assert.deepEqual(R.targetsFromAssessment(score, {}), [],
    "unreviewed writing is unknown, not zero");
});

test("assessment: results never write into the review store by themselves", () => {
  const store = play([{ wordId: "水", skill: "meaning", correct: true, todayKey: DAY }]);
  const before = JSON.stringify(store);
  R.targetsFromAssessment({ byBand: { C1: { band: "C1", domains: {
    meaning: { domain: "meaning", correct: 0, expected: 8 },
  } } } }, {});
  assert.equal(JSON.stringify(store), before, "suggesting is not scheduling");
});

// ── Integration: the app records evidence only where it is interpretable ────

const { loadApp } = require("./helpers/app-loader.js");
const { installState } = require("./fixtures/players.js");

/** Load the real app with a fixed clock, both profiles installed, Jenn active. */
function bootApp() {
  const app = loadApp({ now: Date.parse("2026-09-06T12:00:00Z") });
  installState(app, {});
  app.curP = "jenn";
  return app;
}

test("app: a Listen answer is recorded as unaided recognition for the active player", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  const w = { zh: "水", py: "shuǐ", en: "water" };
  app.noteEvidence("jenn", w, "recognition", true, { source: "listen" });

  const rec = R.getRecord(app.state.jenn.reviewRecords, "水", "recognition");
  assert.equal(rec.independentSuccesses.length, 1);
  assert.equal(rec.dueOn, "2026-09-07");
  assert.deepEqual(app.state.jess.reviewRecords, {},
    "and nothing is written to the other child");
});

test("app: a Rain miss or a Match mis-flip never becomes vocabulary evidence", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  // Both games route their misses through logWrong, which is the counter the
  // app already had. Neither may reach the retention store: a mistimed tap is
  // not a claim about whether the child knows the word.
  app.logWrong("jenn", "山", "shān", "mountain");
  assert.deepEqual(app.state.jenn.reviewRecords, {});
  assert.equal(app.state.jenn.failedWords["山"].failCount, 1,
    "the practice queue still sees it, as before");
});

test("app: tracing is practice and is kept out of the recall record", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  app.noteEvidence("jenn", { zh: "日" }, "tracePractice", true, { source: "trace" });
  assert.deepEqual(app.state.jenn.reviewRecords, {},
    "stroke practice says nothing about independent recall");
});

test("app: evidence survives a save and reload of the same player", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  app.noteEvidence("jenn", { zh: "火" }, "meaning", true, { source: "drill" });
  app.savePlayer("jenn");

  const blob = JSON.parse(app.localStorage.getItem("zh_adv_v1"));
  assert.ok(blob.jenn.reviewRecords["火::meaning"], "it is in the persisted document");
  assert.equal(blob.jenn.reviewRecords["火::meaning"].dueOn, "2026-09-07");
});

test("app: a legacy player without the field gets one without losing anything", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  delete app.state.jenn.reviewRecords;
  app.state.jenn.totalStars = 6669;
  app.ensureState("jenn");
  assert.deepEqual(app.state.jenn.reviewRecords, {});
  assert.equal(app.state.jenn.totalStars, 6669, "existing progress is untouched");
});

test("app: the honest label is what the app reports, with no mastery flag", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  assert.equal(app.reviewStatus("jenn", "水", "meaning"), R.LABELS.ENCOUNTERED);
  app.noteEvidence("jenn", { zh: "水" }, "meaning", true, {});
  assert.equal(app.reviewStatus("jenn", "水", "meaning"), R.LABELS.RECALLED);
  assert.equal(app.reviewStatus("jenn", "水", "writingRecall"), R.LABELS.ENCOUNTERED,
    "a different skill on the same word is still untested");
});

test("app: today's review queue is bounded and reports its own backlog", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  for (let i = 0; i < 20; i++) {
    app.noteEvidence("jenn", { zh: `w${i}` }, "meaning", false, {});
  }
  // Every one of them is due tomorrow, so nothing is due today.
  assert.equal(app.reviewDueToday("jenn", "normal").dueTotal, 0);

  // Re-date them into the past to simulate the backlog arriving.
  Object.values(app.state.jenn.reviewRecords).forEach((r) => { r.dueOn = "2026-09-01"; });
  const due = app.reviewDueToday("jenn", "normal");
  assert.equal(due.items.length, 8);
  assert.equal(due.remaining, 12);
  const focus = app.reviewDueToday("jenn", "focus");
  assert.equal(focus.items.length, 16, "a focus session is longer, when asked for");
});

test("app: driving the real Listen handler records the question's word", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  const q = { w: { zh: "书", py: "shū", en: "book" }, opts: ["书", "水", "山", "火"] };
  app.listenSt = { questions: [q, q], qi: 0, streak: 0, score: 0, correctCount: 0, gameTargetDid: 1, gameTargetLevel: 1 };
  app.checkListen(app.document.createElement("button"), true, q);

  const rec = R.getRecord(app.state.jenn.reviewRecords, "书", "recognition");
  assert.equal(rec.independentSuccesses.length, 1, "the real handler fed the retention store");
  assert.equal(rec.skill, "recognition");
  assert.equal(app.state.jenn.failedWords["书"], undefined, "a correct answer is not a failure");
});

test("app: a wrong Listen answer is evidence, and still reaches the practice queue", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());

  const q = { w: { zh: "书", py: "shū", en: "book" }, opts: ["书", "水", "山", "火"] };
  app.listenSt = { questions: [q, q], qi: 0, streak: 0, score: 0, correctCount: 0, gameTargetDid: 1, gameTargetLevel: 1 };
  app.checkListen(app.document.createElement("button"), false, q);

  const rec = R.getRecord(app.state.jenn.reviewRecords, "书", "recognition");
  assert.equal(rec.attempts.length, 1);
  assert.equal(rec.attempts[0].correct, false);
  assert.equal(rec.dueOn, "2026-09-07", "back tomorrow");
  assert.equal(app.state.jenn.failedWords["书"].failCount, 1, "both systems, one answer");
});

// ── F02: replayable evidence ───────────────────────────────────────────────

test("F02: every recorded attempt carries a stable id", () => {
  const store = play([{ wordId: "水", skill: "meaning", correct: true, todayKey: DAY }]);
  const rec = R.getRecord(store, "水", "meaning");
  assert.ok(rec.attempts[0].id, "an id is minted");
  const again = R.recordAttempt(store, { wordId: "水", skill: "meaning", correct: false, todayKey: DAY, id: "given" });
  assert.equal(R.getRecord(again, "水", "meaning").attempts[1].id, "given", "a caller's id is kept");
});

test("F02: replaying a union of two histories reproduces the hand-computed schedule", () => {
  // Day 1 unaided success (A), day 2 miss (B), day 4 unaided success (A).
  // Ladder: 1 -> success stage 1 due +1; miss -> stage 0 due +1; success -> stage 1 due +1 = day 5.
  const a = play([
    { wordId: "火", skill: "recognition", correct: true, todayKey: "2026-09-01", id: "a1" },
    { wordId: "火", skill: "recognition", correct: true, todayKey: "2026-09-04", id: "a2" },
  ]);
  const b = play([{ wordId: "火", skill: "recognition", correct: false, todayKey: "2026-09-02", id: "b1" }]);
  const m = R.mergeRecords(R.getRecord(a, "火", "recognition"), R.getRecord(b, "火", "recognition"));
  assert.equal(m.attempts.length, 3);
  assert.deepEqual(m.attempts.map((e) => e.id), ["a1", "b1", "a2"], "in study-date order");
  assert.equal(m.stage, 1);
  assert.equal(m.dueOn, "2026-09-05");
  assert.equal(m.unresolvedRuns, 0);
  assert.deepEqual(m.independentSuccesses, ["2026-09-01", "2026-09-04"]);
  assert.equal(m.firstTaughtOn, "2026-09-01");
});

test("F02: merging a record with itself changes nothing, and legacy entries do not duplicate", () => {
  const legacy = {
    wordId: "山", skill: "meaning", stage: 1, dueOn: "2026-09-07",
    attempts: [{ on: DAY, correct: true, supported: false, sameSession: false, source: "listen" }],
    independentSuccesses: [DAY], firstTaughtOn: DAY, lastSeenOn: DAY, unresolvedRuns: 0,
  };
  const m = R.mergeRecords(legacy, JSON.parse(JSON.stringify(legacy)));
  assert.equal(m.attempts.length, 1, "the same id-less attempt seen on both devices counts once");
  assert.equal(m.stage, 1);
  assert.equal(m.dueOn, "2026-09-07");
});

test("F02: at the history bound the fuller copy is kept whole rather than under-replayed", () => {
  const full = { wordId: "人", skill: "meaning", stage: 5, dueOn: "2026-10-01", lastSeenOn: DAY,
    attempts: Array.from({ length: R.MAX_ATTEMPTS }, (_, i) => ({ id: `f${i}`, on: DAY, correct: true })) };
  const small = { wordId: "人", skill: "meaning", stage: 1, dueOn: "2026-09-07", lastSeenOn: DAY,
    attempts: [{ id: "s1", on: DAY, correct: true }] };
  assert.equal(R.mergeRecords(full, small).stage, 5);
  assert.equal(R.mergeRecords(small, full).stage, 5);
});
