---
name: screen
description: Screening before a domain — compare 3–7 candidate directions in one brief (layer screen), score them on the same criteria, and let the editor choose which one to open as D-###. Use when the question is "what should we research" rather than a named direction.
argument-hint: '"<question or list of candidate directions>"'
disable-model-invocation: true
---

Argument: $ARGUMENTS — the editor's question ("які напрями нам пасують") or a list of candidates.

The system starts from a named domain; screening is the step before it, for the editor
who has several directions and must pick one to open. It compares; it does not produce
candidate ideas (rule 6 still holds) and it does not choose (the editor does). Common
rules: AGENTS.md. The run itself is the ordinary chain of `playbooks/research.md`.

1. **Context.** Read `docs/context.md`. Show the editor in ≤ 5 lines whom it describes
   (organisation, assets, hard constraints) and its `updated:` date; ask with
   AskUserQuestion: актуальний / оновити. On «оновити», update it with the editor from
   `templates/context.md`, set `updated:`, commit `docs(context): <what>`, then go on.
2. **Candidates.** Read the active domains (do not re-screen what is already open), the
   topic pages and `docs/context.md` «Напрями, що вже звучали» and «Активи». Propose 3–7
   candidate directions: the ones that already sounded plus the ones adjacent to the
   assets; drop those the constraints exclude and say why. Ask the editor to confirm,
   remove or add (AskUserQuestion, multiSelect), and at most two questions about scope
   (geography, horizon).
3. **Brief.** Allocate `node scripts/next-id.mjs B` and write the brief from
   `templates/brief-screen.md`: `layer: screen`, `domain: null`, `idea: null`; one
   sub-question per candidate, all of the same shape (who pays for what and how much; who
   already sells; what stops a new player; which of our assets it rests on), with IN, OUT
   and sources; «Звідки кандидати»; budget one scout per candidate.
4. **Run.** Gate 1 and the run follow steps 3–8 of `playbooks/research.md` unchanged.
5. **Comparison and decision** — on «далі» at gate 2 (research step 9 sends you here).
   Fill «Порівняння напрямів» in the brief by `docs/rubric.md`, section «Відбір
   напрямів»: per candidate and criterion a mark (слабко / середньо / сильно / не
   досліджували) with evidence IDs, and an overall mark. Commit
   `screen(B-###): comparison`. Show the table in ≤ 12 lines with your view in the text
   (which one and why, what would change it), then ask: відкрити <candidate> (one option
   per candidate) / ще раунд / жоден. Never mark an option as recommended.
   - відкрити <n> → `/decide B-### open <n> "<reason>"` (it records the decision and
     opens the domain).
   - ще раунд → add sub-questions by step 6 of research («додати підпитання»); the
     comparison is redone after the next gate 2.
   - жоден → `/decide B-### none "<reason>"`.
   Until a decision is recorded, `node scripts/status.mjs` lists the brief under
   "Waiting on you" and `/review B-###` reopens this step.
