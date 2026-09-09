#!/usr/bin/env node
"use strict";
/**
 * Build the sentence-builder packs from each gate's own story.
 *
 *   node scripts/build_sentence_packs.js        all levels that have stories
 *   node scripts/build_sentence_packs.js 2      one level
 *
 * Phase 3 of every gate quiz asks the child to arrange a sentence, and
 * `buildSBPack` reads `gateData.sentenceTargetsPack` — a field that existed in
 * none of the 88 gates. The branch had never run. Every gate fell through to
 * `GATE_SENTENCES`, which has nine gate numbers and no level dimension, so 52
 * of the 88 gate/level pairs served the same three sentences whatever the child
 * had been reading, and champions asked for ten sentences and were handed six.
 *
 * Packs are built from the gate's own story text, so the sentence a child
 * rebuilds is one they have read — true by construction, in the manner of
 * scripts/build_gate_lessons.js — and this script refuses to invent, in the
 * manner of scripts/build_stories.js: a gate it cannot supply is named and the
 * build fails rather than quietly falling back.
 *
 * TWO THINGS TO KNOW BEFORE EDITING
 *
 * 1. A pack entry must stay a plain array of chip strings.
 *    `persistGateQuizState` does `sbPack.map(s => [...s])`, so an object-shaped
 *    entry would break save and resume of a round in progress. Per-sentence
 *    pinyin and English therefore live in a sibling map keyed by the joined
 *    answer — the exact string `checkSB` already compares.
 *
 * 2. Sentences are cut at their commas.
 *    Measured on the real corpus: only 142 of 1,100 authored sentences are
 *    short enough to arrange, which is 1.6 per gate — not enough for a round of
 *    three. The stories are written in comma-joined pairs, and a clause is
 *    itself a sentence a child can build. Cutting at commas yields about 13
 *    candidates per gate.
 */
const fs = require("fs");
const path = require("path");
const sd = require("./story-dictionary.js");

const ROOT = path.resolve(__dirname, "..");
const CLAUSE_BREAK = /[、，；：]/;
const END_PUNCT = /[。！？]/;

// Length windows. The corpus runs to 21 chips; anything past this is a wall of
// tiles on an iPad in portrait, which is where these are actually played.
const WINDOW = { 1: { min: 3, max: 6 }, 2: { min: 3, max: 7 }, 3: { min: 3, max: 7 }, 4: { min: 3, max: 7 } };
const MAX_CHARS = { 1: 12, 2: 16, 3: 16, 4: 16 };
const PER_GATE = 6; // champions pool five gates and ask for ten
const MIN_PER_GATE = 3; // a normal round asks for three

// ── ambiguity screens ────────────────────────────────────────────────────
// checkSB compares by exact string equality, so a second grammatical order is
// scored WRONG. That is CLAUDE.md §9.6 in a new surface: a wrong option must
// never be secretly right. None of this PROVES a sentence has only one order —
// no build script can — so the screens are deliberately eager to reject.

/** A-and-B reads the same as B-and-A. */
const COORD = ["和", "跟", "与", "或", "或者", "还有"];

/** Time and place words move around the subject freely. */
const MOVABLE = [
  "今天", "明天", "昨天", "早上", "晚上",
  "中午", "现在", "后来", "以前", "以后",
  "那时", "当时", "很久以前", "从前",
  "每天", "有一天", "一天", "这时", "先",
  "春天", "夏天", "秋天", "冬天", "上午",
  "下午", "去年", "今年", "明年", "白天",
];

/** NOM v NOM with a symmetric-looking verb reads both ways. */
const SYMMETRIC_VERBS = ["是", "叫", "像", "比"];

/** A clause that starts or ends on one of these is hanging off its neighbour. */
const HANGING_FIRST = [
  "也", "就", "还", "都", "才", "又", "而", "则", "比",
  "却", "只", "再", "因为", "虽然", "如果",
  "所以", "但是", "而且", "于是", "然后",
  "可是", "不过", "并且",
  // An intensifier in first position means the subject is in the clause before
  // this one: 很舒服 is a predicate, not a sentence a child should be asked to
  // assemble as though it were whole.
  "很", "非常", "太", "更", "最", "真",
];
const HANGING_LAST = [
  "的", "和", "在", "把", "被", "给", "比", "得",
  "地", "很", "最", "不", "没", "要", "会", "能",
  "想", "时候", "以后", "以前", "跟", "对",
  "从", "向", "为", "一", "将",
];

const FULL_STOP = "。";

// ── screens added after the 2026-09-09 audit ──────────────────────────────
// The lists above work per chip, so a time phrase the tokeniser split
// (八|点) and a place phrase built from a preposition (在|树|下) both slipped
// through, and 我们八点出门 was served with 八点我们出门 scored wrong. These
// screens look at chip PAIRS and at part of speech, and stay eager.

