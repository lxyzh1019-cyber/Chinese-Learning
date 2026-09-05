#!/usr/bin/env node
"use strict";

/**
 * Read-only probe of the deployed Firestore rules.
 *
 * Run this AFTER pasting the chinese-adventure block from firestore.rules into
 * the Firebase console, to confirm the rules do what they claim.
 *
 *   node scripts/check_firestore_rules.js
 *
 * Every probe is a GET. Nothing is written, so a mis-scoped ruleset cannot
 * leave junk documents behind. A denied read returns HTTP 403; a permitted
 * read of a document that does not exist returns 404, which still proves the
 * path is readable. Both are reported distinctly.
 *
 * Note this cannot test WRITE permission without writing, so it does not try.
 * The app writes unauthenticated today, so write rules must stay at least as
 * permissive as read rules for it to keep working.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const COLLECTION = "chinese-adventure";

function readClientConfig() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const block = /const\s+FB_CFG\s*=\s*\{([\s\S]*?)\}\s*;/.exec(html);
  if (!block) throw new Error("check_firestore_rules: FB_CFG not found in index.html");
  const pick = (key) => {
    const m = new RegExp(`${key}\\s*:\\s*'([^']+)'`).exec(block[1]);
    return m ? m[1] : null;
  };
  return { apiKey: pick("apiKey"), projectId: pick("projectId") };
}

async function probe(cfg, docPath) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}` +
    `/databases/(default)/documents/${docPath}?key=${cfg.apiKey}`;
  const res = await fetch(url);
  if (res.status === 200) return "readable";
  if (res.status === 404) return "readable-but-absent";
  if (res.status === 403) return "denied";
  return `http-${res.status}`;
}

const EXPECT = [
  { path: `${COLLECTION}/jenn`, want: ["readable"], why: "Jenn's record must stay readable or the app breaks" },
  { path: `${COLLECTION}/jess`, want: ["readable"], why: "Jess's record must stay readable or the app breaks" },
  { path: `${COLLECTION}/jenn/assessments/__probe`, want: ["readable-but-absent", "readable"], why: "assessment attempts must be reachable" },
  { path: `${COLLECTION}/__not_a_player`, want: ["denied"], why: "an unknown player document must be refused" },
  { path: `${COLLECTION}/jenn/__not_a_feature/x`, want: ["denied"], why: "an unknown subcollection must be refused" },
];

async function main() {
  const cfg = readClientConfig();
  console.log(`project: ${cfg.projectId}\n`);

  let bad = 0;
  for (const e of EXPECT) {
    const got = await probe(cfg, e.path);
    const ok = e.want.includes(got);
    if (!ok) bad++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${e.path}`);
    console.log(`        got ${got}, expected ${e.want.join(" or ")} — ${e.why}`);
  }

  if (bad) {
    console.error(`\n${bad} probe(s) failed. The rules are not as intended — do not assume the records are protected.`);
    process.exit(1);
  }
  console.log("\nAll probes matched. Read access is scoped as intended.");
  console.log("Write permission is NOT tested here (testing it would mean writing).");
}

main().catch((err) => { console.error(String(err.message || err)); process.exit(1); });
