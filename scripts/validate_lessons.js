"use strict";
/**
 * Lesson contract.
 *
 * Two defects this exists to stop coming back:
 *
 * 1. 66 of 88 "passages" were the gate's vocabulary list wrapped in
 *    instructions — 第10关：今天的新词有：内容、上面、痛… — and their questions
 *    asked about the lesson rather than about any text ("本关有几个生字？" ->
 *    "14个。"). A passage has to be a passage.
 * 2. Every instruction, explanation and question was Chinese-only. These two
 *    readers read English far better than Chinese, so a Chinese-only
 *    instruction is not an instruction. The PASSAGE stays Chinese — it is the
 *    reading practice — but everything telling the child what to do is checked
 *    for both languages.
 *
 * Levels whose lessons have not been rewritten yet are listed in PENDING so the
 * remaining work stays countable rather than silently absent.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "data", "lessons");
const PENDING = path.join(ROOT, "content", "stories", "PENDING.json");

const META = [/生字/, /本关有几个/, /复习字/, /共\s*\d+\s*个/];
const CJK = /[一-鿿]/;
const LATIN = /[A-Za-z]{3,}/;

let errors = 0, warnings = 0;
const fail = (m) => { console.error(`  FAIL  ${m}`); errors++; };
const warn = (m) => { console.warn(`  warn  ${m}`); warnings++; };

function pendingLevels() {
  if (!fs.existsSync(PENDING)) return new Set();
  const p = JSON.parse(fs.readFileSync(PENDING, "utf8"));
  return new Set(p.lessonsNotRewritten || []);
}

function main() {
  const skip = pendingLevels();
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
  if (files.length !== 88) fail(`expected 88 lesson files, found ${files.length}`);

  let checked = 0, done = 0;
  files.forEach((f) => {
    const L = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    const at = L.lessonId || f;
    checked++;
    if (!L.level || !L.gateId) fail(`${at}: needs a level and a gateId`);
    if (skip.has(String(L.level))) return;
    done++;

    if (!L.passage || !CJK.test(L.passage)) return fail(`${at}: no Chinese passage`);
    META.forEach((re) => {
      if (re.test(L.passage)) fail(`${at}: the passage is a vocabulary list, not a text (${re})`);
    });
    if (!L.passageEn || !LATIN.test(L.passageEn)) {
      fail(`${at}: the passage has no English, so a child who stalls cannot get unstuck`);
    }

    // Instructions must be readable.
    [["explanation", L.explanationEn, L.explanation],
     ["speakingPrompt", L.speakingPromptEn, L.speakingPrompt]].forEach(([name, en, zh]) => {
      if (!en || !LATIN.test(en)) fail(`${at}: ${name} has no English`);
      if (!zh || !CJK.test(zh)) fail(`${at}: ${name} has no Chinese`);
    });

    const qs = L.comprehension || [];
    if (qs.length < 2) fail(`${at}: needs at least two comprehension questions`);
    qs.forEach((q, i) => {
      const where = `${at} question ${i + 1}`;
      if (!q.questionEn || !LATIN.test(q.questionEn)) fail(`${where}: no English`);
      if (!q.question || !CJK.test(q.question)) fail(`${where}: no Chinese`);
      if (!q.answer || !String(q.answer).trim()) fail(`${where}: no answer`);
      META.forEach((re) => {
        if (re.test(q.question)) fail(`${where}: asks about the lesson, not about the text`);
      });
    });

    const kv = L.keyVocab || [];
    if (!kv.length) fail(`${at}: no key vocabulary`);
    kv.forEach((v) => {
      const en = String(v.en || "").trim();
      if (!v.zh || !v.pinyin) return fail(`${at}: "${v.zh}" is missing a reading`);
      if (!en) fail(`${at}: "${v.zh}" has no meaning`);
      else if (/^[-—]/.test(en) || /^[A-Za-z]+-$/.test(en)) fail(`${at}: "${v.zh}" is glossed "${en}" — a fragment, not a meaning`);
      else if (/^[A-Z]{2,5}$/.test(en)) fail(`${at}: "${v.zh}" is glossed "${en}" — a grammar code`);
      if (v.zh && L.passage && !L.passage.includes(v.zh)) {
        warn(`${at}: key word "${v.zh}" does not appear in the passage`);
      }
    });
  });

  console.log(`\nlessons: ${checked} checked · ${done} rewritten · ${checked - done} still on the old template`);
  if (errors) {
    console.error(`\nlessons INVALID — ${errors} error(s), ${warnings} warning(s).`);
    process.exit(1);
  }
  console.log(`lessons valid — ${warnings} warning(s).`);
}

main();
