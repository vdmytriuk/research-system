#!/usr/bin/env node
// Pipeline state for /review and /explore. `--waiting` prints only what waits on the user.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadWiki, under, ROOT, screenDecided } from "./_lib.mjs";

const onlyWaiting = process.argv.includes("--waiting");
const pages = loadWiki();
const domains = under(pages, "domains"), ideas = under(pages, "ideas"), briefs = under(pages, "briefs");
const evidence = under(pages, "evidence"), sources = under(pages, "sources"), topics = under(pages, "topics");
const reports = under(pages, "reports");
const LAYERS = ["fundamentals", "demand", "models", "signals", "entry"];
const WORKSTREAMS = ["demand", "competition", "complexity", "economics", "entry"];
const CHAIN = ["scouts", "verify", "digest"];
const DAY = 86400e3;
const inChain = b => CHAIN.includes(b.fm.run_stage);
const short = (s, n = 90) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const tag = b => b.fm.idea ? ` (${b.fm.idea})` : b.fm.domain ? ` (${b.fm.domain})` : "";
// Template placeholders ("1. [ ] …", optionally with an italic hint) are not questions.
const queue = p => [...p.body.matchAll(/^\s*(?:\d+\.|-)\s+\[ \](.*)$/gm)]
  .filter(m => m[1].replace(/_\(.*?\)_/g, "").replace(/…/g, "").trim() !== "").length;
const conf = (p, keys) => keys.map(k => `${k}: ${p.fm.confidence?.[k] ?? "—"}`).join(" · ");

// --- Waiting on you: stops and gates --------------------------------------------------
const waiting = [];
for (const b of briefs) if (b.fm.status === "draft") waiting.push(`gate 1: ${b.fm.id} [draft] ${short(b.fm.question)} → approve or edit the brief`);
for (const b of briefs) if (b.fm.run_stage === "checked") waiting.push(`stop after collection: ${b.fm.id}${tag(b)} collected and verified → /review ${b.fm.id}`);
for (const b of briefs) {
  if (b.fm.status !== "collected" || b.fm.reviewed != null || b.fm.run_stage != null) continue;
  const since = String(b.fm.run_finished ?? b.fm.run_started ?? "?").slice(0, 10);
  waiting.push(`gate 2: ${b.fm.id}${tag(b)} collected ${since} → /review ${b.fm.id}`);
}
for (const b of briefs) if (b.fm.layer === "screen" && b.fm.reviewed && !screenDecided(b)) waiting.push(`screening decision: ${b.fm.id} compared, which direction to open → /review ${b.fm.id}`);
for (const d of domains) if (d.fm.checkpoint === "ready") waiting.push(`phase stop: ${d.fm.id} (${d.fm.phase}) → /review ${d.fm.id}`);
for (const i of ideas) if (i.fm.checkpoint === "ready") waiting.push(`gate 3: ${i.fm.id} → /review ${i.fm.id}`);
const oq = join(ROOT, "wiki", "open-questions.md");
const open = existsSync(oq) ? readFileSync(oq, "utf8").split("\n").filter(l => l.startsWith("- [ ]")) : [];

console.log("## Waiting on you");
if (!waiting.length && !open.length) console.log("nothing is waiting");
waiting.forEach(l => console.log(l));
if (open.length) { console.log(`questions (${open.length}):`); open.slice(0, 5).forEach(l => console.log(l)); }
if (onlyWaiting) process.exit(0);

