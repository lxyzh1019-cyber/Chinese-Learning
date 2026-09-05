#!/usr/bin/env node
"use strict";

/**
 * Parse-check every inline <script> block in index.html.
 *
 * The app is a single-file HTML app whose entire logic lives in one ~5,800-line
 * inline <script>. A single stray brace produces a SyntaxError that silently
 * kills the whole block — every onclick handler becomes a no-op with nothing in
 * the UI to indicate why. Run this after any multi-block edit, before pushing.
 *
 * See CLAUDE.md section 9.1.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "index.html");

// Inline scripts only: skip anything with src= (external) or a non-JS type
// such as importmap / application/json.
const SCRIPT_RE =
  /<script(?![^>]*\bsrc=)(?![^>]*\btype=["'](?!text\/javascript|module)[^"']*["'])[^>]*>([\s\S]*?)<\/script>/gi;

function lineOf(haystack, index) {
  return haystack.slice(0, index).split("\n").length;
}

function main() {
  const html = fs.readFileSync(TARGET, "utf8");

  const blocks = [];
  let m;
  while ((m = SCRIPT_RE.exec(html)) !== null) {
    if (!m[1].trim()) continue;
    blocks.push({ code: m[1], startLine: lineOf(html, m.index) });
  }

  if (!blocks.length) {
    console.error("parse_check: no inline <script> blocks found in index.html");
    process.exit(1);
  }

  let failed = 0;
  for (const b of blocks) {
    try {
      // Compile without running: catches SyntaxError, executes nothing.
      new vm.Script(b.code, { filename: `index.html:${b.startLine}` });
      const lines = b.code.split("\n").length;
      console.log(`  ok   inline script at line ${b.startLine} (${lines} lines)`);
    } catch (err) {
      failed++;
      console.error(`  FAIL inline script at line ${b.startLine}: ${err.message}`);
      // Node reports the offset within the block; translate to a file line.
      const at = /index\.html:\d+:(\d+)/.exec(String(err.stack || ""));
      if (at) console.error(`       -> index.html line ~${b.startLine + Number(at[1]) - 1}`);
    }
  }

  if (failed) {
    console.error(`\nparse_check: ${failed} of ${blocks.length} inline script(s) failed to parse.`);
    process.exit(1);
  }
  console.log(`\nparse_check: ${blocks.length} inline script(s) parsed cleanly.`);
}

main();
