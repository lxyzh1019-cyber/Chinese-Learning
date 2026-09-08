# Implementation status

Live ledger for the work described in `docs/CHINESE_LEARNING_IMPLEMENTATION_PLAN.md`.

Status values: `not started` · `implemented` · `verified` · `blocked`.
**`verified` requires evidence** — a passing check, a test, or an observed UI
traversal. Untested code is `implemented`, never `verified`.

Baseline commit: `c5f94bb` · PR #43 merged · Working branch: `claude/chinese-adventure-audit-cont-xjxqpl` (PR #44)

---

## Phase 0 — reconciliation and safe fixtures

| ID | Requirement | Status | Files | Evidence |
|---|---|---|---|---|
| P0-1 | Reconcile audited baseline with HEAD | verified | — | HEAD is `c5f94bb`, identical to the audited commit. No drift. |
| P0-2 | Audit-to-code mapping with a verdict per finding | verified | `docs/CHINESE_LEARNING_IMPLEMENTATION_PLAN.md` §1 | 16 confirmed with line references, 4 overstated and corrected, 3 defect classes found that the audit missed. |
| P0-3 | Repair the validator's hard-coded `/workspace` root | verified | `scripts/validate_curriculum.js:7`, `scripts/build_hsk_curriculum.js:8` | `npm run validate:curriculum` → `Curriculum validation passed.` (exit 0). Previously `ENOENT /workspace/data/hsk1.json`. |
| P0-4 | Inline-script parse guard (`CLAUDE.md` §9.1) | verified | `scripts/parse_check.js` | `npm run check` → 1 script, 5,849 lines, parses cleanly. Negative test: injecting a stray `}` into `saveState` produced `FAIL … -> index.html line ~2961`, exit 1. |
| P0-5 | Test harness able to exercise the real app code | verified | `tests/helpers/app-loader.js` | Loads the inline script into a `vm` context with stubbed browser globals; strips the trailing `init()`; bridges the script's `let` bindings (`state`, `curP`, `db`, …) onto the context so tests can drive real state. |
| P0-6 | Isolated fixtures; tests cannot reach production | verified | `tests/fixtures/players.js`, `tests/helpers/app-loader.js` | `firebase` is left undefined in the context, so `initFirestore()` returns immediately. All fixtures are synthetic. No test performs a network call. |
| P0-7 | Backup of live learner records before any migration | verified | `scripts/backup_players.js`, `.gitignore` | Ran against the live project; wrote `backups/players-2026-09-05.json` (82,106 bytes) for both players. Read-only script. `backups/` is git-ignored — `git check-ignore` confirms. |
| P0-8 | Status ledger | implemented | this file | — |

### Phase 0 verification output

```
npm run verify
  parse_check: 1 inline script(s) parsed cleanly.
  Curriculum validation passed.
  tests 9 | pass 5 | fail 0 | todo 4
  EXIT=0
```

---

## Defect ledger (executable)

Each row is a confirmed defect with a test asserting the **corrected**
behaviour. The tests are marked `todo`, so they run on every `npm test`, report
loudly, and do not fail the suite until the fix lands. A row moves to `verified`
when its todo marker is removed and the test passes.

**The ledger is now empty — every row has been fixed and its test passes.**

