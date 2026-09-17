#!/usr/bin/env node
"use strict";
/**
 * Author a story as lines of tokens, and land it as reviewed `seg` JSON.
 *
 *   node scripts/seg_story.js draft content/stories/hsk1/qin.json > qin.txt
 *   node scripts/seg_story.js apply content/stories/hsk1/qin.json --from qin.txt
 *
 * The JSON in content/stories/ stays the source of truth: story-dictionary.js
 * reads it, reviewers diff it, and a rebuild reproduces it token for token.
 * This helper only removes the typing. `draft` prints the story in the line
 * format below, cut by longest match and glossed with the dictionary's
 * canonical meanings — a starting point a human corrects, never the result,
 * because the dictionary's gloss for 给 is "prepared" and the sentence's is
 * "for". `apply` reads the corrected lines and rewrites the file.
 *
 * Line format, one sentence per line:
 *
 *   很久以前，中国发了大水。| Long ago, a great flood came. | 很=very 久=long time 以前=before ， 中国=China 发=to happen 了=(shows it is finished) 大水=great flood 。
 *
 * Tokens are separated by a space; a gloss may contain spaces. `tok=gloss`
 * takes the reading from story-supplement.js or the dictionary; `tok/py=gloss`
 * states it. A token with no `=` takes the dictionary gloss and is reported,
 * because the point of this file is a gloss written for the sentence. Header
 * lines `title:`, `en:` and `name: 大禹 = Dà Yǔ = Dayu` set the story's title,
 * English title and proper nouns; `#` starts a comment.
 *
 * `bonus` is never typed. A token is bonus when the word is not in the gate
 * word lists at or below the story's level (data/hsk{lv}.json), so a child is
 * never required to learn an above-level word and it never enters a game.
 */
const fs = require("fs");
const path = require("path");
const D = require("./story-dictionary.js");
const SUPP = require("./story-supplement.js");

const ROOT = path.resolve(__dirname, "..");
const PUNCT = D.PUNCT;
const isPunct = (s) => [...s].every((c) => PUNCT.has(c));

function taughtAtOrBelow(level) {
  const set = new Set();
  for (let lv = 1; lv <= level; lv++) {
    const f = path.join(ROOT, "data", `hsk${lv}.json`);
    if (!fs.existsSync(f)) continue;
    (JSON.parse(fs.readFileSync(f, "utf8")).words || []).forEach((w) => set.add(w.zh));
  }
  return set;
}

// ── draft ───────────────────────────────────────────────────────────────
function draft(file) {
  const src = JSON.parse(fs.readFileSync(file, "utf8"));
  const { dict } = D.build();
  const out = [`title: ${src.title}`, `en: ${src.en}`];
  Object.entries(src.names || {}).forEach(([zh, v]) => out.push(`name: ${zh} = ${v.py} = ${v.en}`));
  out.push("");
  (src.sents || []).forEach((sent) => {
    const { tokens } = D.tokenize(sent.zh, dict, { names: src.names || {}, seg: sent.seg });
    const toks = tokens.map((t) => {
      if (t.t === "p") return t.tx;
      if (t.t === "n") return t.tx;
      return `${t.ch}=${t.mn || "???"}`;
    });
    // Merge runs of punctuation so “ and ： stay one visual unit: ：“
    const merged = [];
    toks.forEach((t) => {
      if (merged.length && isPunct(t) && isPunct(merged[merged.length - 1])) merged[merged.length - 1] += t;
      else merged.push(t);
    });
    out.push(`${sent.zh} | ${sent.en || ""} | ${merged.join(" ")}`);
  });
  process.stdout.write(out.join("\n") + "\n");
}

// ── apply ───────────────────────────────────────────────────────────────
// Split on whitespace that is followed by a Chinese character or a full-width
// mark: glosses are English, so a space inside one never precedes either.
const TOKEN_SPLIT = /\s+(?=[一-鿿　-〿＀-￯‘-”])/;

