#!/usr/bin/env node
// Wiki integrity check. Exit 1 on errors. Warnings never fail.
// `--fix` first rewrites derived fields (briefs / candidates / reports lists on domains
// and ideas, stale topics, contradicts back-links), then checks the result.
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadWiki, normaliseUrl, under, parseFrontmatter, screenDecided, section } from "./_lib.mjs";

const FIX = process.argv.includes("--fix");
const DOMAIN_STATUS = ["active", "paused", "closed"];
const DOMAIN_PHASE = ["intro", "map", "focus", "candidates"];
const CHECKPOINT = ["running", "ready"];
const LAYERS = ["fundamentals", "demand", "models", "signals", "entry"];
const WORKSTREAMS = ["demand", "competition", "complexity", "economics", "entry"];
const IDEA_STAGE = ["active", "validation", "parked", "killed"];
const DECISION = ["advance", "park", "kill"];
const BRIEF_STATUS = ["draft", "approved", "running", "collected"];
const RUN_STAGE = ["queued", "scouts", "verify", "checked", "digest"];
const REPORT_TYPE = ["primer", "domain", "final"];
const GRADES = ["A", "B", "C", "D"];
const E_TYPES = ["fact", "statistic", "estimate", "opinion", "anecdote", "absence"];
const ACCESS = ["direct", "archive", "secondary", "blocked"];
const CONF = ["high", "medium", "low"];
const VERIF = ["ok", "inexact", "failed", "unreachable"];
const TOPIC_STATUS = ["active", "stale"];
const E_ID = /^E-(B\d{3}-\d+-\d{2}|[DI]\d{3}-C-\d{2}|ING-\d{8}-\d{2})$/;
const DAY = 86400e3;
const date = v => (v ? Date.parse(String(v).slice(0, 10)) : NaN);
const sorted = a => [...new Set(a ?? [])].sort();
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

// --- --fix: derived fields only ---------------------------------------------------
const fixes = [];
function setLine(p, key, line) {
  // Operate on the frontmatter block only: from the opening --- to the next \n---.
  const end = p.text.startsWith("---") ? p.text.indexOf("\n---", 3) : -1;
  if (end < 0) return;
  const head = p.text.slice(0, end), rest = p.text.slice(end);
  const re = new RegExp(`^${key}:.*?(\\s+#.*)?$`, "m");
  const newHead = re.test(head)
    ? head.replace(re, (_, comment) => line + (comment ?? ""))
    : head.replace(/^(id:.*)$/m, (m) => `${m}\n${line}`);
  if (newHead === head) return;
  const text = newHead + rest;
  writeFileSync(p.path, text);
  p.text = text;
  fixes.push(`${p.rel}: ${key}`);
}
function setList(p, key, arr) {
  p.fm[key] = sorted(arr);
  setLine(p, key, `${key}: [${p.fm[key].join(", ")}]`);
}
function applyFixes(pages) {
  const domains = under(pages, "domains"), ideas = under(pages, "ideas"), briefs = under(pages, "briefs");
  const reports = under(pages, "reports"), topics = under(pages, "topics"), evidence = under(pages, "evidence");
  const ids = (list, pick) => list.filter(pick).map(p => p.fm.id);
  for (const d of domains) {
    const want = {
      briefs: ids(briefs, b => b.fm.domain === d.fm.id),
      candidates: ids(ideas, i => i.fm.domain === d.fm.id),
      reports: ids(reports, r => r.fm.target === d.fm.id),
    };
    for (const [k, v] of Object.entries(want)) if (!same(d.fm[k], v)) setList(d, k, v);
  }
  for (const i of ideas) {
    const want = { briefs: ids(briefs, b => b.fm.idea === i.fm.id), reports: ids(reports, r => r.fm.target === i.fm.id) };
    for (const [k, v] of Object.entries(want)) if (!same(i.fm[k], v)) setList(i, k, v);
  }
  for (const t of topics) {
    if (t.fm.status === "active" && t.fm.updated && Date.now() - date(t.fm.updated) > 60 * DAY) setLine(t, "status", "status: stale");
  }
  const byId = new Map(evidence.map(e => [e.fm.id, e]));
  for (const e of evidence) for (const c of e.fm.contradicts ?? []) {
    const other = byId.get(c);
    if (other && !(other.fm.contradicts ?? []).includes(e.fm.id)) setList(other, "contradicts", [...(other.fm.contradicts ?? []), e.fm.id]);
  }
}

