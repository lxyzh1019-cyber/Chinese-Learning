# Handoff — Chinese Adventure, after the baseline fixes

Read this first in a new session. It is the working state, written to be the
only file you need.

---

## Current state

- Branch `claude/chinese-adventure-audit-cont-xjxqpl`, PR
  [#44](https://github.com/lxyzh1019-cyber/Chinese-Learning/pull/44) (draft).
  PR #43 is **merged**; this branch started fresh from `main`.
- `npm run verify` → parse guard, curriculum, stories, lessons, assessment bank,
  **173 tests, 0 fail**.
- `npm run validate:assessment:audio` → all 156 clips reachable.

## What the baseline actually showed

Both girls stopped at the first set. Neither met the advance rule
(recognition ≥6/8 **and** meaning ≥6/8 **and** comprehension ≥4/6):

| | recognition | meaning | comprehension | pinyin-supported | writing |
|---|---|---|---|---|---|
| 12:01 report | 8/8 | **4/8** | 6/6 | 8/8 | 4 unreviewed |
| 12:11 report | 7/8 | **3/8** | **2/6** | 8/8 | 4 unreviewed |

**The high numbers were inflated.** Bank 1.0.0 drew distractors as the first
three other words in list order, so later items offered three sounds that were
earlier items' *correct answers*: 40 of 128 audio items were answerable by
elimination. The domains that could be gamed scored near-perfect; the two that
could not scored near chance (2/8 is chance on a 4-option item). **Meaning and
comprehension are the trustworthy half**, and both are low.

The bank is now 1.1.0 and those routes are closed, so **the two baseline reports
are a snapshot, not a comparison baseline**. A fresh sitting on 1.1.0 is what
produces numbers worth tracking. Neither child has sat one.

## Locked decisions (do not re-litigate)

| Decision | Choice |
|---|---|
| Bands | Custom C1–C4. **Not** HSK 1–4, and never presented as such |
| Honesty bar | No overall "ability" score, no mastery flag, unreviewed writing is never zero |
| Assessment home | Its own screen, entered from the **profile-select** screen |
| Level unlock | All 22 gates of the level below. No grandfather clause |
| O05 | Same background story per dynasty, told at each level's difficulty |
| Ladder | HSK1 10 sentences, HSK2 15, HSK3 20, HSK4 25 |
| Firestore rules | Ship as a **merge fragment**, never a publishable ruleset |

## Shipped on this branch

Assessment moved to its own screen and costs no play time; report names the
child, names the sets, says why it stopped, shows answer pace, flags a domain at
chance, and exports to `assessment_<Name>_<date>_<sets>.json`. Handwriting can be
marked behind the parent PIN — the scorer always read `writingReviews` and
nothing ever wrote one. Starting set is choosable. Bank 1.1.0: foil pools, zero
eliminable items, 102 distinct distractor sets, and the unnatural Chinese fixed
(`今天天很好` → `今天天气很好`, `我很爱上山` → `我很喜欢爬山`, single-character
targets moved to the words people actually say). One bilingual definition per
named feature, with two tests holding it. One profile control, at the top of the
sidebar. Level unlock enforces the 22-gate rule and says so.

Stories carry a level, load from `data/stories/`, and **all 44 HSK1 stories are
on the ten-sentence ladder** — gates 1–11 extended, gates 12–22 rewritten
because their texts were HSK3/HSK4 vocabulary. 96 junk glosses fixed (822
corrections): the reader was showing `的` as "DE" and `习` as "-tice" on every
tap. The 22 HSK1 lessons are rewritten from their own gate's story and are
bilingual throughout.

## Next

1. **HSK2 stories** — 44 texts, 15 sentences, `content/stories/hsk2/`.
   `npm run build:stories` refuses any span the curated dictionary cannot vouch
   for; across 320 authored sentences it rejected 30, all words the curriculum
   does not teach. Then HSK3 (22 seeds already in `content/stories/hsk3/`) and
   HSK4.
2. **66 lessons** still on the old template. The 22 HSK1 ones are the model;
   `scripts/build_gate_lessons.js` shows the shape.
3. **A fresh assessment sitting on bank 1.1.0**, and enter the girls' 3-of-4
   handwriting against it.

## Blocked on the owner or on hardware

1. **Firestore rules not deployed.** `firestore.rules` is a merge fragment.
   Paste the marked block into the existing ruleset in the Firebase console,
   then run `node scripts/check_firestore_rules.js` (read-only probes). Until
   then both children's documents are readable and writable by anyone with the
   repo URL.
2. **Cloud sync never exercised** — this sandbox blocks the Firebase CDN, so
   `db` is null in every browser run. The CAS path is unit-tested against a stub.
3. **Not run on the girls' iPad.** Needed there: audio start and failure, overlay
   scrolling, backgrounding mid-question, next-day resume, profile switch during
   an attempt.
4. **No educator has reviewed the assessment bank.** Every item records
   `reviewerType: "model"`.

## Reference

```
repo    lxyzh1019-cyber/Chinese-Learning
branch  claude/chinese-adventure-audit-cont-xjxqpl
PR      #44 (draft)

npm run verify                      # everything, in order
npm run build:stories [level]       # content/stories/** -> data/stories/**
npm run build:lessons               # HSK1 lessons from each gate's story
npm run coverage:content            # what content exists behind the 88 gates
npm run validate:assessment:audio   # HEAD-checks all 156 clips
node scripts/backup_players.js      # READ-ONLY live backup

docs/content-coverage.md    O05 status and what remains, per level
docs/assessment-method.md   what the assessment can and cannot do
docs/implementation-status.md  per-requirement status + evidence
CLAUDE.md                   the blueprint
```

`backups/` is git-ignored and holds **real learner records** — never commit it.
