// Run: node scripts/tests/lint.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeWiki, run, day, stamp, domain, idea, brief, evidence, source, topic, report, critique, analysis } from "./helpers.mjs";

const lint = (...entries) => run("lint.mjs", makeWiki(...entries));
const errors = out => out.split("\n").filter(l => l.startsWith("ERROR"));
const warnings = out => out.split("\n").filter(l => l.startsWith("WARNING"));
const hasError = (out, text) => errors(out).some(l => l.includes(text));
const hasWarning = (out, text) => warnings(out).some(l => l.includes(text));

test("an empty wiki passes", () => {
  const { out, code } = lint();
  assert.match(out, /lint: 0 error\(s\), 0 warning\(s\), 0 page\(s\)/);
  assert.equal(code, 0);
});

// --- domains ----------------------------------------------------------------

test("accepts a valid active domain", () => {
  const { out, code } = lint(domain("D-001"));
  assert.deepEqual(errors(out), []);
  assert.equal(code, 0);
});

test("rejects an unknown phase", () => {
  const { out } = lint(domain("D-001", { phase: "depth" }));
  assert.ok(hasError(out, 'invalid phase "depth"'), out);
});

test("rejects a domain missing a layer in confidence", () => {
  const { out } = lint(domain("D-001", { confidence: { fundamentals: null, demand: null, models: null, signals: null } }));
  assert.ok(hasError(out, "confidence missing entry"), out);
});

test("rejects an active domain without owner", () => {
  const { out } = lint(domain("D-001", { owner: "" }));
  assert.ok(hasError(out, "active domain without owner"), out);
});

test("rejects a domain whose file name does not start with its id", () => {
  const [, text] = domain("D-001");
  const { out } = lint(["wiki/domains/local-llm.md", text]);
  assert.ok(hasError(out, "file name must start with D-001-"), out);
});

// --- ideas ------------------------------------------------------------------

test("accepts an idea under an existing domain", () => {
  const { out, code } = lint(domain("D-001"), idea("I-001", { domain: "D-001" }));
  assert.deepEqual(errors(out), []);
  assert.equal(code, 0);
});

test("rejects an unknown idea stage", () => {
  const { out } = lint(idea("I-001", { stage: "screening" }));
  assert.ok(hasError(out, 'invalid stage "screening"'), out);
});

test("rejects an idea pointing at a missing domain", () => {
  const { out } = lint(idea("I-001", { domain: "D-009" }));
  assert.ok(hasError(out, "unknown domain D-009"), out);
});

// --- briefs -----------------------------------------------------------------

test("accepts a running domain brief with a layer", () => {
  const { out, code } = lint(domain("D-001"), brief("B-001", {
    domain: "D-001", layer: "fundamentals", status: "running", run_stage: "verify", run_started: stamp(10),
  }));
  assert.deepEqual(errors(out), []);
  assert.equal(code, 0);
});

test("rejects a domain layer on an idea brief", () => {
  const { out } = lint(idea("I-001"), brief("B-001", { idea: "I-001", layer: "fundamentals" }));
  assert.ok(hasError(out, 'invalid layer "fundamentals" for an idea brief'), out);
});

test("rejects the retired run stages", () => {
  const { out } = lint(brief("B-001", { status: "running", run_stage: "librarian" }));
  assert.ok(hasError(out, 'invalid run_stage "librarian"'), out);
});

test("rejects a running brief without run_stage", () => {
  const { out } = lint(brief("B-001", { status: "running" }));
  assert.ok(hasError(out, "running brief without run_stage"), out);
});

test("rejects an approved brief without author", () => {
  const { out } = lint(brief("B-001", { status: "approved", author: "" }));
  assert.ok(hasError(out, "brief past gate 1 without author"), out);
});

test("warns when a collected brief has waited a week for gate 2", () => {
  const { out } = lint(brief("B-001", { status: "collected", run_finished: `${day(-8)}T10:00` }));
  assert.ok(hasWarning(out, "awaiting gate 2 for 7+ days"), out);
});

test("does not warn about gate 2 once reviewed or while under a week", () => {
  assert.ok(!hasWarning(lint(brief("B-001", { status: "collected", run_finished: `${day(-8)}T10:00`, reviewed: day(-7) })).out, "awaiting gate 2"));
  assert.ok(!hasWarning(lint(brief("B-001", { status: "collected", run_finished: `${day(-2)}T10:00` })).out, "awaiting gate 2"));
});

// --- evidence ---------------------------------------------------------------

