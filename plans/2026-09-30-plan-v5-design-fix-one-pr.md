# Plan v5 — Design fix, all five parts in one PR — Approved (v4 on 2026-09-30; Rev 4 items approved in chat the same day)

Written by: Opus 5.5 (session model; the planner hook suggested `/model fable`, but the session wasn't switched). Executors: sonnet-worker (Routine) for looks and wording; opus-worker (Complex) for the English meanings in the data; main session for planning documents only.

## Summary

🟪 **Rev 4** After stage 8 you added three things: fix the pinyin of 吗 (ma), 底 (dǐ) and 刺 (cì) so it fits the corrected meaning; apply the two older repairs 回 and 兵 that were in the repair list but never reached the app; and rebuild the stories now so their tap meanings for 吗 and 当 update in this PR. They run as stage 8b.

🟧 **Rev 3** Part 5 is now much smaller, as you chose. Every English meaning stays as it is, except the five words you picked: 吗, 当, 刺 and 底, whose current meaning is wrong, and 获, which keeps its old meaning with the HSK4 sense added in front.

🟩 **Rev 2** The work now runs **on this computer**, as you chose. I found the design files in your Downloads folder (the handoff zip). This computer has no Playwright, so screenshots use the app's built-in browser. They run with the live family data switched off, so nothing is installed and nothing touches the girls' saved progress.

🟦 **Rev 1** You asked for everything in one pull request and agreed to the four decisions. This plan keeps every work item from v1 and adds the other four parts of the handoff: wider pop-ups, and a portrait home that puts the Dynasty Road first; kinder, simpler words on the kids' screens; the parent screen reordered with the report first; 🟧 **Rev 3** corrected English meanings for five HSK words. One branch, one pull request, one merge by you.

Looks, wording, order and English meanings only. No behaviour, no Chinese text, no tests, no live data change.

What I need from you: approve this plan, then merge the pull request when it's ready.

### 🟧 **Rev 3** Changes in this version
- **Stage 8 shrinks to five words** you picked. The other 35 meanings from v3's list stay exactly as they are now, dictionary labels included. Removed: v3's 40-row list, the "rewrite the five override entries" step and the dictionary-code grep. Sections changed: Summary, part 5, Risks, stage table, Stage 8, Stage 9, Success criteria.
- The Stage 8 scope decision from v3 is answered (your pick: only meanings that are wrong), so no decisions are open.

### 🟩 **Rev 2** Changes in the previous version (kept)
- **Where it runs:** this computer, not the cloud. Handoff zip at `D:\User\Heng Z\Downloads\chinese-adventure-handoff.zip`, unzipped into the session scratchpad (outside the repo). New branch from `main` 91d2601. Local worker-instructions path.
- **Stage 9:** screenshots and the tap-size check use the built-in browser, served by a small local helper that strips out the online database, instead of Playwright. Road-label check added.
- **Corrections folded in:** the font-size count is scoped (22 in the style block; the 8 in inline styles are left alone); Take/Remove colours named as inline HTML; version stamp updated by hand.

❓ **Decisions** — none open.

## The five parts, one line each

1. **Tokens, colours, sizes, docs.** New token set, about 130 hard-coded colours become tokens, main buttons gold, 52 px tap targets, 12 px text floor, weight 700, plus `docs/DESIGN.md` and `docs/mockups/mockups.html`.
2. **Layout.** Pop-up boxes up to 720 px; portrait home puts the Dynasty Road above the sidebar cards; time-up card wider, with a title that doesn't wrap.
3. **Kids' wording.** "Not quite — it is …" with ✓/✗; quiz labels as "Question 2 of 7" with no phases or points; simpler result screen; "Match" everywhere; "Practice list" instead of "Work in Progress"; forgiveness-token row hidden from My Day.
4. **Parent screen order.** Report first, then star controls, then Settings with a heading and help lines, then Clear all progress.
5. 🟧 **Rev 3** **English meanings.** Four wrong meanings corrected and one completed (吗, 当, 刺, 底, 获), through the repair script and ledger; every other meaning stays.

## Risks

- **Item 7 is a false positive** (dropped). The five "duplicate" pairs are phone-width, reduced-motion or narrower-element rules (241/242, 471/473, 480/481, 665/667, 579/623).
- **Line numbers.** `index.html` (8507 lines) matches `e99689c` byte for byte. 🟩 **Rev 2** I checked every anchor again in this clone and all match: feedback lines 2730, 4100, 4612, 6304, 6453, 6572, 7873; Mix hint 6951–6960; phase labels 6984, 7011, 7259, 7345; score lines 6993, 7023, 7269, 7356; points lines 7074, 7303; result 7467–7568; `quizPass` 7503; names 4344, 5545–5548, 7552; `scopeWip` 1192; My Day rows 3898–3899; settings block 912–941; `#parent-star-msg` 981.
- 🟩 **Rev 2** **Four wrong senses, not just odd wording.** 吗 shows "(coll.) what?", but it's the yes/no question word. 当 shows "(onom.) dong", but at HSK2 it means "when; to act as". 刺 shows "(onom.) whoosh", but at HSK4 it means "thorn; to prick". 底 shows "(equivalent to 的 …)", but at HSK4 it means "bottom; end (of a month or year)". These come from the upstream dictionary picking the wrong sense. Stage 8 fixes them through the overrides, like the earlier repair round. 🟧 **Rev 3** 获 also keeps "(literary) to catch; to capture", with "to win; to get" put in front of it.
- 🟧 **Rev 3** **Override file.** None of the five words is in `scripts/vocab-overrides.js` yet, so each gets a new entry. The existing entries (个, 张, 支, 台, 种 and the rest) stay as they are.
- 🟦 **Rev 1** **Validators pin glosses.** `validate_stories.js` and the lesson/sentence validators check copies of a word against each other. A gloss changed in one place but not another fails `npm run verify`. That's the safety net, not a risk to the tests.
- 🟩 **Rev 2** **Live family data.** The app connects to the online database as soon as it loads (Firebase scripts at lines 752–753, `initFirestore` at 1907). The screenshot helper serves a copy of the page without those two script lines, so `firebase` is undefined and the app never connects. The repo file is never changed for this.
- 🟩 **Rev 2** **Road labels.** `.dr-en` (.5rem) and `.dr-num` (.46rem) sit inside a 78 px box. Raising them to .65rem may wrap them, so stage 9 checks them in both orientations. If they wrap badly, the box widens to fit. Font sizes don't go back below the floor.
- **The season class is set at start-up,** so screenshots add `season-spring` / `season-autumn` after the app starts.
- **The time-up "Unlock" button** stays red, as the handoff says (only `.btn-p` turns gold); the mock-up shows it gold. Left as written.
- 🟦 **Rev 1** **Result-screen tests.** `tests/progression.test.cjs` checks for "Practice round" (1976), for its absence on a live round (2463), for "Cleared!" (2800) and for the absence of "Games at 3★ for this gate" (2803). The new title keeps those strings. No test checks Phase, pts, Score, Memory, Work in Progress or ❌.
- **`FEATURES.md` is the blank template;** the completion hook blocks implementation until it's filled in. That's stage 1.
- **Pull-request mode.** The PR opens ready for review (repository rule; drafts are blocked).
- 🟦 **Rev 1** **One big PR.** About 200 CSS edits, 30 wording edits, one HTML block move and a data rebuild in one diff. The review pass (stage 10) lists blockers by file and line. Each stage runs `npm run verify` before the next starts, so a break is caught at its own stage.

## Tests expected to change

None. Baseline: `npm run verify` 344 of 344 on `main` 91d2601 (cloud run). 🟩 **Rev 2** It runs again on this computer before stage 2; if the local result differs, I report it before any edit.

## Stages to finish

| # | Stage | Who | Executor · Level |
|---|---|---|---|
| 1 | Write `FEATURES.md` from `ARCHITECT.md` §11–§29 (locked, observable features; over-list); 🟩 **Rev 2** update the hotspot row in `WORKING_RECORD.md`; create the branch; unzip the handoff into the scratchpad; baseline `npm run verify` | Claude | main session (planning documents) |
| 2 | Tokens and docs: replace the `:root` block and the two season lines with `tokens.css`; add `docs/DESIGN.md` and `docs/mockups/mockups.html` | Claude | sonnet-worker · Routine |
| 3 | Colour literals to tokens, `.btn-p` gold, lock/drill cards, road labels, gold story stripes, remove `SENT_COLORS` | Claude | sonnet-worker · Routine |
| 4 | Tap size 52 px, text floor .65rem, weight 800 → 700, version stamp | Claude | sonnet-worker · Routine |
| 5 | 🟦 **Rev 1** Layout: pop-up width, portrait home order, time-up card | Claude | sonnet-worker · Routine |
| 6 | 🟦 **Rev 1** Kids' wording: feedback, quiz labels, result screen, Match, Practice list, My Day row | Claude | sonnet-worker · Routine |
| 7 | 🟦 **Rev 1** Parent screen: move settings below star controls; add heading and three help lines | Claude | sonnet-worker · Routine |
| 8 | 🟦 **Rev 1** English meanings through overrides + repair script, rebuild, ledger entries, all copies; 🟧 **Rev 3** five words only | Claude | opus-worker · Complex |
| 8b | 🟪 **Rev 4** Pinyin 吗 ma, 底 dǐ, 刺 cì (characters unchanged); apply held overrides 回 and 兵; rebuild stories (and lessons/sentences if the build order needs it) | Claude | opus-worker · Complex |
| 9 | Checks: `npm run verify`, literal grep, kid-screen word grep, 🟩 **Rev 2** built-in-browser tap-size audit, road-label check and screenshots | Claude | sonnet-worker · Routine |
| 10 | Review pass of the diff against `main`; update `WORKING_RECORD.md`, the `FEATURES.md` regression table, and `ARCHITECT.md` where wording changed; copy this plan to `plans/`; commit, push, open the PR ready for review | Claude | main session (records) + push |
| 11 | Merge the PR on GitHub | You | — |
| 12 | Confirm the merge and close this plan | Claude | main session |

A sonnet-worker that fails twice on a stage escalates to opus-worker with the reason. Stages 2–8 each end with `npm run verify` passing.

**Checked against:**
- The hotspot table has only the governing-docs row, so this area has no history. Stage 1 adds a "UI design / kid wording / glosses" row at 1 fix round.
- Ledger item 8 is open but overtaken: v3.1.21 loads on `main`.
- `docs/vocab-repair-ledger.md` records the earlier gloss route (overrides → repair script → ledger). Stage 8 reuses it rather than editing JSON by hand.

**Removes/consolidates:** `SENT_COLORS`; 15 colour literals become 5 tokens; the "Mix:" hint block and the kid-visible score lines; the second name "Memory" and the label "Work in Progress". The item 7 merges are not done.

## Work items in detail

Chinese text isn't touched anywhere. Where a label changes, only the English changes.

**Stage 2 — tokens and docs.** Replace lines 9–19 and 576–577 of `index.html` with the blocks in `tokens.css`. Copy `DESIGN.md` → `docs/DESIGN.md` and `mockups/mockups.html` → `docs/mockups/mockups.html`. Nothing else from the zip goes in: no PNGs, no `PLAN.md` or `PROMPT.md`.

**Stage 3 — colour mapping** (CSS block, lines 8–751, unless noted)
| Literal | Becomes |
|---|---|
| `rgba(212,160,23,.03–.14)` | `var(--gold-a10)` |
| `rgba(212,160,23,.15–.30)` | `var(--gold-a20)` (`.22` may stay `var(--gold-dim)`) |
| `rgba(212,160,23,.35–.50)` | `var(--gold-a35)` |
| `rgba(212,160,23,.60–.80)` | `var(--gold)` |
| `#FF7070` text; `#C0392B` as a border (399, 408, 436) | `var(--wrong-text)` |
| `rgba(192,57,43,.14)` | `var(--wrong-dim)` |
| `#F8E6A8` / `#9FF5D1` | `var(--py-cream)` / `var(--py-mint)` |
| `#7A1010`, `#8B0000` | `var(--red-deep)` |
| `#C0392B` as a fill (46, 296, 494) | `var(--red)` |
| `.drill-card` 141 | `var(--surface2)`, `var(--deep)`, border `var(--gold-a20)` |
| `.lock-card/.lock-title/.lock-item` 444–446 | bg `var(--gold-a10)`, border `var(--gold-a35)`, text `var(--ink)`, title `var(--gold)` |
| `.dr-en` 325, `.dr-num` 330 | `var(--muted)` |
| `.btn-p` 354–357 | `.btn-g` look: gold gradient, text `var(--bg)`, gold hover shadow; class name kept |
| `.btn-g` 361 text `#1A0505` | `var(--bg)` |
| Story stripes 6059 (script) | `border-left-color:var(--gold-a35)`; `SENT_COLORS` at 1958 removed |
| Leave alone | dynasty road colours in data, confetti (5125), `#B8F5D0`, jade and white alphas that aren't named, tone demo at 1864 |

🟩 **Rev 2** The parent Take / Remove Pick buttons use inline HTML styles (`rgba(192,57,43,.18)` fill, `.4` border) in the star-controls block (about lines 956–975, four buttons). They become `background:var(--wrong-dim);border-color:var(--red)`, so they keep a red tint in every season.

**Stage 4 — sizes.**
- `min-height:52px` (from `patch.css`) on `.btn-p .btn-s .btn-g .btn-danger .mcq-opt .hsk-tab .dwb-btn .back-btn .toggle-btn .game-picker-btn .sum-tab .py-hint-btn .drill-btn .q-speak .lock-in`.
- `min-width:52px;min-height:52px` on `.ov-close .mq-close .cr-close .quiz-xclose .q-speak`.
- Parent inputs at least 44 px.
- 🟩 **Rev 2** The 22 font sizes under `.65rem` in the CSS block become `.65rem`. The 8 inline sizes under `.65rem` in the script and HTML are outside this stage.
- The 30 `font-weight:800` become `700`.
- Version stamp: one muted `t-xs` line on the profile-select screen, `v2026-09-30`. 🟩 **Rev 2** It's updated by hand in any later PR that changes the app, and a note saying so goes in `docs/DESIGN.md`.

🟦 **Rev 1** **Stage 5 — layout.** `.mini-quiz-card` `max-width:460px` → `max-width:min(720px,94vw)`. Add the `@media(max-width:900px)` block from `patch.css` after the `.wrong-grid` media rule (line 481): the hub wraps, the sidebar becomes `display:contents`, the profile chip goes first, main second, sidebar cards last, all full width. `.tl-card` `max-width:330px` → `420px`; `.tl-title` gets `white-space:nowrap`.

🟦 **Rev 1** **Stage 6 — kids' wording (script).**
- The seven feedback lines `'❌ '+X` become `'Not quite — it is '+X`. CSS: `.mcq-opt.correct::before{content:'✓ '}` and `.mcq-opt.wrong::before{content:'✗ '}` (checked: `.mcq-opt` has no `::before` today).
- Delete the "Mix:" hint block at 6951–6960. `lastBossQuizThemeIdx` and the mix logic stay.
- Labels:
  - 6984 → `${pfx}Pick the character · 选汉字 — Question ${a} of ${n}`
  - 7011 → `${pfx}Character Recognition · 汉字认读 — Question ${a} of ${n}`
  - 7259 → `Pinyin Typing · 拼音练习 — Question ${a} of ${n}` (keep the `👑 CHAMPION · ` prefix)
  - 7345 → `Sentence Builder · 句子排列 — Sentence ${a} of ${n}`
- Remove the kid-visible score lines 6993, 7023 and 7269, and the `· Score:` part of 7356.
- 7074 `'✅ +10 pts base'+bonusHtml` → `'✅ Correct!'+bonusHtml`, with the bonus tag reading `${parts} bonus!`. 7303 → `'✅ Correct!'` and `🎯 bonus!`. The scoring maths doesn't change.
- `renderQuizResult`:
  - Title 7565 → `cleared?'Cleared! 🎉':(qualifies&&quizPass?'Quiz passed!':qualifies?'Almost there!':'Practice round')`.
  - Summary 7568 → `${d.zh} · ${d.en}`, plus `${qcOk} of ${qa} right · best ever: ${bestQuiz.accPct||0}%`. The points and phase lines come off the kid screen.
  - Lock-card title 7559 → `Next: open this gate`.
- Names: 5545 `Memory match` → `Match`; 5546 and 7552 → `Listen, Trace, Match and Rain`; 4344 `'Memory match'` → `'Match'`. Function names stay.
- 1192 `en:'Work in Progress'` → `en:'Practice list'`; 5547–5548 likewise; 3898 `HSK/WIP rounds` → `HSK / Practice list rounds`. Remove the forgiveness-token row (3899) from My Day. Tokens still work, and 5548 still explains them.

🟦 **Rev 1** **Stage 7 — parent screen (HTML).**
- Move lines 912–941 (mascot checkbox, co-op goals, audio mode, webhook) to after `#parent-star-msg` (981) and before the Clear All divider, under the heading `⚙️ Settings · 设置`.
- Add a muted `t-xs` help line under each of these:
  - Give/Take: "Give or take stars by hand."
  - Webhook: "Optional. Sends the weekly summary to this address."
  - Clear All: "Asks for the password, then wipes both girls' progress. Cannot be undone."
- Element ids don't change, so every save handler keeps working. The password-prompt path isn't touched.

🟦 **Rev 1** **Stage 8 — English meanings (data, opus-worker).** Put each meaning in `scripts/vocab-overrides.js`, run `scripts/repair_vocab.js`, regenerate `docs/vocab-repair-ledger.md`, and run the rebuild so `carryForward` keeps them. Fix the same words in `data/lessons/` and the sentence packs where the validators check them. `zh` and `py` never change. The PR lists every gloss old → new.

🟧 **Rev 3** **The five words** (your picks; wording fixed, the worker doesn't change it):

| Word | Now | Becomes | Files with copies |
|---|---|---|---|
| 吗 | (coll.) what? | question word at the end: yes or no? | hsk1 |
| 当 | (onom.) dong | when; to act as | hsk2 |
| 刺 | (onom.) whoosh | thorn; to prick | hsk4, lesson hsk4_gate_21 |
| 底 | (equivalent to 的 as possessive particle) | bottom; end (of a month or year) | hsk4, lesson hsk4_gate_04 |
| 获 | (literary) to catch; to capture | to win; to get; (literary) to catch; to capture | hsk4, lesson hsk4_gate_22 |

🟪 **Rev 4** Stage 8b adds: pinyin 吗 má → ma, 底 de → dǐ, 刺 cī → cì in every copy; 回 and 兵 take their existing overrides; stories rebuilt so four HSK2 tap meanings follow. Beyond those, every other English meaning in `data/` stays byte-for-byte the same. The worker checks this with a diff of all `en` values before and after: only these five words may differ.

**Stage 9 — checks.**
- `npm run verify` passes.
- `grep -nE "#C0392B|#FF7070|#F8E6A8|#9FF5D1|rgba\(212,160,23" index.html` inside lines 8–751 hits only the token blocks.
- 🟦 **Rev 1** Kid-screen grep: the script has no `Phase 1:`/`Phase 2:`/`Phase 3:`, `pts base`, `Mix:`, `Memory match`, `Work in Progress` or `'❌ '`.
- 🟧 **Rev 3** Gloss check: a small read-only script compares every `en` in `data/` with `main`. Only 吗, 当, 刺, 底 and 获 differ, and each shows its new meaning in every copy.
- 🟩 **Rev 2** Browser checks, in the built-in browser:
  - A scratchpad Python helper serves the repo on `127.0.0.1` and strips the two Firebase script lines from `index.html` on the way out. Local state only; the real database is never reached.
  - Screens: hub, games, listen, quiz, time-up, flash cards, drill, daily challenge, My Day, parent weekly and daily, result screens.
  - Sizes 1194×834 and 834×1194; themes Crimson, Spring and Autumn.
  - A page script measures every visible button: none under 52 px. In portrait, the Dynasty Road shows without scrolling, and the road labels don't overlap.
  - Screenshots are saved to `docs/screenshots/design-2026-09/`.

## Success criteria (observable)
- Spring and Autumn show no crimson-tinted borders or glows. Main buttons are gold; only Clear all, Take and Remove pick are red.
- No tappable control under 52 px on the checked screens; no text under 12 px in the style block.
- Portrait home shows the chip, then the Dynasty Road, games, then sidebar cards. Pop-ups go up to 720 px. The time-up title stays on one line.
- No kid screen shows "Phase", "pts", "MCQ", "Mix:", "Memory", "Work in Progress", or ❌ next to a right answer.
- Parent screen: the report comes first under the tabs; every setting still saves; the password prompt still comes first.
- 🟧 **Rev 3** 吗, 当, 刺, 底 and 获 show their new meanings in every copy; every other English meaning is unchanged; a rebuild keeps all of this.
- 🟪 **Rev 4** 吗, 底 and 刺 show ma, dǐ, cì everywhere (typing "di" for 底 is accepted); 回 and 兵 show their repaired meanings; story taps on 吗 and 当 show the new meanings; nothing else in `data/` changes.
- `npm run verify` 344/344. The PR is open and ready for review, with the regression table, gloss list and screenshot links.

## Technical details
- 🟩 **Rev 2** Runs on this computer: `D:\User\Heng Z\Documents\GitHub\Chinese-Learning`, new branch `claude/design-fix-one-pr` from `main` 91d2601. Node 24.15, Python 3.14, no installs.
- 🟩 **Rev 2** Handoff: `D:\User\Heng Z\Downloads\chinese-adventure-handoff.zip`. It contains `tokens.css`, `patch.css`, `DESIGN.md`, `PLAN.md`, `PROMPT.md`, `mockups/` and two screenshot folders. It's unzipped into the session scratchpad, never into the repo.
- 🟩 **Rev 2** Worker instructions for every hand-over: `C:\Users\Heng Z\.cache\hz-rules\3.1.21\agents\opus-worker-instructions.md` (present).
- After approval, this file is copied to `plans/2026-09-30-plan-v5-design-fix-one-pr.md` and committed with the work.

Completion: see WORKING_RECORD.md deliverable ledger · Open: FEATURES.md + setup, tokens + docs, colours, sizes + stamp, layout, kids' wording, parent order, English meanings, checks + screenshots, review + PR, your merge, close-out
