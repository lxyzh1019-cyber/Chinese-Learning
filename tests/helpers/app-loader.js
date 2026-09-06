"use strict";

/**
 * Loads the app's inline <script> from index.html into a Node vm context with
 * stubbed browser globals, so its functions can be exercised directly in tests.
 *
 * The app is a single-file HTML app: all logic lives in one inline script with
 * no module exports, so this is the only way to unit-test the real code rather
 * than a reimplementation of it.
 *
 * The trailing `init()` call is stripped before evaluation — definitions load,
 * nothing boots. Firestore is never initialised (`firebase` is left undefined,
 * so `initFirestore()` returns immediately) and no test ever reaches the live
 * `chinese-adventure` collection.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX = path.join(ROOT, "index.html");

const SCRIPT_RE =
  /<script(?![^>]*\bsrc=)(?![^>]*\btype=["'](?!text\/javascript|module)[^"']*["'])[^>]*>([\s\S]*?)<\/script>/i;

/**
 * App globals declared with `let` that tests need to read or write. These live
 * in the inline script's lexical scope, so the loader bridges them onto the
 * context object via accessors (see loadApp).
 */
const BRIDGED = [
  "state", "curP", "curHSK", "curStory", "curDynasty", "quizSt",
  "db", "engagementSettings", "selectedGateId", "curGameTargetDid",
  "flashSt", "matchSt", "rainSt", "listenSt", "traceSt", "miniQ",
  "tapped", "newChars", "totalNew", "storyOpenTime",
  "revengeSt", "drillSt", "answerLocked", "remoteBaseRevision", "syncStatus",
  "curGameTargetLevel",
  // Content tables. Also `const`, so also invisible without the bridge.
  "STORIES_MAP", "DYNASTIES", "HSK_VOCAB", "GATE_VOCAB", "GATE_SENTENCES",
];

/** Minimal element stub: enough for the app's rendering calls to be no-ops. */
function makeEl(id) {
  const el = {
    id: id || "",
    tagName: "DIV",
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    hidden: false,
    style: {},
    dataset: {},
    parentNode: null,
    children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }; },
    focus() {},
    blur() {},
    click() {},
    scrollIntoView() {},
    insertAdjacentHTML() {},
  };
  return el;
}

function makeDocument() {
  const cache = new Map();
  const doc = {
    getElementById(id) {
      if (!cache.has(id)) cache.set(id, makeEl(id));
      return cache.get(id);
    },
    createElement(tag) {
      const el = makeEl();
      el.tagName = String(tag || "div").toUpperCase();
      return el;
    },
    createDocumentFragment() { return makeEl(); },
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    body: makeEl("body"),
    documentElement: makeEl("html"),
    hidden: false,
    visibilityState: "visible",
    /** Test helper: reach an element the app rendered into. */
    __el(id) { return doc.getElementById(id); },
  };
  return doc;
}

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
  };
}

/**
 * @param {object} [opts]
 * @param {number} [opts.now] Fixed epoch ms for Date.now(), for deterministic tests.
 * @returns {object} The vm context — app globals are properties on it.
 */
function loadApp(opts = {}) {
  const html = fs.readFileSync(INDEX, "utf8");
  const m = SCRIPT_RE.exec(html);
  if (!m) throw new Error("app-loader: no inline <script> found in index.html");

  // Strip the boot call so definitions load without the app starting.
  let code = m[1];
  const bootRe = /\n\s*init\(\);\s*$/;
  if (!bootRe.test(code)) {
    throw new Error("app-loader: trailing init() call not found — update the loader");
  }
  code = code.replace(bootRe, "\n");

  // The app's mutable globals are `let` bindings, which in a vm live in the
  // script's lexical scope and are invisible on the context object. Append an
  // accessor bridge — evaluated in that same scope — so tests can read and
  // write them as `app.state`, `app.curP`, and so on.
  code += `\n;(function(){
    var __b = ${JSON.stringify(BRIDGED)};
    for (var i = 0; i < __b.length; i++) {
      (function(n){
        try {
          Object.defineProperty(globalThis, n, {
            configurable: true,
            get: function(){ return eval(n); },
            set: function(v){ eval(n + ' = v'); },
          });
        } catch (e) { /* binding absent in this build */ }
      })(__b[i]);
    }
  })();\n`;

  const documentStub = makeDocument();
  const localStorageStub = makeLocalStorage();

  // Track every timer the app schedules. selectPlayer() starts the session
  // countdown and the play-time flush, which are intervals that never stop on
  // their own — without this a single test that switches profile keeps the
  // Node event loop alive and the run hangs instead of finishing.
  const liveTimers = new Set();
  const trackedSetTimeout = (fn, ms, ...rest) => {
    const id = setTimeout((...a) => { liveTimers.delete(id); return fn(...a); }, ms, ...rest);
    liveTimers.add(id);
    return id;
  };
  const trackedSetInterval = (fn, ms, ...rest) => {
    const id = setInterval(fn, ms, ...rest);
    liveTimers.add(id);
    return id;
  };
  const trackedClear = (id) => { liveTimers.delete(id); clearTimeout(id); clearInterval(id); };

  const ctx = {
    console,
    setTimeout: trackedSetTimeout,
    clearTimeout: trackedClear,
    setInterval: trackedSetInterval,
    clearInterval: trackedClear,
    requestAnimationFrame: (fn) => trackedSetTimeout(fn, 0),
    cancelAnimationFrame: trackedClear,
    document: documentStub,
    localStorage: localStorageStub,
    sessionStorage: makeLocalStorage(),
    navigator: { userAgent: "node-test", language: "en-CA" },
    location: { search: "", href: "http://localhost/", hostname: "localhost" },
    speechSynthesis: { getVoices: () => [], speak() {}, cancel() {}, onvoiceschanged: null },
    SpeechSynthesisUtterance: function () { return {}; },
    Audio: function () { return { play: () => Promise.resolve(), pause() {}, currentTime: 0, src: "" }; },
    AudioContext: function () { return { createOscillator: () => ({ connect() {}, start() {}, stop() {} }), createGain: () => ({ connect() {}, gain: { value: 0 } }), destination: {}, currentTime: 0, resume: () => Promise.resolve() }; },
    fetch: () => Promise.reject(new Error("fetch disabled in tests")),
    // Loaded before the inline script in index.html, so the app can rely on it.
    GateIdentity: require("../../js/gate-identity.js"),
    MergeState: require("../../js/merge-state.js"),
    ReviewCore: require("../../js/review-core.js"),
    HanziWriter: { create: () => ({ animateCharacter() {}, quiz() {}, cancelQuiz() {}, hideCharacter() {} }) },
    // firebase intentionally undefined: initFirestore() bails, so no test can
    // reach the live chinese-adventure collection.
    Date: opts.now === undefined ? Date : makeFixedDate(opts.now),
    Math,
    JSON,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;

  vm.createContext(ctx);
  new vm.Script(code, { filename: "index.html<inline>" }).runInContext(ctx);

  /** Stop every timer this app instance started. Call when a test is done. */
  ctx.__stopAllTimers = () => {
    liveTimers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    liveTimers.clear();
  };
  return ctx;
}

function makeFixedDate(now) {
  const Fixed = class extends Date {
    constructor(...args) {
      if (args.length === 0) super(now);
      else super(...args);
    }
    static now() { return now; }
  };
  return Fixed;
}

module.exports = { loadApp, makeEl, makeDocument, makeLocalStorage };
