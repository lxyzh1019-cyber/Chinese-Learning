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
const clone = (x) => JSON.parse(JSON.stringify(x));

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

// Past the history bound, trimming folds the shed attempts into a checkpoint
// instead of discarding them, so the merge can keep replaying. It used to give
// up and keep one whole record, which made the result depend on argument order
// and dropped the other device's evidence outright (audit A26-R04).

/** A record with `n` unaided successes on consecutive days, oldest first. */
function longHistory(days, over) {
  let store = {};
  for (let i = 0; i < days; i++) {
    store = R.recordAttempt(store, {
      wordId: "人", skill: "meaning", correct: true,
      todayKey: R.addDays("2026-01-01", i), id: `h${i}`, at: i,
    });
  }
  return Object.assign(store["人::meaning"], over || {});
}

test("F02: past the bound, the folded prefix is kept as a checkpoint, not dropped", () => {
  const rec = longHistory(R.MAX_ATTEMPTS + 10);
  assert.equal(rec.attempts.length, R.MAX_ATTEMPTS, "the history is still bounded");
  assert.ok(rec.checkpoint, "and what fell off the front is accounted for");
  assert.equal(rec.checkpoint.count, 10);
  assert.equal(rec.checkpoint.firstTaughtOn, "2026-01-01",
    "when this word was first taught survives the fold - statusOf needs it");
  assert.equal(rec.firstTaughtOn, "2026-01-01");
});

test("A26-R04: past the bound the merge is order-independent and idempotent", () => {
  const base = longHistory(R.MAX_ATTEMPTS);
  // Two devices, each with one attempt the other has never seen, both still at
  // the bound because the oldest entry is trimmed as the new one lands.
  const older = R.applyAttempt(clone(base), { id: "x-old", on: "2026-03-01", at: 900, correct: true });
  const newer = R.applyAttempt(clone(base), { id: "x-new", on: "2026-03-01", at: 901, correct: false });
  assert.equal(older.attempts.length, R.MAX_ATTEMPTS);
  assert.equal(newer.attempts.length, R.MAX_ATTEMPTS);

  const ab = R.mergeRecords(clone(older), clone(newer));
  const ba = R.mergeRecords(clone(newer), clone(older));
  assert.deepEqual(ab, ba, "which device merged first must not change the schedule");

  const ids = ab.attempts.map((e) => e.id);
  assert.ok(ids.indexOf("x-new") !== -1, "the new miss is not discarded");
  assert.ok(ids.indexOf("x-old") !== -1, "nor the other device's new success");
  // A miss returns the target to tomorrow, whichever order the merge ran in.
  assert.equal(ab.stage, 0);
  assert.equal(ab.dueOn, R.addDays("2026-03-01", 1));

  assert.deepEqual(R.mergeRecords(clone(ab), clone(ab)), ab, "merging again changes nothing");
});

test("A26-R04: a fresh device's misses are not thrown away by a longer history", () => {
  const long = longHistory(R.MAX_ATTEMPTS + 5);
  let store = {};
  ["2026-03-01", "2026-03-02", "2026-03-03"].forEach((d, i) => {
    store = R.recordAttempt(store, { wordId: "\u4eba", skill: "meaning", correct: false, todayKey: d, id: `m${i}`, at: i });
  });
  const fresh = store["\u4eba::meaning"];

  const merged = R.mergeRecords(clone(long), clone(fresh));
  const ids = merged.attempts.map((e) => e.id);
  ["m0", "m1", "m2"].forEach((id) => assert.ok(ids.indexOf(id) !== -1, `${id} survives`));
  assert.deepEqual(merged, R.mergeRecords(clone(fresh), clone(long)));
  assert.equal(merged.stage, 0, "three recent misses put the target back at the start");
});

