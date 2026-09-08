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

/**
 * A gloss this dictionary will not carry.
 *
 * The point of the dictionary is that the build never invents a meaning, so it
 * must not launder one either. Staged sources — the HSK3 seeds are 22 files of
 * pre-repair text — still hold 218 fragment glosses (史 "-tory", 治 "-rule"),
 * and admitting them would feed exactly the class of defect the corpus was just
 * cleaned of back into the next story built. Filtering on the GLOSS rather than
 * on which file it came from is the invariant that actually holds.
 */
function isJunkGloss(en) {
  const t = String(en == null ? "" : en).trim();
  if (!t) return true;
  if (/^[-—]/.test(t)) return true;            // trailing half: 学习 -> 习 "-tice"
  // Leading half: 皇帝 "emperor" -> 皇 "em-", 丝绸 -> 丝 "silk-", 太阳 -> 太 "Tai-".
  // One word ending in a hyphen and nothing else; a genuine gloss that uses a
  // prefix ("not; non-") carries more than that single token.
  // Allows an internal period, so 先生 "Mr." leaving 先 as "Mr.-" is caught too.
  // A genuine gloss that ends in a prefix ("not; non-", "again; once more; re-")
  // carries more than this one token and is left alone.
  if (/^[A-Za-z.]+-$/.test(t)) return true;
  if (/^[A-Z]{2,5}$/.test(t)) return true;     // a grammar code
  if (/surname/i.test(t)) return true;         // the 水 "surname Shui" class
  return false;
}

function addEntry(dict, zh, py, en, source) {
  if (!zh || !py) return;
  const key = String(zh).trim();
  const pinyin = String(py).trim();
  const gloss = String(en == null ? "" : en).trim();
  if (!key || !pinyin) return;
  if (isJunkGloss(gloss)) return;
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
  // Deterministic order, lowest level first. `readdirSync` does not promise an
  // order, and first-source-wins means the order DECIDES the gloss wherever two
  // levels gloss the same span differently — so an unsorted read made the built
  // corpus depend on the filesystem, contradicting the reproducibility this
  // whole toolchain exists to give.
  const levelDirs = fs.readdirSync(root)
    .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
    .sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 99) - (parseInt(b.replace(/\D/g, ""), 10) || 99));
  levelDirs.forEach((levelDir) => {
    const dir = path.join(root, levelDir);
    fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().forEach((f) => {
      const src = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      (src.sents || []).forEach((sent) => {
        (sent.seg || []).forEach((tok) => {
          if (!tok || typeof tok !== "object" || tok.t === "p") return;
          const zh = tok.zh;
          if (!zh || !tok.py) return;
          const before = Object.keys(dict).length;
          addEntry(dict, zh, tok.py, tok.mn, "story");
          if (Object.keys(dict).length > before) n++;
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
        const before = Object.keys(dict).length;
        addEntry(dict, w.zh, w.pinyin || w.py, w.en, `hsk${lv}`);
        if (Object.keys(dict).length > before) n++;
      });
    });
  }
  return n;
}

/** The curated corrections. Highest trust, so they override on conflict. */
/**
 * The curated corrections. Highest trust, so they override on conflict.
 *
 * An override may state only a gloss. Those used to be dropped outright — a
 * gloss-only correction did nothing and nothing said so — so they are collected
 * and applied after every other source has supplied the reading.
 */
function readOverrides() {
  const file = path.join(ROOT, "scripts", "vocab-overrides.js");
  if (!fs.existsSync(file)) return { full: {}, glossOnly: {} };
  const rows = require(file);
  const full = {}, glossOnly = {};
  Object.entries(rows || {}).forEach(([zh, v]) => {
    if (!v || typeof v !== "object") return;
    const py = v.pinyin || v.py;
    if (py) full[zh] = { py: String(py).trim(), en: String(v.en || "").trim() };
    else if (v.en) glossOnly[zh] = String(v.en).trim();
  });
  return { full, glossOnly };
}

function fromOverrides(dict, full) {
  let n = 0;
  Object.entries(full).forEach(([zh, v]) => {
    dict[zh] = { zh, py: v.py, en: v.en, source: "override" };
    n++;
  });
  return n;
}

/** Apply gloss-only corrections to whatever reading the other sources gave. */
function applyGlossOverrides(dict, glossOnly) {
  const unused = [];
  Object.entries(glossOnly).forEach(([zh, en]) => {
    if (!dict[zh]) { unused.push(zh); return; }
    dict[zh] = Object.assign({}, dict[zh], { en, source: `${dict[zh].source}+override` });
  });
  return unused;
}

function build() {
  const dict = {};
  const stats = {};
  const { full, glossOnly } = readOverrides();
  stats.overrides = fromOverrides(dict, full);
  stats.stories = fromStories(dict);
  stats.curriculum = fromCurriculum(dict);
  stats.glossOverrides = Object.keys(glossOnly).length;
  stats.unusedGlossOverrides = applyGlossOverrides(dict, glossOnly);
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

module.exports = { build, tokenize, tokenizeSegmented, isJunkGloss, PUNCT };

if (require.main === module) {
  const { stats } = build();
  console.log("story dictionary");
  console.log(`  from curated overrides : ${stats.overrides}`);
  console.log(`  gloss-only corrections : ${stats.glossOverrides} applied` +
    (stats.unusedGlossOverrides.length
      ? `, ${stats.unusedGlossOverrides.length} matched nothing (${stats.unusedGlossOverrides.join(" ")})`
      : ""));
  console.log(`  from authored stories  : ${stats.stories}`);
  console.log(`  from gate word lists   : ${stats.curriculum}`);
  console.log(`  total entries          : ${stats.total} (${stats.singleChar} single characters)`);
}
