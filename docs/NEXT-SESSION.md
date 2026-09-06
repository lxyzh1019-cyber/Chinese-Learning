# Handoff — Chinese Adventure, post-baseline

Read this first in a new session. It is the working state of the audit-and-plan
work, written to be the only file you need before picking up.

---

## Goal

Validate an external audit of the app against the real code, then execute the
resulting plan: ship the assessment, fix the confirmed defects, move to an
88-gate model, make sync survive divergent devices, repair the content the games
actually serve, and add a retention model. Measure before authoring more content.

## Locked decisions (do not re-litigate)

| Decision | Choice |
|---|---|
| Order | Assessment first, then Phase B defects |
| Assessment scope | Full spec — 4 bands C1–C4 × 2 forms, 240 distinct items |
| Audio | Keep device TTS, label the reproducibility limit honestly |
| Live records | Real and must be preserved — backup + dry run before any migration |
| Firestore rules | Ship as a **merge fragment**, never a publishable ruleset — the project is shared with other apps |
| Bands | Custom C1–C4. **Not** HSK 1–4, and must never be presented as such |
| Honesty bar | No overall "ability" score, no mastery flag, unreviewed writing is never zero |

## Current state

- Branch `claude/audit-improvement-plan-review-bfx948`, **17 commits** ahead of `main`.
- PR [#43](https://github.com/lxyzh1019-cyber/Chinese-Learning/pull/43), draft, open.
- `npm run verify` → **155 tests, 0 fail, 0 todo**. Parse guard, curriculum
  validator and assessment bank all pass.
- Working tree clean.

**Shipped and verified:** owner-scoped saves; deferred-callback registry with
`sessionGen`; answer locks; Match pair count from the pool; unique-target story
progress; champion counts from generated items; one idempotent
`evaluateGateCompletion`; eager gate-timer expiry; per-character trace metadata;
88-gate identity `h{level}-g{NN}` with a shape-aware migration; revision
compare-and-set plus event-sourced merge; 453 vocabulary rows repaired; lesson
passages rendered; retention engine; content-coverage measurement.

**Two bugs only a browser caught** (unit tests passed through both) — keep
browser verification in the loop:
1. `defPlayer()`'s `schemaVersion: 2` leaked onto legacy documents via
   `Object.assign`, skipping migration, which then filtered every numeric gate
   id away — would have silently erased all completions.
2. `flashPassDone` missing from the migration remap would have re-locked Trace.

## Open — needs the owner

**O05 — the story-level decision. This is what the baseline unblocks.**

44 stories serve all 88 gates. A dynasty carries `story`/`story2` with no level
dimension, so `h1-g01` and `h4-g01` show the same 大禹治水; only the vocabulary,
lesson and quiz differ. Difficulty tracks the dynasty's position in history, not
the learner's level (53 study characters/gate at gates 1–5 vs 86 at 18–22; the
HSK1 share of a gate's story characters runs 36%–85%).

Live progress as of the 2026-09-05 backup:

| | gates cleared | level 2 |
|---|---|---|
| Jess | 1–5 | **already unlocked** |
| Jenn | 1–2 | 3 gates away |

So the decision turns on Jess:

- **Jess in C1** → she cleared gates faster than her reading supports. Take
  option **B**: re-level the existing 44 and say plainly the story is shared.
  Don't author new ones yet.
- **Jess in C2+** → she needs harder texts. Take option **C**: author 22 new
  stories for the upper levels, starting with the dynasties she's nearest.

Full option list with costs: `docs/content-coverage.md`. Recommendation was
**C then B**. Authoring all 132 missing stories (option A) is hand-tokenized per
character and should not be committed to before the baseline.

## Open — not started

- **T05** — 66 of 88 lesson passages are still the gate's vocabulary list wrapped
  in instructions, with questions that ask about the lesson rather than a text
  (`本关有几个生字`). The 22 HSK2 lessons are real and are the model to copy.
  T02 made these visible rather than hidden, which is the right order.

## Blocked on the owner or on hardware

1. **Firestore rules not deployed.** `firestore.rules` is a merge fragment.
   Paste only the marked block into the existing ruleset in the Firebase
   console, then run `node scripts/check_firestore_rules.js` (read-only probes;
   nothing writes). Until then both children's documents are readable and
   writable by anyone with the repo URL. The fragment requires **no auth**, so
   it is safe to apply to the currently-deployed app as well as the new one.
2. **Cloud sync never exercised.** This sandbox blocks the Firebase CDN, so `db`
   was null in every browser run. The CAS path is unit-tested against a stub only.
3. **Not run on the girls' iPad.** Needed there: audio start and failure,
   overlay scrolling, backgrounding mid-question, the session limit landing
   mid-answer, next-day resume, profile switch during an attempt.
4. **No educator has reviewed the assessment bank.** Every item records
   `reviewerType: "model"`.

## Next step

Report the baseline results — for each child, the per-part counts and which set
(C1–C4) they reached. Then take the O05 decision above, and pick up T05.

## Reference

```
repo    lxyzh1019-cyber/Chinese-Learning
branch  claude/audit-improvement-plan-review-bfx948
PR      #43 (draft)

npm run verify              # parse guard + curriculum + bank + 155 tests
npm run coverage:content    # what content exists behind the 88 gates
npm run validate:assessment:audio   # HEAD-checks all 108 clips
node scripts/backup_players.js      # READ-ONLY live backup, no credentials needed

docs/CHINESE_LEARNING_IMPLEMENTATION_PLAN.md   the audit validation, §1.2 corrections
docs/implementation-status.md                  per-requirement status + evidence
docs/content-coverage.md                       O05 options and their costs
docs/assessment-method.md                      what the assessment can and cannot do
CLAUDE.md                                      the blueprint, now matching the code
```

`backups/` is git-ignored and holds **real learner records** — never commit it,
and note that a sandbox container's copy is lost when it is reclaimed.

Parent-facing brief for the sitting:
https://claude.ai/code/artifact/52b3f979-14b0-41e0-a2df-d4c2084b4c11
