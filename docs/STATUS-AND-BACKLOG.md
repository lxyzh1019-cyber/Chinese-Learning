# Chinese Adventure — status and backlog

Last updated 2026-09-08. This is the standing hand-off document: what is
built and proven, what is left, and what is blocked on someone other than
the next engineer. It supersedes `docs/NEXT-SESSION.md` as the entry point.

Companion documents:
- `CLAUDE.md` — the blueprint: design rules (Part A) and architecture (Part B)
- `docs/implementation-status.md` — the requirement ledger, row by row
- `docs/content-coverage.md` — what content exists behind the 88 gates
- `docs/chinese-style.md` — the naturalness rules for authored Chinese
- `docs/assessment-method.md` — how the assessment measures and what it will not claim

---

## Where the project stands

| Dimension | Done | Share |
|---|---|---|
| Engineering requirements (`implementation-status.md`) | 26 of 28 rows verified | **93%** |
| Story texts | 88 of 176 authored (HSK1 44 · HSK2 44 · HSK3 0 · HSK4 0) | **50%** |
| Lessons rewritten from their gate's story | 44 of 88 | **50%** |
| Lessons with marked questions (options + explanation) | 44 of 88 · 132 questions | **50%** |
| Curriculum vocabulary | 1,599 words across 4 levels, ordinary-word gap closed | **done** |

