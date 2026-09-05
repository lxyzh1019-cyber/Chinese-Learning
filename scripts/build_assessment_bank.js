#!/usr/bin/env node
"use strict";
/**
 * Build the C1 assessment bank (forms A and B) from curated content.
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
const BANK_VERSION = "1.0.0";
const BAND = "C1";
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

// ── Curated C1 targets ──────────────────────────────────────────────────────
// `anchor: true` means the item appears in BOTH forms, identically.
// Recognition and decoding target sets are disjoint (A03 forbids overlap).

const RECOGNITION = [
  { zh:"水", py:"shuǐ", en:"water",    anchor:true },
  { zh:"山", py:"shān", en:"mountain", anchor:true },
  { zh:"人", py:"rén",  en:"person",   form:"A" },
  { zh:"大", py:"dà",   en:"big",      form:"A" },
  { zh:"小", py:"xiǎo", en:"small",    form:"A" },
  { zh:"好", py:"hǎo",  en:"good",     form:"A" },
  { zh:"天", py:"tiān", en:"sky; day", form:"A" },
  { zh:"家", py:"jiā",  en:"home",     form:"A" },
  { zh:"门", py:"mén",  en:"door",     form:"B" },
  { zh:"车", py:"chē",  en:"car",      form:"B" },
  { zh:"手", py:"shǒu", en:"hand",     form:"B" },
  { zh:"口", py:"kǒu",  en:"mouth",    form:"B" },
  { zh:"花", py:"huā",  en:"flower",   form:"B" },
  { zh:"月", py:"yuè",  en:"moon",     form:"B" },
];

const DECODING = [
  { zh:"吃", py:"chī",  en:"to eat",   anchor:true },
  { zh:"走", py:"zǒu",  en:"to walk",  anchor:true },
  { zh:"喝", py:"hē",   en:"to drink", form:"A" },
  { zh:"说", py:"shuō", en:"to speak", form:"A" },
  { zh:"学", py:"xué",  en:"to study", form:"A" },
  { zh:"白", py:"bái",  en:"white",    form:"A" },
  { zh:"高", py:"gāo",  en:"tall",     form:"A" },
  { zh:"快", py:"kuài", en:"fast",     form:"A" },
  { zh:"冷", py:"lěng", en:"cold",     form:"B" },
  { zh:"热", py:"rè",   en:"hot",      form:"B" },
  { zh:"老", py:"lǎo",  en:"old",      form:"B" },
  { zh:"爱", py:"ài",   en:"to love",  form:"B" },
  { zh:"笑", py:"xiào", en:"to laugh", form:"B" },
  { zh:"早", py:"zǎo",  en:"early",    form:"B" },
];

/** Meaning in context: a short sentence, asked about one word in it. */
const MEANING = [
  { sent:"我喝水。",      target:"喝", answer:"drink",       wrong:["eat","run","sleep"],        anchor:true },
  { sent:"妈妈在家。",    target:"家", answer:"home",        wrong:["school","shop","park"],     anchor:true },
  { sent:"爸爸看书。",    target:"书", answer:"book",        wrong:["phone","bowl","chair"],     form:"A" },
  { sent:"天上有月。",    target:"月", answer:"the moon",    wrong:["a bird","the sun","a cloud"], form:"A" },
  { sent:"山上有花。",    target:"花", answer:"flowers",     wrong:["snow","rocks","houses"],    form:"A" },
  { sent:"我学中文。",    target:"学", answer:"study",       wrong:["forget","sell","carry"],    form:"A" },
  { sent:"水很冷。",      target:"冷", answer:"cold",        wrong:["deep","clean","sweet"],     form:"A" },
  { sent:"他走得很快。",  target:"快", answer:"fast",        wrong:["slowly","quietly","far"],   form:"A" },
  { sent:"天很热。",      target:"热", answer:"hot",         wrong:["windy","dark","wet"],       form:"B" },
  { sent:"哥哥走得早。",  target:"早", answer:"early",       wrong:["late","alone","again"],     form:"B" },
  { sent:"他笑了。",      target:"笑", answer:"laughed",     wrong:["cried","left","slept"],     form:"B" },
  { sent:"门前有车。",    target:"前", answer:"in front of", wrong:["behind","inside","under"],  form:"B" },
  { sent:"我爱我家。",    target:"爱", answer:"love",        wrong:["leave","clean","build"],    form:"B" },
  { sent:"老人在前面。",  target:"老", answer:"old",         wrong:["tall","busy","new"],        form:"B" },
];

