# Content review ledger — assessment bank v1.0.0

Every item in the C1 bank is hand-authored. This records where the content came
from, what was changed, and what remains unresolved.

## Reviewer status — read this first

All 60 items carry `review.reviewerType: "model"`. That means **I** authored and
cross-checked them. It is **not** a certified educator review, and the field is
deliberately truthful rather than flattering. Treat the bank as a careful draft
that a Chinese teacher should still read before the results are used for any
decision beyond "what should we practise next".

## Source, and why the data was not used directly

Band membership — which words count as C1 — comes from the HSK 3.0 `new-1` list
already in `data/hsk1.json` (via `drkameleon/complete-hsk-vocabulary`).

**Nothing else** was taken from that file. Its readings and glosses are not
reliable enough for assessment content, and using them would have produced items
that are simply wrong. Defects confirmed in `words[]` — the cleaner of the two
arrays — while selecting C1 targets:

| Character | Data says | Correct | Consequence if used |
|---|---|---|---|
| 听 | `yǐn` | `tīng` | Audio would play a completely different syllable |
| 上 | `shǎng` | `shàng` | Wrong tone, wrong clip |
| 看 | `kān` | `kàn` | Wrong tone; gloss "to look after" not "to look" |
| 吗 | `má` | `ma` | Wrong tone on a neutral-tone particle |
| 打 | `dá` "dozen" | `dǎ` "to hit" | Loanword sense taught as the default |
| 着 | `zhāo` "(chess) move" | `zhe` aspect marker | Obscure sense as the beginner default |
| 等 | `děng` "class" | "to wait" | Wrong sense |
| 跟 | `gēn` "heel" | "with; to follow" | Wrong sense |
| 太 | `tài` "highest" | "too; very" | Wrong sense |
| 书 / 日 / 新 / 中 | capitalised proper-noun pinyin | lower-case common reading | Proper-noun sense as default |

Adult dictionary phrasing is pervasive even where the sense is right — `是` is
glossed *"to be (followed by substantives only)"*, `你` as *"you (informal, as
opposed to courteous 您)"*. Unusable as child-facing answer options.

**Therefore:** every reading and every English string in the bank was authored
here. `scripts/build_assessment_bank.js` holds the curated table, so the content
is reviewable in one place and the JSON is regenerable.

## What was authored

| Domain | Distinct items | Targets |
|---|---|---|
| Unaided recognition | 14 | Single-character, tone-marked, concrete: 水 山 人 大 小 好 天 家 门 车 手 口 花 月 |
| Supported decoding | 14 | Disjoint from recognition by design: 吃 走 喝 说 学 白 高 快 冷 热 老 爱 笑 早 |
| Meaning in context | 14 | Short authored sentences; concrete common senses only |
| Passage comprehension | 11 questions over 3 passages | p1 (form A), p2 (**anchor, unchanged in both forms**), p3 (form B) |
| Writing recall | 7 | Familiar characters chosen for handwriting, not every reading target |
| **Total** | **60** | 34 per form, 8 shared anchors |

Passage lengths sit inside the C1 authoring target of 25–50 Chinese characters.
These are custom authoring targets, not official HSK standards.

## Deliberate exclusions

- **Neutral-tone characters** (的 了 地 呢 们) are excluded from audio items.
  The app derives `de → de1`, forcing a first tone that does not exist for these
  words. Excluding them was cheaper and more honest than shipping a wrong
  reading. Revisit when B02i is fixed.
- **Polyphonic characters** (长, 都, 还, 行) are excluded entirely from C1: a
  single-character audio item has no context to disambiguate the reading.
- **Grammatical particles** are excluded from meaning items — asking a child
  what 的 "means" in isolation is not a fair question.

## Unresolved

- No educator has reviewed this bank.
- C2, C3 and C4 are not authored. Routing reports the C1 ceiling honestly rather
  than implying anything about harder material.
- The 3 passages are short and few; passage comprehension is the thinnest domain
  in the bank and its 6-question sample is the least reliable number in the
  report.
- Distractors were authored for plausibility by hand. They have not been
  item-analysed against real responses, because there are no real responses yet.
