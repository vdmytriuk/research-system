---
name: decide
description: Record a decision — on an idea (advance, park, kill), on a domain (focus, promote, drop, pause, continue, close) or on a screening (open, none) — in the decision log and on the page. The only way docs/decision-log.md is edited.
argument-hint: 'I-### advance|park|kill "<reason>" | D-### focus|promote|drop|pause|continue|close [<n> | "<text>"] "<reason>" | B-### open <n>|none "<reason>"'
disable-model-invocation: true
---

Arguments: $ARGUMENTS.

The only way `docs/decision-log.md` is edited. A decision without a one-sentence reason
is not recorded: if the reason is missing, ask for it with AskUserQuestion.

## Idea: `I-### advance|park|kill "<reason>"`
1. Append to `docs/decision-log.md` (newest last):
   ```
   ## <yyyy-mm-dd> · I-### · <advance|park|kill>
   - Хто: <owner>
   - Рішення: <decision> — <reason, the user's words>
   - Стадія до/після: <from> → <to>
   - На основі: [[R-###]] (звіт), бал <total>/5, критик: <top objection, one line>
   - Що б змінило рішення: <copy from the report>
   - Переглянути: <date or condition, for park>
   ```
   Without a report: `На основі: звіту немає — рішення редактора; докази: [[B-###]]`
   and `Що б змінило рішення: визначить дослідження`.
2. Update the idea card: `decision:`, `decided:`, `stage:` (advance → `validation`;
   park → `parked`; kill → `killed`), `checkpoint: null`, `updated:`, a `## Лог` line.
3. Run `node scripts/lint.mjs --fix` and `node scripts/index.mjs`, then commit
   `decide(I-###): <decision>` (the card, the log and `wiki/index.md` together).
   `git push`. Confirm in one line; no
   commentary on the decision.

## Domain
- `D-### focus "<sub-areas>" "<reason>"`: write «Фокус» (sub-areas, reason, date); add
  queue items for them under the matching layers (origin `редактор`); `phase: focus`,
  `checkpoint: null`.
- `D-### promote <n> "<reason>"`: allocate `node scripts/next-id.mjs I`; create
  `wiki/ideas/I-###-<slug>.md` from `templates/idea.md`: the hypothesis from the
  candidate row, «Звідки ідея» = candidate n of D-###, `domain: D-###`, `owner` = the
  domain's owner, `author` = the user, `stage: active`, kill criteria from the critic's
  objections to this candidate, `created`, `updated`. Set the candidate's state to
  `ідея I-###`. On the first promote: `phase: candidates`. `checkpoint: null`. Commit
  `idea(I-###): promoted from D-### candidate n`.
- `D-### drop <n> "<reason>"`: the candidate's state → `відхилено`; `checkpoint: null`.
- `D-### pause|continue "<reason>"`: `status: paused` / `status: active`.
- `D-### close "<reason>"`: `status: closed`, `checkpoint: null`.

Each domain action appends
```
## <yyyy-mm-dd> · D-### · <focus|promote|drop|pause|continue|close>
- Хто: <owner>
- Рішення: <action> — <reason, the user's words>
- На основі: [[R-###]] (звіт) або «звіту немає — рішення редактора»; критик: <top objection>
- Що б змінило рішення: <from the report or critique, or —>
```
then sets `updated:` and a `## Лог` line on the domain page, runs
`node scripts/lint.mjs --fix` and `node scripts/index.mjs`, commits
`decide(D-###): <action>` (the page, the log, `candidates:` and `wiki/index.md`
together), and does `git push`. Confirm in one line; after a promote add the next step in words
(the idea's quick check through `/explore I-###`).

## Screening: `B-### open <n> | none "<reason>"`
For a brief with `layer: screen` after its comparison (`playbooks/screen.md`, step 5).
1. Append to `docs/decision-log.md`:
   ```
   ## <yyyy-mm-dd> · B-### · <open|none>
   - Хто: <the editor>
   - Рішення: відкрити напрям «<candidate n>» — <reason, the editor's words> | жоден — <reason>
   - На основі: [[B-###]] (порівняння напрямів); найсильніший інший кандидат: <one line>
   - Що б змінило рішення: <from the brief's «Що змінило б рішення»>
   ```
2. Write «Рішення відбору» in the brief: date, the choice, the reason, and for `open` the
   D-ID it creates. Commit `decide(B-###): <open n | none>`.
3. `open` → follow «New domain» of `playbooks/explore.md` for the candidate's title. Its
   «Чому цей напрям» is the reason with a link to [[B-###]]; ask only the questions the
   screening did not answer; seed layer 1 from the topics the screening wrote.
