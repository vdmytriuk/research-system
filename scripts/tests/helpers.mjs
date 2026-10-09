// Test helpers: build a throwaway wiki and run a script against it via RESEARCH_ROOT.
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..");

// entries: [relative path, text] pairs, as returned by the builders below.
export function makeWiki(...entries) {
  const root = mkdtempSync(join(tmpdir(), "research-wiki-"));
  mkdirSync(join(root, "wiki"), { recursive: true });
  for (const [rel, text] of entries) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}

// Runs scripts/<script> with RESEARCH_ROOT=root; `input` is piped to stdin (hooks).
export function run(script, root, args = [], input = "") {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
    env: { ...process.env, RESEARCH_ROOT: root }, encoding: "utf8", input,
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Local date `offset` days from today, yyyy-mm-dd.
export const day = offset => ymd(new Date(Date.now() + offset * 86400e3));
// Local timestamp `minutes` ago, yyyy-mm-ddThh:mm — the format run logs use.
export const stamp = minutes => {
  const d = new Date(Date.now() - minutes * 60000);
  return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const val = v => v === null ? "null"
  : Array.isArray(v) ? `[${v.join(", ")}]`
  : typeof v === "string" && (v === "" || /: |#/.test(v)) ? JSON.stringify(v)
  : String(v);

export function page(fm, body = "") {
  const lines = [];
  for (const [k, v] of Object.entries(fm)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) lines.push(`  ${k2}: ${val(v2)}`);
    } else lines.push(`${k}: ${val(v)}`);
  }
  return `---\n${lines.join("\n")}\n---\n${body}\n`;
}

export const NO_LAYERS = { fundamentals: null, demand: null, models: null, signals: null, entry: null };
export const NO_WORKSTREAMS = { demand: null, competition: null, complexity: null, economics: null, entry: null };

export const domain = (id, extra = {}, body = "") => [`wiki/domains/${id}-x.md`, page({
  id, title: `Domain ${id}`, owner: "editor", author: "editor", status: "active", phase: "intro",
  checkpoint: null, created: day(-3), updated: day(0), target: null,
  confidence: NO_LAYERS, briefs: [], candidates: [], reports: [], ...extra,
}, body)];

export const idea = (id, extra = {}, body = "") => [`wiki/ideas/${id}-x.md`, page({
  id, title: `Idea ${id}`, domain: null, owner: "editor", author: "editor", stage: "active",
  decision: null, checkpoint: null, created: day(-3), updated: day(0), decided: null,
  target_decision: null, confidence: NO_WORKSTREAMS, briefs: [], reports: [], total: null, ...extra,
}, body)];

export const brief = (id, extra = {}, body = "") => [`wiki/briefs/${id}-x.md`, page({
  id, question: `Question ${id}`, domain: null, idea: null, layer: null, author: "editor",
  status: "draft", created: day(0), approved: null, run_stage: null, run_started: null,
  run_finished: null, reviewed: null, ...extra,
}, body)];

export const evidence = (id, extra = {}) => [`wiki/evidence/${id}.md`, page({
  id, claim: "Claim with 10 units", type: "fact", source: "S-00000000", source_grade: "B",
  confidence: "low", date_of_info: day(0), brief: null, domain: null, idea: null,
  contradicts: [], created: day(0), verified: null, verification: null, corrected: null, ...extra,
}, "\n## Цитата\n> quote\n")];

export const source = (id = "S-00000000", extra = {}) => [`wiki/sources/${id}.md`, page({
  id, url: `https://example.com/${id}`, title: `Source ${id}`, publisher: "x", published: "2026",
  accessed: day(0), accessed_via: "direct", type: "primary", grade: "B", raw: null, ...extra,
})];

export const topic = (id, extra = {}, body = "") => [`wiki/topics/${id}.md`, page({
  id, title: `Topic ${id}`, updated: day(0), briefs: [], domains: [], status: "active", ...extra,
}, body)];

export const report = (id, target, type = "primer", extra = {}, body = "") => [`wiki/reports/${id}-x.md`, page({
  id, target, type, author: "writer", created: day(0), confidence: "low",
  confidence_set_by: "grade", total_score: null, briefs: [], ...extra,
}, body)];

export const critique = (target, extra = {}) => [`wiki/critique/${target}-critique.md`, page({
  target, author: "critic", created: day(0), updated: day(0),
  spotcheck: { ok: 0, inexact: 0, failed: 0 }, ...extra,
})];

export const analysis = (ideaId, extra = {}) => [`wiki/analysis/${ideaId}-analysis.md`, page({
  idea: ideaId, brief: [], created: day(0), updated: day(0), author: "writer", ...extra,
})];
