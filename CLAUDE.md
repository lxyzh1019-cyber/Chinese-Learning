# CLAUDE.md — Chinese Adventure: Complete App Blueprint

This file is the definitive reference for the Chinese Adventure app and
serves as the blueprint for rebuilding it ("French Adventure", "English Arts",
or any similar language-learning project for kids).

It has two parts:
- **Part A** (§1–§10): Design and engineering rules — the "how we build"
- **Part B** (§11–§29): Full app architecture — the "what we built"

---

# PART A — Design and Engineering Rules

## 1. Tone — never shame a wrong answer

Wrong answers are how kids learn. Every badge, toast, animation, and copy
string around a mistake should celebrate effort, not poke fun at the result.

**Bad** (do not ship): "100 wrong answers", "No Brain", icons like 💀 ☠️ 🤦 😵
**Good**: "100 brave tries — every try grows you!", "Never give up", icons
like 🌱 🌳 🏔️ 💪

**Rotate encouragement on every miss.** A randomized line on the
correct-answer reveal card keeps the moment fresh and positive:

- "Nice try! Here it is 🌟"
- "Good effort! Let's learn it 💡"
- "Brave try — now you'll remember 🌱"
- "Almost! Every try counts 💪"
- "Mistakes help your brain grow 🧠✨"

Pick at random; do not show the same line twice in a row.

---

## 2. Scoring rule — full round or zero stars

Stars are only awarded when a round completes **naturally**. Any early exit:

1. Saves the in-progress session so the kid can resume later that day.
2. Awards zero stars.
3. Shows an explicit "Progress saved — finish to earn stars!" message.

This rule applies uniformly to every game and every quiz.

**Common loophole to avoid.** Percentage-based scoring rewards
`1 correct / 1 attempt = 100% = 3 stars` if the kid quits after one tap. The
correct fix is **not** a minimum-sample-size guard — that wrongly penalizes
small word pools on legitimate completions. Instead, gate the star calculation
behind "round naturally ended" (timer expired, all questions answered, all
items completed).

**Exit-message template per activity:**

| Activity | Save-and-exit toast |
|---|---|
| Timed game (Rain) | "Progress saved — finish the round to earn stars ⭐" |
| Match | "Progress saved — finish all pairs to earn stars! 🧠" |
| Listen | "Progress saved — answer all 10 to earn stars! 👂" |
| Trace | "Progress saved — finish all characters to earn stars! ✍️" |
| Gate / level quiz | "Progress saved — finish the quiz to earn stars! 🏯" |

A visible "Save & Exit" button in every activity is better than relying on a
generic overlay-close X — it tells the kid exactly what happens.

---

## 3. Learning-first gating — read before play

Games are a reward for engaging with content, not a substitute for it.

**Ordered unlock chain per dynasty scope:**

1. Read the story ≥45 s → **Listen** unlocks.
2. Finish flashcard pass → **Trace** unlocks.
3. Read the story a second time ≥45 s → **Match** unlocks.
4. Play Listen (dynasty scope) at least once → **Rain** unlocks.

Show locked options as disabled with a one-line "what to do to unlock" hint
rather than hiding them entirely — kids should see the path forward.

**Apply gating only to the dynasty scope.** HSK and Work-in-Progress scopes
stay open so kids always have somewhere to land.

---

## 4. Dwell time gates

A read-count gate without a dwell-time check is worthless — kids click
open-then-close in under a minute. Track `activityOpenTime = Date.now()` when
an article opens, and only count it as completed if
`Date.now() - activityOpenTime >= 45000`. 45 seconds is the default for a
short story article.

---

## 5. UX for hard skills (handwriting, pronunciation, etc.)

When the target skill is genuinely hard, apply all of these:

- **Auto-play a demonstration first.** For Chinese stroke order, animate the
  full character before enabling quiz mode.
- **Slow animations down.** `strokeAnimationSpeed: 0.7` with
  `delayBetweenStrokes: 200ms` reads much better than library defaults.
- **Generous but bounded retries.** "Watch again (3 left)" teaches the limit
  without being punitive.
- **Explicit "I'm ready" button.** Don't auto-start the quiz.
- **Softer star thresholds.** `0 mistakes = 3★, ≤4 = 2★, else 1★`.
- **Tier the encouragement** to the result:
  - 3-star: "Perfect! 🌟", "Flawless! Amazing! ✨", "You nailed it! 🏆"
  - 2-star: "Great job! Keep going! 💪", "Nice effort! 🎉"
  - 1-star: "Good try! Every stroke counts! 📚", "Practice makes perfect! 💫"
- **Auto-advance after celebrating.** Show result ~2 s, then move on.

---

## 6. Badges — celebrate effort

| Pattern | Bad | Good |
|---|---|---|
| Wrong-answer milestone | "100 wrong answers" / 😵 | "100 brave tries — every try grows you!" / 🌱 |
| Repeated misses on same item | "No Brain: same word wrong 5×" / 🤦 | "Never give up — met a word 5 times" / 💪 |
| Long-term effort | "500 mistakes" / 💀 | "Mighty learner — 500 brave tries" / 🌳 |
| Persistence | "Stubborn streak" / ☠️ | "Master climber — 1000 brave tries" / 🏔️ |

Toast when a badge unlocks should reframe the metric:
- "💪 Never Give Up badge! Meeting a word 5 times is how it sticks."
- "🌱 Brave Tries badge! Every try grows your brain."

---

## 7. Parent dashboard — visibility, not blocking

Parents want signal; kids need an uninterrupted experience.

- Show practice queue size, reading streak, time spent.
- Add **informational flags**, not hard blocks.
  `⚠️ Played games before 2 reads: Xia Dynasty` surfaces the pattern without
  taking anything away from the kid.
- The dashboard is a conversation starter for the family, not a control panel.

---

## 8. State migration when adding new gates

When you introduce a new prerequisite, do not strand users who already had
access:

- If `gatesCompleted` contains the gate ID, bypass the new prerequisite.
- If a legacy `storiesCompleted` entry exists, treat it as fully satisfied.
- Always tolerate missing fields: `(s.storyReadCount || {})[sid] || 0`.

Never rename a state key after launch — it lives in localStorage / Firestore.
Pick forward-looking names from the start (`storyReadCount`, not `read1`).

---

## 9. Engineering practices

### 9.1 Always parse-check large inline-script edits

Single-file HTML apps embed JS inside `<script>` tags. A single stray `}` kills
the **entire** script silently — every `onclick` handler does nothing.

