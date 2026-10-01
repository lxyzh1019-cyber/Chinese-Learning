# FEATURES — Chinese Adventure — manifest v1 — confirmed 2026-09-30

Locked features of the current version. Every edit is checked against this list and ends with a regression table. Update this file in the same change that alters a feature. Over-list rather than under-list. Source: `ARCHITECT.md` §1–§29 and `index.html` at `main` 91d2601.

## Players and levels
- Two fixed players, Jenn 🐥 and Jess 🦊, chosen on the profile-select screen; tapping a card opens the hub.
- Profile cards read "⭐ n stars · 🏯 Gate x/22" (never "pts").
- HSK 1 is always open; HSK 2/3/4 open only when all 22 gates of the level below are cleared.
- 88 gates = 4 levels × 22 dynasties, keyed `h{level}-g{NN}`; gate N opens only after gate N−1 of the same level.
- One Champion Challenge per 5-gate group per level; opens when the group is cleared; passes on quiz alone (≥90% and 3★).
- Legacy saves migrate through `GateIdentity.needsMigration` (gate ids and story ids), idempotently, with no invented completions.

## Reading and learning gates
- Dynasty-scope unlock chain: read story ≥45 s → Listen; flashcards done → Trace; second read ≥45 s → Match; Listen played once → Rain.
- Locked options show as disabled with a one-line hint; HSK and practice-list scopes are always open.
- Story reader: tap a character to show pinyin + meaning, add it to the library and play audio; pinyin/English toggles; progress bar over study characters.
- A read pays 5 per new character + 20, capped at 100; a story mini-quiz follows the read (progress shows "n / N", no score line).
- Stories per level (ladder 10/15/20/25 sentences); a level without its own text says it's showing the HSK1 telling.
- Lesson cards in the dynasty detail panel: key vocabulary, `check` questions with explanations shown either way, self-check fallback, speaking prompt.
- Culture stories are independent of gates and may reward stars once.

## Games (Listen, Match, Rain, Trace)
- Three word scopes: dynasty, HSK, practice list (failed words); the game is called "Match" everywhere.
- Listen: 10 audio questions, 4 options, streak bonus; stars from accuracy at natural end.
- Match: flip-and-match, pairs = min(pool, 6 or 8); stars from time (<2 min 3★, <3 min 2★, <4 min 1★); wrong flips don't add to the practice list.
- Rain: 45 s, falling characters, combo; stars from hits/attempts at natural end.
- Trace: HanziWriter demo first, "Watch again (3 left)", explicit start, 0 mistakes 3★ / ≤4 2★ / else 1★, auto-advance.
- Forgiveness tokens: every two 2★ rounds in HSK/practice-list scope earn one token for that game; a token absorbs one wrong answer in dynasty scope.
- Every game and quiz: early exit saves the session, pays zero stars and shows a "Progress saved — finish … to earn stars" message.
- "Resume last activity" restores any saved session.

## Gate quiz
- Three phases: character/meaning multiple choice, pinyin typing (tones not required, chart peek removes the bonus), sentence builder (3 sentences; alternates accepted).
- Scoring: +10 / +8 / +20 per correct, with no-assistance bonuses; stars from accuracy (>85% 3★, >70% 2★, >55% 1★).
- A gate clears when the best quiz is ≥90% with 3★ **and** all four games are at 3★ for that gate, before its timer runs out.
- Completion pays once (`evaluateGateCompletion`); a replay pays nothing.
- A round that outlives a gate reset is shown as practice and pays nothing.
- Recent-question deduplication (last 80 MCQ and 80 pinyin keys per gate).
- Result screen shows cleared / quiz passed / almost / practice state, the stars for this try, "n of N right · best ever: x%", and a "Next: open this gate" card with what's still needed.
- Quiz labels read "Question n of N" / "Sentence n of N"; right answers say "✅ Correct!"; no points, phases or score lines on kid screens.
- Wrong answers show "Not quite — it is …"; chosen options are marked ✓ / ✗.

## Gate timer
- The first 3★ game on a gate starts a countdown of `5 + 2·floor((gate−1)/5)` days; expiry is swept on hub render.
- Expiry resets that gate's game stars, best quiz and pending quiz (archived first); library, practice list, review records and stars are kept.
- Time-up card with a parent "Unlock" option.

