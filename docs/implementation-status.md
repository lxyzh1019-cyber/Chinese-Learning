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

| Req ID | Defect | Test | Status |
|---|---|---|---|
| T03 / M-T03 | `storiesCompleted` bypasses the read/flashcard unlock chain for new users | `tests/progression.test.cjs` | todo — fails, all four games unlock |
| T04 | `uniqueChars` gives every character its whole word's reading | `tests/progression.test.cjs` | todo — fails, 习 reads "xué xí" |
| B02d / M-T11 | `buildMCQ`/`buildPYQ` cap champion rounds at 20 items | `tests/progression.test.cjs` | todo — fails, 32 → 20 and 40 → 20 |

Resolved: **S01 / M-T16** (`saveState` writing both player documents) was fixed
in this phase and its test now passes without a todo marker.

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

## Phases B–D

Not started. The three remaining `todo` tests are the Phase B entry points.
