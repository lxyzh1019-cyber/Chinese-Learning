/* eslint-disable */
"use strict";
/**
 * Gate identity: 88 distinct gates, not 22 shared ones.
 *
 * The app has always keyed gate progress by dynasty id alone (1–22), so a
 * result recorded at "gate 1" was the same record whichever HSK tab was open —
 * clearing gate 1 showed as cleared on every level. `ensureState` even
 * discarded any id above 22, which made an 88-gate scheme impossible.
 *
 * Here a gate is `h{level}-g{NN}`: four levels of twenty-two. The dynasty
 * stays as the gate's theme, shared across levels, but it no longer *is* the
 * identity.
 *
 * Pure module: no DOM, no app globals, so the migration can be dry-run against
 * a backup file before anything touches live records.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GateIdentity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  const LEVELS = [1, 2, 3, 4];
  const GATES_PER_LEVEL = 22;
  const KEY_RE = /^h([1-4])-g(0[1-9]|1[0-9]|2[0-2])$/;

  /** The HSK level each dynasty historically belonged to, for migration only. */
  const LEGACY_DYNASTY_LEVEL = {};
  [[1, 5, 1], [6, 11, 2], [12, 17, 3], [18, 22, 4]].forEach(([from, to, lv]) => {
    for (let d = from; d <= to; d++) LEGACY_DYNASTY_LEVEL[d] = lv;
  });

  function gateKey(levelId, gateId) {
    const lv = Number(levelId), g = Number(gateId);
    if (LEVELS.indexOf(lv) === -1) throw new Error(`gateKey: bad level ${levelId}`);
    if (!(g >= 1 && g <= GATES_PER_LEVEL)) throw new Error(`gateKey: bad gate ${gateId}`);
    return `h${lv}-g${String(g).padStart(2, "0")}`;
  }

  function parseGateKey(key) {
    const m = KEY_RE.exec(String(key || ""));
    if (!m) return null;
    return { levelId: Number(m[1]), gateId: Number(m[2]), gateKey: String(key) };
  }

  function isGateKey(key) { return KEY_RE.test(String(key || "")); }

  /** Every gate key, in progression order. */
  function allGateKeys() {
    const out = [];
    LEVELS.forEach((lv) => {
      for (let g = 1; g <= GATES_PER_LEVEL; g++) out.push(gateKey(lv, g));
    });
    return out;
  }

  /** The gate that follows this one: N+1 within a level, then the next level's gate 1. */
  function nextGateKey(key) {
    const p = parseGateKey(key);
    if (!p) return null;
    if (p.gateId < GATES_PER_LEVEL) return gateKey(p.levelId, p.gateId + 1);
    if (p.levelId < LEVELS[LEVELS.length - 1]) return gateKey(p.levelId + 1, 1);
    return null;
  }

  function previousGateKey(key) {
    const p = parseGateKey(key);
    if (!p) return null;
    if (p.gateId > 1) return gateKey(p.levelId, p.gateId - 1);
    if (p.levelId > 1) return gateKey(p.levelId - 1, GATES_PER_LEVEL);
    return null;
  }

  /**
   * A gate is open when the one before it is cleared. Level 1 gate 1 is always
   * open; clearing a level's gate 22 opens the next level's gate 1.
   */
  function isGateOpen(key, clearedKeys) {
    const prev = previousGateKey(key);
    if (!prev) return true;
    return (clearedKeys || []).indexOf(prev) !== -1;
  }

  /** The furthest gate the child can currently work on. */
  function nextOpenGateKey(clearedKeys) {
    const cleared = clearedKeys || [];
    return allGateKeys().find((k) => cleared.indexOf(k) === -1) || null;
  }

  /**
   * Which levels a child may open.
   *
   * One rule, no exceptions: a level opens when the previous level's gate 22 is
   * cleared.
   *
   * `legacyLevelAccess` used to grant a second route. The migration recorded the
   * levels the old running-total rule (5/11/17 gates) had opened, and honoured
   * them here so nobody lost a tab they already had. That grandfather clause is
   * gone: it let a child hold HSK2 on five cleared gates, which is not the rule
   * the curriculum is built on, and the discrepancy was invisible in the UI. The
   * field is still WRITTEN by migratePlayer, because what a child used to be
   * able to reach is worth keeping as a record — it just no longer opens
   * anything. Removing the check is what revokes the access: a document that
   * already carries the field needs no migration.
   */
  function levelUnlocked(levelId, clearedKeys) {
    const lv = Number(levelId);
    if (lv === 1) return true;
    return (clearedKeys || []).indexOf(gateKey(lv - 1, GATES_PER_LEVEL)) !== -1;
  }

  /** The levels the old running-total rule would have opened. */
  function legacyLevelsFor(clearedCount) {
    const levels = [1];
    if (clearedCount >= 5) levels.push(2);
    if (clearedCount >= 11) levels.push(3);
    if (clearedCount >= 17) levels.push(4);
    return levels;
  }

  /** Champion groups stay optional, keyed by level and group, after gates 5/10/15/20. */
  function championKey(levelId, group) { return `h${Number(levelId)}-c${Number(group)}`; }
  function championGateKeys(levelId, group) {
    const start = (group - 1) * 5 + 1;
    const out = [];
    for (let g = start; g < start + 5; g++) out.push(gateKey(levelId, g));
    return out;
  }

  // ── migration ────────────────────────────────────────────────────────────

  const SCHEMA_VERSION = 2;

  /**
   * Map one legacy numeric gate to its new key, using the level that dynasty
   * historically belonged to. Gate 1 was always an HSK1 gate, gate 6 an HSK2
   * gate, and so on — so the credit lands where it was actually earned.
   */
  function legacyGateKey(did) {
    const lv = LEGACY_DYNASTY_LEVEL[Number(did)];
    return lv ? gateKey(lv, Number(did)) : null;
  }

  function remapKeyed(obj, note) {
    const out = {}; const skipped = [];
    Object.entries(obj || {}).forEach(([k, v]) => {
      const key = legacyGateKey(parseInt(k, 10));
      if (key) out[key] = v; else skipped.push(k);
    });
    return { out, skipped, note };
  }

  /**
   * Migrate one player document. Pure: returns a NEW object plus a report, and
   * never mutates its input, so it can be dry-run against a backup.
   *
   * Idempotent — running it twice produces the same result and no extra
   * completions, stars or history.
   */
  /**
   * Does this document still carry legacy numeric gate ids?
   *
   * The version stamp alone is not enough to trust. The app merges a saved
   * document over a default player, and the default now carries the current
   * schemaVersion — so a legacy save comes out of that merge *claiming* to be
   * current while its gate ids are still numbers. Checking the shape makes the
   * migration self-correcting rather than dependent on a field that can be
   * inherited from the wrong side of a merge.
   */
  function looksLegacy(src) {
    if ((src.gatesCompleted || []).some((v) => typeof v === "number" || /^\d+$/.test(String(v)))) return true;
    return ["gateStars", "gateGameStars", "gateBestQuiz", "gateTimers", "flashPassDone"]
      .some((f) => Object.keys(src[f] || {}).some((k) => /^\d+$/.test(k)));
  }

  function migratePlayer(player) {
    const src = player || {};
    const legacyShape = looksLegacy(src);
    const report = {
      alreadyMigrated: src.schemaVersion >= SCHEMA_VERSION && !legacyShape,
      gatesCompleted: [], legacyAccess: [], skipped: [], warnings: [],
    };
    if (report.alreadyMigrated) return { player: src, report };

    const next = JSON.parse(JSON.stringify(src));

    const cleared = (src.gatesCompleted || [])
      .map((v) => parseInt(v, 10))
      .filter((v) => Number.isFinite(v));
    const clearedKeys = [];
    cleared.forEach((did) => {
      const key = legacyGateKey(did);
      if (key) { clearedKeys.push(key); report.gatesCompleted.push({ from: did, to: key }); }
      else report.skipped.push({ field: "gatesCompleted", value: did });
    });
    next.gatesCompleted = [...new Set(clearedKeys)];

    [["gateStars", "stars"], ["gateGameStars", "game stars"], ["gateBestQuiz", "best quiz"],
     ["gateTimers", "timers"], ["gateAttemptHistory", "attempt history"],
     ["flashPassDone", "flashcard passes"],
     ["timerReminderShown", "timer reminders"], ["timerWarningShown", "timer warnings"],
     ["timerLastSeenAt", "timer last seen"]].forEach(([field, label]) => {
      if (!src[field]) return;
      const r = remapKeyed(src[field], label);
      next[field] = r.out;
      r.skipped.forEach((k) => report.skipped.push({ field, value: k }));
    });

    // Access is not completion. Content the child could already reach stays
    // reachable, recorded separately so it can never be mistaken for mastery.
    const reachable = new Set(clearedKeys);
    clearedKeys.forEach((k) => { const n = nextGateKey(k); if (n) reachable.add(n); });
    reachable.add(gateKey(1, 1));
    next.legacyAccess = [...reachable].sort();
    report.legacyAccess = next.legacyAccess;

    // Preserve the level tabs the old threshold rule had already opened.
    next.legacyLevelAccess = legacyLevelsFor(cleared.length);
    report.legacyLevelAccess = next.legacyLevelAccess;

    // The evidence that these came from the old model, kept for provenance.
    next.legacyCredit = {
      migratedAt: new Date().toISOString(),
      fromSchema: src.schemaVersion || 1,
      gatesCompleted: cleared.slice(),
    };
    next.schemaVersion = SCHEMA_VERSION;

    if (next.championCleared && Object.keys(next.championCleared).length) {
      // Champion groups were keyed by group number alone; without a level they
      // are ambiguous, so they are preserved untouched and flagged rather than
      // guessed at.
      report.warnings.push("championCleared kept under its old keys — group numbers carry no level, so they are not remapped");
    }
    return { player: next, report };
  }

  return {
    LEVELS, GATES_PER_LEVEL, SCHEMA_VERSION, LEGACY_DYNASTY_LEVEL,
    gateKey, parseGateKey, isGateKey, allGateKeys,
    nextGateKey, previousGateKey, isGateOpen, nextOpenGateKey,
    championKey, championGateKeys, levelUnlocked, legacyLevelsFor,
    legacyGateKey, migratePlayer, looksLegacy,
  };
});
