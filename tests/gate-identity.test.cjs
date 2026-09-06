"use strict";
/**
 * 88-gate identity model and the 22 -> 88 migration.
 *
 * All fixtures are synthetic apart from the shape checks; the real records are
 * only ever exercised through scripts/migrate_preview.js, read-only.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const G = require("../js/gate-identity.js");

test("there are 88 distinct gates, four levels of twenty-two", () => {
  const all = G.allGateKeys();
  assert.equal(all.length, 88);
  assert.equal(new Set(all).size, 88, "every key is distinct");
  assert.equal(all[0], "h1-g01");
  assert.equal(all[87], "h4-g22");
});

test("M-T01: the same gate number in two levels is two different gates", () => {
  assert.notEqual(G.gateKey(1, 1), G.gateKey(2, 1));
  const cleared = [G.gateKey(1, 1)];
  assert.ok(cleared.includes("h1-g01"));
  assert.ok(!cleared.includes("h2-g01"), "clearing level 1 gate 1 does not clear level 2 gate 1");
});

test("keys round-trip and malformed ones are rejected", () => {
  assert.deepEqual(G.parseGateKey("h3-g14"), { levelId: 3, gateId: 14, gateKey: "h3-g14" });
  ["h5-g01", "h1-g23", "h1-g0", "g01", "h1g01", "", null].forEach((bad) => {
    assert.equal(G.parseGateKey(bad), null, `${bad} is not a gate key`);
    assert.equal(G.isGateKey(bad), false);
  });
  assert.throws(() => G.gateKey(5, 1));
  assert.throws(() => G.gateKey(1, 23));
});

test("progression runs within a level and then into the next", () => {
  assert.equal(G.nextGateKey("h1-g01"), "h1-g02");
  assert.equal(G.nextGateKey("h1-g22"), "h2-g01", "clearing gate 22 opens the next level");
  assert.equal(G.nextGateKey("h4-g22"), null, "and stops at the end");
  assert.equal(G.previousGateKey("h2-g01"), "h1-g22");
  assert.equal(G.previousGateKey("h1-g01"), null);
});

test("a gate opens only when the one before it is cleared", () => {
  assert.equal(G.isGateOpen("h1-g01", []), true, "the first gate is always open");
  assert.equal(G.isGateOpen("h1-g02", []), false);
  assert.equal(G.isGateOpen("h1-g02", ["h1-g01"]), true);
  assert.equal(G.isGateOpen("h2-g01", ["h1-g21"]), false);
  assert.equal(G.isGateOpen("h2-g01", ["h1-g22"]), true);
});

test("nextOpenGateKey finds the furthest reachable gate", () => {
  assert.equal(G.nextOpenGateKey([]), "h1-g01");
  assert.equal(G.nextOpenGateKey(["h1-g01", "h1-g02"]), "h1-g03");
  assert.equal(G.nextOpenGateKey(G.allGateKeys()), null, "all cleared");
});

test("champion groups are keyed by level as well as group", () => {
  assert.equal(G.championKey(2, 3), "h2-c3");
  assert.notEqual(G.championKey(1, 1), G.championKey(2, 1));
  assert.deepEqual(G.championGateKeys(1, 1), ["h1-g01", "h1-g02", "h1-g03", "h1-g04", "h1-g05"]);
  assert.deepEqual(G.championGateKeys(3, 2), ["h3-g06", "h3-g07", "h3-g08", "h3-g09", "h3-g10"]);
});

// ── migration ───────────────────────────────────────────────────────────────

test("legacy gates map to the level they were actually earned in", () => {
  assert.equal(G.legacyGateKey(1), "h1-g01");
  assert.equal(G.legacyGateKey(5), "h1-g05");
  assert.equal(G.legacyGateKey(6), "h2-g06", "gate 6 was always an HSK2 gate");
  assert.equal(G.legacyGateKey(12), "h3-g12");
  assert.equal(G.legacyGateKey(22), "h4-g22");
  assert.equal(G.legacyGateKey(23), null, "there was never a gate 23");
});

test("M-T18: migration is idempotent", () => {
  const doc = { gatesCompleted: [1, 2, 3], gateStars: { 1: 3, 2: 2 }, totalStars: 500 };
  const once = G.migratePlayer(doc).player;
  const twice = G.migratePlayer(once).player;
  assert.deepEqual(twice.gatesCompleted, once.gatesCompleted);
  assert.deepEqual(twice.gateStars, once.gateStars);
  assert.equal(twice.totalStars, 500);
  assert.equal(G.migratePlayer(once).report.alreadyMigrated, true);
});

test("migration does not mutate the document it is given", () => {
  const doc = { gatesCompleted: [1, 2], gateStars: { 1: 3 }, totalStars: 100 };
  const snapshot = JSON.stringify(doc);
  G.migratePlayer(doc);
  assert.equal(JSON.stringify(doc), snapshot, "the input is untouched, so a dry run is safe");
});

test("migration invents no completions for the other 66 identities", () => {
  const { player } = G.migratePlayer({ gatesCompleted: [1, 2] });
  assert.deepEqual(player.gatesCompleted, ["h1-g01", "h1-g02"]);
  assert.equal(player.gatesCompleted.length, 2, "exactly what was earned, nothing more");
});

test("every gate-keyed record follows its completion", () => {
  const { player } = G.migratePlayer({
    gatesCompleted: [6],
    gateStars: { 6: 3 },
    gateGameStars: { 6: { trace: 3, match: 3, rain: 3, listen: 3 } },
    gateBestQuiz: { 6: { accPct: 95, quizStars: 3 } },
    gateTimers: { 6: { active: false } },
  });
  assert.deepEqual(player.gatesCompleted, ["h2-g06"]);
  assert.equal(player.gateStars["h2-g06"], 3);
  assert.equal(player.gateGameStars["h2-g06"].trace, 3);
  assert.equal(player.gateBestQuiz["h2-g06"].accPct, 95);
  assert.ok(player.gateTimers["h2-g06"]);
});

test("access is preserved separately from completion", () => {
  const { player, report } = G.migratePlayer({ gatesCompleted: [1, 2] });
  assert.deepEqual(player.legacyAccess, ["h1-g01", "h1-g02", "h1-g03"],
    "the gate they were working on stays reachable");
  assert.deepEqual(report.legacyAccess, player.legacyAccess);
  assert.ok(!player.gatesCompleted.includes("h1-g03"), "reachable is not the same as cleared");
});

test("a brand-new player migrates to the first gate only", () => {
  const { player } = G.migratePlayer({});
  assert.deepEqual(player.gatesCompleted, []);
  assert.deepEqual(player.legacyAccess, ["h1-g01"]);
  assert.equal(G.nextOpenGateKey(player.gatesCompleted), "h1-g01");
});

test("learning history is carried through untouched", () => {
  const doc = {
    gatesCompleted: [1],
    totalStars: 6669,
    library: { 水: { py: "shuǐ" } },
    failedWords: { 山: { failCount: 2 } },
    badges: ["first_story"],
    storyReadCount: { xia: 2 },
  };
  const { player } = G.migratePlayer(doc);
  assert.equal(player.totalStars, 6669);
  assert.deepEqual(Object.keys(player.library), ["水"]);
  assert.deepEqual(Object.keys(player.failedWords), ["山"]);
  assert.deepEqual(player.badges, ["first_story"]);
  assert.equal(player.storyReadCount.xia, 2);
});

test("provenance is recorded so migrated credit is never mistaken for fresh", () => {
  const { player } = G.migratePlayer({ gatesCompleted: [1, 2] });
  assert.equal(player.schemaVersion, G.SCHEMA_VERSION);
  assert.deepEqual(player.legacyCredit.gatesCompleted, [1, 2], "the original numbers are kept");
  assert.equal(player.legacyCredit.fromSchema, 1);
});

test("an out-of-range legacy gate is skipped, not guessed at", () => {
  const { player, report } = G.migratePlayer({ gatesCompleted: [1, 99], gateStars: { 99: 3 } });
  assert.deepEqual(player.gatesCompleted, ["h1-g01"]);
  assert.ok(report.skipped.some((s) => String(s.value) === "99"));
  assert.equal(Object.keys(player.gateStars).length, 0, "its stars are not remapped either");
});

test("ambiguous champion records are flagged rather than guessed", () => {
  const { report } = G.migratePlayer({ gatesCompleted: [1], championCleared: { 1: 3 } });
  assert.ok(report.warnings.some((w) => /championCleared/.test(w)),
    "group numbers carry no level, so they are reported instead of assigned");
});

test("C03: a legacy save is migrated even when it claims to be current", () => {
  // The app merges a saved document over a default player, and the default now
  // carries the current schemaVersion — so a legacy save emerges from that
  // merge *claiming* to be migrated while its gate ids are still numbers.
  // Trusting the stamp alone silently dropped every completion. The shape is
  // checked too.
  const merged = { schemaVersion: G.SCHEMA_VERSION, gatesCompleted: [1, 2, 3], gateStars: { 1: 3 } };
  assert.equal(G.looksLegacy(merged), true, "numeric gate ids give it away");

  const { player, report } = G.migratePlayer(merged);
  assert.equal(report.alreadyMigrated, false, "it is migrated despite the stamp");
  assert.deepEqual(player.gatesCompleted, ["h1-g01", "h1-g02", "h1-g03"]);
  assert.equal(player.gateStars["h1-g01"], 3);
});

test("C03: a genuinely migrated document is left alone", () => {
  const done = { schemaVersion: G.SCHEMA_VERSION, gatesCompleted: ["h1-g01"], gateStars: { "h1-g01": 3 } };
  assert.equal(G.looksLegacy(done), false);
  assert.equal(G.migratePlayer(done).report.alreadyMigrated, true);
});

test("C03: flashcard passes follow their gate through the migration", () => {
  const { player } = G.migratePlayer({ gatesCompleted: [6], flashPassDone: { 6: true } });
  assert.equal(player.flashPassDone["h2-g06"], true, "or Trace would silently re-lock");
  assert.equal(player.flashPassDone["6"], undefined);
});
