# WORKING RECORD — Chinese-Learning — rules v2

Single working record for this repository. Updated by the main session at the end of every implementation turn (the record guard hook checks this). Keep it terse; history lives in git.

## Approved baseline
- Round 1 approved 2026-09-21: install working-rules bundle v2.1 into the repo root on branch `rules-v2` (`.claude/`, `CLAUDE.md`, `FEATURES.md`, `WORKING_RECORD.md`, `tests/`, `docs/`), delete the install zip and the review-only doc, track `.claude/` and ignore `.claude/state/`, verify with `tests/replay-hooks.sh`, commit and push.
- Round 2 approved 2026-09-22: keep the pre-bundle repo blueprint as `ARCHITECT.md` at the root instead of letting the bundle's `CLAUDE.md` retire it.
- Round 4 approved 2026-09-30: Plan v4 — design fix, all five handoff parts in one PR on branch `claude/design-fix-one-pr` (tokens/colours/sizes/docs, layout, kids' wording, parent screen order, five corrected glosses 吗 当 刺 底 获). Plan copy: `plans/2026-09-30-plan-v5-design-fix-one-pr.md`.

## Pending
- None for round 4. Follow-ups are listed under Open questions.

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
| 9 | R3 2026-09-27 | Run the `hz-claude-config` stub installer; commit, push and open a PR if it ends `INSTALL OK` | done | `INSTALL OK`, smoke test `Rules v3.1.4 loaded`. v2 hooks, skill copy, `tests/replay-hooks.sh`, `tests/test-routing-hook.md`, `docs/HZ-skill-trigger-tuning.md` removed; `README.md` (the bundle install guide, no earlier version) removed; "Repository Architecture" section kept in `CLAUDE.md` after the pointer. || 10 | R4 2026-09-30 | Design fix from the handoff, all five parts in one PR | done | PR #59 merged (faa6a2e) |
| 11 | R4 2026-09-30 | Only the wrong glosses change; keep the old wording otherwise | done | 吗 当 刺 底 获 in 19 places |
| 12 | R4 2026-09-30 | Fix the pinyin of 吗 底 刺 too; apply 回 and 兵 now; rebuild stories now | done | answered in chat after stage 8 |

## Hotspot counter
| Area / feature | Fix rounds | Recurrences | Regressions caused | Workarounds/exceptions | Last symptom | Rewrite-vs-repair reviewed? |
|---|---|---|---|---|---|---|
| Root `CLAUDE.md` / governing docs | 1 | 0 | 0 | 0 | R1 replaced the repo blueprint wholesale; R2 restored it as `ARCHITECT.md` | no |
| UI design / kid wording / glosses | 1 | 0 | 0 | 0 | R4 handoff: crimson tints in other seasons, small tap targets and text, grown-up quiz wording, four wrong-sense glosses | no |
Rule: 3 fix rounds, or 2 recurrences, or a fix causing a nearby regression → no further patch until the comparison is presented.

## Deliverable ledger
| Deliverable | State | Evidence |
|---|---|---|
| Bundle v2.1 installed at repo root | COMPLETE | commit caa8da7; `.claude/` 13 files, `CLAUDE.md`, `FEATURES.md`, `WORKING_RECORD.md`, `README.md`, `tests/`, `docs/HZ-skill-trigger-tuning.md` present |
| Hooks verified | COMPLETE | `bash tests/replay-hooks.sh` → `passed=14 failed=0` (2026-09-21 and re-run 2026-09-22) |
| Repo blueprint preserved | COMPLETE | `ARCHITECT.md`, 1503 lines, body byte-identical to `0b32aa4:CLAUDE.md` |
| `FEATURES.md` manifest for this app | COMPLETE | manifest v1 drafted from `ARCHITECT.md` §1–§29, 2026-09-30 |
| Rules governing live sessions | BLOCKED | needs PR #55 merged to `main`; hooks load at session start from the session branch |
| R4 stage 1: FEATURES manifest, branch, baseline | COMPLETE | `FEATURES.md` v1; branch `claude/design-fix-one-pr`; tests 344/344, assessment check 4 CRLF-only failures |
| R4 stage 2: tokens and docs | COMPLETE | tokens.css blocks in `:root` + seasons; `docs/DESIGN.md`, `docs/mockups/mockups.html`; check set green |
| R4 stage 3: colour literals to tokens | COMPLETE | 96 gold alphas + 31 other literals tokenised; `.btn-p` gold; `SENT_COLORS` removed; leftovers listed in PR (`cultureGlow` alpha 0, `.cu.tapped`, red shadows) |
| R4 stage 4: sizes, weight, version stamp | COMPLETE | 52 px rules, 44 px parent inputs, 22 font sizes → .65rem, 30 weights 800 → 700, `v2026-09-30` stamp; not yet seen in a browser |
| R4 stage 5: layout | COMPLETE | pop-up min(720px,94vw); 900px hub block; time-up card 420px, title nowrap; tests 344/344; not yet seen in a browser |
| R4 stage 6: kids' wording | COMPLETE | all planned lines + leftovers ("stars" on profile cards, 2 gate-quiz ❌ lines, story mini-quiz score, badge "HSK / Practice list"); grep: no kid-visible pts/Phase/MCQ/Mix:/Memory/Work in Progress/WIP/❌; wrong answer seen in browser as "Not quite — it is …"; tests 344/344. Out of scope, noted: Listen/Rain still show "score N" |
| R4 stage 7: parent screen order | COMPLETE | report → star manager → Settings · 设置 → Clear all; 3 help lines; ids unchanged; tests 344/344 |
| R4 stage 8: five English meanings | COMPLETE | 19 `en` values changed across hsk1/2/4 + 3 lessons, nothing else in data/ (130,346-value snapshot diff); overrides + ledger; tests 344/344. Follow-ups: pinyin of 吗 má / 底 de / 刺 cī doesn't fit the new sense; 回 and 兵 overrides held back; 4 story tap glosses change on next story build |
| R4 stage 8b: pinyin 吗 ma / 底 dǐ / 刺 cì; apply held 回 兵 overrides; rebuild stories | COMPLETE | pinyin 吗 ma / 底 dǐ / 刺 cì in every copy (typing "di" accepted, checked with the app's stripTones); 回 "to return; to go back", 兵 "soldier" (incl. lesson hsk4_gate_20); build:stories changed exactly 10 values, build:sentences 1, lessons none; 32 values changed in data/, nothing else; ledger lists all 7 words; tests 344/344 |
| R4 stage 9: checks and screenshots | COMPLETE | colour grep clean in CSS block; gloss check 51 fields, only the 7 words; browser audit on a local Firebase-free copy, 1194×834 and 834×1194: nothing under 52 px after the fix (parent button 41→52, Hear again 42→52, practice chips 27→52, mascot row 13→52), Dynasty Road in first portrait viewport, no label overlap, no CSS text <12 px; 31 screenshots in `docs/screenshots/design-2026-09/` (800 px wide, pane-scaled) |
| R4 stage 10: review, records, PR | COMPLETE | review of screenshots and diff; `ARCHITECT.md` §1, §3, §11, §16, §17, §18, §20 updated; plan copied to `plans/`; commit 07126e0 pushed; PR #59 open, ready for review |
| R4 stage 11: user merges the PR | COMPLETE | PR #59 merged 2026-10-01 00:02 UTC, merge commit faa6a2e on `main` |
| R4 stage 12: confirm merge, close plan | COMPLETE | branch tip 6b3ef34 is an ancestor of `origin/main`; plan v5 closed |

## Checks and evidence
- 2026-09-21 `bash tests/replay-hooks.sh` → passed=14 failed=0
- 2026-09-22 `bash tests/replay-hooks.sh` after the `ARCHITECT.md` round → passed=14 failed=0
- 2026-09-22 `git show 0b32aa4:CLAUDE.md | diff -` against the restored body → identical
- 2026-09-30 baseline on this Windows clone, `main` 91d2601: `node --test` 344/344; curriculum, stories, lessons, sentences, culture validators pass; `validate:assessment` fails 4 hash checks because Git checks the bank files out with CRLF (repo copies are LF and match). Known local-only failure; checks run separately (user choice).
- 2026-09-30 final tree on `claude/design-fix-one-pr`: parse check and curriculum/stories/lessons/sentences/culture validators pass; `node --test` 344/344; assessment exactly the 4 CRLF-only failures.
- Untested: hook behaviour in a live session (plan tiers, validation line, record guard, routing guard). Only replayable synthetic inputs have run; the real path needs a session started after the merge to `main`.

## Open questions / blockers
- Follow-ups found in stage 9, outside this plan: Listen and Rain still show "score N"; 12 inline gold/red literals outside the CSS block; the daily word for 大 offered two right-looking options; "1 days" on My Day and parent screen.
- Local-only: `validate:assessment` fails 4 hash checks on this Windows clone (CRLF checkout); passes on LF checkouts.
- Found in stage 8b, out of scope: HSK1 sentence pack reads 地上 as "de shàng" (should be "dì shàng"). Pre-existing; follow-up.
- Superseded 2026-09-27: `routing_guard_mode` and `tests/test-routing-hook.md` were removed by the stub install; routing-guard mode is now set in `hz-claude-config`.
- Superseded 2026-09-30: `FEATURES.md` is filled (manifest v1).