let pages = loadWiki();
if (FIX) { applyFixes(pages); pages = loadWiki(); }

// --- checks -------------------------------------------------------------------------
const errors = [], warnings = [];
const err = (p, m) => errors.push(`${p.rel}: ${m}`);
const warn = (p, m) => warnings.push(`${p.rel}: ${m}`);
const domains = under(pages, "domains"), ideas = under(pages, "ideas"), briefs = under(pages, "briefs");
const evidence = under(pages, "evidence"), sources = under(pages, "sources"), topics = under(pages, "topics");
const reports = under(pages, "reports"), critiques = under(pages, "critique"), analyses = under(pages, "analysis");
const byId = new Map(), referenced = new Set(), sourceUrls = new Map(), blockedSources = new Set(), briefStatus = new Map();
const isA = (id, dir) => byId.get(id)?.rel.startsWith(`wiki/${dir}/`) === true;

function checkConfidence(p, keys) {
  for (const k of keys) {
    const c = p.fm.confidence?.[k];
    if (c === undefined) err(p, `confidence missing ${k}`);
    else if (c !== null && !CONF.includes(c)) err(p, `invalid confidence.${k} "${c}"`);
  }
}
// Rule 4: a domain or final report needs a critique newer than the material it covers.
function critiqueFresh(p) {
  const crit = critiques.find(c => c.fm.target === p.fm.target);
  if (!crit) return err(p, `no critique for ${p.fm.target} (wiki/critique/${p.fm.target}-critique.md)`);
  const bad = (page, field) => err(page, `unreadable date on ${page.rel}: ${field} "${page.fm[field]}"`);
  const critField = crit.fm.updated != null ? "updated" : "created";
  const critDate = date(crit.fm[critField]);
  if (Number.isNaN(critDate)) return bad(crit, critField);
  if (p.fm.type === "domain") {
    const reviewed = briefs.filter(b => b.fm.domain === p.fm.target && b.fm.reviewed);
    let newest = -Infinity;
    for (const b of reviewed) {
      const d = date(b.fm.reviewed);
      if (Number.isNaN(d)) return bad(b, "reviewed");
      newest = Math.max(newest, d);
    }
    if (Number.isFinite(newest) && critDate < newest) err(p, `critique for ${p.fm.target} is older than the newest reviewed brief`);
  } else {
    const an = analyses.find(a => a.fm.idea === p.fm.target);
    if (an) {
      const f = an.fm.updated != null ? "updated" : "created";
      const d = date(an.fm[f]);
      if (Number.isNaN(d)) return bad(an, f);
      if (critDate < d) err(p, `critique for ${p.fm.target} is older than the analysis`);
    }
  }
}

