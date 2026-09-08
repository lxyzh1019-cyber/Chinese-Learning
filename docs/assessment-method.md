# Assessment method

What the assessment measures, how it scores, and — as importantly — what it
cannot tell you. Version **1.1.0** of the bank: bands C1–C4, forms A and B.

## What it is

A small, repeatable sample of reading and understanding, taken inside the app.
It is **not** a placement test, not a mastery percentage, and not an HSK result.
It has no stars, no timer pressure, no gate effects and no deadline.

## The five measures

| Domain | What the child does | What it shows |
|---|---|---|
| Unaided character recognition | Sees a character, chooses between four **spoken** options | Whether the character alone maps to a sound. Not proof the child pronounced anything. |
| Supported decoding | Sees the character **plus pinyin**, chooses the spoken form | How much the child leans on pinyin. Does **not** qualify them for a reading band. |
| Meaning in context | Reads a short sentence, picks what one word means there | Concrete, common senses only — no obscure dictionary meanings. |
| Passage comprehension | Reads a short Chinese text, answers literal, reference/sequence and inference questions | Understanding of connected text. No read-aloud, no translation before answering. |
| Writing from recall | Hears a prompt and writes the character with no model shown | Handwriting recall. **Never auto-scored.** |

Recognition and supported decoding deliberately use **disjoint target words**, and
decoding always comes after the unaided sections, so pinyin cannot coach an
answer the child has already given unaided. The validator enforces both.

## What changed in 1.1.0, and what it costs

Bank 1.0.0 chose an item's wrong options as "the first three other words in list
order". So from the fifth item of a section onward, all three wrong options were
the **correct answers of earlier items**, and a child who had answered those
could take the remaining option without reading the character. **40 of the 128
audio items were answerable that way**, and the whole bank held only 32 distinct
distractor sets, so a section also felt like one question asked eight times.

That is not a small scoring wrinkle. Unaided recognition is one of the three
domains that decide routing, and it was the domain most easily gamed. In the
first live sitting, both children scored 8/8 and 7/8 on recognition and 8/8 on
supported decoding, beside 4/8 and 3/8 on meaning — which has fresh distractors
per item and cannot be eliminated. **The meaning and comprehension figures are
the trustworthy half of that report.**

1.1.0 gives each band twelve foil sounds used **only** as wrong options and
disjoint from every target in the bank, drawn per item by a seeded shuffle: no
item is answerable by elimination, and the bank holds 102 distinct distractor
sets. Three checks in `scripts/validate_assessment.js` keep it that way, and
they were confirmed by reintroducing the original defect and watching them fail.

1.1.0 also rewrites the Chinese. Sentences had been bent to force a single
target **character** into them — `今天天很好` is missing 气, `我很爱上山` is not
something anyone says. Where the natural sentence needs a two-character word,
the word is now the target. See `docs/chinese-style.md`.

**The cost.** Attempts record their `bankVersion`, and `compareAttempts` refuses
to diff across versions — it reports *not directly comparable* rather than
producing a difference. So the two sittings taken on 1.0.0 are a **standalone
snapshot, not a baseline**: nothing taken later can be measured against them. A
fresh sitting on 1.1.0 is what produces numbers worth tracking over time. This
is stated rather than papered over, because a comparison across a changed
instrument would be the more misleading option.

## Scoring rules

- `I don't know` is recorded as a **wrong** answer.
- Save & exit, a clip that fails to play, a technical fault or time running out
  leave the item **unanswered** — never wrong. A broken asset must not become a
  bad score.
- A percentage is produced **only for a completed domain**. Partial work reports
  accuracy over what was actually submitted, explicitly flagged as partial.
- There is **no overall score**. No single number for "Chinese ability" is
  defensible from samples this size, so none is shown.
- Unreviewed handwriting is **unassessed, not zero**. The reading report is
  available while writing waits for a reviewer. A reviewer marks each character
  against the shipped `writing-recall-v1` rubric (0 unrecognisable / 1
  recognisable but inaccurate / 2 correct form) from the report, behind the
  parent PIN; a score of 2 counts as correct. Until 1.1.0 there was no way in
  the app to record a review at all, so every report said "waiting for a
  grown-up" permanently.
- **Answer pace is reported, and a domain at chance is labelled.** Each item's
  presentation and response are timestamped, so the report shows a median time
  per answer, and a completed domain scoring at or below what random guessing
  gives on four options says so in plain words. Neither is a verdict; both are
  there because a score at chance and a score earned slowly are different
  events.

## Routing between bands

Advance is offered only when **all three** of unaided recognition (≥6/8),
meaning (≥6/8) and comprehension (≥4/6) are met. Supported decoding and writing
never affect routing.

These thresholds choose which block of questions to sample next. They are a
product default, **not** a pass/fail diagnosis and not a statistical standard.
A recommended band is provisional and should be confirmed by ordinary learning
evidence over time.

A set can also be **chosen** rather than always starting at the first one.
Every band is scored on its own items, so starting higher borrows no credit — it
only skips the easier evidence, and the report records which sets were sampled.

All four bands exist. A child who clears C1 is offered C2, and so on to C4;
each band is scored on **its own** items, so a strong C1 can never carry a weak
C2. After C4 the report states the ceiling has been reached rather than
implying anything beyond it.

Stopping is always allowed. A child who declines the next set keeps a complete
report for the bands they did finish.

## Audio, and its honest limit

Unaided recognition and supported decoding use **fixed recorded clips**, keyed
by tone-marked syllable, so those items sound identical on every device and
every attempt — in every band, not just the easiest one. All 108 clips the bank
references are checked for reachability by `npm run validate:assessment:audio`.

Everything else falls back to the device's own speech synthesis, which differs
between devices, browsers and installed voices. Where that applies, comparison
across attempts carries a stated caveat and the report says so in plain words.

Neutral-tone characters (的 了 地 呢 们) are **excluded** from audio items in
every band: the app's clip-key derivation forces a neutral tone to first tone,
which would play a wrong reading. Tracked as B02i. Polyphonic characters
(都 还 行 长 重 …) are excluded too — a bare character gives no context to say
which reading is being asked for.

## Comparing attempts

Three explicitly labelled options:

1. **Same questions again** — identical items and identical option order.
   Flagged, because scores can rise from familiarity alone.
2. **Matched set** — the A/B counterpart, same blueprint and support conditions.
   Labelled *matched-form, provisional*: the forms are designed to match, they
   are not statistically equated.
3. **Next band** — reported separately so it cannot inflate the comparison.

Repeated **anchor** items are always reported separately from fresh ones, with
sample sizes. Improving on a question already seen is not evidence of general
learning. Attempts on different bank versions report *not directly comparable*
rather than producing a difference.

## What it cannot do

- It cannot verify pronunciation. Choosing a spoken option is recognition, not
  speech.
- It cannot grade handwriting, and no stroke order can be judged from a
  finished image.
- It cannot be averaged across Jenn and Jess, and does not rank them.
- It cannot certify an HSK level.

## Limitations of this release

- **Content is model-reviewed, not educator-certified.** Every item records
  `reviewerType: "model"`. That is a truthful label, not a validity claim.
- **Cloud sync is unverified in practice.** The browser walkthrough ran with the
  Firebase CDN blocked, so only local persistence was exercised end to end.
- **Not yet run on the girls' actual iPad.** See `docs/implementation-status.md`
  for the manual checks that remain.
