---
name: review
description: Where the pipeline stands and what waits on the editor; with an ID, reopen the stop or gate that waits for that brief, domain or idea. Use when the user asks what waits, or to see or decide on finished work ("показуй B-004", "що чекає на мене").
argument-hint: '[B-### | D-### | I-###]'
---

Argument: $ARGUMENTS — nothing, or a brief, domain or idea ID.

Stops and gates are asked in the chat the moment a stage finishes; this playbook
reopens them later or lists what waits. Nothing moves past a gate without the user's
explicit answer. Everything shown is Ukrainian, in plain words; the stop format is in
AGENTS.md.

## No argument
1. Run `node scripts/status.mjs`. Present ≤ 20 lines in this order: **Чекає на вас** —
   every waiting item as a sentence saying what is there, not only its command; then
   the first 5 open questions. **Біжить** — stage and elapsed time. **Напрями** — phase,
   week, confidence per layer, queue. **Ідеї** by stage. **Brief'и** with the next step
   in words. Then one line of lint (`node scripts/lint.mjs | tail -1`); if it reports
   errors, list up to 10.
2. If nothing waits, say so and name what could run next (`/explore` of the active
   domain, or a new domain).

## B-###
- `status: draft` → gate 1: step 3 of `playbooks/research.md`.
- `run_stage: checked` → the stop after collection: step 6 of `playbooks/research.md`.
- `status: collected`, `reviewed` null, `run_stage` null → gate 2: steps 8–9 of research.
- `layer: screen`, `reviewed` set and «Рішення відбору» empty → the screening decision:
  step 5 of `playbooks/screen.md`.
- Already `reviewed` → say when, and ask whether to open it again.
- Any other state → say which (`node scripts/status.mjs`) and stop.

## D-###
- `checkpoint: ready` → the phase stop of `playbooks/checkpoint.md` for the current
  phase: its "show … and ask" step.
- Otherwise → the state of the domain in ≤ 15 lines (step 1 of `/explore D-###`) and
  what waits, if anything.

## I-###
- `checkpoint: ready` → gate 3: step 5 of the idea chain in `playbooks/checkpoint.md`.
- Otherwise → the state of the idea and what waits.

Finish with `git push` when a gate was passed in this call.