| Req ID | Defect | Fixed in |
|---|---|---|
| S01 / M-T16 | `saveState` stamped and wrote **both** player documents | Phase A prerequisites |
| A-T12 | Deferred callbacks credited whichever profile was selected when they fired | Phase A prerequisites |
| B02a | Match dealt an unwinnable board on a 1–5 word pool, and the stuck session hijacked resume | Phase B |
| B02b | A mismatched flip logged a vocabulary failure, blaming whichever card was flipped first | Phase B |
| B02c / M-T10 | `checkPY` and `checkSB` had no answer lock: a double tap scored twice and skipped a question | Phase B |
| B02d / M-T11 | Champion rounds capped at 20 items while advertising the uncapped maximum | Phase B |
| B02e / M-T04 | Story progress divided unique taps by token occurrences (79% ceiling); a known-story re-read could never finish | Phase B |
| B02f | Resume used fixed priority with no timestamps; closing Revenge discarded the round silently | Phase B |
| G04 / M-T06 | Two completion sites paid differently, and a cleared gate paid again on every boss replay | Phase B |
| T03 / M-T03 | Any `storiesCompleted` entry counted as pre-feature credit, so one skimmed story unlocked all four games | Phase B |
| T04 | `uniqueChars` gave every character its whole word's reading and meaning | Phase B |
| Q01 / T-T14 | An MCQ offered a second right answer: a distractor whose gloss shared a `;`-separated sense with the answer's. 13 of 10,560 questions built from the real gate word lists, in **both** directions (全/完全 "whole", 法/法律 "law") | Branch audit |
| Q02 / T-T15 | Listen plays a clip but chose its distractors by English, so a homophone could stand as a wrong option — 向/像 (xiàng), 美/每 (měi). 11 of 10,560 questions | Branch audit |
| Q03 / T-T16 | Match pairs cards by index, so two words sharing a gloss put two cards reading the same thing on the table. 9 of 1,056 boards, three with literally identical text | Branch audit |
| Q04 / T-T17 | Drill and Revenge excluded distractors by Chinese spelling only — the practice-queue rounds, where a wrong score is what keeps a word in the queue | Branch audit |
| Q05 / T-T18 | The Daily Word challenge drew options as raw English and checked by exact string, and its target comes from the child's library: 13 of the 1,200 curriculum words collide with an HSK_VOCAB gloss ("city; town" against "city") | Branch audit |

Q01–Q05 are one defect wearing five faces: every surface that builds options
compared *strings* where the child compares *meaning*. Each is now measured at
zero on real curriculum data, with no question left short of four options and no
board shrunk. The comparison lives in one place (`sharesSense`), and
`pickDistractors` applies it whichever way a question runs.

Pinned (correct today, guarded against regression): `starsFromAccuracy`
boundaries and its lack of a minimum sample size; the `gateTimerDays` formula;
the legitimate one-read and two-reads-plus-Listen unlock chain; the assessment
bank carries no sense-sharing option pair and `validate_assessment.js` now
refuses one.

---

## Findings from the live backup

Two things surfaced when `scripts/backup_players.js` first ran. Neither has been
acted on; both are recorded here for decision.

1. **The both-profile write is confirmed in production, not just in source.**
   Both live documents carry the *identical* `lastSaved` value
   `1781304971832`. That is the single `now` from `saveState` (`index.html:2944`)
   stamped onto both children in one pass — exactly the mechanism that lets one
   device's stale copy of the other child win the last-writer-wins comparison at
   `index.html:2210`. Fixing this is requirement **S01**, scheduled inside
   Phase A because assessment attempts cannot persist safely through it.

2. **Firestore rules permit unauthenticated access to the player documents.**
   The backup read both documents over the REST API using only the public client
   API key committed in `index.html`. Unauthenticated *write* was not tested and
   must not be — but it is certain by inspection, since the app itself writes
   with `db.collection('chinese-adventure').doc(pid).set(...)` and performs no
   authentication anywhere. Anyone who has the repository URL can therefore read
   and overwrite both children's records.

   **Now addressed, pending deployment.** `firestore.rules` contains a scoped
   merge fragment and `scripts/check_firestore_rules.js` verifies it. It is not
   deployed — see the blocked item under Phase A.

---

## Phase A part 1 — assessment engine

