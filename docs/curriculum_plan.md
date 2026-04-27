# HSK 300x4 + Culture Story Implementation Spec

## 1) Schema contracts

### HSK level files
- Path: `data/hsk1.json`, `data/hsk2.json`, `data/hsk3.json`, `data/hsk4.json`
- Contract: `schemas/hsk-level.schema.json`
- Key fields:
  - `level`, `sourceStandard`, `totalWords`, `totalGates`
  - `gateDistribution` (22 entries summing to 300)
  - `words[]` (normalized vocabulary entries)
  - `gates[]` with `newWords[]`, `reviewWords[]`, reward payload

### Culture story file
- Path: `data/culture_stories.json`
- Contract: `schemas/culture-stories.schema.json`
- Key fields:
  - `trackId`, `totalStories`, `stories[]`
  - Story rewards include family reward types

## 2) Gate allocation template and review cadence

- 22 gates per HSK level.
- Distribution fixed to sum 300:
  - `[13,13,13,13,13,13,13,13,14,14,14,14,14,14,14,14,14,14,14,14,14,14]`
- Review cadence:
  - each gate includes up to last 24 prior words as review set
  - sentence target ramps: 2 -> 3 -> 4 by gate bands

## 3) HSK1 word pool prep (300 words)

- Source: HSK 3.0 `new-1` list from source repository.
- Selection logic:
  - frequency-first ranking
  - kid-friendly POS preference (`n`, `v`, `a`, `r`, etc.)
  - lower penalties for long/idiomatic/symbolic forms
- Output: `data/hsk1.json` with 300 words and 22 gates.

## 4) HSK2 borrow rules (103 words from HSK3)

- Base HSK2 count: 197 words.
- Borrow count from HSK3: exactly 103.
- Metadata requirement:
  - `sourceTag: "HSK3_borrowed_for_HSK2"`
- Exclusion rule:
  - borrowed entries must not duplicate already-selected HSK1/HSK2 words.
- Validation:
  - exactly 300 HSK2 words
  - exactly 103 with borrow source tag

## 5) Culture story branch design and reward hooks

- Track is independent from gate progression:
  - `trackId: "culture-story-branch"`
  - includes 24 solar terms and key festivals.
- Reward hooks:
  - stars
  - mystery-box token
  - family reward card: `ask_parents_help`, `movie_night`, `game_night`
- Branch can grant rewards consumable in main progression.

## 6) Fun features phased backlog with dependencies

Ranked feature priorities (from prior decision):
1. Daily adventure mission
2. Revenge rounds for weak words
3. Micro-rewards
4. Boss variety
5. Celebration pacing
6. Pet companion
7. Mystery box rewards
8. Friendly rivalry + co-op
9. Branching-lite stories
10. Voice imitation

### Phase 1 backlog
- Mission system v1 (depends on normalized gate metadata)
- Revenge round v1 (depends on failed-word tracking)
- Micro-reward triggers (depends on event bus or central score hooks)
- Culture branch scaffold + reward grants
- HSK1 loading from `hsk1.json`

### Phase 2 backlog
- HSK2 loading from `hsk2.json` with borrow labels
- Boss mode rotation
- Mystery box family cards surfaced in UI
- Expanded celebration pacing events

### Phase 3 backlog
- HSK3/HSK4 file integration
- Pet progression loop
- Rivalry/co-op weekly loop
- Branching-lite culture stories
- Voice imitation mode

## 7) Build and regeneration

- Script: `scripts/build_hsk_curriculum.js`
- Regenerates:
  - `data/hsk1.json`
  - `data/hsk2.json`
  - `data/hsk3.json`
  - `data/hsk4.json`
  - `data/curriculum_report.json`

Run:
`node scripts/build_hsk_curriculum.js`
