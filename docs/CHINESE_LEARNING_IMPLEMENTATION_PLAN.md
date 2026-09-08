# Chinese Adventure — audit validation + implementation plan

Version 1.0 · Audited and validated 2026-09-05 · Baseline commit `c5f94bb`

Companion documents:
- `docs/implementation-status.md` — live requirement ledger (status, files, evidence)
- `docs/curriculum_plan.md` — the existing 300-word/22-gate data design

Section 1 is the reconciliation record required by Phase 0: every audit finding
carries a verdict of *confirmed*, *overstated*, or *larger than reported*, with
the source location that establishes it.

## Context

You asked me to validate the ChatGPT audit and improvement plan before building anything.

I did. HEAD is `c5f94bb` — **exactly the audited baseline**, so no drift to reconcile. I checked every substantive claim against the source. Result: the audit is sound. Sixteen of its claims reproduce verbatim in code; four are overstated and I've corrected them below; and it **understates the content problem by roughly 9×** because it measured the wrong array.

Your four decisions are locked into this plan:
- **Assessment ships first**, per the document's Phase A → B order.
- **Full spec**: 4 bands × 2 forms = 240 distinct authored items.
- **Keep device TTS**, label the reproducibility limit honestly.
- **Live records are real and must be preserved** — backup + dry-run before any migration.

One thing I'm flagging once and then building around, not re-arguing: two of the confirmed defects write to the *wrong child's* record while the app runs. The assessment lives in its own namespace so its data is safe, but the spec's own Phase A criteria already require fixing both — `A10` cannot persist an attempt through a `saveState()` that clobbers the other profile, and `A-T12` explicitly demands that a late callback after a profile switch credits nothing to the other child. So owner-scoped saves and callback cancellation are **prerequisites inside Phase A**, not deferred Phase B work. That is the only place I've moved anything.

---

## 1. Validation results

### 1.1 Confirmed — reproduce exactly as described

| Audit claim | Evidence |
|---|---|
| 22 gate identities, not 88 | `index.html:2968` — `ensureState` hard-discards any gate ID `>22`. An 88-gate scheme is structurally impossible today. HSK tab (`4703`) only swaps lesson text; `renderHubContent:4751` never filters by level, so clearing gate 1 shows cleared on every tab. `getCurrentHSK:4621` derives level from `gatesCompleted.length` at 5/11/17. |
| `storiesCompleted` unlock bypass is live | `gameUnlockForDid:3686` returns all-unlocked on a `storiesCompleted` hit. Written by current code at `5323` (`showMiniQuizResult`) **with no 45s dwell check**, while `storyReadCount` at `5154` does check. A fast skim that fails the dwell gate still unlocks all four games. |
| Deadline formula + destructive reset | `gateTimerDays:3154` = `5+2*floor((n-1)/5)`. `resetGateProgress:3276` clears all 4 game stars, `gateBestQuiz`, last attempt, pending gate quiz. |
| Two completion sites, order-dependent payout | Site A `updateGateGameBest:3091`, Site B `renderQuizResult:6340`. Quiz-last pays `score` (up to 220), mission credit, mystery box, one-day badge. Game-last pays **nothing but a toast**. |
| Re-clear inflation | `6321` computes `quizPass` from the *stored best*, not the current attempt. Every subsequent boss run on a cleared gate — even a near-total failure — re-runs `addEarnedStars(score)` and `bumpMission('gates',1)`. The "⚔️ Try Boss Again" button at `4884` leads straight into it. Champion branch `6329` identical. |
| Match small-pool dead end | `startMemoryMatch:3805` sets `pairCount` from gate ID only, never `words.length`. Win test `3818` is `matched>=pairCount`. A 3-word WIP pool with `pairCount=6` reads "Matched 3/6" forever. Rain guards this (`3896`); Match does not. |
| Match wrong flips log vocabulary failures | `tapMatch:3866` calls `logWrong`. **`CLAUDE.md:607` states the opposite and is wrong.** Worse: only card `a` is logged, so which word gets blamed is flip-order dependent. |
| Duplicate pinyin / sentence submission | `checkPY:6167` — input disabled but the submit button at `6156` is not; a second tap double-scores and schedules two `goNext`, skipping a question. `checkSB:6266` has no guard at all: +40 points and a skipped sentence. |
| Quiz timers never cancelled | No `clearTimeout` for quiz advances. `exitQuiz:6395` cancels nothing; `selectPlayer:4581` cancels nothing. A pending `goNext` after a profile switch runs `renderQuizResult` against **the other child's state**. |
| Champion item cap | `buildMCQ:5775` and `buildPYQ:5803` both `n=Math.min(n,20,...)`. A 32/40/10 champion silently becomes 20/20/10. `maxScore:5620` computed from uncapped numbers → displays **/1088 for a 700-point quiz**; progress bar caps at 64% on a flawless run. |
| Story progress cannot reach 100% | `openStory:5099` counts token *occurrences* into `totalNew`; `updateProg:5127` divides *unique* taps by it. First story `S_XIA`: 23 unique / 29 occurrences = **79.3%**, matching the audit exactly. |
| Rain/Trace stale callbacks | `closeGamesOverlay:3668` clears nothing — intervals keep running, `saveState()`-ing every second, and at `timeLeft<=0` award stars for an abandoned round. Per-drop timeouts (`spawnRainDrop:3971`) are never tracked; the `btn.parentNode` guard fails on a detached node. Trace persists `traceGood` incremented but `i` un-advanced (`4175`), so a reload during the 2s celebration double-counts. |
| Resume is priority-ordered, not recent | `resumeLastSession:4289` is a fixed if-chain; **no serializer stores a timestamp**. A stuck Match outranks everything permanently. `closeRevengeRound:5457` nulls the session with no toast — closing at Q3 of 6 silently discards it. |
| Dictionary defects | All five fixtures exist verbatim: 里 `variant of 里`, 新 `abbr. for Xinjiang 疆 or Singapore 坡`, 书 `abbr. for 书经`, 加 `Canada (abbr. for 大)`, 暗 `variant of 暗`. Exactly **1,200** rows total. |
| Lesson passages never rendered | `grep -c passage index.html` → **0**. `renderGateLesson:4930` hard-codes `['How many new words are in this gate?', ...]`; `enAs[i]||q.answer` means the authored answer is **never** displayed. |
| `uniqueChars` mislabels characters | `4084` — each character inherits the enclosing word's `py`/`en`. A child tracing 习 is told it reads "xué xí" and means "to study". |
| `saveState` writes both children | `2944` — re-stamps **both** `lastSaved` to the same `now`, then `.set()`s both docs (full-document replace, no `merge`, no transaction). Called from **83 sites**. Conflict resolution is last-writer-wins on that timestamp (`2210`). Jenn's stale copy of Jess gets republished with a fresh timestamp and wins. |
| Validator hard-coded path | `scripts/validate_curriculum.js:7` — `const ROOT = "/workspace"`. Fails immediately here; passes when the path is corrected. |