test("A26-R04: a fold does not cost the child their retained label", () => {
  // Taught in January, recalled unaided again well over a week later, then
  // drilled enough that the early evidence is folded away.
  let store = {};
  store = R.recordAttempt(store, { wordId: "\u4eba", skill: "meaning", correct: true, todayKey: "2026-01-01", id: "a", at: 1 });
  store = R.recordAttempt(store, { wordId: "\u4eba", skill: "meaning", correct: true, todayKey: "2026-02-01", id: "b", at: 2 });
  assert.equal(R.statusOf(store["\u4eba::meaning"]), R.LABELS.RETAINED);

  let rec = store["\u4eba::meaning"];
  for (let i = 0; i < R.MAX_ATTEMPTS + 5; i++) {
    rec = R.applyAttempt(rec, { id: `f${i}`, on: "2026-03-01", at: i, correct: true, sameSession: true });
  }
  assert.ok(rec.checkpoint.count > 0, "the January evidence has been folded");
  assert.equal(R.statusOf(rec), R.LABELS.RETAINED,
    "practising a word many times in one sitting must not demote what it already proved");
  assert.deepEqual(R.mergeRecords(clone(rec), clone(rec)), rec);
});

// ── F05: the review reaches a child ────────────────────────────────────────
// Audit finding F05. The schedule was stored and never read back: nothing in
// the app called reviewDueToday. These drive the real activity end to end.

/** Seed `n` due records for HSK1 words in the given skill, all due yesterday. */
function seedDue(app, n, skill, start = 0) {
  const words = app.HSK_VOCAB[1].slice(start, start + n);
  words.forEach((w) => app.noteEvidence("jenn", { zh: w.zh }, skill, false, {}));
  Object.values(app.state.jenn.reviewRecords).forEach((r) => { r.dueOn = "2026-09-01"; });
  return words;
}
const senses = (s) => String(s || "").toLowerCase().split(";").map((t) => t.trim()).filter(Boolean);
const shareSense = (a, b) => senses(a).some((t) => senses(b).indexOf(t) !== -1);

test("F05: a round is bounded, states its backlog, and never offers a second right answer", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 12, "meaning");

  const round = app.buildReviewRound("jenn", "normal");
  assert.equal(round.items.length, 8, "eight items in a normal sitting");
  assert.equal(round.remaining, 4);
  assert.equal(round.summary, "8 to review; 4 remain for later");
  const byZh = {};
  app.HSK_VOCAB[1].forEach((w) => { byZh[w.zh] = w; });
  round.items.forEach((it) => {
    assert.equal(it.kind, "meaning", "a meaning record is asked as character → English");
    assert.equal(new Set(it.opts).size, it.opts.length, `${it.zh}: options are distinct`);
    assert.ok(it.opts.indexOf(it.correct) !== -1, "the answer is among the options");
    it.opts.filter((o) => o !== it.correct).forEach((o) => {
      assert.ok(!shareSense(o, it.en), `${it.zh}: wrong option "${o}" must not mean the same as "${it.en}"`);
    });
  });
});

test("F05: each skill is asked in its own exercise", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 2, "recognition");
  seedDue(app, 2, "meaning", 2);
  const round = app.buildReviewRound("jenn", "normal");
  const kinds = {};
  round.items.forEach((it) => { kinds[it.skill] = it; });
  assert.equal(kinds.recognition.kind, "audio", "a recognition record is heard, then a character is tapped");
  kinds.recognition.opts.forEach((o) => assert.ok(/[一-鿿]/.test(o), "options are characters"));
  assert.equal(kinds.meaning.kind, "meaning");
  kinds.meaning.opts.forEach((o) => assert.ok(!/[一-鿿]/.test(o), "options are English"));
});

test("F05: a record the app cannot ask about yet stays due and is counted, not dropped", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 3, "meaning");
  app.noteEvidence("jenn", { zh: "水" }, "writingRecall", false, {});
  app.state.jenn.reviewRecords["水::writingRecall"].dueOn = "2026-09-01";
  const round = app.buildReviewRound("jenn", "normal");
  assert.equal(round.items.length, 3);
  assert.equal(round.remaining, 1, "the writing record is reported as remaining");
  assert.equal(round.summary, "3 to review; 1 remain for later");
});

