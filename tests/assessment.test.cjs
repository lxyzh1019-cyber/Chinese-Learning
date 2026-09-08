"use strict";
/**
 * Assessment engine — A-T01 … A-T14 from the implementation plan.
 *
 * These run against the real C1 bank in data/assessment, not a toy fixture, so
 * a content change that breaks the engine's assumptions shows up here.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const C = require("../js/assessment-core.js");

const DIR = path.join(__dirname, "..", "data", "assessment");
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
const bank = JSON.parse(fs.readFileSync(path.join(DIR, manifest.files.items), "utf8"));
const forms = JSON.parse(fs.readFileSync(path.join(DIR, manifest.files.forms), "utf8"));

function newAttempt(over) {
  return C.createAttempt(Object.assign({
    attemptId: "att-1", playerId: "jenn", bankVersion: bank.bankVersion,
    formId: "A", bands: ["C1"],
  }, over));
}

/** Answer a whole domain: `n` correct, the rest wrong. */
function answerDomain(attempt, domain, correct, opts = {}) {
  const items = C.selectItems(bank, forms, attempt.formId, "C1").filter((i) => i.domain === domain);
  items.forEach((item, i) => {
    C.present(attempt, item);
    if (opts.leaveUnanswered && i >= opts.leaveUnanswered) return;
    const good = i < correct;
    const wrongId = (item.options.find((o) => o.id !== item.acceptedOptionIds[0]) || {}).id;
    C.respond(attempt, {
      itemId: item.id,
      selectedOptionId: good ? item.acceptedOptionIds[0] : wrongId,
      inputStatus: C.INPUT_SUBMITTED,
    });
  });
  return items;
}

test("A-T01: partial answers give submitted counts, never a completed-domain score", () => {
  const a = newAttempt();
  const items = C.selectItems(bank, forms, "A", "C1").filter((i) => i.domain === "meaning_context").slice(0, 4);
  items.forEach((it) => C.present(a, it));
  C.respond(a, { itemId: items[0].id, selectedOptionId: items[0].acceptedOptionIds[0] });
  C.respond(a, { itemId: items[1].id, selectedOptionId: items[1].options[3].id });
  C.respond(a, { itemId: items[2].id, inputStatus: C.INPUT_DONT_KNOW });
  // items[3] left entirely unanswered

  const s = C.scoreAttempt(a, bank, forms);
  const d = s.domains.meaning_context;
  assert.equal(d.correct, 1);
  assert.equal(d.submitted, 3, "'I don't know' counts as submitted and wrong");
  assert.equal(d.dontKnow, 1);
  assert.ok(d.unanswered > 0, "the untouched items are unanswered");
  assert.equal(d.complete, false);
  assert.equal(d.completedDomainPct, null, "no completed-domain percentage from a partial domain");
  assert.equal(s.overall, null, "no blended overall ability score");
});

test("A-T02: meeting all three thresholds offers the next band", () => {
  const a = newAttempt();
  answerDomain(a, "recognition_unaided", 6);
  answerDomain(a, "meaning_context", 6);
  answerDomain(a, "passage_comprehension", 4);
  answerDomain(a, "decoding_supported", 0);   // must not affect routing
  const s = C.scoreAttempt(a, bank, forms);
  const r = C.routeNextBand(s, "C1");
  assert.equal(r.advance, true);
  assert.equal(r.nextBand, "C2");
  assert.equal(r.provisional, true, "the recommendation is provisional, not a diagnosis");
});

test("A-T03: a mixed profile does not average into a pass", () => {
  const a = newAttempt();
  answerDomain(a, "recognition_unaided", 8);
  answerDomain(a, "meaning_context", 5);      // below threshold
  answerDomain(a, "passage_comprehension", 6);
  const s = C.scoreAttempt(a, bank, forms);
  const r = C.routeNextBand(s, "C1");
  assert.equal(r.advance, false, "strong recognition does not compensate for weak meaning");
  assert.ok(r.reasons.some((x) => x.startsWith("meaning_context")), "the report names the profile");
});

test("A-T04: a double tap produces one response and one score", () => {
  const a = newAttempt();
  const item = C.selectItems(bank, forms, "A", "C1")[0];
  C.present(a, item);
  const first = C.respond(a, { itemId: item.id, selectedOptionId: item.acceptedOptionIds[0] });
  const second = C.respond(a, { itemId: item.id, selectedOptionId: item.options[2].id });
  assert.equal(first.committed, true);
  assert.equal(second.committed, false, "the second tap is refused");
  assert.equal(a.responses.filter((r) => r.itemId === item.id).length, 1);
  assert.equal(a.responses[0].selectedOptionId, item.acceptedOptionIds[0], "the original answer stands");
});

