#!/usr/bin/env node
/**
 * Regenerate data/lessons/hsk1_gate_XX.json from data/hsk1.json gates.
 * Each lesson: unique passage + comprehension tied to that gate's vocabulary counts.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HSK1 = path.join(ROOT, "data", "hsk1.json");
const OUT_DIR = path.join(ROOT, "data", "lessons");

function vocabFromGateWords(arr) {
  return (arr || []).map((w) => ({
    zh: w.zh,
    pinyin: w.pinyin || w.py || "",
    en: w.en || "",
  }));
}

function uniqueZh(list) {
  const seen = new Set();
  const out = [];
  for (const w of list) {
    if (!w.zh || seen.has(w.zh)) continue;
    seen.add(w.zh);
    out.push(w);
  }
  return out;
}

function buildLesson(gate) {
  const gid = gate.gateId;
  const theme = gate.theme || `HSK1 Gate ${gid}`;
  const newW = vocabFromGateWords(gate.newWords);
  const revW = vocabFromGateWords(gate.reviewWords);
  const newN = newW.length;
  const revN = revW.length;
  const newZh = newW.map((w) => w.zh);
  const revZh = revW.map((w) => w.zh);

  const newListShort = newZh.slice(0, 10).join("、");
  const newClosing =
    newN > 10 ? `……等（共${newN}个生字）。` : `（共${newN}个生字）。`;
  const revListShort = revZh.slice(0, 8).join("、");
  const revPart =
    revN > 0
      ? `复习字有：${revListShort}${revN > 8 ? `……等（共${revN}个）` : `（共${revN}个）`}。`
      : "本关没有单独的复习字块。";

  const passage =
    `第${gid}关：今天的新词有：${newListShort}${newClosing}` +
    `${revPart}` +
    `请你先听一听（或请家长读一遍），再自己大声读两遍。然后试着用本关的一个新词说一句很短的中文。`;

  const explanation =
    `${theme}：本关有 ${newN} 个生字${revN ? `和 ${revN} 个复习字` : ""}。` +
    `先认读下面的词，再读短文，最后做理解题。大部分内容你可以自己完成；不懂的地方可以问家长（约二成时间）。`;

  const keyVocab = uniqueZh([...newW, ...revW]).slice(0, 14);

  const q1 = `本关有几个生字（新词）？`;
  const a1 = `${newN}个。`;

  let q2;
  let a2;
  if (revN >= 2) {
    q2 = `请说出两个“复习字”（从短文里的复习列表选）。`;
    a2 = `例如：${revZh[0]} 和 ${revZh[1]}（答案不唯一，合理即可）。`;
  } else if (revN === 1) {
    q2 = `本关有几个复习字？`;
    a2 = `1个：${revZh[0]}。`;
  } else {
    q2 = `请说出两个本关的新词。`;
    a2 = newZh.length >= 2 ? `例如：${newZh[0]} 和 ${newZh[1]}。` : `例如：${newZh[0]}。`;
  }

  const q3 = `读完以后，你应该自己先做哪一步？`;
  const a3 = `大声读词和短文，再用新词说一句短句（需要时请家长帮忙）。`;

  const speakingPrompt =
    newZh.length >= 2
      ? `用本关的词（例如「${newZh[0]}」「${newZh[1]}」）说 2～3 句很短的中文，可以说你的一天或你的爱好。`
      : newZh.length === 1
        ? `用「${newZh[0]}」和其他你学过的词说 2～3 句很短的中文。`
        : `用本关学过的词说 2～3 句很短的中文。`;

  return {
    lessonId: `hsk1_gate_${String(gid).padStart(2, "0")}`,
    level: "HSK1",
    gateId: gid,
    title: `HSK1 Gate ${gid} Lesson`,
    explanation,
    passage,
    keyVocab,
    comprehension: [
      { question: q1, answer: a1 },
      { question: q2, answer: a2 },
      { question: q3, answer: a3 },
    ],
    speakingPrompt,
  };
}

function main() {
  const doc = JSON.parse(fs.readFileSync(HSK1, "utf8"));
  if (!Array.isArray(doc.gates) || doc.gates.length !== 22) {
    throw new Error("hsk1.json: expected 22 gates");
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const gate of doc.gates) {
    const gid = gate.gateId;
    if (!Number.isFinite(gid) || gid < 1 || gid > 22) continue;
    const lesson = buildLesson(gate);
    const fname = `hsk1_gate_${String(gid).padStart(2, "0")}.json`;
    fs.writeFileSync(path.join(OUT_DIR, fname), JSON.stringify(lesson, null, 2) + "\n", "utf8");
    console.log("wrote", fname, "newWords", gate.newWords?.length, "review", gate.reviewWords?.length || 0);
  }
  console.log("Done.");
}

main();
