// Run: node scripts/tests/status.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWiki, run, day, stamp, domain, idea, brief, evidence, source } from "./helpers.mjs";

const status = (...entries) => run("status.mjs", makeWiki(...entries));
const waiting = (...entries) => run("status.mjs", makeWiki(...entries), ["--waiting"]);

test("an empty wiki reports nothing waiting and nothing running", () => {
  const { out, code } = status();
  assert.equal(code, 0, out);
  assert.match(out, /## Waiting on you\nnothing is waiting/);
  assert.match(out, /## Running\nnothing is running/);
  assert.match(out, /## Domains\nnone/);
});

test("lists the stops and gates that wait on the user", () => {
  const { out } = waiting(
    brief("B-001"),
    brief("B-002", { status: "running", run_stage: "checked", run_started: stamp(30), domain: "D-001", layer: "demand" }),
    brief("B-003", { status: "collected", run_finished: `${day(-1)}T10:00` }),
    domain("D-001", { checkpoint: "ready", phase: "map" }),
    idea("I-001", { checkpoint: "ready" }),
  );
  assert.match(out, /gate 1: B-001 \[draft\]/);
  assert.match(out, /stop after collection: B-002 \(D-001\) collected and verified → \/review B-002/);
  assert.match(out, /gate 2: B-003 collected \d{4}-\d{2}-\d{2} → \/review B-003/);
  assert.match(out, /phase stop: D-001 \(map\) → \/review D-001/);
  assert.match(out, /gate 3: I-001 → \/review I-001/);
  assert.doesNotMatch(out, /## Running/);
});

test("shows a running brief with elapsed time and progress", () => {
  const body = "\n## Підпитання\n### 1. A\n### 2. B\n";
  const { out } = status(
    brief("B-001", { status: "running", run_stage: "verify", run_started: stamp(12) }, body),
    source(), evidence("E-B001-1-01", { brief: "B-001", verification: "ok" }),
  );
  assert.match(out, /B-001 \[verify\] 1[1-3] min · evidence 1\/2 sq · verified 1\/2 sq/);
});

test("flags a brief that has been running for over three hours", () => {
  const { out } = status(brief("B-001", { status: "running", run_stage: "scouts", run_started: stamp(200) }));
  assert.match(out, /possibly interrupted: \/research B-001/);
});

test("shows the domain line with phase, week, confidence, queue and checkpoint", () => {
  const body = "\n### 1. Основи\n- **Черга питань:**\n  1. [ ] a\n  2. [ ] b\n  3. [x] done\n";
  const { out } = status(domain("D-001", {
    title: "Local LLM", phase: "intro", created: day(-10), target: day(60), checkpoint: "running",
    confidence: { fundamentals: "medium", demand: null, models: null, signals: null, entry: null },
  }, body));
  assert.match(out, /D-001 Local LLM \[active\] phase intro · week 2 of 10 · fundamentals: medium · demand: — · models: — · signals: — · entry: — · queue 2 · briefs 0 · checkpoint running/);
  assert.match(out, /D-001 phase stop running \(writer primer\)/);
});

test("the queue count skips template placeholders", () => {
  const body = "\n### 1. Основи\n- **Черга питань:**\n  1. [ ] …\n  2. [ ] real question\n  3. [ ] … _(походження: редактор | критик | digest B-###)_\n";
  const { out } = status(domain("D-001", { phase: "intro" }, body));
  assert.match(out, /D-001 .* · queue 1 · /);
});

test("shows briefs with their next step in words", () => {
  const { out } = status(brief("B-001", { status: "approved" }), brief("B-002", { status: "collected", reviewed: day(0) }));
  assert.match(out, /B-001 \[approved\] .* → next: start or resume: \/research B-001/);
  assert.match(out, /B-002 \[collected\] .* → next: reviewed/);
});

test("prints the first open questions", () => {
  const { out } = waiting(["wiki/open-questions.md", "# Open\n\n- [ ] D-001: who pays?\n- [x] closed\n"]);
  assert.match(out, /questions \(1\):\n- \[ \] D-001: who pays\?/);
});

test("a reviewed screening waits for the editor's decision", () => {
  const screen = { layer: "screen", status: "collected", reviewed: day(0) };
  const open = status(brief("B-001", screen, "\n## Рішення відбору\n_(заповнює /decide B-### open <n> | none)_\n"));
  assert.match(open.out, /screening decision: B-001 compared, which direction to open → \/review B-001/);
  assert.match(open.out, /B-001 \[collected\] .* → next: screening decision: \/review B-001/);
  const done = status(brief("B-001", screen, "\n## Рішення відбору\n2026-10-09 — відкрити напрям 2\n"));
  assert.doesNotMatch(done.out, /screening decision/);
  assert.match(done.out, /→ next: decided/);
});
