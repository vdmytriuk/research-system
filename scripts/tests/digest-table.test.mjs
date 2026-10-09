// Run: node scripts/tests/digest-table.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWiki, run, brief, evidence, source, page } from "./helpers.mjs";

const BODY = "\n## Підпитання\n### 1. Ринок\n### 2. Конкуренти\n### 3. Бар'єри\n";
const withVerdict = (id, extra, verdict) => {
  const [rel, text] = evidence(id, extra);
  return [rel, text + `\n## Верифікація\n${verdict}\n`];
};
const wiki = () => makeWiki(
  brief("B-001", { status: "collected" }, BODY),
  source("S-00000001", { publisher: "НКРЕКП", title: "Звіт | 2025", grade: "A" }),
  evidence("E-B001-1-01", { brief: "B-001", source: "S-00000001", source_grade: "A", verification: "ok", claim: "Ринок виріс на 17%" }),
  withVerdict("E-B001-1-02", { brief: "B-001", source: "S-00000001", verification: "inexact", claim: "Будь-який бізнес отримує 8 млн", contradicts: ["E-B001-2-01"] },
    "2026-10-08 — inexact: є виключення.\nКоректне формулювання: «Бізнес, крім держсектору, отримує до 8 млн»"),
  evidence("E-B001-2-01", { brief: "B-001", verification: null, claim: "Конкурентів 12", contradicts: ["E-B001-1-02"] }),
  evidence("E-B001-2-02", { brief: "B-001", type: "absence", source: null, claim: "доказів цін не знайдено" }),
  evidence("E-B002-1-01", { brief: "B-002", claim: "інший brief" }),
);

test("tallies, groups by sub-question and lists what waits", () => {
  const { code, out } = run("digest-table.mjs", wiki(), ["B-001"]);
  assert.equal(code, 0, out);
  assert.match(out, /^evidence 4 · inexact 1 · ok 1 · unverified 2 · absence 1$/m);
  assert.match(out, /^## 1\. Ринок$/m);
  assert.match(out, /^\| E-B001-1-02 \| fact \| B \| low \| inexact \| Будь-який бізнес отримує 8 млн \|$/m);
  assert.match(out, /^## 3\. Бар'єри\n_\(доказів немає\)_$/m);
  assert.match(out, /^- E-B001-1-02 \(inexact\): «Бізнес, крім держсектору, отримує до 8 млн»$/m);
  assert.match(out, /## Числа без вердикту\n- E-B001-2-01: Конкурентів 12/);
  assert.match(out, /^- E-B001-1-02 vs E-B001-2-01$/m);
  assert.doesNotMatch(out, /E-B002-1-01/);
});

test("a corrected page leaves the waiting list and carries a mark", () => {
  const root = makeWiki(
    brief("B-001", { status: "collected" }, BODY),
    withVerdict("E-B001-1-01", { brief: "B-001", verification: "inexact", corrected: "2026-10-09" }, "Коректне формулювання: «x»"),
  );
  const { out } = run("digest-table.mjs", root, ["B-001"]);
  assert.match(out, /\| inexact ✎ \|/);
  assert.match(out, /## Виправлення критика чекають \(research, крок 7\)\n- немає/);
});

test("--sources maps sub-questions to sources and escapes pipes", () => {
  const { out } = run("digest-table.mjs", wiki(), ["B-001", "--sources"]);
  assert.match(out, /### 1\n- S-00000001 \(A, НКРЕКП\) — Звіт \/ 2025: E-B001-1-01, E-B001-1-02/);
  assert.match(out, /### 2\n- S-00000000: E-B001-2-01\n- absence: E-B001-2-02/);
});

test("an unknown or malformed brief id exits 1", () => {
  assert.equal(run("digest-table.mjs", wiki(), ["B-009"]).code, 1);
  assert.equal(run("digest-table.mjs", wiki(), ["B1"]).code, 1);
});

// page() is used by the builders; keep the import honest.
test("helpers build a page", () => assert.match(page({ id: "x" }), /^---\nid: x\n---/));