test("F05: the first answer is unaided evidence; a retry after the reveal is not", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  const [w] = seedDue(app, 1, "meaning");
  app.startReviewRound("normal");
  const it = app.reviewSt.items[0];
  assert.equal(it.zh, w.zh);
  const before = app.state.jenn.reviewRecords[`${w.zh}::meaning`];
  assert.equal(before.attempts.length, 1, "the seeded miss");

  // Wrong first tap.
  const wrongIdx = it.opts.findIndex((o) => o !== it.correct);
  app.answerReview(wrongIdx);
  let rec = app.state.jenn.reviewRecords[`${w.zh}::meaning`];
  assert.equal(rec.attempts.length, 2);
  assert.equal(rec.attempts[1].correct, false);
  assert.equal(rec.attempts[1].sameSession, false, "the first response is unaided");
  assert.equal(rec.attempts[1].source, "review");
  assert.equal(app.reviewSt.retry, true, "the same item is asked once more");
  assert.equal(app.reviewSt.answered, 1);
  assert.equal(app.state.jenn.failedWords[w.zh].failCount, 1, "and it reaches the practice queue");

  // Correct on the retry.
  app.renderReviewRound();
  app.answerReview(it.opts.indexOf(it.correct));
  rec = app.state.jenn.reviewRecords[`${w.zh}::meaning`];
  assert.equal(rec.attempts.length, 3);
  assert.equal(rec.attempts[2].correct, true);
  assert.equal(rec.attempts[2].sameSession, true, "being told is not remembering");
  assert.equal(rec.stage, 0, "the schedule did not advance");
  assert.equal(rec.independentSuccesses.length, 0);
  assert.equal(app.reviewSt.answered, 1, "a retry is not a second item");
  assert.equal(app.reviewSt.qi, 1, "and the round moved on");
});

test("F05: leaving early saves the round and pays nothing; resuming lands on the same item", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 4, "meaning");
  app.state.jenn.totalStars = 100;
  app.startReviewRound("normal");
  const first = app.reviewSt.items[0];
  app.answerReview(first.opts.indexOf(first.correct));
  assert.equal(app.reviewSt.qi, 1);
  app.exitReviewRound();
  assert.equal(app.reviewSt, null);
  const saved = app.state.jenn.pendingSessions.review;
  assert.ok(saved, "the round survives an early exit");
  assert.equal(saved.qi, 1);
  assert.equal(saved.items.length, 4);
  assert.equal(app.state.jenn.totalStars, 100, "zero stars for an early exit");

  assert.equal(app.resumeSession("review"), true);
  assert.equal(app.reviewSt.qi, 1, "resumed at the item the child had reached");
  assert.equal(app.reviewSt.items[0].zh, first.zh);
});

test("F05: finishing the round pays a flat amount whatever the answers were", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 3, "meaning");
  app.state.jenn.totalStars = 100;
  app.startReviewRound("normal");
  while (app.reviewSt) {
    const it = app.reviewSt.items[app.reviewSt.qi];
    if (!it) { app.renderReviewRound(); break; }
    // Miss every item, twice.
    app.answerReview(it.opts.findIndex((o) => o !== it.correct));
    if (!app.reviewSt) break;
    app.renderReviewRound();
    app.answerReview(it.opts.findIndex((o) => o !== it.correct));
    app.renderReviewRound();
  }
  assert.equal(app.reviewSt, null, "the round ended");
  assert.equal(app.state.jenn.totalStars, 105, "5 stars for showing up, not for being right");
  assert.equal(app.state.jenn.pendingSessions.review, null, "nothing left to resume");
  assert.ok(app.state.jenn.pendingSessionClearedAt.review > 0);
});

