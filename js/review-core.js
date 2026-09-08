/* eslint-disable */
"use strict";
/**
 * Retention: what a child actually knows, per skill, and when to check again.
 *
 * The app previously tracked one number per word — a fail count — which cannot
 * distinguish "cannot write it" from "does not know what it means", and cannot
 * tell a lucky guess from durable recall. Worse, a mistimed tap in Rain or a
 * mismatched flip in Match fed the same counter as a genuine vocabulary error.
 *
 * Here evidence is per {word, skill}, and only an INTERPRETABLE attempt counts:
 * a game-mechanics slip is not evidence about a word.
 *
 * Pure module: no DOM, no app globals, no persistence.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ReviewCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  /** Skills are tracked separately because they are genuinely different. */
  const SKILLS = ["recognition", "meaning", "contextComprehension", "writingRecall"];
  /** Tracing is practice, not independent recall, so it is kept apart. */
  const PRACTICE_SKILLS = ["tracePractice"];

  /**
   * Days until the next check after a successful INDEPENDENT recall.
   * A simple operational schedule, not a proven optimum for these children.
   */
  const LADDER = [1, 3, 7, 14, 30];

  const LABELS = {
    ENCOUNTERED: "encountered",
    PRACTISING: "practising",
    RECALLED: "recalled independently",
    RETAINED: "retained on later checks",
  };

  /** Review session budget. Unserved items stay due; nothing is deleted. */
  const BUDGET = { normalMs: 4 * 60 * 1000, normalItems: 8, focusMs: 8 * 60 * 1000, focusItems: 16 };

  const key = (wordId, skill) => `${wordId}::${skill}`;

  function blankRecord(wordId, skill) {
    return {
      wordId, skill,
      stage: 0,                 // rungs climbed; interval is LADDER[stage - 1]
      dueOn: null,              // study-date key
      attempts: [],             // bounded history
      independentSuccesses: [], // study-date keys of unaided successes
      firstTaughtOn: null,
      lastSeenOn: null,
      unresolvedRuns: 0,        // consecutive same-session failures
      // What the attempts that have fallen off the front still prove. Trimming
      // used to discard them outright, which is why a merge past the bound had
      // to abandon replay and pick one whole record instead.
      checkpoint: null,
    };
  }

  function getRecord(store, wordId, skill) {
    return (store && store[key(wordId, skill)]) || blankRecord(wordId, skill);
  }

  // ── date helpers (calendar days, not 24-hour periods) ────────────────────
  function addDays(dateKey, n) {
    const [y, m, d] = String(dateKey).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  const isDue = (rec, todayKey) => !!rec.dueOn && String(rec.dueOn) <= String(todayKey);

  /**
   * Record one attempt.
   *
   * `supported` means pinyin, a translation or any answer-revealing help was
   * available. `sameSession` means this is a retry immediately after being
   * shown the answer — that is teaching, not retrieval, so it never advances
   * the schedule.
   */
  /** Bounded history per record. Older entries fall off the front. */
  const MAX_ATTEMPTS = 40;

  function newAttemptId(todayKey) {
    return `${todayKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function recordAttempt(store, opts) {
    const { wordId, skill, correct, todayKey } = opts;
    if (!wordId || SKILLS.indexOf(skill) === -1) return store;
    const entry = {
      // Stable id and an ordering hint, so two devices' histories can be
      // unioned and replayed rather than one being kept and the other lost.
      id: opts.id || newAttemptId(todayKey),
      at: typeof opts.at === "number" ? opts.at : null,
      on: todayKey, correct: !!correct, supported: !!opts.supported, sameSession: !!opts.sameSession,
      source: opts.source || null,
    };
    const rec = applyAttempt(getRecord(store, wordId, skill), entry);
    const out = Object.assign({}, store);
    out[key(wordId, skill)] = rec;
    return out;
  }

  /**
   * Fold one attempt into a record. Pure: the result depends only on the
   * record and the entry, which is what lets a merge replay a union of two
   * devices' attempts and land on the same schedule either way round.
   */
  function applyAttempt(prev, entry) {
    const rec = Object.assign({}, prev);
    const todayKey = entry.on;
    const correct = !!entry.correct;
    const supported = !!entry.supported;
    const sameSession = !!entry.sameSession;
    const history = (rec.attempts || []).concat([entry]);
    if (history.length > MAX_ATTEMPTS) {
      rec.checkpoint = foldInto(rec.checkpoint, history.slice(0, history.length - MAX_ATTEMPTS), prev);
    }
    rec.attempts = history.slice(-MAX_ATTEMPTS);
    rec.lastSeenOn = todayKey;
    if (!rec.firstTaughtOn) rec.firstTaughtOn = todayKey;
    rec.independentSuccesses = rec.independentSuccesses || [];

    const independent = correct && !supported && !sameSession;

    if (independent) {
      rec.unresolvedRuns = 0;
      // One advance per target, per skill, per study date: answering the same
      // item five times in one sitting is not five days of retention.
      const alreadyToday = rec.independentSuccesses.indexOf(todayKey) !== -1;
      if (!alreadyToday) {
        rec.independentSuccesses = rec.independentSuccesses.concat([todayKey]).slice(-20);
        rec.stage = Math.min(rec.stage + 1, LADDER.length);
      }
      rec.dueOn = addDays(todayKey, LADDER[Math.max(0, rec.stage - 1)]);
    } else if (!correct) {
      // A wrong answer, or one reached with help, goes back to the next-day
      // stage after teaching. History is kept; nothing is deleted.
      if (!sameSession) rec.unresolvedRuns = (rec.unresolvedRuns || 0) + 1;
      rec.stage = 0;
      rec.dueOn = addDays(todayKey, LADDER[0]);
    } else {
      // Correct, but with help or straight after being told. Not retrieval —
      // check again tomorrow without advancing.
      rec.dueOn = rec.dueOn && rec.dueOn > todayKey ? rec.dueOn : addDays(todayKey, LADDER[0]);
    }
    return rec;
  }

  /**
   * Carry what is about to be trimmed away into the checkpoint.
   *
   * Only what a later replay cannot recompute: when this target was first
   * taught, and which dates it was recalled unaided on. The stage comes from
   * the record as it stood before this entry — it is a floor, and any miss in
   * the surviving tail resets it during replay.
   */
  function foldInto(cp, shed, prev) {
    const out = {
      count: (cp && cp.count) || 0,
      stage: Math.max((cp && cp.stage) || 0, (prev && prev.stage) || 0),
      firstTaughtOn: (cp && cp.firstTaughtOn) || (prev && prev.firstTaughtOn) || null,
      successes: ((cp && cp.successes) || []).slice(),
    };
    shed.forEach((e) => {
      out.count++;
      if (e.on && (!out.firstTaughtOn || e.on < out.firstTaughtOn)) out.firstTaughtOn = e.on;
      if (e.correct && !e.supported && !e.sameSession && out.successes.indexOf(e.on) === -1) {
        out.successes.push(e.on);
      }
    });
    out.successes = out.successes.sort().slice(-20);
    return out;
  }

  /** Two views of the same folded prefix. Every field commutes. */
  function mergeCheckpoints(a, b) {
    if (!a && !b) return null;
    const A = a || {}, B = b || {};
    const taught = [A.firstTaughtOn, B.firstTaughtOn].filter(Boolean).sort();
    return {
      count: Math.max(A.count || 0, B.count || 0),
      stage: Math.max(A.stage || 0, B.stage || 0),
      firstTaughtOn: taught.length ? taught[0] : null,
      successes: [...new Set([...(A.successes || []), ...(B.successes || [])])].sort().slice(-20),
    };
  }

  /** A record to replay onto: blank, plus whatever the checkpoint still proves. */
  function seedFrom(cp, wordId, skill) {
    const rec = blankRecord(wordId, skill);
    if (!cp) return rec;
    rec.checkpoint = cp;
    rec.stage = cp.stage || 0;
    rec.firstTaughtOn = cp.firstTaughtOn || null;
    rec.independentSuccesses = (cp.successes || []).slice();
    return rec;
  }

  /** Identity of one attempt entry; entries saved before ids existed are keyed by content. */
  function attemptKey(e) {
    if (e && e.id) return `id:${e.id}`;
    return `legacy:${JSON.stringify([e.on, !!e.correct, !!e.supported, !!e.sameSession, e.source || null])}`;
  }

  /**
   * Merge two copies of one record, losslessly where the histories allow it.
   *
   * The attempts are unioned by id, ordered by (study date, arrival), and
   * replayed through applyAttempt from a seed carrying the merged checkpoints;
   * because the fold is pure and every checkpoint field commutes, merge(a, b)
   * and merge(b, a) land on the same schedule, and merging a record with
   * itself changes nothing.
   *
   * Replaying an attempt the other side had already folded is harmless: an
   * independent success only advances the ladder once per date, and the seed
   * already carries that date.
   */
  function mergeRecords(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const la = a.attempts || [], lb = b.attempts || [];
    const seen = new Map();
    [...la, ...lb].forEach((e) => { const k = attemptKey(e); if (!seen.has(k)) seen.set(k, e); });
    const entries = [...seen.values()].map((e, i) => ({ e, i }));
    entries.sort((x, y) => {
      const d = String(x.e.on || "").localeCompare(String(y.e.on || ""));
      if (d) return d;
      const ax = typeof x.e.at === "number" ? x.e.at : 0, ay = typeof y.e.at === "number" ? y.e.at : 0;
      if (ax !== ay) return ax - ay;
      const kx = attemptKey(x.e), ky = attemptKey(y.e);
      return kx < ky ? -1 : kx > ky ? 1 : x.i - y.i;
    });
    let rec = seedFrom(mergeCheckpoints(a.checkpoint, b.checkpoint),
      a.wordId || b.wordId, a.skill || b.skill);
    entries.forEach(({ e }) => { rec = applyAttempt(rec, e); });
    return rec;
  }

  /**
   * An honest label. Deliberately not a binary "mastered" flag: the strongest
   * label needs two independent successes on separate dates, at least one of
   * them a week after teaching.
   */
  function statusOf(rec) {
    if (!rec || !rec.attempts.length) return LABELS.ENCOUNTERED;
    const successes = rec.independentSuccesses || [];
    if (!successes.length) return LABELS.PRACTISING;
    if (successes.length >= 2) {
      const distinct = [...new Set(successes)];
      const late = rec.firstTaughtOn
        ? distinct.some((d) => d >= addDays(rec.firstTaughtOn, 7))
        : false;
      if (distinct.length >= 2 && late) return LABELS.RETAINED;
    }
    return LABELS.RECALLED;
  }

  /**
   * Choose what to review, within budget.
   *
   * Priority: targets that keep going wrong, then the oldest due. At least one
   * slot is reserved, when available, for a target that HAS been recalled
   * before — otherwise a struggling child only ever revisits their failures.
   */
  function selectDue(store, todayKey, opts) {
    const o = opts || {};
    const limit = o.limit || BUDGET.normalItems;
    const due = Object.values(store || {}).filter((r) => isDue(r, todayKey));

    const struggling = due.filter((r) => (r.unresolvedRuns || 0) > 0);
    const successful = due.filter((r) => (r.unresolvedRuns || 0) === 0 && (r.independentSuccesses || []).length > 0);
    const rest = due.filter((r) => struggling.indexOf(r) === -1 && successful.indexOf(r) === -1);

    const byAge = (a, b) => String(a.dueOn).localeCompare(String(b.dueOn));
    struggling.sort(byAge); successful.sort(byAge); rest.sort(byAge);

    const picked = [];
    if (successful.length && limit > 1) picked.push(successful.shift());   // reserved slot
    [...struggling, ...rest, ...successful].forEach((r) => {
      if (picked.length < limit && picked.indexOf(r) === -1) picked.push(r);
    });

    return {
      items: picked,
      dueTotal: due.length,
      remaining: Math.max(0, due.length - picked.length),
      // Shown to the child as plain fact, never as a penalty.
      summary: `${picked.length} to review${due.length > picked.length ? `; ${due.length - picked.length} remain for later` : ""}`,
    };
  }

  /** Has this session used up its review budget? */
  function budgetSpent(state, mode) {
    const b = mode === "focus"
      ? { ms: BUDGET.focusMs, items: BUDGET.focusItems }
      : { ms: BUDGET.normalMs, items: BUDGET.normalItems };
    return (state.activeMs || 0) >= b.ms || (state.answered || 0) >= b.items;
  }

  /**
   * Turn assessment results into review targets — only when the child asks.
   *
   * Assessment answers are never injected into the due queue automatically, and
   * practice never writes back to the assessment record.
   */
  function targetsFromAssessment(score, opts) {
    const o = opts || {};
    const out = [];
    Object.values((score && score.byBand) || {}).forEach((band) => {
      Object.values(band.domains || {}).forEach((d) => {
        if (d.domain === "writing_recall" && d.awaitingReview) return;
        if ((d.correct || 0) >= (d.expected || 0)) return;
        out.push({ band: band.band, domain: d.domain, provenance: "assessment", attemptId: o.attemptId || null });
      });
    });
    return out;
  }

  return {
    SKILLS, PRACTICE_SKILLS, LADDER, LABELS, BUDGET,
    key, blankRecord, getRecord, addDays, isDue,
    recordAttempt, applyAttempt, mergeRecords, mergeCheckpoints, MAX_ATTEMPTS,
    statusOf, selectDue, budgetSpent, targetsFromAssessment,
  };
});
