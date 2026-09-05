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
| S01 / M-T16 | `saveState` stamps and writes **both** player documents | `tests/progression.test.cjs` | todo — fails, capturing writes to `['jenn','jess']` |
| T03 / M-T03 | `storiesCompleted` bypasses the read/flashcard unlock chain for new users | `tests/progression.test.cjs` | todo — fails, all four games unlock |
| T04 | `uniqueChars` gives every character its whole word's reading | `tests/progression.test.cjs` | todo — fails, 习 reads "xué xí" |
| B02d / M-T11 | `buildMCQ`/`buildPYQ` cap champion rounds at 20 items | `tests/progression.test.cjs` | todo — fails, 32 → 20 and 40 → 20 |

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

   No rule has been changed. The plan is explicit that live rules are not to be
   modified unasked, and tightening them would break the app until matching auth
   is added. Raised for the owner's decision.

---

## Phases A–D

Not started. See the plan document for scope. Phase A begins with the two
prerequisites named in §A.2 (`saveState` owner scoping, callback cancellation on
profile switch), each of which already has a failing todo test above or will get
one before the fix lands.
