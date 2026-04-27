# Backlog: ideas not yet applied (especially fun)

This document lists features and “fun” concepts that are **not fully implemented** in the current app, or exist only in **data/schema** without gameplay wiring. Use it to prioritize Phase 3+ work.

---

## A. Curriculum / content (partially done)

| Idea | Status in repo | What would complete it |
|------|----------------|-------------------------|
| **Mystery box from gates** | `mysteryBoxChance` on each gate in `data/hsk*.json` | **Done in app:** roll on gate clear, `mysteryPicksPending`, hub + overlay. |
| **Mystery tokens from culture** | `mysteryBoxToken` in `data/culture_stories.json` | **Done in app:** `applyCultureReward` adds pending picks. |
| **`badgeFragments` in culture rewards** | Present in JSON | **Not used:** no collection UI, no crafting, no badges from fragments. Either remove from data or add a “fragments → badge” loop. |
| **HSK3 / HSK4 per-gate lessons** | Vocab/gates in JSON; no `data/lessons/hsk3_gate_*.json` or `hsk4_gate_*.json` | Generate 22+22 lesson files (same template as HSK1/2) and ensure `lessonRef` on gates if not defaulting. |
| **Champion-only mystery rolls** | Optional | Currently champion clear can also grant a box roll when trophy improves; could be tuned or shown separately in UI. |

---

## B. Culture branch depth

| Idea | Current behavior | Enhancement |
|------|------------------|-------------|
| **Full culture reader** | List of stories + “Collect” for stars | Inline reader with paragraphs, audio per line, mini-quiz like dynasty stories. |
| **Solar term / festival animations** | Static cards | Simple illustrations or Lottie-style cards per story. |
| **Culture streak / track progress** | None | Progress bar per track (24 terms, festivals), unlock next by order or by date. |

---

## C. Mascot / “pet” (beyond current bubble)

| Idea | Current behavior | Enhancement |
|------|------------------|-------------|
| **Sidebar text bubble** | After Gate 5 + caps + parent off + not in quiz | Baseline shipped. |
| **Named character + avatar art** | Emoji / text only | Small illustrated mascot with idle animation in hub. |
| **Dress-up / accessories** | None | Unlock hats or frames from gates, streaks, or mystery box. |
| **Mascot reactions to wrong answers** | Suppressed during quiz | Optional gentle reaction after quiz exit only (respect limits). |
| **Voice lines for mascot** | None | Short pre-recorded clips or strict TTS with parent mute (adds scope). |

---

## D. Mystery box extensions (fun + family)

| Idea | Notes |
|------|--------|
| **Weighted tables per HSK level** | Different star/family weights for HSK2–4. |
| **“Double or nothing” kid-safe variant** | Second tap for +50% stars with small chance of “try again tomorrow” (needs careful UX). |
| **Physical reward pairing** | QR or “show parent” sheet export for family prizes (privacy). |
| **Box from daily mission only** | Gates do not roll; mission completion grants 1 pick (simpler economy). |

---

## E. Social / family engagement

| Idea | Current behavior | Enhancement |
|------|------------------|-------------|
| **Week stars rivalry strip** | Jenn vs Jess + co-op bar | Optional: weekly “winner” badge, non-toxic copy. |
| **Sibling co-op mini-game** | None | Short 2-player pass-and-play quiz on one device. |
| **Parent dashboard push** | Firestore sync exists | Email/webhook summaries (external infra). |

---

## F. Gameplay variety (suggested fun ideas from earlier brainstorms)

These are **not** dedicated systems in the app today unless noted:

1. **Sticker book / collection album** — collect stickers per gate or per story; view in hub.
2. **Seasonal hub skin** — autumn/spring palette swap by calendar (cosmetic only).
3. **Soundboard of praise phrases** — tap for encouragement (parent volume / mute).
4. **“Boss rematch” variants** — timed MCQ, or “hard mode” fewer hints (separate from current boss).
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

Last updated with the hub rules panel, Gate 5 mascot unlock, and playable mystery box implementation.
