# CLAUDE.md — Design and engineering rules for kid-focused learning apps

This file captures the design principles and engineering practices established
while building a Chinese-learning web app for kids. Reuse it as a baseline for
any educational project where children are the primary users.

---

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

This rule applies uniformly to every game and every quiz. Don't make
exceptions; consistency is what closes loopholes.

**Common loophole to avoid.** Percentage-based scoring rewards
`1 correct / 1 attempt = 100% = 3 stars` if the kid quits after one tap. The
correct fix is **not** a minimum-sample-size guard — that wrongly penalizes
small word pools on legitimate completions. Instead, gate the star
calculation behind "round naturally ended" (timer expired, all questions
answered, all items completed).

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

**Ordered unlock chain (example for a dynasty-themed lesson):**

1. Read the lesson article (≥45 s dwell time, see §4) → introductory game
   unlocks (e.g. Listen).
2. Finish flashcard pass on the new vocabulary → skill-building game unlocks
   (e.g. Trace).
3. Read the article a second time → practice games unlock (e.g. Match, Rain).
4. Some games gate on a precursor game being played at least once.

Show locked options as disabled with a one-line "what to do to unlock" hint
rather than hiding them entirely — kids should see the path forward.

**Apply gating only to the dynasty/lesson scope.** Generic-scope versions
(HSK level, "work in progress" practice list) should stay open so kids
always have somewhere to land.

---

## 4. Dwell time gates

A read-count or watch-count gate without a dwell-time check is worthless;
kids will discover the click-open-close trick in under a minute. Track
`activityOpenTime = Date.now()` when an article (or video, or anything you
want gated by attention) opens, and only count it as completed if
`Date.now() - activityOpenTime >= MIN_DWELL_MS`. 45 seconds is a reasonable
default for a short article.

---

## 5. UX for hard skills (handwriting, pronunciation, etc.)

When the target skill is genuinely hard, apply all of these:

- **Auto-play a demonstration first.** Do not drop the kid into a quiz
  immediately. For Chinese stroke order, animate the full character before
  enabling quiz mode.
- **Slow animations down.** `strokeAnimationSpeed: 0.7` with
  `delayBetweenStrokes: 200ms` reads much better than the library defaults.
- **Generous but bounded retries.** "Watch again (3 left)" with a visible
  countdown teaches the limit without being punitive.
- **Explicit "I'm ready" button.** Don't auto-start the quiz; let the kid
  pick the moment.
- **Softer star thresholds.** `0 mistakes = 3 stars, ≤ 4 = 2 stars, else 1`
  is far more forgiving than `0 / ≤ 2 / else` and far better suited to
  early learners.
- **Tier the encouragement** to the result:
  - 3-star tier: "Perfect! 🌟", "Flawless! Amazing! ✨", "You nailed it! 🏆"
  - 2-star tier: "Great job! Keep going! 💪", "Nice effort! 🎉"
  - 1-star tier: "Good try! Every stroke counts! 📚", "Practice makes perfect! 💫"
- **Auto-advance after celebrating.** Show the result for ~2 s, then move on
  without requiring a button press.

---

## 6. Badges — celebrate effort

| Pattern | Bad | Good |
|---|---|---|
| Wrong-answer milestone | "100 wrong answers" / 😵 | "100 brave tries — every try grows you!" / 🌱 |
| Repeated misses on same item | "No Brain: same word wrong 5×" / 🤦 | "Never give up — met a word 5 times" / 💪 |
| Long-term effort | "500 mistakes" / 💀 | "Mighty learner — 500 brave tries" / 🌳 |
| Persistence | "Stubborn streak" / ☠️ | "Master climber — 1000 brave tries" / 🏔️ |

Toast notifications when a badge unlocks should also reframe the metric:
- "💪 Never Give Up badge! Meeting a word 5 times is how it sticks."
- "🌱 Brave Tries badge! Every try grows your brain."

---

