"use strict";
/**
 * The character and word dictionary stories are tokenized against.
 *
 * Authoring a story means writing Chinese prose; turning that prose into the
 * app's `{t, ch, py, mn}` tokens means knowing a reading and a gloss for every
 * span. Guessing those is exactly how the gate vocabulary shipped 水 glossed
 * "surname Shui" — 297 junk rows across 113 characters, repaired in an earlier
 * pass and guarded by validate_curriculum.js since.
 *
 * So nothing here is generated. The dictionary is assembled ONLY from sources
 * that have already been curated and validated:
 *
 *   1. the 44 authored stories (hand-tokenized, per-character readings),
 *   2. data/hsk{1..4}.json gate word lists (repaired and validated),
 *   3. scripts/vocab-overrides.js (the curated corrections),
 *
 * in that order of precedence — a story's own reading of a character beats a
 * dictionary entry, because it was written in context.
 *
 * build_stories.js FAILS on any span this cannot resolve. That failure is the
 * point: it says "a human has to gloss this", not "make something up".
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function addEntry(dict, zh, py, en, source) {
  if (!zh || !py) return;
  const key = String(zh).trim();
  const pinyin = String(py).trim();
  const gloss = String(en == null ? "" : en).trim();
  if (!key || !pinyin) return;
  if (dict[key]) return;                 // first source wins
  dict[key] = { zh: key, py: pinyin, en: gloss, source };
}

/**
 * Readings taken from the authored sources, where they were written in context.
 *
 * Reads content/stories/, NOT data/stories/. The built corpus is this script's
 * own downstream output: sourcing from it means rewriting a story silently
 * shrinks the dictionary that the next build depends on, so an edit in one
 * story can break an unrelated one. The authored sources are the stable input.
 */
function fromStories(dict) {
  const root = path.join(ROOT, "content", "stories");
  if (!fs.existsSync(root)) return 0;
  let n = 0;
  fs.readdirSync(root).forEach((levelDir) => {
    const dir = path.join(root, levelDir);
    if (!fs.statSync(dir).isDirectory()) return;
    fs.readdirSync(dir).filter((f) => f.endsWith(".json")).forEach((f) => {
      const src = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      (src.sents || []).forEach((sent) => {
        (sent.seg || []).forEach((tok) => {
          if (!tok || typeof tok !== "object" || tok.t === "p") return;
          const zh = tok.zh;
          if (!zh || !tok.py) return;
          if (!dict[zh]) n++;
          addEntry(dict, zh, tok.py, tok.mn, "story");
        });
      });
    });
  });
  return n;
}

/** The gate word lists the games and quizzes already serve. */
function fromCurriculum(dict) {
  let n = 0;
  for (const lv of [1, 2, 3, 4]) {
    const file = path.join(ROOT, "data", `hsk${lv}.json`);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    (data.gates || []).forEach((g) => {
      (g.newWords || []).forEach((w) => {
        if (!dict[w.zh]) n++;
        addEntry(dict, w.zh, w.pinyin || w.py, w.en, `hsk${lv}`);
      });
    });
  }
  return n;
}

/** The curated corrections. Highest trust, so they override on conflict. */
function fromOverrides(dict) {
  const file = path.join(ROOT, "scripts", "vocab-overrides.js");
  if (!fs.existsSync(file)) return 0;
  const mod = require(file);
  const rows = mod.OVERRIDES || mod.overrides || mod;
  let n = 0;
  Object.entries(rows || {}).forEach(([zh, v]) => {
    if (!v || typeof v !== "object") return;
    const py = v.pinyin || v.py;
    if (!py) return;
    dict[zh] = { zh, py: String(py).trim(), en: String(v.en || "").trim(), source: "override" };
    n++;
  });
  return n;
}

function build() {
  const dict = {};
  const stats = {};
  stats.overrides = fromOverrides(dict);
  stats.stories = fromStories(dict);
  stats.curriculum = fromCurriculum(dict);
  stats.total = Object.keys(dict).length;
  stats.singleChar = Object.keys(dict).filter((k) => [...k].length === 1).length;
  return { dict, stats };
}

/**
 * Longest-match segmentation against the dictionary.
 * Returns { tokens, unknown } — `unknown` is the list of spans that must be
 * glossed by hand before the story can be built.
 */
