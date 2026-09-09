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

/**
 * Wordings simplification keeps reaching for, which are wrong in ways a schema
 * check cannot see.
 *
 * Each of these shipped. They are not style preferences: a child who learns
 * 做学校 has learnt a sentence a Chinese speaker would not say, and 种米 teaches
 * that the grain in the bowl is the thing growing in the field.
 */
const BUILT_NOT_MADE = /做[^。，、；：]{0,6}(?:学校|长城|房子|桥|工厂|医院|地图|运河)|做一条[^。，]{0,6}(?:河|路|城)/;
const GROWN_NOT_MILLED = /种[^。，、；：]{0,4}米(?!饭)|很多种饭/;
const SAD_NOT_HARD = /(?:天(?:冷|热)|风|雪|冬天|日子)[^。，]{0,6}难过/;
// 做钱 in the sense of EARNING is a calque; earning is 赚, or 做买卖 at this
// level. Manufacturing currency — 用纸做钱, which is exactly what the Song
// story is about — is a different verb sense and is left alone.
const COUNTERFEIT = /做了?很多钱/;
// 学数 / 教数 is not studying or teaching mathematics; that is 数学.
const NUMBERS_NOT_MATHS = /(?:学|教)(?:过)?数(?![学字量])/;
// 水很大 / 水又大 is not how depth or a flood is described.
const BIG_WATER = /水(?:很|又|太)大/;
// 眼 on its own is not the word for an eye.
const BARE_EYE = /(?:^|[，。、])[^。，]{0,4}眼(?![睛前泪])(?:不好|是黑|很大)/;
// 不有 is not a negation anyone writes.
const BAD_NEGATION = /不有(?:钱|人|书)/;

function checkNaturalness(text, at) {
  if (BUILT_NOT_MADE.test(text)) {
    fail(`${at}: uses 做 for something that is built — schools, roads and bridges take 建, 修 or 盖`);
  }
  if (GROWN_NOT_MILLED.test(text)) {
    fail(`${at}: grows 米, which is the milled grain; the plant in the field is 稻子`);
  }
  if (SAD_NOT_HARD.test(text)) {
    fail(`${at}: uses 难过 for weather or conditions — that is being sad, not hard going`);
  }
  if (COUNTERFEIT.test(text)) {
    fail(`${at}: 做钱 is counterfeiting money; earning it is 赚 or, at this level, 做买卖`);
  }
  if (NUMBERS_NOT_MATHS.test(text)) {
    fail(`${at}: 学数 / 教数 is not mathematics — the subject is 数学`);
  }
  if (BIG_WATER.test(text)) {
    fail(`${at}: water is 深 or a 大水 flood; 水很大 is not how either is said`);
  }
  if (BARE_EYE.test(text)) {
    fail(`${at}: uses a bare 眼; the word for an eye is 眼睛`);
  }
  if (BAD_NEGATION.test(text)) {
    fail(`${at}: 不有 is not a negation — 有 is negated with 没有`);
  }
}

/**
 * The same story told at two levels must not contradict itself on a fact.
 *
 * HSK1 had 大禹 away from home for 三十年 while HSK2 said 十三年 — the same
 * legend, the same event, told to the same child a level apart. Numbers are the
 * form of contradiction that is both checkable and most likely: they are what a
 * simplification pass rewrites.
 */
const CN_NUM = /[一二三四五六七八九十百千万]+(?=年|个月|天|岁|次|条|座)/g;
const levelTexts = {};

function checkCrossLevelFacts() {
  const byBase = {};
  Object.entries(levelTexts).forEach(([lv, stories]) => {
    Object.entries(stories).forEach(([base, text]) => {
      byBase[base] = byBase[base] || {};
      byBase[base][lv] = new Set(text.match(CN_NUM) || []);
    });
  });
  Object.entries(byBase).forEach(([base, byLv]) => {
    const levels = Object.keys(byLv);
    if (levels.length < 2) return;
    for (let i = 0; i < levels.length; i++) {
      for (let j = i + 1; j < levels.length; j++) {
        const a = byLv[levels[i]], b = byLv[levels[j]];
        // A number one telling gives and the other reverses (三十 vs 十三) is
        // the digit-order slip; a number only one telling mentions is fine.
        [...a].forEach((n) => {
          const rev = [...n].reverse().join("");
          if (rev !== n && b.has(rev) && !b.has(n)) {
            fail(`${base}: HSK${levels[i]} says ${n} where HSK${levels[j]} says ${rev} — the same fact, two answers`);
          }
        });
      }
    }
  });
}

