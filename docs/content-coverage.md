# Content coverage


Gates: 88  (4 levels x 22 dynasties)

## Stories
- Authored stories: **44**
- Distinct story pairs across all 88 gates: **22**
- By level: HSK1 44 · HSK2 0 · HSK3 0 · HSK4 0 (44 per level is complete)
- Levels HSK2, HSK3, HSK4 have no text of their own yet, so those gates fall back to the HSK1 telling and the reader says so.
- Study characters per story: min 57, median 81, max 104
- Sentences per story: 10
- Decision **O05**: partly met — stories carry a level and HSK1 is on its ladder; the levels listed above are still to be written.

## Lessons
- Lesson files: **88** (HSK1, HSK2, HSK3, HSK4, 22 each)
- Passages that are a vocabulary list plus instructions, not a text: **44** (50%)
- Lessons carrying at least one question about the lesson rather than the text: **44**
- Lessons with a question missing its answer: **0**

| Level | Lessons | Word-list passages | Meta questions | Passage chars (min/med/max) |
|---|---|---|---|---|
| HSK1 | 22 | 0 | 0 | 42 / 51 / 69 |
| HSK2 | 22 | 0 | 0 | 29 / 41 / 75 |
| HSK3 | 22 | 22 | 22 | 106 / 131 / 136 |
| HSK4 | 22 | 22 | 22 | 105 / 131 / 136 |

## Gate vocabulary
- hsk1: 22 gates, 793 served rows, 0 with no English meaning
- hsk2: 22 gates, 793 served rows, 0 with no English meaning
- hsk3: 22 gates, 793 served rows, 0 with no English meaning
- hsk4: 22 gates, 793 served rows, 0 with no English meaning

---

## What this means for decision O05

**O05 is now partly met, and the shape of the remaining work is fixed.**

Before: a dynasty carried `story`/`story2` with no level dimension, so `h1-g01`
and `h4-g01` served the same 大禹治水 and only the lesson, the vocabulary and
the quiz changed. The corpus was graded along the **wrong axis** — difficulty
tracked the dynasty's position in history rather than the learner's level, and
the HSK1 share of a gate's story characters ran from 36% to 85%.

Now:

- Stories are keyed `<base>-h<level>` and load from `data/stories/hsk{lv}.json`.
- **All 44 HSK1 stories are on the ten-sentence ladder.** Gates 1–11 were
  extended; gates 12–22 were **rewritten**, because their original texts used
  HSK3/HSK4 vocabulary (帝国, 繁荣, 挣扎, 现代化) and lengthening them would have
  made them longer rather than level-appropriate. Those dense originals are kept
  under `content/stories/hsk3/` as seeds for that level.
- A level with no text of its own serves the HSK1 telling **and says so in the
  reader**, naming the level whose words, lesson and quiz the child is getting.
  Silently serving another level's text was the defect; the fallback is the
  honest form of "the story is shared", and it means partial content is never
  broken content.
- Reads and completions count under the per-level id, so each level earns its
  own reading gate rather than inheriting level 1's.

**Ladder** (owner decision): HSK1 10 sentences, HSK2 15, HSK3 20, HSK4 25.
Study-token ranges in `scripts/validate_stories.js` are derived from the built
corpus, not guessed — natural HSK1 prose runs a median of 8.1 study tokens per
sentence.

### Remaining

| | stories | lessons |
|---|---|---|
| HSK1 | done — 44 on the ladder | done — 22 rewritten, bilingual, drawn from the gate's story |
| HSK2 | 44 to write, 15 sentences | 22 still on the old template |
| HSK3 | 44 to write, 20 sentences (22 seeded) | 22 still on the old template |
| HSK4 | 44 to write, 25 sentences | 22 still on the old template |

Authoring runs through `content/stories/hsk{lv}/` and `npm run build:stories`.
The build **refuses** to emit a story containing a span the curated dictionary
cannot vouch for — it stops and names the character rather than inventing a
reading or a gloss. Across 320 newly authored sentences it rejected 30, every
one of them a word the curriculum does not teach; all were rewritten with words
it does.

## Glosses shown in the reader

96 distinct junk glosses were being shown to a child on every character tap,
and are fixed. A longer word's English had been split across its characters —
学习 "practice" leaving 习 as `-tice`, 朋友 "friend" leaving 友 as `-end`, 老鼠
"mouse" leaving 鼠 as `-use` — and the grammar carried linguists' codes: 的 was
`DE` (196 times), 了 was `CMPL` (110), plus `PL`, `CL`, `BA`, `ING`, `ADV`,
`SUF`. This is the same class as the 水 "surname Shui" vocabulary defect, in the
one place the app teaches meaning directly. 822 glosses were corrected across
all 44 sources, and `validate_stories.js` now rejects a fragment, a grammar code
or a surname gloss outright.

## Lesson passages

The 22 HSK1 lessons are rewritten and are the model for the rest: the passage is
the gate's own story opening, the eight key words are words the child meets in
it, and each question points at a sentence that is actually there. Every
instruction, question and answer carries both languages, because these two
readers read English far better than Chinese and a Chinese-only instruction is
not an instruction. The passage stays Chinese with its English behind a toggle.

66 lessons remain on the old template — the gate's vocabulary list wrapped in
instructions, asking 本关有几个生字？ `validate_lessons.js` reports the count on
every run.
