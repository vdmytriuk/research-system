---
name: explore
description: The long track of a domain or an idea. A new domain — questions about motive and boundaries, the domain page, the intro brief and gate 1. An existing domain or idea — where it stands, what runs, what waits, the next briefs to approve, phase stops. Also plain-word edits of the page.
argument-hint: '"<domain>" | D-### | I-###'
disable-model-invocation: true
---

Argument: $ARGUMENTS — a domain title in quotes, a domain ID, or an idea ID.

The user drives the domain and sets the agenda; you propose, they choose. Everything the
user reads is Ukrainian. Common rules: AGENTS.md. Candidates appear only at the stop
after the focus phase (rule 6).

## New domain (`/explore "<title>"`)
0. Read `docs/context.md` and show the editor in ≤ 5 lines whom it describes
   (organisation, assets, hard constraints) and its `updated:` date; ask: актуальний /
   оновити. The rubric's «відповідність активам» is scored against this file, so a
   domain never starts on a context nobody confirmed. On «оновити», update it with the
   editor from `templates/context.md`, set `updated:`, commit `docs(context): <what>`.
   Skip this step when the domain comes from a screening decision made today
   (`/decide B-### open`): the screening already confirmed the context.
1. Ask up to three questions with AskUserQuestion: why this domain (their words); what
   is in and out of scope (geography, time horizon, adjacent fields); a rough target
   date for reaching candidates (8, 12 or 16 weeks from today, or their own).
2. Allocate `node scripts/next-id.mjs D`; create `wiki/domains/D-###-<slug>.md` from
   `templates/domain.md`: «Чому цей напрям» in the user's words with the date, «Межі»,
   empty layers, the phase table with periods derived from the target date, the log.
   `phase: intro`, `owner` and `author` = the user, `created`, `updated`, `target`.
3. Grep `wiki/topics` for the domain's key terms; write what is already known into
   layer 1 «Що знаємо» with topic and evidence IDs, and add the domain to those topics'
   `domains:`.
4. Write the intro brief by steps 1–2 of `playbooks/research.md` with `domain: D-###`,
   `layer: fundamentals` and 4–6 sub-questions: how the industry works and its value
   chain (who pays whom); size and structure; segments and players; terms and
   technology; what changed in the last five years; where to read (the best primers,
   reports, data sources).
5. Gate 1 by step 3 of `playbooks/research.md`. After approval, commit
   `domain(D-###): created` and start the run (steps 4–9 of research).

## Existing domain (`/explore D-###`)
1. Run `node scripts/status.mjs`. Show ≤ 15 lines: phase and week, per layer the
   confidence and the queue length, what is running, what waits on the user.
2. If something of this domain waits on the user, say so first and open it by
   `playbooks/review.md`. The user may still line up more work.
3. If the phase stop is due — intro: the intro brief (`layer: fundamentals`) has
   `reviewed` and the domain has no `primer` report yet → propose the intro stop (the
   primer; the user's «карта» at that stop is the exit from the phase); map: every layer 2–5 has a reviewed brief or a logged «пропустити»; focus:
   the user said «досить» or the focus queues are empty — propose the phase stop in one
   sentence. On yes, follow `playbooks/checkpoint.md`.
4. Otherwise propose 1–3 next briefs by the phase rule: intro — none until the primer;
   map — one broad brief per layer 2–5 without a reviewed brief; focus — from the focus
   queues (segments, specific problems, who tried and what happened, costs, real
   prices); candidates — domain briefs are still allowed (new candidates may appear at a
   later stop); idea-level work goes through `/explore I-###`. For each: layer, the question, why now.
   Ask which to prepare (AskUserQuestion, multiSelect), or take the user's own question
   instead. Skip this step when the domain is `paused`.
5. For each chosen one, write the brief by steps 1–2 of research with `domain:` and
   `layer:`; its sub-questions come from the queue items. Gate 1 for all of them in one
   AskUserQuestion round (per brief: затвердити / змінити / відкласти). Approved
   briefs: `status: approved`, commit `brief(B-###): <slug>`, mark their queue items
   `→ B-###` on the domain page; start each by step 4 of research (at most two at once;
   the rest `queued`).
6. End the turn with the launch notice in plain words (what started, what it gives,
   roughly how long) and name anything that waits on the user.

## Idea (`/explore I-###`)
The same as an existing domain, with workstreams instead of layers and `idea:` on the
briefs. For an idea with no reviewed brief, the first proposal is the quick check
preset: three sub-questions — попит (who has the problem, how they solve it today,
evidence that they pay), конкуренти й альтернативи (direct, indirect, do nothing;
prices seen), здійсненність і відповідність (what it takes to build and launch,
regulation, fit with `docs/context.md`) — ≤ 8 searches and ≤ 6 sources each. Reuse the
domain's evidence through «Що вже є у wiki». Idea briefs carry `idea:` only (not
`domain:`), so they do not enter the domain's critique-freshness rule; the quick-check
preset uses `layer: null` (cross-cutting; lint's warning is expected) and gate 2 then
updates every workstream it touched. When the queues are empty or
`target_decision` is within two weeks, propose synthesis; on yes follow the idea chain
of `playbooks/checkpoint.md`.

## Edits in plain words
"додай питання …", "підніми … нагору", "пропусти шар …", "зміни дату", "пауза",
"продовжуємо": edit the page, add a `## Лог` line, set `updated:`, commit
`domain(D-###): <what>` or `idea(I-###): <what>`. No gate: it is the user's page.
"пауза" → `status: paused`; "продовжуємо" → `status: active`.