/**
 * Glosses that must read a certain way on the words a child taps most.
 *
 * Every check above catches a SHAPE of junk — a fragment, a code, a surname.
 * The 2026-09-09 audit found the corpus glossing 他 "they" on 219 tokens,
 * 东西 "east and west" on 74 and 又 "after" on 44: real English words, so no
 * shape test could see them. A pinned list is the only guard for this class.
 * Each entry is a pattern the gloss must match, case-insensitive.
 */
// Glosses are written in context, so a pattern must accept the inflection the
// sentence needed: 说 is "said" as often as "to say".
const PINNED_GLOSS = {
  "他": /\b(he|him|his)\b/i, "她": /\b(she|her)\b/i, "它": /\b(it|its)\b/i, "我": /\b(I|me|my)\b/,
  "你": /\byou\b/i, "东西": /thing/i, "又": /again|both|also|and/i, "故事": /stor(y|ies)|tale/i,
  "一起": /together/i, "是": /\b(is|was|are|were|am|be)\b/i, "有": /\bha(ve|s|d)\b|there (is|was|are|were)/i,
  "不": /\bno(t)?\b|n't|cannot/i, "没有": /not|no\b|n't|without/i, "人": /person|people|man|men/i,
  "很": /very|really|so\b|many|much|quite/i, "都": /\ball\b|both|every/i, "也": /also|too|as well|either/i,
  "和": /\band\b|with/i, "说": /sa(y|id|ys)|sp(eak|oke)|talk|t(ell|old)/i,
  "看": /look|watch|s(ee|aw)|read/i, "去": /\bg(o|oes|one|oing)\b|went|leave|out|away/i,
  "来": /com(e|es|ing)|came/i, "大": /big|large|great|huge|grow|loud/i, "小": /small|little|young/i,
  "好": /good|well|fine|nice|better|ok/i, "中国": /China|Chinese/i, "学": /learn|stud/i,
  "书": /book/i, "水": /water|flood/i,
};

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
          // A gloss that merely ENDS in a hyphen passes the fragment test above
          // ("again; once more; re-" is not one token) but is still refused by
          // isCleanMeaning, so the word is shown in the reader and dropped from
          // every game and flashcard deck built from the story.
          else if (/-$/.test(en)) fail(`${at}: "${zh}" is glossed "${en}" — a trailing hyphen drops it from the word pools`);
          // The last two shapes isCleanMeaning refuses. A story carrying one is
          // taught in the reader and in no game — 位 "CL-person" was exactly
          // that, and the HSK3 drafts still hold 支 "CL-fleet", 艘 "CL-ship"
          // and 些 "CL-PL".
          else if (/^(DE|PL|BA|ADV|CMPL|ING|SUF|CL|OF|ORD)-/i.test(en)) {
            fail(`${at}: "${zh}" is glossed "${en}" — a grammar code with a word stuck on it`);
          } else if (en.length < 2) {
            fail(`${at}: "${zh}" is glossed "${en}" — too short to be a meaning`);
          } else if (PINNED_GLOSS[zh] && !PINNED_GLOSS[zh].test(en)) {
            fail(`${at}: "${zh}" is glossed "${en}" — a real English word, but not this word's meaning`);
          }
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

      checkNaturalness(text, at);
      levelTexts[lv] = levelTexts[lv] || {};
      levelTexts[lv][(s.legacyId || key.replace(/-h[1-4]$/, ""))] = text;

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

  checkCrossLevelFacts();

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