/** A preposition opens a place phrase, and a place phrase moves like a time word. */
const PREPS = ["在", "从", "离", "往", "向", "朝", "自从", "沿着"];
/** A number followed by one of these is a time phrase: 八点, 三天, 两年. */
const NUM = /^[一二三四五六七八九十百千两几半零\d]+$/;
const TIME_UNIT = ["点", "天", "年", "月", "号", "个月", "星期", "小时", "分钟", "岁", "点钟"];
const NUM_TIME = /^[一二三四五六七八九十百千两几半零\d]+(点|天|年|月|号|岁)$/;
/** Particles may repeat without giving a second reading; anything else may not. */
const REPEATABLE = ["的", "了", "吗", "呢", "吧", "啊"];
/** A clause ending on one of these is a lead-in to speech (它妈妈说), not a sentence. */
const SPEECH_LAST = ["说", "问", "道", "回答"];
/** Tags under which a chip can stand as a subject, and under which it is a predicate. */
const NOMINAL = ["n", "r", "nr", "ns", "nz", "s", "t", "m", "mq", "tg"];
const VERBAL = ["v", "vn", "a", "ad", "an", "z"];

let POS_CACHE = null;
/** Part of speech from the curriculum tables; null for a word they do not carry (a name). */
function posOf(word) {
  if (!POS_CACHE) {
    POS_CACHE = {};
    [1, 2, 3, 4].forEach((lv) => {
      const f = path.join(ROOT, "data", `hsk${lv}.json`);
      if (!fs.existsSync(f)) return;
      const d = JSON.parse(fs.readFileSync(f, "utf8"));
      (d.words || []).forEach((w) => { if (!POS_CACHE[w.zh]) POS_CACHE[w.zh] = (w.meta && w.meta.pos) || []; });
    });
  }
  return POS_CACHE[word] || null;
}

/** Two-character words the tokeniser may have dealt as two single-character chips. */
function compoundSet(dict) {
  posOf("");
  const set = new Set();
  Object.keys(dict).forEach((k) => { if ([...k].length === 2) set.add(k); });
  Object.keys(POS_CACHE).forEach((k) => { if ([...k].length === 2) set.add(k); });
  return set;
}

/**
 * Re-join a compound the authored segment split character by character.
 * 妈|妈, 学|生, 故|事 and 出|门 were all dealt as two chips; rebuilding a word
 * from its characters is a different exercise from building a sentence, and
 * the split hid 八点 from the time screen.
 */