### 1.2 Overstated — corrected

| Audit said | Actually |
|---|---|
| Timer expiry deletes long-term learning records | **No.** `library` and `failedWords` survive `resetGateProgress`. Only gate-attempt records are cleared. |
| Expiry can repeat and duplicate resets | **No** — `t.active=false` (`3314`) guards it. The real defect is the **opposite**: expiry is lazy and never called from `renderHub`, so a lapsed timer reports "due today" forever and then detonates without warning mid-session the next time any game or quiz finishes. |
| Match dead-ends on a zero-word pool | Guarded upstream at `3786`. The dead end needs 1–5 words, not 0. |
| Switching tabs changes in-progress round content | **No.** Every serializer stores `gameTargetDid` plus fully materialized words/questions. Real leaks are narrower: no session stores the HSK level; `maybeGrantMysteryFromGate:6733` reads the global `curHSK` so reward chance comes from whichever tab is open; and `selectedGateId` is never reset on player switch, so Jenn's selected gate persists into Jess's session. |
| `checkMCQ` double-submits | Guarded — `5936` detaches all handlers before scoring. Only `checkPY` and `checkSB` are exposed. |

### 1.3 Larger than the audit found

**The audit measured the wrong array.** It counted `words[]` (33 junk rows). The games serve `gates[].newWords/reviewWords` via `getDatasetVocabForGate:2304` — a second copy in the same files carrying **297 junk rows across 113 distinct characters**, including core kid vocabulary:

```
HSK1  水  Shuǐ  surname Shui              <- "water"
HSK1  家  jiā   used in 家伙 and 家俱      <- "home; family"
HSK1  门  Mén   surname Men
HSK1  笑  xiào  old variant of 笑
HSK3  火  Huǒ   surname Huo
```

Plus three defect classes the audit didn't name:

