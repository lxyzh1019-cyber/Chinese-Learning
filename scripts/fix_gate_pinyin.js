#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
const FILES = ["hsk1.json", "hsk2.json", "hsk3.json", "hsk4.json"];

function processFile(name) {
  const filePath = path.join(DATA, name);
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));

  // Build canonical map from doc.words (the authoritative learner-facing list)
  const canonical = {};
  for (const w of doc.words) {
    if (w.zh && !canonical[w.zh]) {
      canonical[w.zh] = { pinyin: w.pinyin || w.py || "", en: w.en || "" };
    }
  }

  let fixCount = 0;
  for (const gate of doc.gates) {
    for (const field of ["newWords", "reviewWords"]) {
      for (const w of gate[field] || []) {
        const canon = canonical[w.zh];
        if (!canon) continue;
        const gatePy = (w.pinyin || w.py || "").trim();
        if (gatePy.toLowerCase() !== canon.pinyin.toLowerCase()) {
          console.log(
            `${name} gate ${gate.gateId} ${field}: ${w.zh} "${gatePy}" → "${canon.pinyin}" (was: "${w.en}")`
          );
          w.pinyin = canon.pinyin;
          if (w.py !== undefined) w.py = canon.pinyin;
          w.en = canon.en;
          fixCount++;
        }
      }
    }
  }

  if (fixCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log(`  → wrote ${name} (${fixCount} fixes)\n`);
  } else {
    console.log(`${name}: no mismatches found\n`);
  }
}

for (const f of FILES) {
  processFile(f);
}
console.log("Done.");
