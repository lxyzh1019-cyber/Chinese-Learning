/* eslint-disable */
"use strict";
/**
 * Reconcile two divergent copies of one player.
 *
 * The revision check stops a stale write from silently clobbering a newer one,
 * but on its own it only picks a winner — the loser's work was recorded as a
 * summary and otherwise dropped. This merges them instead.
 *
 * The rules follow from what each kind of state actually is:
 *
 *   - Stars are a LEDGER of events, not a number. Summing a set of events by
 *     stable id is commutative and idempotent, so the same award cannot be
 *     counted twice and a parent's deduction is replayed rather than lost to a
 *     max(). A running total cannot express either of those.
 *   - Completions, characters learned, badges and stickers are SETS. Union.
 *   - Counters that only ever climb (reads, fail counts) take the maximum.
 *   - Gate qualifying records take the best *within the current attempt*: a
 *     score from an attempt the deadline already reset must not come back.
 *   - Two different in-progress rounds cannot be merged at all, so both are
 *     kept and the choice is surfaced.
 *
 * Pure module: no DOM, no app globals.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MergeState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  const MAX_LEDGER = 500;

  // ── star ledger ──────────────────────────────────────────────────────────

  function newEventId(kind) {
    return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Give a document a ledger without changing what it is worth.
   *
   * The stars it already has become the baseline; everything after this point
   * is an event. Without the baseline an existing player would appear to have
   * earned nothing.
   */
  function ensureLedger(s) {
    if (!Array.isArray(s.starLedger)) {
      s.starLedger = [];
      s.starsBaseline = typeof s.starsBaseline === "number" ? s.starsBaseline : (s.totalStars || 0);
      s.weekStarsBaseline = typeof s.weekStarsBaseline === "number" ? s.weekStarsBaseline : (s.weekStars || 0);
    }
    return s;
  }

  /** Append one star movement. `delta` may be negative (a parent deduction). */
  function recordStarEvent(s, delta, kind, opts) {
    ensureLedger(s);
    const o = opts || {};
    const ev = {
      id: o.id || newEventId(kind || "star"),
      at: o.at || Date.now(),
      delta: Number(delta) || 0,
      kind: kind || "earn",
      week: o.week || null,
    };
    s.starLedger.push(ev);
    trimLedger(s);
    return ev;
  }

  /** Keep the ledger bounded by folding the oldest events into the baseline. */
  function trimLedger(s) {
    if (!Array.isArray(s.starLedger) || s.starLedger.length <= MAX_LEDGER) return s;
    const overflow = s.starLedger.length - MAX_LEDGER;
    const folded = s.starLedger.slice(0, overflow);
    s.starLedger = s.starLedger.slice(overflow);
    folded.forEach((e) => { s.starsBaseline = (s.starsBaseline || 0) + (e.delta || 0); });
    return s;
  }

  /** Total stars implied by baseline plus ledger. */
  function totalFromLedger(s) {
    const base = s.starsBaseline || 0;
    return (s.starLedger || []).reduce((sum, e) => sum + (e.delta || 0), base);
  }

  /** Week stars implied by the ledger, counting only this week's events. */
  function weekFromLedger(s, weekKey) {
    const base = s.weekStarsBaseline || 0;
    return (s.starLedger || [])
      .filter((e) => !weekKey || !e.week || e.week === weekKey)
      .reduce((sum, e) => sum + (e.delta || 0), base);
  }

  // ── merge helpers ────────────────────────────────────────────────────────

  const unionArray = (a, b) => [...new Set([...(a || []), ...(b || [])])];

  function unionById(a, b, idKey) {
    const seen = new Map();
    [...(a || []), ...(b || [])].forEach((x) => {
      const k = x && x[idKey];
      if (k == null) return;
      if (!seen.has(k)) seen.set(k, x);
    });
    return [...seen.values()];
  }

  function maxNumericMap(a, b) {
    const out = Object.assign({}, a || {});
    Object.entries(b || {}).forEach(([k, v]) => {
      out[k] = Math.max(Number(out[k] || 0), Number(v || 0));
    });
    return out;
  }

  function mergeObjectsPreferLocal(a, b) {
    return Object.assign({}, b || {}, a || {});
  }

  /** What one side knows about a gate's deadline resets. */
  function resetMarker(s, gateKey) {
    const hist = ((s.gateAttemptHistory || {})[gateKey]) || [];
    return {
      ids: new Set(hist.map((h) => h && h.attemptId).filter(Boolean)),
      day: hist.reduce((m, h) => Math.max(m, Date.parse((h && h.endedKey) || "") || 0), 0),
      seq: Number(((s.gateResetSeq || {})[gateKey]) || 0),
    };
  }

  /** The most recent deadline reset recorded for a gate, or 0. Kept for callers that want a date. */
  function lastResetAt(s, gateKey) {
    return resetMarker(s, gateKey).day;
  }

  /**
   * Has `x` reset this gate more recently than `y`?
   *
   * By attempt identity first: an archived attempt id that the other side has
   * never seen is a reset it does not know about. Dates come second because
   * they are day-granular — two resets on one day are indistinguishable by
   * date — and the monotonic counter breaks the remaining ties.
   */
  function resetNewer(x, y) {
    const xOnly = [...x.ids].some((id) => !y.ids.has(id));
    const yOnly = [...y.ids].some((id) => !x.ids.has(id));
    if (xOnly && !yOnly) return true;
    if (yOnly && !xOnly) return false;
    if (x.day !== y.day) return x.day > y.day;
    return x.seq > y.seq;
  }

  /**
   * Best-per-gate, refusing scores from an attempt that has since been reset.
   *
   * "Gate-reset events cannot be undone by a late old-attempt score": if one
   * side has reset a gate more recently than the other, the other side's
   * record belongs to the dead attempt. The resetting side's record is taken
   * WHOLE — a zeros object counts, because that is what resetGateProgress
   * writes for game stars. The old rule only dropped a stale record when the
   * resetting side held nothing at all, so a reset that wrote zeros lost to a
   * stale copy's threes through the per-field max.
   */
  function mergeGateRecords(local, remote, field, pick) {
    const out = {};
    const mine = local[field] || {}, theirs = remote[field] || {};
    const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
    keys.forEach((gateKey) => {
      const ml = resetMarker(local, gateKey), mr = resetMarker(remote, gateKey);
      if (resetNewer(mr, ml)) {                       // their reset is the newer one
        if (theirs[gateKey] !== undefined) out[gateKey] = theirs[gateKey];
        return;
      }
      if (resetNewer(ml, mr)) {                       // ours is
        if (mine[gateKey] !== undefined) out[gateKey] = mine[gateKey];
        return;
      }
      if (mine[gateKey] === undefined) { if (theirs[gateKey] !== undefined) out[gateKey] = theirs[gateKey]; return; }
      if (theirs[gateKey] === undefined) { out[gateKey] = mine[gateKey]; return; }
      out[gateKey] = pick(mine[gateKey], theirs[gateKey]);
    });
    return out;
  }

  /**
   * One timer per gate. Prefer the one whose attempt is still live — not
   * archived on either side — then the later start, then local.
   */
  function mergeGateTimers(local, remote) {
    const out = {};
    const mine = local.gateTimers || {}, theirs = remote.gateTimers || {};
    const archived = new Set();
    [local, remote].forEach((s) => Object.values(s.gateAttemptHistory || {}).forEach((hist) =>
      (hist || []).forEach((h) => { if (h && h.attemptId) archived.add(h.attemptId); })));
    new Set([...Object.keys(mine), ...Object.keys(theirs)]).forEach((k) => {
      const a = mine[k], b = theirs[k];
      if (!a) { out[k] = b; return; }
      if (!b) { out[k] = a; return; }
      const aLive = a.attemptId && !archived.has(a.attemptId);
      const bLive = b.attemptId && !archived.has(b.attemptId);
      if (aLive !== bLive) { out[k] = aLive ? a : b; return; }
      if (String(a.startKey || "") !== String(b.startKey || "")) {
        out[k] = String(b.startKey || "") > String(a.startKey || "") ? b : a; return;
      }
      out[k] = a;
    });
    return out;
  }

  /**
   * Learning evidence from both devices, key by key.
   *
   * There was no rule for this at all: the whole object came from the local
   * copy, so a device with an empty store erased the other's history on the
   * first sync. `mergeRecord` (ReviewCore.mergeRecords) replays the union of
   * both histories from their merged checkpoints, so nothing is discarded and
   * the order of the two arguments does not matter.
   */
  function mergeReviewRecords(a, b, mergeRecord) {
    const out = {};
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    keys.forEach((k) => {
      const x = (a || {})[k], y = (b || {})[k];
      if (!x) { out[k] = y; return; }
      if (!y) { out[k] = x; return; }
      if (typeof mergeRecord === "function") { out[k] = mergeRecord(x, y); return; }
      // No merger passed in. This used to re-implement "keep the fuller copy",
      // which silently discarded one device's evidence and made the result
      // depend on argument order. Keeping both is the honest fallback: the
      // schedule stays on the copy with more history, and the other is parked
      // where it can still be recovered rather than deleted.
      const nx = (x.attempts || []).length, ny = (y.attempts || []).length;
      const keep = ny > nx ? y : nx > ny ? x
        : (String(y.lastSeenOn || "") > String(x.lastSeenOn || "") ? y : x);
      const other = keep === y ? x : y;
      out[k] = Object.assign({}, keep, { unmergedCopy: other });
    });
    return out;
  }

  const bestGameStars = (a, b) => ({
    trace: Math.max(a.trace || 0, b.trace || 0),
    match: Math.max(a.match || 0, b.match || 0),
    rain: Math.max(a.rain || 0, b.rain || 0),
    listen: Math.max(a.listen || 0, b.listen || 0),
  });

  const bestQuiz = (a, b) => {
    // One attempt's record wins whole; fields are never mixed across attempts.
    if ((b.accPct || 0) > (a.accPct || 0)) return b;
    if ((b.accPct || 0) === (a.accPct || 0) && (b.points || 0) > (a.points || 0)) return b;
    return a;
  };

  function mergeFailedWords(a, b) {
    const out = {};
    [...Object.keys(a || {}), ...Object.keys(b || {})].forEach((zh) => {
      const x = (a || {})[zh], y = (b || {})[zh];
      if (!x) { out[zh] = y; return; }
      if (!y) { out[zh] = x; return; }
      out[zh] = Object.assign({}, x, y, {
        failCount: Math.max(x.failCount || 0, y.failCount || 0),
        lastFailed: (String(y.lastFailed || "") > String(x.lastFailed || "")) ? y.lastFailed : x.lastFailed,
      });
    });
    return out;
  }

  function mergeLessonSelfCheck(a, b) {
    const out = {};
    new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach((gate) => {
      const x = (a || {})[gate] || {}, y = (b || {})[gate] || {};
      out[gate] = {};
      new Set([...Object.keys(x), ...Object.keys(y)]).forEach((q) => {
        const p = x[q], r = y[q];
        if (!p) { out[gate][q] = r; return; }
        if (!r) { out[gate][q] = p; return; }
        out[gate][q] = String(r.at || "") > String(p.at || "") ? r : p;
      });
    });
    return out;
  }

  /**
   * Merge two copies of one player.
   *
   * `local` is this device's copy, `remote` the other's. Nothing is discarded
   * on a timestamp; where the two genuinely cannot be reconciled — two
   * different rounds in progress — both are kept and reported.
   */
  function mergePlayers(local, remote, opts) {
    const o = opts || {};
    const a = ensureLedger(JSON.parse(JSON.stringify(local || {})));
    const b = ensureLedger(JSON.parse(JSON.stringify(remote || {})));
    const notes = [];

    const out = Object.assign({}, b, a);

    // Stars: union the ledgers by event id and recompute. Applied once each,
    // whichever order they arrive in, deductions included.
    out.starLedger = unionById(a.starLedger, b.starLedger, "id")
      .sort((x, y) => (x.at || 0) - (y.at || 0));
    out.starsBaseline = Math.max(a.starsBaseline || 0, b.starsBaseline || 0);
    out.weekStarsBaseline = Math.max(a.weekStarsBaseline || 0, b.weekStarsBaseline || 0);
    trimLedger(out);
    out.totalStars = totalFromLedger(out);
    out.weekStars = Math.max(0, weekFromLedger(out, o.weekKey));

    // Sets.
    out.gatesCompleted = unionArray(a.gatesCompleted, b.gatesCompleted);
    out.storiesCompleted = unionArray(a.storiesCompleted, b.storiesCompleted);
    out.legacyStoriesCompleted = unionArray(a.legacyStoriesCompleted, b.legacyStoriesCompleted);
    out.badges = unionArray(a.badges, b.badges);
    out.stickerIds = unionArray(a.stickerIds, b.stickerIds);
    out.legacyAccess = unionArray(a.legacyAccess, b.legacyAccess);
    out.legacyLevelAccess = unionArray(a.legacyLevelAccess, b.legacyLevelAccess);

    // Learned material: keep everything either side knows.
    out.library = mergeObjectsPreferLocal(a.library, b.library);
    out.failedWords = mergeFailedWords(a.failedWords, b.failedWords);
    out.traceStars = maxNumericMap(a.traceStars, b.traceStars);
    out.storyReadCount = maxNumericMap(a.storyReadCount, b.storyReadCount);
    out.flashPassDone = mergeObjectsPreferLocal(a.flashPassDone, b.flashPassDone);

    // Gate qualifying records, respecting deadline resets.
    out.gateAttemptHistory = (() => {
      const merged = {};
      const keys = new Set([...Object.keys(a.gateAttemptHistory || {}), ...Object.keys(b.gateAttemptHistory || {})]);
      keys.forEach((k) => {
        merged[k] = unionById((a.gateAttemptHistory || {})[k], (b.gateAttemptHistory || {})[k], "attemptId");
      });
      return merged;
    })();
    out.gateResetSeq = maxNumericMap(a.gateResetSeq, b.gateResetSeq);
    out.gateStars = mergeGateRecords(a, b, "gateStars", (x, y) => Math.max(x, y));
    out.gateGameStars = mergeGateRecords(a, b, "gateGameStars", bestGameStars);
    out.gateBestQuiz = mergeGateRecords(a, b, "gateBestQuiz", bestQuiz);
    out.championBestQuiz = mergeGateRecords(a, b, "championBestQuiz", bestQuiz);
    out.championCleared = maxNumericMap(a.championCleared, b.championCleared);
    out.gateTimers = mergeGateTimers(a, b);

    // Retention evidence is long-term learning history; it survives resets and
    // must survive a sync.
    out.reviewRecords = mergeReviewRecords(a.reviewRecords, b.reviewRecords, o.mergeReviewRecord);
    // Lesson self-checks: per gate per question, the later verdict wins.
    out.lessonSelfCheck = mergeLessonSelfCheck(a.lessonSelfCheck, b.lessonSelfCheck);

    // Two different rounds in progress cannot be merged. Keep both. A slot that
    // is null here is either never filled or deliberately cleared; the clear
    // stamp tells the two apart, so a round the other device is still playing
    // is adopted unless this device cleared that slot after it was last saved.
    out.pendingSessionClearedAt = maxNumericMap(a.pendingSessionClearedAt, b.pendingSessionClearedAt);
    out.pendingSessions = Object.assign({}, a.pendingSessions || {});
    out.conflictSessions = Array.isArray(a.conflictSessions) ? a.conflictSessions.slice() : [];
    Object.keys(b.pendingSessions || {}).forEach((slot) => {
      const mine = (a.pendingSessions || {})[slot];
      const theirs = (b.pendingSessions || {})[slot];
      if (!theirs) { if (mine === undefined) out.pendingSessions[slot] = theirs; return; }
      if (!mine) {
        const clearedAt = Number(((a.pendingSessionClearedAt || {})[slot]) || 0);
        const savedAt = Number(theirs.updatedAt || 0);
        if (savedAt > clearedAt || (!clearedAt && !savedAt)) out.pendingSessions[slot] = theirs;
        else out.pendingSessions[slot] = null;
        return;
      }
      if (JSON.stringify(mine) === JSON.stringify(theirs)) return;
      out.conflictSessions.push({ slot, at: Date.now(), other: theirs });
      notes.push(`two different ${slot} rounds were in progress; both kept`);
    });
    if (out.conflictSessions.length > 10) out.conflictSessions = out.conflictSessions.slice(-10);

    // Daily counters climb.
    out.dailyTimeMs = maxNumericMap(a.dailyTimeMs, b.dailyTimeMs);
    out.totalWrongAnswers = Math.max(a.totalWrongAnswers || 0, b.totalWrongAnswers || 0);
    out.dailyWordTotal = Math.max(a.dailyWordTotal || 0, b.dailyWordTotal || 0);

    out.revision = Math.max(a.revision || 0, b.revision || 0) + 1;
    out.lastSaved = Date.now();

    return { player: out, notes };
  }

  return {
    MAX_LEDGER, newEventId, ensureLedger, recordStarEvent, trimLedger,
    totalFromLedger, weekFromLedger, mergePlayers,
    unionArray, unionById, maxNumericMap, mergeFailedWords, lastResetAt,
    resetMarker, resetNewer, mergeGateRecords, mergeGateTimers, mergeReviewRecords, mergeLessonSelfCheck,
  };
});