| ID | Requirement | Status | Files | Evidence |
|---|---|---|---|---|
| S01 | Owner-scoped saves | verified | `index.html` (`savePlayer`, `saveState`, 3 parent mutators, `clearAllProgress`) | 4 tests in `tests/progression.test.cjs`, incl. a parent star edit with `curP` null writing only Jess. |
| A-T12 | Deferred-callback cancellation | verified | `index.html` (registry, `laterCall`/`repeatCall`/`drainScope`/`sessionGen`, 15 wrapped sites, 4 drain points) | 6 tests in `tests/callbacks.test.cjs`; a Rain miss scheduled for Jenn writes nothing to Jess. |
| A01 | Always-available hub entry, no side effects | verified | `index.html` hub strip + overlay | Browser run: button enabled with 0 gates cleared; total stars, week stars, gates, timers, game stars, failed words and badges all unchanged across a 9-answer attempt. |
| A02–A05 | Domains, scoring, routing | verified | `js/assessment-core.js` | A-T01, A-T02, A-T03, A-T09, A-T10 + ceiling test. |
| A06 | State machine, present-before-display, write-once | verified | `js/assessment-core.js` | A-T04, A-T05, A-T13. |
| A09 | Repeat and comparison | verified | `js/assessment-core.js` | A-T06, A-T07, A-T08, A-T14. |
| A10 | Attempt persistence, revision CAS, offline queue | verified | `js/player-store.js` | A-T11 plus queue/append tests. |
| A03/A04 | Bank + contract, all four bands | verified | `data/assessment/**`, `scripts/assessment-content.js`, `scripts/build_assessment_bank.js`, `scripts/validate_assessment.js` | 240 distinct items, 34/form/band, 8 anchors/band (32 total), 12 passages all inside band length targets; validator proven by injecting 3 defects; all 108 clips reachable. |
| A05 | Multi-band routing C1→C4 | verified | `js/assessment-core.js`, `js/assessment-ui.js` | Per-band scoring (bands never pooled); 6 routing tests incl. "a strong lower band cannot carry a weak higher one". Browser run climbed C1→C4 over 136 answers with 3 band transitions. |
| — | Firestore rules | **blocked** | `firestore.rules`, `scripts/check_firestore_rules.js` | Cannot deploy from here. Probe currently reports the rules are still wide open — expected until the block is pasted into the console. |

### Verification output

```
npm run verify
  parse_check: 1 inline script(s) parsed cleanly.
  Curriculum validation passed.
  assessment bank valid — 60 items, 0 warning(s).
  tests 39 | pass 36 | fail 0 | todo 3
```

Browser walkthroughs (Chromium 1194, 1024x768 @2x, local http server), no page
errors in either:

- **Full climb.** Jenn, all answers correct: 136 answers, three "try the next
  set" transitions accepted, final attempt spans `C1, C2, C3, C4`, status
  `results_available`. Report renders one block per band.
- **Partial stop.** Jess, deliberately poor answers plus one "I don't know":
  13 responses, status `paused`, resume offered and landed on question 14 of 34
  — the first unanswered item, not the start. Stars, gates and timers all still
  zero afterwards.

### Blocked / not verified here

1. **Firestore rules are not deployed.** `scripts/check_firestore_rules.js`
   currently reports both unintended paths as readable, which is the correct
   *pre-deployment* result. Paste the marked block from `firestore.rules` into
   the console alongside the existing rules, then re-run the probe.
2. **Cloud sync was never exercised.** This sandbox blocks the Firebase CDN, so
   `db` was null throughout the browser run and only localStorage was tested.
   The revision compare-and-set path is covered by unit tests against a stub,
   not against real Firestore.
3. **Not run on the girls' iPad.** Needed there: audio start and failure
   behaviour, overlay scrolling, backgrounding mid-question, the 20-minute
   session limit landing mid-answer, next-day resume, and profile switch during
   an attempt. A desktop Chromium run is not iPad validation.
4. **No educator has reviewed the bank.** See `docs/content-review.md`.