test("F05: with nothing due there is no round and no pending slot", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  assert.equal(app.buildReviewRound("jenn", "normal").items.length, 0);
  app.startReviewRound("normal");
  assert.equal(app.reviewSt, null);
  assert.equal(app.state.jenn.pendingSessions.review, null);
});

test("F05: the hub card and the games picker both show the queue and a way in", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 12, "meaning");
  const box = app.document.getElementById("review-today-box");
  app.renderReviewTodayBox("jenn");
  assert.match(box.innerHTML, /8 to review; 4 remain for later/);
  assert.match(box.innerHTML, /startReviewRound\(\)/);
  assert.match(app.gamePickerHtml(), /Review today[\s\S]*8 to review; 4 remain for later[\s\S]*startReviewRound\(\)/);
});

// ── the 2026-09-08 audit: a reveal must survive an interruption (A26-R03) ───
// The retry flag was never persisted and restoreReviewRound hardcoded it to
// false, so being shown the answer, leaving, and coming back turned supported
// practice into apparent independent recall. F05's existing tests covered the
// retry path and the resume path but never crossed them, which is why a green
// suite missed it.

/** Miss the current item so the reveal is showing, then return the record. */
function missCurrent(app) {
  const it = app.reviewSt.items[app.reviewSt.qi];
  const wrong = it.opts.findIndex((o) => o !== it.correct);
  app.answerReview(wrong);
  return it;
}

test("A26-R03: the answer a child was shown is still supported after Save & Exit", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 3, "meaning");
  app.startReviewRound("normal");

  const it = missCurrent(app);
  assert.equal(app.reviewSt.retry, true, "the reveal is showing");
  assert.equal(app.state.jenn.pendingSessions.review.retry, true,
    "and the saved round remembers it — the miss itself persists the round");

  app.exitReviewRound();
  assert.equal(app.resumeSession("review"), true);
  assert.equal(app.reviewSt.retry, true, "resuming lands back on the retry, not a fresh ask");

  const before = JSON.parse(JSON.stringify(app.state.jenn.reviewRecords[`${it.zh}::meaning`]));
  const cur = app.reviewSt.items[app.reviewSt.qi];
  app.answerReview(cur.opts.indexOf(cur.correct));

  const rec = app.state.jenn.reviewRecords[`${it.zh}::meaning`];
  const last = rec.attempts[rec.attempts.length - 1];
  assert.equal(last.correct, true);
  assert.equal(last.sameSession, true, "being told, then leaving and coming back, is still being told");
  assert.equal(rec.stage, before.stage, "the ladder does not move");
  assert.deepEqual(rec.independentSuccesses, before.independentSuccesses,
    "and no independent success is invented");
});

test("A26-R03: the same holds across a reload, with no Save & Exit at all", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 3, "meaning");
  app.startReviewRound("normal");
  const it = missCurrent(app);

  // A reload, a tab kill or a profile switch: nothing tidies up, the round is
  // simply read back from what the miss already wrote.
  app.reviewSt = null;
  assert.equal(app.resumeSession("review"), true);
  assert.equal(app.reviewSt.retry, true);

  const cur = app.reviewSt.items[app.reviewSt.qi];
  app.answerReview(cur.opts.indexOf(cur.correct));
  const rec = app.state.jenn.reviewRecords[`${it.zh}::meaning`];
  assert.equal(rec.attempts[rec.attempts.length - 1].sameSession, true);
  assert.equal(rec.independentSuccesses.length, 0);
});

test("A26-R03: a resumed retry is not counted as a second item", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 4, "meaning");
  app.startReviewRound("normal");
  missCurrent(app);
  const answered = app.reviewSt.answered, correct = app.reviewSt.correct;

  app.exitReviewRound();
  app.resumeSession("review");
  const cur = app.reviewSt.items[app.reviewSt.qi];
  app.answerReview(cur.opts.indexOf(cur.correct));

  assert.equal(app.reviewSt.answered, answered, "the retry does not spend a second slot of the budget");
  assert.equal(app.reviewSt.correct, correct, "nor count as remembered first time");
});