test("A-T05: pause and resume keep the attempt and its presentation order", () => {
  const a = newAttempt();
  const items = C.selectItems(bank, forms, "A", "C1").slice(0, 3);
  items.forEach((it) => C.present(a, it));
  const orderBefore = a.presentations.map((p) => p.optionOrder.join(","));

  C.transition(a, "active");
  C.transition(a, "paused");
  C.transition(a, "active");

  items.forEach((it) => C.present(a, it));   // re-entering must not reshuffle
  const orderAfter = a.presentations.map((p) => p.optionOrder.join(","));
  assert.deepEqual(orderAfter, orderBefore, "options are not reshuffled on resume");
  assert.equal(a.presentations.length, 3, "re-presenting does not duplicate");
});

test("A-T06: repeating a form makes a new attempt with identical content", () => {
  const original = newAttempt();
  const items = C.selectItems(bank, forms, "A", "C1").slice(0, 5);
  items.forEach((it) => C.present(original, it));
  items.forEach((it) => C.respond(original, { itemId: it.id, selectedOptionId: it.acceptedOptionIds[0] }));
  const snapshot = JSON.stringify(original);

  const repeat = newAttempt({ attemptId: "att-2", mode: "repeat", comparisonAttemptId: "att-1" });
  const repeatItems = C.selectItems(bank, forms, repeat.formId, "C1").slice(0, 5);
  assert.deepEqual(repeatItems.map((i) => i.id), items.map((i) => i.id), "identical items in identical order");
  assert.notEqual(repeat.attemptId, original.attemptId);
  assert.equal(JSON.stringify(original), snapshot, "the original attempt is untouched");
});

test("A-T07: A-versus-B compares like with like and separates anchors", () => {
  const a = newAttempt({ attemptId: "a", formId: "A" });
  answerDomain(a, "recognition_unaided", 4);
  const b = newAttempt({ attemptId: "b", formId: "B" });
  answerDomain(b, "recognition_unaided", 7);

  const cmp = C.compareAttempts(a, b, bank, forms);
  assert.equal(cmp.comparable, true);
  assert.equal(cmp.sameForm, false);
  assert.match(cmp.label, /not statistically equated/);
  assert.ok(cmp.anchors.recognition_unaided, "anchor items reported separately");
  assert.ok(cmp.fresh.recognition_unaided, "fresh items reported separately");
  assert.ok(cmp.anchors.recognition_unaided.sampleSize.before >= 1, "anchor sample size is shown");
});

test("A-T08: attempts on different bank versions are not directly comparable", () => {
  const a = newAttempt({ attemptId: "a" });
  const b = newAttempt({ attemptId: "b" });
  b.bankVersion = "2.0.0";
  const cmp = C.compareAttempts(a, b, bank, forms);
  assert.equal(cmp.comparable, false);
  assert.match(cmp.reason, /Not directly comparable/);
});

test("A-T09: writing with no reviewer is unassessed, not zero", () => {
  const a = newAttempt();
  answerDomain(a, "recognition_unaided", 8);
  const writing = C.selectItems(bank, forms, "A", "C1").filter((i) => i.domain === "writing_recall");
  writing.forEach((it) => {
    C.present(a, it);
    C.respond(a, { itemId: it.id, writingRef: "canvas-blob-ref", inputStatus: C.INPUT_SUBMITTED });
  });

  const s = C.scoreAttempt(a, bank, forms);
  const w = s.domains.writing_recall;
  assert.equal(w.awaitingReview, writing.length, "all writing awaits review");
  assert.equal(w.correct, 0);
  assert.equal(w.submitted, 0, "unreviewed writing is not counted as a submitted score");
  assert.equal(w.completedDomainPct, null, "no verified writing percentage");
  // The reading report is still available.
  assert.equal(s.domains.recognition_unaided.complete, true);
});

test("A-T10: a failed clip leaves the item unanswered, never wrong", () => {
  const a = newAttempt();
  const item = C.selectItems(bank, forms, "A", "C1").find((i) => i.domain === "recognition_unaided");
  C.present(a, item);
  C.respond(a, { itemId: item.id, inputStatus: C.INPUT_UNANSWERED });
  const s = C.scoreAttempt(a, bank, forms);
  const d = s.domains.recognition_unaided;
  assert.equal(d.unanswered, 8, "the whole domain is untouched apart from this, and this one is unanswered");
  assert.equal(d.submitted, 0, "a technical failure is not a submitted answer");
  assert.equal(d.correct, 0);
});

test("A-T12: an attempt's owner is fixed at creation", () => {
  const a = newAttempt({ playerId: "jenn" });
  const item = C.selectItems(bank, forms, "A", "C1")[0];
  C.present(a, item);
  C.respond(a, { itemId: item.id, selectedOptionId: item.acceptedOptionIds[0] });
  const s = C.scoreAttempt(a, bank, forms);
  assert.equal(a.playerId, "jenn");
  assert.equal(s.playerId, "jenn", "the score is attributed to the attempt's owner, not a current global");
});