1. **Unanswerable MCQs.** 159 rows share 73 duplicate English glosses (中 and 中国 both "China"; 已 and 已经 both "already"). Four of five distractor builders (`3615`, `5220`, `5367`, `5470`) de-duplicate by `zh` or array index but *render `.en`* — so a distractor can be string-identical to the correct answer. Only the daily-word builder (`2857`) filters on `.en`.
2. **Two divergent vocabularies.** The inline `HSK_VOCAB` (`1668`, 96 entries) is clean and kid-friendly; the 1,200-row JSON is not. They disagree on 83 glosses.
3. **44 stories for 88 gates.** `STORIES_MAP:1642` holds 44 hand-authored tokenized stories — good quality — but levels 2–4 reuse level 1's. Locked decision **O05** ("texts increase in difficulty with the selected level") is not met by content today, only by lesson JSON. And 66 of 88 lessons ask `本关有几个生字（新词）？`; passages are 29–136 characters of meta-instructions, not narratives.

**Baseline facts for the plan:** one inline `<script>` of 5,849 lines (`node --check` passes); no `package.json`, no tests, no CI; 88 lesson files already exist; curriculum is HSK 3.0 (`drkameleon/complete-hsk-vocabulary`, `new-` lists) with HSK2 borrowing 103 words from HSK3 — so the **reference edition question A04 raises is already answerable** and needs no owner input.

---

## 2. Phase 0 — fixtures and safety (do first, ~0.5 day)

Reconciliation is already done above; what remains is making the work safe.

- `scripts/backup_players.js` — export both live Firestore docs to `backups/players-YYYY-MM-DD.json`. **Run before anything else.** No migration proceeds without a dated backup on disk.
- `scripts/validate_curriculum.js:7` — replace `/workspace` with `path.resolve(__dirname, '..')`. One-line fix; it passes once corrected.
- `scripts/parse_check.js` — extract the inline script and `node --check` it. Wrap as `npm run check` via a minimal `package.json` (`node --test`, no dependencies).
- `tests/fixtures/` — synthetic player states and a stub `db`. **Tests never touch the live `chinese-adventure` collection.**
- `docs/implementation-status.md` — requirement ID × status (`not started` / `implemented` / `verified` / `blocked`) × changed files × evidence. Untested code is never `verified`.
- Commit this validation report as `docs/CHINESE_LEARNING_IMPLEMENTATION_PLAN.md` with §1 above as its reconciliation record.

---

## 3. Phase A — the assessment (your chosen first deliverable)

### A.1 Files

Load as classic scripts **after** the main inline block (~`index.html:6933`) so they can reach `state`, `curP`, `saveState`, `showScreen`, `showToast`, `speak`; expose `window.openAssessment`.

| File | Responsibility |
|---|---|
| `js/assessment-core.js` | Pure: item selection, scoring, routing, comparison, attempt state-machine transitions. No DOM, no globals — directly unit-testable. |
| `js/assessment-ui.js` | Entry, instructions, task rendering, save/resume, results, history. |
| `js/player-store.js` | Owner-scoped persistence + attempt read/write. |
| `data/assessment/manifest.json`, `<version>/forms.json`, `<version>/items.json` | Versioned frozen bank. |
| `schemas/assessment.schema.json`, `scripts/validate_assessment.js` | Domain-specific contract; fails on missing audio, passage-less passage items, MCQ options on writing items, anchor mismatch, cross-form target overlap. |
| `docs/assessment-method.md`, `docs/content-review.md` | Exact method, source ledger, unresolved items, stated limits. |

### A.2 Two fixes that are Phase A prerequisites

Not scope creep — the spec's own acceptance criteria require them:

- **`saveState` owner scoping** (`index.html:2944`). Today it re-stamps and full-`.set()`s **both** documents. An assessment attempt written through it would be clobbered by the other child's device. Change to: stamp and write **only** `curP`'s document; keep both readable for family summaries; capture the owner ID on the attempt at creation and never re-derive it from a later global `curP`. Satisfies **S01** and unblocks **A10**.
- **Callback cancellation on profile switch** (`selectPlayer:4581`). Required verbatim by **A-T12**. Add a cancellation registry that `selectPlayer`, `goToSelect`, `exitQuiz` and `closeGamesOverlay` all drain. This also happens to kill the Rain/Trace cross-profile writes for free.

### A.3 Bank — full spec, as you chose

34 scored opportunities per band-form: 8 unaided recognition, 8 supported decoding, 8 contextual meaning, 6 passage comprehension (2 passages × 3), 4 writing recall. 4 bands × 2 forms = 272 slots; 8 shared anchors per band = 32 duplicates; **240 distinct authored prompts**, ~12 distinct passages.

