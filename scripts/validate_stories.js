"use strict";
/**
 * Story contract.
 *
 * Decision O05: the four HSK levels share a dynasty's background story and
 * differ in how it is told — HSK1 10 sentences, HSK2 15, HSK3 20, HSK4 25, with
 * the language of that level. This checks the built corpus against that.
 *
 * Stories still at their pre-ladder length are listed in content/stories/PENDING.json
 * and reported as outstanding rather than failing the build. That keeps the
 * remaining work COUNTABLE in the open instead of silently absent — an empty
 * pending list is what "done" looks like.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LADDER = { 1: 10, 2: 15, 3: 20, 4: 25 };
// Study tokens a child taps: the gold characters and words, bonus excluded.
//
// Derived from the built corpus rather than guessed. Natural prose at these
// levels runs a median of 8.1 study tokens per sentence at HSK1 (min 57, median
// 81, max 104 over 44 ten-sentence stories) and 10.3 at HSK2 (min 136, median
// 155, max 186 over 44 fifteen-sentence stories) — longer sentences carry more
// per sentence as well as more sentences. So the band is the sentence count
// times roughly 6 to 12.5.
//
// Both earlier versions of this range were estimates and both flagged a slice
// of good writing, which each time said the range was wrong rather than the
// prose. HSK3 and HSK4 stay estimates until their corpora exist, and should be
// re-derived the same way once they do.
const STUDY = { 1: [55, 110], 2: [90, 190], 3: [120, 250], 4: [150, 315] };

let errors = 0, warnings = 0;
const fail = (m) => { console.error(`  FAIL  ${m}`); errors++; };
const warn = (m) => { console.warn(`  warn  ${m}`); warnings++; };

function pending() {
  const f = path.join(ROOT, "content", "stories", "PENDING.json");
  if (!fs.existsSync(f)) return { notLaddered: [] };
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

function main() {
  const skip = new Set(pending().notLaddered || []);
  let checked = 0, laddered = 0;

  for (const lv of [1, 2, 3, 4]) {
    const file = path.join(ROOT, "data", "stories", `hsk${lv}.json`);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const stories = data.stories || {};
    if (data.level !== lv) fail(`hsk${lv}.json declares level ${data.level}`);

    Object.entries(stories).forEach(([key, s]) => {
      checked++;
      const at = `${key}`;
      if (s.id !== key) fail(`${at}: id "${s.id}" does not match its key`);
      if (s.level !== lv) fail(`${at}: level ${s.level} in the level-${lv} file`);
      if (!s.title || !s.en) fail(`${at}: needs a Chinese and an English title`);
      if (!Array.isArray(s.sents) || !s.sents.length) return fail(`${at}: no sentences`);

      // Every sentence needs its English line: the reader shows it, and a
      // missing one is invisible until a child taps for it.
      s.sents.forEach((sent, i) => {
        if (!s.trans || !s.trans[i] || !String(s.trans[i]).trim()) {
          fail(`${at}: sentence ${i + 1} has no English translation`);
        }
        sent.forEach((tok) => {
          if (tok.t === "p") return;
          const zh = tok.ch || tok.tx;
          if (!zh) return fail(`${at}: a token with no text`);
          if (!tok.py) fail(`${at}: "${zh}" has no pinyin`);
          if (tok.mn === undefined || tok.mn === null) return fail(`${at}: "${zh}" has no gloss`);

          // A gloss the child actually reads when they tap the character.
          // 96 of these were shipping: a longer word's English split across its
          // characters (学习 "practice" leaving 习 as "-tice", 朋友 "friend"
          // leaving 友 as "-end") and linguists' codes for the grammar
          // (的 "DE", 了 "CMPL", 个 "CL", 把 "BA"). Neither says anything to a
          // nine-year-old, and both were shown on every tap.
          const en = String(tok.mn).trim();
          if (!en) fail(`${at}: "${zh}" has an empty gloss`);
          else if (/^[-—]/.test(en) || /^[A-Za-z.]+-$/.test(en)) fail(`${at}: "${zh}" is glossed "${en}" — a fragment of a longer word's English, not a meaning`);
          else if (/^[A-Z]{2,5}$/.test(en)) fail(`${at}: "${zh}" is glossed "${en}" — a grammar code; say what it does in plain words`);
          else if (/surname/i.test(en)) fail(`${at}: "${zh}" is glossed "${en}" — the junk-gloss class this project has already been burned by`);
        });
      });

      // An opening quote with no closing one shipped in gate 9 for as long as
      // the story existed: 人们说他是"书圣，意思是... Nothing checked punctuation,
      // and a reader does not notice a missing mark in a language they are
      // still learning.
      const text = s.sents.map((sent) => sent.map((t) => (t.t === "p" ? t.tx : (t.ch || t.tx))).join("")).join("");
      [["\u201c", "\u201d"], ["\u2018", "\u2019"], ["\uff08", "\uff09"], ["\u300a", "\u300b"]].forEach(([open, close]) => {
        const a = (text.match(new RegExp(open, "g")) || []).length;
        const b = (text.match(new RegExp(close, "g")) || []).length;
        if (a !== b) fail(`${at}: ${a} ${open} against ${b} ${close} — unbalanced punctuation`);
      });
      if (/["']/.test(text)) fail(`${at}: uses a straight quote; Chinese text takes \u201c \u201d`);

      const study = s.sents.flat().filter((t) => t.t === "c" && !t.bonus).length;
      if (skip.has(key)) return;
      laddered++;

      const want = LADDER[lv];
      if (s.sents.length !== want) {
        fail(`${at}: ${s.sents.length} sentences, the HSK${lv} ladder is ${want}`);
      }
      const [lo, hi] = STUDY[lv];
      if (study < lo || study > hi) {
        warn(`${at}: ${study} study tokens, outside the HSK${lv} range ${lo}-${hi}`);
      }
    });
  }

  console.log(`\nstories: ${checked} checked · ${laddered} on the ladder · ${skip.size} still to extend`);
  if (skip.size) {
    console.log(`  outstanding: ${[...skip].slice(0, 6).join(", ")}${skip.size > 6 ? `, +${skip.size - 6} more` : ""}`);
  }
  if (errors) {
    console.error(`\nstory corpus INVALID — ${errors} error(s), ${warnings} warning(s).`);
    process.exit(1);
  }
  console.log(`story corpus valid — ${warnings} warning(s).`);
}

main();
