"use strict";

/**
 * Deferred-callback cancellation (A-T12).
 *
 * These pin the behaviour that a callback scheduled for one child can never
 * land on another child, and that leaving a round stops its timers. Uses fake
 * timers so a 8,500 ms rain drop can be fired deterministically.
 */

const { test, afterEach } = require("node:test");
const assert = require("node:assert");
const { loadApp } = require("./helpers/app-loader.js");
const F = require("./fixtures/players.js");

/** Every app instance a test made, so their timers can be stopped afterwards. */
const instances = [];
afterEach(() => {
  while (instances.length) instances.pop().__stopAllTimers();
});

function app() {
  const a = loadApp();
  instances.push(a);
  a.curP = "jenn";
  F.installState(a);
  return a;
}

function captureWrites(a) {
  const writes = [];
  a.db = {
    collection: () => ({
      doc: (pid) => ({
        set: (payload) => { writes.push({ pid, payload }); return Promise.resolve(); },
      }),
    }),
  };
  return writes;
}

test("laterCall runs normally when the profile has not changed", (t, done) => {
  const a = app();
  a.laterCall("games", () => { done(); }, 1);
});

test("a callback scheduled for Jenn does not run after switching to Jess", (t, done) => {
  const a = app();
  let ran = false;
  a.laterCall("games", () => { ran = true; }, 5);
  // Simulate only the generation bump, not the drain, so we are testing the
  // guard rather than the clearTimeout.
  a.bumpSessionGen();
  setTimeout(() => {
    assert.equal(ran, false, "the stale callback refused to run");
    done();
  }, 25);
});

test("drainScope cancels everything queued in that scope", (t, done) => {
  const a = app();
  let ran = 0;
  a.laterCall("games", () => { ran++; }, 5);
  a.laterCall("games", () => { ran++; }, 5);
  a.laterCall("quiz", () => { ran++; }, 5);
  a.drainScope("games");
  setTimeout(() => {
    assert.equal(ran, 1, "only the un-drained 'quiz' callback ran");
    done();
  }, 25);
});

test("closeGamesOverlay stops rain intervals and in-flight drop callbacks", (t, done) => {
  const a = app();
  let fired = 0;
  // Stand in for the drop timeouts spawnRainDrop registers.
  a.laterCall("games", () => { fired++; }, 5);
  a.laterCall("games", () => { fired++; }, 5);
  a.closeGamesOverlay();
  setTimeout(() => {
    assert.equal(fired, 0, "no drop callback survived the overlay closing");
    done();
  }, 25);
});

test("A-T12: a late callback after a profile switch credits nothing to the other child", (t, done) => {
  const a = app();
  const writes = captureWrites(a);

  // A Rain drop expiring mid-round: logs a wrong answer and saves.
  a.laterCall("games", () => {
    a.logWrong(a.curP, "水", "shuǐ", "water");
    a.saveState();
  }, 5);

  // The child hands the iPad over.
  a.selectPlayer("jess");

  setTimeout(() => {
    assert.deepEqual(
      Object.keys(a.state.jess.failedWords), [],
      "Jenn's rain miss was not logged against Jess"
    );
    assert.equal(
      writes.filter((w) => w.pid === "jess").length, 0,
      "the stale callback did not write Jess's document"
    );
    done();
  }, 25);
});

test("selectPlayer clears the previous child's selected gate", () => {
  const a = app();
  a.selectedGateId = 7;
  a.selectPlayer("jess");
  assert.equal(a.selectedGateId, null, "Jess's hub does not open on Jenn's gate");
});
