#!/usr/bin/env node
"use strict";
/**
 * Write the authored culture readings into data/culture_stories.json.
 *
 * The file previously held 29 copies of one template: paragraphs two and three
 * were byte-identical everywhere, paragraph one was the title dropped into a
 * fixed sentence, and both "comprehension" questions asked about the reading
 * instructions rather than the reading. A child could finish every one of them
 * and have learnt nothing about any solar term.
 *
 * Everything except the text is left alone — ids, seasons, bands, reward
 * amounts and the track structure are the app's, not this script's. It fails
 * rather than inventing when an entry has no authored text, so a new entry
 * cannot quietly ship as a stub.
 */
const fs = require("fs");
const path = require("path");
const CONTENT = require("./culture-content.js");

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "data", "culture_stories.json");

function main() {
  const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const missing = [];
  let written = 0;

  (doc.tracks || []).forEach((track) => {
    (track.stories || []).forEach((story) => {
      const c = CONTENT[story.id];
      if (!c) { missing.push(story.id); return; }
      story.readerParagraphs = c.paragraphs.slice();
      story.targetWords = c.words.map((w) => ({ zh: w.zh, py: w.py, en: w.en }));
      story.readerComprehension = c.questions.map((q) => ({ question: q.question, answer: q.answer }));
      written++;
    });
  });

  if (missing.length) {
    missing.forEach((id) => console.error(`  FAIL  ${id}: no authored text in scripts/culture-content.js`));
    console.error(`\n${missing.length} culture reading(s) would ship as a template. Write the text first.`);
    process.exit(1);
  }

  fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
  console.log(`culture readings written: ${written}`);
}

main();