test("A-T13: submission is one-way and re-scoring is stable", () => {
  const a = newAttempt();
  answerDomain(a, "meaning_context", 6);
  C.transition(a, "active");
  C.transition(a, "submitted");
  C.transition(a, "results_available");
  const first = JSON.stringify(C.scoreAttempt(a, bank, forms));
  const second = JSON.stringify(C.scoreAttempt(a, bank, forms));
  assert.equal(first, second, "opening the report repeatedly does not change it");
  assert.throws(() => C.transition(a, "active"), /invalid transition/, "a submitted attempt cannot reopen");
});

test("A-T13b: a reviewer's writing grade is applied without touching raw responses", () => {
  const a = newAttempt();
  const item = C.selectItems(bank, forms, "A", "C1").find((i) => i.domain === "writing_recall");
  C.present(a, item);
  C.respond(a, { itemId: item.id, writingRef: "ref", inputStatus: C.INPUT_SUBMITTED });
  const rawBefore = JSON.stringify(a.responses);

  a.writingReviews.push({ itemId: item.id, rubricId: "writing-recall-v1", rubricScore: 2,
    reviewedAt: "2026-09-06T00:00:00Z", reason: "clear form, right components" });
  a.resultVersion++;

  const s = C.scoreAttempt(a, bank, forms);
  assert.equal(s.domains.writing_recall.submitted, 1, "the reviewed prompt now counts");
  assert.equal(s.domains.writing_recall.correct, 1);
  assert.equal(JSON.stringify(a.responses), rawBefore, "raw responses are immutable");
  assert.equal(a.resultVersion, 2, "the result version moved");
});

test("routing at the ceiling reports the ceiling honestly", () => {
  const a = newAttempt();
  answerDomain(a, "recognition_unaided", 8);
  answerDomain(a, "meaning_context", 8);
  answerDomain(a, "passage_comprehension", 6);
  const r = C.routeNextBand(C.scoreAttempt(a, bank, forms), "C4");
  assert.equal(r.atCeiling, true);
  assert.match(r.note, /Highest available custom band sampled/);
});

test("the bank never awards stars or touches gate state", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "assessment-core.js"), "utf8");
  ["addEarnedStars", "gateGameStars", "gatesCompleted", "updateGateGameBest", "logWrong"].forEach((f) => {
    assert.ok(!src.includes(f), `assessment-core must not reference ${f}`);
  });
});

// ── persistence (A-T11, A-T14) ──────────────────────────────────────────────
const S = require("../js/player-store.js");

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

/** Firestore stub holding one revision per path. */
function fakeDb(seed = {}) {
  const docs = Object.assign({}, seed);
  return {
    docs,
    collection: (c) => ({
      doc: (a) => ({
        collection: (s) => ({
          doc: (b) => {
            const key = `${c}/${a}/${s}/${b}`;
            return {
              get: async () => ({ exists: key in docs, data: () => docs[key] }),
              set: async (v) => { docs[key] = JSON.parse(JSON.stringify(v)); },
            };
          },
        }),
      }),
    }),
  };
}

test("attempts are stored under the player who took them", () => {
  assert.equal(
    S.attemptPath("jenn", "att-1"),
    "chinese-adventure/jenn/assessments/att-1"
  );
});

test("a local save reports 'Saved on this device', not 'Synced'", () => {
  const ctx = { storage: memStorage(), db: null };
  const a = newAttempt();
  const res = S.saveAttempt(ctx, a);
  assert.equal(res.localOk, true);
  assert.equal(res.status, S.SYNC_LOCAL, "local success must not be reported as synced");
  assert.equal(S.loadAttempt(ctx, a.attemptId).attemptId, a.attemptId);
});

test("A-T11: two devices answering the same item surface a conflict, not a silent overwrite", async () => {
  const item = C.selectItems(bank, forms, "A", "C1")[0];

  // Device A answers correctly and syncs.
  const deviceA = newAttempt();
  C.present(deviceA, item);
  C.respond(deviceA, { itemId: item.id, selectedOptionId: item.acceptedOptionIds[0] });
  const db = fakeDb();
  const ctxA = { storage: memStorage(), db };
  assert.equal((await S.pushAttempt(ctxA, deviceA)).ok, true);

  // Device B was offline with the same attempt and answered differently.
  const deviceB = JSON.parse(JSON.stringify(newAttempt()));
  C.present(deviceB, item);
  C.respond(deviceB, { itemId: item.id, selectedOptionId: item.options[2].id });
  // Its revision is behind what is now stored.
  deviceB.revision = 1;
  db.docs[S.attemptPath("jenn", "att-1")].revision = 9;

  const res = await S.pushAttempt({ storage: memStorage(), db }, deviceB);
  assert.equal(res.ok, false, "the stale write is refused");
  assert.equal(res.status, S.SYNC_ATTENTION);
  assert.ok(res.conflict, "a conflict is surfaced");
  assert.equal(res.conflict.conflictingItems.length, 1, "the disputed item is named");
  assert.equal(res.conflict.conflictingItems[0].itemId, item.id);
  assert.ok(res.conflict.local && res.conflict.remote, "both records are preserved");
});

