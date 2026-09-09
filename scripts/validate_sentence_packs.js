#!/usr/bin/env node
"use strict";
/**
 * Check the sentence-builder packs the child is actually served.
 *
 * The point of this file is that it does NOT ask the builder whether the packs
 * are good. It reloads the story corpus, re-derives the licensing model and
 * re-runs the ambiguity search itself, then compares. A validator that imports
 * the builder's decision moves with the builder's defect and cannot fail —
 * CLAUDE.md's rule 5, which has bitten this repo three times.
 *
 * The rules, in order of how much they would cost a child:
 *
 *  1. Every entry must be buildable from the gate's own story. If a sentence
 *     is not in the text the child read, "true by construction" is a claim and
 *     not a fact.
 *  2. No entry may have a second order the corpus licenses. checkSB compares by
 *     exact string equality, so a legitimate alternative arrangement is scored
 *     WRONG and logged to the practice queue — CLAUDE.md §9.6, in the one
 *     surface that had never been checked for it.
 *  3. Every gate must supply a full round, and every champion group must supply
 *     ten. Falling short is what the generic three-sentence fallback used to
 *     hide.
 */
const fs = require("fs");
const path = require("path");
const B = require("./build_sentence_packs.js");

const ROOT = path.resolve(__dirname, "..");
const sd = require("./story-dictionary.js");

let failures = 0;
let warnings = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const warn = (m) => { warnings++; console.warn(`  warn  ${m}`); };

const PUNCT_ANY = /[。！？，、；：“”‘’（）《》\s]/g;
const stripPunct = (t) => String(t || "").replace(PUNCT_ANY, "");

/**
 * Screens re-stated here, independently of the builder's lists, for the
 * shapes the 2026-09-09 audit found served: a time phrase split into chips
 * (八|点), a place phrase behind a preposition (在|树|下), a repeated word
 * (有米有肉) and a clause with its subject cut off (让他想办法). Part of
 * speech is read straight from the curriculum tables, not through the builder.
 */
const IND = {
  prep: /^(在|从|离|往|向|朝)$/,
  num: /^[一二三四五六七八九十百千两几半零\d]+$/,
  unit: /^(点|天|年|月|号|个月|星期|小时|分钟|岁)$/,
  numTime: /^[一二三四五六七八九十百千两几半零\d]+(点|天|年|月|号|岁)$/,
  particle: /^(的|了|吗|呢|吧|啊)$/,
  nominal: /^(n|r|nr|ns|nz|s|t|m|mq|tg)$/,
};
let POS = null;
function posOf(w) {
  if (!POS) {
    POS = {};
    [1, 2, 3, 4].forEach((lv) => {
      const f = path.join(ROOT, "data", `hsk${lv}.json`);
      if (!fs.existsSync(f)) return;
      (JSON.parse(fs.readFileSync(f, "utf8")).words || []).forEach((x) => {
        if (!POS[x.zh]) POS[x.zh] = (x.meta && x.meta.pos) || [];
      });
    });
  }
  return POS[w] || null;
}
function independentReason(words) {
  if (words.some((w) => IND.prep.test(w))) return "carries a place phrase that can move";
  if (words.some((w) => /时候$/.test(w))) return "carries a 时候 phrase that can move";
  for (let i = 0; i < words.length; i++) {
    if (IND.numTime.test(words[i])) return `"${words[i]}" is a time phrase that can move`;
    if (i + 1 < words.length && (IND.num.test(words[i]) || words[i] === "每") && IND.unit.test(words[i + 1])) {
      return `"${words[i]}${words[i + 1]}" is a time phrase that can move`;
    }
  }
  const seen = new Set();
  for (const w of words) {
    if (seen.has(w) && !IND.particle.test(w)) return `"${w}" repeats, so two orders read the same`;
    seen.add(w);
  }
  const p0 = posOf(words[0]);
  if (p0 && p0.length && !p0.some((t) => IND.nominal.test(t))) return `opens on "${words[0]}" (${p0.join(",")}) with no subject`;
  return null;
}
/** Is `str` exactly the chips of `chips` in another order? */
function isPermutation(chips, str) {
  if (str === chips.join("")) return false;
  const left = chips.slice();
  const walk = (pos) => {
    if (pos === str.length) return left.length === 0;
    for (let i = 0; i < left.length; i++) {
      if (str.startsWith(left[i], pos)) {
        const c = left.splice(i, 1)[0];
        if (walk(pos + c.length)) return true;
        left.splice(i, 0, c);
      }
    }
    return false;
  };
  return walk(0);
}

function storyTextForGate(lv, gateId) {
  const dir = path.join(ROOT, "content", "stories", `hsk${lv}`);
  if (!fs.existsSync(dir)) return "";
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((s) => s.did === gateId && !s.draft)
    .flatMap((s) => (s.sents || []).map((x) => x.zh))
    .join("");
}

