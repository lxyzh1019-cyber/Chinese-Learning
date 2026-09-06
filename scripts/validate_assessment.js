#!/usr/bin/env node
"use strict";
/**
 * Validate the assessment bank.
 *
 *   node scripts/validate_assessment.js            structural checks only
 *   node scripts/validate_assessment.js --audio    also HEAD-check every clip
 *
 * Domain-specific, not generic: a recognition item without spoken options, a
 * passage question with no passage, or a writing prompt carrying MCQ options
 * are each a different kind of broken and are reported as such.
 *
 * The audio pass exists because an unaided recognition item whose clip 404s is
 * worse than useless — the child cannot answer it and the spec forbids scoring
 * that as wrong or silently substituting pinyin. Catching it here means it is
 * caught before a child ever sees the item.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "data", "assessment");
const CLIP_BASE = "https://raw.githubusercontent.com/zispace/hanyu-pinyin-audio/data/digmandarin.com/audio/";

/** Authoring targets per band, in Chinese characters (A03). Custom targets,
 *  not official HSK standards. */
const PASSAGE_LEN = { C1:[25,50], C2:[50,80], C3:[80,120], C4:[120,180] };
const EXPECTED_PER_FORM = {
  recognition_unaided: 8, decoding_supported: 8, meaning_context: 8,
  passage_comprehension: 6, writing_recall: 4,
};
const ANCHORS_PER_BAND = 8;

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
  const bank = JSON.parse(fs.readFileSync(path.join(DIR, manifest.files.items), "utf8"));
  const forms = JSON.parse(fs.readFileSync(path.join(DIR, manifest.files.forms), "utf8"));

  if (bank.bankVersion !== manifest.bankVersion) fail("manifest and items disagree on bankVersion");
  if (forms.bankVersion !== manifest.bankVersion) fail("manifest and forms disagree on bankVersion");

  const byId = {};
  bank.items.forEach((it) => {
    if (byId[it.id]) fail(`duplicate item id ${it.id}`);
    byId[it.id] = it;
  });

  // ── per-item, domain-specific ──
  bank.items.forEach((it) => {
    const at = `item ${it.id}`;
    if (!it.domain) return fail(`${at}: no domain`);
    if (it.bankVersion !== manifest.bankVersion) fail(`${at}: wrong bankVersion`);
    if (!it.review || it.review.reviewerType !== "model") {
      fail(`${at}: reviewerType must state truthfully who reviewed it`);
    }

    const opts = it.options || [];
    const texts = opts.map((o) => o.text).filter((t) => t !== null && t !== undefined);
    // The defect that makes a question unanswerable: two options rendering the
    // same string, one of which is keyed correct.
    if (new Set(texts).size !== texts.length) fail(`${at}: duplicate option text — the question is unanswerable`);
    const ids = opts.map((o) => o.id);
    if (new Set(ids).size !== ids.length) fail(`${at}: duplicate option ids`);

    if (it.domain === "writing_recall") {
      if (opts.length) fail(`${at}: writing prompts must not have MCQ options`);
      if (!it.rubricId) fail(`${at}: writing prompts need a rubricId`);
      if (!bank.rubrics || !bank.rubrics[it.rubricId]) fail(`${at}: rubric ${it.rubricId} is not defined`);
      if (it.prompt && (it.prompt.zh || it.prompt.pinyin || it.prompt.hint)) {
        fail(`${at}: a recall prompt must not reveal the target`);
      }
    } else {
      if (opts.length !== 4) fail(`${at}: expected 4 options, got ${opts.length}`);
      if (!it.acceptedOptionIds || it.acceptedOptionIds.length !== 1) fail(`${at}: exactly one accepted option`);
      const accepted = (it.acceptedOptionIds || [])[0];
      if (accepted && !ids.includes(accepted)) fail(`${at}: accepted option ${accepted} is not among the options`);
    }

    if (it.domain === "recognition_unaided") {
      if (it.support.targetPinyin) fail(`${at}: unaided recognition must not show pinyin on the target`);
      if (it.support.targetAudio) fail(`${at}: unaided recognition must not play the target`);
      if (!opts.every((o) => o.audioAssetId)) fail(`${at}: every option must be playable`);
      if (opts.some((o) => o.text)) fail(`${at}: options must be spoken, not written`);
    }
    if (it.domain === "decoding_supported" && !it.support.targetPinyin) {
      fail(`${at}: supported decoding must show the pinyin — that is the support being measured`);
    }
    if (it.domain === "passage_comprehension") {
      if (!it.passageId) fail(`${at}: passage question with no passage`);
      else if (!bank.passages || !bank.passages[it.passageId]) fail(`${at}: passage ${it.passageId} is missing`);
      if (!it.prompt || !it.prompt.questionKind) warn(`${at}: no questionKind recorded`);
    }
  });

  // ── passages ──
  Object.values(bank.passages || {}).forEach((p) => {
    const range = PASSAGE_LEN[p.band];
    if (!range) return;
    if (p.charCount < range[0] || p.charCount > range[1]) {
      warn(`passage ${p.id}: ${p.charCount} characters, outside the ${p.band} target of ${range[0]}-${range[1]} — document the reason rather than padding`);
    }
  });

  // ── forms ──
  Object.entries(forms.forms).forEach(([formId, bands]) => {
    Object.entries(bands).forEach(([band, list]) => {
      const at = `form ${formId} band ${band}`;
      const counts = {};
      const recTargets = new Set(), decTargets = new Set();
      list.forEach((id) => {
        const it = byId[id];
        if (!it) return fail(`${at}: references unknown item ${id}`);
        if (it.band !== band) fail(`${at}: item ${id} belongs to band ${it.band}`);
        counts[it.domain] = (counts[it.domain] || 0) + 1;
        (it.targetWordIds || []).forEach((t) => {
          if (it.domain === "recognition_unaided") recTargets.add(t);
          if (it.domain === "decoding_supported") decTargets.add(t);
        });
      });
      Object.entries(EXPECTED_PER_FORM).forEach(([domain, want]) => {
        const got = counts[domain] || 0;
        if (got !== want) fail(`${at}: ${domain} has ${got} items, blueprint says ${want}`);
      });
      // A03: pinyin support must not coach an item the child already answered
      // unaided, so the two target sets may not overlap within a form.
      [...recTargets].filter((t) => decTargets.has(t)).forEach((t) => {
        fail(`${at}: ${t} appears in both unaided recognition and supported decoding`);
      });
    });
  });

  // ── anchors ──
  const bands = new Set(bank.items.map((i) => i.band));
  bands.forEach((band) => {
    const inA = new Set((forms.forms.A?.[band]) || []);
    const inB = new Set((forms.forms.B?.[band]) || []);
    const anchors = bank.items.filter((i) => i.band === band && i.anchorGroupId);
    if (anchors.length !== ANCHORS_PER_BAND) {
      fail(`band ${band}: ${anchors.length} anchor items, blueprint says ${ANCHORS_PER_BAND}`);
    }
    anchors.forEach((a) => {
      if (!inA.has(a.id) || !inB.has(a.id)) {
        fail(`anchor ${a.id} must appear in BOTH forms to be comparable`);
      }
    });
    // An anchor passage must be identical across forms — it is the same object
    // here by construction, but assert it so a future edit cannot break it.
    anchors.filter((a) => a.passageId).forEach((a) => {
      if (!bank.passages[a.passageId]) fail(`anchor ${a.id}: passage missing`);
    });
  });

  report(bank);
}