test("A26-R03: a second miss then an interruption is still supported", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 3, "recognition");
  app.startReviewRound("normal");
  const it = missCurrent(app);
  app.exitReviewRound();
  app.resumeSession("review");

  // Miss the retry too. The round moves on; the word is already back tomorrow.
  const cur = app.reviewSt.items[app.reviewSt.qi];
  app.answerReview(cur.opts.findIndex((o) => o !== cur.correct));
  assert.equal(app.reviewSt.retry, false, "a missed retry ends the item");

  const rec = app.state.jenn.reviewRecords[`${it.zh}::recognition`];
  const last = rec.attempts[rec.attempts.length - 1];
  assert.equal(last.correct, false);
  assert.equal(last.sameSession, true, "the second miss is still the same, told, sitting");
  assert.equal(rec.independentSuccesses.length, 0);
});

// ── the 2026-09-08 audit: name each measured task accurately ────────────────

test("A26: a context item asks unaided first and only then shows the translation", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  // contextComprehension had no producer at all, so this branch was
  // unreachable; seed a record directly the way a producer will.
  const w = app.HSK_VOCAB[1][0];
  app.noteEvidence("jenn", { zh: w.zh }, "contextComprehension", false, {});
  Object.values(app.state.jenn.reviewRecords).forEach((r) => { r.dueOn = "2026-09-01"; });
  app.startReviewRound("normal");
  const it = app.reviewSt.items.find((x) => x.kind === "context");
  if (!it) return; // no story sentence for this word in the fixture corpus

  const body = () => app.document.getElementById("games-body").innerHTML;
  assert.ok(body().indexOf(it.sentenceEn) === -1,
    "the English names the missing word, so the first ask must not show it");
  app.answerReview(it.opts.findIndex((o) => o !== it.correct));
  assert.equal(app.reviewSt.retry, true);
  app.renderReviewRound();
  assert.ok(body().indexOf(it.sentenceEn) !== -1, "the retry gets the translation");

  const cur = app.reviewSt.items[app.reviewSt.qi];
  app.answerReview(cur.opts.indexOf(cur.correct));
  const rec = app.state.jenn.reviewRecords[`${it.zh}::contextComprehension`];
  const last = rec.attempts[rec.attempts.length - 1];
  assert.equal(last.supported, true, "answered with the translation on screen");
  assert.equal(last.sameSession, true);
  assert.equal(rec.independentSuccesses.length, 0, "neither flag may advance the ladder");
});

test("A26: hearing a word and reading one are different records", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  const w = app.HSK_VOCAB[1][0];
  app.noteEvidence("jenn", { zh: w.zh }, "recognition", true, {});
  app.noteEvidence("jenn", { zh: w.zh }, "decoding", true, {});
  const recs = app.state.jenn.reviewRecords;
  assert.ok(recs[`${w.zh}::recognition`], "Listen: heard it, picked the character");
  assert.ok(recs[`${w.zh}::decoding`], "pinyin phase: saw the character, produced the reading");
  assert.notEqual(recs[`${w.zh}::recognition`], recs[`${w.zh}::decoding`],
    "proving one must not schedule the other as if it were already known");
});

test("A26: a decoding record is asked as a reading, not as a sound", (t) => {
  const app = bootApp();
  t.after(() => app.__stopAllTimers());
  seedDue(app, 3, "decoding");
  app.startReviewRound("normal");
  const it = app.reviewSt.items[0];
  assert.equal(it.kind, "decode");
  assert.equal(it.correct, it.py, "the answer is the reading");
  it.opts.forEach((o) => assert.ok(typeof o === "string" && o.length));
  // §9.6: options are readings, so no option may sound like the answer.
  const same = it.opts.filter((o) => o === it.correct);
  assert.equal(same.length, 1, "exactly one option is the right sound");
});

