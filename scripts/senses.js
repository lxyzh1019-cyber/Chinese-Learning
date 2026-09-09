"use strict";
/**
 * One definition of "these two glosses mean the same thing".
 *
 * §9.6: a wrong option must never be secretly right. Comparing whole glosses is
 * not enough — 请 is "to ask" and 问 is "to ask; to inquire", different strings
 * that read as the same answer, and the child who picks the one the builder did
 * not intend is marked wrong and has it logged to their practice queue.
 *
 * This lived in index.html and again, verbatim, in validate_assessment.js.
 * Two copies of a rule about correctness is one copy too many, so both now
 * route through here; index.html keeps its own for the browser, checked against
 * this by the test suite.
 */
function normMeaning(en) {
  return String(en == null ? "" : en).toLowerCase().replace(/[^a-z0-9;]+/g, " ").trim();
}

/** The senses of a gloss, as a child would count them. */
function meaningSenses(en) {
  return normMeaning(en).split(";").map((t) => t.trim()).filter(Boolean);
}

function sharesSense(a, b) {
  const A = meaningSenses(a);
  if (!A.length) return false;
  const B = new Set(meaningSenses(b));
  return A.some((s) => B.has(s));
}

module.exports = { normMeaning, meaningSenses, sharesSense };