Before pushing any multi-block edit, run:

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=/<script(?![^>]*src=)(?![^>]*type=\"importmap\")[^>]*>([\s\S]*?)<\/script>/.exec(html);
fs.writeFileSync('/tmp/inline.js',m[1]);
" && node --check /tmp/inline.js
```

### 9.2 When rewriting a function with Edit, include both braces

The `old_string` and `new_string` must each contain the function from
`function name(` through its **matching final `}`**. Leaving the closing `}`
outside creates an orphan brace that produces a silent SyntaxError.

### 9.3 Star-rule enforcement lives at the call site, not inside the helper

`starsFromAccuracy(correct, total)` is a pure function. Enforce the
"round-must-complete" rule at the call site — only invoke it from the
natural-end branch of the activity. Keep the helper pure.

### 9.4 Commit messages should explain the why

"Apply complete-round-for-stars rule consistently across all games + gate quiz"
is far more useful than "fix scoring".

### 9.5 Test the UI

Type-checking and unit tests verify correctness, not feature correctness.
Launch the dev server and click through the actual flow:
- Open a profile, navigate to locked content, confirm the unlock message.
- Quit a game mid-round, confirm the toast and the resume path.
- Earn a milestone, confirm the badge and tone.

If you can't run the UI, say so explicitly rather than claim success.

### 9.6 A wrong option must never be secretly right

Every builder that offers choices excluded its answer by **spelling** — the
Chinese, the array index, or the exact English string. A child compares
*meaning*, and a gloss is not one meaning: "law; method" and "law" are
different strings that read as the same answer. Five surfaces had it (MCQ both
directions, Listen, Match, Drill/Revenge, the Daily Word), and in each one the
option the child did not tap was scored wrong and logged to their practice
queue — §1's promise inverted, punishing a correct reading.

The rule: exclude on **what makes the answer identifiable in that question**,
not on what is convenient to compare.

- Options are meanings → compare senses, `;`-split (`sharesSense`).
- Options are characters under a meaning prompt → same comparison.
- Options are characters under an **audio** prompt → compare the *sound*.
  Listen compared English, so 向 and 像 (both `xiàng`) could sit side by side.
- A board pairs by index (Match) → drop the colliding word rather than deal an
  ambiguous card; let the round size follow the pick so it still ends.

Put the comparison in one helper and route every builder through it
(`pickDistractors`). Then measure on the real curriculum, not a fixture: each
of these was found by building every question the 88 gate word lists can
produce and counting the ambiguous ones. Assert with a comparison the test
computes **itself** — a test that calls the function under test moves with the
defect and cannot fail.

---

## 10. Quick reference — copy-paste templates

### Player-state field for read-count gating

```javascript
// In defPlayer():
storyReadCount: {},   // { storyId: number }
flashPassDone: {},    // { dynastyId: true }
```

### Dwell-tracked read completion

```javascript
function openStory(story, dynasty){
  storyOpenTime = Date.now();
  showScreen('reader');
}