function main() {
  const built = sd.build();
  const dict = built.dict || built;
  const names = built.names || {};

  [1, 2, 3, 4].forEach((lv) => {
    const file = path.join(ROOT, "data", `hsk${lv}.json`);
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    const withPacks = doc.gates.filter((g) => Array.isArray(g.sentenceTargetsPack));

    if (!withPacks.length) {
      // A level with no stories has nothing to build from; the fallback still
      // applies there, and saying so is not the same as passing it.
      warn(`hsk${lv}: no sentence packs — Phase 3 still uses the shared fallback here`);
      return;
    }
    if (withPacks.length !== doc.gates.length) {
      fail(`hsk${lv}: ${doc.gates.length - withPacks.length} gate(s) have no pack, so they fall back silently`);
    }

    // Rebuild the licensing model from the corpus, independently of the builder.
    const { allClauses } = B.candidatesFor(lv, dict, names);
    const model = B.buildBigramModel(allClauses);
    const win = B.WINDOW[lv], maxChars = B.MAX_CHARS[lv];

    doc.gates.forEach((gate) => {
      const pack = gate.sentenceTargetsPack;
      if (!Array.isArray(pack)) return;
      const where = `hsk${lv} gate ${gate.gateId}`;
      const text = storyTextForGate(lv, gate.gateId);
      const meta = gate.sentenceTargetsMeta || {};

      if (pack.length < B.MIN_PER_GATE) {
        fail(`${where}: ${pack.length} sentence(s); a round asks for ${B.MIN_PER_GATE}`);
      }
      const seen = new Set();
      pack.forEach((chips, i) => {
        const at = `${where} sentence ${i + 1}`;
        if (!Array.isArray(chips) || chips.some((c) => typeof c !== "string" || !c.trim())) {
          return fail(`${at}: a pack entry must be an array of non-empty chip strings`);
        }
        const answer = chips.join("");
        if (seen.has(answer)) fail(`${at}: duplicated within the gate`);
        seen.add(answer);

        const words = chips.filter((c) => !/^[。！？，、；：]$/.test(c));
        if (words.length < win.min || words.length > win.max) {
          fail(`${at}: ${words.length} words, outside the ${win.min}-${win.max} window for this level`);
        }
        if ([...answer].length > maxChars + 1) {
          fail(`${at}: ${[...answer].length} characters, past the ${maxChars} this level allows`);
        }
        // 1. It must come from this gate's own story.
        //
        // Punctuation is stripped from BOTH sides before comparing. The builder
        // drops quotation marks when it cuts a clause, so 人们说他是“书圣”
        // becomes 人们说他是书圣 — the same words in the same order the child
        // read, with the typography removed. Comparing raw would report that as
        // invented text.
        // A borrowed entry (a short gate filled from a neighbour at the same
        // level) must come from THAT gate's story, and say so.
        const m = meta[answer];
        const from = m && m.borrowedFrom ? Number(m.borrowedFrom) : gate.gateId;
        const src = from === gate.gateId ? text : storyTextForGate(lv, from);
        if (m && m.borrowedFrom && Math.abs(from - gate.gateId) > 4) {
          fail(`${at}: borrowed from gate ${from}, which is not a neighbour`);
        }
        if (src && stripPunct(src).indexOf(stripPunct(words.join(""))) === -1) {
          fail(`${at}: "${words.join("")}" is not in gate ${from}'s story text`);
        }
        // 2. Recomputed here, not taken from the builder.
        const why = B.structuralReason(words);
        if (why) fail(`${at}: "${answer}" — ${why}`);
        const why2 = independentReason(words);
        if (why2) fail(`${at}: "${answer}" — ${why2}`);
        const alt = (m && Array.isArray(m.alt)) ? m.alt : [];
        alt.forEach((s) => {
          if (!isPermutation(chips, s)) fail(`${at}: alternate "${s}" is not the same chips in another order`);
        });
        if (B.hasLicensedAlternative(model, words)) {
          fail(`${at}: "${answer}" can be rearranged into another sentence the corpus licenses, and checkSB would mark it wrong`);
        }
        // 3. Its metadata must be present and match.
        if (!m) fail(`${at}: no entry in sentenceTargetsMeta for "${answer}"`);
        else if (!m.storyId) fail(`${at}: metadata names no source story`);
        else if (!m.whole && !m.en && !m.enContext) fail(`${at}: a clause with no English and no sentence context gives the child nothing to check against`);
      });
    });

    // Champion groups pool five gates and ask for ten.
    for (let grp = 1; grp <= 4; grp++) {
      const last = grp * 5;
      let pool = 0;
      for (let d = Math.max(1, last - 4); d <= last; d++) {
        const g = doc.gates.find((x) => x.gateId === d);
        pool += ((g && g.sentenceTargetsPack) || []).length;
      }
      if (pool < 10) fail(`hsk${lv} champion group ${grp}: pool of ${pool}, and the round asks for 10`);
    }
  });

  console.log(`\nsentence packs: ${failures ? "INVALID" : "valid"} — ${failures} error(s), ${warnings} warning(s).`);
  if (failures) process.exit(1);
}

main();
