#!/usr/bin/env node
"use strict";
/**
 * Build the assessment bank (all bands, forms A and B) from curated content.
 *
 * Every target here is HAND-AUTHORED, not pulled from data/hsk*.json. The
 * curriculum data carries wrong readings for a meaningful share of exactly the
 * characters an assessment would want (听 as "yǐn", 上 as "shǎng", 看 as "kān",
 * 书/日/新/中 with capitalised proper-noun pinyin), and adult dictionary
 * glosses throughout. Membership of the HSK1 list is used as the source for
 * *which* words are in band; the reading and the child-facing English are
 * authored here and every correction is recorded in docs/content-review.md.
 *
 *   node scripts/build_assessment_bank.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "assessment", "v1");
const CONTENT = require("./assessment-content.js");
const BANK_VERSION = "1.1.0";
const STANDARD = "HSK3.0-new-1 (drkameleon/complete-hsk-vocabulary), used for band membership only";

/** Deterministic clip key for a single tone-marked syllable. Mirrors the app's
 *  markedPinyinToClipKey so the bank and the player agree. */
function clipKey(marked) {
  let base = "", tone = "";
  const TONES = {
    "ā":["a","1"],"á":["a","2"],"ǎ":["a","3"],"à":["a","4"],
    "ē":["e","1"],"é":["e","2"],"ě":["e","3"],"è":["e","4"],
    "ī":["i","1"],"í":["i","2"],"ǐ":["i","3"],"ì":["i","4"],
    "ō":["o","1"],"ó":["o","2"],"ǒ":["o","3"],"ò":["o","4"],
    "ū":["u","1"],"ú":["u","2"],"ǔ":["u","3"],"ù":["u","4"],
    "ǖ":["v","1"],"ǘ":["v","2"],"ǚ":["v","3"],"ǜ":["v","4"],
  };
  for (const ch of marked.trim()) {
    if (TONES[ch]) { base += TONES[ch][0]; tone = TONES[ch][1]; }
    else if (ch === "ü") base += "v";
    else if (ch >= "a" && ch <= "z") base += ch;
  }
  if (!base) return "";
  if (base === "v") base = "yu";
  return tone ? base + tone : "";   // no tone mark => no deterministic clip
}


// ── emit ────────────────────────────────────────────────────────────────────
const items = [];
const forms = {};          // { formId: { band: [itemId, ...] } }
const passages = {};
const seq = {};

function place(band, item, spec) {
  items.push(item);
  const add = (f) => {
    forms[f] = forms[f] || {};
    forms[f][band] = forms[f][band] || [];
    forms[f][band].push(item.id);
  };
  if (spec.anchor) { add("A"); add("B"); }
  else if (spec.form === "A") add("A");
  else if (spec.form === "B") add("B");
}

function nextId(band, kind) {
  const key = band + kind;
  seq[key] = (seq[key] || 0) + 1;
  return `as-v1-${band}-${kind}-${String(seq[key]).padStart(3, "0")}`;
}

function review(notes) {
  return { status: "reviewed", reviewerType: "model",
    sources: [{ standard: STANDARD, note: "band membership only" }], notes };
}

/** Stable 32-bit hash, so a given item always draws the same foils. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Three wrong SOUNDS for one audio item, drawn from the band's foil pool.
 *
 * The pool is disjoint from every target in the bank, which is the whole point:
 * distractors used to be `C.recognition.filter(x => x.zh !== w.zh).slice(0, 3)`
 * — the first three other words in list order — so items 5 onward offered three
 * sounds that were the CORRECT answers of items 1-3. A child who had answered
 * those could take the remaining option without reading the character at all.
 * 40 of 128 audio items were solvable that way, and only 32 distinct distractor
 * sets existed across the whole bank, so a section also felt like one question
 * asked eight times.
 *
 * Selection is a seeded shuffle rather than a sliding window: a window of three
 * consecutive entries only has as many variants as the pool is long, and
 * neighbouring items then share two of their three wrong options, which is what
 * made a section feel like the same question asked eight times. Choosing three
 * of twelve gives 220 possible sets, and seeding on the item id keeps the bank
 * reproducible from source.
 */
