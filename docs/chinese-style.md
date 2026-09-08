# Writing the Chinese in this app

Every Chinese sentence here is read by a child who is still learning. Two rules
govern all of it — the assessment items, the story texts and the lesson
passages alike — and both exist because the app shipped violations of them.

---

## 1. Never bend a sentence to fit a target character

**The rule.** Write the sentence a native adult would actually say to a child.
If that sentence needs a two-character word, the **word** becomes the target and
the question asks about the word. Do not invent a phrasing so that a single
character can stand alone.

**Why.** The assessment's meaning items each test one target. Targets were
picked first as single characters, and sentences were then written around them.
That produced Chinese nobody says:

| Shipped | Fault | Now |
|---|---|---|
| `今天天很好` | missing 气 | `今天天气很好` |
| `我很爱上山` | 爱上山 is not idiomatic | `我很喜欢爬山` |
| `天上有月` | 月 alone is literary; the word is 月亮 | `天上有月亮`, target 月亮 |
| `我们吃米饭`, target 米 | the word in the sentence is 米饭 | target 米饭 |
| `你叫什么名字？`, target 名 | the word is 名字 | target 名字 |
| `这座城很大` | 城 alone is literary | `这座城市很大`, target 城市 |
| `教室里有一块板` | 板 alone is not used this way | `教室里有一块黑板`, target 黑板 |
| `门口挂着一块牌子`, target 牌 | the word is 牌子 | target 牌子 |
| `山顶上有很多雪`, target 顶 | the word is 山顶 | target 山顶 |

A target may be more than one character. Recognition, supported decoding and
writing-recall targets are the exception: those must stay **single tone-marked
syllables**, because they resolve to fixed audio clips.

## 2. A gloss is what the child reads, so it must be a meaning

**The rule.** Every token's gloss is a plain English meaning. Never a fragment
of a longer word's English, never a grammar code, never a dictionary artefact.

**Why.** 96 distinct junk glosses were being shown on every character tap. A
multi-character word's English had been split across its characters, and the
grammar carried linguists' codes:

| Class | Examples | Times shown |
|---|---|---|
| Half a word's English | 习 `-tice` (学习), 友 `-end` (朋友), 鼠 `-use` (老鼠), 兴 `-py` (高兴) | ~150 |
| Grammar code | 的 `DE`, 了 `CMPL`, 们 `PL`, 个 `CL`, 把 `BA`, 着 `ING`, 得 `ADV`, 子 `SUF` | ~370 |
| Dictionary artefact | 水 "surname Shui" (in the gate vocabulary) | 297 rows |

For grammar, say what the word **does**, in words a child can read:

```
的  of; belonging to        了  (shows it is finished)
们  (more than one)          个  (counting word)
把  (puts the object first)  着  (-ing, still going on)
```

For a character that is half of a longer word, give **that character's own**
meaning: 习 "to practise", 友 "friend", 鼠 "rat; mouse".

---

## Enforcement

These are not style suggestions; the build and the validators refuse them.

| Check | Where |
|---|---|
| No gloss starting `-`, no all-caps code, no "surname" gloss | `scripts/validate_stories.js` |
| Same, for lesson key vocabulary | `scripts/validate_lessons.js` |
| Junk-gloss filter on gate vocabulary | `scripts/validate_curriculum.js` |
| Balanced `“ ”` / `‘ ’` / `（ ）` / `《 》`, and no straight ASCII quotes | `scripts/validate_stories.js` |
| **A story is not built at all** if the curated dictionary cannot vouch for a span | `scripts/build_stories.js` |

That last one is the important one. `build_stories.js` stops and names the
character rather than inventing a reading. Across 320 newly authored HSK1
sentences it rejected 30 — every one a word the curriculum does not teach — and
each was rewritten with words it does. **Never hand-gloss a word to get past the
build.** Either use vocabulary the curriculum teaches, or declare a genuine
proper noun in the source file's `names` block (`大禹`, `马可·波罗`, `书圣`).

## Punctuation

Chinese text takes full-width marks: `，。！？：；“”‘’《》`. Straight ASCII
quotes are rejected. Gate 9 shipped `人们说他是"书圣，意思是…` — an opening quote
with no closing one — for as long as the story existed, because nothing checked.