function completeStory(){
  const s = state[curP];
  const sid = curStory && curStory.id;
  if (sid && (Date.now() - storyOpenTime) >= 45000) {
    if (!s.storyReadCount) s.storyReadCount = {};
    s.storyReadCount[sid] = (s.storyReadCount[sid] || 0) + 1;
    const reads = s.storyReadCount[sid];
    if (reads === 1) showToast('First read done! 🌱 Listen game unlocked.', 2800);
    else if (reads === 2) showToast('Second read done! 🌳 Match + Rain are now unlocked.', 2800);
  }
}
```

### Unlock helper

```javascript
function gameUnlockForDid(did){
  if (!curP || !did) return { listen:true, trace:true, match:true, rain:true };
  const s = state[curP];
  if (s.gatesCompleted && s.gatesCompleted.includes(did))
    return { listen:true, trace:true, match:true, rain:true };
  const dynasty = DYNASTIES.find(d => d.id === did);
  if (!dynasty) return { listen:true, trace:true, match:true, rain:true };
  const storyIds = [dynasty.story, dynasty.story2].filter(Boolean);
  if (storyIds.some(sid => (s.storiesCompleted||[]).includes(sid)))
    return { listen:true, trace:true, match:true, rain:true };
  const maxReads = Math.max(0, ...storyIds.map(sid => (s.storyReadCount||{})[sid] || 0));
  const flashDone   = !!(s.flashPassDone && s.flashPassDone[String(did)]);
  const listenPlayed = ((s.gateGameStars && s.gateGameStars[String(did)]) || {}).listen > 0;
  return {
    listen: maxReads >= 1,
    trace:  maxReads >= 1 && flashDone,
    match:  maxReads >= 2,
    rain:   maxReads >= 2 && !!listenPlayed,
  };
}
```

### Save-and-exit pattern

```javascript
function exitMatch(){
  persistMatch();   // write current state to player.pendingSessions.match
  saveState();
  showToast('Progress saved — finish all pairs to earn stars! 🧠', 2400);
  openGamesHub();
}
```

### Encouraging logWrong

```javascript
function logWrong(p, zh, py, en){
  const s = state[p];
  if (!s.failedWords) s.failedWords = {};
  if (!s.failedWords[zh]) s.failedWords[zh] = { zh, py, en, failCount: 0, lastFailed: null };
  s.failedWords[zh].failCount++;
  s.failedWords[zh].lastFailed = todayKey();

  if (!s.totalWrongAnswers) s.totalWrongAnswers = 0;
  s.totalWrongAnswers++;
  if (!s.badges) s.badges = [];

  if (s.failedWords[zh].failCount === 5 && !s.badges.includes('persistent_5')) {
    s.badges.push('persistent_5');
    showToast('💪 Never Give Up badge! Meeting a word 5 times is how it sticks.', 2800);
  }

  const wc = s.totalWrongAnswers;
  const milestones = [
    [100,  'tries_100',  '🌱 Brave Tries badge! Every try grows your brain.'],
    [500,  'tries_500',  '🌳 Mighty Learner! 500 brave tries — amazing effort.'],
    [1000, 'tries_1000', '🏔️ Master Climber! 1000 brave tries — incredible.'],
  ];
  for (const [n, id, msg] of milestones) {
    if (wc === n && !s.badges.includes(id)) { s.badges.push(id); showToast(msg, 2800); break; }
  }
}
```

---

# PART B — Full App Architecture

## 11. Technology stack and project structure

**Almost-single-file HTML app.** `index.html` holds the CSS, one inline
`<script>` and the inline content tables. Six classic `<script src>` modules sit
beside it — no build step, no bundler, no ES modules — each ending with a
`module.exports` guard so tests can `require()` it directly:

| Loaded **before** the inline script | |
|---|---|
| `js/gate-identity.js` | the 88-gate key model and its migration (§14) |
| `js/merge-state.js` | event-sourced merge of divergent devices (§26) |
| `js/review-core.js` | retention: evidence, schedule, labels, budget (§25) |

| Loaded **after** the inline script (they reach `state`, `curP`, `savePlayer`, `showToast`, `speak`) | |
|---|---|
| `js/assessment-core.js` · `js/assessment-ui.js` · `js/player-store.js` | the assessment (§24) |

Two traps in `index.html`: several functions are **defined twice** and the later
definition silently wins, so a new global must be defined once; and colours must
come from the `:root` custom properties, because `applySeasonTheme()` redeclares
them and literal hex breaks under the seasonal themes.

**External dependencies (CDN):**
- Google Fonts: Ma Shan Zheng (decorative), Noto Serif SC (Chinese text),
  Quicksand (UI)
- HanziWriter (stroke-order animation and interactive tracing)
- Firebase SDK (Firestore for cross-device sync)

**Data files loaded at runtime:**
- `data/hsk1.json` … `data/hsk4.json` — gate curriculum per HSK level
  (gate vocab, sentence packs, rewards config)
- `data/culture_stories.json` — culture-story tracks (independent reading,
  not gated)
- `data/lessons/` — lesson JSON files, one per gate (key vocab, comprehension
  questions, speaking prompts)

**Persistence:** `localStorage` key `'zh_adv_v1'` holds the full state object.
Firestore collection `'chinese-adventure'`, docs `'jenn'` and `'jess'`.
On load, the snapshot with the later `lastSaved` timestamp wins.

---

## 12. Player profiles

Two fixed players: **Jenn** (🐥) and **Jess** (🦊). Players are identified by
string keys `'jenn'` / `'jess'`.

```
state = { jenn: PlayerState, jess: PlayerState }
```

The select screen shows both player cards. Tapping one sets `curP` (current
player string) and calls `renderHub()`.

### HSK level unlocking

A level opens when the level below it is **finished** — all 22 of its gates —
not on a running total across all levels:

```javascript
levelIsUnlocked(s, lv)      // lv === 1, or `h{lv-1}-g22` is in gatesCompleted
gatesClearedInLevel(s, lv)  // counts keys matching `h{lv}-g..`; drives the toast
```

- HSK 1: always open
- HSK 2 / 3 / 4: all 22 gates of the level below cleared

The old `getCurrentHSK` derived a single "current level" from
`gatesCompleted.length` at 5 / 11 / 17. That could not survive the 88-gate model
— a total says nothing about *which* level the gates were in — and it is gone.

`legacyLevelAccess` was a grandfather clause: the migration recorded which
levels that 5/11/17 rule had opened, and `levelUnlocked` honoured them so no
child lost a tab. It is **no longer consulted**. It let a child hold HSK2 on
five cleared gates — not the rule the curriculum is built on, and invisible in
the UI. `migratePlayer` still writes the field, as a record of what a child
used to be able to reach; removing the *check* is what revokes the access, so a
document already carrying the grant needs no migration.

---

## 13. Complete player state (`defPlayer`)

```javascript
function defPlayer() {
  return {
    // ── Scoring ──
    totalStars: 0,          // cumulative stars ever earned
    weekStars: 0,           // stars earned in current week (resets each Monday)
    weekStart: weekStart(), // ISO date key of current week's Monday
    lastPlayed: null,       // ISO date key of last play session
    lastSaved: 0,           // ms timestamp of last save (used for conflict resolution)

    // ── Progress ──
    schemaVersion: 3,       // 1 = legacy 22-gate ids; 2 = the 88-gate key model;
                            // 3 = story ids carry their level too
    gatesCompleted: [],     // gate KEYS, `h{level}-g{NN}` — see §14
    storiesCompleted: [],   // legacy story IDs — gates marked complete via old flow
    legacyStoriesCompleted: [], // frozen snapshot taken when the read chain shipped
    gateStars: {},          // { gateKey: 0|1|2|3 } best quiz stars per gate
    gateGameStars: {},      // { gateKey: { trace, match, rain, listen: 0|1|2|3 } }
    gateBestQuiz: {},       // { gateKey: { accPct, quizStars } }
    gateAttemptHistory: {}, // { gateKey: [ last 10 attempts ] }
    championBestQuiz: {},   // { "grp": { accPct, quizStars } }
    championCleared: {},    // { grp: stars } — passed champion challenges
    lastGateQuizAttempt: null, // { did, isChampion, accPct, quizStars, atKey }

    // ── Vocabulary ──
    library: {},            // { zh: { py, mn } } — characters tapped in stories
    failedWords: {},        // { zh: { zh, py, en, failCount, lastFailed } }
    traceStars: {},         // { zh: 0|1|2|3 } — best trace stars per character
    reviewRecords: {},      // { "zh::skill": record } — retention evidence, §25
    lessonSelfCheck: {},    // { gateKey: { qIdx: { result: 'had'|'notyet', at } } } — self-report, never evidence

    // ── Sync ──
    revision: 0,            // compare-and-set counter for the Firestore write
    starLedger: [],         // star events with stable ids, §26
    starsBaseline: 0,       // the total that predates the ledger
    syncConflicts: [],      // divergences recorded rather than silently resolved (§26)

    // ── Reading gates (§3/§4) ──
    storyReadCount: {},     // { storyId: number } — dwell-validated read count
    flashPassDone: {},      // { gateKey: true } — completed flashcard deck

    // ── Badges ──
    badges: [],             // array of badge IDs (see §18)
    totalWrongAnswers: 0,   // all-time wrong answers across all activities

    // ── Sessions ──
    pendingSessions: {      // null = nothing to resume
      gate: null,           // mid-quiz gate boss
      champion: null,       // mid-quiz champion challenge
      story: null,          // mid-quiz story mini-quiz
      flash: null,          // mid-deck flashcard session
      match: null,          // mid-game Memory Match
      rain: null,           // mid-game Rain
      listen: null,         // mid-game Listen
      trace: null,          // mid-game Trace
      revenge: null,        // mid-round Revenge
      review: null,         // mid-round Review today (§25)
    },
    pendingSessionClearedAt: {}, // { slot: ms } — when a slot was deliberately cleared, for the merge (§26)

    // ── Daily stats ──
    todayStats: {},         // { "YYYY-MM-DD": { stars, correct, wrong, stories, gates, champions } }
    dailyTimeMs: {},        // { "YYYY-MM-DD": ms } — total play time per day
    weeklyHistory: [],      // array of { weekStart, stars, savedAt } (last 4 weeks)
    libraryCountAtDayStart: {}, // { "YYYY-MM-DD": count } — for "chars learned today"

    // ── Daily challenge ──
    dailyWordSolved: null,  // ISO date key if solved today
    dailyWordTotal: 0,      // total daily challenges solved ever

    // ── Daily mission ──
    dailyMission: {
      date: null, goalKey: null, progress: 0,
      target: 1, done: false, rewarded: false,
    },

    // ── Gate timers ──
    gateTimers: {},         // { gateKey: { startKey, deadlineKey, active, days, attemptId } }
    gateResetSeq: {},       // { gateKey: n } — deadline resets so far; rounds carry the value they started under
    timerReminderShown: {}, // { "did": dateKey }
    timerWarningShown: {},  // { "did": dateKey }
    timerLastSeenAt: {},    // { "did": dateKey }
    timerUnlockUntil: 0,    // ms timestamp — parent-unlocked extra session time

    // ── Forgiveness / alt rounds ──
    altRoundProgress: { trace:0, match:0, rain:0, listen:0, total:0 },
    forgivenessProgress: { trace:0, match:0, rain:0, listen:0 },
    dynastyForgiveness: { trace:0, match:0, rain:0, listen:0 },

    // ── Recent question deduplication ──
    recentGateQuestions: {}, // { "g-did" | "c-grp": { mcq:[], py:[] } }

    // ── Engagement ──
    microRewardLastAt: 0,
    mascotSession: { count: 0, lastAt: 0 },
    mascotUnlockedNotified: false,
    mascotCosmetic: 0,
    mysteryPicksPending: 0,
    mysteryLastFamilyAt: 0,
    badgeFragments: 0,
    craftedBadges: 0,
    cultureSeen: {},        // { cultureStoryId: true }
    cultureRewarded: {},    // { cultureStoryId: true }
    stickerIds: [],         // earned sticker IDs
    weeklyStarLeadWeeks: [], // weeks where this player led stars
    pinyinIntroDone: false,
  };
}
```

---

## 14. Dynasty / gate curriculum

**88 gates: 4 HSK levels × 22 dynasties.** A gate is a (level, dynasty) pair,
identified by a key, never by a dynasty number alone:

```
gateKey(level, dynastyId) -> `h${level}-g${String(dynastyId).padStart(2,'0')}`
  h1-g01 … h1-g22 · h2-g01 … h4-g22