test("accepts evidence that names only its brief", () => {
  const { out, code } = lint(brief("B-001"), source(), evidence("E-B001-1-01", { brief: "B-001" }));
  assert.deepEqual(errors(out), []);
  assert.equal(code, 0);
});

test("rejects evidence with neither brief nor domain nor idea", () => {
  const { out } = lint(source(), evidence("E-ING-20261006-01"));
  assert.ok(hasError(out, "evidence without brief, domain or idea"), out);
});

test("rejects an evidence id outside the three patterns", () => {
  const { out } = lint(brief("B-001"), source(), evidence("E-B001-R-01", { brief: "B-001" }));
  assert.ok(hasError(out, 'invalid evidence id "E-B001-R-01"'), out);
});

test("accepts critic evidence on a domain", () => {
  const { out, code } = lint(domain("D-001"), source(), evidence("E-D001-C-01", { domain: "D-001" }));
  assert.deepEqual(errors(out), []);
  assert.equal(code, 0);
});

// --- reports and the critique rule -------------------------------------------

test("a primer needs no critique", () => {
  const { out, code } = lint(domain("D-001"), report("R-001", "D-001", "primer"));
  assert.deepEqual(errors(out), []);
  assert.equal(code, 0);
});

test("a domain report without a critique is an error", () => {
  const { out } = lint(domain("D-001"), report("R-001", "D-001", "domain"));
  assert.ok(hasError(out, "no critique for D-001"), out);
});

test("a domain report whose critique is older than the newest reviewed brief is an error", () => {
  const { out } = lint(
    domain("D-001"),
    brief("B-001", { domain: "D-001", layer: "demand", status: "collected", reviewed: day(0) }),
    critique("D-001", { created: day(-2), updated: day(-2) }),
    report("R-001", "D-001", "domain"),
  );
  assert.ok(hasError(out, "older than the newest reviewed brief"), out);
});

test("a domain report with a fresh critique passes", () => {
  const { out, code } = lint(
    domain("D-001"),
    brief("B-001", { domain: "D-001", layer: "demand", status: "collected", reviewed: day(-1) }),
    critique("D-001"),
    report("R-001", "D-001", "domain"),
  );
  assert.deepEqual(errors(out), []);
  assert.equal(code, 0);
});

test("a final report whose critique is older than the analysis is an error", () => {
  const { out } = lint(
    idea("I-001"),
    analysis("I-001", { updated: day(0) }),
    critique("I-001", { created: day(-1), updated: day(-1) }),
    report("R-001", "I-001", "final"),
  );
  assert.ok(hasError(out, "older than the analysis"), out);
});

test("rejects an unknown report type and a report on a missing target", () => {
  const { out } = lint(domain("D-001"), report("R-001", "D-001", "screen"), report("R-002", "I-009", "primer"));
  assert.ok(hasError(out, 'invalid type "screen"'), out);
  assert.ok(hasError(out, "unknown target I-009"), out);
});

// --- ids and links ------------------------------------------------------------

test("rejects duplicate ids and broken links", () => {
  const { out } = lint(domain("D-001"), ["wiki/domains/D-001-y.md", domain("D-001")[1]], topic("T-x", { domains: ["D-007"] }));
  assert.ok(hasError(out, "duplicate id D-001"), out);
  assert.ok(hasError(out, "broken link [[D-007]]"), out);
});

// --- fix --------------------------------------------------------------------

test("--fix fills the derived lists on a domain and an idea", () => {
  const root = makeWiki(
    domain("D-001"), idea("I-001", { domain: "D-001" }),
    brief("B-001", { domain: "D-001", layer: "demand" }), brief("B-002", { idea: "I-001", layer: "economics" }),
    report("R-001", "D-001", "primer"),
  );
  const { out, code } = run("lint.mjs", root, ["--fix"]);
  assert.equal(code, 0, out);
  const d = readFileSync(join(root, "wiki/domains/D-001-x.md"), "utf8");
  assert.match(d, /^briefs: \[B-001\]$/m);
  assert.match(d, /^candidates: \[I-001\]$/m);
  assert.match(d, /^reports: \[R-001\]$/m);
  assert.match(readFileSync(join(root, "wiki/ideas/I-001-x.md"), "utf8"), /^briefs: \[B-002\]$/m);
  assert.match(out, /FIXED {3}wiki\/domains\/D-001-x.md: briefs/);
});