test("distinct attempts append independently rather than colliding", async () => {
  const db = fakeDb();
  const ctx = { storage: memStorage(), db };
  await S.pushAttempt(ctx, newAttempt({ attemptId: "att-1" }));
  await S.pushAttempt(ctx, newAttempt({ attemptId: "att-2" }));
  assert.ok(db.docs[S.attemptPath("jenn", "att-1")]);
  assert.ok(db.docs[S.attemptPath("jenn", "att-2")]);
});

test("an offline save stays queued and flushes when the db returns", async () => {
  const storage = memStorage();
  const a = newAttempt();
  S.saveAttempt({ storage, db: null }, a);
  assert.equal(S.readLocal(storage).queue.length, 1, "queued while offline");

  const out = await S.flushQueue({ storage, db: fakeDb() });
  assert.equal(out.pending, 0);
  assert.equal(out.conflicts.length, 0);
  assert.equal(out.status, S.SYNC_OK);
});

test("A-T14: excluding a faulty anchor adjusts both denominators and keeps the originals", () => {
  const a = newAttempt({ attemptId: "a", formId: "A" });
  answerDomain(a, "recognition_unaided", 4);
  const b = newAttempt({ attemptId: "b", formId: "B" });
  answerDomain(b, "recognition_unaided", 7);
  const cmp = C.compareAttempts(a, b, bank, forms);

  const bad = bank.items.find((i) => i.anchorGroupId && i.domain === "recognition_unaided").id;
  const revised = S.excludeItems(cmp, [bad], "anchor found to have two defensible answers");

  assert.deepEqual(revised.excludedItems, [bad]);
  assert.match(revised.note, /both sides/);
  assert.match(revised.note, /unchanged/);
  assert.ok(revised.anchors, "the comparison itself is still reported");
  assert.equal(a.responses.length > 0 && b.responses.length > 0, true, "raw records survive");
});

// ── multi-band routing (C1 → C4) ────────────────────────────────────────────

/** Answer one band's domain: `correct` right, the rest wrong. */
function answerBand(attempt, band, domain, correct) {
  const items = C.selectItems(bank, forms, attempt.formId, band).filter((i) => i.domain === domain);
  items.forEach((item, i) => {
    C.present(attempt, item);
    const wrongId = (item.options.find((o) => o.id !== item.acceptedOptionIds[0]) || {}).id;
    C.respond(attempt, {
      itemId: item.id,
      selectedOptionId: i < correct ? item.acceptedOptionIds[0] : wrongId,
      inputStatus: C.INPUT_SUBMITTED,
    });
  });
}

/** Clear a whole band's routing domains at full marks. */
function clearBand(attempt, band) {
  if (attempt.bands.indexOf(band) === -1) attempt.bands.push(band);
  answerBand(attempt, band, "recognition_unaided", 8);
  answerBand(attempt, band, "meaning_context", 8);
  answerBand(attempt, band, "passage_comprehension", 6);
}

test("the bank carries all four bands with a complete form pair each", () => {
  assert.deepEqual(manifest.bands, ["C1", "C2", "C3", "C4"]);
  for (const band of manifest.bands) {
    for (const formId of ["A", "B"]) {
      assert.equal(C.selectItems(bank, forms, formId, band).length, 34,
        `${formId}/${band} should hold 34 scored opportunities`);
    }
  }
  assert.equal(bank.items.length, 240, "240 distinct authored prompts");
});

test("bands are scored separately, never pooled", () => {
  const a = newAttempt();
  clearBand(a, "C1");
  a.bands.push("C2");
  answerBand(a, "C2", "recognition_unaided", 2);   // weak in C2

  const s = C.scoreAttempt(a, bank, forms);
  assert.equal(s.byBand.C1.domains.recognition_unaided.correct, 8);
  assert.equal(s.byBand.C1.domains.recognition_unaided.expected, 8, "C1 keeps its own denominator");
  assert.equal(s.byBand.C2.domains.recognition_unaided.correct, 2);
  assert.equal(s.byBand.C2.domains.recognition_unaided.expected, 8, "C2 keeps its own denominator");
});