async function checkAudio(bank) {
  const keys = new Set();
  bank.items.forEach((it) => {
    (it.options || []).forEach((o) => { if (o.audioAssetId) keys.add(o.audioAssetId); });
    if (it.prompt && it.prompt.audioAssetId) keys.add(it.prompt.audioAssetId);
  });
  console.log(`\naudio: checking ${keys.size} distinct clips...`);
  let missing = 0;
  for (const k of keys) {
    if (!k) { fail("an item references an empty audio key"); missing++; continue; }
    const res = await fetch(CLIP_BASE + k + ".mp3", { method: "HEAD" });
    if (!res.ok) { fail(`audio clip ${k}.mp3 is not reachable (HTTP ${res.status})`); missing++; }
  }
  console.log(missing ? `  ${missing} clip(s) unreachable` : "  all clips reachable");
}

function report(bank) {
  warnings.forEach((w) => console.log(`  WARN  ${w}`));
  if (errors.length) {
    errors.forEach((e) => console.error(`  FAIL  ${e}`));
    console.error(`\nassessment bank INVALID — ${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  console.log(`\nassessment bank valid — ${bank.items.length} items, ${warnings.length} warning(s).`);
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
  const bank = JSON.parse(fs.readFileSync(path.join(DIR, manifest.files.items), "utf8"));
  if (process.argv.includes("--audio")) {
    await checkAudio(bank);
  }
  main();
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