test("--fix adds the missing contradicts back-link and marks stale topics", () => {
  const root = makeWiki(
    brief("B-001"), source(),
    evidence("E-B001-1-01", { brief: "B-001", contradicts: ["E-B001-1-02"] }),
    evidence("E-B001-1-02", { brief: "B-001" }),
    topic("T-old", { updated: day(-61) }),
  );
  const { out } = run("lint.mjs", root, ["--fix"]);
  assert.match(readFileSync(join(root, "wiki/evidence/E-B001-1-02.md"), "utf8"), /^contradicts: \[E-B001-1-01\]$/m);
  assert.match(readFileSync(join(root, "wiki/topics/T-old.md"), "utf8"), /^status: stale$/m);
  assert.ok(!hasWarning(out, "does not link back"), out);
});

test("without --fix the missing back-link is only a warning", () => {
  const { out, code } = lint(
    brief("B-001"), source(),
    evidence("E-B001-1-01", { brief: "B-001", contradicts: ["E-B001-1-02"] }),
    evidence("E-B001-1-02", { brief: "B-001" }),
  );
  assert.ok(hasWarning(out, "does not link back"), out);
  assert.equal(code, 0);
});

// --- fix round 1 ---------------------------------------------------------------

test("--fix never touches body lines that look like frontmatter keys", () => {
  const root = makeWiki(
    brief("B-001"), source(),
    evidence("E-B001-1-01", { brief: "B-001", contradicts: ["E-B001-1-02"] }),
  );
  const rel = "wiki/evidence/E-B001-1-02.md";
  const [, text] = evidence("E-B001-1-02", { brief: "B-001" });
  const fmEnd = text.indexOf("\n---", 3);
  const body = text.slice(0, fmEnd).replace(/^contradicts:.*\n?/m, "") + text.slice(fmEnd) + "contradicts: original body line\n";
  writeFileSync(join(root, rel), body);
  run("lint.mjs", root, ["--fix"]);
  const out = readFileSync(join(root, rel), "utf8");
  assert.match(out, /\ncontradicts: original body line\n/);
  const head = out.slice(0, out.indexOf("\n---", 3));
  assert.match(head, /^contradicts: \[E-B001-1-01\]$/m);
});

