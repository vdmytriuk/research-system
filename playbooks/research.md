---
name: research
description: One question from brief to reviewed evidence — write the brief, gate 1, then the background run with two stops (after collection and verification, after the digest). With a brief ID, resume an interrupted run or reopen its stop.
argument-hint: '"<question>" [D-### | I-###] | B-###'
disable-model-invocation: true
---

Argument: $ARGUMENTS — a question (optionally with a domain or idea ID), or a brief ID.

Common rules are in AGENTS.md (Agents and delegation, Stop format). The brief's
frontmatter is the state of the run: every transition updates `run_stage` and appends
one line to `## Журнал прогону` (`- <yyyy-mm-dd hh:mm> · <stage> · <what happened>`,
Ukrainian; time from `node scripts/now.mjs`). While a stage is going, never summarise
unverified findings.

## New question
0. If the question asks which direction to research ("що нам досліджувати", a list of
   directions to compare) rather than a question about a named one, follow
   `playbooks/screen.md` instead.
1. Read the domain or idea page (if given), the topic pages it names, and Grep
   `wiki/briefs`, `wiki/evidence`, `wiki/topics` for the key terms. Fill «Що вже є у
   wiki» with topic pages and evidence IDs to reuse. If the question is already
   answered there, say so and propose to reuse or extend instead.
2. If the question is ambiguous about scope, geography, horizon or the decision it
   serves, ask at most 3 clarifying questions with AskUserQuestion. Allocate
   `node scripts/next-id.mjs B` and write `wiki/briefs/B-###-<slug>.md` from
   `templates/brief.md`: the question in one sentence; «Навіщо»; «Що змінило б
   рішення» (2–4 facts); 3–7 independent sub-questions, each with IN, OUT (naming the
   sibling that covers it), sources to try first, expected evidence type, kill-capable
   ones first; budget; «Критерії успіху». Set `domain`, `idea`, `layer`, `author`,
   `status: draft`.
3. **Stop, gate 1.** Show the brief in ≤ 12 lines (question, what would change the
   decision, sub-question titles, budget). Ask: затвердити / змінити підпитання /
   звузити / стоп. On approval: `status: approved`, `approved: <today>`, commit
   `brief(B-###): <slug>`, and continue to step 4 in the same turn.
4. If two other briefs are in a chain (`run_stage` in scouts, verify, checked, digest),
   set `run_stage: queued`, tell the user which brief it waits for, and stop. Otherwise
   set `status: running`, `run_stage: scouts`, `run_started`, log. Spawn one `scout` per
   sub-question, all in this turn, all in the background; each task prompt follows the
   Delegation block of AGENTS.md and names the evidence prefix `E-B###-<sq>-` (the
   brief ID without its hyphen, e.g. `E-B004-2-`). Tell the user what started (brief,
   number of scouts, what each looks for, 5–15 minutes per scout plus verification)
   and that the next stop is after collection and verification. End the turn.
5. **A scout finished** → spawn `critic` with `verify B-### <sq> <today>` at once, in
   the background; do not wait for the other scouts. On the first verify set
   `run_stage: verify`, log. A scout that stopped without a report: resume it once with
   SendMessage, telling it to write pages from what it has already read and then
   report; if it still returns nothing, log it and spawn verify only if evidence pages
   exist. Between notifications say nothing unless asked; then answer from
   `node scripts/status.mjs` (stage, elapsed time, sub-questions covered).
6. **All scouts and all verifies finished → stop after collection.** First run
   `node scripts/lint.mjs`: when it asks to re-verify an older page that a page of
   this run contradicts («verified … before … contradicted it»), spawn `critic` with
   `verify <those IDs> <today>` in the background, log it, and end the turn; the stop
   waits for that verify (the old page may belong to another brief: its verdict is
   overwritten, the old line kept). Then set `run_stage: checked`, log. Report in ≤ 12
   lines: evidence per sub-question with grades; the verification tally and every
   failed or downgraded page with the reason; 2–3 headline findings in words; scouts
   that did not finish; what comes next (lint, index, digest, topics, ≈ 5–10 minutes).
   Ask: продовжити до digest / перезапустити скаута № / додати підпитання / стоп. End
   the turn and wait.
   - продовжити → step 7.
   - перезапустити / додати → write the sub-question(s) into the brief under
     `## Доповнюючі підпитання (<date>)`, get a one-word confirmation,
     `run_stage: scouts`, log, spawn those scouts; the chain returns to this stop. A
     restarted scout keeps its sub-question number and continues the numbering;
     supplementary sub-questions under `## Доповнюючі підпитання (<date>)` continue the
     numbering of the brief (`### 6.`, `### 7.` …) so `status.mjs` counts them.
   - стоп → leave `run_stage: checked`; `/review B-###` reopens it.