function pickFoils(band, pool, itemId, n) {
  if (!pool || pool.length < n + 1) {
    throw new Error(`${band}: foil pool too small (${pool ? pool.length : 0})`);
  }
  let seed = hashString(`${band}:${itemId}`);
  const rand = () => {
    seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) ^ 0) >>> 0;
    return seed / 4294967296;
  };
  const deck = pool.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, n);
}

for (const [band, C] of Object.entries(CONTENT)) {

  // Show the character, choose among four SPOKEN options. No pinyin and no
  // audio on the target — that is what makes it unaided.
  C.recognition.forEach((w) => {
    const recId = nextId(band, "rec");
    const distractors = pickFoils(band, C.foils, recId, 3);
    place(band, {
      id: recId, bankVersion: BANK_VERSION, band, domain: "recognition_unaided",
      targetWordIds: [`${band}:${w.zh}`], passageId: null,
      prompt: { zh: w.zh, enInstruction: "Listen to each one. Which sound matches this character?" },
      support: { targetPinyin: false, targetAudio: false, translation: false },
      options: [
        { id: "o1", text: null, audioAssetId: clipKey(w.py), audioSource: "clip" },
        ...distractors.map((d, i) => ({ id: `o${i + 2}`, text: null, audioAssetId: clipKey(d.py), audioSource: "clip" })),
      ],
      acceptedOptionIds: ["o1"], rubricId: null,
      anchorGroupId: w.anchor ? `${band}-rec-anchor-${w.zh}` : null,
      reference: { standardId: STANDARD, entries: [w.zh] },
      review: review(`Reading "${w.py}" and gloss "${w.en}" authored here; dataset entry not used verbatim.`),
    }, w);
  });

  // Character PLUS pinyin, choose the spoken form. Targets are disjoint from
  // the recognition set so the support cannot coach an earlier unaided answer.
  C.decoding.forEach((w) => {
    const decId = nextId(band, "dec");
    const distractors = pickFoils(band, C.foils, decId, 3);
    place(band, {
      id: decId, bankVersion: BANK_VERSION, band, domain: "decoding_supported",
      targetWordIds: [`${band}:${w.zh}`], passageId: null,
      prompt: { zh: w.zh, pinyin: w.py, enInstruction: "The pinyin is shown to help. Which sound matches?" },
      support: { targetPinyin: true, targetAudio: false, translation: false },
      options: [
        { id: "o1", text: null, audioAssetId: clipKey(w.py), audioSource: "clip" },
        ...distractors.map((d, i) => ({ id: `o${i + 2}`, text: null, audioAssetId: clipKey(d.py), audioSource: "clip" })),
      ],
      acceptedOptionIds: ["o1"], rubricId: null,
      anchorGroupId: w.anchor ? `${band}-dec-anchor-${w.zh}` : null,
      reference: { standardId: STANDARD, entries: [w.zh] },
      review: review("Supported-decoding twin of the recognition set; target words are disjoint from it by design."),
    }, w);
  });

  C.meaning.forEach((m) => {
    place(band, {
      id: nextId(band, "mean"), bankVersion: BANK_VERSION, band, domain: "meaning_context",
      targetWordIds: [`${band}:${m.target}`], passageId: null,
      prompt: { zh: m.sent, highlight: m.target,
        enInstruction: `In this sentence, what does 「${m.target}」 mean?` },
      support: { targetPinyin: false, targetAudio: false, translation: false },
      options: [
        { id: "o1", text: m.answer, audioAssetId: null },
        ...m.wrong.map((w, i) => ({ id: `o${i + 2}`, text: w, audioAssetId: null })),
      ],
      acceptedOptionIds: ["o1"], rubricId: null,
      anchorGroupId: m.anchor ? `${band}-mean-anchor-${m.target}` : null,
      reference: { standardId: STANDARD, entries: [m.target] },
      review: review("Concrete, common sense of the word in a short authored sentence; no obscure dictionary senses."),
    }, m);
  });

  C.passages.forEach((p) => {
    passages[p.id] = { id: p.id, band, zh: p.zh,
      charCount: [...p.zh].filter((c) => /[\u4e00-\u9fff]/.test(c)).length };
    p.questions.forEach((q) => {
      place(band, {
        id: nextId(band, "pass"), bankVersion: BANK_VERSION, band, domain: "passage_comprehension",
        targetWordIds: [], passageId: p.id,
        prompt: { enInstruction: q.q, questionKind: q.kind },
        support: { targetPinyin: false, targetAudio: false, translation: false },
        options: [
          { id: "o1", text: q.answer, audioAssetId: null },
          ...q.wrong.map((w, i) => ({ id: `o${i + 2}`, text: w, audioAssetId: null })),
        ],
        acceptedOptionIds: ["o1"], rubricId: null,
        anchorGroupId: q.anchor ? `${band}-pass-anchor-${p.id}` : null,
        reference: { standardId: STANDARD, entries: [] },
        review: review(`${q.kind} question on authored passage ${p.id}; the passage is unchanged between forms where shared.`),
      }, q);
    });
  });

  // The target is deliberately absent from the prompt: no glyph, no pinyin,
  // no outline, no stroke demo.
  C.writing.forEach((w) => {
    place(band, {
      id: nextId(band, "writ"), bankVersion: BANK_VERSION, band, domain: "writing_recall",
      targetWordIds: [`${band}:${w.zh}`], passageId: null,
      prompt: { enInstruction: `Listen, then write the character for “${w.en}”.`,
        audioAssetId: clipKey(w.py), hint: null },
      support: { targetPinyin: false, targetAudio: true, translation: true },
      options: [], acceptedOptionIds: [], rubricId: "writing-recall-v1",
      anchorGroupId: w.anchor ? `${band}-writ-anchor-${w.zh}` : null,
      reference: { standardId: STANDARD, entries: [w.zh] },
      review: review("Familiar, high-frequency character chosen for handwriting rather than every reading target."),
    }, w);
  });
}