/** Passages. P2 is the anchor passage and appears unchanged in both forms. */
const PASSAGES = [
  { id:"p1", form:"A", zh:"早上，妈妈在家。她说：“今天天很好，我们上山去。”我很爱上山。山上有花，花很白。我笑了。",
    questions:[
      { kind:"literal",   q:"What did Mum say the weather was like today?", answer:"Very good", wrong:["Very cold","Very windy","Very dark"], form:"A" },
      { kind:"reference", q:"In the story, who is “她” (she)?",              answer:"Mum",        wrong:["The child","The flower","A friend"], form:"A" },
      { kind:"inference", q:"Why does the child smile at the end?",          answer:"Because they are happy going up the mountain", wrong:["Because they are going home","Because it started to rain","Because Mum was late"], form:"A" },
    ] },
  { id:"p2", form:"both", zh:"爸爸有一本书。书里有山，有水，也有花。他很爱看这本书。晚上，他在家看书。我也看。",
    questions:[
      { kind:"literal",   q:"What does Dad have?",                    answer:"A book",     wrong:["A car","A flower","A cup"],     anchor:true },
      { kind:"literal",   q:"What is inside the book?",               answer:"Mountains, water and flowers", wrong:["Cars and roads","Animals and food","Numbers and letters"], form:"A" },
      { kind:"reference", q:"Where does Dad read in the evening?",    answer:"At home",    wrong:["At school","On the mountain","In the car"], form:"A" },
      { kind:"reference", q:"In the story, who is “他” (he)?",         answer:"Dad",        wrong:["The child","The writer","A teacher"], form:"B" },
      { kind:"inference", q:"How can you tell Dad likes this book?",  answer:"He reads it at home in the evenings", wrong:["He bought two of them","He gave it away","He wrote it himself"], form:"B" },
    ] },
  { id:"p3", form:"B", zh:"今天很冷。我和哥哥走到山下。山上有水，水很冷。哥哥说：“早点回家吧。”我们就走了。",
    questions:[
      { kind:"literal",   q:"What is the weather like today?",        answer:"Cold",       wrong:["Hot","Rainy","Windy"],          form:"B" },
      { kind:"sequence",  q:"What happens right after big brother speaks?", answer:"They go home", wrong:["They climb higher","They drink the water","They sit down"], form:"B" },
      { kind:"inference", q:"Why does big brother want to go home early?", answer:"Because it is cold", wrong:["Because he is hungry","Because it is dark","Because he is tired"], form:"B" },
    ] },
];

/** Writing from recall: an audio/context prompt, no target shown. */
const WRITING = [
  { zh:"水", py:"shuǐ", en:"water",    anchor:true },
  { zh:"人", py:"rén",  en:"person",   form:"A" },
  { zh:"大", py:"dà",   en:"big",      form:"A" },
  { zh:"小", py:"xiǎo", en:"small",    form:"A" },
  { zh:"口", py:"kǒu",  en:"mouth",    form:"B" },
  { zh:"手", py:"shǒu", en:"hand",     form:"B" },
  { zh:"山", py:"shān", en:"mountain", form:"B" },
];

// ── emit ────────────────────────────────────────────────────────────────────
const items = [];
const formA = [];
const formB = [];
let seq = { rec:0, dec:0, mean:0, pass:0, writ:0 };