```

Every gate record — `gatesCompleted`, `gateStars`, `gateGameStars`,
`gateBestQuiz`, `gateTimers`, `flashPassDone` — is keyed this way. `js/gate-identity.js`
owns the model: `gateKey`, `parseGateKey`, `nextGateKey`, `isGateOpen`,
`championKey`, `levelUnlocked` and `migratePlayer`.

**Why this is not a cosmetic change.** The app previously stored bare dynasty
ids 1–22 and `ensureState` *discarded any id above 22*, so an 88-gate scheme was
structurally impossible; and because nothing recorded the level, clearing gate 1
showed as cleared on all four HSK tabs. The tabs only ever swapped lesson text.

### Migration

`migratePlayer` runs **two independent phases**, each triggered by the shape it
repairs, because a document can need one and not the other:

1. **Gate identity** — numeric dynasty ids become `h{level}-g{NN}` keys. Old
   completions map to the level of their historical dynasty group.
2. **Story ids** — `xia` becomes `xia-h1`, so reads and completions follow the
   story to its level.

Gating both on one version stamp is a trap this app has fallen into twice. A save
written by the previous release already carries gate keys and a `schemaVersion`
of 2, so a single stamp check skips the story remap — and its `storyReadCount`
then reads as empty, which silently re-locks Listen, Match and Rain through §3's
chain. Worse, running the gate phase over such a save would *delete* it:
`parseInt("h1-g01")` is `NaN`, so every completion is filtered away.

**Callers must use `GateIdentity.needsMigration(player)`** and nothing else.
Assembling the test at the call site is the other half of the same trap:
`defPlayer()` stamps the current version and `mergePlayerState` is
`Object.assign({}, defPlayer(), loaded)`, so an unstamped legacy save arrives
already looking current. A child who had read stories but cleared no gates then
looks fully migrated.

Both phases are idempotent, invent no completions for the other 66 identities,
and redistribute no stars.

The 22 dynasties themselves are unchanged, IDs 1–22, chronological order:

```javascript
// Dynasty object shape
{ id: number,          // 1–22
  hsk: 1|2|3|4,        // which HSK level this dynasty belongs to
  zh: string,          // Chinese name e.g. '夏朝'
  en: string,          // English name e.g. 'Xia Dynasty'
  period: string,      // e.g. '~2070–1600 BCE'
  capital: string,     // Chinese capital name
  capEn: string,       // English capital name / location
  story: string,       // primary story ID (key into STORIES_MAP)
  story2: string,      // secondary story ID
  color: string,       // hex colour used for dynasty road node
  icon: string,        // emoji icon
  desc: string,        // multi-sentence description shown in detail panel
}
```

### Historical grouping

The `hsk` field on a dynasty is its **historical** grouping, kept for content
selection. It is no longer what decides a player's level:

- Gates 1–5 (Xia → Qin) · 6–11 (Western Han → Sui) · 12–17 (Tang → Jin) ·
  18–22 (Yuan → Republic)

### Gate unlock rule
Gate N of a level is available only after gate N−1 **of that same level** is
cleared (N=1 is always open), and the level itself must be unlocked (§12).
`isGateOpen(s, level, did)` implements it.

### Champion challenges
One Champion Challenge per 5-gate group per level, keyed `championKey(level, grp)`.
Unlocks only when all 5 gates in that group of that level are cleared.

### Gate completion

**One function pays out: `evaluateGateCompletion(did, level)`.** There used to be
two completion sites that paid *differently* — clearing by quiz paid up to 220
points plus mission credit, a mystery box and a badge; clearing by game paid a
toast — and a cleared gate paid again on **every** boss replay, because the pass
test read the stored best rather than the current attempt. Completion is now
idempotent: a replay shows its round score and pays nothing.

A gate clears when the best quiz reaches `accPct ≥ 90` **and** `quizStars === 3`,
and all four games are at 3★.

### Gate timer
When a player earns 3★ on any game for a gate, a countdown starts
(`gateTimerDays = 5 + 2 * floor((gateId - 1) / 5)` days). Expiry is swept
**eagerly on render** (`sweepExpiredGateTimers`). It used to be evaluated lazily
and never called from the hub, so a lapsed timer reported "due today" indefinitely
and then detonated mid-session the next time any game or quiz happened to finish.

`resetGateProgress(s, did, level)` clears that gate's game stars, best quiz and
pending quiz, and **archives** them first. `library`, `failedWords`,
`reviewRecords` and stars are never touched: long-term learning records do not
expire.

**A round is bound to the attempt it started under.** Every gate-scoped round —
the four games and the boss/champion quiz — records `gateAttemptBinding()`
(`{playerId, gateKey, attemptId, resetSeq}`) when it starts and carries it
through save and restore. `updateGateGameBest` and `renderQuizResult` check it
with `gateSessionQualifies()`: a round that no longer matches the gate's current
attempt (the deadline passed mid-round) is presented as practice and pays
nothing, while its per-answer evidence stands. A pre-timer round qualifies once
its own 3★ mints the timer, as long as no reset separates the two. Before this,
the reset marked only the *saved* quiz copy, the live quiz never read it, and
the games had no check at all — so the round that outlived the deadline was
the one that resurrected the credit the reset had cleared.

---

## 15. Content system

### 15.1 Dynasty stories

Each dynasty has two story articles (`story` and `story2`), **per level**.
Stories live in `data/stories/hsk{lv}.json`, keyed `<base>-h<level>`
(`xia-h1`, `xia-h2`, …), and are loaded at runtime into `STORIES_MAP` by
`preloadCurriculum`. They were inline in `index.html` until four levels made
that 176 hand-tokenized texts.

`storyForGate(baseId, level)` resolves one. A level with no text of its own
serves the HSK1 telling with `shared: true`, and the reader **says so** — naming
the level whose words, lesson and quiz the child is actually getting. Silently
serving another level's text is the defect that decision O05 exists to fix.

Reads and completions are keyed by the per-level id, so each level earns its own
reading gate. `migratePlayer` remaps legacy ids (`xia` → `xia-h1`); without it a
child's read counts vanish and §3's chain re-locks their games.

**The ladder** (owner decision): HSK1 10 sentences, HSK2 15, HSK3 20, HSK4 25 —
the same background story, told at the level's difficulty.

**Authoring.** Sources live in `content/stories/hsk{lv}/`; `npm run build:stories`
tokenizes them against the curated dictionary in `scripts/story-dictionary.js`
(assembled only from already-validated sources) and **fails on any span it
cannot vouch for**, naming the character rather than inventing a reading. A
source sentence may carry its own `seg` with explicit glosses — the 44 reviewed
HSK1 stories do, so a rebuild reproduces them token for token.

A gloss is what the child reads when they tap a character, so
`validate_stories.js` rejects a fragment of a longer word's English (`-tice`),
a grammar code (`DE`, `CL`), or a surname gloss.

Stories are tokenized into sentences, each sentence an array of tokens:
```javascript
{ t: 'c',           // type: 'c' = character, 's' = space/punctuation
  ch: '朝',         // the character (if t==='c')
  py: 'cháo',      // pinyin
  mn: 'dynasty',   // English meaning (or null/undefined for grammar particles)
  bonus: false,     // true = blue "bonus" character (optional to tap)
}
```

Tapping a character reveals its pinyin + meaning, adds it to the character
`library`, and plays its TTS audio. Progress bar shows % of "study" characters
(non-bonus) revealed.

When all study characters are tapped → "Finish Story" button enables →
`completeStory()` runs the dwell-time check (§4), awards stars, and launches
the **story mini-quiz**.

### 15.2 Story mini-quiz

After completing a story, a quick MCQ quiz on the vocabulary just encountered
launches automatically. Stars from the story quiz are separate from gate stars
and are awarded immediately (no "full round" gate because the story was already
fully read).

### 15.3 HSK vocabulary arrays

```javascript
HSK_VOCAB = {
  1: [ {zh, py, en}, … ],  // ~30 core characters
  2: [ … ],                // ~24 words: history, culture, city, etc.
  3: [ … ],                // dynasties 12–17 vocabulary
  4: [ … ],                // dynasties 18–22 vocabulary
}
```

### 15.4 Gate vocabulary (GATE_VOCAB)

Fallback vocabulary pool when a dynasty's stories don't yield enough words:
```javascript
GATE_VOCAB = { 1: [{zh,py,en}, …], … }
```

### 15.5 Gate sentences (GATE_SENTENCES)

Used in Phase 3 (sentence builder) of the gate quiz:
```javascript
GATE_SENTENCES = { 1: [ ['我','爱','学习','中文','。'], … ], … }
```

### 15.6 Culture stories

Independent of the dynasty progression. Loaded from
`data/culture_stories.json`. Tracks are themed collections (e.g. festivals,
food, arts). Reading a culture story adds to `cultureSeen` and optionally
rewards stars via `cultureRewarded`.

### 15.7 Lesson cards (per-gate curriculum)

Loaded from `data/hsk{lv}.json` → each gate entry can have a `lessonRef`
pointing to a lesson JSON. The lesson shows key vocabulary with visible
English, comprehension Q&A, and a speaking prompt — displayed in the dynasty
detail panel below the story buttons.

---

## 16. The four mini-games

All four games have three **word scopes**:
- **Dynasty** — words from the current/selected gate's stories (gated by §3)
- **HSK** — current HSK level vocabulary from `HSK_VOCAB`
- **Work in Progress** — words from `failedWords` (always open)

### 16.1 Listen (👂)

10 questions. Each question plays the TTS audio of a Chinese word; the player
taps the matching Chinese character from 4 options. Streak bonus: +3 per
correct answer when streak ≥ 3 (else +2).

**State:** `listenSt = { questions, qi, streak, score, correctCount, gameTargetDid }`

**Scoring:** `starsFromAccuracy(correctCount, questions.length)` — only called
at natural end (all 10 answered).

**Save/resume:** `pendingSessions.listen` persisted after every answer.

### 16.2 Memory Match (🧠)

Concentration-style flip-and-match. Pair count: `min(pool size, 6 for gates
1–14 / 8 for gates 15–22)`. Deriving it from the gate id alone dealt an
unwinnable board on a 1–5 word Work-in-Progress pool — "Matched 3/6" forever —
and the stuck session then outranked everything else on resume. Cards show Chinese character on one side, English meaning on the other.
**Wrong flip does not add to `failedWords`** (it would punish memory, not
vocabulary knowledge). This document asserted that before it was true: `tapMatch`
*did* call `logWrong`, and logged only card `a`, so which word got blamed
depended on flip order. Removed.

**State:** `matchSt = { cards, openIdxs, matched, moves, start, pairCount, gameTargetDid }`

**Scoring:** time-based — `<120 s = 3★, <180 s = 2★, <240 s = 1★`. Called
at natural end when `matched >= pairCount`.

**Save/resume:** `pendingSessions.match` persisted after each flip.

### 16.3 Rain (🌧️)

45-second timed game. Chinese characters fall from the top of the screen.
A target word is shown in the sidebar; tap matching falling characters to score.
Every hit increments `rainHits`; every tap (correct or wrong) increments
`rainAttempts`. Combo multiplier for consecutive hits.

Minimum pool size: 5 words. Characters are drawn from a shuffled sequence that
cycles through the pool so every word appears before repeating.

**State:** `rainSt = { pool, target, score, combo, bestCombo, timeLeft, spawnIv,
tickIv, targetIv, dropId, rainHits, rainAttempts, gameTargetDid,
targetSeq, targetIdx, targetSeenCount, spawnsSinceTarget, targetShownThisRound }`

**Scoring:** `starsFromAccuracy(rainHits, rainAttempts)` at natural end
(timer reaches 0). Early exit via `endRain(fromUser=true)` saves state and
awards no stars.

**Save/resume:** `pendingSessions.rain` persisted before leaving.

### 16.4 Trace (✍️)

Stroke-order practice using HanziWriter. Characters extracted from vocabulary
words (`uniqueChars(words)`). Dynasty scope is limited to
`9 + gateId` characters maximum.

**Flow per character:**
1. Character auto-animates on load (player watches stroke order).
2. "Watch again (3 left)" button — up to 3 total previews.
3. "Start Tracing!" button — player taps it when ready; HanziWriter quiz mode
   starts.
4. On complete: toast with tiered message + auto-advance after 2 s.

**Thresholds:** `0 mistakes = 3★, ≤4 mistakes = 2★, else 1★`

**State:** `traceSt = { chars, i, writer, targetId, traceGood, gameTargetDid,
watchCount, quizActive }`

**Scoring:** `traceStarsFromAccuracy(traceGood, chars.length, gameTargetDid)` at
natural end (all characters done). For non-dynasty scope falls back to
`starsFromAccuracy`.

**Save/resume:** `pendingSessions.trace` updated after each character.

### 16.5 Forgiveness tokens

Dynasty-scope games only. Every two 2★ rounds in HSK/WIP scope earn +1
forgiveness token for the same game type. A token absorbs one wrong answer
in a dynasty-scope game without calling `logWrong` or adding to the practice
queue. Tokens are stored in `dynastyForgiveness`.

### 16.6 Gate game unlock (clearing a gate)

Gate cleared when **both** are true simultaneously:
- Best quiz: `accPct ≥ 90` **and** `quizStars === 3`
- All 4 games: `gateGameStars[did].trace >= 3`, `.match >= 3`, `.rain >= 3`,
  `.listen >= 3`

The timer started at the first game 3★ must not have expired. If both conditions
become true while checking game stars (`updateGateGameBest`), the gate auto-clears.

---

## 17. Gate boss quiz

Three sequential phases. Stars and score are computed only at the result screen
(Phase 3 → `renderQuizResult`).

### Phase 0 — MCQ (Multiple Choice)
8–10 questions (varies by `lastBossQuizThemeIdx` cycling 0/1/2). Each
question: show Chinese character → pick English meaning from 4 options, OR
(for every other single-character question) pick the Chinese character from
4 lookalikes. Base score +10 per correct; +up to 4 bonus for no assistance.

### Phase 1 — Pinyin Typing
10–12 questions. Show Chinese → type pinyin (tone marks not required).
`stripTones()` normalises before comparing. Base +8 per correct; +3 bonus if
no 🔊 and no peek. A pinyin chart "peek" is available but removes the bonus.

### Phase 2 — Sentence Builder
3 sentences. Shuffled word chips; player drags them into correct order.
+20 per correct sentence.

### Scoring thresholds
```javascript
starsFromAccuracy(quizCorrect, quizAttempts)
// > 85% = 3★, > 70% = 2★, > 55% = 1★, else 0
```

### Champion quiz differences
- MCQ: 30–34 questions (draws from all 5 group dynasties)
- Pinyin: 38–42 questions
- Sentences: 10
- Passing stores `championCleared[grp]`

### Recent question deduplication
`recentGateQuestions["g-{did}"]` stores the last 80 MCQ and 80 pinyin
character keys. `pickBalancedVocab` skips recently seen words when building
new question sets.

---

## 18. Badge system

All 16 badges defined in `BADGE_DEFS`:

| ID | Icon | Title | Trigger |
|---|---|---|---|
| `first_story` | 📖 | First story | `storiesCompleted.length >= 1` |
| `reader_5` | 📚 | 5 stories read | `storiesCompleted.length >= 5` |
| `gates_10` | 🏯 | 10 gates cleared | `gatesCompleted.length >= 10` |
| `champion_all` | 👑 | All champion challenges | `championCleared` has 4 entries |
| `week_warrior` | 🔥 | 7-day play streak | 7 consecutive days with activity |
| `speed_scholar` | ⚡ | Gate quiz: no hints | `noMcqAssistance` true when gate clears |
| `star_200` | ⭐ | 200 total stars | `totalStars >= 200` |
| `daily_regular` | ☀️ | 7 daily challenges | `dailyWordTotal >= 7` |
| `pinyin_master` | 📘 | Finished pinyin intro | `opts.pinyinDone` passed to `checkBadges` |
| `one_day_gate` | 🏅 | Cleared a gate in one day | Gate started and cleared on the same day |
| `cross_trainer` | 🧩 | 20 HSK/WIP rounds | `altRoundProgress.total >= 20` |
| `week_star_lead` | 🥇 | Led week stars (12+) | Checked during rivalry co-op render |
| `tries_100` | 🌱 | 100 brave tries | `totalWrongAnswers >= 100` |
| `tries_500` | 🌳 | 500 brave tries — mighty learner! | `totalWrongAnswers >= 500` |
| `tries_1000` | 🏔️ | 1000 brave tries — true climber! | `totalWrongAnswers >= 1000` |
| `persistent_5` | 💪 | Never give up — met a word 5 times | Same word's `failCount === 5` |

`checkBadges(p, opts)` is called from every place that might trigger a badge.
It never removes badges — only adds. `renderBadgeStrip(p)` refreshes the
visual strip on the select screen.

---

## 19. Practice and review system

This section describes the **practice queue** — one counter per word, driving
Drill, Revenge and the daily challenge. It is not the retention model; for what
the app knows about a child per skill, and when it schedules a check, see §25.

### 19.1 Practice queue (failed words)

`failedWords[zh]` accumulates when `logWrong(p, zh, py, en)` is called.
The sidebar shows the top 8 by failCount. Correct answers in Drill mode
decrement `failCount`; when it reaches 0 the word is removed.

### 19.2 Drill mode

A quick MCQ round over all words in `failedWords`. +2 stars per correct
answer; +3 if streak ≥ 3. Correct answers reduce `failCount` and eventually
remove the word from the queue. Rendered in the `drill-overlay`.

### 19.3 Revenge Round (错题反击)

Takes up to 6 highest-failCount words and builds an MCQ round with HSK
distractors. Saves to `pendingSessions.revenge` for resumability.

### 19.4 Daily Word Challenge (每日一字)

One word per day (seeded by `todayKey() + curP`). MCQ format: +5 stars for
correct. Word comes from `failedWords` if library has entries, else from
`HSK_VOCAB[1]` as a warm-up. Displayed in the hub sidebar.

---

## 20. Parent dashboard

Accessible from select screen via "Parent" button; password-protected (`'1234'`
in dev — change for production). Available features:

- **Weekly / Daily tabs** — toggle between weekly summary and today's stats
- **Star controls** — give or remove stars in custom amounts (parent decides)
- **Mystery pick controls** — grant or remove pending mystery box picks
- **⚠️ Played before 2 reads flag** — shows dynasties where games were played
  with `storyReadCount < 2` (informational only, does not block)
- **Failed words grid** — lists words each player struggled with this week
- **Co-op goal setting** — set the family co-op star target (40–500 stars)
- **Mascot toggle** — hide/show mascot bubble
- **Clear all progress** — requires password confirmation

Parent PIN is also the session timer override. When the 20-minute session
timer expires, the kid enters the PIN to unlock an additional 20 minutes.

---

## 21. Session and time management

### Play session timer
`SESSION_MINS = 20`. Timer counts down in the hub sidebar. Reaching zero
shows the `timelock` overlay. Parent PIN unlocks another 20 minutes
(`timerUnlockUntil = Date.now() + SESSION_MINS * 60 * 1000`).

### Play time tracking
`dailyTimeMs[todayKey()]` accumulates in 15-second flush intervals
(`flushPlayTime`). Used in parent dashboard and for the "time played today"
stat. Does NOT count time in overlays (flash, quiz, etc.) — only hub time.

### Streak calendar
`getConsecutivePlayDays(p)` walks back up to 45 days checking `dailyTimeMs`
and `todayStats` for any activity. The 7-day strip in the hub sidebar shows
the last 7 days as filled/empty dots.

---

## 22. Engagement systems

### 22.1 Mascot

An animated character that appears periodically with encouragement messages.
Shown in the hub visual area. Can be disabled by parent in the dashboard.
Mascot unlocks and becomes interactive after the player clears their 5th gate
(`checkMascotGateFiveUnlock`). Different mascot sessions triggered by:
`'streak'`, `'revenge'`, `'gate'`, `'champion'`, `'first_story'`.

### 22.2 Mystery box

Pending picks stored in `mysteryPicksPending`. Opened from a hub card. Prizes:
star payouts based on `badgeFragments` and family co-op thresholds.
`maybeGrantMysteryFromGate(did)` can automatically award a pick after clearing
a gate if the gate's `rewards.mysteryBoxChance` > 0 in the curriculum JSON.

### 22.3 Rivalry / co-op strip

Shows both players' weekly star counts side by side. If one player leads by 12+
stars they get the `week_star_lead` badge. A shared co-op goal bar shows
combined weekly stars vs. the parent-set `familyCoopGoalStars` target.

### 22.4 Daily mission

One randomly selected goal per day from a pool of mission types (e.g. clear a
gate, read a story, earn N stars, answer N questions correctly). Stored in
`dailyMission`. Completing rewards bonus stars.

### 22.5 Stickers

Unlock events stored in `stickerIds`. Checked with `checkStickerUnlocks()`
after major milestones. Displayed in the hub.

### 22.6 Micro-rewards

Toast messages like "Nice one!" appear periodically during quiz streaks.
Rate-limited by `microRewardLastAt`.

### 22.7 Pinyin intro

A multi-step lesson overlay explaining the pinyin system. Completion sets
`pinyinIntroDone = true` and awards the `pinyin_master` badge.

### 22.8 Char origin card

A rotating carousel in the hub showing character origin facts (etymology /
pictograph story) from a `CHAR_ORIGINS` array. Cycles every 8 seconds.

---

## 23. UI screens and navigation

| Screen ID | Route / trigger | Description |
|---|---|---|
| `scr-select` | App load | Player select, wall clock, parent button |
| `scr-hub` | `renderHub()` after profile tap | Sidebar + dynasty road main screen |
| `scr-reader` | `openStory(story, dynasty)` | Story reader with pinyin/EN toggles |
| `quiz` | `startGateQuiz(did)` or `startChampionChallenge(grp)` | 3-phase quiz screen |

All other UI is **overlays** (CSS class `show`/`hide`):

| Overlay ID | Opened by |
|---|---|
| `overlay-parent` | `showParentSummary()` |
| `games-overlay` | `openGamesHub()` |
| `flash-overlay` | `openFlashCards(did)` |
| `drill-overlay` | `startDrill()` |
| `revenge-overlay` | `startRevengeRound()` |
| `myday-overlay` | `showMyDay()` |
| `pinyin-overlay` | `showPinyinChart()` |
| `pinyin-lesson-overlay` | `showPinyinLesson()` |
| `culture-overlay` | `openCultureStories()` |
| `daily-word-overlay` | `openDailyWordChallenge()` |
| `mystery-box-overlay` | `openMysteryBox()` |
| `timer-modal-overlay` | Gate timer events |
| `assessment-overlay` | `openAssessment()` — always available, §24 |
| `timelock` | Session timer expiry |
| `comp-overlay` | Legacy story completion (now replaced by mini-quiz) |

`showScreen(id)` hides all `.screen` divs and shows the one with id `scr-{id}`.

---

## 24. Assessment (`Assessment · 学习评估`)

A measurement instrument, deliberately outside the game economy. It is **always
available** from the hub — no gate, no read count — and it awards no stars,
starts no timers, clears no gates, touches no failure counters and consumes no
forgiveness tokens. Nothing a child does in it changes anything a child does
outside it.

| File | Responsibility |
|---|---|
| `js/assessment-core.js` | Pure: item selection, per-band scoring, routing, comparison, the attempt state machine. No DOM, no globals. |
| `js/assessment-ui.js` | Overlay, band transitions, save/resume, per-band report. |
| `js/player-store.js` | Attempts at `chinese-adventure/{playerId}/assessments/{attemptId}`; device id; transactional compare-and-set on the acknowledged base revision; cloud listing and hydration; offline queue flushed on open and on `online`. |
| `data/assessment/<version>/` | Frozen banks, one directory per version; `manifest.json` lists them under `versions` and serves the current one. 1.1.0: 4 bands × 2 forms, 240 distinct items, 34 per form-band, 8 shared anchors per band, 12 passages. |
| `scripts/validate_assessment.js` | Domain contract. `--audio` HEAD-checks all 108 clips. |

**Bands, not a score.** Four custom bands C1–C4. A band is decided on that band's
own evidence only — advance on recognition ≥6/8 **and** meaning ≥6/8 **and**
comprehension ≥4/6. Supported decoding and writing never affect routing. Domains
are **never pooled across bands**: a strong lower band cannot carry a weak higher
one.

**Honest reporting.** No overall "Chinese ability" percentage. The report gives
`correct / submitted`, unanswered count, expected count, support condition and
bank version, one block per band. Writing not yet reviewed reads
`Not independently verified` — never zero, never an estimate. Every item carries
`reviewerType: "model"`: **no educator has reviewed the bank**, and the release
gate is truthful labelling, not a validity claim.

**Unanswered ≠ wrong.** `I don't know` is wrong. Save & Exit, missing audio, a
technical failure and a timeout are **unanswered**.

