# Chinese Adventure — Design rules

> Source of truth: the Chinese Adventure design system (claude.ai artifact). Copied here in PR 1. Tokens CSS: see the end of this file.

学中文 大冒险 — Sisters' Journey Through History. A dark, lantern-lit learning app for Jenn and Jess: crimson night, gold lettering, jade for "done". Synced from `lxyzh1019-cyber/Chinese-Learning` at `main@e99689c` (30 Sep 2026). Version 3 adds the approved fixes and the screen-check decisions; tokens marked NEW or CHANGED are not in the code yet (PR 1).

## Content fundamentals

- Chinese is written the way a native adult speaks to a child (see the repo's `docs/chinese-style.md`). Never bend a sentence to fit a target character.
- A gloss is a plain English meaning, never a grammar code.
- UI copy is short English; titles pair Chinese and English (`学中文 大冒险 · Chinese Adventure`).
- Chinese text in the UI stays exactly where it is: never removed, moved or reworded by a design change.
- Players: 🐥 Jenn (`jenn`) and 🦊 Jess (`jess`).

## Colour rules

- **Only tokens.** Every colour comes from a `var(--token)`. No hex, no `rgba(212,160,23,x)`. Seasons (`applySeasonTheme()`: Spring Mar–May, Autumn Sep–Nov, Crimson the rest) swap the token values; a literal never changes. This is ARCHITECT.md's own rule.
- **Every season sets every colour it needs.** Spring and autumn now also set `jade`, `jenn`, `jess`, `warn`, `wrong-text` and the `gold-a*` alphas. `gold-bright`, `red`, `py-cream` and `py-mint` were tested and pass in every season, so each keeps one value.
- **Ground:** `bg` → `surface` → `surface2` → `panel`. Text on `bg`/`surface`: `ink` or `muted`. Text on `surface2`/`panel`: `ink` only.
- **Gold:** `gold` for titles, stars, active node, back button. See-through gold: `gold-a10` wash, `gold-a20` border/glow, `gold-a35` strong border. `gold-dim` stays for hairlines.
- **States:** correct = `jade` + ✓. Wrong = `wrong-text` (text and border) on `wrong-dim` + ✗. Warning = `warn`. A state is never shown by colour alone.
- **Kid colours** (`jenn` pink, `jess` blue) mark only that girl's name or avatar, always next to 🐥/🦊 or her name. Never a button colour, never a state. Red is for errors only.
- **Buttons:** main action = gold (`.btn-g`: `gold-bright`→`gold` gradient, text `bg`). Other actions = `.btn-s` (`surface2`, `ink`, `gold-a20` border). Red only for destroying or taking away: Clear all progress uses `.btn-danger` (`red-deep`→`red`, white text); Take stars and Remove pick keep their red tint (`.btn-s` with `wrong-dim` fill and `red` border). The old red `.btn-p` becomes gold.
- **Pinyin:** `py-cream` on prompts and story taps, `py-mint` in lists, tone table and answer reveal.
- **Known exception:** spring `gold` on `panel` is 4.26:1, so gold text on panel only at 24px or larger.

## Words on kids' screens

- **Wrong answer:** say what is right, never put ✗ next to the right answer. Wording: `Not quite — it is <answer>`. The right option turns `jade` with ✓.
- **Quiz progress:** `Question 2 of 7`, never phase codes, points or bonus formulas. Keep the Chinese label (`选汉字`, `汉字认读`, `拼音练习`, `句子排列`).
- **Quiz result:** stars + `19 of 20 right`. Titles: `Cleared! 🎉` · `Quiz passed! ★★★` (quiz done, games still open) · `Almost there!` · `Practice round`. Next steps sit in a gold card, never a red one. Points and phase scores go to the parent report.
- **Game names:** Listen, Trace, Match, Rain — the same word everywhere (not "Memory").
- **Practice list:** `Practice list · 复习本` (was "Work in Progress").
- **English meanings (glosses):** plain words a child reads, per `docs/chinese-style.md` — no "(after a suppositional clause)", "(onom.)", "(adverb of degree)".

## Type rules

- `dec` (Ma Shan Zheng) for display titles, `zh` (Noto Serif SC) for all Chinese, `ui` (Quicksand) for everything else.
- The app sets `html{font-size:120%}`, so 1rem = 19.2px. Sizes here are px at that root.
- Use the six-step Scale: `t-xs` .65rem · `t-sm` .72rem · `t-md` .82rem · `t-lg` 1.05rem · `t-xl` 1.75rem · `t-xxl` 3rem. Floor 12px: nothing under .65rem (12 rules today go down to .46rem).
- Heaviest weight is 700. Quicksand only comes in 300–700, so `font-weight:800` (30 rules) already renders as 700; change them to 700.

## Layout rules

- **Spacing:** `space-1`…`space-6` = .2 / .4 / .6 / .8 / 1 / 1.4rem (the most-used values). Replace the in-between values (.35, .45, .55, .65rem …) with the nearest step.
- **Radius:** `radius-sm` 8px · `radius-md` 12px · `radius-lg` 20px · `radius-pill`; `50%` for circles. Replaces the 20 values in use.
- **Tap size:** every button and choice at least 52px tall on iPad.
- **Breakpoints:** keep the app's own 600px and 520px; iPad (834–1194px) is the main target.
- **Portrait home (≤900px):** profile chip on top, then the Dynasty Road and games (the main task), then the sidebar cards below, full width. Landscape keeps the sidebar on the left.
- **Pop-up boxes** (games, flash cards, drill, daily challenge, quick quiz): up to 720px wide, never a 460px box on a 1194px screen.
- **Kids' screens:** the main task sits above the fold; no adult rules, formulas or raw counts; no code names; the answer is shown once; a finished round never looks like failure; choices look tappable; the big title only on the start screen; save status is one icon.
- **Parent screens:** the report first, then star controls, then Settings (mascot, goals, audio, webhook), then Clear all progress; reading before admin; tabs by job; destructive actions apart, in `red`; a one-line explanation under each button; no kid colours on buttons.
- **CSS hygiene:** one rule per selector. Merge the duplicates: `.cu.known .py`, `#sum-grid`, `.wrong-grid`, `.pinyin-lesson-card`, `.culture-story-row.animated-row`.
- **Version stamp:** The version stamp on the profile-select screen is updated by hand in any PR that changes the app.

## Contrast after the fixes (WCAG 4.5:1)

`ink`, `gold-bright`, `jade`, `jenn`, `jess`, `warn`, `wrong-text`, `py-cream` and `py-mint` pass on all four surfaces in all three seasons. `gold` passes everywhere except spring `panel` (4.26:1, see above). `muted` passes on `bg`/`surface` in spring and autumn; in Crimson it passes on `bg` only, so use `ink` there.

## Not synced

- Fonts are hosted by Google Fonts (Ma Shan Zheng; Noto Serif SC 300–700; Quicksand 500 & 700), so no font files are copied.
- No logos or icon files in the repo (the app uses emoji); no component library, so no components were built.
- Spacing, radius and the type Scale are new: the code has no such variables yet.
- Colours left as literals on purpose (data, not UI): per-dynasty road colours in the curriculum, `SENT_COLORS`, confetti colours. `#7A1010` and `#8B0000` (button and progress gradients) become the NEW `red-deep` token in PR 1.

## Colour tokens

| Token | Crimson | Spring | Autumn | Use |
|---|---|---|---|---|
| `bg` | `#1a0505` | `#102214` | `#241307` | Page background (body). Only 2 direct uses. |
| `deep` | `#0f0303` | `#0a160d` | `#170b04` | Deepest layer: scrollbar track, inset wells. |
| `surface` | `#380c0c` | `#1a3522` | `#3a1e0a` | Cards, back button, sidebars. |
| `surface2` | `#4a1212` | `#21462d` | `#4a2a10` | Raised surface: answer options, toast. Text here: ink, never muted. |
| `panel` | `#5c1818` | `#285836` | `#5b3415` | Word chips. Text here: ink, never muted. |
| `hover` | `#6e1e1e` | `#2e6942` | `#6d431d` | Hover fill. Defined but unused today — PR 1 uses it on :hover rules instead of literal rgba. |
| `gold` | `#d4a017` | `#d6b84b` | `#e0a93a` | Main accent: titles, stars, active node, back-button text. For see-through gold use gold-a10/a20/a35, never rgba(212,160,23,x). Spring gold on panel is 4.26:1: gold text on panel only at 24px or larger. |
| `gold-dim` | `rgba(212,160,23,.22)` | `rgba(214,184,75,.22)` | `rgba(224,169,58,.24)` | Gold hairline borders. |
| `gold-bright` | `#f0c040` | `= Crimson` | `= Crimson` | Highlight gold (wall clock). Tested in all seasons (4.8:1 or better on every surface), so one value. |
| `red` | `#c0392b` | `= Crimson` | `= Crimson` | Destructive only: Clear all progress, Take stars, Remove pick (with white text, 5.4:1). Never a main button, never text. Main buttons are gold (.btn-g). PR 1 replaces the 10 literal #C0392B with var(--red). Same in all seasons. |
| `red-glow` | `rgba(160,30,30,.55)` | `= Crimson` | `= Crimson` | Glow on player cards. 1 use. |
| `ink` | `#f0e4cf` | `#e9f2de` | `#f5e6ce` | Body text on every surface (10:1 or better). |
| `muted` | `#a07860` | `#8fad91` | `#be9367` | Secondary text on bg and surface only. On surface2 / panel use ink (muted fails 4.5:1 there). |
| `jade` | `#27ae60` | `#6ee7a0` | `#4ade80` | Correct / completed / done. Always with ✓. CHANGED: spring and autumn now have their own value (was Crimson's everywhere; failed on spring panel 2.9:1). Passes 4.5:1 on every surface. |
| `jade-dim` | `rgba(39,174,96,.15)` | `= Crimson` | `= Crimson` | Correct-answer fill. |
| `jenn` | `#ff6b9d` | `#f9a8d4` | `#ff8fb8` | Jenn's colour (🐥). CHANGED from #e8445a, which was 1.4:1 from the error reds and read as 'wrong'. Pink, not red. Only for her name/avatar, always next to 🐥 or 'Jenn'; never on buttons, never for a state. Passes 4.5:1 on every surface. |
| `jess` | `#60a5fa` | `#93c5fd` | `#7fb6ff` | Jess's colour (🦊). CHANGED from #3b82f6 (failed on raised surfaces). Only for her name/avatar, always next to 🦊 or 'Jess'; never on buttons, never for a state. Passes 4.5:1 on every surface. |
| `warn` | `#ff6b35` | `#ffb080` | `#ff8a5b` | Countdown warning, parent 'stars removed' message. CHANGED: seasonal values so it passes 4.5:1 on every surface. |
| `wrong-text` | `#ff7070` | `#ffadad` | `#ff8d8d` | NEW. Wrong-answer text and wrong-answer border (replaces literal #FF7070 ×9 and the #C0392B borders). Always with ✗ or a word. Passes 4.5:1 on every surface. |
| `wrong-dim` | `rgba(192,57,43,.14)` | `= Crimson` | `= Crimson` | NEW. Wrong-answer fill (was literal rgba(192,57,43,.14)). |
| `py-cream` | `#f8e6a8` | `= Crimson` | `= Crimson` | NEW. Pinyin on quiz prompts and story taps (was literal #F8E6A8). 6.6:1 or better everywhere. |
| `py-mint` | `#9ff5d1` | `= Crimson` | `= Crimson` | NEW. Pinyin in practice lists, tone table, answer reveal (was literal #9FF5D1). 6.4:1 or better everywhere. |
| `gold-a10` | `rgba(212,160,23,.10)` | `rgba(214,184,75,.10)` | `rgba(224,169,58,.10)` | NEW. Faint gold wash (replaces literal rgba(212,160,23,.07–.14)). |
| `gold-a20` | `rgba(212,160,23,.20)` | `rgba(214,184,75,.20)` | `rgba(224,169,58,.20)` | NEW. Gold border / glow (replaces .18–.28). |
| `gold-a35` | `rgba(212,160,23,.35)` | `rgba(214,184,75,.35)` | `rgba(224,169,58,.35)` | NEW. Strong gold border / focus (replaces .35–.6). |
| `red-deep` | `#7a1010` | `= Crimson` | `= Crimson` | NEW. Dark end of the destructive-button gradient (was literal #7A1010) and progress-bar start (was #8B0000). Fill only, never text. |

## Type styles

| Style | Family | Size (px at 19.2px root) | Weight | Use |
|---|---|---|---|---|
| `app-title` | dec | 76.8px | 400 | .app-title — clamp(2.8rem,6vw,4rem); max shown (html root is 120% = 19.2px). |
| `hub-title` | dec | 33.6px | 400 | .hub-title — 1.75rem. |
| `q-prompt` | zh | 57.6px | 400 | .q-prompt — 3rem, quiz character. |
| `hz` | zh | 33.6px | 400 | .hz — 1.75rem, story character. |
| `card-zh` | zh | 20.16px | 700 | .card-zh — 1.05rem. |
| `q-prompt-py` | ui | 22.08px | 700 | .q-prompt-py — 1.15rem, colour hard-coded #F8E6A8. RULE: 700 (Quicksand's heaviest). |
| `py` | ui | 20.74px | 700 | .py — 1.08rem, pinyin under a character. RULE: 700 (Quicksand's heaviest). |
| `dd-desc` | ui | 15.74px | 500 | .dd-desc — .82rem, reading text (no weight set; Quicksand's lightest loaded weight is 500). |
| `back-btn` | ui | 15.74px | 700 | .back-btn — .82rem. |
| `small` | ui | 13.82px | 700 | .72rem — the most used size (46 rules). |
| `box-title` | ui | 12.48px | 700 | .practice-box-title — raise .58rem → .65rem (12px floor). |
| `dr-num` | ui | 12.48px | 700 | .dr-num — raise .46rem → .65rem, colour muted (was white at 30%). |
| `t-xs` | ui | 12.48px | 700 | .65rem — the floor. Nothing smaller. |
| `t-sm` | ui | 13.82px | 700 | .72rem — labels, counts. |
| `t-md` | ui | 15.74px | 500 | .82rem — reading text, buttons. |
| `t-lg` | ui | 20.16px | 700 | 1.05rem — card titles, pinyin. |
| `t-xl` | ui | 33.6px | 400 | 1.75rem — screen titles, story characters. |
| `t-xxl` | ui | 57.6px | 400 | 3rem — quiz character. |

## Spacing and radius

| Token | Value | Use |
|---|---|---|
| `space-1` | 3.84px | .2rem — icon gaps. |
| `space-2` | 7.68px | .4rem — gaps inside rows (replaces .35/.45rem). |
| `space-3` | 11.52px | .6rem — padding in chips and small cards (replaces .55/.65rem). |
| `space-4` | 15.36px | .8rem — card padding. |
| `space-5` | 19.2px | 1rem — section gaps. |
| `space-6` | 26.88px | 1.4rem — screen padding, big gaps. |
| `radius-sm` | 8px | Chips, small tags (replaces 6/7/9px). |
| `radius-md` | 12px | Buttons, cards, options (replaces 10/11/13/14px). |
| `radius-lg` | 20px | Overlays, big cards (replaces 16/18/22/24px). |
| `radius-pill` | 999px | Pills, season tag. |

## Tokens CSS

```css
/* Chinese Adventure tokens — generated from the design system (v3). Paste over the :root block (index.html lines 9-19)
   and the two body.season-* lines (576-577). Values in px assume html{font-size:120%}: use the rem noted. */
:root{
  --bg:#1a0505;
  --deep:#0f0303;
  --surface:#380c0c;
  --surface2:#4a1212;
  --panel:#5c1818;
  --hover:#6e1e1e;
  --gold:#d4a017;
  --gold-dim:rgba(212,160,23,.22);
  --gold-bright:#f0c040;
  --red:#c0392b;
  --red-glow:rgba(160,30,30,.55);
  --ink:#f0e4cf;
  --muted:#a07860;
  --jade:#27ae60;
  --jade-dim:rgba(39,174,96,.15);
  --jenn:#ff6b9d;
  --jess:#60a5fa;
  --warn:#ff6b35;
  --wrong-text:#ff7070;
  --wrong-dim:rgba(192,57,43,.14);
  --py-cream:#f8e6a8;
  --py-mint:#9ff5d1;
  --gold-a10:rgba(212,160,23,.10);
  --gold-a20:rgba(212,160,23,.20);
  --gold-a35:rgba(212,160,23,.35);
  --red-deep:#7a1010;
  --fzh:'Noto Serif SC',serif;
  --fui:'Quicksand',sans-serif;
  --fdec:'Ma Shan Zheng',cursive;
  --space-1:.2rem;
  --space-2:.4rem;
  --space-3:.6rem;
  --space-4:.8rem;
  --space-5:1rem;
  --space-6:1.4rem;
  --radius-sm:8px;
  --radius-md:12px;
  --radius-lg:20px;
  --radius-pill:999px;
  --t-xs:.65rem;
  --t-sm:.72rem;
  --t-md:.82rem;
  --t-lg:1.05rem;
  --t-xl:1.75rem;
  --t-xxl:3rem;
  --tap-min:52px;
}
body.season-spring{
  --bg:#102214;
  --deep:#0a160d;
  --surface:#1a3522;
  --surface2:#21462d;
  --panel:#285836;
  --hover:#2e6942;
  --gold:#d6b84b;
  --gold-dim:rgba(214,184,75,.22);
  --ink:#e9f2de;
  --muted:#8fad91;
  --jade:#6ee7a0;
  --jenn:#f9a8d4;
  --jess:#93c5fd;
  --warn:#ffb080;
  --wrong-text:#ffadad;
  --gold-a10:rgba(214,184,75,.10);
  --gold-a20:rgba(214,184,75,.20);
  --gold-a35:rgba(214,184,75,.35);
}
body.season-autumn{
  --bg:#241307;
  --deep:#170b04;
  --surface:#3a1e0a;
  --surface2:#4a2a10;
  --panel:#5b3415;
  --hover:#6d431d;
  --gold:#e0a93a;
  --gold-dim:rgba(224,169,58,.24);
  --ink:#f5e6ce;
  --muted:#be9367;
  --jade:#4ade80;
  --jenn:#ff8fb8;
  --jess:#7fb6ff;
  --warn:#ff8a5b;
  --wrong-text:#ff8d8d;
  --gold-a10:rgba(224,169,58,.10);
  --gold-a20:rgba(224,169,58,.20);
  --gold-a35:rgba(224,169,58,.35);
}
```