// Includes the ASCII quotes, because authored prose and the existing corpus
// both use them for speech.
const PUNCT = new Set([..."，。！？、；：“”‘’\"'（）()—…《》〈〉·、"]);
const MAX_WORD = 4;
// A proper noun can be longer than a word and can contain punctuation —
// 马可·波罗 is one name, and splitting it on the interpunct loses the person.
const MAX_NAME = 12;

/**
 * @param opts.seg  explicit spans for this sentence. The 44 original stories
 *   were hand-tokenized and reviewed, and longest-match would re-cut them —
 *   merging 工 + 作 into 工作 changes what the child taps and what the flash
 *   deck teaches. Extraction records their segmentation so a rebuild reproduces
 *   them exactly; newly authored sentences omit it and get longest-match.
 */
function tokenize(text, dict, opts) {
  opts = opts || {};
  const names = opts.names || {};        // { "大禹": {py, en} } proper nouns
  const bonus = new Set(opts.bonus || []); // spans marked as optional
  if (opts.seg && opts.seg.length) return tokenizeSegmented(opts.seg, dict, names, bonus);
  const chars = [...String(text)];
  const tokens = [];
  const unknown = [];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];

    // Names first: they win over both punctuation and the dictionary, so a name
    // carrying an interpunct survives and a name that happens to contain a
    // common word is not shredded into its parts.
    let named = null;
    for (let len = Math.min(MAX_NAME, chars.length - i); len >= 1; len--) {
      const span = chars.slice(i, i + len).join("");
      if (names[span]) { named = { span, entry: names[span] }; break; }
    }
    if (named) {
      tokens.push({ t: "n", tx: named.span, py: named.entry.py, mn: named.entry.en });
      i += [...named.span].length;
      continue;
    }

    if (PUNCT.has(c)) { tokens.push({ t: "p", tx: c }); i++; continue; }
    if (/\s/.test(c)) { i++; continue; }

    let matched = null;
    for (let len = Math.min(MAX_WORD, chars.length - i); len >= 1; len--) {
      const span = chars.slice(i, i + len).join("");
      if (dict[span]) { matched = { span, entry: dict[span], proper: false }; break; }
    }
    if (!matched) { unknown.push(c); i++; continue; }

    const { span, entry } = matched;
    if (bonus.has(span)) tokens.push({ t: "c", ch: span, py: entry.py, mn: entry.en, bonus: true });
    else tokens.push({ t: "c", ch: span, py: entry.py, mn: entry.en });
    i += [...span].length;
  }
  return { tokens, unknown };
}

/**
 * Tokenize a sentence whose spans are already decided.
 *
 * A span may be a bare string (look the reading up) or `{zh, py, mn}` (use
 * these). The explicit form matters: the authored corpus glosses in context —
 * 很多人 is "people", not "person"; 三十年 is "years", not "year" — and a
 * dictionary lookup flattens all of that to one canonical gloss. Context is
 * the more useful thing to show a child, so it wins.
 */
function tokenizeSegmented(seg, dict, names, bonus) {
  const tokens = [];
  const unknown = [];
  seg.forEach((span) => {
    if (span && typeof span === "object") {
      if (span.t === "p") { tokens.push({ t: "p", tx: span.tx }); return; }
      const tok = span.t === "n"
        ? { t: "n", tx: span.zh, py: span.py, mn: span.mn }
        : { t: "c", ch: span.zh, py: span.py, mn: span.mn };
      if (span.bonus) tok.bonus = true;
      if (!span.py) unknown.push(span.zh);
      tokens.push(tok);
      return;
    }
    if (names[span]) { tokens.push({ t: "n", tx: span, py: names[span].py, mn: names[span].en }); return; }
    if ([...span].every((c) => PUNCT.has(c))) { [...span].forEach((c) => tokens.push({ t: "p", tx: c })); return; }
    const entry = dict[span];
    if (!entry) { unknown.push(span); return; }
    const tok = { t: "c", ch: span, py: entry.py, mn: entry.en };
    if (bonus.has(span)) tok.bonus = true;
    tokens.push(tok);
  });
  return { tokens, unknown };
}

module.exports = { build, tokenize, tokenizeSegmented, PUNCT };

if (require.main === module) {
  const { stats } = build();
  console.log("story dictionary");
  console.log(`  from curated overrides : ${stats.overrides}`);
  console.log(`  from authored stories  : ${stats.stories}`);
  console.log(`  from gate word lists   : ${stats.curriculum}`);
  console.log(`  total entries          : ${stats.total} (${stats.singleChar} single characters)`);
}