test("a strong lower band cannot carry a weak higher one", () => {
  const a = newAttempt();
  clearBand(a, "C1");
  a.bands.push("C2");
  answerBand(a, "C2", "recognition_unaided", 2);
  answerBand(a, "C2", "meaning_context", 2);
  answerBand(a, "C2", "passage_comprehension", 1);

  const s = C.scoreAttempt(a, bank, forms);
  assert.equal(C.routeNextBand(s, "C1").advance, true, "C1 was cleared");
  assert.equal(C.routeNextBand(s, "C2").advance, false, "C2 was not, despite a perfect C1");
});

test("a child can be routed all the way from C1 to the C4 ceiling", () => {
  const a = newAttempt();
  ["C1", "C2", "C3", "C4"].forEach((b) => clearBand(a, b));
  const s = C.scoreAttempt(a, bank, forms);

  assert.equal(C.routeNextBand(s, "C1").nextBand, "C2");
  assert.equal(C.routeNextBand(s, "C2").nextBand, "C3");
  assert.equal(C.routeNextBand(s, "C3").nextBand, "C4");

  const top = C.routeNextBand(s, "C4");
  assert.equal(top.advance, false);
  assert.equal(top.atCeiling, true);
  assert.match(top.note, /Highest available custom band sampled/);
  assert.deepEqual(s.bands, ["C1", "C2", "C3", "C4"]);
});

test("supported decoding and writing never affect routing, in any band", () => {
  const a = newAttempt();
  clearBand(a, "C2");
  answerBand(a, "C2", "decoding_supported", 0);   // total failure with pinyin help
  // writing left entirely unreviewed
  const r = C.routeNextBand(C.scoreAttempt(a, bank, forms), "C2");
  assert.equal(r.advance, true, "leaning on pinyin does not block the next band");
  assert.ok(!r.reasons.some((x) => x.startsWith("decoding_supported")));
  assert.ok(!r.reasons.some((x) => x.startsWith("writing_recall")));
});

test("every band's recognition and decoding target sets stay disjoint", () => {
  for (const band of manifest.bands) {
    for (const formId of ["A", "B"]) {
      const items = C.selectItems(bank, forms, formId, band);
      const rec = new Set(items.filter((i) => i.domain === "recognition_unaided").flatMap((i) => i.targetWordIds));
      const dec = new Set(items.filter((i) => i.domain === "decoding_supported").flatMap((i) => i.targetWordIds));
      const overlap = [...rec].filter((t) => dec.has(t));
      assert.deepEqual(overlap, [], `${formId}/${band}: pinyin support must not coach an unaided target`);
    }
  }
});

test("every audio item resolves to a fixed clip, never device speech", () => {
  const audioDomains = ["recognition_unaided", "decoding_supported"];
  bank.items.filter((i) => audioDomains.includes(i.domain)).forEach((item) => {
    item.options.forEach((o) => {
      assert.ok(o.audioAssetId, `${item.id}: option ${o.id} has no clip`);
      assert.match(o.audioAssetId, /^[a-z]+[1-4]$/,
        `${item.id}: ${o.audioAssetId} is not a toned syllable — a neutral tone would play the wrong reading`);
    });
  });
});

// ── bank 1.1.0: no answer reachable without reading ────────────────────────

test("A-T20: no audio item is answerable by elimination", () => {
  // Bank 1.0.0 took distractors as the first three other words in list order,
  // so items 5 onward offered three sounds that were the correct answers of
  // items 1-3: 40 of 128 audio items could be answered by process of
  // elimination, without reading the character at all.
  const audio = ["recognition_unaided", "decoding_supported"];
  for (const formId of ["A", "B"]) {
    for (const band of manifest.bands) {
      for (const domain of audio) {
        const items = C.selectItems(bank, forms, formId, band).filter((i) => i.domain === domain);
        const answered = new Set();
        for (const it of items) {
          const ok = it.options.find((o) => o.id === it.acceptedOptionIds[0]);
          const wrong = it.options.filter((o) => o.id !== it.acceptedOptionIds[0]).map((o) => o.audioAssetId);
          assert.ok(!wrong.every((w) => answered.has(w)),
            `${it.id}: every wrong option is an earlier correct answer`);
          answered.add(ok.audioAssetId);
        }
      }
    }
  }
});

test("A-T21: a distractor is never a target sound anywhere in the bank", () => {
  const audio = ["recognition_unaided", "decoding_supported"];
  const targets = new Set(bank.items.filter((i) => audio.includes(i.domain))
    .map((i) => i.options.find((o) => o.id === i.acceptedOptionIds[0]).audioAssetId));
  bank.items.filter((i) => audio.includes(i.domain)).forEach((it) => {
    it.options.filter((o) => o.id !== it.acceptedOptionIds[0]).forEach((o) => {
      assert.ok(!targets.has(o.audioAssetId),
        `${it.id}: distractor ${o.audioAssetId} is a target elsewhere`);
    });
  });
});