const bands = Object.keys(CONTENT);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "items.json"), JSON.stringify({
  bankVersion: BANK_VERSION, bands, standard: STANDARD,
  rubrics: { "writing-recall-v1": { version: 1, levels: [
    { score: 0, label: "missing, wrong target, or unrecognisable" },
    { score: 1, label: "target recognisable but incomplete or structurally inaccurate" },
    { score: 2, label: "correct recognisable form with essential components and reasonable proportions" },
  ], note: "Stroke order cannot be judged from a finished image and is not scored here." } },
  passages, items,
}, null, 2) + "\n");

fs.writeFileSync(path.join(OUT, "forms.json"), JSON.stringify({
  bankVersion: BANK_VERSION, forms,
}, null, 2) + "\n");

// Band metadata ships with the bank so the UI can NAME a set. "Set C1" told a
// parent nothing about what distinguishes it from "Set C2", and nothing on
// screen named the band during the run at all.
const BAND_INFO = {
  C1: { name: "Set 1 · First characters", zh: "第一组 · 最先学的字",
        about: "Single everyday characters, and sentences of four to six characters." },
  C2: { name: "Set 2 · Everyday words", zh: "第二组 · 日常词语",
        about: "Two-character everyday words in short sentences about ordinary things." },
  C3: { name: "Set 3 · Longer sentences", zh: "第三组 · 长句子",
        about: "Sentences with more than one clause, and short connected texts." },
  C4: { name: "Set 4 · Short stories", zh: "第四组 · 短故事",
        about: "Multi-sentence passages with description and reported speech." },
};
const BAND_NOTE = "The sets get harder in order and are built from graded word " +
  "lists. They are not HSK levels and do not certify one.";

fs.writeFileSync(path.join(ROOT, "data", "assessment", "manifest.json"), JSON.stringify({
  bankVersion: BANK_VERSION, bands, forms: Object.keys(forms),
  files: { items: "v1/items.json", forms: "v1/forms.json" },
  standard: STANDARD,
  bandInfo: Object.fromEntries(bands.map((b) => [b, Object.assign({}, BAND_INFO[b], {
    passageChars: `${CONTENT[b].passageRange[0]}–${CONTENT[b].passageRange[1]}`,
  })])),
  bandNote: BAND_NOTE,
}, null, 2) + "\n");

const anchors = items.filter((i) => i.anchorGroupId).length;
console.log(`bands: ${bands.join(", ")}`);
bands.forEach((b) => {
  console.log(`  ${b}: form A ${forms.A[b].length}, form B ${forms.B[b].length}, anchors ${items.filter((i) => i.band === b && i.anchorGroupId).length}`);
});
console.log(`total distinct items: ${items.length} | shared anchors: ${anchors} | passages: ${Object.keys(passages).length}`);