## 7. Parent dashboard — visibility, not blocking

Parents want signal; kids need an uninterrupted experience.

- Show the practice queue size, reading streak, time spent.
- Add **informational flags**, not hard blocks. Example: a weekly summary row
  like "⚠️ Played games before 2 reads: Xia Dynasty, Shang Dynasty" surfaces
  the pattern without taking anything away from the kid.
- The dashboard is a conversation starter for the family, not a control panel.

---

## 8. State migration when adding new gates

When you introduce a new prerequisite (e.g., "must finish flashcard pass
before Trace unlocks"), do not strand users who already had access:

- If a player has the gate marked complete (`gatesCompleted` contains the ID),
  bypass the new prerequisite entirely.
- If a legacy "completed" flag exists for the resource (e.g.
  `storiesCompleted` contains the story ID), treat its read count as fully
  satisfied.
- Always tolerate missing fields:
  `(s.storyReadCount || {})[sid] || 0`.

Renaming a state key after launch is expensive because it lives in
localStorage / persisted state. Pick forward-looking names from the start
(`storyReadCount`, not `read1`).

---

## 9. Engineering practices

### 9.1 Always parse-check large inline-script edits

Single-file HTML apps embed JS inside `<script>` tags. A single stray `}` from
a botched function rewrite kills the **entire** script silently — every
`onclick` handler does nothing because the file never parsed. The kid sees a
profile screen where the buttons don't react.

Before pushing any multi-block edit to a file that contains inline JS, run:

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=/<script(?![^>]*src=)(?![^>]*type=\"importmap\")[^>]*>([\s\S]*?)<\/script>/.exec(html);
fs.writeFileSync('/tmp/inline.js',m[1]);
" && node --check /tmp/inline.js
```

If the script is broken, the error points to a specific line in the extracted
script; add the script's HTML start-line offset to find it in the original
file.

### 9.2 When rewriting a function with Edit, include both braces

The `old_string` and `new_string` must each contain the function from
`function name(` through its **matching final `}`**. Leaving the closing `}`
outside the `old_string` will leave it as an orphan after your new code ends,
producing exactly the syntax error described above.

### 9.3 Star-rule enforcement lives in one function, not many

If you have a generic helper like `starsFromAccuracy(correct, total)`, do not
sprinkle conditional guards across each caller. Enforce the
"round-must-complete" rule at the call site (i.e., only call the helper from
the natural-end branch of the activity). Keeping the helper pure makes it
safe to reuse from other contexts and easy to reason about.

### 9.4 Commit messages should explain the why

Commits like "Apply complete-round-for-stars rule consistently across all
games + gate quiz" are far more useful three months later than "fix scoring".

### 9.5 Test the UI

Type-checking and unit tests verify correctness, not feature correctness.
For a kid-facing app, launch the dev server and click through the actual
flow:
- Open a profile, navigate to the locked content, confirm the unlock message.
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
  // ...
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
  // ...
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
  // Legacy migration
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
  persistMatch();              // write current state to player.pendingSessions.match
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

  // Persistent learner: same word missed 5 times
  if (s.failedWords[zh].failCount === 5 && !s.badges.includes('persistent_5')) {
    s.badges.push('persistent_5');
    showToast('💪 Never Give Up badge! Meeting a word 5 times is how it sticks.', 2800);
  }

  // Brave Tries milestones
  const wc = s.totalWrongAnswers;
  const milestones = [
    [100,  'tries_100',  '🌱 Brave Tries badge! Every try grows your brain.'],
    [500,  'tries_500',  '🌳 Mighty Learner! 500 brave tries — amazing effort.'],
    [1000, 'tries_1000', '🏔️ Master Climber! 1000 brave tries — incredible.'],
  ];
  for (const [n, id, msg] of milestones) {
    if (wc === n && !s.badges.includes(id)) {
      s.badges.push(id);
      showToast(msg, 2800);
      break;
    }
  }
}
```
