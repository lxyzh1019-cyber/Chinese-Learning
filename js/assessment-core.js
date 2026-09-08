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
      status: "created",
      revision: 1,
      createdAt: opts.createdAt || new Date().toISOString(),
      submittedAt: null,
      activeTimeMs: 0,
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
    const seed = hashString(`${attempt.attemptId}:${item.id}`);
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
    const anchorOf = (attempt) => {
      const res = { anchor: {}, fresh: {} };
      const map = {};
      attempt.responses.forEach((r) => { map[r.itemId] = r; });
      sharedBands.forEach((band) => {
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

    const A = anchorOf(a), B = anchorOf(b);
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

    const sameForm = a.formId === b.formId;
    return {
      comparable: true,
      bands: sharedBands,
      sameForm,
      label: sameForm
        ? "same-form repeat — scores can rise from familiarity with the identical questions"
        : "matched-form, provisional — forms are designed to match, not statistically equated",
      anchors: diff(A.anchor, B.anchor),
      fresh: diff(A.fresh, B.fresh),
      writing: "not compared — writing improvement is only reported when both attempts have a reviewed score",
    };
  }

  return {
    BANDS, DOMAIN_ORDER, DOMAIN_EXPECTED, ROUTING_THRESHOLDS, STATES,
    INPUT_SUBMITTED, INPUT_DONT_KNOW, INPUT_UNANSWERED,
    mulberry32, hashString, shuffled, itemsById,
    selectItems, createAttempt, canTransition, transition, present, respond,
    isCorrect, scoreAttempt, routeNextBand, compareAttempts,
  };
});
