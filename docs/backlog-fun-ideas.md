# Backlog: ideas not yet applied (especially fun)

This document lists features and “fun” concepts that are **not fully implemented** in the current app, or exist only in **data/schema** without gameplay wiring. Use it to prioritize Phase 3+ work.

---

## A. Curriculum / content (partially done)

| Idea | Status in repo | What would complete it |
|------|----------------|-------------------------|
| **Mystery box from gates** | `mysteryBoxChance` on each gate in `data/hsk*.json` | **Done in app:** roll on gate clear, `mysteryPicksPending`, hub + overlay. |
| **Mystery tokens from culture** | `mysteryBoxToken` in `data/culture_stories.json` | **Done in app:** `applyCultureReward` adds pending picks. |
| **`badgeFragments` in culture rewards** | Present in JSON | **Not used:** no collection UI, no crafting, no badges from fragments. Either remove from data or add a “fragments → badge” loop. |
| **HSK3 / HSK4 per-gate lessons** | `data/lessons/hsk3_gate_*.json`, `hsk4_gate_*.json` + `lessonRefForGate` | **Done:** `scripts/generate_hsk_gate_lessons.js 3|4`; app loads `hsk3_gate_XX` / `hsk4_gate_XX`. |
| **Champion-only mystery rolls** | Optional | Currently champion clear can also grant a box roll when trophy improves; could be tuned or shown separately in UI. |

---

## B. Culture branch depth

| Idea | Current behavior | Enhancement |
|------|------------------|-------------|
| **Full culture reader** | Read overlay + `readerParagraphs` / `readerComprehension` in JSON | **Done (lite):** paragraphs + questions; collect stars from list. Per-line audio = future. |
| **Solar term / festival animations** | Static cards | Simple illustrations or Lottie-style cards per story. |
| **Culture streak / track progress** | Per-track bar + read checkmarks in overlay | **Done (v1).** Date-locked next story = future. |

---

## C. Mascot / “pet” (beyond current bubble)

| Idea | Current behavior | Enhancement |
|------|------------------|-------------|
| **Sidebar text bubble** | After Gate 5 + caps + parent off + not in quiz | Baseline shipped. |
| **Named character + avatar art** | Hub mascot ring + idle bounce + emoji face | **Done (v1):** CSS + 🐼 after Gate 5. |
| **Dress-up / accessories** | “Change look” cycles hat/bow on mascot | **Done (v1):** cosmetic only, stored in `mascotCosmetic`. |
| **Mascot reactions to wrong answers** | Suppressed during quiz | Optional gentle reaction after quiz exit only (respect limits). |
| **Voice lines for mascot** | None | Short pre-recorded clips or strict TTS with parent mute (adds scope). |

---

## D. Mystery box extensions (fun + family)

| Idea | Notes |
|------|--------|
| **Weighted tables per HSK level** | **Done (v1):** mystery star/family thresholds scale with `curHSK` when opening a box. |
| **“Double or nothing” kid-safe variant** | Second tap for +50% stars with small chance of “try again tomorrow” (needs careful UX). |
| **Physical reward pairing** | QR or “show parent” sheet export for family prizes (privacy). |
| **Box from daily mission only** | Gates do not roll; mission completion grants 1 pick (simpler economy). |

---

## E. Social / family engagement

| Idea | Current behavior | Enhancement |
|------|------------------|-------------|
| **Week stars rivalry strip** | Jenn vs Jess + co-op bar | **Done:** `week_star_lead` badge when current player leads by week stars (both ≥12). |
| **Sibling co-op mini-game** | None | Short 2-player pass-and-play quiz on one device. |
| **Parent dashboard push** | Firestore sync exists | Email/webhook summaries (external infra). |

---

## F. Gameplay variety (suggested fun ideas from earlier brainstorms)

Shipped items below are marked **Done**; the rest are still optional backlog:

1. **Sticker book / collection album** — **Done (v1):** hub button + 6 stickers (gates 1/5/10, culture reads, first story).
2. **Seasonal hub skin** — autumn/spring palette swap by calendar (cosmetic only).
3. **Soundboard of praise phrases** — **Done (v1):** cheer toasts in hub rules panel (no audio assets).
4. **“Boss rematch” variants** — **Done (v1):** “Hard boss” = more MCQ/PY, hints allowed for bonus. Timed mode = future.
5. **Word of the week** — larger spotlight character with etymology (partially overlaps char-origin card).
6. **Treasure map meta-progress** — cosmetic path across eras unrelated to strict gate order.
7. **Rivalry “challenge send”** — one kid sends 3 words to the other’s practice queue (needs moderation).
8. **Co-op family timer** — shared weekly minutes goal (parallel to star co-op).
9. **AR / camera flashcards** — out of scope for single HTML file; mobile wrapper later.
10. **Leaderboard vs friends outside household** — needs accounts and moderation; not in scope.

---

## G. Parent / safety / audio (from earlier spec)

| Idea | Status |
|------|--------|
| **Parent toggle: disable mascot** | Implemented (Parent Summary). |
| **Parent toggle: “opt-in quiz audio” or stricter TTS** | Not a separate setting; quiz still has speak buttons. Could add global “sound lessons only when parent unlocks.” |
| **Stricter session caps on toasts** | Partially (micro-reward throttle); could unify all non-critical toasts. |

---

## H. Tech / maintainability (not “fun” but unblocks fun)

- Split `index.html` into modules + build step (easier to add games without a 6k-line file).
- Automated E2E smoke (Playwright) for gate clear, mystery open, culture collect.
- Schema validation in CI for `culture_stories` + `hsk*` including optional fields (`badgeFragments`).

---

## Suggested priority for “maximum fun per effort”

1. HSK3/HSK4 lesson content + reader polish for culture (content depth).
2. Sticker book or gate milestone cosmetics (reuses stars/mystery economy).
3. Named mascot art + one idle animation (emotional attachment).
4. Fragment system OR remove `badgeFragments` from data until designed.

Last updated: HSK3/4 lessons, culture reader + track progress, sticker book, mascot idle + cosmetics, mystery weights by HSK, weekly rivalry badge, hard boss + soundboard.