test("A-T22: a section does not offer the same wrong options throughout", () => {
  // 32 distinct distractor sets across the whole bank made a section read as
  // one question asked eight times, whether or not it could be solved.
  const audio = ["recognition_unaided", "decoding_supported"];
  for (const formId of ["A", "B"]) {
    for (const band of manifest.bands) {
      for (const domain of audio) {
        const items = C.selectItems(bank, forms, formId, band).filter((i) => i.domain === domain);
        const sets = new Set(items.map((it) => it.options
          .filter((o) => o.id !== it.acceptedOptionIds[0])
          .map((o) => o.audioAssetId).sort().join(",")));
        assert.ok(sets.size >= Math.ceil(items.length / 2),
          `${formId}/${band}/${domain}: only ${sets.size} distinct sets for ${items.length} items`);
      }
    }
  }
});

test("A-T23: the correct option is spread evenly across the four slots", () => {
  // If the shuffle favoured a slot, a child could learn the position instead of
  // the character — a second route to a right answer without reading.
  const slots = [0, 0, 0, 0];
  let n = 0;
  for (let k = 0; k < 120; k++) {
    const a = C.createAttempt({ attemptId: `slot-${k}`, playerId: "jenn", bankVersion: manifest.bankVersion, formId: "A", bands: ["C1"] });
    for (const it of C.selectItems(bank, forms, "A", "C1")) {
      if (!it.options.length) continue;
      const p = C.present(a, it, {});
      slots[p.optionOrder.indexOf(it.acceptedOptionIds[0])]++;
      n++;
    }
  }
  slots.forEach((c, i) => {
    const pct = c / n;
    assert.ok(pct > 0.2 && pct < 0.3, `slot ${i + 1} holds the answer ${(pct * 100).toFixed(1)}% of the time`);
  });
});

test("A-T24: bands carry a name and the manifest refuses to call them HSK levels", () => {
  assert.ok(manifest.bandInfo, "band metadata ships with the bank");
  for (const b of manifest.bands) {
    const info = manifest.bandInfo[b];
    assert.ok(info && info.name && info.about, `${b}: needs a name and a description`);
    assert.ok(/[一-鿿]/.test(info.zh), `${b}: needs a Chinese name`);
    assert.ok(!/^HSK/i.test(info.name), `${b}: must not be presented as an HSK level`);
  }
  assert.match(manifest.bandNote, /not HSK levels/);
});

test("A-T25: a writing review scores the domain and leaves the answers alone", () => {
  // The scorer always read writingReviews and the bank always shipped the
  // rubric, but nothing in the app ever wrote one — so every report said
  // "waiting for a grown-up" permanently.
  const a = C.createAttempt({ attemptId: "wr-1", playerId: "jenn", bankVersion: manifest.bankVersion, formId: "A", bands: ["C1"] });
  const writing = C.selectItems(bank, forms, "A", "C1").filter((i) => i.domain === "writing_recall");
  assert.equal(writing.length, 4);
  writing.forEach((it) => {
    C.present(a, it, {});
    C.respond(a, { itemId: it.id, selectedOptionId: null, inputStatus: C.INPUT_SUBMITTED, writingRef: "paper" });
  });
  const before = JSON.parse(JSON.stringify(a.responses));

  let s = C.scoreAttempt(a, bank, forms);
  assert.equal(s.byBand.C1.domains.writing_recall.awaitingReview, 4, "unreviewed writing is unassessed, not zero");
  assert.equal(s.byBand.C1.domains.writing_recall.correct, 0);

  // Three of four right, which is what both children actually wrote.
  writing.forEach((it, i) => {
    a.writingReviews.push({ itemId: it.id, rubricId: "writing-recall-v1", rubricScore: i < 3 ? 2 : 0,
      reviewedAt: "2026-09-08T00:00:00Z", reason: "marked in the app by a grown-up" });
  });
  s = C.scoreAttempt(a, bank, forms);
  assert.equal(s.byBand.C1.domains.writing_recall.correct, 3);
  assert.equal(s.byBand.C1.domains.writing_recall.expected, 4);
  assert.equal(s.byBand.C1.domains.writing_recall.awaitingReview, 0);
  assert.deepEqual(a.responses, before, "a review is a second opinion on an answer, never a rewrite of it");
});

test("A-T26: an attempt can start at a band other than the first", () => {
  const a = C.createAttempt({ attemptId: "b3", playerId: "jess", bankVersion: manifest.bankVersion, formId: "A", bands: ["C3"] });
  assert.deepEqual(a.bands, ["C3"]);
  const items = C.selectItems(bank, forms, a.formId, "C3");
  assert.equal(items.length, 34);
  assert.ok(items.every((i) => i.band === "C3"), "and is scored on that band's own items only");
});