function place(item, spec) {
  items.push(item);
  if (spec.anchor) { formA.push(item.id); formB.push(item.id); }
  else if (spec.form === "A") formA.push(item.id);
  else if (spec.form === "B") formB.push(item.id);
}

function review(notes) {
  return { status:"reviewed", reviewerType:"model",
    sources:[{ standard: STANDARD, note:"band membership only" }], notes };
}

// Recognition: show the character, choose among four SPOKEN options.
RECOGNITION.forEach((w) => {
  const id = `as-v1-C1-rec-${String(++seq.rec).padStart(3,"0")}`;
  const distractors = RECOGNITION.filter((x) => x.zh !== w.zh).slice(0, 3);
  place({
    id, bankVersion: BANK_VERSION, band: BAND, domain: "recognition_unaided",
    targetWordIds: [`hsk1:${w.zh}`], passageId: null,
    prompt: { zh: w.zh, enInstruction: "Listen to each one. Which sound matches this character?" },
    // No pinyin, no audio on the TARGET — that is what makes it unaided.
    support: { targetPinyin:false, targetAudio:false, translation:false },
    options: [
      { id:"o1", text:null, audioAssetId: clipKey(w.py), audioSource:"clip" },
      ...distractors.map((d, i) => ({ id:`o${i+2}`, text:null, audioAssetId: clipKey(d.py), audioSource:"clip" })),
    ],
    acceptedOptionIds: ["o1"],
    rubricId: null,
    anchorGroupId: w.anchor ? `C1-rec-anchor-${w.zh}` : null,
    reference: { standardId: STANDARD, entries:[w.zh] },
    review: review(`Reading "${w.py}" and gloss "${w.en}" authored here; dataset entry not used verbatim.`),
  }, w);
});

// Supported decoding: character PLUS pinyin shown, choose the spoken form.
DECODING.forEach((w) => {
  const id = `as-v1-C1-dec-${String(++seq.dec).padStart(3,"0")}`;
  const distractors = DECODING.filter((x) => x.zh !== w.zh).slice(0, 3);
  place({
    id, bankVersion: BANK_VERSION, band: BAND, domain: "decoding_supported",
    targetWordIds: [`hsk1:${w.zh}`], passageId: null,
    prompt: { zh: w.zh, pinyin: w.py, enInstruction: "The pinyin is shown to help. Which sound matches?" },
    support: { targetPinyin:true, targetAudio:false, translation:false },
    options: [
      { id:"o1", text:null, audioAssetId: clipKey(w.py), audioSource:"clip" },
      ...distractors.map((d, i) => ({ id:`o${i+2}`, text:null, audioAssetId: clipKey(d.py), audioSource:"clip" })),
    ],
    acceptedOptionIds: ["o1"],
    rubricId: null,
    anchorGroupId: w.anchor ? `C1-dec-anchor-${w.zh}` : null,
    reference: { standardId: STANDARD, entries:[w.zh] },
    review: review(`Supported-decoding twin of the recognition set; target words are disjoint from it by design.`),
  }, w);
});

// Meaning in context.
MEANING.forEach((m) => {
  const id = `as-v1-C1-mean-${String(++seq.mean).padStart(3,"0")}`;
  place({
    id, bankVersion: BANK_VERSION, band: BAND, domain: "meaning_context",
    targetWordIds: [`hsk1:${m.target}`], passageId: null,
    prompt: { zh: m.sent, highlight: m.target,
      enInstruction: `In this sentence, what does 「${m.target}」 mean?` },
    support: { targetPinyin:false, targetAudio:false, translation:false },
    options: [
      { id:"o1", text:m.answer, audioAssetId:null },
      ...m.wrong.map((w, i) => ({ id:`o${i+2}`, text:w, audioAssetId:null })),
    ],
    acceptedOptionIds: ["o1"],
    rubricId: null,
    anchorGroupId: m.anchor ? `C1-mean-anchor-${m.target}` : null,
    reference: { standardId: STANDARD, entries:[m.target] },
    review: review("Concrete, common sense of the word in a short authored sentence; no obscure dictionary senses."),
  }, m);
});