## Phase B — deterministic repairs

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| B02a/B02b | Match pair count and false failures | verified | 4 tests; browser run deals 2 pairs on a 2-word pool. |
| B02c | Answer locks across all three quiz phases | verified | 3 tests; a triple tap scores once. |
| B02d | Champion counts and max score derived from generated items | verified | 2 tests. |
| B02e | Unique-target progress counting | verified | 3 tests; browser run reaches 100% after 29 taps and finishes a fully-known re-read. |
| B02f | Session timestamps; Revenge saved on close | verified | 4 tests. |
| G04 | One idempotent `evaluateGateCompletion` | verified | 4 tests, incl. equal payout in either completion order and no payout on replay. |
| T03 | Legacy unlock exemption snapshot | verified | 3 tests; checked against the real backup — Jenn's 3 and Jess's 6 stories grandfathered, unlocked games unchanged. |
| T04 | Per-character trace metadata | verified | 3 tests. |

```
npm run verify
  parse_check: 1 inline script(s) parsed cleanly.
  Curriculum validation passed.
  assessment bank valid — 240 items, 0 warning(s).
  tests 69 | pass 69 | fail 0 | todo 0
```

**Not attempted in Phase B** (still open from the audit): the 22→88 gate
identity model and its migration (C01–C04), transactional sync with revisions
(S02), lazy timer expiry detonating without warning, and the Rain/Trace
per-round issues beyond callback cancellation.

## Phase C — content and retention

| ID | Requirement | Status | Files | Evidence |
|---|---|---|---|---|
| T01 | Repair the vocabulary the games actually serve | verified | `scripts/vocab-overrides.js`, `scripts/repair_vocab.js`, `scripts/validate_curriculum.js` | 453 rows repaired from 126 curated overrides; ledger in `docs/vocab-repair-ledger.md`. `checkVocabQuality` now rejects surname readings, `variant of`, `abbr.` and empty glosses, so the class cannot return. |
| T02 | Render the authored lesson passage and its real questions | verified | `index.html` (`renderGateLesson`) | 2 tests: the renderer no longer carries the three hard-coded English substitutes, and all 88 lesson files have the passage, questions and answers it now displays. |
| R01 | Skill-specific evidence, only from interpretable answers | verified | `js/review-core.js`, `index.html` (`noteEvidence`) | 27 tests in `tests/review.test.cjs`. Evidence is per `{word, skill}` across `recognition`, `meaning`, `contextComprehension`, `writingRecall`; `tracePractice` is refused. Rain misses and Match mis-flips still reach `failedWords` and never reach the retention store. |
| R02 | Next-day → +3 → +7 → +14 → +30, on unaided recall only | verified | `js/review-core.js` | Ladder walked step by step; a supported answer or a retry after the reveal never advances it; four taps in one sitting advance once; a miss returns to tomorrow without forfeiting past successes. Calendar arithmetic checked across a month end and a leap day. |
| R03 | Bounded review, backlog retained, never a penalty | verified | `js/review-core.js` (`selectDue`, `budgetSpent`) | 8 items / 4 min normal, 16 / 8 min focus; a 30-item backlog serves 8 and keeps 22 due; one slot is reserved for something already recalled so review is not an unbroken run of failures; the summary states the backlog as fact. |
| — | Assessment results as recommendation only | implemented | `js/review-core.js` (`targetsFromAssessment`) | Weak domains become suggestions carrying `provenance: "assessment"`; writing awaiting review is never counted as a weakness; calling it does not write to the review store. **Not yet surfaced in the UI** — the function exists and is tested, nothing shows it to a child or a parent. |

### Where evidence is and is not collected

Recorded: Listen (`recognition`), the gate quiz MCQ (`recognition` on reverse
items, `meaning` otherwise, `supported` when audio or the pinyin hint was used),
the gate quiz pinyin phase (`recognition`, `supported` on a chart peek), the
story mini-quiz (`meaning`, with the second pass marked `sameSession`), Drill
and Revenge (`meaning`).

Deliberately not recorded: **Rain**, **Match** and **Trace**. A mistimed tap and
a mismatched flip are game mechanics, not claims about whether a child knows a
word, and tracing is practice rather than independent recall. Those still feed
`failedWords`, which is the counter the app always had.

Also not yet collected: `contextComprehension` and `writingRecall` have no
source outside the assessment. The lesson comprehension questions print their
own answers beside them, so they are reading material, not a check.

