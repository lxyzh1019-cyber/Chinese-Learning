# CLAUDE.md — Chinese Adventure: Complete App Blueprint

This file is the definitive reference for the Chinese Adventure app and
serves as the blueprint for rebuilding it ("French Adventure", "English Arts",
or any similar language-learning project for kids).

It has two parts:
- **Part A** (§1–§10): Design and engineering rules — the "how we build"
- **Part B** (§11–§22): Full app architecture — the "what we built"

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

**Single-file HTML app.** The entire app is `index.html` (~6 700 lines). All
CSS, JS, and inline data live in one file. No build step, no bundler.

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

### HSK level derivation

HSK level is derived automatically from gates completed — it is never stored:

```javascript
function getCurrentHSK(s){
  if (s.gatesCompleted.length >= 17) return 4;
  if (s.gatesCompleted.length >= 11) return 3;
  if (s.gatesCompleted.length >= 5)  return 2;
  return 1;
}
```

HSK tabs on the hub are locked until the threshold is reached:
- HSK 1: always open
- HSK 2: ≥ 5 gates
- HSK 3: ≥ 11 gates
- HSK 4: ≥ 17 gates

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
    gatesCompleted: [],     // array of dynasty gate IDs (1–22) that are cleared
    storiesCompleted: [],   // legacy story IDs — gates marked complete via old flow
    gateStars: {},          // { dynastyId: 0|1|2|3 } best quiz stars per gate
    gateGameStars: {},      // { "did": { trace, match, rain, listen: 0|1|2|3 } }
    gateBestQuiz: {},       // { "did": { accPct, quizStars } }
    championBestQuiz: {},   // { "grp": { accPct, quizStars } }
    championCleared: {},    // { grp: stars } — passed champion challenges
    lastGateQuizAttempt: null, // { did, isChampion, accPct, quizStars, atKey }

    // ── Vocabulary ──
    library: {},            // { zh: { py, mn } } — characters tapped in stories
    failedWords: {},        // { zh: { zh, py, en, failCount, lastFailed } }
    traceStars: {},         // { zh: 0|1|2|3 } — best trace stars per character

    // ── Reading gates (§3/§4) ──
    storyReadCount: {},     // { storyId: number } — dwell-validated read count
    flashPassDone: {},      // { dynastyId: true } — completed flashcard deck

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
    },

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
    gateTimers: {},         // { "did": { startKey, deadlineKey, active, days } }
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

22 dynasties, IDs 1–22, chronological order. Each dynasty maps to one "gate"
that must be cleared to progress.

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

### HSK groupings
- HSK 1: Gates 1–5 (Xia → Qin)
- HSK 2: Gates 6–11 (Western Han → Sui)
- HSK 3: Gates 12–17 (Tang → Jin)
- HSK 4: Gates 18–22 (Yuan → Republic)

### Gate unlock rule
Gate N is available to read/play only after gate N−1 has been cleared (or N=1
which is always open). `isStoryUnlockedForDynasty(did, s)` implements this:
`did === 1 || s.gatesCompleted.includes(did - 1)`.

### Champion challenges
One Champion Challenge per 5-gate group (groups 1–4). Unlocks only when all 5
gates in the group are cleared. Champion quizzes draw vocabulary from all 5
dynasties in the group. Passing awards `s.championCleared[grp] = quizStars`.

### Gate timer
When a player earns 3★ on any game for a gate, a countdown timer starts
(`gateTimerDays = 5 + 2 * floor((gateId - 1) / 5)` days). If all games and
quiz are not cleared before the deadline, gate progress is not wiped — but a
warning modal appears on each login. Timers only apply to individual gates,
not HSK / WIP scopes.

---

## 15. Content system

### 15.1 Dynasty stories

Each dynasty has two story articles (`story` and `story2`). Stories are
tokenized into sentences, each sentence an array of tokens:
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

Concentration-style flip-and-match. Pair count: 6 for gates 1–14, 8 for gates
15–22. Cards show Chinese character on one side, English meaning on the other.
**Wrong flip does not add to `failedWords`** (it would punish memory, not
vocabulary knowledge).

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
| `timelock` | Session timer expiry |
| `comp-overlay` | Legacy story completion (now replaced by mini-quiz) |

`showScreen(id)` hides all `.screen` divs and shows the one with id `scr-{id}`.

---

## 24. Adapting this blueprint for other languages

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
