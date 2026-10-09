---
name: checkpoint
description: The critic-then-writer chain for a domain phase stop or an idea synthesis. Not a command — the lead follows it after the editor's "yes" to a proposed stop, or on words like "синтез", "зроби звіт", "атакуй карту".
---

Target: a domain ID or an idea ID. Entered after the user's "yes" to a proposed phase
stop, or on words like "синтез", "зроби звіт", "атакуй карту", "атакуй ідею".
Precondition: the target has at least one brief with `reviewed` (for an idea: of the
idea or of its domain); otherwise say what is missing and stop. Common rules: AGENTS.md. Report IDs: `node scripts/next-id.mjs R`.
Every spawn is in the background; before each one write `checkpoint: running` and a
log line; after each one tell the user in one sentence what started and end the turn.
A choice the editor makes at a stop is their decision: the lead follows the steps of
`playbooks/decide.md` with that action, asking for the one-sentence reason with
AskUserQuestion if it was not given. The editor never has to type the command.

## Domain in phase intro
1. `checkpoint: running`, log. Spawn `writer` with `primer D-### R-###`. Say what
   started (a primer of 2–4 pages from the verified pages, ≈ 5–10 minutes). End the turn.
2. Writer finished → `node scripts/lint.mjs --fix`, `node scripts/index.mjs`, commit
   `report(R-###): primer D-###`, `checkpoint: ready`, log.
3. Show the primer in ≤ 12 lines (how it works, scale, players, what changed, what we
   do not know). Ask: карта / змінити межі / закрити.
4. карта → `phase: map`, `checkpoint: null`, log, commit `domain(D-###): phase map`,
   `git push`. змінити межі → edit «Межі» with the user, log, `checkpoint: null`, and
   offer a follow-up brief if the change opens new ground. закрити → `/decide D-### close`.

## Domain in phase map
1. `checkpoint: running`, log. Spawn `critic` with `attack D-###`. Say what started
   (≈ 15–25 minutes). End the turn.
2. Critic finished (or the verify below finished) → if the critic wrote new
   `E-D###-C-*` pages (e.g. `E-D001-C-01`) and any of them has a digit in `claim` and
   `verification: null`, spawn `critic` with `verify <those IDs> <today>` in the
   background first, log it, and spawn the writer when that verify finishes (after
   applying its corrections as in step 7 of `playbooks/research.md`);
   otherwise spawn the writer at once. The writer gets `report D-### R-###`. One
   sentence to the user.
3. Writer finished → lint --fix, index, commit `report(R-###): domain D-###`,
   `checkpoint: ready`, log.
4. Show ≤ 12 lines: what we know per layer, where the money is, the critic's three
   strongest objections, the spot-check tally. Ask: фокус на … / ще раунд по шару … /
   змінити межі / закрити.
5. фокус → `/decide D-### focus "<sub-areas>" "<reason>"` (it writes «Фокус», the queue
   items and `phase: focus`), `checkpoint: null`. ще раунд → `checkpoint: null`, phase
   unchanged, continue at step 4 of `/explore D-###`. змінити межі / закрити → as in intro.

## Domain in phase focus or candidates
1. Write or update «Кандидати» on the domain page from the evidence of the map: each
   candidate as хто · проблема · як · за що платять, with ≥ 1 evidence ID about the
   problem and ≥ 1 about who pays; state `запропоновано`. If none can be grounded, write
   that in the log and tell the user; the stop still happens. Commit
   `domain(D-###): candidates`.
2. `checkpoint: running`, log. Spawn `critic` with `attack D-###` (it sees the
   candidates). Say what started. End the turn.
3. Critic finished (or the verify below finished) → if the critic wrote new
   `E-D###-C-*` pages and any of them has a digit in `claim` and
   `verification: null`, spawn `critic` with `verify <those IDs> <today>` in the
   background first, log it, and spawn the writer when that verify finishes;
   otherwise spawn the writer at once. The writer gets `report D-### R-###`. One
   sentence to the user.
4. Writer finished → lint --fix, index; copy the critic's objection per candidate into
   the «Заперечення критика» column; commit `report(R-###): domain D-###`,
   `checkpoint: ready`, log.
5. Show the candidates with objections in ≤ 12 lines. Ask: promote <n> / drop <n> /
   ще копати / закрити. promote / drop / закрити go through `/decide`; «ще копати» →
   phase unchanged, continue at step 4 of `/explore D-###` (nothing is recorded).
   Once every choice made at this stop has gone through `/decide` (or «ще копати» was
   chosen), set `checkpoint: null`, log, commit `domain(D-###): stop answered`.

## Idea (synthesis)
1. `checkpoint: running`, log. Spawn `writer` with `analysis I-###`. Say what started.
   End the turn.
2. Writer finished (analysis) → spawn `critic` with `attack I-###`.
3. Critic finished (or the verify below finished) → if the critic wrote new
   `E-I###-C-*` pages and any of them has a digit in `claim` and
   `verification: null`, spawn `critic` with `verify <those IDs> <today>` in the
   background first, log it, and spawn the writer when that verify finishes;
   otherwise spawn the writer at once. The writer gets `report I-### R-###`. One
   sentence to the user.
4. Writer finished (final report) → lint --fix, index, commit
   `report(R-###): final I-###`, `checkpoint: ready`, log.
5. **Gate 3.** Show the three-sentence answer, the confidence and what set it, the
   total score, the critic's top risk, the «План MVP» table in brief. Ask: advance /
   park / kill / ще досліджувати. advance, park, kill → `/decide I-### …` with the
   user's reason. ще досліджувати → `checkpoint: null`, nothing recorded, point to
   `/explore I-###`.

## Critique only
On "атакуй карту" / "атакуй ідею": `checkpoint: running`, log, spawn `critic` with
`attack <id>`; when it finishes, run the verify for its new C-pages if needed (as in
step 2 of the map chain); do not spawn the writer. Show the critic's return in the
chat; `checkpoint: null`; commit `critique(<id>): <date>`. No report is written.

If the writer refuses (precondition not met), show its one-line reason and stop with
`checkpoint: null`.
