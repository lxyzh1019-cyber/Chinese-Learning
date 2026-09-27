# Repository rules

The working rules for this repository come from `hz-claude-config`: `.claude/hz-loader.py` fetches them at session start and the session-start hook injects them. They are not copied into this repository — do not add copies, and do not edit `.claude/settings.json`, `.claude/hz-loader.py` or `.claude/agents/opus-worker.md` here; changes to them go through `hz-claude-config`.

If the "Global Working Rules" are not in your context at session start, stop before any work and tell me: "Central rules not loaded in this session."

Repository-specific files: `FEATURES.md` and `WORKING_RECORD.md`.

## Repository Architecture

This repo carries its architecture in `ARCHITECT.md` at the root — the Chinese
Adventure blueprint (Part A: design and engineering rules; Part B: §11–§29, the
full architecture: gate identity, player state, curriculum, games, quiz, review
and retention, persistence and sync, tooling). These working rules say *how* to
work; `ARCHITECT.md` says *what the app is*.

Read the sections covering the area you are about to touch before proposing a
plan for this app's code, state schema, curriculum or sync, and update it in the
same change whenever a change makes it wrong. It is a governance document: the
main session may edit it directly.
