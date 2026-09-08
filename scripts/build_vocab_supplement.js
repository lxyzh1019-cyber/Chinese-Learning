#!/usr/bin/env node
"use strict";
/**
 * Merge `vocab-supplement.js` into the four curriculum files.
 *
 * Additive by construction: a word already taught anywhere is skipped, gates
 * keep every word they had, and nothing is reordered. Pinyin comes from the
 * upstream HSK list — the same source `build_hsk_curriculum.js` uses — and the
 * run FAILS if a supplement word is not in the upstream list at its stated
 * level, so a word cannot be invented or drift to the wrong level.
 *
 * Run with --check to report without writing.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const SUPPLEMENT = require("./vocab-supplement.js");
const CACHE = path.join(ROOT, "data", "upstream-hsk-cache.json");
const URL = (lv) =>
  `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/new/${lv}.json`;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`${url}: HTTP ${res.statusCode}`));
      // Without this, a chunk boundary inside a multi-byte character corrupts
      // it: 并 "b\u00ecng" shipped as "b\ufffd\ufffdng" in data/hsk2.json.
      res.setEncoding("utf8");
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

/** Pinyin for every supplement word, from upstream, cached so the build is
 *  reproducible offline and a network blip cannot silently change a reading. */
async function pinyinTable() {
  if (fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  const table = {};
  for (const lv of [1, 2, 3, 4]) {
    const raw = await fetchJson(URL(lv));
    table[lv] = {};
    for (const e of raw) {
      const f = (e.forms || [])[0] || {};
      const py = (f.transcriptions || {}).pinyin;
      if (e.simplified && py) table[lv][e.simplified] = py;
    }
  }
  fs.writeFileSync(CACHE, JSON.stringify(table, null, 2) + "\n");
  return table;
}

async function main() {
  const check = process.argv.includes("--check");
  const table = await pinyinTable();

  const taught = new Set();
  const docs = {};
  for (const lv of [1, 2, 3, 4]) {
    const p = path.join(ROOT, "data", `hsk${lv}.json`);
    docs[lv] = { path: p, doc: JSON.parse(fs.readFileSync(p, "utf8")) };
    for (const g of docs[lv].doc.gates) for (const w of g.newWords || []) taught.add(w.zh);
  }

  const problems = [];
  const additions = {};
  for (const lv of [1, 2, 3, 4]) {
    additions[lv] = [];
    for (const [zh, en] of Object.entries(SUPPLEMENT[lv])) {
      if (taught.has(zh)) continue;                 // already taught somewhere
      const py = (table[lv] || {})[zh];
      if (!py) { problems.push(`HSK${lv}: "${zh}" is not in the upstream HSK${lv} list`); continue; }
      if (!en || !String(en).trim()) { problems.push(`HSK${lv}: "${zh}" has no gloss`); continue; }
      // Upstream capitalises the proper-noun entry, and for 百 that entry is the
      // SURNAME reading — `validate_curriculum.js` rejects a capitalised reading
      // for exactly that reason. None of these words is a proper noun (the one
      // that was, 北京, is not in the list), so the common reading is the right
      // one and it is lower case.
      additions[lv].push({
        zh, pinyin: py.toLowerCase(), en,
        sourceLevel: `new-${lv}`,
        sourceTag: `HSK${lv}_ordinary`,
        tags: ["ordinary"],
        difficulty: zh.length <= 1 ? "easy" : zh.length === 2 ? "medium" : "hard",
        meta: { frequency: null, pos: [] },
      });
      taught.add(zh);
    }
  }

  if (problems.length) {
    problems.forEach((p) => console.error("  FAIL  " + p));
    console.error(`\nvocab supplement: ${problems.length} problem(s) — nothing written.`);
    process.exit(1);
  }

  for (const lv of [1, 2, 3, 4]) {
    const { doc } = docs[lv];
    const add = additions[lv];
    // Spread across the 22 gates so every gate gains a share, rather than
    // piling the new words onto the last gates a child would reach.
    doc.gates.forEach((g, i) => {
      const share = add.filter((_, j) => j % 22 === i);
      g.newWords = (g.newWords || []).concat(share);
    });
    doc.words = (doc.words || []).concat(add);
    doc.totalWords = doc.words.length;
    doc.gateDistribution = doc.gates.map((g) => g.newWords.length);
    const note = `+${add.length} ordinary words the 300-word frequency cut had dropped`;
    if (!doc.notes.includes(note)) doc.notes = doc.notes.concat(note);
    console.log(`HSK${lv}: +${add.length} -> ${doc.totalWords} words, gates ${Math.min(...doc.gateDistribution)}-${Math.max(...doc.gateDistribution)}`);
    if (!check) fs.writeFileSync(docs[lv].path, JSON.stringify(doc, null, 2) + "\n");
  }
  console.log(check ? "\n--check: nothing written." : "\nvocab supplement merged.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
