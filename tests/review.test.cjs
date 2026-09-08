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
