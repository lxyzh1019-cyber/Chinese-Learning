"use strict";
/**
 * Event-sourced merge of two divergent copies of one player.
 *
 * The revision check stops a stale write clobbering a newer one; these cover
 * what happens when the two copies genuinely diverge and must be reconciled.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const M = require("../js/merge-state.js");

function player(over) {
  return M.ensureLedger(Object.assign({
    totalStars: 0, weekStars: 0, gatesCompleted: [], badges: [], stickerIds: [],
    library: {}, failedWords: {}, traceStars: {}, storyReadCount: {},
    gateStars: {}, gateGameStars: {}, gateBestQuiz: {}, gateAttemptHistory: {},
    pendingSessions: {}, revision: 1,
  }, over || {}));
}

test("an existing total becomes the ledger baseline, so nothing is lost", () => {
  const p = M.ensureLedger({ totalStars: 6669, weekStars: 40 });
  assert.equal(p.starsBaseline, 6669);
  assert.equal(M.totalFromLedger(p), 6669, "the child still has what they had");
});

test("star awards apply once each, in either order", () => {
  const a = player({ totalStars: 100, starsBaseline: 100 });
  const b = player({ totalStars: 100, starsBaseline: 100 });
  M.recordStarEvent(a, 30, "earn", { id: "e1" });
  M.recordStarEvent(b, 30, "earn", { id: "e1" });   // the same award, seen twice
  M.recordStarEvent(b, 12, "earn", { id: "e2" });

  const forward = M.mergePlayers(a, b).player;
  const backward = M.mergePlayers(b, a).player;
  assert.equal(forward.totalStars, 142, "100 + 30 + 12, the duplicate counted once");
  assert.equal(backward.totalStars, 142, "and merge order does not matter");
});

test("a parent's deduction survives the merge instead of being maxed away", () => {
  // The device that took stars away has a LOWER total. A max() would undo it.
  const parentDevice = player({ totalStars: 100, starsBaseline: 100 });
  M.recordStarEvent(parentDevice, -40, "parent", { id: "p1" });
  parentDevice.totalStars = 60;

  const kidDevice = player({ totalStars: 100, starsBaseline: 100 });
  M.recordStarEvent(kidDevice, 10, "earn", { id: "e1" });
  kidDevice.totalStars = 110;

  const merged = M.mergePlayers(kidDevice, parentDevice).player;
  assert.equal(merged.totalStars, 70, "100 - 40 + 10; the deduction is replayed");
});

test("completions, badges and stickers are unioned, never dropped", () => {
  const a = player({ gatesCompleted: ["h1-g01", "h1-g02"], badges: ["first_story"], stickerIds: ["s1"] });
  const b = player({ gatesCompleted: ["h1-g02", "h1-g03"], badges: ["reader_5"], stickerIds: ["s2"] });
  const m = M.mergePlayers(a, b).player;
  assert.deepEqual(m.gatesCompleted.sort(), ["h1-g01", "h1-g02", "h1-g03"]);
  assert.deepEqual(m.badges.sort(), ["first_story", "reader_5"]);
  assert.deepEqual(m.stickerIds.sort(), ["s1", "s2"]);
});

test("learned characters and practice words are kept from both sides", () => {
  const a = player({
    library: { 水: { py: "shuǐ" } },
    failedWords: { 山: { zh: "山", failCount: 2, lastFailed: "2026-09-01" } },
    storyReadCount: { xia: 2 },
  });
  const b = player({
    library: { 山: { py: "shān" } },
    failedWords: { 山: { zh: "山", failCount: 5, lastFailed: "2026-09-04" } },
    storyReadCount: { xia: 1, shang: 3 },
  });
  const m = M.mergePlayers(a, b).player;
  assert.deepEqual(Object.keys(m.library).sort(), ["山", "水"]);
  assert.equal(m.failedWords["山"].failCount, 5, "the higher count wins");
  assert.equal(m.failedWords["山"].lastFailed, "2026-09-04", "and the later date");
  assert.equal(m.storyReadCount.xia, 2, "read counts climb");
  assert.equal(m.storyReadCount.shang, 3);
});

test("gate qualifying records take the best from either device", () => {
  const a = player({ gateGameStars: { "h1-g01": { trace: 3, match: 1, rain: 0, listen: 0 } } });
  const b = player({ gateGameStars: { "h1-g01": { trace: 0, match: 3, rain: 3, listen: 2 } } });
  const m = M.mergePlayers(a, b).player;
  assert.deepEqual(m.gateGameStars["h1-g01"], { trace: 3, match: 3, rain: 3, listen: 2 });
});

test("a best quiz record is taken whole, never assembled from two attempts", () => {
  const a = player({ gateBestQuiz: { "h1-g01": { accPct: 95, quizStars: 3, points: 120 } } });
  const b = player({ gateBestQuiz: { "h1-g01": { accPct: 70, quizStars: 2, points: 400 } } });
  const m = M.mergePlayers(a, b).player;
  assert.deepEqual(m.gateBestQuiz["h1-g01"], { accPct: 95, quizStars: 3, points: 120 },
    "the higher-accuracy attempt wins entire — not its accuracy with the other's points");
});

test("M-T17: a deadline reset is not undone by a late score from the dead attempt", () => {
  // This device reset the gate today. The fixture is the shape resetGateProgress
  // actually writes: game stars become a ZEROS OBJECT (the key stays), the best
  // quiz is deleted, and the reset counter advances. An earlier version of this
  // test used `gateGameStars: {}`, which the app never produces, and passed
  // while production resurrected all four threes (audit F02).
  const zeros = { trace: 0, match: 0, rain: 0, listen: 0 };
  const local = player({
    gateAttemptHistory: { "h1-g01": [{ attemptId: "old", endedKey: "2026-09-05", reason: "deadline" }] },
    gateGameStars: { "h1-g01": { ...zeros } },
    gateResetSeq: { "h1-g01": 1 },
  });
  // The other device was offline and still holds the expired attempt's stars.
  const remote = player({
    gateAttemptHistory: {},
    gateGameStars: { "h1-g01": { trace: 3, match: 3, rain: 3, listen: 3 } },
    gateBestQuiz: { "h1-g01": { accPct: 95, quizStars: 3, points: 200 } },
  });

  const m = M.mergePlayers(local, remote).player;
  assert.deepEqual(m.gateGameStars["h1-g01"], zeros, "expired credit does not come back");
  assert.equal(m.gateBestQuiz["h1-g01"], undefined);
  assert.equal(m.gateAttemptHistory["h1-g01"].length, 1, "the archive is kept");
  assert.equal(m.gateResetSeq["h1-g01"], 1);

  const back = M.mergePlayers(remote, local).player;
  assert.deepEqual(back.gateGameStars["h1-g01"], zeros, "whichever device merges");
  assert.equal(back.gateBestQuiz["h1-g01"], undefined);
});

test("F02: two same-day resets are told apart by attempt, not by date", () => {
  // Both devices reset the gate on the same day. Remote then earned a new 3★
  // under its replacement attempt; local's later reset (a second archived id
  // remote has never seen) supersedes it.
  const zeros = { trace: 0, match: 0, rain: 0, listen: 0 };
  const local = player({
    gateAttemptHistory: { "h1-g01": [
      { attemptId: "a1", endedKey: "2026-09-05", reason: "deadline" },
      { attemptId: "a2", endedKey: "2026-09-05", reason: "deadline" },
    ] },
    gateGameStars: { "h1-g01": { ...zeros } },
    gateResetSeq: { "h1-g01": 2 },
  });
  const remote = player({
    gateAttemptHistory: { "h1-g01": [{ attemptId: "a1", endedKey: "2026-09-05", reason: "deadline" }] },
    gateGameStars: { "h1-g01": { trace: 0, match: 3, rain: 0, listen: 0 } },
    gateResetSeq: { "h1-g01": 1 },
  });
  assert.deepEqual(M.mergePlayers(local, remote).player.gateGameStars["h1-g01"], zeros);
  assert.deepEqual(M.mergePlayers(remote, local).player.gateGameStars["h1-g01"], zeros);
});

test("F02: without a reset on either side, game stars still take the best of both", () => {
  const a = player({ gateGameStars: { "h1-g01": { trace: 3, match: 0, rain: 0, listen: 0 } } });
  const b = player({ gateGameStars: { "h1-g01": { trace: 0, match: 2, rain: 0, listen: 0 } } });
  assert.deepEqual(M.mergePlayers(a, b).player.gateGameStars["h1-g01"], { trace: 3, match: 2, rain: 0, listen: 0 });
});

test("F02: the live timer wins over one whose attempt is archived", () => {
  const dead = { startKey: "2026-08-01", deadlineKey: "2026-08-06", active: true, days: 5, attemptId: "g1-old" };
  const live = { startKey: "2026-09-06", deadlineKey: "2026-09-11", active: true, days: 5, attemptId: "g1-new" };
  const local = player({ gateTimers: { "h1-g01": dead } });
  const remote = player({
    gateTimers: { "h1-g01": live },
    gateAttemptHistory: { "h1-g01": [{ attemptId: "g1-old", endedKey: "2026-09-06", reason: "deadline" }] },
  });
  assert.deepEqual(M.mergePlayers(local, remote).player.gateTimers["h1-g01"], live);
  assert.deepEqual(M.mergePlayers(remote, local).player.gateTimers["h1-g01"], live);
});

test("F02: review evidence from both devices is kept, key by key", () => {
  const local = player({ reviewRecords: { "水::meaning": { wordId: "水", skill: "meaning", attempts: [{ on: "2026-09-01", correct: true }], lastSeenOn: "2026-09-01" } } });
  const remote = player({ reviewRecords: { "山::recognition": { wordId: "山", skill: "recognition", attempts: [{ on: "2026-09-02", correct: false }], lastSeenOn: "2026-09-02" } } });
  const m = M.mergePlayers(local, remote).player;
  assert.deepEqual(Object.keys(m.reviewRecords).sort(), ["山::recognition", "水::meaning"]);
  const empty = player({ reviewRecords: {} });
  assert.deepEqual(Object.keys(M.mergePlayers(empty, remote).player.reviewRecords), ["山::recognition"],
    "an empty local store no longer erases the other device's history");
});

test("F02: without a record merger, the copy with more evidence is kept", () => {
  const two = { wordId: "水", skill: "meaning", attempts: [{ on: "2026-09-01" }, { on: "2026-09-02" }], lastSeenOn: "2026-09-02", stage: 2 };
  const three = { wordId: "水", skill: "meaning", attempts: [{ on: "2026-09-01" }, { on: "2026-09-02" }, { on: "2026-09-03" }], lastSeenOn: "2026-09-03", stage: 3 };
  const m = M.mergePlayers(player({ reviewRecords: { "水::meaning": two } }), player({ reviewRecords: { "水::meaning": three } })).player;
  assert.equal(m.reviewRecords["水::meaning"].stage, 3);
});

test("F02: an injected record merger is used and its result is order-independent", () => {
  const R = require("../js/review-core.js");
  const day1 = "2026-09-01", day2 = "2026-09-03";
  // Device A saw an unaided success on day 1; device B saw one on day 3.
  const a = R.recordAttempt({}, { wordId: "水", skill: "meaning", correct: true, todayKey: day1, id: "e1" });
  const b = R.recordAttempt({}, { wordId: "水", skill: "meaning", correct: true, todayKey: day2, id: "e2" });
  const opts = { mergeReviewRecord: R.mergeRecords };
  const ab = M.mergePlayers(player({ reviewRecords: a }), player({ reviewRecords: b }), opts).player.reviewRecords["水::meaning"];
  const ba = M.mergePlayers(player({ reviewRecords: b }), player({ reviewRecords: a }), opts).player.reviewRecords["水::meaning"];
  // Two unaided successes on separate dates: stage 2, due 3 days after the second.
  assert.equal(ab.attempts.length, 2, "both attempts survive");
  assert.equal(ab.stage, 2);
  assert.equal(ab.dueOn, "2026-09-06");
  assert.deepEqual(ab.independentSuccesses, [day1, day2]);
  assert.deepEqual(ba, ab, "merge order does not change the schedule");
});

test("F02: a round the other device is still playing is adopted into an empty slot", () => {
  const theirs = { matched: 2, moves: 5, updatedAt: 200 };
  const local = player({ pendingSessions: { match: null } });
  const remote = player({ pendingSessions: { match: theirs } });
  const { player: m, notes } = M.mergePlayers(local, remote);
  assert.deepEqual(m.pendingSessions.match, theirs);
  assert.equal(m.conflictSessions.length, 0);
  assert.deepEqual(notes, []);
});

test("F02: a slot this device cleared after the other's save stays cleared", () => {
  const theirs = { matched: 2, moves: 5, updatedAt: 200 };
  const local = player({ pendingSessions: { match: null }, pendingSessionClearedAt: { match: 300 } });
  const remote = player({ pendingSessions: { match: theirs } });
  const m = M.mergePlayers(local, remote).player;
  assert.equal(m.pendingSessions.match, null, "the child finished that round here");
  assert.equal(m.pendingSessionClearedAt.match, 300);
});

test("two different rounds in progress are both kept, with the choice surfaced", () => {
  const a = player({ pendingSessions: { match: { matched: 2, moves: 5 } } });
  const b = player({ pendingSessions: { match: { matched: 4, moves: 9 } } });
  const { player: m, notes } = M.mergePlayers(a, b);
  assert.deepEqual(m.pendingSessions.match, { matched: 2, moves: 5 }, "this device keeps its round");
  assert.equal(m.conflictSessions.length, 1, "the other is preserved, not discarded");
  assert.deepEqual(m.conflictSessions[0].other, { matched: 4, moves: 9 });
  assert.match(notes[0], /two different match rounds/);
});

test("identical rounds in progress are not reported as a conflict", () => {
  const same = { matched: 2, moves: 5 };
  const { player: m, notes } = M.mergePlayers(
    player({ pendingSessions: { match: { ...same } } }),
    player({ pendingSessions: { match: { ...same } } })
  );
  assert.equal(m.conflictSessions.length, 0);
  assert.deepEqual(notes, []);
});

test("the ledger stays bounded, folding old events into the baseline", () => {
  const p = player({ totalStars: 0, starsBaseline: 0 });
  for (let i = 0; i < M.MAX_LEDGER + 120; i++) M.recordStarEvent(p, 1, "earn", { id: `e${i}` });
  assert.equal(p.starLedger.length, M.MAX_LEDGER, "a player document cannot grow without limit");
  assert.equal(M.totalFromLedger(p), M.MAX_LEDGER + 120, "and the total is still exact");
});

test("merging is idempotent — doing it twice changes nothing", () => {
  const a = player({ totalStars: 50, starsBaseline: 50, gatesCompleted: ["h1-g01"] });
  const b = player({ totalStars: 50, starsBaseline: 50, gatesCompleted: ["h1-g02"] });
  M.recordStarEvent(a, 10, "earn", { id: "e1" });
  M.recordStarEvent(b, 20, "earn", { id: "e2" });

  const once = M.mergePlayers(a, b).player;
  const twice = M.mergePlayers(once, b).player;
  assert.equal(twice.totalStars, once.totalStars, "no double counting on a repeat merge");
  assert.deepEqual(twice.gatesCompleted.sort(), once.gatesCompleted.sort());
});

test("the merged copy is ahead of both inputs so it is the one that gets written", () => {
  const a = player({ revision: 4 });
  const b = player({ revision: 9 });
  const m = M.mergePlayers(a, b).player;
  assert.ok(m.revision > 9, "otherwise the write would be refused again");
});
