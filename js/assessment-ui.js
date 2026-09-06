/* eslint-disable */
"use strict";
/**
 * Assessment overlay.
 *
 * Depends on the app's globals (state, curP, savePlayer, showToast, speak,
 * laterCall, sessionGen) and on AssessmentCore / PlayerStore, so it is loaded
 * after the inline script.
 *
 * Tone is deliberately flat. This is a calm check, not a gate boss: no streaks,
 * no reward sounds, no correctness reveal, no encouragement between items. All
 * of that resumes afterwards, in the practice offered from the results screen.
 */
(function () {
  const C = globalThis.AssessmentCore;
  const S = globalThis.PlayerStore;
  if (!C || !S) { console.warn("assessment-ui: core modules missing"); return; }

  const FIRST_BAND = "C1";
  let ui = null;   // { attempt, band, items, idx, bankData, gen, owner }

  const el = (id) => document.getElementById(id);
  const body = () => el("assessment-body");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function storeCtx() {
    return { storage: window.localStorage, db: typeof db !== "undefined" ? db : null };
  }

  // ── entry ────────────────────────────────────────────────────────────────
  globalThis.openAssessment = async function openAssessment() {
    if (!curP) { showToast("Pick a profile first."); return; }
    const overlay = el("assessment-overlay");
    if (!overlay) return;
    body().innerHTML = '<div class="dd-desc">Loading assessment…</div>';
    overlay.classList.add("show");

    // The fetch can outlive the profile that opened it.
    const gen = sessionGen;
    const owner = curP;
    const data = await loadAssessmentBank();
    if (gen !== sessionGen || curP !== owner) return;
    if (!data) {
      body().innerHTML = '<div class="dd-desc">The assessment is unavailable right now. Nothing has been lost — try again later.</div>';
      return;
    }
    ui = { bankData: data, attempt: null, items: [], idx: 0, gen, owner };
    renderHome();
  };

  globalThis.closeAssessment = function closeAssessment() {
    // Leaving mid-attempt is fine and costs nothing: there is no deadline, no
    // penalty and no expiry. Whatever was answered is already saved.
    if (ui && ui.attempt && ui.attempt.status === "active") {
      C.transition(ui.attempt, "paused");
      persist();
      showToast("Assessment saved — you can carry on next time.", 2400);
    }
    const overlay = el("assessment-overlay");
    if (overlay) overlay.classList.remove("show");
    ui = null;
  };

  function persist() {
    if (!ui || !ui.attempt) return;
    const res = S.saveAttempt(storeCtx(), ui.attempt);
    S.pushAttempt(storeCtx(), ui.attempt).then((r) => {
      const status = r.ok ? S.SYNC_OK : (r.conflict ? S.SYNC_ATTENTION : res.status);
      const badge = el("assessment-sync");
      if (badge) badge.textContent = status;
    }).catch(() => {});
    return res;
  }

  // ── home / history ───────────────────────────────────────────────────────
  function renderHome() {
    const past = S.listAttempts(storeCtx(), curP);
    const done = past.filter((a) => a.status === "results_available" || a.status === "submitted");
    const open = past.find((a) => a.status === "active" || a.status === "paused");

    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;line-height:1.6;">
        This is a quiet check of what you can read and understand right now.
        There are no stars and no timer — you can stop any time and finish later.
      </div>
      <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.9rem;">
        ${open
          ? `<button class="btn-g" onclick="assessmentResume('${esc(open.attemptId)}')">Continue assessment</button>`
          : `<button class="btn-g" onclick="assessmentStart('baseline')">Start baseline</button>`}
        ${done.length ? `<button class="btn-s" onclick="assessmentHistory()">History &amp; compare (${done.length})</button>` : ""}
      </div>
      <div id="assessment-sync" style="font-size:.68rem;color:var(--muted);text-align:center;margin-top:.7rem;"></div>`;
  }

  globalThis.assessmentHistory = function assessmentHistory() {
    const past = S.listAttempts(storeCtx(), curP)
      .filter((a) => a.status === "results_available" || a.status === "submitted");
    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;">Past assessments for this profile.</div>
      <div style="display:flex;flex-direction:column;gap:.45rem;margin:.8rem 0;">
        ${past.map((a) => `
          <div class="practice-box" style="text-align:left;">
            <div style="font-size:.78rem;color:var(--ink);">${esc(String(a.createdAt).slice(0, 10))} · form ${esc(a.formId)} · bands ${esc(a.bands.join(", "))}</div>
            <div style="font-size:.68rem;color:var(--muted);margin-top:.2rem;">bank ${esc(a.bankVersion)}</div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.45rem;">
              <button class="btn-s" onclick="assessmentShowResult('${esc(a.attemptId)}')">See report</button>
              <button class="btn-s" onclick="assessmentRepeat('${esc(a.attemptId)}','same')">Repeat same questions</button>
              <button class="btn-s" onclick="assessmentRepeat('${esc(a.attemptId)}','matched')">Try the matched set</button>
            </div>
          </div>`).join("")}
      </div>
      <button class="btn-s" onclick="assessmentHome()">Back</button>`;
  };
  globalThis.assessmentHome = renderHome;

  // ── running an attempt ───────────────────────────────────────────────────
  globalThis.assessmentStart = function assessmentStart(mode, formId, comparisonAttemptId) {
    const attempt = C.createAttempt({
      attemptId: S.newAttemptId(curP),
      playerId: curP,                 // fixed here; never re-read from a later global
      bankVersion: ui.bankData.manifest.bankVersion,
      formId: formId || "A",
      mode: mode || "baseline",
      bands: [FIRST_BAND],
      comparisonAttemptId: comparisonAttemptId || null,
    });
    C.transition(attempt, "active");
    ui.attempt = attempt;
    ui.band = FIRST_BAND;
    ui.items = C.selectItems(ui.bankData.bank, ui.bankData.forms, attempt.formId, FIRST_BAND);
    ui.idx = 0;
    persist();
    renderItem();
  };

  globalThis.assessmentResume = function assessmentResume(attemptId) {
    const attempt = S.loadAttempt(storeCtx(), attemptId);
    if (!attempt || attempt.playerId !== curP) { showToast("That assessment belongs to another profile."); return; }
    if (attempt.status === "paused") C.transition(attempt, "active");
    ui.attempt = attempt;
    // Resume in the furthest band the attempt reached, at its first unanswered
    // item — not at the start of C1.
    ui.band = attempt.bands[attempt.bands.length - 1] || FIRST_BAND;
    ui.items = C.selectItems(ui.bankData.bank, ui.bankData.forms, attempt.formId, ui.band);
    const answered = new Set(attempt.responses.map((r) => r.itemId));
    const next = ui.items.findIndex((i) => !answered.has(i.id));
    ui.idx = next === -1 ? ui.items.length : next;
    renderItem();
  };

  globalThis.assessmentRepeat = function assessmentRepeat(attemptId, kind) {
    const prev = S.loadAttempt(storeCtx(), attemptId);
    if (!prev) return;
    if (kind === "same") {
      showToast("Same questions as before — scores can rise just from seeing them again.", 3200);
      assessmentStart("repeat", prev.formId, attemptId);
    } else {
      assessmentStart("matched", prev.formId === "A" ? "B" : "A", attemptId);
    }
  };

  function renderItem() {
    const a = ui.attempt;
    if (ui.idx >= ui.items.length) return renderBandEnd();
    const item = ui.items[ui.idx];

    // Persist the presentation BEFORE the item is on screen, so a reload cannot
    // reshuffle the options under a child who has already looked at them.
    const pres = C.present(a, item, { audioSource: item.options.some((o) => o.audioAssetId) ? "clip" : null });
    persist();

    const order = pres.optionOrder.length ? pres.optionOrder : item.options.map((o) => o.id);
    const byId = {}; item.options.forEach((o) => { byId[o.id] = o; });
    const passage = item.passageId ? ui.bankData.bank.passages[item.passageId] : null;

    body().innerHTML = `
      <div class="mq-progress">Question ${ui.idx + 1} of ${ui.items.length}</div>
      ${passage ? `<div class="practice-box" style="font-family:var(--fzh);font-size:1.05rem;line-height:1.9;text-align:left;">${esc(passage.zh)}</div>` : ""}
      ${item.prompt.zh ? `<div class="mq-hz" style="font-family:var(--fzh);">${esc(item.prompt.zh)}</div>` : ""}
      ${item.prompt.pinyin ? `<div class="mq-py">${esc(item.prompt.pinyin)}</div>` : ""}
      <div class="mq-question">${esc(item.prompt.enInstruction)}</div>
      ${item.domain === "writing_recall" ? renderWriting(item) : `
        <div style="display:flex;flex-direction:column;gap:.45rem;margin-top:.7rem;">
          ${order.map((oid, n) => {
            const o = byId[oid];
            if (!o) return "";
            return o.audioAssetId
              ? `<button class="mcq-opt" onclick="assessmentPlay('${esc(o.audioAssetId)}','${esc(oid)}')">🔊 Sound ${n + 1}</button>
                 <button class="btn-s" style="margin:-.3rem 0 .2rem;" onclick="assessmentAnswer('${esc(oid)}')">Choose sound ${n + 1}</button>`
              : `<button class="mcq-opt" onclick="assessmentAnswer('${esc(oid)}')">${esc(o.text)}</button>`;
          }).join("")}
        </div>`}
      <div style="display:flex;gap:.4rem;justify-content:center;flex-wrap:wrap;margin-top:.9rem;">
        <button class="btn-s" onclick="assessmentDontKnow()">I don't know</button>
        <button class="btn-s" onclick="closeAssessment()">Save &amp; exit</button>
      </div>
      <div id="assessment-sync" style="font-size:.68rem;color:var(--muted);text-align:center;margin-top:.6rem;"></div>`;
  }

  function renderWriting(item) {
    return `
      <div class="practice-box" style="text-align:left;">
        <div style="font-size:.76rem;color:var(--muted);line-height:1.6;">
          Write it on paper, then tap Done. A grown-up can look at it later —
          the app does not mark handwriting by itself.
        </div>
        <button class="btn-s" style="margin-top:.5rem;" onclick="assessmentPlayPrompt('${esc(item.prompt.audioAssetId || "")}')">🔊 Hear it again</button>
      </div>
      <button class="btn-g" style="margin-top:.6rem;width:100%;" onclick="assessmentAnswer(null)">Done — I wrote it</button>`;
  }

  globalThis.assessmentPlay = function assessmentPlay(key) {
    // Replays are free and unlimited: hearing an option again is the task, not
    // a hint. Plays are logged but never penalised.
    if (typeof playPinyinClip === "function") playPinyinClip(key, "");
    if (ui && ui.attempt) {
      const r = ui.attempt.presentations[ui.attempt.presentations.length - 1];
      if (r) r.audioPlays = (r.audioPlays || 0) + 1;
    }
  };
  globalThis.assessmentPlayPrompt = globalThis.assessmentPlay;

  function commit(input) {
    const item = ui.items[ui.idx];
    C.respond(ui.attempt, Object.assign({ itemId: item.id }, input));
    persist();
    ui.idx++;
    // No correctness reveal, no streak, no reward — just the next question.
    renderItem();
  }
  globalThis.assessmentAnswer = function (optionId) {
    commit({ selectedOptionId: optionId, inputStatus: C.INPUT_SUBMITTED,
      writingRef: optionId === null ? "paper" : null });
  };
  globalThis.assessmentDontKnow = function () {
    commit({ selectedOptionId: null, inputStatus: C.INPUT_DONT_KNOW });
  };

  /**
   * End of a band. Routing decides whether another set is offered — and it
   * uses only the unaided domains, so leaning on pinyin or leaving handwriting
   * unreviewed never opens or closes the next band.
   */
  function renderBandEnd() {
    const a = ui.attempt;
    const score = C.scoreAttempt(a, ui.bankData.bank, ui.bankData.forms);
    const route = C.routeNextBand(score, ui.band);
    const available = (ui.bankData.manifest.bands || []).indexOf(route.nextBand) !== -1;

    if (!route.advance || !route.nextBand || !available) return renderReview(route);

    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;line-height:1.6;">
        That's the end of this set — nicely done. There is another set with
        slightly harder words if you'd like to try it. You don't have to, and
        stopping here does not change anything you've already done.
      </div>
      <div style="display:flex;flex-direction:column;gap:.45rem;margin-top:.9rem;">
        <button class="btn-g" onclick="assessmentNextBand()">Try the next set</button>
        <button class="btn-s" onclick="assessmentSubmit()">Stop here and see my report</button>
        <button class="btn-s" onclick="closeAssessment()">Save and finish later</button>
      </div>`;
  }

  globalThis.assessmentNextBand = function assessmentNextBand() {
    const a = ui.attempt;
    const score = C.scoreAttempt(a, ui.bankData.bank, ui.bankData.forms);
    const route = C.routeNextBand(score, ui.band);
    if (!route.nextBand) return renderReview(route);
    ui.band = route.nextBand;
    if (a.bands.indexOf(ui.band) === -1) a.bands.push(ui.band);
    ui.items = C.selectItems(ui.bankData.bank, ui.bankData.forms, a.formId, ui.band);
    ui.idx = 0;
    persist();
    renderItem();
  };

  // ── review / submit ──────────────────────────────────────────────────────
  function renderReview(route) {
    const a = ui.attempt;
    const unanswered = ui.items.filter((i) => !a.responses.some((r) => r.itemId === i.id)).length;
    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;line-height:1.6;">
        That's the end. ${unanswered ? `${unanswered} question${unanswered === 1 ? " was" : "s were"} left blank — that is fine, blanks are not counted as wrong.` : "Everything was answered."}
        ${route && route.atCeiling ? " You reached the last set we have." : ""}
      </div>
      <button class="btn-g" style="margin-top:.8rem;width:100%;" onclick="assessmentSubmit()">Finish and see my report</button>
      <button class="btn-s" style="margin-top:.4rem;width:100%;" onclick="closeAssessment()">Not yet — save for later</button>`;
  }

  globalThis.assessmentSubmit = function assessmentSubmit() {
    const a = ui.attempt;
    if (a.status === "active") C.transition(a, "submitted");
    if (a.status === "submitted") C.transition(a, "results_available");
    persist();
    renderResult(a);
  };

  globalThis.assessmentShowResult = function (attemptId) {
    const a = S.loadAttempt(storeCtx(), attemptId);
    if (a && a.playerId === curP) renderResult(a);
  };

  const DOMAIN_LABEL = {
    recognition_unaided: "Reading characters on their own",
    decoding_supported: "Reading with pinyin to help",
    meaning_context: "What words mean in a sentence",
    passage_comprehension: "Understanding a short text",
    writing_recall: "Writing from memory",
  };

  function renderResult(attempt) {
    const score = C.scoreAttempt(attempt, ui.bankData.bank, ui.bankData.forms);
    const highest = attempt.bands[attempt.bands.length - 1] || FIRST_BAND;
    const route = C.routeNextBand(score, highest);
    // One block per band. Bands are never merged: "8 of 8" across four bands
    // would hide both what was actually attempted and where it fell off.
    const bandBlock = (bandId) => {
      const entry = score.byBand[bandId];
      if (!entry) return "";
      const rows = Object.values(entry.domains).map((d) => {
        const detail = d.domain === "writing_recall" && d.awaitingReview
          ? `<span style="color:var(--muted);">${d.awaitingReview} waiting for a grown-up to look at — not scored yet</span>`
          : d.complete
            ? `${d.correct} of ${d.expected} right`
            : `${d.correct} of ${d.submitted} answered right · ${d.unanswered} not answered <span style="color:var(--muted);">(part of the set only)</span>`;
        return `<div style="padding:.35rem 0;border-bottom:1px solid rgba(212,160,23,.14);text-align:left;">
          <div style="font-size:.78rem;color:var(--ink);">${esc(DOMAIN_LABEL[d.domain] || d.domain)}</div>
          <div style="font-size:.72rem;color:var(--gold);margin-top:.12rem;">${detail}</div>
        </div>`;
      }).join("");
      return `<div class="practice-box" style="text-align:left;margin-bottom:.6rem;">
        <div style="font-size:.8rem;color:var(--gold-bright);margin-bottom:.25rem;">Set ${esc(bandId)}</div>
        ${rows}
      </div>`;
    };
    const rows = attempt.bands.map(bandBlock).join("");

    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;">Assessment report · ${esc(String(attempt.createdAt).slice(0, 10))} · form ${esc(attempt.formId)} · sets ${esc(attempt.bands.join(", "))}</div>
      <div style="margin:.7rem 0;">${rows}</div>
      <div class="practice-box" style="text-align:left;font-size:.74rem;line-height:1.6;">
        <strong style="color:var(--ink);">What this is</strong><br>
        A small sample of reading and understanding, not a test score or an HSK
        level. Sound options are read out by this device, so they can sound
        different on another device — treat changes on the listening questions
        with that in mind.
        ${route.atCeiling ? "<br>Highest available set sampled." : ""}
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.8rem;">
        <button class="btn-s" onclick="assessmentHome()">Done</button>
      </div>`;
  }
})();
