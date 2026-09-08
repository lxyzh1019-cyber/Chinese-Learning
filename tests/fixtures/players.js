"use strict";

/**
 * Synthetic player states for tests. Never derived from, and never written to,
 * the live `chinese-adventure` Firestore collection.
 */

/** A fresh player, as `defPlayer()` would produce it, via the real app factory. */
function freshPlayer(app) {
  return app.defPlayer();
}

/**
 * A player who has just finished their first story mini-quiz but has NOT met
 * the read/flashcard chain. Pins the `storiesCompleted` bypass (§1.1).
 */
function newUserAfterMiniQuiz(app, storyId = "xia-h1") {
  const p = app.defPlayer();
  p.storiesCompleted = [storyId];
  p.storyReadCount = {}; // dwell gate never satisfied
  p.flashPassDone = {};
  return p;
}

/** A player who legitimately read once: Listen should unlock, nothing else. */
function oneQualifyingRead(app, storyId = "xia-h1") {
  const p = app.defPlayer();
  p.storyReadCount = { [storyId]: 1 };
  return p;
}

/** A player who read twice and cleared a Listen round: all four should unlock. */
function twoReadsPlusListen(app, storyId = "xia-h1", did = 1, level = 1) {
  const p = app.defPlayer();
  const key = `h${level}-g${String(did).padStart(2, "0")}`;
  p.storyReadCount = { [storyId]: 2 };
  p.flashPassDone = { [key]: true };
  p.gateGameStars = { [key]: { trace: 0, match: 0, rain: 0, listen: 2 } };
  return p;
}

/** A gate with all four games at 3 stars and a passing boss quiz. */
function gateFullyQualified(app, did = 1, level = 1) {
  const p = app.defPlayer();
  const k = `h${level}-g${String(did).padStart(2, "0")}`;
  p.gateGameStars = { [k]: { trace: 3, match: 3, rain: 3, listen: 3 } };
  p.gateBestQuiz = { [k]: { accPct: 95, quizStars: 3 } };
  p.storyReadCount = { "xia-h1": 2 };
  return p;
}

/** A Work-in-Progress pool too small for Match's fixed 6/8 pair count (§1.1). */
function tinyWipPool(app, n = 3) {
  const p = app.defPlayer();
  const words = [
    { zh: "水", py: "shuǐ", en: "water" },
    { zh: "山", py: "shān", en: "mountain" },
    { zh: "人", py: "rén", en: "person" },
    { zh: "大", py: "dà", en: "big" },
    { zh: "小", py: "xiǎo", en: "small" },
  ].slice(0, n);
  p.failedWords = {};
  for (const w of words) {
    p.failedWords[w.zh] = { ...w, failCount: 2, lastFailed: "2026-09-01" };
  }
  return p;
}

/** Install fixture players into the loaded app's global state. */
function installState(app, { jenn, jess } = {}) {
  app.state = {
    jenn: jenn || app.defPlayer(),
    jess: jess || app.defPlayer(),
  };
  app.ensureState("jenn");
  app.ensureState("jess");
  return app.state;
}

module.exports = {
  freshPlayer,
  newUserAfterMiniQuiz,
  oneQualifyingRead,
  twoReadsPlusListen,
  gateFullyQualified,
  tinyWipPool,
  installState,
};