// --- Running: background chains -------------------------------------------------------
const needsCheck = e => e.fm.type !== "absence" && /\d/.test(String(e.fm.claim));
function progress(b) {
  const sqs = new Set([...b.body.matchAll(/^### (\d+)\. /gm)].map(m => m[1]));
  const prefix = "E-" + b.fm.id.replace("-", "") + "-";
  const bySq = new Map();
  for (const e of evidence) {
    if (!String(e.fm.id).startsWith(prefix)) continue;
    const sq = e.fm.id.slice(prefix.length).split("-")[0];
    if (!bySq.has(sq)) bySq.set(sq, []);
    bySq.get(sq).push(e);
  }
  const covered = [...sqs].filter(s => bySq.has(s));
  const verified = covered.filter(s => bySq.get(s).every(e => !needsCheck(e) || e.fm.verification != null));
  return `evidence ${covered.length}/${sqs.size} sq · verified ${verified.length}/${sqs.size} sq`;
}
console.log("\n## Running");
const running = [];
for (const b of briefs.filter(inChain)) {
  const mins = b.fm.run_started ? Math.round((Date.now() - Date.parse(b.fm.run_started)) / 60000) : null;
  const stale = mins != null && mins > 180 ? ` · possibly interrupted: /research ${b.fm.id}` : "";
  running.push(`${b.fm.id} [${b.fm.run_stage}] ${mins ?? "?"} min · ${progress(b)}${tag(b)}${stale}`);
}
for (const b of briefs.filter(b => b.fm.run_stage === "queued")) running.push(`${b.fm.id} [queued] starts when a running brief finishes`);
for (const d of domains) if (d.fm.checkpoint === "running") running.push(`${d.fm.id} phase stop running (${d.fm.phase === "intro" ? "writer primer" : "critic → writer"})`);
for (const i of ideas) if (i.fm.checkpoint === "running") running.push(`${i.fm.id} synthesis running (writer analysis → critic → writer final)`);
console.log(running.length ? running.join("\n") : "nothing is running");

// --- Domains ----------------------------------------------------------------------------
console.log("\n## Domains");
const live = domains.filter(d => d.fm.status !== "closed");
if (!live.length) console.log("none");
for (const d of live) {
  const start = Date.parse(d.fm.created), target = Date.parse(d.fm.target);
  const wk = Number.isFinite(start) ? Math.floor((Date.now() - start) / (7 * DAY)) + 1 : "?";
  const week = Number.isFinite(start) && Number.isFinite(target) ? `week ${wk} of ${Math.max(1, Math.ceil((target - start) / (7 * DAY)))}` : `week ${wk}`;
  const cp = d.fm.checkpoint ? ` · checkpoint ${d.fm.checkpoint}` : "";
  console.log(`${d.fm.id} ${d.fm.title ?? ""} [${d.fm.status}] phase ${d.fm.phase} · ${week} · ${conf(d, LAYERS)} · queue ${queue(d)} · briefs ${(d.fm.briefs ?? []).length}${cp}`);
}

// --- Ideas ------------------------------------------------------------------------------
console.log("\n## Ideas");
if (!ideas.length) console.log("none");
for (const i of ideas.filter(i => !["parked", "killed"].includes(i.fm.stage))) {
  const cp = i.fm.checkpoint ? ` · checkpoint ${i.fm.checkpoint}` : "";
  console.log(`${i.fm.id} ${i.fm.title ?? ""} [${i.fm.stage}]${i.fm.domain ? ` ${i.fm.domain}` : ""} · ${conf(i, WORKSTREAMS)} · queue ${queue(i)} · total ${i.fm.total ?? "—"}${cp}`);
}
for (const st of ["parked", "killed"]) {
  const list = ideas.filter(i => i.fm.stage === st);
  if (list.length) console.log(`${st}: ` + list.map(i => `${i.fm.id} ${i.fm.title ?? ""}`).join(" · "));
}

// --- Briefs -----------------------------------------------------------------------------
function next(b) {
  const { status, run_stage, reviewed, id } = b.fm;
  if (status === "draft") return "approve or edit (gate 1)";
  if (status === "approved") return run_stage === "queued" ? "queued" : `start or resume: /research ${id}`;
  if (run_stage === "checked") return `/review ${id}`;
  if (status === "running") return "running";
  if (status === "collected" && reviewed != null && b.fm.layer === "screen") return screenDecided(b) ? "decided" : `screening decision: /review ${id}`;
  if (status === "collected") return reviewed == null ? `/review ${id}` : "reviewed";
  return "—";
}
console.log("\n## Briefs");
if (!briefs.length) console.log("none");
for (const b of briefs) console.log(`${b.fm.id} [${b.fm.status}] ${short(b.fm.question, 110)} → next: ${next(b)}${tag(b)}`);

// --- Reports and counts -----------------------------------------------------------------
console.log("\n## Reports");
if (!reports.length) console.log("none");
for (const r of reports.slice(-5)) console.log(`${r.fm.id} → ${r.fm.target} (${r.fm.type}, ${r.fm.confidence})`);
const grades = {}; for (const s of sources) grades[s.fm.grade] = (grades[s.fm.grade] ?? 0) + 1;
console.log(`\n## Counts\nevidence ${evidence.length} · sources ${sources.length} ${JSON.stringify(grades)} · domains ${domains.length} · ideas ${ideas.length} · topics ${topics.length} (stale ${topics.filter(t => t.fm.status === "stale").length})`);