**Authoring order: C1 → C2 → C3 → C4** (both forms per band before moving up). All 240 items still ship; this is sequencing only. Because routing stops upward when a band isn't cleared, C3/C4 items would never appear on a baseline that ends at C2 anyway — so the girls can sit C1+C2 as soon as those bands are complete, weeks before the full bank is done, at no cost to the deliverable.

Passage length targets: C1 25–50 characters, C2 50–80, C3 80–120, C4 120–180. Custom authoring targets, not HSK standards — where a passage can't be natural inside the range, the reason gets documented rather than padded.

Ordering within a band: unaided recognition → contextual meaning → passages → supported decoding → writing. Pinyin never precedes an unaided section. Validator rejects target-word overlap between recognition and decoding within a form.

**Authoring honesty.** I can author and cross-check these items, but I cannot certify educator review. Every item ships `reviewerType: "model"` with sources and an independent answer-key pass recorded in `docs/content-review.md`. The release gate is truthful labelling, not a validity claim. I'll report count and review status rather than an optimistic percentage.

### A.4 Audio — your decision, implemented honestly

Single-syllable targets use the existing fixed MP3 clips (`playZhClipByChar:4401`, deterministic). Everything else uses device `speechSynthesis`. Each presentation records `audioSource: 'clip' | 'tts'` and the resolved voice name.

Consequences stated in the UI and in every comparison view:

> Spoken options are generated by this device's voice. The same item can sound different on another device or browser, so score changes on audio tasks are not directly comparable across devices.

Within a single attempt all four options are synthesized on the same device at the same moment, so the *choice* is fair; it's cross-attempt comparison that carries the caveat. Missing or blocked audio → retry, then pause the domain and mark items unanswered. **Never** scored wrong, and **never** substituted with visible pinyin in an unaided section.

### A.5 Behaviour

- Hub entry `Assessment · 学习评估`, always available. No gate stars, no timers, no gate clearing, no failure counters, no forgiveness consumption.
- States `created → active ↔ paused → submitted → results_available`; `abandoned` retained as incomplete history. Writing review is a separate axis (`not_submitted` / `pending` / `reviewed`) and never drags the reading report back to active.
- Persist item ID, option order and support condition **before display**. Lock each response exactly once before scheduling a transition — the `checkPY`/`checkSB` defect must not be reproduced here.
- Baseline starts at C1. Advance on recognition ≥6/8 **and** meaning ≥6/8 **and** comprehension ≥4/6. Supported decoding and writing never affect routing. After C4: "Highest available custom band sampled."
- `I don't know` = wrong. Save & Exit, missing audio, technical failure, timeout = **unanswered, not wrong**.
- ~18 active minutes → non-blocking save notice; 20 minutes → preserve everything and follow the existing parent-extension policy. Timing pauses when hidden or explicitly paused.
- No overall "Chinese ability" percentage. Report `correct / submitted`, unanswered count, expected count, support condition and bank version. Unreviewed writing shows `Not independently verified` — never zero, never an estimate.
- History: repeat same form (familiarity notice) / matched alternate form (`matched-form, provisional`) / explore next band (reported separately). Anchor results always separated from fresh items with sample sizes.

### A.6 Persistence

`chinese-adventure/{playerId}/assessments/{attemptId}` with the spec's document shape, `revision` compare-and-set, stable response IDs, idempotent submission, immutable raw responses, append-only review amendments. Local pending-save queue with visible `Saved on this device` / `Synced` / `Needs attention`.

I can't inspect the deployed Firestore rules from here. If writes to the subcollection are rejected, Phase A ships **local-only, explicitly labelled as a development milestone**, and I document the exact rule change you'd need to make. I will not modify live rules unasked.

---

## 4. Phase B — persistence, gate identity, deterministic repairs

Migration order, given live records must be preserved:

1. Backup (Phase 0) → 2. dry-run migration against the export → 3. **you approve the old→new preview** → 4. apply.

- **C01–C03**: gate keys `h1-g01`…`h4-g22`; every gate function takes explicit `{levelId, gateId, gateKey}`. Remove the `>22` filter at `2968` behind a `schemaVersion` check. Old completions map to their historical dynasty HSK group as `legacyCredit`; previously reachable content preserved via `legacyAccess` (access ≠ completion). **No invented completions for the other 66 identities, no redistributed stars.** Migration is idempotent — running twice changes nothing.
- **G02–G04**: preserve the deadline formula per level; expire eagerly on render (fixing the silent-detonation bug), once per attempt, with `attemptId`. One idempotent `evaluateGateCompletion(gateKey, attemptId)` replaces both call sites; best qualifying quiz record selected by accuracy → points → earliest submission; gate-clear payout credited **once** via a stable completion event ID. Re-clear shows a round score but pays nothing.
- **B02a–k**: Match pair count from `min(pool, cap)`; `logWrong` removed from `tapMatch`; answer locks on `checkPY`/`checkSB`; the `Math.min(n,20,…)` cap removed and `maxScore` derived from actual generated items; unique-target counting in `updateProg` so stories reach 100% and known-story re-reads can finish; timers and drop callbacks cleared on exit/lock/switch; trace index and credit committed atomically; `updatedAt` on every serializer so resume picks the most recent; Revenge close saves or asks instead of deleting.
- **S02**: transactions with revisions; offline queue with stable IDs; star and completion events applied once per event ID; conflicting pending sessions surfaced, not overwritten.

