# Working-rules bundle v2 — install and verify

## Install — cloud only (GitHub web + one cloud session per repo)

No local folder, terminal, or Git Bash is needed. Repeat for each app repo.

1. **Upload the zip.** On github.com open the repo → **Add file → Upload files** → drag in `working-rules-bundle-v2.zip` as one file (keep it zipped so the `.claude` folder survives). In the commit box choose **Create a new branch**, name it `rules-v2`, commit.
2. **Install in a cloud session.** Start a cloud session on the repo and paste:

   > Check out branch `rules-v2`. Unzip `working-rules-bundle-v2.zip` with Python. Copy the contents of `bundle/` into the repo root so `.claude/`, `CLAUDE.md`, `FEATURES.md`, `WORKING_RECORD.md`, `tests/`, `docs/` sit at the root. If `.claude/settings.json` already exists, merge it: keep existing keys, let the bundle's `model` win, add its `ask`/`deny` entries, append its hook entries to existing event blocks. Delete the zip and `docs/CLAUDE.review-rev2.md`. Make `.gitignore` track `.claude/` and ignore `.claude/state/`. Run `bash tests/replay-hooks.sh` and show the last line. Then commit and push to `rules-v2`.

   Expect `passed=14 failed=0`. The session will ask before committing and pushing — approve; that prompt is the new git rule working.
3. **Merge.** On github.com open a pull request from `rules-v2` into `main` and merge it. Cloud sessions start from `main`, so the rules apply only after this.
4. **Verify in a new cloud session** (hooks load at session start, so the install session itself is not governed):
   - First reply reports "rules v2.1 (2026-09-21)" and the branch. v1 or nothing → the files are not on `main`.
   - Send a 3-bullet request → it opens with a full Plan vN. A 1-bullet request → micro-plan.
   - Every final answer ends with the validation line.
   - Run `tests/test-routing-hook.md` (cloud steps) before switching `routing_guard_mode` to `enforce`.

## Where the files land
| File | Grade |
|---|---|
| `CLAUDE.md` (root) | Prose, reduced to what no mechanism can enforce; My Environment is a fact block |
| `.claude/settings.json` | Native: model, plan mode, git ask/deny, hook registration |
| `.claude/hooks/*` | Hook |
| `.claude/agents/opus-worker.md` | Native model; effort configured-not-verified |
| `.claude/skills/hz-guarantee-audit/` | Skill (also upload this folder, zipped, to claude.ai → Settings → Capabilities → Skills) |
| `FEATURES.md`, `WORKING_RECORD.md` | Templates — fill in per repo |
| `tests/` | Verification |
| `docs/HZ-skill-trigger-tuning.md` | Procedure |
| `docs/CLAUDE.review-rev2.md` | Review only — deleted during install |

## What is now guaranteed vs still adherence
- Guaranteed: no edits before plan approval; commit/push/merge/deploy prompt you; destructive git denied; validation line present; record + regression table when files change; plan tier injected; skill invocation for keywords in `skill-router.json`; Fable model in main session, Opus in worker.
- Adherence only: reasoning discipline, honesty of Confidence/Status values, colour palette on plans, quality of the record, hotspot judgement, effort level.

## Multi-repo
Keep this zip as the master (e.g. in one config repo); upload it into each app repo with steps 1–3. `CLAUDE.md` cannot import across repos. Bump the version header when you change rules so a session can report which version it loaded.
