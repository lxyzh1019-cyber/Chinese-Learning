# Assessment method

What the assessment measures, how it scores, and — as importantly — what it
cannot tell you. Version 1.0.0 of the bank, C1 band only.

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
  available while writing waits for a reviewer.

## Routing between bands

Advance is offered only when **all three** of unaided recognition (≥6/8),
meaning (≥6/8) and comprehension (≥4/6) are met. Supported decoding and writing
never affect routing.

These thresholds choose which block of questions to sample next. They are a
product default, **not** a pass/fail diagnosis and not a statistical standard.
A recommended band is provisional and should be confirmed by ordinary learning
evidence over time.

Only C1 exists in this bank. When C1 is passed the report says the ceiling has
been reached rather than implying anything about untested harder material.

## Audio, and its honest limit

Unaided recognition and supported decoding use **fixed recorded clips**, keyed
by tone-marked syllable, so those items sound identical on every device and
every attempt. All 28 clips used by the C1 bank are checked for reachability by
`npm run validate:assessment:audio`.

Everything else falls back to the device's own speech synthesis, which differs
between devices, browsers and installed voices. Where that applies, comparison
across attempts carries a stated caveat and the report says so in plain words.

Neutral-tone characters (的 了 地 呢 们) are **excluded** from audio items: the
app's clip-key derivation currently forces a neutral tone to first tone, which
would play a wrong reading. Tracked as B02i.

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

- **C1 only.** C2–C4 are not authored yet.
- **Content is model-reviewed, not educator-certified.** Every item records
  `reviewerType: "model"`. That is a truthful label, not a validity claim.
- **Cloud sync is unverified in practice.** The browser walkthrough ran with the
  Firebase CDN blocked, so only local persistence was exercised end to end.
- **Not yet run on the girls' actual iPad.** See `docs/implementation-status.md`
  for the manual checks that remain.