### Verification output

```
npm run verify
  parse_check: 1 inline script(s) parsed cleanly.
  Curriculum validation passed.
  assessment bank valid — 240 items, 0 warning(s).
  tests 155 | pass 155 | fail 0 | todo 0
```

Browser run (Chromium 1194, local http server), no page errors:

- A Listen round played through the real UI wrote exactly one
  `{word, recognition}` record for the word asked, due the next day, labelled
  "recalled independently"; a `logWrong` call in the same session wrote nothing
  to the retention store; the record survived `savePlayer` into localStorage;
  Jess's store stayed empty and no stars moved.
- Twelve clicks through the boss quiz MCQ phase produced six records across both
  skills — forward items as `meaning`, reverse items as `recognition` — and the
  six clicks the answer lock refused produced no duplicate evidence.

## Phase D — all 88 gates

| ID | Requirement | Status | Files | Evidence |
|---|---|---|---|---|
| — | Measure what content actually exists behind the 88 gates | verified | `scripts/content_coverage.js`, `docs/content-coverage.md` | `npm run coverage:content`. Reads the real `STORIES_MAP` and `DYNASTIES` out of the inline script, so the numbers are the app's, not a re-derivation. Read-only. |
| O05 | Texts increase in difficulty with the selected level | **partly verified — HSK1 and HSK2 done, HSK3-4 outstanding** | `data/stories/**`, `index.html` (`storyForGate`, `storyKeyFor`), `scripts/build_stories.js` | Owner decision: the same background story per dynasty, told at each level's difficulty; ladder 10/15/20/25 sentences. Stories left `index.html`, are keyed `<base>-h<level>` and load per level. **All 44 HSK1 stories are on the ten-sentence ladder and all 44 HSK2 on the fifteen-sentence one** — gates 1-11 extended, gates 12-22 rewritten because their texts were HSK3/HSK4 vocabulary. A level with no text of its own serves the HSK1 telling **and says so in the reader**, so partial content is never silently mislabelled. Reads count per level; `migratePlayer` remaps legacy ids. Tests S-T01 to S-T03; Chromium walkthrough. **HSK3-HSK4 texts are not written** — `npm run coverage:content` reports the per-level count. |
| T05 | Real lesson passages, tied to the gate's story and readable by the child | **partly verified — 44 of 88** | `data/lessons/**`, `scripts/build_gate_lessons.js`, `scripts/validate_lessons.js` | The 44 HSK1 and HSK2 lessons are rebuilt from their own gate's story: passage is that story's opening, the eight key words are content words from it, and each question points at a sentence that is really there. Every instruction, question and answer is **bilingual** — they were Chinese-only, which these two readers cannot use — with the passage staying Chinese and its English behind a toggle. Test S-T04. 44 lessons (HSK3-HSK4) remain on the old template; `npm run validate:lessons` prints the count each run. |
| T06 | Glosses shown in the reader are meanings, not fragments or codes | verified | `content/stories/**`, `scripts/validate_stories.js` | 211 distinct junk glosses were being shown on every character tap, across two passes: a longer word's English split across its characters (习 `-tice`, 友 `-end`, 鼠 `-use`) and linguists' codes for grammar (的 `DE` x196, 了 `CMPL` x110, `PL`, `CL`, `BA`, `ING`). Same class as the 水 "surname Shui" defect, in the one place the app teaches meaning directly. 1,283 glosses corrected across all sources; the validator rejects a fragment, an all-caps code or a surname gloss. Rule written down in `docs/chinese-style.md`. Test S-T03. |
| T07 | Assessment bank has no answer reachable without reading | verified | `scripts/assessment-content.js`, `build_assessment_bank.js`, `validate_assessment.js` | Bank 1.0.0 took distractors as the first three other words in list order, so later items offered three sounds that were earlier items' correct answers: **40 of 128 audio items were answerable by elimination**, across only 32 distinct distractor sets. Bank 1.1.0 gives each band twelve foils used only as wrong options and disjoint from every target, drawn by a seeded shuffle - 0 eliminable, 102 distinct sets. Three validator checks, confirmed by reintroducing the defect and watching them fail. Tests A-T20 to A-T23. Comparability cost recorded in `docs/assessment-method.md`. |
| T08 | Handwriting can actually be reviewed | verified | `js/assessment-ui.js` | `scoreAttempt` always read `attempt.writingReviews` and the bank always shipped the rubric, but nothing in the app ever wrote one - so every report read "waiting for a grown-up" permanently. A review screen behind the parent PIN marks each character against `writing-recall-v1`, leaving `responses` untouched. Test A-T25; Chromium: marking 3 of 4 makes the report read "3 of 4 right". |
| T09 | Level unlock enforces the stated rule | verified | `js/gate-identity.js`, `index.html` | `levelUnlocked` already required gate 22 of the level below, but `legacyLevelAccess` was a second route that let a child hold HSK2 on five cleared gates, invisibly. The grant is no longer consulted; the field is still written as a record and is now **shown in the parent panel** so a revoked tab is explained rather than vanishing. The locked-tab toast states the real rule and progress. Tests C01, C03, C03b, P-T03. |
| T10 | Named features are bilingual, from one definition | verified | `index.html` (`UI_LABELS`, `L()`, `data-ui-label`) | Hub buttons and the overlays they opened were written separately, routinely disagreed, and half shipped in one language (`拼音表` opening `拼音表 · Pinyin Chart`). One definition per feature now renders both. Tests UI-T01 to UI-T03. |
| T11 | Parent flags are level-aware | verified | `index.html` (`gatesClearedSummary`, `levelsWithProgress`, `playedBeforeReadingHtml`) | The panel printed `gatesCompleted.length + "/22"` over an array that spans all 88 gates, and the "played before 2 reads" flag resolved story ids through the ambient `curHSK` - which, opened from the select screen, is whatever the last session left. Both now work per level and name it. Tests P-T01, P-T02. |