## Practice and review
- Practice list (`failedWords`): wrong answers add a word; the sidebar shows the top 8.
- Drill: MCQ over the practice list, +2/+3 stars, correct answers lower the count and eventually remove the word.
- Revenge Round: up to 6 hardest words, resumable.
- Daily Word Challenge: one word per day per player, +5 stars.
- Review today: bounded round (8 items / 4 min), one skill per task, flat 5 stars at natural end, always open, never a gate requirement.
- Retention evidence per word and skill; only unaided success advances the 1/3/7/14/30-day ladder; labels never claim mastery.
- Rain, Match and Trace record no retention evidence.

## Rewards and engagement
- 16 badges (effort-framed, never shaming); badges are never removed.
- Mascot (parent can hide it; unlocks after the 5th gate).
- Mystery box picks, rivalry/co-op strip with a family goal, daily mission, stickers, micro-reward toasts, pinyin intro, character-origin carousel.
- Wrong answers are never shamed; the reveal card rotates encouragement lines.

## Session and time
- 20-minute play session timer; timelock overlay at zero; the parent PIN unlocks 20 more minutes.
- Play time tracked per day (hub time only); 7-day streak strip.
- My Day overlay: today's summary rows for the current player (no forgiveness-token row).

## Parent screen
- Opened from profile select with the parent PIN; star edits and Clear all also ask for it.
- Weekly / Daily report tabs, "played before 2 reads" flag, failed-words grid.
- Star manager: give/take stars, give/remove mystery picks, per player.
- Order: report first, then Star manager, then Settings · 设置, then Clear all; help lines under star controls, webhook and Clear all.
- Settings: hide mascot, co-op stars goal, co-op minutes goal, audio mode, webhook URL with export and send.
- Clear all progress: password first, wipes both players to fresh state, stamps `progressClearedAt`, keeps parent settings, device id and assessment attempts, and reports whether the wipe reached the cloud.

## Assessment
- Always available from profile select; awards nothing and changes nothing outside itself.
- Four bands C1–C4 decided on each band's own evidence; honest per-band report; unanswered ≠ wrong.
- Reports are scored on the frozen bank they were taken with; one device continues an attempt.

## Data, sync and safety
- Local save under `zh_adv_v1`; Firestore `chinese-adventure/jenn` and `/jess`.
- Owner-scoped saves; compare-and-set writes; divergence merged (star ledger, unions, max counters, both sessions kept).
- Gate resets and Clear all win merges as designed; null session slots don't erase a live round.
- Deferred callbacks run through scopes and are drained on exit and profile switch.
- Tests never reach the live collection (`firebase` undefined in the test loader).

## Looks and themes
- Three themes: Crimson (default), Spring, Autumn, applied at start-up by season class; colours come from `:root` tokens.
- Fonts: Ma Shan Zheng (decorative), Noto Serif SC (Chinese), Quicksand (UI).
- Hub: sidebar + Dynasty Road (at 900 px or narrower: profile chip, Dynasty Road, then sidebar cards, full width); pop-ups up to 720 px; games picker; overlays for flash cards, drill, revenge, My Day, pinyin chart and lesson, culture, daily word, mystery box, timers, assessment, timelock.
- Chinese text (characters, pinyin) is never altered by UI or wording changes.
- Main buttons (`.btn-p`, `.btn-g`) are gold in every theme; only Clear all, Take and Remove pick stay red.
- Buttons and choices are at least 52 px tall; parent inputs at least 44 px; no CSS text under .65rem; heaviest weight 700.
- Profile-select screen shows a hand-updated version stamp (`v2026-09-30`).
- Story sentence stripes are gold (no per-sentence rainbow colours).

## Content tooling
- `npm run verify` runs parse check, curriculum, stories, lessons, sentences, culture and assessment validators, then the tests.
- Vocabulary repairs go through `scripts/vocab-overrides.js` → `repair_vocab.js` → `docs/vocab-repair-ledger.md` and survive a rebuild.
- Assessment banks are frozen by hash; an in-place edit fails validation.

## Regression table format (paste at the end of every edit)
| Feature | v<old> → v<new> | Note |
|---|---|---|
| <feature> | kept / added / changed / removed | <why> |
