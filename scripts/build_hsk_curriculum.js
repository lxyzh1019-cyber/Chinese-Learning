#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = "/workspace";
const DATA_DIR = path.join(ROOT, "data");
const REPORT_PATH = path.join(DATA_DIR, "curriculum_report.json");

const NEW_LEVEL_URL = (lv) =>
  `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/new/${lv}.json`;

const GATE_SIZES_22 = [13, 13, 13, 13, 13, 13, 13, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14];
const HSK2_BORROW_COUNT = 103;
const HSK2_BASE_COUNT = 197;
const TOTAL_PER_LEVEL = 300;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Fetch failed ${url}: ${res.statusCode}`));
          return;
        }
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

function rankWord(a) {
  const freq = Number.isFinite(a.frequency) ? a.frequency : 999999;
  const len = (a.simplified || "").length || 99;
  const pos = Array.isArray(a.pos) ? a.pos : [];
  const hasFriendlyPos = pos.some((p) =>
    ["n", "v", "a", "r", "m", "q", "t", "f", "s", "d"].includes(p)
  );
  const idiomPenalty = pos.includes("i") ? 80 : 0;
  const symbolPenalty = pos.includes("w") || pos.includes("x") ? 60 : 0;
  const longPenalty = len > 4 ? (len - 4) * 8 : 0;
  const friendlyBonus = hasFriendlyPos ? -40 : 0;
  return freq + idiomPenalty + symbolPenalty + longPenalty + friendlyBonus;
}

function normalizeEntry(raw, sourceLevel, sourceTag) {
  const forms = Array.isArray(raw.forms) ? raw.forms : [];
  const form0 = forms[0] || {};
  const trans = form0.transcriptions || {};
  const meanings = Array.isArray(form0.meanings) ? form0.meanings : [];
  const pinyin = trans.pinyin || "";
  const en = meanings[0] || "TBD meaning";
  const zh = raw.simplified || "";
  if (!zh || !pinyin) return null;
  return {
    zh,
    pinyin,
    en,
    sourceLevel,
    sourceTag,
    tags: [],
    difficulty: zh.length <= 1 ? "easy" : zh.length === 2 ? "medium" : "hard",
    meta: {
      frequency: Number.isFinite(raw.frequency) ? raw.frequency : null,
      pos: Array.isArray(raw.pos) ? raw.pos : []
    }
  };
}

function pickWords(rawWords, count, sourceLevel, sourceTag, excludeSet) {
  const seen = new Set();
  const filtered = rawWords
    .filter((w) => w && typeof w.simplified === "string")
    .filter((w) => !excludeSet.has(w.simplified))
    .filter((w) => {
      const zh = w.simplified || "";
      if (!zh || seen.has(zh)) return false;
      seen.add(zh);
      return true;
    })
    .sort((a, b) => rankWord(a) - rankWord(b));

  const out = [];
  for (const raw of filtered) {
    const item = normalizeEntry(raw, sourceLevel, sourceTag);
    if (!item) continue;
    out.push(item);
    if (out.length >= count) break;
  }
  return out;
}

function buildGates(words, level) {
  if (words.length !== TOTAL_PER_LEVEL) {
    throw new Error(`Level ${level} does not have ${TOTAL_PER_LEVEL} words`);
  }
  const gates = [];
  let cursor = 0;
  const prior = [];
  for (let i = 0; i < 22; i++) {
    const gateId = i + 1;
    const newCount = GATE_SIZES_22[i];
    const newWords = words.slice(cursor, cursor + newCount);
    cursor += newCount;
    prior.push(...newWords);
    const reviewWords = prior.slice(Math.max(0, prior.length - 24 - newCount), Math.max(0, prior.length - newCount)).slice(-24);
    gates.push({
      gateId,
      theme: `HSK${level} Gate ${gateId}`,
      sentenceTargets: gateId <= 8 ? 2 : gateId <= 16 ? 3 : 4,
      rewards: {
        stars: 10 + gateId,
        mysteryBoxChance: gateId % 4 === 0 ? 0.25 : 0.1,
        familyRewardType: gateId % 11 === 0 ? "ask_parents_help" : null
      },
      newWords,
      reviewWords
    });
  }
  return gates;
}

function levelDoc(level, words, notes) {
  return {
    level: `HSK${level}`,
    sourceStandard: "HSK 3.0 (customized kid track)",
    totalWords: words.length,
    totalGates: 22,
    gateDistribution: GATE_SIZES_22,
    notes,
    words,
    gates: buildGates(words, level)
  };
}

async function main() {
  const [raw1, raw2, raw3, raw4] = await Promise.all([
    fetchJson(NEW_LEVEL_URL(1)),
    fetchJson(NEW_LEVEL_URL(2)),
    fetchJson(NEW_LEVEL_URL(3)),
    fetchJson(NEW_LEVEL_URL(4))
  ]);

  const usedAcross = new Set();

  const hsk1Words = pickWords(raw1, TOTAL_PER_LEVEL, "new-1", "HSK1_base", usedAcross);
  hsk1Words.forEach((w) => usedAcross.add(w.zh));

  const hsk2Base = pickWords(raw2, HSK2_BASE_COUNT, "new-2", "HSK2_base", usedAcross);
  const hsk2BaseSet = new Set(hsk2Base.map((w) => w.zh));
  const borrowExclude = new Set([...usedAcross, ...hsk2BaseSet]);
  const hsk2Borrowed = pickWords(raw3, HSK2_BORROW_COUNT, "new-3", "HSK3_borrowed_for_HSK2", borrowExclude);
  const hsk2Words = [...hsk2Base, ...hsk2Borrowed];
  hsk2Words.forEach((w) => usedAcross.add(w.zh));

  const hsk3Words = pickWords(raw3, TOTAL_PER_LEVEL, "new-3", "HSK3_base", usedAcross);
  hsk3Words.forEach((w) => usedAcross.add(w.zh));

  const hsk4Words = pickWords(raw4, TOTAL_PER_LEVEL, "new-4", "HSK4_base", usedAcross);

  const hsk1 = levelDoc(1, hsk1Words, ["300-word custom level from HSK 3.0 new-1 list"]);
  const hsk2 = levelDoc(2, hsk2Words, [
    "300-word custom level",
    `Includes ${HSK2_BORROW_COUNT} borrowed words from HSK3`
  ]);
  const hsk3 = levelDoc(3, hsk3Words, ["300-word custom level from HSK 3.0 new-3 list, excluding HSK2 borrowed entries"]);
  const hsk4 = levelDoc(4, hsk4Words, ["300-word custom level from HSK 3.0 new-4 list"]);

  fs.writeFileSync(path.join(DATA_DIR, "hsk1.json"), JSON.stringify(hsk1, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "hsk2.json"), JSON.stringify(hsk2, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "hsk3.json"), JSON.stringify(hsk3, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "hsk4.json"), JSON.stringify(hsk4, null, 2));

  const report = {
    generatedAt: new Date().toISOString(),
    source: "drkameleon/complete-hsk-vocabulary wordlists/exclusive/new",
    constraints: {
      perLevelTotal: TOTAL_PER_LEVEL,
      gateCount: 22,
      hsk2Borrowed: HSK2_BORROW_COUNT
    },
    levels: {
      hsk1: { words: hsk1.words.length, gates: hsk1.gates.length },
      hsk2: {
        words: hsk2.words.length,
        gates: hsk2.gates.length,
        borrowedFromHsk3: hsk2.words.filter((w) => w.sourceTag === "HSK3_borrowed_for_HSK2").length
      },
      hsk3: { words: hsk3.words.length, gates: hsk3.gates.length },
      hsk4: { words: hsk4.words.length, gates: hsk4.gates.length }
    }
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log("Generated curriculum files under /workspace/data");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