function mergeCompounds(tokens, compounds) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i], b = tokens[i + 1];
    if (a && b && a.t === "c" && b.t === "c" && a.ch && b.ch &&
        [...a.ch].length === 1 && [...b.ch].length === 1 && compounds.has(a.ch + b.ch)) {
      out.push({ t: "c", ch: a.ch + b.ch, py: [a.py, b.py].filter(Boolean).join(" "), mn: a.mn, merged: true });
      i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

function isPunct(tok) { return tok.t === "p"; }
function chipOf(tok) { return tok.t === "p" ? tok.tx : (tok.tx || tok.ch); }

/**
 * Every adjacent word pair the corpus actually witnessed, plus which words were
 * seen clause-initially and clause-finally.
 *
 * This is the licensing model: a re-ordering counts as a real alternative only
 * if the corpus has seen every join in it. It is a LOWER BOUND on ambiguity —
 * it cannot find an order the corpus never used — which is why the structural
 * screens above run as well.
 */
function buildBigramModel(allClauses) {
  const bigram = new Set(), first = new Set(), last = new Set();
  allClauses.forEach((words) => {
    if (!words.length) return;
    first.add(words[0]);
    last.add(words[words.length - 1]);
    for (let i = 0; i + 1 < words.length; i++) bigram.add(words[i] + " " + words[i + 1]);
  });
  return { bigram, first, last };
}

function licensed(model, words) {
  if (!model.first.has(words[0])) return false;
  if (!model.last.has(words[words.length - 1])) return false;
  for (let i = 0; i + 1 < words.length; i++) {
    if (!model.bigram.has(words[i] + " " + words[i + 1])) return false;
  }
  return true;
}

/** Does any order other than this one read as a sentence the corpus has seen? */
function hasLicensedAlternative(model, words) {
  const target = words.join("");
  let found = false;
  const permute = (rest, acc) => {
    if (found) return;
    if (!rest.length) {
      if (acc.join("") !== target && licensed(model, acc)) found = true;
      return;
    }
    const tried = new Set();
    for (let i = 0; i < rest.length && !found; i++) {
      if (tried.has(rest[i])) continue; // identical chips give identical orders
      tried.add(rest[i]);
      permute(rest.slice(0, i).concat(rest.slice(i + 1)), acc.concat([rest[i]]));
    }
  };
  permute(words, []);
  return found;
}

function structuralReason(words) {
  if (words.some((w) => COORD.includes(w))) return "coordination reads both ways";
  if (words.some((w) => MOVABLE.includes(w))) return "a time or place word can move";
  if (HANGING_FIRST.includes(words[0])) return "opens on a connective";
  if (HANGING_LAST.includes(words[words.length - 1])) return "ends on a function word";
  if (words.length === 3 && SYMMETRIC_VERBS.includes(words[1])) return "A is B reads as B is A";
  // Chips that are all single characters are the maximally reorderable case,
  // and they are usually a sign the dictionary split a compound it does not
  // carry (舒服 becoming 舒|服). Asking a child to rebuild a word character by
  // character is a different exercise from building a sentence.
  if (words.length >= 4 && words.every((w) => [...w].length === 1)) {
    return "every chip is a single character";
  }
  if (words.some((w) => PREPS.includes(w))) return "a place phrase can move";
  if (words.some((w) => w === "时候" || /时候$/.test(w))) return "a …的时候 phrase can move";
  if (SPEECH_LAST.includes(words[words.length - 1])) return "a lead-in to speech, not a sentence";
  for (let i = 0; i < words.length; i++) {
    if (NUM_TIME.test(words[i])) return "a time phrase can move";
    if (i + 1 < words.length && (NUM.test(words[i]) || words[i] === "每") && TIME_UNIT.includes(words[i + 1])) {
      return "a time phrase can move";
    }
  }
  const seen = new Set();
  for (const w of words) {
    if (seen.has(w) && !REPEATABLE.includes(w)) return "a repeated word reads both ways";
    seen.add(w);
  }
  // 让他想办法 and 喝了一些水 are predicates cut from a longer sentence; the
  // subject is in the clause before. A name is not in the tables (null) and
  // is a subject, so it passes.
  const p0 = posOf(words[0]);
  if (p0 && p0.length && !p0.some((t) => NOMINAL.includes(t))) return "opens without a subject";
  const tags = words.map(posOf);
  if (tags.every((t) => t && t.length) && !tags.some((t) => t.some((x) => VERBAL.includes(x)))) {
    return "has no verb";
  }
  return null;
}

/** The reviewer-approved second orders, keyed by the stored answer. */
const ALTERNATES = (() => {
  const f = path.join(__dirname, "sentence-alternates.js");
  return fs.existsSync(f) ? (require(f) || {}) : {};
})();

/**
 * Is `str` the same chips as `chips`, in some other order? Backtracks over the
 * multiset, so 我们|八|点 can be matched against 八点我们 without a tokeniser.
 */
function isChipPermutation(chips, str) {
  const target = String(str || "");
  if (target === chips.join("")) return false;
  const left = chips.slice();
  const walk = (pos) => {
    if (pos === target.length) return left.length === 0;
    for (let i = 0; i < left.length; i++) {
      const c = left[i];
      if (target.startsWith(c, pos)) {
        left.splice(i, 1);
        if (walk(pos + c.length)) return true;
        left.splice(i, 0, c);
      }
    }
    return false;
  };
  return walk(0);
}

/** Split one tokenized sentence into clause-level candidates. */
function clausesOf(tokens) {
  const out = [];
  let cur = [];
  tokens.forEach((t) => {
    if (isPunct(t)) {
      if (CLAUSE_BREAK.test(t.tx) || END_PUNCT.test(t.tx)) { if (cur.length) out.push(cur); cur = []; }
      return; // quotation marks and the rest are dropped, never made into chips
    }
    cur.push(t);
  });
  if (cur.length) out.push(cur);
  return out;
}

function loadSources(lv) {
  const dir = path.join(ROOT, "content", "stories", `hsk${lv}`);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((s) => !s.draft);
}

function candidatesFor(lv, dict, baseNames) {
  const perGate = new Map();
  const allClauses = [];
  const compounds = compoundSet(dict);
  loadSources(lv).forEach((story) => {
    const names = Object.assign({}, baseNames, story.names || {});
    (story.sents || []).forEach((sent, si) => {
      const r = sd.tokenize(sent.zh, dict, { names, seg: sent.seg, bonus: sent.bonus });
      if (r.unknown.length) return; // never guess a reading
      const tokens = mergeCompounds(r.tokens, compounds);
      const wholeLen = tokens.filter((t) => !isPunct(t)).length;
      clausesOf(tokens).forEach((clause) => {
        const words = clause.map(chipOf);
        allClauses.push(words);
        const isWhole = words.length === wholeLen;
        const list = perGate.get(story.did) || [];
        list.push({
          words, storyId: story.id, sentIndex: si, isWhole,
          en: isWhole ? sent.en : null,
          // A clause has no English of its own; the sentence it was cut from
          // does, and that is the context the child needs to know which
          // sentence is wanted.
          enContext: isWhole ? null : (sent.en || null),
          py: clause.map((t) => t.py).filter(Boolean).join(" "),
        });
        perGate.set(story.did, list);
      });
    });
  });
  return { perGate, allClauses };
}

function main() {
  const only = process.argv[2] ? [Number(process.argv[2])] : [1, 2, 3, 4];
  const built = sd.build();
  const dict = built.dict || built;
  const baseNames = built.names || {};
  const failures = [];
  let wrote = 0;

  only.forEach((lv) => {
    const { perGate, allClauses } = candidatesFor(lv, dict, baseNames);
    if (!allClauses.length) {
      console.log(`hsk${lv}: no story sources yet, so no packs — the fallback still applies here`);
      return;
    }
    const model = buildBigramModel(allClauses);
    const win = WINDOW[lv], maxChars = MAX_CHARS[lv];
    const file = path.join(ROOT, "data", `hsk${lv}.json`);
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    const levelFailures = [];

    // First pass: what each gate's own story can supply.
    const keptByGate = new Map();
    doc.gates.forEach((gate) => {
      const seen = new Set();
      const kept = [];
      (perGate.get(gate.gateId) || []).forEach((c) => {
        const answer = c.words.join("");
        if (seen.has(answer)) return;
        if (c.words.length < win.min || c.words.length > win.max) return;
        if ([...answer].length > maxChars) return;
        if (structuralReason(c.words)) return;
        if (hasLicensedAlternative(model, c.words)) return;
        seen.add(answer);
        kept.push(c);
      });
      // Whole sentences first: they carry the English that pins the meaning.
      kept.sort((a, b) => (b.isWhole ? 1 : 0) - (a.isWhole ? 1 : 0) || a.sentIndex - b.sentIndex);
      keptByGate.set(gate.gateId, kept);
    });

    // Second pass: pick, and let a short gate borrow from its neighbours in
    // the same level (nearest first). The stricter screens leave some gates
    // under three; the owner chose borrowing over editing the stories, so the
    // child still meets a sentence they have read at this level, and the hint
    // names the story it came from.
    doc.gates.forEach((gate) => {
      const own = keptByGate.get(gate.gateId) || [];
      const picked = own.slice(0, PER_GATE).map((c) => Object.assign({}, c, { borrowedFrom: null }));
      if (picked.length < MIN_PER_GATE) {
        const have = new Set(picked.map((c) => c.words.join("")));
        for (let dist = 1; dist <= 4 && picked.length < MIN_PER_GATE; dist++) {
          [gate.gateId - dist, gate.gateId + dist].forEach((gid) => {
            (keptByGate.get(gid) || []).forEach((c) => {
              if (picked.length >= MIN_PER_GATE) return;
              const answer = c.words.join("");
              if (have.has(answer)) return;
              have.add(answer);
              picked.push(Object.assign({}, c, { borrowedFrom: gid }));
            });
          });
        }
      }
      if (picked.length < MIN_PER_GATE) {
        levelFailures.push(
          `hsk${lv} gate ${gate.gateId}: only ${picked.length} usable sentence(s) with its neighbours; a round needs ${MIN_PER_GATE}`
        );
        return;
      }
      gate.sentenceTargetsPack = picked.map((c) => c.words.concat([FULL_STOP]));
      gate.sentenceTargetsMeta = {};
      picked.forEach((c) => {
        const answer = c.words.join("") + FULL_STOP;
        const alt = (ALTERNATES[answer] || []).filter((s) => isChipPermutation(c.words.concat([FULL_STOP]), s));
        gate.sentenceTargetsMeta[answer] = {
          py: c.py, en: c.en || null, enContext: c.enContext || null,
          storyId: c.storyId, sentIndex: c.sentIndex, whole: !!c.isWhole,
          borrowedFrom: c.borrowedFrom || null,
          alt: alt.length ? alt : undefined,
        };
      });
      wrote++;
    });

    if (levelFailures.length) { failures.push(...levelFailures); return; }
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
    console.log(`hsk${lv}: packs written for ${doc.gates.filter((g) => g.sentenceTargetsPack).length} gates`);
  });

  if (failures.length) {
    failures.forEach((f) => console.error(`  FAIL  ${f}`));
    console.error(
      `\n${failures.length} gate(s) cannot supply a round. Add a short sentence to that ` +
      `gate's story rather than relaxing the screens — a second right order scored wrong is §9.6.`
    );
    process.exit(1);
  }
  console.log(`sentence packs built for ${wrote} gate(s)`);
}

if (require.main === module) main();

module.exports = {
  buildBigramModel, licensed, hasLicensedAlternative, structuralReason, clausesOf, candidatesFor,
  isChipPermutation, mergeCompounds, compoundSet, posOf, WINDOW, MAX_CHARS, MIN_PER_GATE, PER_GATE,
};
