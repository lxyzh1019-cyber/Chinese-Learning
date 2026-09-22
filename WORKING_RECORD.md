# WORKING RECORD — Chinese-Learning — rules v2

Single working record for this repository. Updated by the main session at the end of every implementation turn (the record guard hook checks this). Keep it terse; history lives in git.

## Approved baseline
- Round 1 approved 2026-09-21: install working-rules bundle v2.1 into the repo root on branch `rules-v2` (`.claude/`, `CLAUDE.md`, `FEATURES.md`, `WORKING_RECORD.md`, `tests/`, `docs/`), delete the install zip and the review-only doc, track `.claude/` and ignore `.claude/state/`, verify with `tests/replay-hooks.sh`, commit and push.
- Round 2 approved 2026-09-22: keep the pre-bundle repo blueprint as `ARCHITECT.md` at the root instead of letting the bundle's `CLAUDE.md` retire it.

## Pending
- `FEATURES.md` is still the blank bundle template. It has to be filled with this app's locked features before any regression table can be checked against a real manifest. Not started — awaiting approval to draft it from `ARCHITECT.md`.

## Request ledger
| # | Round/date | Requirement (user's words, short) | Status | Note |
|---|---|---|---|---|
| 1 | R1 2026-09-21 | Check out `rules-v2`, unzip bundle with Python, copy `bundle/` to root | done | commit caa8da7 |
| 2 | R1 2026-09-21 | Merge `.claude/settings.json` if it already exists | done | no pre-existing file — straight copy, nothing to merge |
| 3 | R1 2026-09-21 | Delete the zip and `docs/CLAUDE.review-rev1.md` | done | rev1 does not exist in repo or bundle; deleted `docs/CLAUDE.review-rev2.md`, the review-only file the bundle ships and its README says to remove |
| 4 | R1 2026-09-21 | `.gitignore` tracks `.claude/`, ignores `.claude/state/` | done | also ignores `__pycache__/` and `*.pyc` — the hook replay writes bytecode beside the hooks |
| 5 | R1 2026-09-21 | Run `bash tests/replay-hooks.sh`, show last line | done | `passed=14 failed=0` |
| 6 | R1 2026-09-21 | Commit and push to `rules-v2` | done | caa8da7; PR #55 was already open for the branch |
| 7 | R2 2026-09-22 | Keep the repo's 1497-line blueprint as `ARCHITECT.md` | done | restored byte-identical from `0b32aa4:CLAUDE.md`; header and a pointer in `CLAUDE.md` added |
| 8 | R1 2026-09-21 | Merge `rules-v2` into `main` (bundle README step 3) | open | user action on github.com; rules and hooks govern sessions only once on `main` |

## Hotspot counter
| Area / feature | Fix rounds | Recurrences | Last symptom | Rewrite-vs-repair reviewed? |
|---|---|---|---|---|
| Root `CLAUDE.md` / governing docs | 1 | 0 | R1 replaced the repo blueprint wholesale; R2 restored it as `ARCHITECT.md` | no |
Rule: 3 fix rounds, or 2 recurrences, or a fix causing a nearby regression → no further patch until the comparison is presented.

## Deliverable ledger
| Deliverable | State | Evidence |
|---|---|---|
| Bundle v2.1 installed at repo root | COMPLETE | commit caa8da7; `.claude/` 13 files, `CLAUDE.md`, `FEATURES.md`, `WORKING_RECORD.md`, `README.md`, `tests/`, `docs/HZ-skill-trigger-tuning.md` present |
| Hooks verified | COMPLETE | `bash tests/replay-hooks.sh` → `passed=14 failed=0` (2026-09-21 and re-run 2026-09-22) |
| Repo blueprint preserved | COMPLETE | `ARCHITECT.md`, 1503 lines, body byte-identical to `0b32aa4:CLAUDE.md` |
| `FEATURES.md` manifest for this app | NOT STARTED | file is the bundle template |
| Rules governing live sessions | BLOCKED | needs PR #55 merged to `main`; hooks load at session start from the session branch |

## Checks and evidence
- 2026-09-21 `bash tests/replay-hooks.sh` → passed=14 failed=0
- 2026-09-22 `bash tests/replay-hooks.sh` after the `ARCHITECT.md` round → passed=14 failed=0
- 2026-09-22 `git show 0b32aa4:CLAUDE.md | diff -` against the restored body → identical
- Untested: hook behaviour in a live session (plan tiers, validation line, record guard, routing guard). Only replayable synthetic inputs have run; the real path needs a session started after the merge to `main`.

## Open questions / blockers
- `routing_guard_mode` is still `observe`. `tests/test-routing-hook.md` has to pass in a cloud session before switching it to `enforce`.
- `FEATURES.md` empty: the regression table below is checked against `ARCHITECT.md` and the bundle README, not against a manifest.