test("A-T27: the report can say why it stopped, and how far off it was", () => {
  const a = C.createAttempt({ attemptId: "why", playerId: "jenn", bankVersion: manifest.bankVersion, formId: "A", bands: ["C1"] });
  // Recall everything, understand nothing — the shape of the real baseline.
  C.selectItems(bank, forms, "A", "C1").forEach((it) => {
    if (it.domain === "writing_recall") return;
    C.present(a, it, {});
    const correct = it.domain !== "meaning_context";
    C.respond(a, { itemId: it.id,
      selectedOptionId: correct ? it.acceptedOptionIds[0] : it.options.find((o) => o.id !== it.acceptedOptionIds[0]).id,
      inputStatus: C.INPUT_SUBMITTED });
  });
  const route = C.routeNextBand(C.scoreAttempt(a, bank, forms), "C1");
  assert.equal(route.advance, false);
  const meaning = route.reasons.find((r) => r.startsWith("meaning_context"));
  assert.match(meaning, /0\/8 \(need 6\)/, "the reason names the domain, the score and the bar");
});

test("A-T28: a domain at chance is flagged rather than read as a result", () => {
  const a = C.createAttempt({ attemptId: "chance", playerId: "jenn", bankVersion: manifest.bankVersion, formId: "A", bands: ["C1"] });
  C.selectItems(bank, forms, "A", "C1").forEach((it) => {
    if (it.domain !== "meaning_context") return;
    C.present(a, it, {});
    C.respond(a, { itemId: it.id, selectedOptionId: it.options.find((o) => o.id !== it.acceptedOptionIds[0]).id,
      inputStatus: C.INPUT_SUBMITTED });
  });
  const d = C.scoreAttempt(a, bank, forms).byBand.C1.domains.meaning_context;
  assert.equal(d.chanceLevel, 2, "four options over eight items");
  assert.equal(d.atChance, true);
  assert.equal(typeof d.medianSecs, "number", "answer pace comes from data already stored");
});

// ── F03: device lock, cloud discovery, transactional compare-and-set ────────
// Audit finding F03. The cloud is a stub throughout: the sandbox blocks the
// Firebase CDN, so no test here can reach Firestore.

/** Firestore stub with a transaction and a collection listing. */
function txFakeDb(seed = {}) {
  const docs = Object.assign({}, seed);
  const docRef = (key) => ({
    get: async () => ({ exists: key in docs, data: () => docs[key] }),
    set: async (v) => { docs[key] = JSON.parse(JSON.stringify(v)); },
    _key: key,
  });
  const db = {
    docs, transactions: 0,
    collection: (c) => ({
      doc: (a) => ({
        collection: (s) => ({
          doc: (b) => docRef(`${c}/${a}/${s}/${b}`),
          get: async () => ({
            docs: Object.keys(docs).filter((k) => k.startsWith(`${c}/${a}/${s}/`)).map((k) => ({ data: () => docs[k] })),
          }),
        }),
      }),
    }),
    runTransaction: async (fn) => {
      db.transactions++;
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, v) => { docs[ref._key] = JSON.parse(JSON.stringify(v)); },
      };
      return fn(tx);
    },
  };
  return db;
}

test("F03: a push is accepted only when the cloud still holds the acknowledged base revision", async () => {
  const storage = memStorage();
  const db = txFakeDb();
  const ctx = { storage, db };
  const a = newAttempt();
  a.revision = 5;
  assert.equal((await S.pushAttempt(ctx, a)).ok, true, "first write lands");
  assert.equal(S.readLocal(storage).synced["att-1"], 5, "revision 5 is the acknowledged base");
  assert.equal(db.transactions, 1, "inside a transaction");

  a.revision = 9;
  assert.equal((await S.pushAttempt(ctx, a)).ok, true, "same device advancing from its own base");
  assert.equal(S.readLocal(storage).synced["att-1"], 9);

  // Another device wrote revision 10 meanwhile; this device is still based on 9.
  db.docs[S.attemptPath("jenn", "att-1")].revision = 10;
  a.revision = 12;
  const res = await S.pushAttempt(ctx, a);
  assert.equal(res.ok, false, "refused even though 12 > 10 — the old strictly-greater rule accepted this");
  assert.equal(res.status, S.SYNC_ATTENTION);
  assert.equal(res.conflict.remoteRevision, 10);
  assert.equal(db.docs[S.attemptPath("jenn", "att-1")].revision, 10, "the cloud copy was not overwritten");
});

test("F03: a different answer at the SAME revision is refused, not silently written over", async () => {
  const item = C.selectItems(bank, forms, "A", "C1")[0];
  const cloud = newAttempt();
  C.present(cloud, item);
  C.respond(cloud, { itemId: item.id, selectedOptionId: item.acceptedOptionIds[0] });   // revision 2
  const db = txFakeDb({ [S.attemptPath("jenn", "att-1")]: JSON.parse(JSON.stringify(cloud)) });

  const other = newAttempt();
  C.present(other, item);
  C.respond(other, { itemId: item.id, selectedOptionId: item.options[2].id });           // also revision 2
  const res = await S.pushAttempt({ storage: memStorage(), db }, other);
  assert.equal(res.ok, false);
  assert.equal(res.conflict.conflictingItems.length, 1, "the disputed answer is named");
  assert.equal(db.docs[S.attemptPath("jenn", "att-1")].responses[0].selectedOptionId, item.acceptedOptionIds[0], "answer A survives");
});