for (const p of pages) {
  if (/wiki\/(index|open-questions)\.md$/.test(p.rel)) continue;
  if (!p.fm) { err(p, "no frontmatter"); continue; }
  if (p.fm.id) {
    if (byId.has(p.fm.id)) err(p, `duplicate id ${p.fm.id} (also ${byId.get(p.fm.id).rel})`);
    byId.set(p.fm.id, p);
  }
  for (const m of p.text.matchAll(/\[\[([A-Z]-[A-Za-z0-9-]+)\]\]/g)) referenced.add(m[1]);

  if (p.rel.startsWith("wiki/domains/")) {
    if (!/^D-\d{3}$/.test(String(p.fm.id))) err(p, `invalid domain id "${p.fm.id}"`);
    else if (!p.rel.startsWith(`wiki/domains/${p.fm.id}-`)) err(p, `file name must start with ${p.fm.id}-`);
    if (!p.fm.title) err(p, "missing title");
    if (!DOMAIN_STATUS.includes(p.fm.status)) err(p, `invalid status "${p.fm.status}"`);
    if (!DOMAIN_PHASE.includes(p.fm.phase)) err(p, `invalid phase "${p.fm.phase}"`);
    if (p.fm.checkpoint != null && !CHECKPOINT.includes(p.fm.checkpoint)) err(p, `invalid checkpoint "${p.fm.checkpoint}"`);
    checkConfidence(p, LAYERS);
    if (p.fm.status === "active" && !p.fm.owner) err(p, "active domain without owner");
    if (p.fm.status === "active" && p.fm.updated && Date.now() - date(p.fm.updated) > 14 * DAY) warn(p, "active domain not updated for 14+ days");
  }
  if (p.rel.startsWith("wiki/ideas/")) {
    if (!/^I-\d{3}$/.test(String(p.fm.id))) err(p, `invalid idea id "${p.fm.id}"`);
    if (!p.fm.title) err(p, "missing title");
    if (!IDEA_STAGE.includes(p.fm.stage)) err(p, `invalid stage "${p.fm.stage}"`);
    if (p.fm.decision != null && !DECISION.includes(p.fm.decision)) err(p, `invalid decision "${p.fm.decision}"`);
    if (p.fm.checkpoint != null && !CHECKPOINT.includes(p.fm.checkpoint)) err(p, `invalid checkpoint "${p.fm.checkpoint}"`);
    checkConfidence(p, WORKSTREAMS);
  }
  if (p.rel.startsWith("wiki/briefs/")) {
    if (!BRIEF_STATUS.includes(p.fm.status)) err(p, `invalid status "${p.fm.status}"`);
    if (!p.fm.question) err(p, "missing question");
    if (p.fm.id) briefStatus.set(p.fm.id, p.fm.status);
    if (p.fm.run_stage != null && !RUN_STAGE.includes(p.fm.run_stage)) err(p, `invalid run_stage "${p.fm.run_stage}"`);
    if (p.fm.status === "running" && p.fm.run_stage == null) err(p, "running brief without run_stage");
    if (p.fm.status !== "draft" && !p.fm.author) err(p, "brief past gate 1 without author");
    if (p.fm.layer === "screen") {
      if (p.fm.domain != null || p.fm.idea != null) err(p, 'layer "screen" is only for a brief without domain or idea');
      else if (p.fm.reviewed && !screenDecided(p)) warn(p, `screening reviewed without a decision: /decide ${p.fm.id} open <n> | none`);
    } else if (p.fm.layer != null) {
      const allowed = p.fm.idea != null ? WORKSTREAMS : LAYERS;
      if (!allowed.includes(p.fm.layer)) err(p, `invalid layer "${p.fm.layer}" for ${p.fm.idea != null ? "an idea" : "a domain"} brief`);
    } else if (p.fm.domain != null || p.fm.idea != null) warn(p, "brief under a domain or idea without layer");
    const since = p.fm.run_finished ?? p.fm.run_started;
    if (p.fm.status === "collected" && p.fm.reviewed == null && p.fm.run_stage == null && since && Date.now() - date(since) > 7 * DAY)
      warn(p, `awaiting gate 2 for 7+ days: /review ${p.fm.id}`);
  }
  if (p.rel.startsWith("wiki/evidence/")) {
    const required = p.fm.type === "absence" ? ["claim", "type", "confidence"] : ["claim", "source", "type", "confidence"];
    for (const k of required) if (p.fm[k] == null || p.fm[k] === "") err(p, `missing ${k}`);
    if (!E_ID.test(String(p.fm.id))) err(p, `invalid evidence id "${p.fm.id}"`);
    if (p.fm.brief == null && p.fm.domain == null && p.fm.idea == null) err(p, "evidence without brief, domain or idea");
    if (p.fm.type === "absence" && !/##\s*Метод пошуку/.test(p.body)) err(p, "absence without ## Метод пошуку");
    if (!E_TYPES.includes(p.fm.type)) err(p, `invalid type "${p.fm.type}"`);
    if (!CONF.includes(p.fm.confidence)) err(p, `invalid confidence "${p.fm.confidence}"`);
    if (p.fm.verification != null && !VERIF.includes(p.fm.verification)) err(p, `invalid verification "${p.fm.verification}"`);
    if (p.fm.corrected != null && Number.isNaN(date(p.fm.corrected))) err(p, `unreadable date corrected "${p.fm.corrected}"`);
    if (p.fm.type === "estimate" && !/##\s*Метод/.test(p.body)) warn(p, "estimate without ## Метод");
    if (typeof p.fm.claim === "string" && p.fm.claim.split(/\s+/).length > 30) warn(p, "claim longer than 30 words");
    if (!p.fm.date_of_info) warn(p, "missing date_of_info");
    if (["C", "D"].includes(p.fm.source_grade) && p.fm.confidence === "high") warn(p, "high confidence on C/D source");
    for (const c of p.fm.contradicts ?? []) referenced.add(c);
    if (typeof p.fm.source === "string") referenced.add(p.fm.source);
  }
  if (p.rel.startsWith("wiki/sources/")) {
    for (const k of ["url", "title", "accessed"]) if (!p.fm[k]) err(p, `missing ${k}`);
    if (!GRADES.includes(p.fm.grade)) err(p, `invalid grade "${p.fm.grade}"`);
    if (p.fm.accessed_via != null && !ACCESS.includes(p.fm.accessed_via)) err(p, `invalid accessed_via "${p.fm.accessed_via}"`);
    if (p.fm.accessed_via === "blocked") blockedSources.add(p.fm.id);
    if (p.fm.url) {
      const n = normaliseUrl(p.fm.url);
      if (sourceUrls.has(n)) err(p, `duplicate source url (also ${sourceUrls.get(n).rel})`);
      sourceUrls.set(n, p);
    }
    if (!p.fm.published || /невідомо/i.test(String(p.fm.published))) warn(p, "undated source");
  }
  if (p.rel.startsWith("wiki/topics/")) {
    if (!/^T-[a-z0-9-]+$/.test(String(p.fm.id))) err(p, `invalid topic id "${p.fm.id}"`);
    if (!p.fm.title) err(p, "missing title");
    if (!p.fm.updated) err(p, "missing updated");
    if (!TOPIC_STATUS.includes(p.fm.status)) err(p, `invalid status "${p.fm.status}"`);
    else if (p.fm.updated && Date.now() - date(p.fm.updated) > 60 * DAY && p.fm.status !== "stale") warn(p, "not updated for 60+ days; lint --fix marks it stale");
    for (const d of p.fm.domains ?? []) referenced.add(d);
  }
  if (p.rel.startsWith("wiki/critique/")) {
    if (!p.fm.target) err(p, "missing target");
    else if (!p.rel.endsWith(`/${p.fm.target}-critique.md`)) err(p, `file name must be ${p.fm.target}-critique.md`);
    if (!p.fm.created) err(p, "missing created");
  }
  if (p.rel.startsWith("wiki/analysis/")) {
    if (!p.fm.idea) err(p, "missing idea");
    else if (!p.rel.endsWith(`/${p.fm.idea}-analysis.md`)) err(p, `file name must be ${p.fm.idea}-analysis.md`);
  }
  if (p.rel.startsWith("wiki/reports/")) {
    if (!p.fm.target) err(p, "missing target");
    if (!REPORT_TYPE.includes(p.fm.type)) err(p, `invalid type "${p.fm.type}"`);
    if (!CONF.includes(p.fm.confidence)) err(p, `invalid confidence "${p.fm.confidence}"`);
    if (p.fm.target && p.fm.type !== "primer" && REPORT_TYPE.includes(p.fm.type)) critiqueFresh(p);
    const untagged = p.body.split("\n").filter(l => /^[^#|>\-\s].{40,}$/.test(l) && !/\[\[E-/.test(l) && !/доказів не знайдено/i.test(l));
    if (untagged.length) warn(p, `${untagged.length} long sentence(s) without evidence tag`);
  }
}

// --- cross-page checks --------------------------------------------------------------
for (const ref of referenced) {
  if (!byId.has(ref)) {
    const owners = pages.filter(p => p.text.includes(`[[${ref}]]`) || p.fm?.source === ref || (p.fm?.contradicts ?? []).includes(ref) || (p.fm?.domains ?? []).includes(ref)).map(p => p.rel);
    errors.push(`broken link [[${ref}]] in ${owners.join(", ")}`);
  }
}
for (const p of [...ideas, ...briefs, ...evidence]) {
  if (p.fm.domain != null && !isA(p.fm.domain, "domains")) err(p, `unknown domain ${p.fm.domain}`);
  if (p.fm.idea != null && !isA(p.fm.idea, "ideas")) err(p, `unknown idea ${p.fm.idea}`);
}
for (const p of evidence) if (p.fm.brief != null && !isA(p.fm.brief, "briefs")) err(p, `unknown brief ${p.fm.brief}`);
for (const p of [...critiques, ...reports]) if (p.fm.target && !byId.has(p.fm.target)) err(p, `unknown target ${p.fm.target}`);
for (const p of reports) {
  const dir = { domain: "domains", final: "ideas" }[p.fm.type];
  if (dir && p.fm.target && byId.has(p.fm.target) && !isA(p.fm.target, dir)) err(p, `report type "${p.fm.type}" does not match target ${p.fm.target}`);
}
for (const p of analyses) if (p.fm.idea && !isA(p.fm.idea, "ideas")) err(p, `unknown idea ${p.fm.idea}`);
// Orphan evidence: nothing links to it and it names no domain or idea
for (const p of evidence) if (!referenced.has(p.fm.id) && p.fm.domain == null && p.fm.idea == null) warn(p, "orphan evidence (not linked from any page, no domain or idea)");
// Accumulation: a collected brief with evidence must be folded into topic pages; numeric claims verified
const topicText = topics.map(t => t.text).join("\n");
for (const [bid, st] of briefStatus) {
  if (st !== "collected") continue;
  const prefix = "E-" + bid.replace("-", "") + "-";
  const b = byId.get(bid);
  if (b && evidence.some(e => String(e.fm.id).startsWith(prefix)) && !topicText.includes("[[" + prefix))
    warn(b, `collected brief not folded into any topic page (no [[${prefix}…]] under wiki/topics/)`);
}
// Corrections: an inexact or failed verdict is applied by the lead at the tail (research step 7).
for (const p of evidence) {
  if (!["inexact", "failed"].includes(p.fm.verification) || briefStatus.get(p.fm.brief) !== "collected") continue;
  if (p.fm.corrected == null) warn(p, `verdict ${p.fm.verification} not applied: set claim to the critic's wording and corrected: <date> (research step 7)`);
  else if (date(p.fm.corrected) < date(p.fm.verified)) warn(p, `verdict of ${p.fm.verified} is newer than the correction of ${p.fm.corrected}: apply it again (research step 7)`);
}
// Re-verify: a verdict given before a page from another brief contradicted it, and not revisited since.
const evidenceById = new Map(evidence.map(e => [e.fm.id, e]));
for (const p of evidence) {
  if (p.fm.verification == null || !p.fm.verified) continue;
  const others = new Set([...(p.fm.contradicts ?? []), ...evidence.filter(e => (e.fm.contradicts ?? []).includes(p.fm.id)).map(e => e.fm.id)]);
  for (const oid of others) {
    const o = evidenceById.get(oid);
    if (!o || o.fm.brief === p.fm.brief || !o.fm.created) continue;
    if (date(o.fm.created) >= date(p.fm.verified) && !section(p.body, "Верифікація").includes(oid))
      warn(p, `verified ${p.fm.verified} before ${oid} contradicted it: re-verify (critic verify ${p.fm.id}) and name ${oid} in the new verdict`);
  }
}
for (const p of evidence) {
  if (briefStatus.get(p.fm.brief) === "collected" && p.fm.type !== "absence" && /\d/.test(String(p.fm.claim)) && p.fm.verification == null) warn(p, "numeric claim not verified");
  if (typeof p.fm.source === "string" && blockedSources.has(p.fm.source)) warn(p, `rests on a blocked source ${p.fm.source}`);
  for (const c of p.fm.contradicts ?? []) {
    const other = byId.get(c);
    if (other && !(other.fm.contradicts ?? []).includes(p.fm.id)) warn(p, `contradicts ${c} but ${c} does not link back (lint --fix adds it)`);
  }
}

// docs/context.md is read before every task; it must say whom it describes and when it was confirmed.
const contextPath = join(ROOT, "docs", "context.md");
if (existsSync(contextPath)) {
  const ctx = { rel: "docs/context.md" };
  const { fm } = parseFrontmatter(readFileSync(contextPath, "utf8"));
  if (!fm?.updated) warn(ctx, "no `updated:` date: confirm it describes the organisation the research serves (templates/context.md)");
  else if (Number.isNaN(date(fm.updated))) err(ctx, `unreadable date updated "${fm.updated}"`);
  else if (Date.now() - date(fm.updated) > 90 * DAY) warn(ctx, "not confirmed for 90+ days: review it with the editor before a new domain or screening");
}

for (const f of fixes) console.log("FIXED   " + f);
for (const e of errors) console.log("ERROR   " + e);
for (const w of warnings) console.log("WARNING " + w);
console.log(`\nlint: ${errors.length} error(s), ${warnings.length} warning(s), ${pages.length} page(s)${FIX ? `, ${fixes.length} fix(es)` : ""}`);
process.exit(errors.length ? 1 : 0);