**One device continues an attempt.** An attempt records the device that started
it and is resumable only there; every device hydrates the cloud's attempts on
open, so history and comparison see them all. Two devices on one attempt sit at
equal revisions most of the time, which is the one case a compare-and-set can
only refuse, so the lock removes the case rather than adjudicating it.

**Reports are scored on the bank they were taken with.** `loadAssessmentBank(version)`
loads a frozen bank by `attempt.bankVersion`; a version the manifest no longer
lists renders "taken on a bank that is no longer available" instead of rescoring.
The builder writes to `data/assessment/<BANK_VERSION>/` and never overwrites an
older directory.

**A repeat is the same sitting.** "Repeat same questions" starts in the original
first band, seeds option order on the original attempt (`optionSeedAttemptId`)
and follows the original band sequence (`bandPath`, `nextPlannedBand`). The
matched form starts in the same band and routes normally. `assessmentCompare`
shows before and after per band per domain, anchors apart from fresh items, and
names the bands it could not compare.

**Pacing.** The assessment spends no play time, so it keeps its own:
`addActiveTime` lands each item's screen time with its answer (capped, so a
closed lid is not thinking) and `shouldOfferBreak` offers a soft "save and
continue later?" once per twenty minutes. No lock, nothing to unlock.

**Audio.** Single-syllable targets use fixed MP3 clips, so unaided recognition —
the one domain where cross-attempt comparison matters — is identical on every
device. Everything else uses device `speechSynthesis`, and each presentation
records `audioSource` and the resolved voice. Stated in the UI: the same item can
sound different on another device, so audio-task changes are not comparable
across devices. Missing audio pauses the domain; it is never scored wrong and
never substituted with visible pinyin in an unaided section.

