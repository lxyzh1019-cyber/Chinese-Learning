#!/usr/bin/env node
"use strict";

/**
 * Back up the live player documents to a dated local JSON file.
 *
 * Run this BEFORE any migration or any change that writes player state.
 * The Phase B gate-identity migration must not proceed without a backup on
 * disk (see docs/CHINESE_LEARNING_IMPLEMENTATION_PLAN.md section 4).
 *
 *   node scripts/backup_players.js
 *   node scripts/backup_players.js --out backups/pre-migration.json
 *
 * Reads through the Firestore REST API using the app's own public client
 * config, parsed out of index.html so there is no second copy to drift.
 * This is a READ-ONLY script: it never writes to Firestore.
 *
 * Learner content is written to the backup file and never printed. Output is
 * limited to player IDs, byte sizes and a few top-level progress counts, so
 * running it does not spill a child's records into a terminal or a log.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PLAYERS = ["jenn", "jess"];
const COLLECTION = "chinese-adventure";

function readClientConfig() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const block = /const\s+FB_CFG\s*=\s*\{([\s\S]*?)\}\s*;/.exec(html);
  if (!block) throw new Error("backup_players: FB_CFG not found in index.html");
  const pick = (key) => {
    const m = new RegExp(`${key}\\s*:\\s*'([^']+)'`).exec(block[1]);
    return m ? m[1] : null;
  };
  const cfg = { apiKey: pick("apiKey"), projectId: pick("projectId") };
  if (!cfg.apiKey || !cfg.projectId) {
    throw new Error("backup_players: could not parse apiKey/projectId from FB_CFG");
  }
  return cfg;
}

/** Convert a Firestore REST `fields` map back into plain JSON. */
function decode(value) {
  if (value === null || value === undefined) return null;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decode(v);
  return out;
}

function countKeys(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).length : 0;
}

/** A short, non-identifying shape summary — safe to print. */
function summarize(doc) {
  return {
    totalStars: doc.totalStars ?? null,
    gatesCompleted: Array.isArray(doc.gatesCompleted) ? doc.gatesCompleted.length : 0,
    storiesCompleted: Array.isArray(doc.storiesCompleted) ? doc.storiesCompleted.length : 0,
    libraryChars: countKeys(doc.library),
    failedWords: countKeys(doc.failedWords),
    badges: Array.isArray(doc.badges) ? doc.badges.length : 0,
    lastSaved: doc.lastSaved ?? null,
    progressVersion: doc.progressVersion ?? null,
  };
}

async function fetchPlayer(cfg, pid) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}` +
    `/databases/(default)/documents/${COLLECTION}/${pid}?key=${cfg.apiKey}`;
  const res = await fetch(url);
  if (res.status === 404) return { pid, status: "missing", doc: null };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = res.status === 403 ? " (Firestore rules deny unauthenticated read)" : "";
    throw new Error(`backup_players: ${pid} -> HTTP ${res.status}${hint} ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return { pid, status: "ok", doc: decodeFields(json.fields || {}), updateTime: json.updateTime || null };
}

async function main() {
  const argOut = process.argv.indexOf("--out");
  const cfg = readClientConfig();

  const stamp = new Date().toISOString().slice(0, 10);
  const outPath =
    argOut > -1 && process.argv[argOut + 1]
      ? path.resolve(process.argv[argOut + 1])
      : path.join(ROOT, "backups", `players-${stamp}.json`);

  console.log(`project : ${cfg.projectId}`);
  console.log(`source  : ${COLLECTION}/{${PLAYERS.join(",")}}`);

  const players = {};
  for (const pid of PLAYERS) {
    const r = await fetchPlayer(cfg, pid);
    if (r.status === "missing") {
      console.log(`  ${pid.padEnd(5)} not found in Firestore — nothing to back up`);
      players[pid] = null;
      continue;
    }
    players[pid] = r.doc;
    const bytes = Buffer.byteLength(JSON.stringify(r.doc));
    console.log(`  ${pid.padEnd(5)} ${String(bytes).padStart(8)} bytes  ${JSON.stringify(summarize(r.doc))}`);
  }

  if (Object.values(players).every((v) => v === null)) {
    console.error("\nbackup_players: no player documents found — refusing to write an empty backup.");
    process.exit(1);
  }

  const payload = {
    backupVersion: 1,
    takenAt: new Date().toISOString(),
    projectId: cfg.projectId,
    collection: COLLECTION,
    players,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`\nwrote ${outPath} (${fs.statSync(outPath).size} bytes)`);
  console.log("This file contains real learner records — keep it out of version control.");
}

main().catch((err) => {
  console.error(String(err.message || err));
  process.exit(1);
});