test("--fix keeps a trailing comment on a rewritten line", () => {
  const root = makeWiki(domain("D-001"), brief("B-001", { domain: "D-001", layer: "demand" }));
  const p = join(root, "wiki/domains/D-001-x.md");
  writeFileSync(p, readFileSync(p, "utf8").replace("briefs: []", "briefs: []            # веде scripts/lint.mjs --fix"));
  run("lint.mjs", root, ["--fix"]);
  assert.match(readFileSync(p, "utf8"), /^briefs: \[B-001\] +# веде scripts\/lint\.mjs --fix$/m);
});

test("an unreadable critique date is an error", () => {
  const { out } = lint(domain("D-001"), critique("D-001", { updated: "yesterday" }), report("R-001", "D-001", "domain"));
  assert.ok(hasError(out, 'unreadable date on wiki/critique/D-001-critique.md: updated "yesterday"'), out);
});

test("a final report must target an idea and a domain report a domain", () => {
  const { out } = lint(domain("D-001"), critique("D-001"), report("R-001", "D-001", "final"));
  assert.ok(hasError(out, 'report type "final" does not match target D-001'), out);
});

test("--fix puts every back-link on a page two others contradict", () => {
  const root = makeWiki(
    brief("B-001"), source(),
    evidence("E-B001-1-01", { brief: "B-001", contradicts: ["E-B001-1-03"] }),
    evidence("E-B001-1-02", { brief: "B-001", contradicts: ["E-B001-1-03"] }),
    evidence("E-B001-1-03", { brief: "B-001" }),
  );
  run("lint.mjs", root, ["--fix"]);
  assert.match(readFileSync(join(root, "wiki/evidence/E-B001-1-03.md"), "utf8"), /^contradicts: \[E-B001-1-01, E-B001-1-02\]$/m);
});

// --- screening ------------------------------------------------------------------

test("accepts a screening brief without domain or idea, rejects one under a domain", () => {
  assert.deepEqual(errors(lint(brief("B-001", { layer: "screen" })).out), []);
  const { out } = lint(domain("D-001"), brief("B-001", { domain: "D-001", layer: "screen" }));
  assert.ok(hasError(out, 'layer "screen" is only for a brief without domain or idea'), out);
});

test("warns about a reviewed screening until its decision is recorded", () => {
  const reviewed = { layer: "screen", status: "collected", reviewed: day(0) };
  const open = lint(brief("B-001", reviewed, "\n## Рішення відбору\n_(заповнює /decide B-### open <n> | none)_\n"));
  assert.ok(hasWarning(open.out, "screening reviewed without a decision: /decide B-001"), open.out);
  const done = lint(brief("B-001", reviewed, "\n## Рішення відбору\n2026-10-09 — відкрити напрям 2 як D-001\n"));
  assert.ok(!hasWarning(done.out, "screening reviewed"), done.out);
});

// --- critic corrections -----------------------------------------------------------

test("warns when an inexact verdict on a collected brief is not applied", () => {
  const { out } = lint(brief("B-001", { status: "collected" }), source(),
    evidence("E-B001-1-01", { brief: "B-001", verified: day(0), verification: "inexact" }));
  assert.ok(hasWarning(out, "verdict inexact not applied"), out);
});

test("an applied correction silences the warning until a newer verdict arrives", () => {
  const applied = lint(brief("B-001", { status: "collected" }), source(),
    evidence("E-B001-1-01", { brief: "B-001", verified: day(-1), verification: "inexact", corrected: day(0) }));
  assert.ok(!hasWarning(applied.out, "not applied"), applied.out);
  const stale = lint(brief("B-001", { status: "collected" }), source(),
    evidence("E-B001-1-01", { brief: "B-001", verified: day(0), verification: "failed", corrected: day(-2) }));
  assert.ok(hasWarning(stale.out, "is newer than the correction"), stale.out);
});

test("does not ask for corrections while the brief is still running", () => {
  const { out } = lint(brief("B-001", { status: "running", run_stage: "verify" }), source(),
    evidence("E-B001-1-01", { brief: "B-001", verified: day(0), verification: "inexact" }));
  assert.ok(!hasWarning(out, "not applied"), out);
});

// --- re-verify after a contradiction ----------------------------------------------

test("asks to re-verify a page that a newer brief contradicts", () => {
  const { out } = lint(brief("B-001"), brief("B-002"), source(),
    evidence("E-B001-2-01", { brief: "B-001", verified: day(-1), verification: "ok" }),
    evidence("E-B002-4-24", { brief: "B-002", created: day(0), contradicts: ["E-B001-2-01"] }));
  assert.ok(hasWarning(out, "E-B001-2-01.md: verified"), out);
  assert.ok(hasWarning(out, "re-verify (critic verify E-B001-2-01)"), out);
});

test("no re-verify within one brief or once the verdict names the contradicting page", () => {
  const same = lint(brief("B-001"), source(),
    evidence("E-B001-1-01", { brief: "B-001", verified: day(0), verification: "ok" }),
    evidence("E-B001-1-02", { brief: "B-001", created: day(0), contradicts: ["E-B001-1-01"] }));
  assert.ok(!hasWarning(same.out, "re-verify"), same.out);
  const [rel, text] = evidence("E-B001-2-01", { brief: "B-001", verified: day(0), verification: "inexact" });
  const done = lint(brief("B-001"), brief("B-002"), source(),
    [rel, text + "\n## Верифікація\n2026-10-09 — inexact: перевірено після E-B002-4-24.\n"],
    evidence("E-B002-4-24", { brief: "B-002", created: day(0), contradicts: ["E-B001-2-01"] }));
  assert.ok(!hasWarning(done.out, "re-verify"), done.out);
});

// --- docs/context.md --------------------------------------------------------------

test("asks to confirm docs/context.md when it has no date or is stale", () => {
  const ctx = fm => ["docs/context.md", `---\n${fm}\n---\n# Наш контекст\n`];
  assert.ok(hasWarning(lint(["docs/context.md", "# Наш контекст\n"]).out, "docs/context.md: no `updated:` date"));
  assert.ok(hasWarning(lint(ctx(`updated: ${day(-91)}`)).out, "not confirmed for 90+ days"));
  assert.ok(!hasWarning(lint(ctx(`updated: ${day(-5)}`)).out, "docs/context.md"));
});

test("a contradicting id mentioned only in the notes does not count as a re-verify", () => {
  const [rel, text] = evidence("E-B001-2-01", { brief: "B-001", verified: day(-1), verification: "ok" });
  const { out } = lint(brief("B-001"), brief("B-002"), source(),
    [rel, text + "\n## Нотатки\nСуперечить E-B002-4-24.\n"],
    evidence("E-B002-4-24", { brief: "B-002", created: day(0), contradicts: ["E-B001-2-01"] }));
  assert.ok(hasWarning(out, "re-verify (critic verify E-B001-2-01)"), out);
});