---

## 25. Retention (`js/review-core.js`)

Evidence is per `{word, skill}`, stored in `reviewRecords` keyed `"zh::skill"`.
Skills: `recognition`, `meaning`, `contextComprehension`, `writingRecall`.
`tracePractice` is tracked apart and is refused by `recordAttempt`.

`failedWords` still exists and is unchanged. It is a practice queue, not a
measurement: one counter per word, bumped by any miss anywhere.

**Only interpretable answers count.** `noteEvidence(p, word, skill, correct, opts)`
is called from Listen, the gate quiz MCQ and pinyin phases, the story mini-quiz,
Drill and Revenge. **Rain, Match and Trace are excluded on purpose** — a mistimed
tap and a mismatched flip are game mechanics, not claims about whether a child
knows a word, and tracing is practice rather than independent recall.

**Only unaided success advances the schedule.** `supported` (pinyin or a
translation on screen, the chart peeked) and `sameSession` (a retry straight after
the answer was revealed) are both recorded and both leave the ladder where it was.
Being told is not remembering. Answering the same item repeatedly in one sitting
advances it once.

```
LADDER = [1, 3, 7, 14, 30]   // days, on successive unaided recalls
```

A miss returns the item to tomorrow and **keeps** the successes behind it.

**Labels, not a mastery flag:** `encountered` → `practising` →
`recalled independently` → `retained on later checks`. The strongest needs two
independent successes on separate dates with at least one a week after teaching.
A test asserts no label ever reads as mastery or failure.

