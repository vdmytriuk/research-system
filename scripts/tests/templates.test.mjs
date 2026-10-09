// Run: node scripts/tests/templates.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../_lib.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "templates");
const REPORT = ["id", "target", "type", "author", "created", "confidence", "confidence_set_by", "briefs"];
const CRITIQUE = ["target", "author", "created", "updated", "spotcheck"];
const BRIEF = ["id", "question", "domain", "idea", "layer", "author", "status", "created", "approved", "run_stage", "run_started", "run_finished", "reviewed", "budget"];
const REQUIRED = {
  "domain.md": ["id", "title", "owner", "author", "status", "phase", "checkpoint", "created", "updated", "target", "confidence", "briefs", "candidates", "reports"],
  "idea.md": ["id", "title", "domain", "owner", "author", "stage", "decision", "checkpoint", "created", "updated", "decided", "target_decision", "confidence", "briefs", "reports", "scores", "total"],
  "brief.md": BRIEF,
  "brief-screen.md": BRIEF,
  "context.md": ["owner", "updated"],
  "evidence.md": ["id", "claim", "type", "source", "source_grade", "confidence", "date_of_info", "brief", "domain", "idea", "contradicts", "created", "verified", "verification", "corrected"],
  "source.md": ["id", "url", "title", "publisher", "author", "published", "accessed", "accessed_via", "type", "grade", "raw"],
  "topic.md": ["id", "title", "updated", "briefs", "domains", "status"],
  "critique-domain.md": CRITIQUE,
  "critique-idea.md": CRITIQUE,
  "analysis.md": ["idea", "brief", "created", "updated", "author"],
  "primer.md": REPORT,
  "report-domain.md": REPORT,
  "report-final.md": [...REPORT, "total_score"],
};

test("the templates folder holds exactly the fourteen templates", () => {
  const files = readdirSync(DIR).filter(f => f.endsWith(".md")).sort();
  assert.deepEqual(files, Object.keys(REQUIRED).sort());
});

test("every template has frontmatter with its required keys", () => {
  for (const [file, keys] of Object.entries(REQUIRED)) {
    const { fm } = parseFrontmatter(readFileSync(join(DIR, file), "utf8"));
    assert.ok(fm, `${file}: no frontmatter`);
    for (const k of keys) assert.ok(k in fm, `${file}: missing ${k}`);
  }
});

test("domain and idea templates carry the five confidence keys", () => {
  const keys = file => Object.keys(parseFrontmatter(readFileSync(join(DIR, file), "utf8")).fm.confidence);
  assert.deepEqual(keys("domain.md"), ["fundamentals", "demand", "models", "signals", "entry"]);
  assert.deepEqual(keys("idea.md"), ["demand", "competition", "complexity", "economics", "entry"]);
});

test("the source template no longer carries the hand-maintained usage list", () => {
  assert.ok(!/Використано в/.test(readFileSync(join(DIR, "source.md"), "utf8")));
});

test("the screening template is a brief without domain or idea, with the comparison and the decision", () => {
  const text = readFileSync(join(DIR, "brief-screen.md"), "utf8");
  const { fm } = parseFrontmatter(text);
  assert.equal(fm.layer, "screen");
  assert.equal(fm.domain, null);
  assert.equal(fm.idea, null);
  assert.match(text, /^## Порівняння напрямів$/m);
  assert.match(text, /^## Рішення відбору\n_\(заповнює \/decide/m);
});
