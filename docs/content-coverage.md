# Content coverage

Gates: 88  (4 levels x 22 dynasties)

## Stories
- Authored stories: **44**
- Distinct story pairs across all 88 gates: **22**
- So every gate on levels 2-4 shows the **same text** as the level-1 gate with the same dynasty.
- Study characters per story: min 19, median 32, max 72
- Sentences per story: 5
- Decision **O05** ("texts increase in difficulty with the selected level") is **not met by story content**.

## Lessons
- Lesson files: **88** (HSK1, HSK2, HSK3, HSK4, 22 each)
- Passages that are a vocabulary list plus instructions, not a text: **66** (75%)
- Lessons carrying at least one question about the lesson rather than the text: **66**
- Lessons with a question missing its answer: **0**

| Level | Lessons | Word-list passages | Meta questions | Passage chars (min/med/max) |
|---|---|---|---|---|
| HSK1 | 22 | 22 | 22 | 100 / 127 / 132 |
| HSK2 | 22 | 0 | 0 | 29 / 41 / 75 |
| HSK3 | 22 | 22 | 22 | 106 / 131 / 136 |
| HSK4 | 22 | 22 | 22 | 105 / 131 / 136 |

## Gate vocabulary
- hsk1: 22 gates, 793 served rows, 0 with no English meaning
- hsk2: 22 gates, 793 served rows, 0 with no English meaning
- hsk3: 22 gates, 793 served rows, 0 with no English meaning
- hsk4: 22 gates, 793 served rows, 0 with no English meaning

Regenerate with `npm run coverage:content`. Read-only.

---

## What this means for decision O05

**O05** — "texts increase in difficulty with the selected level" — is **not met**.

The reader has no level dimension at all. A dynasty carries `story` and `story2`,
and `openStory` serves those two regardless of which HSK tab the child is on. So
`h1-g01`, `h2-g01`, `h3-g01` and `h4-g01` all show the same 大禹治水. The lesson
JSON *is* per level, which is why the gap has stayed invisible: the lesson text
changes, the story does not.

The corpus is graded, but along the **wrong axis**. Difficulty tracks the
dynasty's position in history, not the learner's level:

| | avg study characters per gate |
|---|---|
| gates 1–5 (Xia → Qin) | 53 |
| gates 18–22 (Yuan → Republic) | 86 |

And the share of a gate's story characters that fall inside the HSK1 set ranges
from 36% to 85% with a median of 64% — so a child on HSK1 already meets texts
where a third of the characters are outside their level, purely because the Qing
dynasty comes late in the road.

553 distinct characters appear across the 44 stories; 181 of them are HSK1 and
299 are HSK1-or-2.

### The options, and what each costs

**A. Author 132 new stories** (44 exist, 176 needed for 4 levels × 22 dynasties ×
2 stories). Fully meets O05. Every story is hand-tokenized `{t, ch, py, mn, bonus}`
with per-character pinyin and gloss — this is the real cost, and at ~32 study
characters each it is a large authoring job, not a generation job. The existing
44 are good; matching their quality four times over is the expensive path.

**B. Re-level the 44 that exist.** Keep one story pair per dynasty, but stop
pretending the level tabs change the reading. Assign each existing story the
level its vocabulary actually supports (the HSK1-share numbers above give the
ordering), and let the level tabs differ in the lesson, the vocabulary and the
quiz — which they already do — while the story is shared. Costs nothing to
author; requires saying plainly in the UI that the story is the same text.

**C. Author one new story per dynasty for the upper levels** (22 new stories,
serving levels 3–4 as a pair with the existing one). A middle path: the jump from
HSK1/2 to HSK3/4 is where a shared text is least defensible, and 22 is a
tractable authoring target.

**D. Generate difficulty variants of the existing 44.** Same narrative, simplified
or elaborated per level. Cheapest per story, but the tokenization still has to be
correct per character, and a machine-simplified Chinese text for a child is
exactly the kind of content this project has already been burned by — the gate
vocabulary was generated the same way and shipped 水 glossed "surname Shui".

**Recommendation: C, then B for what C does not cover.** It puts new authoring
where the mismatch is worst, keeps the existing quality bar, and does not commit
to 132 hand-tokenized texts before the girls' baseline says which levels they will
actually reach this year. If the baseline lands at C1/C2, option B alone is
defensible for a while and C can wait.

This is an owner decision — it changes what content exists, not how the app
behaves — so nothing here is implemented.

## Lesson passages

66 of the 88 lessons have a "passage" that is not a passage: it is the gate's
vocabulary list wrapped in instructions, e.g.

> 第10关：今天的新词有：内容、上面、痛、感情…（共14个生字）。复习字有：状态、群…（共24个）。请你先听一听（或请家长读一遍），再自己大声读两遍。

and its three questions ask about the lesson rather than about any text —
"本关有几个生字（新词）？" → "14个。" Until T02 these were not even displayed;
the renderer printed three hard-coded English substitutes instead. They are
displayed now, which makes the placeholder visible rather than hidden, and that
is the right order: you can see what needs writing.

The 22 HSK2 lessons are the exception — they carry short real passages (29–75
characters) with real comprehension questions. They are the model for what the
other 66 should become.
