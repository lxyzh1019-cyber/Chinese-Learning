#!/usr/bin/env node
"use strict";
/**
 * What content actually exists behind the 88 gates.
 *
 * The audit counted `words[]`, which is the array an inspector opens. The games
 * serve `gates[].newWords` / `reviewWords`, and the reader serves STORIES_MAP.
 * This measures all three, per gate, so a coverage claim can be checked rather
 * than asserted.
 *
 * Read-only. Writes nothing but the report on stdout.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const LESSONS = path.join(ROOT, "data", "lessons");

/** Load STORIES_MAP and DYNASTIES out of the inline script without booting the app. */
function loadContentTables() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error("no inline script found");
  // Stories moved out of the inline script into data/stories/hsk{lv}.json when
  // they gained a level. Seed the cache the way preloadCurriculum does, or this
  // reports zero authored stories against a corpus that exists.
  const storyLevels = {};
  for (const lv of [1, 2, 3, 4]) {
    const f = path.join(ROOT, "data", "stories", `hsk${lv}.json`);
    if (fs.existsSync(f)) storyLevels[lv] = JSON.parse(fs.readFileSync(f, "utf8")).stories || {};
  }
  const code = m[1].replace(/\n\s*init\(\);\s*$/, "\n") +
    `\n;Object.assign(curriculumCache.stories, ${JSON.stringify(storyLevels)});rebuildStoriesMap();` +
    "\n;globalThis.__S=STORIES_MAP;globalThis.__D=DYNASTIES;";
  const el = () => ({
    style: {}, dataset: {}, innerHTML: "", textContent: "",
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, setAttribute() {}, addEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
  });
  const ctx = {
    console, Math, JSON, Date,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
    requestAnimationFrame: () => 0,
    document: {
      getElementById: el, createElement: el, querySelector: () => el(),
      querySelectorAll: () => [], addEventListener() {}, body: el(), documentElement: el(),
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: {}, location: { search: "" },
    GateIdentity: require("../js/gate-identity.js"),
    MergeState: require("../js/merge-state.js"),
    ReviewCore: require("../js/review-core.js"),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  new vm.Script(code, { filename: "index.html<inline>" }).runInContext(ctx);
  return { stories: ctx.__S, dynasties: ctx.__D };
}

/**
 * A lesson passage is a real text only if it reads as prose. The generated ones
 * are a vocabulary list wrapped in instructions — they open with 第N关：今天的新词有
 * and end by telling the child to read them aloud.
 */
const LIST_PASSAGE = /新词有|复习字有|共\d+个生字/;
const META_QUESTION = /本关有几个生字|复习字|你应该自己先做哪一步/;

function lessonReport() {
  const files = fs.readdirSync(LESSONS).filter((f) => f.endsWith(".json")).sort();
  return files.map((f) => {
    const j = JSON.parse(fs.readFileSync(path.join(LESSONS, f), "utf8"));
    const passage = String(j.passage || "");
    const qs = j.comprehension || [];
    return {
      file: f,
      level: j.level,
      gateId: j.gateId,
      passageChars: passage.length,
      isWordList: LIST_PASSAGE.test(passage),
      metaQuestions: qs.filter((q) => META_QUESTION.test(String(q.question || ""))).length,
      questions: qs.length,
      keyVocab: (j.keyVocab || []).length,
      hasAnswers: qs.every((q) => String(q.answer || "").trim().length > 0),
    };
  });
}

function storyReport(stories, dynasties) {
  const out = [];
  for (const key of Object.keys(stories)) {
    const st = stories[key];
    const sents = st.sents || [];
    const chars = new Set();
    let study = 0, bonus = 0;
    sents.forEach((sn) => sn.forEach((t) => {
      if (t && t.t === "c") { t.bonus ? bonus++ : study++; chars.add(t.ch); }
    }));
    out.push({ key, did: st.did, title: st.title, sentences: sents.length, study, bonus, unique: chars.size });
  }
  // Which gate keys each story serves. A dynasty's stories carry no level, so
  // one story serves the same dynasty on all four levels.
  const perGateKey = {};
  for (const d of dynasties) {
    for (let lv = 1; lv <= 4; lv++) {
      perGateKey[`h${lv}-g${String(d.id).padStart(2, "0")}`] =
        [d.story, d.story2].filter(Boolean);
    }
  }
  return { stories: out, perGateKey };
}

function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : "—"; }