Gate vocabulary is done: all four levels serve 793 rows each with no missing
English, after T01 repaired 453 of them.

## Audit ledger — third-party milestone audit, 2026-09-08

Each finding was reproduced against `main` before any change, then fixed in
its own commit with regression tests written to hand-computed expectations.
F07 (HSK3/4 texts) and F08 (higher-band word sampling, educator review) are
content work and were deferred by owner decision; both are already stated
honestly in `docs/content-coverage.md` and `docs/content-review.md`.

| Finding | Paths | Tests | Change | Verification |
|---|---|---|---|---|
| F01 — a quiz or game finishing after its deadline still qualified the new attempt | `index.html` (`gateAttemptBinding`, `gateSessionQualifies`, `updateGateGameBest`, `renderQuizResult`, the four game start/persist/restore paths, `clearPendingSession`); new fields `gateResetSeq`, `pendingSessionClearedAt` | 8 in `tests/progression.test.cjs` ("F01: …") | Every gate-scoped round records `{playerId, gateKey, attemptId, resetSeq}` at start and the qualifying write compares it to the gate's current attempt. A late round is presented as practice and pays nothing; its per-answer evidence stands. The games had no check at all before. | 240 unit tests. Chromium: a Listen round resumed under a lapsed attempt shows the practice toast, banks no stars, mints no timer; a fresh gate's first 3★ shows "Challenge Started" once. |
| F02 — merge undid resets and dropped review evidence | `js/merge-state.js` (`resetMarker`, `resetNewer`, `mergeGateRecords`, `mergeGateTimers`, `mergeReviewRecords`, null-slot rule), `js/review-core.js` (`applyAttempt`, `mergeRecords`, attempt ids) | M-T17 fixture made faithful; 9 new in `tests/merge.test.cjs`, 4 in `tests/review.test.cjs` | The resetting side's record is taken whole (a zeros object counts); resets compare by archived attempt id before day; review histories are unioned by id and replayed through a pure fold; a null slot adopts the other device's live round unless cleared here afterwards. | Unit tests only — pure module, no browser path. |
| F03 — assessment sync was upload-only and the compare-and-set was not one | `js/player-store.js` (`deviceId`, `resumableOn`, `pushAttempt` transaction, `listCloudAttempts`, `hydrateFromCloud`, `isSynced`, `flushQueue`), `js/assessment-core.js` (`deviceId`), `js/assessment-ui.js` (open, home, resume, status labels, `online` listener) | 6 in `tests/assessment.test.cjs` ("F03: …") | In-progress attempts are continued only on the device that started them; every device hydrates the cloud's attempts for history and comparison; the queue is flushed on open and on reconnect; a push is refused unless the cloud holds the acknowledged base revision. | Unit tests against a stub with a transaction. **Not run against Firestore** — the sandbox blocks the Firebase CDN. Chromium with `db` null: history reads "Saved on this device", a foreign-device round is named and not offered for Continue. |
| F04 — repeat and comparison did not deliver the progress check | `data/assessment/1.1.0/` (moved from `v1/`), `manifest.json` `versions`, `scripts/build_assessment_bank.js`, `scripts/validate_assessment.js`, `index.html` (`loadAssessmentBank(version)`), `js/assessment-core.js` (`optionSeedAttemptId`, `bandPath`, `nextPlannedBand`, `compareAttempts.byBand`), `js/assessment-ui.js` (`bankFor`, repeat, band end, result, `assessmentCompare`, unavailable-bank notice) | A-T29–A-T32, manifest test | Banks are frozen per version; a report, export or writing review loads the bank it was taken with, and a version no longer shipped says so instead of rescoring. A same-questions repeat starts in the original band, seeds options on the original attempt and follows its band path. A before-and-after screen reports per band, anchors apart from fresh. | Chromium: the 1.0.0 report shows the notice; the repeat's first presentation equals the original's; the compare screen renders. |
| F05 — scheduled reviews never reached a child | `index.html` (`buildReviewRound`, `startReviewRound`, `renderReviewRound`, `answerReview`, `exitReviewRound`, `finishReviewRound`, `renderReviewTodayBox`, `reviewPickerRow`; `pendingSessions.review`) | 8 in `tests/review.test.cjs` ("F05: …") | "Review today": eight due items per sitting, each asked in the skill it is due for, first response unaided, retry after the reveal recorded `sameSession`; hub card and games-picker row; early exit saves and pays nothing; natural completion pays a flat 5. `writingRecall` records are counted as remaining, not asked — nothing produces them yet. | Chromium: card reads "8 to review; 4 remain for later"; three answered, Save & Exit, resume on item 4, finish, exactly +5 stars, evidence written. |
| F06 — lesson answers were printed with the questions | `index.html` (`renderGateLesson`, `lessonRevealAnswer`, `lessonSelfCheck`; field `lessonSelfCheck`), `js/merge-state.js` (`mergeLessonSelfCheck`) | 3 in `tests/progression.test.cjs`, 1 in `tests/merge.test.cjs` | Answer hidden until Reveal; then "I had it" / "Not yet", stored per gate per question as a self-report, never as evidence, never for stars. Reviewed answer options deferred with F07. | Chromium: answers hidden, Reveal opens both verdicts, "Not yet" survives a reload. |
| Pacing — assessment had no sitting rhythm and `activeTimeMs` was never written | `js/assessment-core.js` (`addActiveTime`, `shouldOfferBreak`, `markBreakOffered`), `js/assessment-ui.js` (`commit`, `renderBreakOffer`) | A-T33, A-T34 | Item time lands with the answer, capped so a closed lid does not count; a soft "save and continue later?" once per twenty minutes, no lock. | Chromium: an attempt resumed at 19:59.9 shows the prompt after one answer; Keep going lands on question 2. |

The walkthrough script is not checked in; it seeds synthetic players into
`localStorage`, drives the real functions, and fails on any page error. It
reported 30/30 checks and zero page errors on a 1024×768 headless Chromium 1194.

