# Plan v6 — review fixes — closed 2026-10-10

Source: hz-reviewer full audit of `main` f57bd11 (2026-10-10) plus a student play test of gates 1–3.
One PR, branch `claude/review-fixes-v6`. Built and checked in claude.ai chat; delivered as a full package.

## Approved (user: "all as your suggestion", "all yes")
- B1 sync: a refused save is merged and retried once; tests S02 #175 and #177 changed to match.
- B2 hub refresh: the hub redraws when the games or flash-card pop-up closes (user report: pop-up four 3★, hub two).
- S4 one sync icon on the hub profile chip.
- F1 the active gate's panel shows when the hub opens. F2 Read is gold until the story is read.
- L1 star rules move into the closed rules section; timer line says "longer for later gates".
- L2 Hard Boss can earn the "no hints" badge. L3 "1 day", not "1 days". L4 exact percent decides stars. L5 "Perfect" only with no miss.
- S1 pinyin intro opens from the Pinyin Chart. S2 6 duplicate functions removed. S3 6 uncalled functions removed.
- F3 one quiz exit. F4 option A: empty practice list shows a hint, button stays open. F5 parent goals save on change. F7 kid wording on the assessment home.
- S5 phone strip fits. S6 road labels in full. S7 52 px tabs, 44 px checkbox. S9 "大冒险" on one line. S12 wider tone chart on iPad.
- D1 hanzi-writer pinned to 3.7.3. Version stamp v2026-10-10.
- Round 3 (2026-10-10): L7 — a read counts, and pays its stars, only when its story quiz is finished; closing the quiz opens nothing.
- Round 2 (2026-10-10): F8 option B — the Dynasty Trace button opens after the first story read, like Listen; flash cards stay available but lock nothing. L6 — the Rain hint says "Read twice + play Listen 👂". Test "one qualifying read unlocks Listen and Trace" changed to match.

## Not in this PR
- G1 Firebase console rules (user checks). F6 parent settings are per device (waiting on device count). G2 PIN kept. R1 tap-to-show pinyin kept.
- F7 second line: the assessment band note lives in the frozen bank manifest, kept.

## Done when
`npm run verify` 344/344 · layout check with no CLIP/TAP on iPad sizes · hub = pop-up after every game in a 3-gate play test · first save of a session lands in the fake-Firestore run · coverage gate passes.
