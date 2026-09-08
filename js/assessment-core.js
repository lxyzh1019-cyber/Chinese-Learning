/* eslint-disable */
"use strict";
/**
 * Assessment core — pure logic. No DOM, no app globals, no persistence.
 *
 * Everything here is a function of its arguments so it can be unit-tested
 * directly and so a score can be recomputed from stored raw responses at any
 * time (A11: "scores reproduce from stored raw responses").
 *
 * Deliberately absent: stars, streaks, reward hooks, gate effects. An
 * assessment is a calm check, not a gate challenge.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AssessmentCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  const BANDS = ["C1", "C2", "C3", "C4"];

  /** Presentation order within a band. Pinyin-supported decoding comes AFTER
   *  the unaided sections so it cannot coach an earlier answer (A03). */
  const DOMAIN_ORDER = [
    "recognition_unaided",
    "meaning_context",
    "passage_comprehension",
    "decoding_supported",
    "writing_recall",
  ];

  /** Scored opportunities per band/form (A03 blueprint). */
  const DOMAIN_EXPECTED = {
    recognition_unaided: 8,
    meaning_context: 8,
    passage_comprehension: 6,
    decoding_supported: 8,
    writing_recall: 4,
  };

  /** Domains that decide upward routing. Supported decoding explains reliance
   *  on pinyin and writing may await review, so neither routes (A05). */
  const ROUTING_THRESHOLDS = {
    recognition_unaided: 6,
    meaning_context: 6,
    passage_comprehension: 4,
  };

  const STATES = ["created", "active", "paused", "submitted", "results_available", "abandoned"];
  const TRANSITIONS = {
    created: ["active", "abandoned"],
    active: ["paused", "submitted", "abandoned"],
    paused: ["active", "abandoned"],
    submitted: ["results_available"],
    results_available: [],
    abandoned: [],
  };

  const INPUT_SUBMITTED = "submitted";
  const INPUT_DONT_KNOW = "dont_know";
  const INPUT_UNANSWERED = "unanswered";

  // ── deterministic RNG ────────────────────────────────────────────────────
  // Option order is persisted before display and must be reproducible when an
  // attempt is repeated with the identical form (A09.1).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function shuffled(list, rng) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // ── bank access ──────────────────────────────────────────────────────────
  function itemsById(bank) {
    const map = {};
    (bank.items || []).forEach((it) => { map[it.id] = it; });
    return map;
  }

  /** Ordered item list for one band of one form. */
  function selectItems(bank, forms, formId, band) {
    const form = (forms.forms || {})[formId];
    if (!form || !form[band]) return [];
    const byId = itemsById(bank);
    const picked = form[band].map((id) => byId[id]).filter(Boolean);
    const rank = {};
    DOMAIN_ORDER.forEach((d, i) => { rank[d] = i; });
    return picked.slice().sort((a, b) => {
      const dr = (rank[a.domain] ?? 99) - (rank[b.domain] ?? 99);
      if (dr !== 0) return dr;
      return form[band].indexOf(a.id) - form[band].indexOf(b.id);
    });
  }

  // ── attempt lifecycle ────────────────────────────────────────────────────
  function createAttempt(opts) {
    if (!opts || !opts.playerId) throw new Error("createAttempt: playerId is required");
    return {
      schemaVersion: 1,
      attemptId: opts.attemptId,
      // Ownership is fixed at creation and never re-derived from a later global
      // (A06). Switching children must not reassign an attempt's responses.
      playerId: opts.playerId,
      bankVersion: opts.bankVersion,
      formId: opts.formId,
      mode: opts.mode || "baseline",
      comparisonAttemptId: opts.comparisonAttemptId || null,
      // The device that started it. An attempt in progress is continued only
      // there; every device can still read it for history and comparison.
      deviceId: opts.deviceId || null,
      // A same-questions repeat shuffles options with the ORIGINAL attempt's
      // seed and walks the original band sequence instead of re-routing, so
      // "same questions" means the same questions, in the same presentation.
      optionSeedAttemptId: opts.optionSeedAttemptId || null,
      bandPath: Array.isArray(opts.bandPath) ? opts.bandPath.slice() : null,
      status: "created",
      revision: 1,
      createdAt: opts.createdAt || new Date().toISOString(),
      submittedAt: null,
      activeTimeMs: 0,
      breakOfferedAtMs: 0,
      bands: (opts.bands || ["C1"]).slice(),
      presentations: [],
      responses: [],
      writingReviews: [],
      resultVersion: 1,
    };
  }

  function canTransition(from, to) {
    return (TRANSITIONS[from] || []).indexOf(to) !== -1;
  }
  function transition(attempt, to) {
    if (!canTransition(attempt.status, to)) {
      throw new Error(`invalid transition ${attempt.status} -> ${to}`);
    }
    attempt.status = to;
    attempt.revision++;
    if (to === "submitted") attempt.submittedAt = attempt.submittedAt || new Date().toISOString();
    return attempt;
  }

  /**
   * Record how an item is about to be shown. MUST be called before the item is
   * displayed (A06), so a reload cannot reshuffle the options underneath a
   * child who has already seen them.
   */
  function present(attempt, item, opts) {
    opts = opts || {};
    const existing = attempt.presentations.find((p) => p.itemId === item.id);
    if (existing) return existing;
    const seed = hashString(`${attempt.optionSeedAttemptId || attempt.attemptId}:${item.id}`);
    const rng = mulberry32(seed);
    const optionOrder = (item.options || []).length
      ? shuffled(item.options.map((o) => o.id), rng)
      : [];
    const rec = {
      itemId: item.id,
      band: item.band,
      domain: item.domain,
      optionOrder,
      support: Object.assign({ targetPinyin: false, targetAudio: false, translation: false }, item.support || {}),
      audioSource: opts.audioSource || null,
      shownAt: opts.now || new Date().toISOString(),
    };
    attempt.presentations.push(rec);
    return rec;
  }

  /**
   * Commit one response. Idempotent and write-once: a double tap, or a reload
   * after feedback, cannot score twice or overwrite the original (A06, A-T04).
   */
  function respond(attempt, input) {
    if (!input || !input.itemId) throw new Error("respond: itemId is required");
    const already = attempt.responses.find((r) => r.itemId === input.itemId);
    if (already) return { response: already, committed: false };
    const rec = {
      responseId: input.responseId || `${attempt.attemptId}:${input.itemId}`,
      itemId: input.itemId,
      selectedOptionId: input.selectedOptionId ?? null,
      writingRef: input.writingRef || null,
      inputStatus: input.inputStatus || INPUT_SUBMITTED,
      submittedAt: input.now || new Date().toISOString(),
      audioPlays: input.audioPlays || 0,
    };
    attempt.responses.push(rec);
    attempt.revision++;
    return { response: rec, committed: true };
  }

  // ── pacing ───────────────────────────────────────────────────────────────
  /** Time on one item counts up to this; a longer gap is a closed lid, not thinking. */
  const ACTIVE_CAP_MS = 10 * 60 * 1000;
  /** The assessment spends no play time and arms no lock, so this is the only pacing it has. */
  const BREAK_AFTER_MS = 20 * 60 * 1000;

  /** Add the time an item was on screen. activeTimeMs was initialised and never written. */
  function addActiveTime(attempt, ms, opts) {
    const cap = (opts && opts.capMs) || ACTIVE_CAP_MS;
    const n = Number(ms) || 0;
    if (n <= 0 || n > cap) return attempt.activeTimeMs || 0;
    attempt.activeTimeMs = (attempt.activeTimeMs || 0) + n;
    return attempt.activeTimeMs;
  }

  /**
   * A foreground clock.
   *
   * Time used to be measured as "how long the item was on screen", banked only
   * when the child answered. So a hidden tab counted in full, an item left for
   * longer than the cap counted as nothing at all rather than being clamped,
   * and time spent on an item the child never finished was simply lost. The
   * cap now applies per foreground segment, which is the only place it means
   * anything: a segment can run long only while the page was actually visible.
   */
  const RUNNING = (c) => c && c.runningSince !== null && c.runningSince !== undefined;

  function newClock(nowMs) {
    return { accruedMs: 0, runningSince: typeof nowMs === "number" ? nowMs : null };
  }

  function resumeClock(clock, nowMs) {
    if (clock && !RUNNING(clock)) clock.runningSince = Number(nowMs) || 0;
    return clock;
  }

  function pauseClock(clock, nowMs, opts) {
    if (!RUNNING(clock)) return clock;
    const cap = (opts && opts.capMs) || ACTIVE_CAP_MS;
    const seg = (Number(nowMs) || 0) - clock.runningSince;
    // A segment longer than the cap is a screen left on, not thinking. Drop
    // that segment only — whatever was banked before it stands.
    if (seg > 0 && seg <= cap) clock.accruedMs += seg;
    clock.runningSince = null;
    return clock;
  }

  /** Bank what the clock holds onto the attempt, and keep running if it was. */
  function flushClock(attempt, clock, nowMs, opts) {
    if (!attempt || !clock) return 0;
    const wasRunning = RUNNING(clock);
    pauseClock(clock, nowMs, opts);
    const banked = clock.accruedMs;
    if (banked > 0) addActiveTime(attempt, banked, { capMs: Infinity });
    clock.accruedMs = 0;
    if (wasRunning) resumeClock(clock, nowMs);
    return banked;
  }

  /** Time for a gentle "save and continue later?" — once per threshold, never a lock. */
  function shouldOfferBreak(attempt, opts) {
    const threshold = (opts && opts.thresholdMs) || BREAK_AFTER_MS;
    return ((attempt.activeTimeMs || 0) - (attempt.breakOfferedAtMs || 0)) >= threshold;
  }

  function markBreakOffered(attempt) {
    attempt.breakOfferedAtMs = attempt.activeTimeMs || 0;
    return attempt;
  }

  /**
   * The band a planned repeat goes to after `band`. `null` when the plan ends
   * there; `undefined` when there is no plan and routing should decide.
   */
  function nextPlannedBand(attempt, band) {
    const path = attempt && attempt.bandPath;
    if (!Array.isArray(path) || !path.length) return undefined;
    const i = path.indexOf(band);
    if (i === -1) return null;
    return path[i + 1] || null;
  }

  // ── scoring ──────────────────────────────────────────────────────────────
  /**
   * `I don't know` is a wrong answer. Save & Exit, a failed clip, a technical
   * fault or time running out leave the item UNANSWERED — never wrong (A05).
   */
  function isCorrect(item, response) {
    if (!response || response.inputStatus !== INPUT_SUBMITTED) return false;
    return (item.acceptedOptionIds || []).indexOf(response.selectedOptionId) !== -1;
  }

  /**
   * Score an attempt, keeping every band separate.
   *
   * Bands must NOT be merged: routing asks "did this child get 6 of the 8
   * recognition items in THIS band", and pooling C1 with C2 would both change
   * the denominator and let strong performance in an easier band carry a
   * weaker one.
   */
  function scoreAttempt(attempt, bank, forms) {
    const byId = itemsById(bank);
    const byItem = {};
    attempt.responses.forEach((r) => { byItem[r.itemId] = r; });

    const byBand = {};

    attempt.bands.forEach((band) => {
      const domains = {};
      selectItems(bank, forms, attempt.formId, band).forEach((item) => {
        const d = (domains[item.domain] = domains[item.domain] || {
          domain: item.domain, band,
          expected: 0, submitted: 0, correct: 0, unanswered: 0, dontKnow: 0,
          awaitingReview: 0,
        });
        d.expected++;
        const r = byItem[item.id];
        if (!r || r.inputStatus === INPUT_UNANSWERED) { d.unanswered++; return; }
        if (item.domain === "writing_recall") {
          // Writing is never auto-scored. Unreviewed writing is unassessed —
          // not zero, not an estimate (A02, A08).
          const rev = attempt.writingReviews.find((w) => w.itemId === item.id);
          if (rev && typeof rev.rubricScore === "number") { d.submitted++; d.correct += rev.rubricScore >= 2 ? 1 : 0; }
          else d.awaitingReview++;
          return;
        }
        d.submitted++;
        if (r.inputStatus === INPUT_DONT_KNOW) { d.dontKnow++; return; }
        if (isCorrect(byId[item.id], r)) d.correct++;
      });

      // Median seconds per answer, from the presentation's shownAt and the
      // response's submittedAt — both already recorded, so this needs no schema
      // change. It is the only signal available for "was that answered or
      // guessed": a 4-option item scores 25% on chance alone, and a domain sitting
      // at chance answered in a second or two is a different event from one
      // answered slowly and wrongly.
      const shownAt = {};
      attempt.presentations.forEach((p) => { shownAt[p.itemId] = Date.parse(p.shownAt); });
      Object.values(domains).forEach((d) => {
        const secs = [];
        selectItems(bank, forms, attempt.formId, band)
          .filter((it) => it.domain === d.domain)
          .forEach((it) => {
            const r = byItem[it.id];
            const t0 = shownAt[it.id];
            if (!r || !t0) return;
            const dt = (Date.parse(r.submittedAt) - t0) / 1000;
            // A resumed attempt can span days; that gap is not thinking time.
            if (dt >= 0 && dt < 600) secs.push(dt);
          });
        secs.sort((a, b) => a - b);
        d.medianSecs = secs.length
          ? Math.round((secs.length % 2 ? secs[(secs.length - 1) / 2]
              : (secs[secs.length / 2 - 1] + secs[secs.length / 2]) / 2) * 10) / 10
          : null;
        d.complete = d.submitted + d.dontKnow >= d.expected && d.unanswered === 0;
        // Chance for a 4-option item, so a score at or under it says the domain
        // carries no evidence either way — not that the child failed.
        d.chanceLevel = d.domain === "writing_recall" ? null : d.expected / 4;
        d.atChance = d.chanceLevel != null && d.complete && d.correct <= Math.ceil(d.chanceLevel);
        // A percentage is only meaningful over a completed domain. A partial
        // domain reports accuracy over what was submitted, explicitly flagged.
        d.accuracyOverSubmitted = d.submitted > 0 ? d.correct / d.submitted : null;
        d.completedDomainPct = d.complete && d.expected > 0 ? d.correct / d.expected : null;
      });

      byBand[band] = { band, domains };
    });

    return {
      attemptId: attempt.attemptId,
      playerId: attempt.playerId,
      bankVersion: attempt.bankVersion,
      formId: attempt.formId,
      bands: attempt.bands.slice(),
      byBand,
      // Convenience view of the FIRST band, so single-band callers read
      // naturally. Never a cross-band total.
      domains: (byBand[attempt.bands[0]] || { domains: {} }).domains,
      // Deliberately no overall figure: there is no defensible single number
      // for "Chinese ability" from these samples (A08).
      overall: null,
    };
  }

  // ── routing ──────────────────────────────────────────────────────────────
  function routeNextBand(score, currentBand) {
    const idx = BANDS.indexOf(currentBand);
    const reasons = [];
    let advance = true;
    // Route on THIS band's results only.
    const domains = (score.byBand && score.byBand[currentBand] ? score.byBand[currentBand].domains : score.domains) || {};

    Object.keys(ROUTING_THRESHOLDS).forEach((domain) => {
      const d = domains[domain];
      const need = ROUTING_THRESHOLDS[domain];
      if (!d || !d.complete) {
        advance = false;
        reasons.push(`${domain}: incomplete, cannot route on it`);
        return;
      }
      const got = d.correct;
      reasons.push(`${domain}: ${got}/${d.expected} (need ${need})`);
      if (got < need) advance = false;
    });

    if (idx === BANDS.length - 1 && advance) {
      return { advance: false, nextBand: null, atCeiling: true, reasons,
        note: "Highest available custom band sampled" };
    }
    return {
      advance,
      nextBand: advance ? BANDS[idx + 1] : null,
      atCeiling: false,
      reasons,
      // These thresholds choose the next sampling block. They are not a
      // pass/fail diagnosis and the recommended band stays provisional (A05).
      provisional: true,
    };
  }

  // ── comparison ───────────────────────────────────────────────────────────
  /**
   * Compare two attempts. Only like-for-like: same domain, band, support
   * condition and bank version. Anchor items are reported separately from
   * fresh ones, because improvement on a repeated anchor is not evidence of
   * generalised learning (A09).
   */
  function compareAttempts(a, b, bank, forms) {
    if (a.bankVersion !== b.bankVersion) {
      return { comparable: false, reason: "Not directly comparable — different bank versions with no reviewed compatibility map." };
    }
    const sharedBands = a.bands.filter((x) => b.bands.indexOf(x) !== -1);
    if (!sharedBands.length) {
      return { comparable: false, reason: "Not directly comparable — no band was tested in both attempts." };
    }

    const byId = itemsById(bank);
    const anchorOf = (attempt, bands) => {
      const res = { anchor: {}, fresh: {} };
      const map = {};
      attempt.responses.forEach((r) => { map[r.itemId] = r; });
      bands.forEach((band) => {
        selectItems(bank, forms, attempt.formId, band).forEach((item) => {
          if (item.domain === "writing_recall") return; // reviewed separately
          const bucket = item.anchorGroupId ? res.anchor : res.fresh;
          const d = (bucket[item.domain] = bucket[item.domain] || { correct: 0, submitted: 0 });
          const r = map[item.id];
          if (!r || r.inputStatus === INPUT_UNANSWERED) return;
          d.submitted++;
          if (isCorrect(byId[item.id], r)) d.correct++;
        });
      });
      return res;
    };

    const A = anchorOf(a, sharedBands), B = anchorOf(b, sharedBands);
    const diff = (x, y) => {
      const out = {};
      Object.keys(Object.assign({}, x, y)).forEach((domain) => {
        const p = x[domain] || { correct: 0, submitted: 0 };
        const q = y[domain] || { correct: 0, submitted: 0 };
        const pp = p.submitted ? p.correct / p.submitted : null;
        const qq = q.submitted ? q.correct / q.submitted : null;
        out[domain] = {
          before: `${p.correct}/${p.submitted}`,
          after: `${q.correct}/${q.submitted}`,
          pointDifference: pp === null || qq === null ? null : Math.round((qq - pp) * 100),
          sampleSize: { before: p.submitted, after: q.submitted },
        };
      });
      return out;
    };

    // Per band as well as pooled. Bands are never pooled in the report, and a
    // comparison that pooled them would hide exactly where the change happened.
    const byBand = {};
    sharedBands.forEach((band) => {
      const x = anchorOf(a, [band]), y = anchorOf(b, [band]);
      byBand[band] = { anchors: diff(x.anchor, y.anchor), fresh: diff(x.fresh, y.fresh) };
    });
    const notCompared = [...a.bands, ...b.bands].filter((x, i, arr) => sharedBands.indexOf(x) === -1 && arr.indexOf(x) === i);

    const sameForm = a.formId === b.formId;
    return {
      comparable: true,
      bands: sharedBands,
      byBand,
      notCompared,
      bandSetsDiffer: notCompared.length > 0,
      sameForm,
      label: sameForm
        ? "same-form repeat — scores can rise from familiarity with the identical questions"
        : "matched-form, provisional — forms are designed to match, not statistically equated",
      anchors: diff(A.anchor, B.anchor),
      fresh: diff(A.fresh, B.fresh),
      writing: compareWriting(a, b, bank, forms, sharedBands),
    };
  }

  /**
   * Handwriting, before and after — but only where a grown-up has actually
   * marked both sittings against the same rubric.
   *
   * This used to be an unconditional "not compared" string, so a parent who
   * had marked every character still saw nothing. It is still refused rather
   * than estimated in three cases, because none of them can be scored
   * honestly: an unreviewed answer is not a zero (§24), and two different
   * rubrics are not one scale.
   */
  function compareWriting(a, b, bank, forms, sharedBands) {
    const NONE = { compared: false, reason: "not compared — writing improvement is only reported when both attempts have a reviewed score" };
    const marks = (attempt) => {
      const m = {};
      (attempt.writingReviews || []).forEach((w) => {
        if (w && w.itemId && typeof w.rubricScore === "number") m[w.itemId] = w;
      });
      return m;
    };
    const ma = marks(a), mb = marks(b);
    if (!Object.keys(ma).length || !Object.keys(mb).length) return NONE;

    const rubrics = [...new Set([...Object.values(ma), ...Object.values(mb)].map((w) => w.rubricId))];
    if (rubrics.length !== 1) {
      return { compared: false, reason: "not compared — the two sittings were marked with different writing rubrics" };
    }
    const rubricId = rubrics[0];
    const levels = ((bank.rubrics || {})[rubricId] || {}).levels;
    if (!levels || !levels.length) {
      return { compared: false, reason: `not compared — the rubric these were marked with (${rubricId}) is not in this bank` };
    }
    const top = Math.max(...levels.map((l) => Number(l.score) || 0));

    // Anchors are the same character in both sittings, so they are the only
    // truly like-for-like writing evidence; everything else is reported apart.
    const tally = (attempt, marked, bands) => {
      const out = { anchors: { points: 0, max: 0, marked: 0 }, all: { points: 0, max: 0, marked: 0 } };
      bands.forEach((band) => {
        selectItems(bank, forms, attempt.formId, band).forEach((item) => {
          if (item.domain !== "writing_recall") return;
          const w = marked[item.id];
          if (!w) return; // never imputed as zero
          const add = (d) => { d.points += Number(w.rubricScore) || 0; d.max += top; d.marked++; };
          add(out.all);
          if (item.anchorGroupId) add(out.anchors);
        });
      });
      return out;
    };
    const row = (x, y) => ({
      before: `${x.points}/${x.max}`,
      after: `${y.points}/${y.max}`,
      pointDifference: x.max && y.max ? Math.round((y.points / y.max - x.points / x.max) * 100) : null,
      sampleSize: { before: x.marked, after: y.marked },
    });
    const byBand = {};
    sharedBands.forEach((band) => {
      const x = tally(a, ma, [band]), y = tally(b, mb, [band]);
      if (!x.all.marked && !y.all.marked) return;
      byBand[band] = { anchors: row(x.anchors, y.anchors), all: row(x.all, y.all) };
    });
    if (!Object.keys(byBand).length) return NONE;
    const A = tally(a, ma, sharedBands), B = tally(b, mb, sharedBands);
    return {
      compared: true, rubricId, byBand,
      anchors: row(A.anchors, B.anchors), all: row(A.all, B.all),
      note: "Marked by a grown-up against the same rubric, not by the app.",
    };
  }

  return {
    BANDS, DOMAIN_ORDER, DOMAIN_EXPECTED, ROUTING_THRESHOLDS, STATES,
    INPUT_SUBMITTED, INPUT_DONT_KNOW, INPUT_UNANSWERED,
    mulberry32, hashString, shuffled, itemsById,
    selectItems, createAttempt, canTransition, transition, present, respond,
    nextPlannedBand, isCorrect, scoreAttempt, routeNextBand, compareAttempts,
    ACTIVE_CAP_MS, BREAK_AFTER_MS, addActiveTime, shouldOfferBreak, markBreakOffered,
    newClock, resumeClock, pauseClock, flushClock,
  };
});
