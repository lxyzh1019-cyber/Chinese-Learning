# Implementation status

Live ledger for the work described in `docs/CHINESE_LEARNING_IMPLEMENTATION_PLAN.md`.

Status values: `not started` · `implemented` · `verified` · `blocked`.
**`verified` requires evidence** — a passing check, a test, or an observed UI
traversal. Untested code is `implemented`, never `verified`.

Baseline commit: `c5f94bb` · Working branch: `claude/audit-improvement-plan-review-bfx948`

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

Pinned (correct today, guarded against regression): `starsFromAccuracy`
boundaries and its lack of a minimum sample size; the `gateTimerDays` formula;
the legitimate one-read and two-reads-plus-Listen unlock chain.

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

## Phase D

Not started. 88 placeholder lessons (66 still ask 本关有几个生字), and 44 stories
covering 88 gates, so decision **O05** is not met by content.
