# Content review ledger — assessment bank v1.0.0

Every item in the bank (C1–C4) is hand-authored. This records where the content came
from, what was changed, and what remains unresolved.

## Reviewer status — read this first

All 240 items carry `review.reviewerType: "model"`. That means **I** authored and
cross-checked them. It is **not** a certified educator review, and the field is
deliberately truthful rather than flattering. Treat the bank as a careful draft
that a Chinese teacher should still read before the results are used for any
decision beyond "what should we practise next".

## Source, and why the data was not used directly

Band membership — which words belong to which band — comes from the HSK 3.0
lists already in `data/hsk1.json` … `data/hsk4.json` (via
`drkameleon/complete-hsk-vocabulary`): C1↔HSK1, C2↔HSK2, C3↔HSK3, C4↔HSK4.
Note HSK2 in this dataset already borrows 103 words from HSK3, so these are
custom bands referencing HSK, not HSK levels.

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

Per band: 14 unaided recognition, 14 supported decoding (targets disjoint from
recognition), 14 meaning-in-context, 11 passage questions over 3 passages, and
7 writing prompts — 60 distinct items, 34 per form, 8 shared anchors.

| Band | Recognition targets | Decoding targets | Passage length (authored / target) |
|---|---|---|---|
| C1 | 水 山 人 大 小 好 天 家 门 车 手 口 花 月 | 吃 走 喝 说 学 白 高 快 冷 热 老 爱 笑 早 | 32–33 / 25–50 |
| C2 | 狗 马 米 药 店 眼 脸 心 头 红 名 信 卡 停 | 让 带 完 接 拉 讲 卖 选 换 懂 办 留 收 靠 | 68–69 / 50–80 |
| C3 | 牛 火 刀 猪 龙 金 城 光 皮 香 图 板 室 钟 | 抓 挂 跳 追 破 传 输 配 演 建 修 退 付 升 | 90–94 / 80–120 |
| C4 | 梦 冰 牌 箱 牙 兵 货 季 盘 顶 户 苦 梯 岸 | 抱 醒 冲 翻 烧 抽 戴 摆 躺 擦 贴 脱 挑 吸 | 131–141 / 120–180 |

**Total: 240 distinct items, 32 shared anchors, 12 passages.** Every passage
sits inside its band's authoring target. Those targets are custom, not official
HSK standards; difficulty also depends on vocabulary familiarity and sentence
structure, which the character count does not capture.

## Deliberate exclusions

- **Neutral-tone characters** (的 了 地 呢 们) are excluded from audio items in
  every band. The app derives `de → de1`, forcing a first tone that does not
  exist for these words. Excluding them was cheaper and more honest than
  shipping a wrong reading. Revisit when B02i is fixed.
- **Polyphonic characters** (长 都 还 行 重 乐 只 更 差 少 空 教 数 分 为 过 种 当 相 便 假 觉 散 卷) are
  excluded from every band's audio items: a bare character gives no context to
  say which reading is being asked for.
- **Grammatical particles** are excluded from meaning items — asking a child
  what 的 "means" in isolation is not a fair question.

## Unresolved

- No educator has reviewed this bank.
- Passage comprehension remains the thinnest domain: 6 scored questions per
  band-form over 2 passages. It is the least reliable number in any report, and
  a band decision resting on it alone should be treated with caution.
- Higher bands lean on single characters for the audio domains because those
  are the only targets with deterministic clips. Real C3/C4 vocabulary is
  largely multi-syllable, so those two domains sample a narrower slice of the
  band than the meaning and passage domains do.
- Distractors were authored for plausibility by hand. They have not been
  item-analysed against real responses, because there are no real responses yet.
