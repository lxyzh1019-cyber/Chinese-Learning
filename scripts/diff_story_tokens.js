#!/usr/bin/env node
"use strict";
/**
 * What a story rebuild changed, token by token.
 *
 *   node scripts/diff_story_tokens.js <(git show main:data/stories/hsk2.json) data/stories/hsk2.json
 *   node scripts/diff_story_tokens.js before.json after.json --skip xia-h1,xia2-h1
 *
 * The dictionary every un-segged sentence is cut against is assembled from the
 * segged sentences, first file wins. So editing one story's seg can re-cut or
 * re-gloss a sentence in a story nobody touched, at another level. PR #51
 * found that by hand; this prints it: the sentences whose segmentation changed
 * (shown in full, old and new) and every gloss or reading change, grouped by
 * word with a count. Nothing here decides whether a change is good — that is
 * the reviewer's job — but nothing changes unseen.
 */
const fs = require("fs");

const args = process.argv.slice(2);
const skipIdx = args.indexOf("--skip");
const skip = new Set(skipIdx >= 0 ? args[skipIdx + 1].split(",") : []);
const files = args.filter((a, i) => a !== "--skip" && i !== skipIdx + 1);
if (files.length !== 2) {
  console.error("usage: diff_story_tokens.js <before.json> <after.json> [--skip id,id]");
  process.exit(2);
}
const load = (f) => JSON.parse(fs.readFileSync(f, "utf8")).stories || {};
const a = load(files[0]), b = load(files[1]);
const show = (s) => s.map((t) => (t.t === "p" ? t.tx : `${t.ch || t.tx}[${t.mn}]`)).join("");

let resegmented = 0;
const changes = {};
for (const key of Object.keys(a)) {
  if (skip.has(key)) continue;
  if (!b[key]) { console.log(`- ${key}: removed`); continue; }
  a[key].sents.forEach((s, i) => {
    const u = b[key].sents[i];
    if (!u) { console.log(`- ${key} ${i + 1}: sentence removed`); return; }
    if (JSON.stringify(s) === JSON.stringify(u)) return;
    if (s.length !== u.length || s.some((t, j) => (t.ch || t.tx) !== (u[j].ch || u[j].tx))) {
      resegmented++;
      console.log(`re-cut ${key} ${i + 1}\n  old ${show(s)}\n  new ${show(u)}`);
      return;
    }
    s.forEach((t, j) => {
      const v = u[j];
      if (t.t === "p") return;
      const what = [];
      if (t.mn !== v.mn) what.push(`${t.mn} -> ${v.mn}`);
      if (t.py !== v.py) what.push(`[${t.py} -> ${v.py}]`);
      if (!!t.bonus !== !!v.bonus) what.push(v.bonus ? "(now bonus)" : "(no longer bonus)");
      if (!what.length) return;
      const k = `${t.ch || t.tx}: ${what.join(" ")}`;
      changes[k] = (changes[k] || 0) + 1;
    });
  });
}
for (const key of Object.keys(b)) if (!a[key]) console.log(`+ ${key}: new`);
const rows = Object.entries(changes).sort((x, y) => y[1] - x[1]);
console.log(`\n${resegmented} sentence(s) re-cut · ${rows.length} distinct token change(s)`);
rows.forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