The two unverified requirement rows — **O05** (level-graded stories) and
**T05** (lesson passages drawn from the gate's story) — are partial only
because HSK3 and HSK4 have no text yet.

**This share is a row count in our own ledger, not independently verified
functional completion.** A third-party re-audit on 2026-09-08 found four
correctness defects in rows that were already marked `verified` — two in
assessment sync, two in retention — and a green 240-test suite had missed all
four, because no test held an upload open while the attempt changed, and none
crossed the review round's retry path with its save/resume path. They are fixed
and the reproductions are in the suite (`A26-R01`…`A26-R04`), but the lesson is
that `verified` here means "we have a test", not "an outsider could not break
it". Live Firestore, a two-device run and the children's iPad remain
unexercised.

**Blended: roughly 70%.** The plan called content "the bulk of the work",
and content is the half that is at 50%.

Verification on every change:

```
npm run verify   # parse guard + curriculum + stories + lessons + assessment bank + 271 tests
```

Browser runs are not optional (`CLAUDE.md` §9.5). Unit tests have twice
missed defects a real Chromium pass caught, including a migration skip that
would have erased every completion.

---

## What has been done

### The 88-gate model
A gate is a **(level, dynasty)** pair keyed `h{level}-g{NN}`, not a dynasty
number. Before this, clearing gate 1 showed as cleared on all four HSK tabs and
`ensureState` discarded any dynasty id above 22, so 88 gates were structurally
impossible. Migration runs in two independently-triggered phases (gate identity,
story ids) because a save can need one and not the other; gating both on one
version stamp would have deleted every completion.

### Level gating means what it says
HSK2 opens when all 22 HSK1 gates are cleared. The old rule derived a "current
level" from a running total at 5/11/17, which cannot survive a per-level model,
and `legacyLevelAccess` was a second, invisible route to the same place. It no
longer opens anything, and the parent panel says so rather than a tab silently
disappearing.

### Content
- **88 stories on the ladder** — HSK1 at 10 sentences, HSK2 at 15, the same
  background story per dynasty told at each level's difficulty. Gates 12–22 were
  rewritten rather than extended, because their texts used HSK3/HSK4 vocabulary.
- **The build refuses to guess.** `build_stories.js` stops and names any span
  the curated dictionary cannot vouch for. Across 980 authored sentences it
  rejected 66; all were rewritten with words the curriculum teaches.
- **44 lessons rebuilt** from their own gate's story, bilingual throughout —
  the instructions had been Chinese-only, which these two readers cannot use.
- **1,283 junk glosses fixed.** The reader was showing children a longer word's
  English cut in half (学习 "practice" leaving 习 as `-tice`) and linguists'
  grammar codes (的 = `DE`, 196 times). Both leading and trailing forms are now
  refused at the dictionary boundary and in both validators.
- **399 ordinary words added** — the curriculum's 300-word frequency cut had
  dropped 姐姐, 天气, 再见, 星期, 米饭, 左边, 九 and 零 while keeping 法官 and
  武器, so the app could not teach them anywhere.

### The assessment
Its own screen, entered per child from profile select, awarding no stars and
starting no play timer. Bank 1.1.0 closed a guessing route that made 40 of 128
audio items answerable by elimination. Reports name the child, say why routing
stopped, and label unreviewed writing `Not independently verified` — never zero.

### The third-party audit (2026-09-08)
Eight findings, all reproduced, six fixed — one commit each, with the
regression case written first. See the audit ledger at the end of
`docs/implementation-status.md`. In short: a round that outlives its deadline
is practice, not credit (F01); a sync can no longer undo a reset or erase a
device's review history (F02); an assessment in progress is continued on the
device that started it and every device sees the history (F03); reports are
scored on the bank they were taken with and a repeat really is the same
questions, with a before-and-after screen (F04); **"Review today"** puts the
retention schedule in front of the child (F05); lesson answers hide until the
child has had a go (F06). F07 and F08 are content work and stay in the backlog
below.

### Correctness work
Five surfaces were asking questions with **two right answers**: every builder
excluded its answer by spelling where a child compares meaning. Measured on the
real curriculum and now zero. See the Q01–Q05 rows in
`docs/implementation-status.md`.

---

## Backlog

Ordered by what it costs a child today.

### 1. Firestore rules are not deployed — **security, owner action**
`firestore.rules` is a **merge fragment, not a publishable ruleset**: the
Firebase project serves other apps whose paths are not visible from this repo,
so publishing a whole ruleset authored here would lock them out.

Until the marked block is pasted into the Firebase console, **both children's
documents are readable and writable by anyone with the repo URL.** Afterwards
run `node scripts/check_firestore_rules.js`, which probes read-only and cannot
leave junk behind.

*Cannot be done from a sandbox. Two minutes in the console.*

### 2. Parent PIN is still `1234`
`index.html`, `PARENT_PWD`. It is also the session-timer override, so it is what
stands between a child and unlimited play time. Change before this is something
they use daily.

### 3. HSK3 and HSK4 stories — 88 texts
20 sentences at HSK3, 25 at HSK4, same background story per dynasty. 22 HSK3
seeds are staged in `content/stories/hsk3/` from the original dense texts.
Author into `content/stories/hsk{lv}/`, then `npm run build:stories <lv>`.

Once a level has its own texts the reader's "you are reading the HSK1 telling"
note disappears for those gates automatically — no code change.

### 4. HSK3 and HSK4 lessons — 44
`scripts/build_gate_lessons.js` takes a level. `validate_lessons.js` prints the
outstanding count on every run. Blocked on item 3: a lesson is drawn from its
gate's story, so the story has to exist first.

### 5. Five pre-existing sense collisions inside a gate
Two words in the same gate carrying a gloss a child reads as identical:

| | |
|---|---|
| HSK1 gate 8 | 看到 "to see" / 见 "to see" |
| HSK1 gate 16 | 子 "son" / 儿子 "son" |
| HSK2 gate 6 | 完全 "complete; whole" / 全 "whole; all" |
| HSK4 gate 3 | 法 "law; method" / 法律 "law" |
| HSK4 gate 4 | 项 "item; project" / 项目 "item" |

**Not currently harmful**: `sharesSense` stops either from appearing as a wrong
option, so no child is scored wrong. But it does that by dropping the colliding
word from the option set, which quietly narrows the pool. Better glosses would
be a real fix rather than a guard. The supplement added in this cycle introduces
none of its own.

### 6. Cloud sync has never been exercised
The sandbox blocks the Firebase CDN, so `db` is null in every browser run to
date. The player compare-and-set, the event-sourced merge, and now the
assessment's transactional push, cloud hydrate and reconnect flush are all
unit-tested against a stub only. **The first real two-device session will be
running untested code.** Test deliberately: same child on two devices, both
offline, both earning stars, then both back online; then an assessment paused
on one device and opened on the other (it should be listed, not resumable).

### 7. Nothing has run on the girls' iPad
Specifically unexercised: audio start and failure, overlay scrolling,
backgrounding mid-question, next-day resume, and a profile switch during an
assessment attempt.

### 8. No educator has reviewed the assessment bank
Every item records `reviewerType: "model"`, which is the honest label and the
release gate — not a validity claim. **A different AI model reviewing it does
not change this label**, and recording one as an educator review would make the
report say something untrue. What a model review can honestly do is act as a
drafting check before a human looks: flag unnatural phrasing, ambiguous items,
mis-keyed answers. Log it as a model check, not as review.

### 9. No fresh sitting on bank 1.1.0
The two baseline reports were taken on 1.0.0, whose guessing route inflated
recognition and pinyin. Bank 1.0.0 is no longer shipped, so those two reports
now show "taken on a bank that is no longer available" rather than being
rescored on 1.1.0 — **there is currently no comparison baseline.** One sitting
per child on 1.1.0, then "Repeat same questions" later, produces the first
before-and-after the app can show.

### 9b. Lesson answer options — content
Lesson comprehension is think-then-reveal with a self-report. Real marking
needs reviewed answer choices for the 44 substantive lessons (and the 44 still
to be written). Author them with the HSK3/4 work.

### 10. Curriculum: words with no standalone HSK entry
同 is taught only inside compounds (同学, 同意, both now present). If authored
prose needs a bare 同, it must be added deliberately rather than by relaxing the
story build's refusal to guess.

---

## Rules that must not be quietly dropped

These are in `CLAUDE.md` in full; they are the ones most easily lost.

1. **Never shame a wrong answer** (§1). Badges and toasts celebrate effort.
2. **Full round or zero stars** (§2). Gate the star calculation behind "the
   round ended naturally", never behind a minimum sample size.
3. **A wrong option must never be secretly right** (§9.6). Exclude on what makes
   the answer identifiable in *that* question — for an audio prompt that is the
   sound, not the English.
4. **Measure on the real curriculum, not a fixture.** Every rate in the Q01–Q05
   rows came from building the questions all 88 gate word lists produce.
5. **A test must compute its own comparison.** A test that calls the function
   under test moves with the defect and cannot fail. This has bitten three
   times, most recently in the test written to catch it.
6. **Never take `meanings[0]` from an upstream word list.** It is a surname, a
   grammar code, or an obscenity often enough that it must be hand-checked.
7. **Say so when the UI was not run.** Do not report success from unit tests
   alone.