**Bounded review.** 8 items / 4 minutes normally, 16 / 8 in a focus session. The
backlog is retained and reported as plain fact — "5 to review; 12 remain for
later" — never deleted, never held over the child. One slot is reserved for
something already recalled, so a struggling child does not meet an unbroken run
of their own failures.

**Review today** is the student-facing end of the schedule (`buildReviewRound`,
`startReviewRound`, `answerReview` in `index.html`; slot `pendingSessions.review`;
scope `review`). It is reached from a hub card and the fifth row of the games
picker, is always open and never a gate requirement. Each due record is asked
in its own skill: `recognition` is heard and a character tapped; `meaning` shows
the character and asks the English; `contextComprehension` shows a story
sentence with the word blanked and its translation. The first response is
unaided evidence; a miss shows the reveal card and asks once more, recorded
`sameSession`. Early exit saves and pays nothing (§2); natural completion pays a
flat `REVIEW_STARS` (5) whatever the answers. `writingRecall` records are counted
as remaining, not asked — nothing in the app produces them yet.

**Lesson self-checks are not evidence.** A lesson question hides its answer until
Reveal; the child's "I had it" / "Not yet" goes to `lessonSelfCheck`, never to
`reviewRecords`, and pays nothing.

**Attempt entries carry ids.** Each entry in a record's `attempts` has a stable
`id` and an arrival `at`, and `applyAttempt` is a pure fold, so `mergeRecords`
can union two devices' histories and replay them to the same schedule (§26).

`targetsFromAssessment` turns weak assessment domains into **suggestions** only,
carrying `provenance: "assessment"`. Writing awaiting review is never counted as a
weakness. Assessment results never write into the review store by themselves, and
practice never writes back to the assessment record.

---

## 26. Persistence and sync

**Saves are owner-scoped.** `savePlayer(pid)` stamps and writes **one** player;
`saveState()` is `savePlayer(curP)` and returns early when `curP` is null. The
three parent star/mystery mutators pass their own target, because the parent panel
is normally opened from the select screen where `curP` is null. `clearAllProgress`
is the one place a two-player write is correct.

