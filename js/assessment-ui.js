/* eslint-disable */
"use strict";
/**
 * Assessment screen.
 *
 * Depends on the app's globals (state, curP, savePlayer, showToast, speak,
 * laterCall, sessionGen) and on AssessmentCore / PlayerStore, so it is loaded
 * after the inline script.
 *
 * Tone is deliberately flat. This is a calm check, not a gate boss: no streaks,
 * no reward sounds, no correctness reveal, no encouragement between items. All
 * of that resumes afterwards, in the practice offered from the results screen.
 *
 * It lives on its own screen, entered from the profile-select screen, rather
 * than in an overlay opened from the games strip. It shared a stylesheet, a
 * z-index and a close button with Games, Drill and Flash Cards, which said it
 * was another activity in the reward loop; it is the one thing in the app that
 * awards nothing and unlocks nothing.
 */
(function () {
  const C = globalThis.AssessmentCore;
  const S = globalThis.PlayerStore;
  if (!C || !S) { console.warn("assessment-ui: core modules missing"); return; }

  const FIRST_BAND = "C1";
  let ui = null;   // { attempt, band, items, idx, bankData, gen, owner }

  /** A set's plain name. "Set C1" told a parent nothing about what separates it
   *  from "Set C2", and nothing on screen named the band during the run at all —
   *  which is why two sittings that never left C1 looked like the same test. */
  function bandInfo(bandId) {
    const info = ((ui && ui.bankData && ui.bankData.manifest.bandInfo) || {})[bandId];
    return info || { name: `Set ${bandId}`, zh: "", about: "" };
  }
  function bandName(bandId) { return bandInfo(bandId).name; }
  function bandOrdinal(bandId) {
    const bands = (ui && ui.bankData && ui.bankData.manifest.bands) || [];
    const i = bands.indexOf(bandId);
    return i < 0 ? "" : `${i + 1} of ${bands.length}`;
  }

  const el = (id) => document.getElementById(id);
  const body = () => el("assessment-body");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function storeCtx() {
    return { storage: window.localStorage, db: typeof db !== "undefined" ? db : null };
  }
  const DEV = () => S.deviceId(window.localStorage);

  // Anything saved while offline is pushed when the connection returns. The
  // queue used to be written on every save and drained by nothing.
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("online", () => { S.flushQueue(storeCtx()).catch(() => {}); });
  }

  /** Warn before the app's play-session cap lands, so a 34-item set is not
   *  guillotined mid-question with no warning. The cap itself is deliberately
   *  left alone — the assessment follows the same parent-extension policy as
   *  everything else — but arriving at it by surprise is not a policy, it is an
   *  omission. Nothing is lost either way: every answer is saved as it is given.
   */
  const SESSION_WARN_SECS = 180;
  function sessionNotice() {
    // Only while a play session is actually running. Entering from the select
    // screen starts no timer, and timerSecs keeps whatever the last hub session
    // left behind — so without this the notice fired on an assessment that was
    // costing the child no play time at all.
    if (typeof timerIv === "undefined" || !timerIv) return "";
    if (typeof timerSecs === "undefined" || typeof timerSecs !== "number") return "";
    if (timerSecs <= 0 || timerSecs > SESSION_WARN_SECS) return "";
    const mins = Math.max(1, Math.ceil(timerSecs / 60));
    return `<div style="font-size:.7rem;line-height:1.5;text-align:center;margin-top:.6rem;padding:.4rem .5rem;
      border:1px solid rgba(212,160,23,.28);border-radius:8px;background:rgba(212,160,23,.08);color:var(--ink);">
      ⏳ About ${mins} minute${mins === 1 ? "" : "s"} of today's play time left. Your answers are saved as you go —
      you can carry on after a grown-up unlocks more time, or stop here and finish later.</div>`;
  }

  // ── entry ────────────────────────────────────────────────────────────────
  globalThis.openAssessment = async function openAssessment() {
    if (!curP) { showToast("Pick a profile first."); return; }
    if (!body()) return;
    body().innerHTML = '<div class="dd-desc">Loading assessment…</div>';

    // The fetch can outlive the profile that opened it.
    const gen = sessionGen;
    const owner = curP;
    const data = await loadAssessmentBank();
    if (gen !== sessionGen || curP !== owner) return;
    if (!data) {
      body().innerHTML = '<div class="dd-desc">The assessment is unavailable right now. Nothing has been lost — try again later.</div>';
      return;
    }
    // Bring down what other devices have uploaded, then push anything this
    // device still owes. Both are no-ops offline.
    try { await S.hydrateFromCloud(storeCtx(), owner, DEV()); } catch (e) { /* offline */ }
    try { await S.flushQueue(storeCtx()); } catch (e) { /* offline */ }
    if (gen !== sessionGen || curP !== owner) return;
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
    ui = null;
    // Back to the select screen, not the hub: the assessment was never entered
    // from a child's play session, so there is no session to return into.
    if (typeof goToSelect === "function") goToSelect();
  };

  function persist() {
    if (!ui || !ui.attempt) return;
    const res = S.saveAttempt(storeCtx(), ui.attempt);
    const badge = el("assessment-sync");
    if (badge) badge.textContent = res.status;
    S.pushAttempt(storeCtx(), ui.attempt).then((r) => {
      // Only a push the cloud accepted may say "Synced". A refused or offline
      // push leaves the local-save status standing.
      const status = r.ok ? S.SYNC_OK : (r.conflict ? S.SYNC_ATTENTION : res.status);
      const b = el("assessment-sync");
      if (b) b.textContent = status;
    }).catch(() => {});
    return res;
  }

  /** "Synced" or "Saved on this device", from what the cloud actually acknowledged. */
  function syncLabel(attempt) {
    return S.isSynced(storeCtx(), attempt) ? S.SYNC_OK : S.SYNC_LOCAL;
  }

  /**
   * The bank an attempt was taken with. Reports used to be scored on whatever
   * bank was loaded, so a bank edit silently re-interpreted every old answer.
   * A version the manifest no longer ships returns null and the caller says so.
   */
  async function bankFor(version) {
    if (!ui || !ui.bankData) return null;
    if (!version || version === ui.bankData.manifest.bankVersion) return ui.bankData;
    if (typeof loadAssessmentBank !== "function") return null;
    return await loadAssessmentBank(version);
  }
  /** The bank the running attempt is drawn from (a repeat may run on an older version). */
  const runBank = () => (ui && ui.runBank) || ui.bankData;

  function unavailableBank(attempt) {
    const who = typeof playerName === "function" ? playerName(attempt.playerId) : attempt.playerId;
    return `
      <div class="dd-desc" style="text-align:left;">
        <strong style="color:var(--gold);">${esc(who)}</strong> · assessment report<br>
        ${esc(String(attempt.createdAt).slice(0, 10))} · form ${esc(attempt.formId)} ·
        ${esc((attempt.bands || []).map(bandName).join(", "))} · ${esc((attempt.responses || []).length)} answers
      </div>
      <div class="practice-box" style="text-align:left;font-size:.74rem;line-height:1.6;margin-top:.7rem;">
        This report was taken on bank ${esc(attempt.bankVersion || "?")}, which is no longer
        available, so it cannot be scored again here. The answers are kept unchanged;
        they are just not re-marked against a different set of questions.
      </div>
      <button class="btn-s" style="margin-top:.8rem;" onclick="assessmentHome()">Done</button>`;
  }

  // ── home / history ───────────────────────────────────────────────────────
  function renderHome() {
    const past = S.listAttempts(storeCtx(), curP);
    const done = past.filter((a) => a.status === "results_available" || a.status === "submitted");
    const open = past.find((a) => S.inProgress(a));
    // In progress, but started on another device: it is continued there. Offering
    // "Continue" here would put two devices on one attempt, which is the case the
    // compare-and-set can only refuse, never reconcile.
    const elsewhere = open && !S.resumableOn(open, DEV());

    const bands = (ui.bankData.manifest.bands) || [FIRST_BAND];
    const note = ui.bankData.manifest.bandNote || "";

    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;line-height:1.6;">
        This is a quiet check of what you can read and understand right now.
        There are no stars and no timer — you can stop any time and finish later.
      </div>
      <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.9rem;">
        ${open && !elsewhere
          ? `<button class="btn-g" onclick="assessmentResume('${esc(open.attemptId)}')">Continue assessment</button>`
          : `<button class="btn-g" onclick="assessmentStart('baseline')">Start at ${esc(bandName(FIRST_BAND))}</button>`}
        ${elsewhere ? `<div class="practice-box" style="font-size:.72rem;line-height:1.5;">An assessment from ${esc(String(open.createdAt).slice(0, 10))} is in progress on another device — finish it there. Nothing is lost.</div>` : ""}
        ${done.length ? `<button class="btn-s" onclick="assessmentHistory()">History &amp; compare (${done.length})</button>` : ""}
        <button class="btn-s" onclick="assessmentSets()">What the sets are · 各组说明</button>
      </div>
      ${open && !elsewhere ? "" : `
        <div class="practice-box" style="text-align:left;margin-top:.8rem;">
          <div style="font-size:.72rem;color:var(--ink);margin-bottom:.35rem;">Start somewhere else</div>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;">
            ${bands.slice(1).map((b) => `<button class="btn-s" style="font-size:.68rem;" onclick="assessmentStart('baseline',null,null,'${esc(b)}')">${esc(bandName(b))}</button>`).join("")}
          </div>
          <div style="font-size:.66rem;color:var(--muted);margin-top:.35rem;line-height:1.5;">
            Every set is scored on its own questions, so starting higher does not
            borrow credit — it only skips the easier evidence.
          </div>
        </div>`}
      <div id="assessment-sync" style="font-size:.68rem;color:var(--muted);text-align:center;margin-top:.7rem;"></div>
      ${note ? `<div style="font-size:.66rem;color:var(--muted);text-align:left;margin-top:.5rem;line-height:1.5;">${esc(note)}</div>` : ""}`;
  }

  globalThis.assessmentSets = function assessmentSets() {
    const bands = (ui.bankData.manifest.bands) || [];
    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;line-height:1.6;">
        Four sets, harder in order. Each is scored only on its own questions, so
        a strong easier set can never carry a weaker harder one.
      </div>
      <div style="margin:.8rem 0;">
        ${bands.map((b) => {
          const i = bandInfo(b);
          return `<div class="practice-box" style="text-align:left;margin-bottom:.5rem;">
            <div style="font-size:.78rem;color:var(--gold-bright);">${esc(i.name)}</div>
            <div style="font-size:.7rem;color:var(--muted);font-family:var(--fzh);">${esc(i.zh || "")}</div>
            <div style="font-size:.7rem;color:var(--ink);margin-top:.25rem;line-height:1.5;">${esc(i.about || "")}</div>
            ${i.passageChars ? `<div style="font-size:.66rem;color:var(--muted);margin-top:.2rem;">Reading passages of about ${esc(i.passageChars)} characters.</div>` : ""}
          </div>`;
        }).join("")}
      </div>
      <div class="practice-box" style="text-align:left;font-size:.7rem;line-height:1.6;">
        ${esc(ui.bankData.manifest.bandNote || "")}
      </div>
      <button class="btn-s" style="margin-top:.7rem;" onclick="assessmentHome()">Back</button>`;
  };

  globalThis.assessmentHistory = function assessmentHistory() {
    const past = S.listAttempts(storeCtx(), curP)
      .filter((a) => a.status === "results_available" || a.status === "submitted");
    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;">Past assessments for this profile.</div>
      <div style="display:flex;flex-direction:column;gap:.45rem;margin:.8rem 0;">
        ${past.map((a) => `
          <div class="practice-box" style="text-align:left;">
            <div style="font-size:.78rem;color:var(--ink);">${esc(typeof playerName === "function" ? playerName(a.playerId) : a.playerId)} · ${esc(String(a.createdAt).slice(0, 10))} · form ${esc(a.formId)}</div>
            <div style="font-size:.7rem;color:var(--gold);">${esc(a.bands.map(bandName).join(", "))}</div>
            <div style="font-size:.68rem;color:var(--muted);margin-top:.2rem;">bank ${esc(a.bankVersion)} · ${esc(syncLabel(a))}</div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.45rem;">
              <button class="btn-s" onclick="assessmentShowResult('${esc(a.attemptId)}')">See report</button>
              <button class="btn-s" onclick="assessmentRepeat('${esc(a.attemptId)}','same')">Repeat same questions</button>
              <button class="btn-s" onclick="assessmentRepeat('${esc(a.attemptId)}','matched')">Try the matched set</button>
              ${a.comparisonAttemptId ? `<button class="btn-s" onclick="assessmentCompare('${esc(a.attemptId)}')">Before &amp; after</button>` : ""}
            </div>
          </div>`).join("")}
      </div>
      <button class="btn-s" onclick="assessmentHome()">Back</button>`;
  };
  globalThis.assessmentHome = renderHome;

  // ── running an attempt ───────────────────────────────────────────────────
  globalThis.assessmentStart = function assessmentStart(mode, formId, comparisonAttemptId, startBand, extra) {
    // The starting set was hardcoded, so a child plainly past the first set had
    // to sit 34 easy items to prove it. createAttempt already took `bands`; the
    // UI simply never passed one.
    const x = extra || {};
    ui.runBank = x.bank || null;
    const bank = runBank();
    const available = (bank.manifest.bands) || [FIRST_BAND];
    const band = available.indexOf(startBand) !== -1 ? startBand : FIRST_BAND;
    const attempt = C.createAttempt({
      attemptId: S.newAttemptId(curP),
      playerId: curP,                 // fixed here; never re-read from a later global
      bankVersion: bank.bankVersion || bank.manifest.bankVersion,
      formId: formId || "A",
      mode: mode || "baseline",
      bands: [band],
      comparisonAttemptId: comparisonAttemptId || null,
      deviceId: DEV(),
      optionSeedAttemptId: x.optionSeedAttemptId || null,
      bandPath: x.bandPath || null,
    });
    C.transition(attempt, "active");
    ui.attempt = attempt;
    ui.band = band;
    ui.items = C.selectItems(bank.bank, bank.forms, attempt.formId, band);
    ui.idx = 0;
    persist();
    renderItem();
  };

  globalThis.assessmentResume = async function assessmentResume(attemptId) {
    const attempt = S.loadAttempt(storeCtx(), attemptId);
    if (!attempt || attempt.playerId !== curP) { showToast("That assessment belongs to another profile."); return; }
    if (!S.resumableOn(attempt, DEV())) { showToast("That assessment is in progress on another device — finish it there."); return; }
    if (attempt.status === "paused") C.transition(attempt, "active");
    const bank = await bankFor(attempt.bankVersion);
    if (!bank) { showToast("That assessment was taken on a bank that is no longer available, so it cannot be continued."); return; }
    ui.runBank = bank === ui.bankData ? null : bank;
    ui.attempt = attempt;
    // Resume in the furthest band the attempt reached, at its first unanswered
    // item — not at the start of C1.
    ui.band = attempt.bands[attempt.bands.length - 1] || FIRST_BAND;
    ui.items = C.selectItems(bank.bank, bank.forms, attempt.formId, ui.band);
    const answered = new Set(attempt.responses.map((r) => r.itemId));
    const next = ui.items.findIndex((i) => !answered.has(i.id));
    ui.idx = next === -1 ? ui.items.length : next;
    renderItem();
  };

  globalThis.assessmentRepeat = async function assessmentRepeat(attemptId, kind) {
    const prev = S.loadAttempt(storeCtx(), attemptId);
    if (!prev) return;
    // Both kinds start where the first sitting started. Repeat used to default
    // to the first set, so a child who had started at Set 3 re-sat two easier
    // sets first, and "same questions" reshuffled every option under a fresh id.
    const startBand = (prev.bands && prev.bands[0]) || FIRST_BAND;
    if (kind === "same") {
      const bank = await bankFor(prev.bankVersion);
      if (!bank) { showToast(`That assessment was taken on bank ${prev.bankVersion}, which is no longer available, so the same questions cannot be repeated.`, 3600); return; }
      showToast("Same questions as before — scores can rise just from seeing them again.", 3200);
      assessmentStart("repeat", prev.formId, attemptId, startBand, {
        bank: bank === ui.bankData ? null : bank,
        optionSeedAttemptId: prev.optionSeedAttemptId || prev.attemptId,
        bandPath: (prev.bands || [startBand]).slice(),
      });
    } else {
      assessmentStart("matched", prev.formId === "A" ? "B" : "A", attemptId, startBand);
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
    const passage = item.passageId ? runBank().bank.passages[item.passageId] : null;

    body().innerHTML = `
      <div class="mq-progress">${esc(bandName(ui.band))} · set ${esc(bandOrdinal(ui.band))}</div>
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
      ${sessionNotice()}
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
    const bank = runBank();
    const score = C.scoreAttempt(a, bank.bank, bank.forms);
    const route = C.routeNextBand(score, ui.band);
    // A same-questions repeat follows the original sitting's band sequence
    // rather than re-routing on today's answers, so the two are comparable.
    const planned = C.nextPlannedBand(a, ui.band);
    if (planned !== undefined) {
      if (!planned) return renderReview(route);
      body().innerHTML = `
        <div class="dd-desc" style="text-align:left;line-height:1.6;">
          That's the end of this set. Last time you went on to ${esc(bandName(planned))} —
          the same questions are here again if you'd like to. Stopping here is fine.
        </div>
        <div style="display:flex;flex-direction:column;gap:.45rem;margin-top:.9rem;">
          <button class="btn-g" onclick="assessmentNextBand()">Next set — same as last time</button>
          <button class="btn-s" onclick="assessmentSubmit()">Stop here and see my report</button>
          <button class="btn-s" onclick="closeAssessment()">Save and finish later</button>
        </div>`;
      return;
    }
    const available = (bank.manifest.bands || []).indexOf(route.nextBand) !== -1;

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
    const bank = runBank();
    const score = C.scoreAttempt(a, bank.bank, bank.forms);
    const route = C.routeNextBand(score, ui.band);
    const planned = C.nextPlannedBand(a, ui.band);
    const next = planned !== undefined ? planned : route.nextBand;
    if (!next) return renderReview(route);
    ui.band = next;
    if (a.bands.indexOf(ui.band) === -1) a.bands.push(ui.band);
    ui.items = C.selectItems(bank.bank, bank.forms, a.formId, ui.band);
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
    renderResult(a, runBank());
  };

  globalThis.assessmentShowResult = async function (attemptId) {
    const a = S.loadAttempt(storeCtx(), attemptId);
    if (!a || a.playerId !== curP) return;
    const bank = await bankFor(a.bankVersion);
    if (!bank) { body().innerHTML = unavailableBank(a); return; }
    renderResult(a, bank);
  };

  /**
   * Why the assessment stopped where it did.
   *
   * routeNextBand has always returned `reasons`, and the report threw the array
   * away — so a parent saw "sets C1" with no way to tell whether the child had
   * declined the next set, run out of time, or missed the bar, and by how much.
   * Both baseline sittings stopped at C1 for the same reason and looked
   * identical because of it.
   */
  function stopReason(score, highest, route) {
    if (route.atCeiling) {
      return `<div class="practice-box" style="text-align:left;font-size:.72rem;line-height:1.6;margin-bottom:.6rem;">
        Finished the last set we have — ${esc(bandName(highest))}.</div>`;
    }
    const domains = ((score.byBand || {})[highest] || {}).domains || {};
    const missed = Object.keys(C.ROUTING_THRESHOLDS || {})
      .map((dom) => ({ dom, d: domains[dom], need: C.ROUTING_THRESHOLDS[dom] }))
      .filter((x) => x.d && x.d.complete && x.d.correct < x.need);
    const incomplete = Object.keys(C.ROUTING_THRESHOLDS || {})
      .filter((dom) => !domains[dom] || !domains[dom].complete);

    let why;
    if (incomplete.length) {
      why = `Not every part of ${esc(bandName(highest))} was finished, so there was nothing to decide on.`;
    } else if (missed.length) {
      why = `Stopped after ${esc(bandName(highest))}. The next set opens at ` +
        missed.map((x) => `${x.need} of ${x.d.expected} on “${esc(DOMAIN_LABEL[x.dom] || x.dom)}” (got ${x.d.correct})`).join(", ") + ".";
    } else {
      why = `${esc(bandName(highest))} was passed — the next set was offered and not taken this time.`;
    }
    return `<div class="practice-box" style="text-align:left;font-size:.72rem;line-height:1.6;margin-bottom:.6rem;">
      ${why}<br><span style="color:var(--muted);">Stopping is allowed and costs nothing.</span></div>`;
  }

  const DOMAIN_LABEL = {
    recognition_unaided: "Reading characters on their own",
    decoding_supported: "Reading with pinyin to help",
    meaning_context: "What words mean in a sentence",
    passage_comprehension: "Understanding a short text",
    writing_recall: "Writing from memory",
  };

  function renderResult(attempt, bankData) {
    const bd = bankData || ui.bankData;
    const score = C.scoreAttempt(attempt, bd.bank, bd.forms);
    const highest = attempt.bands[attempt.bands.length - 1] || FIRST_BAND;
    const route = C.routeNextBand(score, highest);
    // One block per band. Bands are never merged: "8 of 8" across four bands
    // would hide both what was actually attempted and where it fell off.
    const bandBlock = (bandId) => {
      const entry = score.byBand[bandId];
      if (!entry) return "";
      const rows = Object.values(entry.domains).map((d) => {
        // Median answer time, and an explicit note when a completed domain sits
        // at or below chance for a 4-option item. Both come from data the attempt
        // already stores; neither is a verdict, and the report says so.
        const pace = d.medianSecs != null
          ? `<span style="color:var(--muted);"> · about ${d.medianSecs}s per answer</span>` : "";
        const chance = d.atChance
          ? `<div style="font-size:.66rem;color:var(--muted);margin-top:.1rem;">
               At this length, ${Math.ceil(d.chanceLevel)} of ${d.expected} is what picking at
               random gives, so this part does not tell us much either way.</div>` : "";
        const detail = d.domain === "writing_recall" && d.awaitingReview
          ? `<span style="color:var(--muted);">${d.awaitingReview} waiting for a grown-up to look at — not scored yet</span>`
          : d.complete
            ? `${d.correct} of ${d.expected} right`
            : `${d.correct} of ${d.submitted} answered right · ${d.unanswered} not answered <span style="color:var(--muted);">(part of the set only)</span>`;
        return `<div style="padding:.35rem 0;border-bottom:1px solid rgba(212,160,23,.14);text-align:left;">
          <div style="font-size:.78rem;color:var(--ink);">${esc(DOMAIN_LABEL[d.domain] || d.domain)}</div>
          <div style="font-size:.72rem;color:var(--gold);margin-top:.12rem;">${detail}${pace}</div>
          ${chance}
        </div>`;
      }).join("");
      const info = bandInfo(bandId);
      return `<div class="practice-box" style="text-align:left;margin-bottom:.6rem;">
        <div style="font-size:.8rem;color:var(--gold-bright);">${esc(info.name)}</div>
        <div style="font-size:.66rem;color:var(--muted);margin-bottom:.3rem;">${esc(info.about || "")}</div>
        ${rows}
      </div>`;
    };
    const rows = attempt.bands.map(bandBlock).join("");

    // Who this is. The report carried no name, so two children's reports were
    // told apart by the screenshot's filename. Read from attempt.playerId, never
    // curP: ownership is fixed at creation and must survive a profile switch.
    const who = typeof playerName === "function" ? playerName(attempt.playerId) : attempt.playerId;
    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;">
        <strong style="color:var(--gold);">${esc(who)}</strong> · assessment report<br>
        ${esc(String(attempt.createdAt).slice(0, 10))} · form ${esc(attempt.formId)} ·
        ${esc(attempt.bands.map(bandName).join(", "))} · bank ${esc(attempt.bankVersion || "?")}
      </div>
      ${stopReason(score, highest, route)}
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
        <button class="btn-s" onclick="assessmentReviewWriting('${esc(attempt.attemptId)}')">✍️ Grown-up: mark the writing</button>
        <button class="btn-s" onclick="assessmentExport('${esc(attempt.attemptId)}')">⬇ Save report</button>
        ${attempt.comparisonAttemptId ? `<button class="btn-s" onclick="assessmentCompare('${esc(attempt.attemptId)}')">Before &amp; after</button>` : ""}
      </div>`;
  }

  // ── comparison ───────────────────────────────────────────────────────────
  /**
   * Before and after, one row per band per domain, anchors apart from fresh
   * items. compareAttempts has existed since the engine shipped; nothing in the
   * app ever called it, so "History & compare" offered no comparison.
   */
  globalThis.assessmentCompare = async function assessmentCompare(attemptId) {
    const after = S.loadAttempt(storeCtx(), attemptId);
    if (!after || after.playerId !== curP) return;
    const before = after.comparisonAttemptId ? S.loadAttempt(storeCtx(), after.comparisonAttemptId) : null;
    const back = `<button class="btn-s" style="margin-top:.8rem;" onclick="assessmentHistory()">Back</button>`;
    if (!before) {
      body().innerHTML = `<div class="dd-desc" style="text-align:left;">The earlier sitting this one repeats is not on this device, so there is nothing to compare it with yet.</div>${back}`;
      return;
    }
    const bank = await bankFor(after.bankVersion);
    const cmp = bank ? C.compareAttempts(before, after, bank.bank, bank.forms)
      : { comparable: false, reason: `Not comparable — bank ${after.bankVersion} is no longer available.` };
    const who = typeof playerName === "function" ? playerName(after.playerId) : after.playerId;
    const head = `
      <div class="dd-desc" style="text-align:left;">
        <strong style="color:var(--gold);">${esc(who)}</strong> · before &amp; after<br>
        ${esc(String(before.createdAt).slice(0, 10))} (form ${esc(before.formId)}) →
        ${esc(String(after.createdAt).slice(0, 10))} (form ${esc(after.formId)})
      </div>`;
    if (!cmp.comparable) {
      body().innerHTML = `${head}
        <div class="practice-box" style="text-align:left;font-size:.74rem;line-height:1.6;margin-top:.7rem;">${esc(cmp.reason)}</div>${back}`;
      return;
    }
    const rows = (block) => Object.keys(block).map((dom) => {
      const d = block[dom];
      const delta = d.pointDifference == null ? "" : ` <span style="color:var(--muted);">(${d.pointDifference > 0 ? "+" : ""}${d.pointDifference} points)</span>`;
      return `<div style="padding:.3rem 0;border-bottom:1px solid rgba(212,160,23,.14);text-align:left;">
        <div style="font-size:.76rem;color:var(--ink);">${esc(DOMAIN_LABEL[dom] || dom)}</div>
        <div style="font-size:.72rem;color:var(--gold);">${esc(d.before)} → ${esc(d.after)}${delta}</div>
      </div>`;
    }).join("") || `<div style="font-size:.7rem;color:var(--muted);">nothing answered in both sittings</div>`;
    const bands = cmp.bands.map((b) => {
      const x = cmp.byBand[b];
      return `<div class="practice-box" style="text-align:left;margin-bottom:.6rem;">
        <div style="font-size:.8rem;color:var(--gold-bright);">${esc(bandName(b))}</div>
        <div style="font-size:.7rem;color:var(--muted);margin:.3rem 0 .15rem;">Questions seen in both sittings</div>${rows(x.anchors)}
        <div style="font-size:.7rem;color:var(--muted);margin:.45rem 0 .15rem;">Questions new to this sitting</div>${rows(x.fresh)}
      </div>`;
    }).join("");
    body().innerHTML = `${head}
      <div class="practice-box" style="text-align:left;font-size:.7rem;line-height:1.6;margin:.6rem 0;">${esc(cmp.label)}</div>
      ${bands}
      ${cmp.bandSetsDiffer ? `<div class="practice-box" style="text-align:left;font-size:.7rem;line-height:1.6;">Not compared: ${esc(cmp.notCompared.map(bandName).join(", "))} — only tested in one of the two sittings.</div>` : ""}
      <div style="font-size:.68rem;color:var(--muted);line-height:1.5;margin-top:.5rem;text-align:left;">${esc(cmp.writing)}</div>
      ${back}`;
  };

  // ── handwriting review ───────────────────────────────────────────────────
  /**
   * A grown-up marks the writing items.
   *
   * The scorer has always read `attempt.writingReviews` and counted rubricScore
   * >= 2 as correct, and the bank has always shipped the rubric — but nothing in
   * the app ever wrote to that array. So every report said "4 waiting for a
   * grown-up to look at" forever, and the promise the report makes had no way to
   * be kept.
   *
   * Behind the parent PIN, because it changes a recorded score. "Done — I wrote
   * it" cannot mark itself correct: the app never sees the paper, and crediting
   * it would put a made-up number in the one place this design promises not to.
   */
  globalThis.assessmentReviewWriting = function assessmentReviewWriting(attemptId) {
    const ok = typeof askParentPwd === "function"
      ? askParentPwd("Marking handwriting changes a recorded score.")
      : true;
    if (!ok) return;
    const a = S.loadAttempt(storeCtx(), attemptId);
    if (!a) return;
    bankFor(a.bankVersion).then((bank) => {
      if (!bank) { body().innerHTML = unavailableBank(a); return; }
      renderWritingReview(a, bank);
    });
  };

  function writingItemsOf(attempt, bd) {
    const out = [];
    attempt.bands.forEach((b) => {
      C.selectItems(bd.bank, bd.forms, attempt.formId, b)
        .filter((it) => it.domain === "writing_recall")
        .forEach((it) => out.push(it));
    });
    return out;
  }

  function renderWritingReview(attempt, bd) {
    ui.reviewBank = bd;
    const items = writingItemsOf(attempt, bd);
    const rubric = (bd.bank.rubrics || {})["writing-recall-v1"] || { levels: [] };
    const answered = new Set(attempt.responses.map((r) => r.itemId));
    const scoreOf = (id) => {
      const r = attempt.writingReviews.find((w) => w.itemId === id);
      return r && typeof r.rubricScore === "number" ? r.rubricScore : null;
    };
    body().innerHTML = `
      <div class="dd-desc" style="text-align:left;line-height:1.6;">
        The child wrote these on paper from hearing the word — no model was shown.
        Mark what is actually on the page. Stroke order cannot be judged from a
        finished character and is not scored.
      </div>
      <div style="margin:.8rem 0;">
        ${items.map((it) => {
          const target = (it.reference && it.reference.entries && it.reference.entries[0]) || "?";
          const cur = scoreOf(it.id);
          const skipped = !answered.has(it.id);
          return `<div class="practice-box" style="text-align:left;margin-bottom:.55rem;">
            <div style="display:flex;align-items:center;gap:.6rem;">
              <span style="font-family:var(--fzh);font-size:2rem;color:var(--gold);">${esc(target)}</span>
              <span style="font-size:.72rem;color:var(--muted);">${esc(it.prompt.enInstruction || "")}</span>
            </div>
            ${skipped ? `<div style="font-size:.68rem;color:var(--muted);margin-top:.3rem;">Not attempted — leave it unmarked rather than scoring it zero.</div>` : ""}
            <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.45rem;">
              ${rubric.levels.map((lv) => `
                <button class="btn-s" style="font-size:.66rem;${cur === lv.score ? "border-color:var(--gold);color:var(--gold);" : ""}"
                  onclick="assessmentMarkWriting('${esc(attempt.attemptId)}','${esc(it.id)}',${lv.score})">
                  ${lv.score} · ${esc(lv.label)}</button>`).join("")}
              ${cur != null ? `<button class="btn-s" style="font-size:.66rem;" onclick="assessmentMarkWriting('${esc(attempt.attemptId)}','${esc(it.id)}',null)">clear</button>` : ""}
            </div>
          </div>`;
        }).join("")}
      </div>
      <div style="font-size:.68rem;color:var(--muted);line-height:1.5;">
        ${esc(rubric.note || "")}
      </div>
      <button class="btn-g" style="margin-top:.7rem;width:100%;" onclick="assessmentShowResult('${esc(attempt.attemptId)}')">Back to the report</button>`;
  }

  globalThis.assessmentMarkWriting = function assessmentMarkWriting(attemptId, itemId, score) {
    const a = S.loadAttempt(storeCtx(), attemptId);
    if (!a) return;
    a.writingReviews = (a.writingReviews || []).filter((w) => w.itemId !== itemId);
    if (score !== null && score !== undefined) {
      a.writingReviews.push({
        itemId, rubricId: "writing-recall-v1", rubricScore: Number(score),
        reviewedAt: new Date().toISOString(), reason: "marked in the app by a grown-up",
      });
    }
    // The responses themselves are never touched — a review is a second opinion
    // ON an answer, not a replacement for it. revision bumps so the compare-and-set
    // write is accepted; resultVersion marks the report as re-derived.
    a.revision = (a.revision || 1) + 1;
    a.resultVersion = (a.resultVersion || 1) + 1;
    S.saveAttempt(storeCtx(), a);
    S.pushAttempt(storeCtx(), a).catch(() => {});
    if (ui && ui.attempt && ui.attempt.attemptId === attemptId) ui.attempt = a;
    renderWritingReview(a, ui.reviewBank || ui.bankData);
  };

  // ── export ───────────────────────────────────────────────────────────────
  /** Save one report as JSON. The two baseline reports were told apart by the
   *  screenshot filename; a file named for the child fixes that at the source. */
  globalThis.assessmentExport = async function assessmentExport(attemptId) {
    const a = S.loadAttempt(storeCtx(), attemptId);
    if (!a) return;
    const bd = await bankFor(a.bankVersion);
    if (!bd) { showToast(`Bank ${a.bankVersion} is no longer available, so this report cannot be scored for export.`, 3200); return; }
    const who = typeof playerName === "function" ? playerName(a.playerId) : a.playerId;
    const score = C.scoreAttempt(a, bd.bank, bd.forms);
    const payload = {
      player: who, playerId: a.playerId, attemptId: a.attemptId,
      createdAt: a.createdAt, submittedAt: a.submittedAt,
      bankVersion: a.bankVersion, formId: a.formId, bands: a.bands,
      sets: a.bands.map((b) => ({ band: b, name: bandName(b) })),
      byBand: score.byBand,
      writingReviews: a.writingReviews,
      note: "Sample of reading and understanding. No overall score: none is defensible from samples this size. Not an HSK level.",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `assessment_${who}_${String(a.createdAt).slice(0, 10)}_${a.bands.join("-")}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    laterCall("ui", () => URL.revokeObjectURL(url), 1000);
  };
})();