function main() {
  const { stories, dynasties } = loadContentTables();
  const lessons = lessonReport();
  const sr = storyReport(stories, dynasties);

  const gateKeys = Object.keys(sr.perGateKey);
  const distinctStorySets = new Set(Object.values(sr.perGateKey).map((v) => v.join("|")));

  console.log("# Content coverage\n");
  console.log(`Gates: ${gateKeys.length}  (4 levels x ${dynasties.length} dynasties)\n`);

  console.log("## Stories");
  console.log(`- Authored stories: **${sr.stories.length}**`);
  console.log(`- Distinct story pairs across all ${gateKeys.length} gates: **${distinctStorySets.size}**`);
  const perLevel = {};
  sr.stories.forEach((s) => { const lv = Number(String(s.key).slice(-1)) || 1; perLevel[lv] = (perLevel[lv] || 0) + 1; });
  console.log(`- By level: ${[1, 2, 3, 4].map((lv) => `HSK${lv} ${perLevel[lv] || 0}`).join(" · ")} (44 per level is complete)`);
  const missing = [1, 2, 3, 4].filter((lv) => (perLevel[lv] || 0) < 44);
  if (missing.length) {
    console.log(`- Levels ${missing.map((l) => `HSK${l}`).join(", ")} have no text of their own yet, so those gates fall back to the HSK1 telling and the reader says so.`);
  }
  const studies = sr.stories.map((s) => s.study).sort((a, b) => a - b);
  console.log(`- Study characters per story: min ${studies[0]}, median ${studies[studies.length >> 1]}, max ${studies[studies.length - 1]}`);
  console.log(`- Sentences per story: ${[...new Set(sr.stories.map((s) => s.sentences))].sort().join(", ")}`);
  const laddered = missing.length === 0;
  const done = [1, 2, 3, 4].filter((lv) => (perLevel[lv] || 0) >= 44).map((lv) => `HSK${lv}`);
  console.log(`- Decision **O05**: ${laddered
    ? "met — every level has its own telling."
    : `partly met — stories carry a level and ${done.join(" and ")} ${done.length > 1 ? "are" : "is"} on the ladder; the levels above are still to be written.`}\n`);

  console.log("## Lessons");
  const wordList = lessons.filter((l) => l.isWordList);
  const meta = lessons.filter((l) => l.metaQuestions > 0);
  const noAnswers = lessons.filter((l) => !l.hasAnswers);
  console.log(`- Lesson files: **${lessons.length}** (${[...new Set(lessons.map((l) => l.level))].sort().join(", ")}, 22 each)`);
  console.log(`- Passages that are a vocabulary list plus instructions, not a text: **${wordList.length}** (${pct(wordList.length, lessons.length)})`);
  console.log(`- Lessons carrying at least one question about the lesson rather than the text: **${meta.length}**`);
  console.log(`- Lessons with a question missing its answer: **${noAnswers.length}**`);
  const byLevel = {};
  lessons.forEach((l) => {
    byLevel[l.level] = byLevel[l.level] || { n: 0, list: 0, meta: 0, chars: [] };
    byLevel[l.level].n++;
    if (l.isWordList) byLevel[l.level].list++;
    if (l.metaQuestions) byLevel[l.level].meta++;
    byLevel[l.level].chars.push(l.passageChars);
  });
  console.log("\n| Level | Lessons | Word-list passages | Meta questions | Passage chars (min/med/max) |");
  console.log("|---|---|---|---|---|");
  for (const lv of Object.keys(byLevel).sort()) {
    const b = byLevel[lv];
    const c = b.chars.sort((x, y) => x - y);
    console.log(`| ${lv} | ${b.n} | ${b.list} | ${b.meta} | ${c[0]} / ${c[c.length >> 1]} / ${c[c.length - 1]} |`);
  }

  console.log("\n## Gate vocabulary");
  for (const lv of [1, 2, 3, 4]) {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", `hsk${lv}.json`), "utf8"));
    const rows = (doc.gates || []).flatMap((g) => [...(g.newWords || []), ...(g.reviewWords || [])]);
    const blank = rows.filter((w) => !String(w.en || "").trim()).length;
    console.log(`- hsk${lv}: ${doc.gates.length} gates, ${rows.length} served rows, ${blank} with no English meaning`);
  }

  const exitCode = 0;
  process.exit(exitCode);
}

main();
