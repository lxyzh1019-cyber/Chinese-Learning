#!/usr/bin/env node
"use strict";
/**
 * Dry-run the 22 -> 88 gate migration against a backup and print the mapping.
 *
 *   node scripts/migrate_preview.js [backups/players-YYYY-MM-DD.json]
 *
 * READ-ONLY. It never contacts Firestore and never writes a player document.
 * Its whole purpose is to let the owner see exactly what the migration would
 * do — old gate to new key, what access is preserved, what is skipped — and
 * approve it before it is applied to live records.
 *
 * It also runs the migration twice and asserts the second pass changes
 * nothing, since an idempotent migration is what makes it safe to re-run.
 */
const fs = require("fs");
const path = require("path");
const G = require("../js/gate-identity.js");

const ROOT = path.resolve(__dirname, "..");

function latestBackup() {
  const dir = path.join(ROOT, "backups");
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

function summarise(p) {
  return {
    gatesCompleted: (p.gatesCompleted || []).length,
    totalStars: p.totalStars || 0,
    library: Object.keys(p.library || {}).length,
    failedWords: Object.keys(p.failedWords || {}).length,
    badges: (p.badges || []).length,
    storyReadCount: Object.keys(p.storyReadCount || {}).length,
  };
}

function main() {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : latestBackup();
  if (!file || !fs.existsSync(file)) {
    console.error("migrate_preview: no backup found. Run scripts/backup_players.js first.");
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`source   : ${path.relative(ROOT, file)}`);
  console.log(`taken at : ${backup.takenAt}`);
  console.log(`model    : ${G.allGateKeys().length} gates (${G.LEVELS.length} levels x ${G.GATES_PER_LEVEL})`);
  console.log("");

  let problems = 0;

  for (const [pid, doc] of Object.entries(backup.players || {})) {
    if (!doc) { console.log(`── ${pid}: no record\n`); continue; }

    const before = summarise(doc);
    const { player: after, report } = G.migratePlayer(doc);
    const afterSum = summarise(after);

    console.log(`── ${pid} ${"─".repeat(60 - pid.length)}`);
    if (report.alreadyMigrated) { console.log("   already migrated — nothing to do\n"); continue; }

    // Which phases will actually run. They are independent: a save from the
    // previous release already has its gate keys and needs only the story remap,
    // and a dry run that reported the gate phase alone said "(none)" while
    // silently rewriting every story id.
    console.log(`   phases: gate identity ${report.migratedGates ? "YES" : "no"} · story ids ${report.migratedStories ? "YES" : "no"}`);

    if (report.migratedGates) {
      console.log("   gate completions remapped:");
      if (!report.gatesCompleted.length) console.log("     (none)");
      report.gatesCompleted.forEach((m) => {
        const p = G.parseGateKey(m.to);
        console.log(`     gate ${String(m.from).padStart(2)}  ->  ${m.to}   (level ${p.levelId}, gate ${p.gateId})`);
      });
    }

    if (report.migratedStories) {
      console.log("   story ids remapped (reads and completions follow them):");
      const moved = [];
      Object.keys(doc.storyReadCount || {}).forEach((id) => {
        if (!/-h[1-4]$/.test(id)) moved.push(`${id} -> ${id}-h1  (${doc.storyReadCount[id]} read${doc.storyReadCount[id] === 1 ? "" : "s"})`);
      });
      (doc.storiesCompleted || []).forEach((id) => {
        if (!/-h[1-4]$/.test(id)) moved.push(`${id} -> ${id}-h1  (completed)`);
      });
      if (!moved.length) console.log("     (none)");
      moved.forEach((m) => console.log(`     ${m}`));
    }

    // Only meaningful when the gate phase ran. For a previous-release save —
    // which is the state every live document is in — it stays empty, and
    // printing it said the child could reach no gates at all.
    if (report.migratedGates) {
      console.log(`   reachable after migration (access, NOT completion):`);
      console.log(`     ${report.legacyAccess.join(", ") || "(none)"}`);
    }
    console.log(`   next gate to work on: ${G.nextOpenGateKey(after.gatesCompleted) || "(all cleared)"}`);

    // Nothing outside the gate model may change.
    const preserved = ["totalStars", "library", "failedWords", "badges", "storyReadCount"];
    const changed = preserved.filter((k) => before[k] !== afterSum[k]);
    console.log(`   preserved: stars ${afterSum.totalStars}, characters ${afterSum.library}, ` +
      `practice words ${afterSum.failedWords}, badges ${afterSum.badges}, stories read ${afterSum.storyReadCount}`);
    if (changed.length) { console.log(`   !! CHANGED unexpectedly: ${changed.join(", ")}`); problems++; }

    if (report.skipped.length) {
      console.log(`   skipped (left untouched, not invented):`);
      report.skipped.forEach((sk) => console.log(`     ${sk.field}: ${sk.value}`));
    }
    report.warnings.forEach((w) => console.log(`   note: ${w}`));

    // Idempotence: a second pass must be a no-op.
    const twice = G.migratePlayer(after).player;
    const stable = JSON.stringify({ ...twice, legacyCredit: null }) === JSON.stringify({ ...after, legacyCredit: null });
    console.log(`   re-running the migration changes nothing: ${stable ? "yes" : "NO — unsafe"}`);
    if (!stable) problems++;
    console.log("");
  }

  console.log(problems
    ? `PREVIEW FAILED — ${problems} problem(s). Do not apply.`
    : "Preview clean. No live record has been touched; applying is a separate, explicit step.");
  process.exit(problems ? 1 : 0);
}

main();
