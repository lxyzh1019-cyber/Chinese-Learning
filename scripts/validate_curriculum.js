#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = "/workspace";
const DATA = path.join(ROOT, "data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function checkLevel(doc, name) {
  assert(doc.totalWords === 300, `${name}: totalWords must be 300`);
  assert(Array.isArray(doc.words) && doc.words.length === 300, `${name}: words must be 300`);
  assert(Array.isArray(doc.gates) && doc.gates.length === 22, `${name}: gates must be 22`);
  const uniq = new Set(doc.words.map((w) => w.zh));
  assert(uniq.size === 300, `${name}: duplicate zh found inside level`);
  const gateSum = doc.gates.reduce((a, g) => a + ((g.newWords && g.newWords.length) || 0), 0);
  assert(gateSum === 300, `${name}: gate newWords sum must be 300`);
}

function main() {
  const h1 = readJson("hsk1.json");
  const h2 = readJson("hsk2.json");
  const h3 = readJson("hsk3.json");
  const h4 = readJson("hsk4.json");
  const culture = readJson("culture_stories.json");

  checkLevel(h1, "hsk1");
  checkLevel(h2, "hsk2");
  checkLevel(h3, "hsk3");
  checkLevel(h4, "hsk4");

  const borrowed = h2.words.filter((w) => w.sourceTag === "HSK3_borrowed_for_HSK2").length;
  assert(borrowed === 103, `hsk2: borrowed words must be 103, got ${borrowed}`);

  assert(Array.isArray(culture.tracks), "culture_stories: tracks must be array");
  const allStories = culture.tracks.flatMap((t) => (Array.isArray(t.stories) ? t.stories : []));
  const solarTrack = culture.tracks.find((t) => t.id === "solar_terms_24");
  assert(!!solarTrack, "culture_stories: solar_terms_24 track missing");
  const solar = (solarTrack.stories || []).length;
  assert(solar === 24, `culture_stories: expected 24 solar terms, got ${solar}`);
  assert(allStories.length >= 29, `culture_stories: expected at least 29 stories, got ${allStories.length}`);
  const familyRewardOK = culture.rewardCatalog.familyRewardTypes.includes("ask_parents_help");
  assert(familyRewardOK, "culture_stories: ask_parents_help reward missing");

  console.log("Curriculum validation passed.");
}

main();