Also correct `CLAUDE.md:607`, which currently documents behaviour the code doesn't have.

---

## 5. What the baseline results do and don't change

**They change (Phase C/D only, mostly as prioritization):**

- Which gates get content repair first. If both girls land C1/C2, `h1`/`h2` go first and `h3`/`h4` waits; a C3 result inverts that. With 297 junk rows and 88 placeholder lessons to fix, this is the results' main job.
- The O05 stories decision. At C1, level-2/3/4 reusing level-1 texts stays invisible for months. At C2 it needs solving now.
- Support-fade defaults (T03). A large gap between unaided recognition and pinyin-supported decoding means pinyin comes off more slowly and no-pinyin checks run more often — precisely what measures 1 and 2 are built to expose.
- Per-skill starting mix in the retention ladder (R02) and writing subset size per gate (T04).
- Each child's suggested practice entry point — **not** what is unlocked. O08 keeps gate progression mandatory; a strong result opens a recommended route and skips nothing.

**They don't change:** anything in Phases 0, A or B. Every defect in §1, the 88-gate model, the migration, the persistence rewrite, the reward de-duplication and the retention machinery are all deterministic. Content *repair* is score-independent too — 水 = "surname Shui" is wrong at every band.

**Stated limitation.** Under this order the baseline is taken while the app still logs failures to the wrong child and inflates replay rewards. That doesn't invalidate the baseline — the assessment is namespaced and measures the child, not the app — but the ~28-day retest spans that period, so the comparison reflects learning plus that noise. This goes in `docs/assessment-method.md`, not unmentioned.

## 6. Phases C and D

Both phases below start from the baseline results, per §5.

**C** — `h1-g01` as one fully validated reference gate: real passage and its authored questions rendered (deleting the hard-coded English at `4930`), `uniqueChars` resolving true character metadata, skill-specific retention records (`recognition` / `meaning` / `contextComprehension` / `writingRecall`, with `tracePractice` separate), the next-day → +3 → +7 → +14 → +30 schedule, and bounded review (4 min / 8 responses, backlog retained, never a penalty). Assessment results feed a *recommendation* only — no auto-completion, no lowered gate standards.

**D** — all 88 gates. The real cost here is what §1.3 found, and I'd rather you see it now than in a status report: **297 junk gate rows** to re-sense, **73 gloss collisions** to resolve before any MCQ is trustworthy, **88 lessons** whose passages and questions are placeholders, and **44 stories covering 88 gates** — so O05 needs either new texts for levels 2–4 or an explicit re-levelling decision from you. I'll bring you that decision with options when Phase D starts; it doesn't block A, B or C.

---

## 7. Verification

Per phase, run: `node scripts/parse_check.js` (the inline-script guard from `CLAUDE.md:9.1` — a stray brace silently kills every handler), `node scripts/validate_curriculum.js`, `node scripts/validate_assessment.js`, `node --test tests/`.

Automated suites: `tests/assessment.test.cjs` (A-T01–A-T14), `tests/progression.test.cjs` and `tests/persistence.test.cjs` (M-T01–M-T20). Fixed seeds; raw output preserved. Boundary cases, not name-existence assertions — specifically the 79%→100% story count, the 1–5 word Match pool, double-submit on `checkPY`/`checkSB`, champion 32/40/10, both gate-completion orders, and the Edmonton due-date/DST boundary.

Manual, on the actual iPad the girls use — I'll report the device and browser tested, and mark anything I couldn't reach as `blocked` with exact steps for you rather than claiming success: audio start and failure, writing input, overlay scrolling, background/foreground, hitting the session limit mid-answer, save/exit, next-day resume, profile switch, reload, and history comparison. **A desktop run is not reported as iPad validation.**

Every phase reports: requirement IDs, changed files, checks run with pass/fail counts, content-review status, known limitations, and whether live records were touched.
