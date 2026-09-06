#!/usr/bin/env node
"use strict";
/**
 * Apply the curated vocabulary corrections to data/hsk*.json.
 *
 *   node scripts/repair_vocab.js --check    report only, change nothing
 *   node scripts/repair_vocab.js            apply and write a review ledger
 *
 * Both the `words[]` array and the `gates[].newWords/reviewWords` copies are
 * repaired. The gates copies matter most: they are what the games actually
 * serve, and they were roughly nine times dirtier than the array an audit
 * naturally inspects.
 *
 * Every change is recorded in docs/vocab-repair-ledger.md with the before and
 * after, so a reviewer can check the judgement rather than trust it.
 */
const fs = require("fs");
const path = require("path");
const OVERRIDES = require("./vocab-overrides.js");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const CHECK = process.argv.includes("--check");

const JUNK = /variant of|abbr\.|surname|old variant|^used in /i;
const PROPER_PY = /^[A-Z]/;

const changes = [];

function repairWord(w, where) {
  const o = OVERRIDES[w.zh];
  if (!o) return false;
  const beforePy = w.pinyin, beforeEn = w.en;
  const needsPy = beforePy !== o.py;
  const needsEn = beforeEn !== o.en;
  if (!needsPy && !needsEn) return false;
  changes.push({ where, zh: w.zh, beforePy, afterPy: o.py, beforeEn, afterEn: o.en });
  w.pinyin = o.py;
  w.en = o.en;
  return true;
}

function main() {
  let touched = 0, remaining = 0;

  for (const lv of [1, 2, 3, 4]) {
    const file = path.join(DATA, `hsk${lv}.json`);
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));

    (doc.words || []).forEach((w) => { if (repairWord(w, `hsk${lv}.words`)) touched++; });
    (doc.gates || []).forEach((g) => {
      (g.newWords || []).forEach((w) => { if (repairWord(w, `hsk${lv}.gate${g.gateId}.newWords`)) touched++; });
      (g.reviewWords || []).forEach((w) => { if (repairWord(w, `hsk${lv}.gate${g.gateId}.reviewWords`)) touched++; });
    });

    const stillBad = [];
    const check = (w) => {
      // A capitalised reading is only a defect when it displaced the common
      // word. Genuine proper nouns are declared in the override table.
      const allowedProper = OVERRIDES[w.zh] && OVERRIDES[w.zh].proper;
      if (JUNK.test(w.en || "")) { stillBad.push(w.zh); return; }
      if (PROPER_PY.test((w.pinyin || "").trim()) && !allowedProper) stillBad.push(w.zh);
    };
    (doc.words || []).forEach(check);
    (doc.gates || []).forEach((g) => {
      (g.newWords || []).forEach(check); (g.reviewWords || []).forEach(check);
    });
    remaining += stillBad.length;
    console.log(`hsk${lv}: ${stillBad.length} defective row(s) remaining` +
      (stillBad.length ? ` — ${[...new Set(stillBad)].slice(0, 8).join(" ")}` : ""));

    if (!CHECK) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  }

  console.log(`\n${CHECK ? "would repair" : "repaired"} ${touched} row(s) using ${Object.keys(OVERRIDES).length} curated entries`);

  if (!CHECK) writeLedger();
  if (remaining) { console.error(`\n${remaining} row(s) still defective — add them to scripts/vocab-overrides.js`); process.exit(1); }
}

function writeLedger() {
  const byChar = {};
  changes.forEach((c) => {
    if (!byChar[c.zh]) byChar[c.zh] = { zh: c.zh, beforePy: c.beforePy, afterPy: c.afterPy, beforeEn: c.beforeEn, afterEn: c.afterEn, places: [] };
    byChar[c.zh].places.push(c.where);
  });
  const rows = Object.values(byChar).sort((a, b) => a.zh.localeCompare(b.zh));
  const out = [
    "# Vocabulary repair ledger",
    "",
    "Every change `scripts/repair_vocab.js` made, with the imported value and the",
    "one that replaced it. Generated — edit `scripts/vocab-overrides.js`, not this",
    "file.",
    "",
    "The imported senses are not wrong in a dictionary. They are wrong as the",
    "**default** a beginner meets first: the curriculum was built by ranking a",
    "CC-CEDICT-derived list and taking whichever sense came first, which for common",
    "characters is very often the surname, an abbreviation, or a cross-reference.",
    "",
    `Reviewed by: model. **No educator has checked these.**`,
    "",
    `${rows.length} distinct entries corrected across ${changes.length} rows.`,
    "",
    "| Character | Was | Now | Rows fixed |",
    "|---|---|---|---:|",
    ...rows.map((r) =>
      `| ${r.zh} | \`${r.beforePy}\` — ${r.beforeEn.replace(/\|/g, "\\|").slice(0, 60)} | \`${r.afterPy}\` — ${r.afterEn.replace(/\|/g, "\\|")} | ${r.places.length} |`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, "docs", "vocab-repair-ledger.md"), out);
  console.log(`wrote docs/vocab-repair-ledger.md (${rows.length} entries)`);
}

main();