test("F03: each device has one stable id, and two storages get different ones", () => {
  const s1 = memStorage(), s2 = memStorage();
  const a = S.deviceId(s1);
  assert.ok(/^d-/.test(a));
  assert.equal(S.deviceId(s1), a, "stable across calls");
  assert.notEqual(S.deviceId(s2), a);
});

test("F03: hydrating adopts what the cloud has, but never a copy of a round this device is playing", async () => {
  const storage = memStorage();
  const me = "dev-A";
  // Cloud: a finished attempt this device has never seen, a newer copy of a
  // finished one it has, and a newer copy of one it is playing right now.
  const finishedElsewhere = newAttempt({ attemptId: "cloud-only" });
  finishedElsewhere.status = "results_available"; finishedElsewhere.revision = 40;
  const finishedHere = newAttempt({ attemptId: "old-here" });
  finishedHere.status = "results_available"; finishedHere.revision = 3;
  const finishedHereNewer = JSON.parse(JSON.stringify(finishedHere)); finishedHereNewer.revision = 7;
  const mine = newAttempt({ attemptId: "mine", deviceId: me });
  mine.status = "active"; mine.revision = 2;
  const mineCloud = JSON.parse(JSON.stringify(mine)); mineCloud.revision = 50;

  S.saveAttempt({ storage, db: null }, finishedHere);
  S.saveAttempt({ storage, db: null }, mine);
  const db = txFakeDb({
    [S.attemptPath("jenn", "cloud-only")]: finishedElsewhere,
    [S.attemptPath("jenn", "old-here")]: finishedHereNewer,
    [S.attemptPath("jenn", "mine")]: mineCloud,
  });

  const out = await S.hydrateFromCloud({ storage, db }, "jenn", me);
  assert.deepEqual(out.adopted.sort(), ["cloud-only", "old-here"]);
  assert.deepEqual(out.kept, ["mine"]);
  const local = S.readLocal(storage);
  assert.equal(local.attempts["cloud-only"].revision, 40, "a second device can now see the first's assessment");
  assert.equal(local.attempts["old-here"].revision, 7, "the newer finished copy replaces the older");
  assert.equal(local.attempts["mine"].revision, 2, "this device is the authority on its own live round");
  assert.equal(local.synced["cloud-only"], 40, "adopted copies are the acknowledged base");
  assert.equal(local.queue.length, 2, "hydration queues nothing for upload");
});

test("F03: an attempt in progress on another device is visible but not resumable here", async () => {
  const storage = memStorage();
  const theirs = newAttempt({ attemptId: "theirs", deviceId: "dev-B" });
  theirs.status = "paused"; theirs.revision = 4;
  const db = txFakeDb({ [S.attemptPath("jenn", "theirs")]: theirs });
  await S.hydrateFromCloud({ storage, db }, "jenn", "dev-A");
  const seen = S.listAttempts({ storage, db }, "jenn");
  assert.equal(seen.length, 1, "history sees it");
  assert.equal(S.resumableOn(seen[0], "dev-A"), false);
  assert.equal(S.resumableOn(seen[0], "dev-B"), true);
  const legacy = newAttempt({ attemptId: "legacy" }); legacy.status = "paused";
  assert.equal(S.resumableOn(legacy, "dev-A"), true, "an attempt saved before device ids existed can be continued anywhere");
  const done = newAttempt({ attemptId: "done", deviceId: "dev-A" }); done.status = "results_available";
  assert.equal(S.resumableOn(done, "dev-A"), false, "finished attempts are not resumed");
});

test("F03: offline saves collapse to one queue entry and flush once the cloud is back", async () => {
  const storage = memStorage();
  const a = newAttempt();
  for (let i = 0; i < 3; i++) { a.revision = i + 1; S.saveAttempt({ storage, db: null }, a); }
  assert.equal(S.readLocal(storage).queue.length, 1, "one entry per attempt, not per save");
  const db = txFakeDb();
  const out = await S.flushQueue({ storage, db });
  assert.equal(out.pending, 0);
  assert.equal(S.readLocal(storage).queue.length, 0);
  assert.equal(S.readLocal(storage).synced["att-1"], 3);
  assert.equal(S.isSynced({ storage, db }, a), true);
  a.revision = 4;
  assert.equal(S.isSynced({ storage, db }, a), false, "a newer local revision is 'Saved on this device' again");
});