function parseText(text) {
  const story = { names: {}, lines: [] };
  text.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    let m;
    if ((m = line.match(/^title:\s*(.+)$/))) { story.title = m[1].trim(); return; }
    if ((m = line.match(/^en:\s*(.+)$/))) { story.en = m[1].trim(); return; }
    if ((m = line.match(/^name:\s*(\S+)\s*=\s*([^=]+?)\s*=\s*(.+)$/))) {
      story.names[m[1]] = { py: m[2].trim(), en: m[3].trim() }; return;
    }
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length !== 3) throw new Error(`line ${n + 1}: expected "zh | en | tokens", got ${parts.length} part(s)`);
    story.lines.push({ zh: parts[0], en: parts[1], toks: parts[2], n: n + 1 });
  });
  return story;
}

function apply(file, from) {
  const src = JSON.parse(fs.readFileSync(file, "utf8"));
  const text = fs.readFileSync(from, "utf8");
  const authored = parseText(text);
  const { dict } = D.build();
  const level = src.level || Number((file.match(/hsk(\d)/) || [])[1]) || 1;
  const taught = taughtAtOrBelow(level);
  const names = authored.names;
  const fellBack = [];
  const sents = [];

  authored.lines.forEach(({ zh, en, toks, n }) => {
    const seg = [];
    let rebuilt = "";
    toks.split(TOKEN_SPLIT).forEach((sp) => {
      if (isPunct(sp)) { [...sp].forEach((c) => { seg.push({ t: "p", tx: c }); rebuilt += c; }); return; }
      const m = sp.match(/^([^=/]+)(?:\/([^=]+))?(?:=(.*))?$/);
      if (!m) throw new Error(`line ${n}: cannot read token "${sp}"`);
      const word = m[1];
      if (names[word] && m[2] === undefined && m[3] === undefined) {
        seg.push({ t: "n", zh: word, py: names[word].py, mn: names[word].en }); rebuilt += word; return;
      }
      const py = m[2] || (SUPP[word] && SUPP[word].py) || (dict[word] && dict[word].py);
      let mn = m[3];
      if (mn === undefined) {
        mn = (SUPP[word] && SUPP[word].en) || (dict[word] && dict[word].en);
        if (mn) fellBack.push(`${word} "${mn}"`);
      }
      if (!py) throw new Error(`line ${n}: no reading for "${word}" — state it as ${word}/pīn yīn=gloss, or add it to scripts/story-supplement.js`);
      if (!mn) throw new Error(`line ${n}: no gloss for "${word}"`);
      const tok = { zh: word, py: py.trim(), mn: mn.trim() };
      if (!taught.has(word)) tok.bonus = true;
      seg.push(tok); rebuilt += word;
    });
    if (rebuilt !== zh) throw new Error(`line ${n}: tokens spell "${rebuilt}" but the sentence is "${zh}"`);
    if (!en) throw new Error(`line ${n}: no English`);
    sents.push({ zh, en, seg });
  });

  const out = {
    id: src.id, did: src.did, level,
    title: authored.title || src.title, en: authored.en || src.en,
    names, sents,
  };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  const study = sents.flatMap((s) => s.seg).filter((t) => !t.t && !t.bonus).length;
  const bonus = [...new Set(sents.flatMap((s) => s.seg).filter((t) => t.bonus).map((t) => t.zh))];
  console.log(`${path.basename(file)}: ${sents.length} sentences · ${study} study tokens · bonus: ${bonus.join(" ") || "none"}`);
  if (fellBack.length) console.log(`  took the dictionary gloss (write one for the sentence?): ${[...new Set(fellBack)].join(", ")}`);
}

function main() {
  const [mode, file, flag, from] = process.argv.slice(2);
  if (mode === "draft" && file) return draft(file);
  if (mode === "apply" && file && flag === "--from" && from) return apply(file, from);
  console.error("usage:\n  seg_story.js draft <story.json>\n  seg_story.js apply <story.json> --from <lines.txt>");
  process.exit(2);
}
if (require.main === module) main();
module.exports = { parseText, apply, draft };