7. **Tail** — one brief at a time: if another brief is at `run_stage: digest`, wait
   for it to reach `collected`. Set `run_stage: digest`, log. Run
   `node scripts/lint.mjs --fix` and fix any error yourself; run
   `node scripts/index.mjs`. **Apply the critic's corrections** on every page of this
   brief, and every page re-verified in step 6, with `verification: inexact` or
   `failed` and no `corrected:` (lint lists them): set `claim` to the critic's
   «Коректне формулювання» (≤ 30 words), move the old claim into `## Нотатки` as
   «Початкове формулювання (до верифікації <date>): …», replace a «дослівна цитата
   недоступна» quote with the critic's «Дослівна цитата», set `corrected: <today>`.
   When the critic wrote «Коректне формулювання: —», leave the claim, keep
   `confidence: low` and write in `## Нотатки` «джерело не підтверджує; не
   використовувати». When a re-verified page changed, grep its `[[E-ID]]` under
   `wiki/topics/` and `wiki/domains/` and fix the sentences that cite it. Print the
   brief's evidence with `node scripts/digest-table.mjs B-### --sources` and write
   `## Digest` from that table, not by opening every page. Ukrainian: per sub-question
   3–5 key findings with evidence IDs and grades; the verification tally and every
   downgraded page; contradictions (pairs, what differs); gaps; scouts that did not
   finish; the scouts' leads for other scouts; budget used; and, for a brief with
   `layer: fundamentals`, a line «Джерела для конспекту: S-…» collecting the scouts'
   «Для конспекту» picks (the writer's primer reads them from there). Fold the new
   knowledge into `wiki/topics/`: update or create topic pages from
   `templates/topic.md` (claims with IDs and grades, contradictions, unknowns,
   `updated:`, the brief in `briefs:`, the domain in `domains:`); list them in the
   brief's «Що вже є у wiki». Set `status: collected`, `run_stage: null`,
   `run_finished`, log. Commit `run(B-###): <n> evidence, <m> sources, <k> topics`.
8. **Stop after the digest, gate 2** — right away, in this turn: the digest headline in
   ≤ 12 lines (key findings per sub-question with grades, verification tally and
   downgrades, contradictions, gaps). Ask: далі / копати глибше в підпитання № /
   додати підпитання / стоп. The user must see what was found without opening a file.
9. On далі: `reviewed: <today>`. A brief with neither `domain:` nor `idea:` has no
   layer to update: write `## Що далі` in the brief (which topics took the knowledge,
   what it feeds), run lint and index, commit `review(B-###): gate 2`; for
   `layer: screen` continue at step 5 of `playbooks/screen.md` (comparison and
   decision) instead of the rest of this step. Otherwise update the domain layer or
   idea workstream the brief belongs to: «Що знаємо» (claims with IDs), «Впевненість»
   with a one-sentence reason and the matching `confidence` key in the frontmatter,
   tick the queue items this brief answered, append new queue items from the digest's
   gaps and leads (origin `digest B-###`), add human-only items to «Потрібно від
   редактора», set `updated:`, add a `## Лог` line. Run `node scripts/lint.mjs --fix`
   and `node scripts/index.mjs`. Commit `review(B-###): gate 2`. `git push` (the
   permission prompt is the user's confirmation). If a brief has `run_stage: queued`,
   start the oldest from step 4 and say so. Then say in one sentence what comes next
   for the domain or idea. If this brief is the intro brief of a domain in
   `phase: intro`, propose the intro stop (primer) in the same turn; on yes follow
   `playbooks/checkpoint.md`.
   - копати глибше / додати підпитання → as in step 6; the chain runs for the new
     sub-questions only and `reviewed` goes back to `null`.
   - стоп → change nothing.

## Brief ID given
- `status: draft` → gate 1 (step 3).
- `status: approved`, `run_stage` null or `queued` → start from step 4.
- `run_stage: checked` → repeat the stop after collection (step 6).
- `status: collected`, `reviewed` null → repeat gate 2 (step 8).
- `layer: screen`, `reviewed` set, «Рішення відбору» empty → step 5 of `playbooks/screen.md`.
- `status: running`, any other stage → **resume**: for each sub-question check whether
  evidence pages `E-B###-<sq>-*` exist and whether their `verification:` is filled.
  Spawn scouts only for sub-questions without evidence and verifies only for
  sub-questions with unverified evidence, then continue from the matching step. Log
  "відновлено".
