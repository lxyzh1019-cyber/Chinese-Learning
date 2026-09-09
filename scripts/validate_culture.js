#!/usr/bin/env node
"use strict";
/**
 * Refuse to ship a culture reading that is a template.
 *
 * All 29 entries once shared one three-paragraph stub. The reader displayed it,
 * finishing marked the entry seen, and the child could then collect stars for
 * having read a paragraph that told them to ask a parent for pinyin about
 * twenty per cent of the time. Nothing checked that an advertised reading
 * contained a reading.
 *
 * The strongest rule here is the duplication one: a template is not detectable
 * sentence by sentence, but it is obvious across the collection, because every
 * copy is identical. So the check is comparative — computed from the corpus
 * itself rather than matched against a list of phrasings we happen to know.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CJK = /[一-鿿]/;

let failures = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };

/** Prose about the exercise rather than about the subject. */
const META = [
  /请家长帮忙/, /约[一二三四五六七八九十]成/, /读一读下面的句子/,
  /有什么联系/, /这一段主要讲什么/, /合理即可/, /大约[一二三四五六七八九十]成/,
  /是中国传统文化里的一个重要主题/,
];

function main() {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "culture_stories.json"), "utf8"));
  const stories = (doc.tracks || []).flatMap((t) => t.stories || []);
  if (!stories.length) return fail("culture_stories.json has no stories");

  const paraCount = new Map();   // paragraph text -> how many entries use it
  const questionCount = new Map();

  stories.forEach((s) => {
    const at = `${s.id}`;
    const paras = s.readerParagraphs || [];
    const qs = s.readerComprehension || [];
    const words = s.targetWords || [];

    if (paras.length < 3) fail(`${at}: ${paras.length} paragraph(s); a reading needs at least 3`);
    paras.forEach((p, i) => {
      if (!CJK.test(p)) fail(`${at} paragraph ${i + 1}: no Chinese`);
      META.forEach((re) => {
        if (re.test(p)) fail(`${at} paragraph ${i + 1}: instructions about the exercise, not a reading (${re})`);
      });
      paraCount.set(p, (paraCount.get(p) || 0) + 1);
    });

    // The subject has to appear in its own reading.
    if (s.title && !paras.some((p) => p.includes(s.title))) {
      fail(`${at}: the reading never mentions ${s.title}`);
    }

    if (!words.length) fail(`${at}: targetWords is empty, so nothing can be taught or reviewed from it`);
    words.forEach((w, i) => {
      if (!w.zh || !CJK.test(w.zh)) fail(`${at} word ${i + 1}: no Chinese`);
      if (!w.py) fail(`${at} word ${i + 1} (${w.zh}): no pinyin`);
      if (!w.en || !/[a-z]/i.test(w.en)) fail(`${at} word ${i + 1} (${w.zh}): no English`);
      // A target word the reading does not use cannot be learnt from it.
      if (w.zh && !paras.some((p) => p.includes(w.zh))) {
        fail(`${at}: target word ${w.zh} never appears in the reading`);
      }
    });

    if (qs.length < 2) fail(`${at}: ${qs.length} question(s); a reading needs 2`);
    qs.forEach((q, i) => {
      const where = `${at} question ${i + 1}`;
      if (!q.question || !CJK.test(q.question)) fail(`${where}: no Chinese question`);
      if (!q.answer || !String(q.answer).trim()) fail(`${where}: no answer`);
      META.forEach((re) => {
        if (re.test(q.question || "") || re.test(q.answer || "")) {
          fail(`${where}: asks about the instructions, not about the text`);
        }
      });
      questionCount.set(q.question, (questionCount.get(q.question) || 0) + 1);
    });
  });

  // The comparative rule: shared text across entries is a template by definition.
  paraCount.forEach((n, text) => {
    if (n > 1) fail(`${n} readings share the paragraph "${text.slice(0, 24)}…" — that is a template, not a reading`);
  });
  questionCount.forEach((n, text) => {
    if (n > 1) fail(`${n} readings ask "${text.slice(0, 24)}…" — a question that fits every text tests none of them`);
  });

  console.log(`\nculture readings: ${stories.length} checked · ${failures ? "INVALID" : "valid"} — ${failures} error(s).`);
  if (failures) process.exit(1);
}

main();
