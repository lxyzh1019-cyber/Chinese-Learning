"use strict";
/**
 * Build data/stories/hsk{lv}.json from the authored sources in
 * content/stories/hsk{lv}/.
 *
 * A source file is Chinese prose plus an English line per sentence. This turns
 * it into the app's `{t, ch, py, mn}` tokens by longest-match segmentation
 * against the curated dictionary in story-dictionary.js.
 *
 * It REFUSES to invent a reading or a gloss. Any span the dictionary cannot
 * resolve is reported and the build fails. That is deliberate: the last time
 * this content was produced without that rule, the gate vocabulary shipped 水
 * glossed "surname Shui". A build that stops and names the character is the
 * cheap version of that problem.
 *
 *   node scripts/build_stories.js            # all levels
 *   node scripts/build_stories.js 2          # one level
 */

const fs = require("fs");
const path = require("path");
const D = require("./story-dictionary.js");

const ROOT = path.resolve(__dirname, "..");
const LEVELS = [1, 2, 3, 4];

function sourceDir(lv) { return path.join(ROOT, "content", "stories", `hsk${lv}`); }

function buildLevel(lv, dict) {
  const dir = sourceDir(lv);
  if (!fs.existsSync(dir)) return null;
  const all = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  // A draft is a seed, not a finished text — staged material for a level still
  // being written. Building it emitted a corpus that then failed validation,
  // which made `npm run build:stories` with no argument exit 1 on a clean tree.
  const drafts = [];
  const files = all.filter((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (d.draft) { drafts.push(f); return false; }
    return true;
  });
  if (!files.length) return { stories: null, problems: [], drafts };

  const stories = {};
  const problems = [];

  files.forEach((f) => {
    const src = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const key = `${src.id}-h${lv}`;
    const sents = [];
    const trans = [];

    (src.sents || []).forEach((sent, i) => {
      const { tokens, unknown } = D.tokenize(sent.zh, dict, {
        names: src.names || {}, bonus: src.bonus || [], seg: sent.seg,
      });
      if (unknown.length) {
        problems.push(`${f} sentence ${i + 1}: no reading or gloss for ${[...new Set(unknown)].join(" ")}` +
          `\n      in: ${sent.zh}`);
      }
      if (!sent.en || !String(sent.en).trim()) {
        problems.push(`${f} sentence ${i + 1}: no English translation`);
      }
      sents.push(tokens);
      trans.push(sent.en || "");
    });

    stories[key] = {
      id: key, legacyId: src.id, did: src.did, level: lv,
      title: src.title, en: src.en, sents, trans,
    };
  });

  return { stories, problems, drafts };
}

function main() {
  const only = process.argv[2] ? [Number(process.argv[2])] : LEVELS;
  const { dict, stats } = D.build();
  console.log(`dictionary: ${stats.total} entries (${stats.singleChar} single characters)`);

  let failed = false;
  for (const lv of only) {
    const built = buildLevel(lv, dict);
    if (!built) { console.log(`  HSK${lv}: no sources yet — the level falls back to HSK1 at runtime`); continue; }
    if (!built.stories) {
      console.log(`  HSK${lv}: ${built.drafts.length} draft source(s), none finished — the level falls back to HSK1 at runtime`);
      continue;
    }
    if (built.problems.length) {
      failed = true;
      console.error(`\n  HSK${lv}: ${built.problems.length} problem(s) — nothing written for this level`);
      built.problems.slice(0, 25).forEach((p) => console.error(`    ${p}`));
      if (built.problems.length > 25) console.error(`    ...and ${built.problems.length - 25} more`);
      continue;
    }
    const out = path.join(ROOT, "data", "stories", `hsk${lv}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ level: lv, stories: built.stories }, null, 1) + "\n");
    if (built.drafts.length) console.log(`  HSK${lv}: ${built.drafts.length} draft source(s) skipped`);
    const n = Object.keys(built.stories).length;
    const sents = Object.values(built.stories).map((s) => s.sents.length);
    const study = Object.values(built.stories)
      .map((s) => new Set(s.sents.flat().filter((t) => t.t === "c" && !t.bonus).map((t) => t.ch)).size);
    console.log(`  HSK${lv}: ${n} stories · sentences ${Math.min(...sents)}-${Math.max(...sents)} · ` +
      `study characters ${Math.min(...study)}-${Math.max(...study)}`);
  }
  if (failed) {
    console.error("\nNothing was guessed. Add the missing readings to a source file's `names`, " +
      "or use a word the curriculum already teaches.");
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { buildLevel };