// ── S1: a merge must not hand out retention nobody earned ────────────────
// The checkpoint stored a stage from AFTER the retained attempts alongside
// successes covering only the SHED ones. seedFrom copied both, the replay
// re-advanced on every retained success the seed did not name, and merging a
// record with an identical copy moved the schedule days into the future.
//
// Expected values below are literals worked out by hand from LADDER and the
// attempt rules, never read back from mergeRecords — a test that asks the
// function under test what it thinks moves with the defect and cannot fail.

function att(on, i, o) {
  return Object.assign(
    { id: `s1_${on}_${i}`, at: i, on, correct: true, supported: false, sameSession: false, source: "t" },
    o || {}
  );
}
function replay(entries) {
  let rec = R.blankRecord("很", "meaning");
  entries.forEach((e) => { rec = R.applyAttempt(rec, e); });
  return rec;
}

test("S1: 40 successes on one day then two on the next sits at stage 2", () => {
  const rec = replay([
    ...Array.from({ length: 40 }, (_, i) => att("2025-09-01", i)),
    att("2025-09-02", 100), att("2025-09-02", 101),
  ]);
  // Two distinct unaided dates => two rungs. LADDER[1] is 3 days after 09-02.
  assert.equal(rec.stage, 2);
  assert.equal(rec.dueOn, "2025-09-05");
  assert.ok(rec.attempts.length === R.MAX_ATTEMPTS, "the history was trimmed, so a checkpoint exists");
  assert.ok(rec.checkpoint, "and it is populated");
});

test("S1: merging a record with an identical copy changes nothing", () => {
  const rec = replay([
    ...Array.from({ length: 40 }, (_, i) => att("2025-09-01", i)),
    att("2025-09-02", 100), att("2025-09-02", 101),
  ]);
  const merged = R.mergeRecords(rec, JSON.parse(JSON.stringify(rec)));
  assert.equal(merged.stage, 2, "no rung is gained by syncing");
  assert.equal(merged.dueOn, "2025-09-05", "and the due date does not move");
  assert.deepEqual(merged.independentSuccesses, ["2025-09-01", "2025-09-02"]);
});

test("S1: a self-merge does not skip two rungs when the shed prefix is a miss", () => {
  const rec = replay([
    att("2025-09-01", 0, { correct: false }), att("2025-09-01", 1, { correct: false }),
    ...Array.from({ length: 38 }, (_, i) => att("2025-09-01", i + 2)),
    att("2025-09-02", 100), att("2025-09-02", 101),
  ]);
  assert.equal(rec.stage, 2);
  assert.equal(rec.dueOn, "2025-09-05");
  const merged = R.mergeRecords(rec, JSON.parse(JSON.stringify(rec)));
  assert.equal(merged.stage, 2, "stage 2, not 4");
  assert.equal(merged.dueOn, "2025-09-05");
});

test("S1: supported answers in the shed prefix do not become retention", () => {
  const rec = replay([
    ...Array.from({ length: 39 }, (_, i) => att("2025-09-01", i, { supported: true })),
    att("2025-09-02", 100), att("2025-09-02", 101), att("2025-09-03", 102),
  ]);
  // Only 09-02 and 09-03 are unaided => stage 2, LADDER[1] = 3 days after 09-03.
  assert.equal(rec.stage, 2);
  assert.equal(rec.dueOn, "2025-09-06");
  const merged = R.mergeRecords(rec, JSON.parse(JSON.stringify(rec)));
  assert.equal(merged.stage, 2);
  assert.equal(merged.dueOn, "2025-09-06");
});