This matters more than it looks. `saveState` used to re-stamp `lastSaved` on
**both** documents to the same `now` and `.set()` both — full replace, no merge,
no transaction — from 89 call sites. Both live documents carried the identical
timestamp, which is exactly the mechanism that let one device's stale copy of the
*other* child win the last-writer-wins comparison. Leaving the un-stamped player
alone is the repair: their old timestamp correctly loses.

**Writes are compare-and-set.** `pushPlayer(pid)` runs a Firestore transaction
against `revision`; a stale write is refused rather than landing.

**Divergence is merged, not resolved by picking a winner** (`js/merge-state.js`).
Stars are an event ledger with stable ids, so the merge is commutative and
idempotent — the same award seen twice counts once, and merge order does not
matter. Sets are unioned; counters are maxed; two genuinely different
in-progress rounds are **both kept** under `conflictSessions` rather than one
being discarded.

**Gate records respect resets, by attempt.** `resetMarker` compares two sides'
resets by archived attempt id first (an id the other side has never seen is a
reset it does not know about), then by day, then by `gateResetSeq`. The
resetting side's record is taken **whole** — a zeros object counts, because that
is what `resetGateProgress` writes for game stars. The old rule only dropped a
stale record when the resetting side held nothing, so a reset that wrote zeros
lost to a stale copy's threes through the per-field max. `gateTimers` merge per
gate, preferring the attempt not archived on either side.

**Review evidence is unioned, never picked.** `reviewRecords` merge key by key;
with `ReviewCore.mergeRecords` (passed in explicitly via `mergeOptsFor`, since
merge-state is a pure module) the two histories are unioned by attempt id and
replayed, so merge order does not change the schedule. Before this there was no
rule at all: the whole object came from the local copy, and a device with an
empty store erased the other's history on first sync.

**Past the history bound, the fold is what keeps the union honest.** `attempts`
is capped at `MAX_ATTEMPTS` (40). Trimming used to discard the overflow, so a
replay would have understated the record and `mergeRecords` gave up and kept one
whole copy instead — which made the result depend on argument order (both call
sites pass local first, so local always won and two devices never converged),
and dropped the other side's evidence: a device with 40 old entries beat a
fresher one carrying three real misses. A record at 40 stays at exactly 40, so
that branch, once entered, was permanent for that word.

Trimming now folds the shed attempts into `record.checkpoint`
(`{count, stage, firstTaughtOn, successes}`) — what a replay cannot recompute.
Every field commutes (max, min, set union), so two views of the same folded
prefix merge to the same seed, and `mergeRecords` always unions and replays.
Replaying an attempt the other side had already folded is harmless: an
independent success advances the ladder once per date and the seed already
carries that date. `pickFuller` is gone.

**A null slot is not "nothing here".** Every slot is initialised to `null`, so a
plain object merge wrote a device's null over the other's live round. A null
slot now adopts the other round unless `pendingSessionClearedAt[slot]` says this
device cleared it after that round was last saved.

**Firestore rules.** `firestore.rules` is a **merge fragment, not a publishable
ruleset** — the Firebase project serves other apps whose paths are not visible
from this repo, and deploying a whole ruleset authored here would lock them out.
Paste it alongside the existing rules. `scripts/check_firestore_rules.js` probes
read-only afterwards; it never writes, so a wrong ruleset cannot leave junk behind.

---

## 27. Deferred callbacks

Every timer, animation frame and async continuation goes through a registry:
`laterCall(scope, fn, ms)`, `repeatCall(scope, fn, ms)`, `drainScope(scope)`,
`drainAllDeferred()`, and a monotonic `sessionGen` that `selectPlayer` and
`goToSelect` bump.

Scopes: `quiz`, `games`, `flash`, `listen`, `review`, `session`, `ui`. `exitQuiz` drains
`quiz`; `closeGamesOverlay` drains `games` and `review`; a profile switch drains everything
except the wall clock, confetti, the blob-URL revoke, the Firestore listeners and
the `visibilitychange` handler.

Three properties forced this shape:

- **Handles come in sets.** Rain has roughly nine concurrent drop callbacks, each
  of which calls `logWrong(curP, …)` when it fires. Registration appends to a Set.
- **Two of the worst offenders are not timers.** HanziWriter quiz callbacks and
  in-flight `await`s cannot be cancelled by handle, so they capture `sessionGen`
  and bail when it is stale.
- **Order matters.** `flushPlayTime` must run *before* `curP` is nulled, or the
  last play-time delta is silently dropped.

Without this, a pending `goNext` after a profile switch ran `renderQuizResult`
against the other child's state.

---

## 28. Tooling

```
npm run check                 # inline-script parse guard (§9.1)
npm run validate:curriculum   # gate/word quality, incl. the junk-gloss filter
npm run validate:stories      # ladder, glosses, punctuation, translations
npm run validate:lessons      # bilingual instructions, passage is a real text
npm run validate:assessment   # bank contract; --audio HEAD-checks every clip
npm test                      # node --test tests/*.test.cjs
npm run verify                # all of the above, in that order

npm run build:stories         # content/stories/** -> data/stories/**
npm run build:lessons <lv>    # a level's lessons, from each gate's own story
npm run coverage:content      # what content exists behind the 88 gates
```

`tests/helpers/app-loader.js` loads the real inline script into a Node `vm` with
stubbed browser globals, strips the trailing `init()`, and bridges the script's
`let`/`const` bindings onto the context — so tests drive the actual app code, not
a reimplementation. `firebase` is left undefined, so no test can reach the live
collection. Fixtures are synthetic.

`scripts/backup_players.js` exports the live documents before any migration;
`backups/` is git-ignored and holds **real learner records** — never commit it.

**Browser testing is not optional here.** Unit tests missed two production bugs
that a real Chromium run caught, including a migration skip that would have
silently erased every completion. Per §9.5: if you cannot run the UI, say so.

---

## 29. Adapting this blueprint for other languages

When building **French Adventure** or **English Arts**, the following changes
are required; everything else in §1–§22 can be reused as-is:

| Concern | Chinese Adventure | New app |
|---|---|---|
| Character rendering font | Noto Serif SC | Appropriate font for the language |
| Stroke-order game (Trace) | HanziWriter | Different library or skip this game |
| Pinyin typing (Phase 2 quiz) | Strip-tone comparison | Replace with equivalent phonetics |
| Story token format | `{ t, ch, py, mn, bonus }` | Same shape; omit `py` if no phonetic gloss |
| Dwell time threshold | 45 s | Same or adjust for article length |
| HSK levels | 4 levels, gate thresholds 5/11/17 | CEFR levels or curriculum levels |
| Dynasty content | 22 Chinese dynasties | French history periods / English grammar units |
| `STORIES_MAP` / `DYNASTIES` | Inline in HTML | Move to JSON files if many topics |
| TTS speech synthesis | `speak(zh)` using Web Speech API | `speak(text, lang)` with `lang` param |
| `CHAR_LOOKALIKES` | Visually similar characters | Rhyming words / homophones for MCQ distractors |
| Firebase collection | `'chinese-adventure'` | `'french-adventure'` / `'english-arts'` |
| localStorage key | `'zh_adv_v1'` | `'fr_adv_v1'` / `'en_arts_v1'` |
| Parent PIN | `'1234'` in dev | Change for production |
| Player avatars/colors | 🐥 Jenn, 🦊 Jess | Same or customise |