// Passage comprehension.
const passages = {};
PASSAGES.forEach((p) => {
  passages[p.id] = { id:p.id, band:BAND, zh:p.zh, charCount:[...p.zh].filter((c)=>/[一-鿿]/.test(c)).length };
  p.questions.forEach((q) => {
    const id = `as-v1-C1-pass-${String(++seq.pass).padStart(3,"0")}`;
    place({
      id, bankVersion: BANK_VERSION, band: BAND, domain: "passage_comprehension",
      targetWordIds: [], passageId: p.id,
      prompt: { enInstruction: q.q, questionKind: q.kind },
      support: { targetPinyin:false, targetAudio:false, translation:false },
      options: [
        { id:"o1", text:q.answer, audioAssetId:null },
        ...q.wrong.map((w, i) => ({ id:`o${i+2}`, text:w, audioAssetId:null })),
      ],
      acceptedOptionIds: ["o1"],
      rubricId: null,
      anchorGroupId: q.anchor ? `C1-pass-anchor-${p.id}` : null,
      reference: { standardId: STANDARD, entries:[] },
      review: review(`${q.kind} question on authored passage ${p.id}; the passage is unchanged between forms where shared.`),
    }, q);
  });
});

// Writing from recall.
WRITING.forEach((w) => {
  const id = `as-v1-C1-writ-${String(++seq.writ).padStart(3,"0")}`;
  place({
    id, bankVersion: BANK_VERSION, band: BAND, domain: "writing_recall",
    targetWordIds: [`hsk1:${w.zh}`], passageId: null,
    // The target character is deliberately absent from the prompt: no glyph,
    // no pinyin, no outline, no stroke demo (A02.5).
    prompt: { enInstruction: `Listen, then write the character for “${w.en}”.`,
      audioAssetId: clipKey(w.py), hint: null },
    support: { targetPinyin:false, targetAudio:true, translation:true },
    options: [],
    acceptedOptionIds: [],
    rubricId: "writing-recall-v1",
    anchorGroupId: w.anchor ? `C1-writ-anchor-${w.zh}` : null,
    reference: { standardId: STANDARD, entries:[w.zh] },
    review: review("Familiar, high-frequency character chosen for handwriting rather than every reading target."),
  }, w);
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "items.json"), JSON.stringify({
  bankVersion: BANK_VERSION, band: BAND, standard: STANDARD,
  rubrics: { "writing-recall-v1": { version:1, levels:[
    { score:0, label:"missing, wrong target, or unrecognisable" },
    { score:1, label:"target recognisable but incomplete or structurally inaccurate" },
    { score:2, label:"correct recognisable form with essential components and reasonable proportions" },
  ], note:"Stroke order cannot be judged from a finished image and is not scored here." } },
  passages, items,
}, null, 2) + "\n");

fs.writeFileSync(path.join(OUT, "forms.json"), JSON.stringify({
  bankVersion: BANK_VERSION,
  forms: { A: { C1: formA }, B: { C1: formB } },
}, null, 2) + "\n");

fs.writeFileSync(path.join(ROOT, "data", "assessment", "manifest.json"), JSON.stringify({
  bankVersion: BANK_VERSION,
  bands: [BAND],
  forms: ["A", "B"],
  files: { items: "v1/items.json", forms: "v1/forms.json" },
  standard: STANDARD,
  note: "C1 only. C2-C4 are not yet authored; routing reports the ceiling honestly.",
}, null, 2) + "\n");

const anchors = items.filter((i) => i.anchorGroupId).length;
console.log(`items: ${items.length} distinct | form A: ${formA.length} | form B: ${formB.length} | shared anchors: ${anchors}`);