test("S1: merge stays order-independent after the fix", () => {
  const rec = replay([
    ...Array.from({ length: 40 }, (_, i) => att("2025-09-01", i)),
    att("2025-09-02", 100), att("2025-09-02", 101),
  ]);
  const copy = JSON.parse(JSON.stringify(rec));
  const ab = R.mergeRecords(rec, copy);
  const ba = R.mergeRecords(copy, rec);
  assert.equal(ab.stage, ba.stage);
  assert.equal(ab.dueOn, ba.dueOn);
  assert.deepEqual(ab.independentSuccesses, ba.independentSuccesses);
});

test("S1: the checkpoint's stage and its successes describe the same prefix", () => {
  const rec = replay([
    ...Array.from({ length: 40 }, (_, i) => att("2025-09-01", i)),
    att("2025-09-02", 100), att("2025-09-02", 101),
  ]);
  const cp = rec.checkpoint;
  // Every shed entry here is an unaided success on 09-01, so the folded prefix
  // reached exactly one rung and names exactly that one date.
  assert.deepEqual(cp.successes, ["2025-09-01"]);
  assert.equal(cp.stage, 1, "a checkpoint naming one date cannot claim two rungs");
});

test("S1: the same dates give the same set whatever order they arrive in", () => {
  const dates = Array.from({ length: 25 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
  const build = (order) => {
    let rec = R.blankRecord("久", "meaning");
    order.forEach((on, i) => { rec = R.applyAttempt(rec, { id: `d_${on}`, at: i, on, correct: true }); });
    return rec;
  };
  const a = build(dates);
  const b = build([...dates.slice(10), ...dates.slice(0, 10)]);
  // The bound keeps the twenty LATEST dates, which is a property of the dates
  // themselves — computed here — not of the order they were written in.
  const expected = [...dates].sort().slice(-20);
  assert.deepEqual(a.independentSuccesses, expected);
  assert.deepEqual(b.independentSuccesses, expected);
});

test("S1: firstTaughtOn is the earliest date seen, not the first one recorded", () => {
  let rec = R.blankRecord("久", "meaning");
  rec = R.applyAttempt(rec, { id: "late", at: 1, on: "2026-01-10", correct: true });
  rec = R.applyAttempt(rec, { id: "early", at: 0, on: "2026-01-01", correct: true });
  assert.equal(rec.firstTaughtOn, "2026-01-01",
    "statusOf measures a week from teaching; a late value costs the strongest label");
});

test("S1: a divergent fold under-states the ladder rather than inflating it", () => {
  const at = (id, on, o) =>
    Object.assign({ id, at: 0, on, correct: true, supported: false, sameSession: false }, o || {});
  const prefix = [at("p0", "2026-02-01", { correct: false }), at("p1", "2026-02-02"), at("p2", "2026-02-03")];
  let base = R.blankRecord("久", "meaning");
  prefix.forEach((e) => { base = R.applyAttempt(base, e); });
  assert.equal(base.stage, 2, "a miss then two unaided dates is two rungs");

  let folded = JSON.parse(JSON.stringify(base));
  for (let i = 0; i < 40; i++) {
    folded = R.applyAttempt(folded, at(`s${i}`, "2026-02-04", { supported: true }));
  }
  const retained = JSON.parse(JSON.stringify(base));
  const ab = R.mergeRecords(JSON.parse(JSON.stringify(folded)), JSON.parse(JSON.stringify(retained)));
  const ba = R.mergeRecords(JSON.parse(JSON.stringify(retained)), JSON.parse(JSON.stringify(folded)));

  assert.ok(ab.stage <= 2, "a merge must never invent a rung");
  assert.equal(ab.stage, ba.stage, "and must not depend on argument order");
  assert.equal(ab.dueOn, ba.dueOn);
  const again = R.mergeRecords(JSON.parse(JSON.stringify(ab)), JSON.parse(JSON.stringify(ab)));
  assert.equal(again.stage, ab.stage, "and must be stable on repeat");
});
